-- Compras: um pedido em rascunho por fornecedor; quantidade mínima comercial por SKU.
-- Não altera pedidos das lojas, franquias ou eventos, nem movimenta estoque físico.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS minimum_order_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_minimum_order_quantity_range;
ALTER TABLE public.products ADD CONSTRAINT products_minimum_order_quantity_range
 CHECK (minimum_order_quantity BETWEEN 1 AND 1000000);

-- Cria pedido vazio, para receber produtos selecionados em vários momentos.
CREATE OR REPLACE FUNCTION public.create_supplier_purchase_draft(p_supplier uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão para gerenciar compras'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier AND active) THEN
  RAISE EXCEPTION 'Fornecedor inválido ou inativo'; END IF;
 INSERT INTO public.purchase_orders(supplier_id,status,created_by)
 VALUES(p_supplier,'rascunho',auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',v_id::text,'PURCHASE_DRAFT_CREATED',auth.uid(),
 jsonb_build_object('supplier_id',p_supplier,'has_items',false));
 RETURN v_id;
END;$fn$;

-- Adiciona produtos a um pedido existente sem substituir produtos adicionados anteriormente.
-- O mesmo SKU pode ser adicionado novamente: a quantidade é acumulada.
CREATE OR REPLACE FUNCTION public.add_purchase_draft_items(p_order uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.purchase_orders%rowtype; v_product public.products%rowtype;
 v_line jsonb; v_product_id uuid; v_quantity integer; v_count integer:=0; v_total integer:=0;
 v_seen uuid[]:='{}'::uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão para gerenciar compras'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
  OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 300 THEN
  RAISE EXCEPTION 'Selecione de 1 a 300 variações'; END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR v_order.status<>'rascunho' THEN
  RAISE EXCEPTION 'Somente pedidos em rascunho podem receber produtos'; END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(v_line)<>'object' OR
   coalesce(v_line->>'product_id','') !~* '^[0-9a-f-]{36}$' OR
   coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]{0,6}$' THEN
   RAISE EXCEPTION 'SKU ou quantidade de compra inválidos'; END IF;
  v_product_id:=(v_line->>'product_id')::uuid;v_quantity:=(v_line->>'quantity')::integer;
  IF v_product_id=ANY(v_seen) OR v_quantity>1000000 THEN
    RAISE EXCEPTION 'SKU repetido ou quantidade fora do limite'; END IF;
  v_seen:=array_append(v_seen,v_product_id);
  SELECT * INTO v_product FROM public.products WHERE id=v_product_id FOR SHARE;
  IF NOT FOUND OR NOT v_product.active OR v_product.force_archived_at IS NOT NULL
   OR v_product.supplier_id IS DISTINCT FROM v_order.supplier_id THEN
   RAISE EXCEPTION 'Produto indisponível ou de fornecedor diferente'; END IF;
  IF v_quantity<v_product.minimum_order_quantity THEN
   RAISE EXCEPTION 'Quantidade inferior ao pedido mínimo da variação % (mínimo %)',
    v_product.name,v_product.minimum_order_quantity; END IF;
  INSERT INTO public.purchase_order_items
   (purchase_order_id,product_id,product_name,sku,ean,quantity)
  VALUES(p_order,v_product_id,v_product.name,v_product.sku,v_product.ean,v_quantity)
  ON CONFLICT (purchase_order_id,product_id) DO UPDATE
   SET quantity=public.purchase_order_items.quantity+EXCLUDED.quantity;
  -- quantidade total resultante também deve respeitar limite
  IF (SELECT quantity FROM public.purchase_order_items
       WHERE purchase_order_id=p_order AND product_id=v_product_id)>1000000 THEN
   RAISE EXCEPTION 'Quantidade final acima do limite por variação';END IF;
  v_count:=v_count+1;v_total:=v_total+v_quantity;
 END LOOP;
 UPDATE public.purchase_orders SET updated_at=now() WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_DRAFT_ITEMS_ADDED',auth.uid(),
 jsonb_build_object('skus',v_count,'units',v_total));
 RETURN jsonb_build_object('order_id',p_order,'skus',v_count,'units',v_total);
END;$fn$;

