-- Compras de fornecedores: recebimentos físicos independentes de Pedidos das unidades.
-- Sem atualização de stock_balances fora da RPC transacional de estoque.
BEGIN;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS received_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_received_valid;
ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_received_valid
  CHECK (received_quantity BETWEEN 0 AND quantity);

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('rascunho','enviado','recebido_parcial','finalizado','cancelado'));

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  operation_batch_id uuid NOT NULL UNIQUE REFERENCES public.stock_operation_batches(id),
  request_id uuid NOT NULL UNIQUE,
  request_digest bytea NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_receipts_order_idx
 ON public.purchase_receipts(purchase_order_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE RESTRICT,
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  PRIMARY KEY (receipt_id,purchase_order_item_id)
);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_order_item_idx
 ON public.purchase_receipt_items(purchase_order_item_id);

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_receipts_read ON public.purchase_receipts;
CREATE POLICY purchase_receipts_read ON public.purchase_receipts FOR SELECT TO authenticated
 USING(app_private.has_permission('purchases.manage'));
DROP POLICY IF EXISTS purchase_receipt_items_read ON public.purchase_receipt_items;
CREATE POLICY purchase_receipt_items_read ON public.purchase_receipt_items FOR SELECT TO authenticated
 USING(app_private.has_permission('purchases.manage'));
REVOKE ALL ON public.purchase_receipts,public.purchase_receipt_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.purchase_receipts,public.purchase_receipt_items TO authenticated;

-- Não se pode mais concluir a compra alterando apenas o status sem conferir os itens.
CREATE OR REPLACE FUNCTION public.set_purchase_order_status(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.purchase_orders%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem autorização para compras'; END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não localizada'; END IF;
 IF NOT (
  (v_order.status='rascunho' AND p_status IN ('enviado','cancelado')) OR
  (v_order.status='enviado' AND p_status='cancelado')
 ) THEN
  RAISE EXCEPTION 'Transição inválida. Recebimentos exigem conferência física.'; END IF;
 UPDATE public.purchase_orders SET status=p_status,updated_at=now(),
  sent_at=CASE WHEN p_status='enviado' THEN now() ELSE sent_at END
 WHERE id=p_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_id::text,'PURCHASE_STATUS_CHANGED',auth.uid(),
  jsonb_build_object('before',v_order.status,'after',p_status,'stock_updated',false));
END;$fn$;
REVOKE ALL ON FUNCTION public.set_purchase_order_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_purchase_order_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
 p_order uuid, p_items jsonb, p_request_id uuid, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_order public.purchase_orders%rowtype;
 v_prior public.purchase_receipts%rowtype;
 v_digest bytea; v_line jsonb; v_order_item public.purchase_order_items%rowtype;
 v_item_id uuid; v_qty integer; v_received uuid;
 v_batch jsonb; v_batch_items jsonb:='[]'::jsonb;
 v_seen uuid[]:='{}'::uuid[]; v_current integer;
 v_note text:=nullif(btrim(coalesce(p_note,'')),'');
 v_status text; v_total integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage')
   OR NOT app_private.role_in('admin','gerente') THEN
  RAISE EXCEPTION 'Recebimento exige autorização de compras e perfil administrativo'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador do recebimento obrigatório'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Informe de 1 a 100 variações com quantidade recebida'; END IF;
 IF length(coalesce(v_note,''))>200 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
 v_digest:=extensions.digest(p_items::text,'sha256');
 PERFORM pg_catalog.pg_advisory_xact_lock(8142,pg_catalog.hashtext(p_request_id::text));
 SELECT * INTO v_prior FROM public.purchase_receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.purchase_order_id IS DISTINCT FROM p_order
   OR v_prior.request_digest IS DISTINCT FROM v_digest
   OR v_prior.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Identificador do recebimento já utilizado com outros dados'; END IF;
  RETURN jsonb_build_object('receipt_id',v_prior.id,'replayed',true);
 END IF;

 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR v_order.status NOT IN ('enviado','recebido_parcial') THEN
  RAISE EXCEPTION 'Pedido não está disponível para recebimento'; END IF;

 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(v_line)<>'object'
   OR coalesce(v_line->>'item_id','') !~ '^[0-9a-fA-F-]{36}$'
   OR coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]{0,6}$' THEN
    RAISE EXCEPTION 'Linha de recebimento inválida'; END IF;
  v_item_id:=(v_line->>'item_id')::uuid;
  v_qty:=(v_line->>'quantity')::integer;
  IF v_qty>1000000 OR v_item_id=ANY(v_seen) THEN
   RAISE EXCEPTION 'Quantidade inválida ou variação repetida'; END IF;
  v_seen:=array_append(v_seen,v_item_id);
  SELECT * INTO v_order_item FROM public.purchase_order_items
   WHERE id=v_item_id AND purchase_order_id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variação não pertence a esta compra'; END IF;
  IF v_order_item.received_quantity+v_qty>v_order_item.quantity THEN
   RAISE EXCEPTION 'Quantidade recebida maior que o saldo pendente'; END IF;
  SELECT quantity INTO v_current FROM public.stock_balances
   WHERE product_id=v_order_item.product_id AND event_id IS NULL;
  v_batch_items:=v_batch_items||jsonb_build_array(jsonb_build_object(
   'product_id',v_order_item.product_id,'quantity',v_qty,'expected',coalesce(v_current,0)));
  v_total:=v_total+v_qty;
 END LOOP;

 -- A mesma transação valida o saldo esperado, gera lote e audita a entrada.
 v_batch:=public.stock_operation_batch('entrada',v_batch_items,NULL,
  left('Recebimento PC-'||v_order.number::text||
   CASE WHEN v_note IS NOT NULL THEN ' · '||v_note ELSE '' END,400),p_request_id);
 INSERT INTO public.purchase_receipts
  (purchase_order_id,operation_batch_id,request_id,request_digest,note,created_by)
 VALUES(p_order,(v_batch->>'batch_id')::uuid,p_request_id,v_digest,v_note,auth.uid())
 RETURNING id INTO v_received;

 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_item_id:=(v_line->>'item_id')::uuid;
  v_qty:=(v_line->>'quantity')::integer;
  UPDATE public.purchase_order_items
   SET received_quantity=received_quantity+v_qty
   WHERE id=v_item_id AND purchase_order_id=p_order;
  INSERT INTO public.purchase_receipt_items(receipt_id,purchase_order_item_id,quantity)
   VALUES(v_received,v_item_id,v_qty);
 END LOOP;

 v_status:=CASE WHEN EXISTS(
  SELECT 1 FROM public.purchase_order_items
  WHERE purchase_order_id=p_order AND received_quantity<quantity
 ) THEN 'recebido_parcial' ELSE 'finalizado' END;
 UPDATE public.purchase_orders
 SET status=v_status,updated_at=now(),
  finished_at=CASE WHEN v_status='finalizado' THEN now() ELSE finished_at END
 WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_RECEIPT_CONFIRMED',auth.uid(),
  jsonb_build_object('receipt_id',v_received,'operation_batch_id',v_batch->>'batch_id',
   'quantity',v_total,'status',v_status));
 RETURN jsonb_build_object('receipt_id',v_received,'replayed',false,
  'batch_id',v_batch->>'batch_id','quantity',v_total,'status',v_status);
END;$fn$;
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid,jsonb,uuid,text) TO authenticated;

COMMIT;
