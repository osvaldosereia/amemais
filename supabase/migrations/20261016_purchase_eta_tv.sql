-- Compras CDSB: prazo informado pelo comprador, revisável após contato com fornecedor.
-- A compra não movimenta estoque físico. Somente status 'enviado' constitui "encomendado".
ALTER TABLE public.purchase_orders
 ADD COLUMN IF NOT EXISTS estimated_days integer,
 ADD COLUMN IF NOT EXISTS expected_arrival_date date,
 ADD COLUMN IF NOT EXISTS eta_updated_at timestamptz;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_estimated_days_range;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_estimated_days_range
 CHECK (estimated_days IS NULL OR estimated_days BETWEEN 1 AND 365);
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_estimate_pair;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_estimate_pair
 CHECK ((estimated_days IS NULL)=(expected_arrival_date IS NULL));

CREATE OR REPLACE FUNCTION public.save_purchase_order_with_eta(
 p_supplier uuid,p_items jsonb,p_note text,p_estimated_days integer)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_order uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão de compras'; END IF;
 IF p_estimated_days IS NULL OR p_estimated_days NOT BETWEEN 1 AND 365 THEN
  RAISE EXCEPTION 'Informe de 1 a 365 dias corridos de previsão';END IF;
 -- Reutiliza todas as validações do fluxo antigo, na MESMA transação.
 v_order:=public.save_purchase_order(p_supplier,p_items,p_note);
 UPDATE public.purchase_orders
  SET estimated_days=p_estimated_days,
      expected_arrival_date=((now() AT TIME ZONE 'America/Cuiaba')::date+p_estimated_days),
      eta_updated_at=now()
 WHERE id=v_order;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',v_order::text,'PURCHASE_ETA_DEFINED',auth.uid(),
 jsonb_build_object('estimated_days',p_estimated_days,'date',
 ((now() AT TIME ZONE 'America/Cuiaba')::date+p_estimated_days)));
 RETURN v_order;
END
$fn$;
REVOKE ALL ON FUNCTION public.save_purchase_order_with_eta(uuid,jsonb,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_order_with_eta(uuid,jsonb,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_purchase_order_eta(
 p_id uuid,p_days integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_old public.purchase_orders%rowtype;
DECLARE v_due date;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('purchases.manage') THEN
  RAISE EXCEPTION 'Sem permissão de compras'; END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 365 THEN
  RAISE EXCEPTION 'Prazo inválido: informe 1 a 365 dias corridos'; END IF;
 SELECT * INTO v_old FROM public.purchase_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não localizada'; END IF;
 IF v_old.status NOT IN ('rascunho','enviado') THEN
  RAISE EXCEPTION 'Só é possível alterar a previsão de compras abertas'; END IF;
 v_due:=(now() AT TIME ZONE 'America/Cuiaba')::date+p_days;
 UPDATE public.purchase_orders SET estimated_days=p_days,
   expected_arrival_date=v_due,eta_updated_at=now(),updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('purchase_orders',p_id::text,'PURCHASE_ETA_UPDATED',auth.uid(),
 jsonb_build_object('previous_days',v_old.estimated_days,'previous_date',
 v_old.expected_arrival_date,'new_days',p_days,'new_date',v_due));
END
$fn$;
REVOKE ALL ON FUNCTION public.update_purchase_order_eta(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_purchase_order_eta(uuid,integer) TO authenticated;

-- TV exclusiva de administradores/gerentes: somente resumo de compras recentes,
-- sem dados financeiros e sem permitir escrita, com busca limitada.
CREATE OR REPLACE FUNCTION public.tv_recent_purchase_orders()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM public.staff_profiles sp WHERE sp.id=auth.uid()
   AND sp.active IS TRUE AND sp.archived_at IS NULL AND sp.role IN ('admin','gerente')
 ) THEN COALESCE((
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM (
   SELECT po.id,po.number,po.status,po.created_at,po.expected_arrival_date,
     s.name supplier,
     (SELECT COALESCE(sum(i.quantity),0)::integer FROM public.purchase_order_items i
      WHERE i.purchase_order_id=po.id) units,
     (SELECT count(*)::integer FROM public.purchase_order_items i
      WHERE i.purchase_order_id=po.id) skus
   FROM public.purchase_orders po JOIN public.suppliers s ON s.id=po.supplier_id
   ORDER BY po.created_at DESC LIMIT 8
  ) t
 ),'[]'::jsonb) ELSE NULL END;
$fn$;
REVOKE ALL ON FUNCTION public.tv_recent_purchase_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_recent_purchase_orders() TO authenticated;