-- Edita/remove dentro da própria visualização do pedido, antes de confirmar.
CREATE OR REPLACE FUNCTION public.set_purchase_draft_quantity(
 p_order uuid,p_product uuid,p_quantity integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.purchase_orders%rowtype; v_min integer;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão para gerenciar compras'; END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR v_order.status<>'rascunho' THEN
  RAISE EXCEPTION 'Somente pedidos em rascunho podem ser editados';END IF;
 IF p_quantity IS NULL OR p_quantity<0 OR p_quantity>1000000 THEN
  RAISE EXCEPTION 'Quantidade inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.purchase_order_items
  WHERE purchase_order_id=p_order AND product_id=p_product) THEN
  RAISE EXCEPTION 'Variação não pertence ao pedido';END IF;
 SELECT minimum_order_quantity INTO v_min FROM public.products WHERE id=p_product;
 IF p_quantity>0 AND p_quantity<v_min THEN
  RAISE EXCEPTION 'Pedido mínimo desta variação: % unidades',v_min; END IF;
 IF p_quantity=0 THEN
  DELETE FROM public.purchase_order_items
   WHERE purchase_order_id=p_order AND product_id=p_product;
 ELSE
  UPDATE public.purchase_order_items SET quantity=p_quantity
   WHERE purchase_order_id=p_order AND product_id=p_product;
 END IF;
 UPDATE public.purchase_orders SET updated_at=now() WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_DRAFT_QUANTITY_CHANGED',auth.uid(),
 jsonb_build_object('product_id',p_product,'quantity',p_quantity));
END;$fn$;

-- Finalização do rascunho; envio externo do PDF ao fornecedor é etapa humana.
-- A função não declara que uma mensagem foi entregue automaticamente.
CREATE OR REPLACE FUNCTION public.confirm_supplier_purchase_draft(
 p_order uuid,p_estimated_days integer,p_note text DEFAULT NULL,p_items jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.purchase_orders%rowtype; v_bad text;
 v_line jsonb; v_pid uuid; v_qty integer; v_existing integer;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão para gerenciar compras';END IF;
 IF p_estimated_days IS NULL OR p_estimated_days NOT BETWEEN 1 AND 365 THEN
  RAISE EXCEPTION 'Informe prazo de chegada de 1 a 365 dias'; END IF;
 IF length(coalesce(p_note,''))>1500 THEN
  RAISE EXCEPTION 'Observação muito longa'; END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR v_order.status<>'rascunho' THEN
  RAISE EXCEPTION 'Somente pedidos em rascunho podem ser confirmados'; END IF;
 IF p_items IS NOT NULL THEN
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 300 THEN
   RAISE EXCEPTION 'Informe todos os SKUs do pedido';END IF;
  SELECT count(*) INTO v_existing FROM public.purchase_order_items WHERE purchase_order_id=p_order;
  IF v_existing<>jsonb_array_length(p_items) THEN
   RAISE EXCEPTION 'A lista de produtos mudou. Reabra o pedido antes de confirmar';END IF;
  IF (SELECT count(DISTINCT value->>'product_id') FROM jsonb_array_elements(p_items))<>v_existing THEN
   RAISE EXCEPTION 'SKU repetido na conferência';END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   IF jsonb_typeof(v_line)<>'object' OR coalesce(v_line->>'product_id','') !~* '^[0-9a-f-]{36}
 SELECT p.name INTO v_bad FROM public.purchase_order_items i
 JOIN public.products p ON p.id=i.product_id
 WHERE i.purchase_order_id=p_order AND
  (i.quantity<p.minimum_order_quantity OR i.quantity>1000000 OR
   p.supplier_id IS DISTINCT FROM v_order.supplier_id)
 LIMIT 1;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Revise o pedido mínimo ou fornecedor de %',v_bad; END IF;
 UPDATE public.purchase_orders SET estimated_days=p_estimated_days,
  expected_arrival_date=(now() AT TIME ZONE 'America/Cuiaba')::date+p_estimated_days,
  note=nullif(btrim(coalesce(p_note,'')),''),
  updated_at=now()
 WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_DRAFT_READY_TO_SEND',auth.uid(),
  jsonb_build_object('days',p_estimated_days,'stock_updated',false));
END;$fn$;

