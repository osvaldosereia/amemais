-- Exclusão administrativa de pedidos somente da operação visual, com auditoria e sem apagar lançamentos físicos.
CREATE TABLE IF NOT EXISTS public.admin_removed_orders (
  kind text NOT NULL CHECK (kind IN ('avulso','loja','evento')),
  order_id uuid NOT NULL,
  deleted_by uuid NOT NULL REFERENCES auth.users(id),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  original_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (kind,order_id)
);
CREATE INDEX IF NOT EXISTS admin_removed_orders_date_idx ON public.admin_removed_orders(deleted_at DESC);
ALTER TABLE public.admin_removed_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_removed_orders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_removed_orders TO authenticated;
DROP POLICY IF EXISTS admin_removed_orders_read ON public.admin_removed_orders;
CREATE POLICY admin_removed_orders_read ON public.admin_removed_orders FOR SELECT
  TO authenticated USING (app_private.is_active());

CREATE OR REPLACE FUNCTION public.admin_remove_order(p_kind text, p_order_id uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_status text;
 v_event uuid;
 v_released integer := 0;
 v_affected integer := 0;
 v_target text := '';
BEGIN
 IF v_actor IS NULL OR NOT app_private.is_active() OR NOT app_private.role_in('admin') THEN
  RAISE EXCEPTION 'Somente o administrador pode excluir pedidos';
 END IF;
 IF p_kind NOT IN ('avulso','loja','evento') OR p_kind IS NULL OR p_order_id IS NULL THEN
  RAISE EXCEPTION 'Tipo de pedido inválido';
 END IF;
 IF upper(btrim(coalesce(p_confirmation,''))) IS DISTINCT FROM upper(left(p_order_id::text,8)) THEN
  RAISE EXCEPTION 'Código de confirmação incorreto';
 END IF;
 IF EXISTS (SELECT 1 FROM public.admin_removed_orders
             WHERE kind=p_kind AND order_id=p_order_id) THEN
  RAISE EXCEPTION 'O pedido já foi excluído';
 END IF;

 IF p_kind='avulso' THEN
  SELECT o.fulfillment_status, o.customer_name INTO v_status,v_target
    FROM public.avulso_orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_status NOT IN ('legado','solicitado','pendente_estoque','reservado',
    'separado','cancelado','expirado','despachado','concluido','recebido') THEN
   RAISE EXCEPTION 'Estado do pedido não permite exclusão segura: %',v_status;
  END IF;
  UPDATE public.stock_reservations
   SET status='liberada',ended_at=now(),ended_by=v_actor
   WHERE avulso_order_id=p_order_id AND status='ativa';
  GET DIAGNOSTICS v_released=ROW_COUNT;
  IF v_status IN ('legado','solicitado','pendente_estoque','reservado','separado') THEN
   UPDATE public.avulso_orders SET fulfillment_status='cancelado',
    canceled_by=v_actor,canceled_at=now() WHERE id=p_order_id;
  END IF;
 ELSIF p_kind='loja' THEN
  SELECT o.status,coalesce(t.name,'Loja') INTO v_status,v_target
   FROM public.store_orders o LEFT JOIN public.stores t ON t.id=o.to_store_id
   WHERE o.id=p_order_id FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de loja não encontrado'; END IF;
  IF v_status NOT IN ('solicitado','pendente_estoque','aprovado','separado','cancelado',
   'despachado','recebido','recebido_divergente','concluido') THEN
   RAISE EXCEPTION 'Estado do pedido não permite exclusão segura: %',v_status;
  END IF;
  UPDATE public.stock_reservations
   SET status='liberada',ended_at=now(),ended_by=v_actor
   WHERE order_id=p_order_id AND status='ativa';
  GET DIAGNOSTICS v_released=ROW_COUNT;
  IF v_status IN ('solicitado','pendente_estoque','aprovado','separado') THEN
   UPDATE public.store_orders SET status='cancelado',canceled_by=v_actor,canceled_at=now()
   WHERE id=p_order_id;
  END IF;
 ELSIF p_kind='evento' THEN
  SELECT b.status,b.event_id,e.name INTO v_status,v_event,v_target
   FROM public.event_pick_batches b
   JOIN public.events e ON e.id=b.event_id
   WHERE b.id=p_order_id FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF v_status NOT IN ('pendente_estoque','aguardando','em_separacao','separado',
    'cancelado','despachado','enviado','concluido') THEN
   RAISE EXCEPTION 'Estado do lote não permite exclusão segura: %',v_status;
  END IF;
  UPDATE public.stock_reservations
   SET status='liberada',ended_at=now(),ended_by=v_actor
   WHERE event_batch_id=p_order_id AND status='ativa';
  GET DIAGNOSTICS v_released=ROW_COUNT;
  IF v_status IN ('pendente_estoque','aguardando','em_separacao','separado') THEN
   UPDATE public.event_pick_batches SET status='cancelado',updated_at=now()
   WHERE id=p_order_id;
  END IF;
 END IF;

 INSERT INTO public.admin_removed_orders(kind,order_id,deleted_by,original_status,details)
 VALUES(p_kind,p_order_id,v_actor,v_status,
   jsonb_build_object('target',v_target,'event_id',v_event,'reservations_released',v_released));
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES ('admin_removed_orders',p_order_id::text,'ADMIN_ORDER_REMOVED',v_actor,
   jsonb_build_object('kind',p_kind,'status_before',v_status,'reservations_released',v_released,
     'stock_movements_preserved',true));
 RETURN jsonb_build_object('removed',true,'kind',p_kind,'order_id',p_order_id,
   'previous_status',v_status,'reservations_released',v_released,
   'movements_preserved',true);
END;
$function$


REVOKE ALL ON FUNCTION public.admin_remove_order(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_order(text,uuid,text) TO authenticated;