-- Proteção adicional: somente enviar rascunho previamente conferido, com prazo e SKU válidos.
CREATE OR REPLACE FUNCTION public.set_purchase_order_status(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_order public.purchase_orders%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão para gerenciar compras';END IF;
 SELECT * INTO v_order FROM public.purchase_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada';END IF;
 IF NOT (
   (v_order.status='rascunho' AND p_status IN ('enviado','cancelado')) OR
   (v_order.status='enviado' AND p_status='cancelado')
 ) THEN RAISE EXCEPTION 'Transição de compra inválida';END IF;
 IF p_status='enviado' THEN
  IF v_order.estimated_days IS NULL OR v_order.expected_arrival_date IS NULL THEN
   RAISE EXCEPTION 'Confira o pedido e informe a previsão antes de enviar';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id=p_id) THEN
   RAISE EXCEPTION 'Não é possível enviar pedido sem produtos';END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_order_items i JOIN public.products p ON p.id=i.product_id
     WHERE i.purchase_order_id=p_id AND
      (i.quantity<p.minimum_order_quantity OR i.quantity>1000000 OR
       p.supplier_id IS DISTINCT FROM v_order.supplier_id)) THEN
   RAISE EXCEPTION 'Quantidade abaixo do mínimo ou item de outro fornecedor';END IF;
 END IF;
 UPDATE public.purchase_orders SET status=p_status,updated_at=now(),
  sent_at=CASE WHEN p_status='enviado' THEN now() ELSE sent_at END WHERE id=p_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_id::text,'PURCHASE_STATUS_CHANGED',auth.uid(),
  jsonb_build_object('before',v_order.status,'after',p_status,'stock_updated',false));
END;$fn$;

REVOKE ALL ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text,jsonb) TO authenticated;
COMMIT;
    OR coalesce(v_line->>'quantity','') !~ '^(0|[1-9][0-9]{0,6})
 SELECT p.name INTO v_bad FROM public.purchase_order_items i
 JOIN public.products p ON p.id=i.product_id
 WHERE i.purchase_order_id=p_order AND
  (i.quantity<p.minimum_order_quantity OR i.quantity>1000000 OR
   p.supplier_id IS DISTINCT FROM v_order.supplier_id)
 LIMIT 1;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Revise o pedido mínimo ou fornecedor de %',v_bad; END IF;
 UPDATE public.purchase_orders SET estimated_days=p_estimated_days,
  expected_arrival_date=(now() AT TIME ZONE 'America/Cuiaba')::date+p_estimated_days,
  note=nullif(btrim(coalesce(p_note,'')),''),
  updated_at=now()
 WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_DRAFT_READY_TO_SEND',auth.uid(),
  jsonb_build_object('days',p_estimated_days,'stock_updated',false));
END;$fn$;

REVOKE ALL ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text) TO authenticated;
COMMIT; THEN
    RAISE EXCEPTION 'Quantidade ou SKU inválido'; END IF;
   v_pid:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::integer;
   IF v_qty>1000000 OR NOT EXISTS (SELECT 1 FROM public.purchase_order_items
    WHERE purchase_order_id=p_order AND product_id=v_pid) THEN
    RAISE EXCEPTION 'Item não pertence ao pedido ou quantidade muito grande'; END IF;
   IF v_qty>0 AND v_qty<(SELECT minimum_order_quantity FROM public.products WHERE id=v_pid) THEN
    RAISE EXCEPTION 'Quantidade inferior ao pedido mínimo do fornecedor';END IF;
   IF v_qty=0 THEN
    DELETE FROM public.purchase_order_items WHERE purchase_order_id=p_order AND product_id=v_pid;
   ELSE
    UPDATE public.purchase_order_items SET quantity=v_qty
     WHERE purchase_order_id=p_order AND product_id=v_pid;
   END IF;
  END LOOP;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id=p_order)
 THEN RAISE EXCEPTION 'Adicione produtos antes de confirmar'; END IF;
 SELECT p.name INTO v_bad FROM public.purchase_order_items i
 JOIN public.products p ON p.id=i.product_id
 WHERE i.purchase_order_id=p_order AND
  (i.quantity<p.minimum_order_quantity OR i.quantity>1000000 OR
   p.supplier_id IS DISTINCT FROM v_order.supplier_id)
 LIMIT 1;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Revise o pedido mínimo ou fornecedor de %',v_bad; END IF;
 UPDATE public.purchase_orders SET estimated_days=p_estimated_days,
  expected_arrival_date=(now() AT TIME ZONE 'America/Cuiaba')::date+p_estimated_days,
  note=nullif(btrim(coalesce(p_note,'')),''),
  updated_at=now()
 WHERE id=p_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_order::text,'PURCHASE_DRAFT_READY_TO_SEND',auth.uid(),
  jsonb_build_object('days',p_estimated_days,'stock_updated',false));
END;$fn$;

REVOKE ALL ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_supplier_purchase_draft(uuid),
 public.add_purchase_draft_items(uuid,jsonb),
 public.set_purchase_draft_quantity(uuid,uuid,integer),
 public.confirm_supplier_purchase_draft(uuid,integer,text) TO authenticated;
COMMIT;