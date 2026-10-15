-- Autonomia total, mas auditável: arquivamento operacional mesmo com histórico e pedidos.
INSERT INTO public.permission_definitions(permission,module,label,sort_order)
VALUES ('system.force_delete','Administração','Autonomia total para exclusões avançadas',999)
ON CONFLICT(permission) DO NOTHING;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS force_archived_at timestamptz;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS force_archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS force_archived_at timestamptz;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS force_archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_force_archived ON public.products(force_archived_at) WHERE force_archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_force_archived ON public.stores(force_archived_at) WHERE force_archived_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.force_archive_temporary_store(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_event public.events%rowtype;
 v_balance record;
 v_total integer := 0;
 v_cancelled integer := 0;
BEGIN
 IF NOT (app_private.role_in('admin','gerente') AND app_private.has_permission('system.force_delete'))
 THEN RAISE EXCEPTION 'Autonomia de exclusão necessária'; END IF;

 SELECT * INTO v_event FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loja temporária não encontrada'; END IF;
 IF v_event.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Esta loja temporária já foi excluída';
 END IF;

 -- Primeiro cancelar os lotes abertos; reservas não podem reaparecer como disponíveis.
 PERFORM 1 FROM public.event_pick_batches WHERE event_id=p_event_id FOR UPDATE;
 SELECT count(*) INTO v_cancelled FROM public.event_pick_batches
 WHERE event_id=p_event_id AND status IN
  ('pendente_estoque','aguardando','em_separacao','separado');
 UPDATE public.stock_reservations SET status='liberada',ended_by=auth.uid(),ended_at=now()
 WHERE status='ativa' AND event_batch_id IN
   (SELECT id FROM public.event_pick_batches WHERE event_id=p_event_id
      AND status IN ('pendente_estoque','aguardando','em_separacao','separado'));
 UPDATE public.event_pick_batches SET status='cancelado',updated_at=now()
 WHERE event_id=p_event_id AND status IN
  ('pendente_estoque','aguardando','em_separacao','separado');

 IF EXISTS (
   SELECT 1 FROM public.stock_reservations r
   JOIN public.event_pick_batches b ON b.id=r.event_batch_id
   WHERE b.event_id=p_event_id AND r.status='ativa'
 ) THEN RAISE EXCEPTION 'Ainda há reservas ativas vinculadas à loja'; END IF;

 -- Inventários inacabados deixam de poder modificar um local excluído.
 UPDATE public.inventory_sessions SET status='cancelada',reviewed_by=auth.uid(),
   reviewed_at=now(),note='Cancelado por exclusão da loja temporária'
 WHERE location_type='temporaria' AND location_id=p_event_id
   AND status IN ('aberta','revisao');

 -- Retorna somente o estoque físico remanescente (nunca vendas/perdas já baixadas).
 FOR v_balance IN
   SELECT product_id,quantity FROM public.stock_balances
   WHERE event_id=p_event_id AND quantity>0 ORDER BY product_id FOR UPDATE
 LOOP
   INSERT INTO public.stock_balances(product_id,event_id,quantity)
   VALUES(v_balance.product_id,NULL,0) ON CONFLICT DO NOTHING;

   UPDATE public.stock_balances SET quantity=quantity+v_balance.quantity,
     updated_at=now()
   WHERE product_id=v_balance.product_id AND event_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Saldo central indisponível'; END IF;

   UPDATE public.stock_balances SET quantity=quantity-v_balance.quantity,
     updated_at=now()
   WHERE product_id=v_balance.product_id AND event_id=p_event_id;

   INSERT INTO public.stock_movements
    (product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   VALUES(v_balance.product_id,p_event_id,'devolucao',v_balance.quantity,
     v_balance.quantity,-v_balance.quantity,auth.uid(),
     'Retorno automático por exclusão de loja temporária');
   v_total:=v_total+v_balance.quantity;
 END LOOP;

 PERFORM pg_catalog.set_config('app_private.event_deletion_authorized',p_event_id::text,true);
 UPDATE public.events SET status='encerrado',closed_at=coalesce(closed_at,now()),
   closed_by=coalesce(closed_by,auth.uid()),deleted_at=now(),deleted_by=auth.uid()
 WHERE id=p_event_id;

 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('events',p_event_id::text,'TEMPORARY_STORE_DELETED',auth.uid(),
    jsonb_build_object('returned_units',v_total,'cancelled_batches',v_cancelled,
      'previous_status',v_event.status,'archived',true));
 RETURN v_total;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.force_archive_preview(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_name text;v_primary boolean;v_balance bigint:=0;v_requests integer:=0;v_history integer:=0;
BEGIN
 IF NOT app_private.role_in('admin','gerente') OR NOT app_private.has_permission('system.force_delete')
 THEN RAISE EXCEPTION 'Sem autonomia para exclusão avançada'; END IF;
 CASE p_kind
 WHEN 'product' THEN
  SELECT name INTO v_name FROM public.products WHERE id=p_id AND force_archived_at IS NULL;
  SELECT coalesce(sum(quantity),0) INTO v_balance FROM public.stock_balances WHERE product_id=p_id;
  SELECT count(*) INTO v_requests FROM public.stock_reservations WHERE product_id=p_id AND status='ativa';
  SELECT count(*) INTO v_history FROM public.stock_movements WHERE product_id=p_id;
 WHEN 'store' THEN
  SELECT name,is_primary INTO v_name,v_primary FROM public.stores WHERE id=p_id AND force_archived_at IS NULL;
  IF v_primary THEN RAISE EXCEPTION 'O CDSB não pode ser excluído'; END IF;
  SELECT count(*) INTO v_requests FROM public.store_orders
   WHERE (from_store_id=p_id OR to_store_id=p_id) AND status IN ('solicitado','pendente_estoque','aprovado','separado');
  SELECT count(*) INTO v_history FROM public.store_orders WHERE from_store_id=p_id OR to_store_id=p_id;
  SELECT coalesce(sum(quantity),0) INTO v_balance FROM public.store_stock WHERE store_id=p_id;
 WHEN 'event' THEN
  SELECT name INTO v_name FROM public.events WHERE id=p_id AND deleted_at IS NULL;
  SELECT coalesce(sum(quantity),0) INTO v_balance FROM public.stock_balances WHERE event_id=p_id;
  SELECT count(*) INTO v_requests FROM public.event_pick_batches WHERE event_id=p_id
    AND status IN ('pendente_estoque','aguardando','em_separacao','separado');
  SELECT count(*) INTO v_history FROM public.stock_movements WHERE event_id=p_id;
 ELSE RAISE EXCEPTION 'Tipo inválido';
 END CASE;
 IF v_name IS NULL THEN RAISE EXCEPTION 'Cadastro não encontrado ou já excluído'; END IF;
 RETURN jsonb_build_object('name',v_name,'kind',p_kind,'stock_units',v_balance,
   'pending_records',v_requests,'history_records',v_history,'preserves_history',true);
END;$function$;
REVOKE ALL ON FUNCTION public.force_archive_preview(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.force_archive_preview(text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.force_archive_entity(p_kind text,p_id uuid,p_confirm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_name text;v_primary boolean;v_bal record;v_qty bigint:=0;v_cancelled integer:=0;v_returned integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin','gerente') OR
   NOT app_private.has_permission('system.force_delete')
 THEN RAISE EXCEPTION 'Sem autonomia para exclusão avançada'; END IF;
 CASE p_kind
 WHEN 'product' THEN
  SELECT name INTO v_name FROM public.products WHERE id=p_id AND force_archived_at IS NULL FOR UPDATE;
 WHEN 'store' THEN
  SELECT name,is_primary INTO v_name,v_primary FROM public.stores WHERE id=p_id AND force_archived_at IS NULL FOR UPDATE;
  IF v_primary THEN RAISE EXCEPTION 'O CDSB nunca pode ser excluído'; END IF;
 WHEN 'event' THEN
  SELECT name INTO v_name FROM public.events WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 ELSE RAISE EXCEPTION 'Tipo de cadastro inválido';
 END CASE;
 IF v_name IS NULL THEN RAISE EXCEPTION 'Cadastro não encontrado ou já excluído';END IF;
 IF trim(coalesce(p_confirm,'')) IS DISTINCT FROM v_name THEN
  RAISE EXCEPTION 'Digite exatamente o nome do cadastro para confirmar'; END IF;
 IF p_kind='event' THEN
   v_returned:=public.force_archive_temporary_store(p_id);
   RETURN jsonb_build_object('archived',true,'returned_units',v_returned,'history_preserved',true);
 END IF;
 IF p_kind='store' THEN
  IF EXISTS(SELECT 1 FROM public.store_stock WHERE store_id=p_id AND quantity>0)
  THEN RAISE EXCEPTION 'Esta filial ainda possui mercadoria controlada. Faça a devolução antes de excluir';END IF;
  UPDATE public.stock_reservations SET status='liberada',ended_at=now(),ended_by=auth.uid()
   WHERE status='ativa' AND order_id IN (
    SELECT id FROM public.store_orders WHERE (from_store_id=p_id OR to_store_id=p_id)
      AND status IN ('solicitado','pendente_estoque','aprovado','separado'));
  UPDATE public.store_orders SET status='cancelado',canceled_by=auth.uid(),canceled_at=now()
   WHERE (from_store_id=p_id OR to_store_id=p_id)
     AND status IN ('solicitado','pendente_estoque','aprovado','separado');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  UPDATE public.stores SET active=false,force_archived_at=now(),force_archived_by=auth.uid() WHERE id=p_id;
  INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
  VALUES('stores',p_id::text,'FORCE_STORE_ARCHIVED',auth.uid(),
    jsonb_build_object('name',v_name,'cancelled_orders',v_cancelled,'history_preserved',true));
  RETURN jsonb_build_object('archived',true,'cancelled_orders',v_cancelled,'history_preserved',true);
 END IF;
 -- Produto: cancelar pedidos e lotes ainda pendentes que seriam impossíveis de atender.
 UPDATE public.stock_reservations SET status='liberada',ended_at=now(),ended_by=auth.uid()
 WHERE status='ativa' AND (
   product_id=p_id OR order_id IN (
     SELECT DISTINCT oi.order_id FROM public.store_order_items oi
     JOIN public.store_orders o ON o.id=oi.order_id
     WHERE oi.product_id=p_id AND o.status IN ('solicitado','pendente_estoque','aprovado','separado'))
   OR avulso_order_id IN (
     SELECT DISTINCT oi.order_id FROM public.avulso_order_items oi
     JOIN public.avulso_orders o ON o.id=oi.order_id
     WHERE oi.product_id=p_id AND o.fulfillment_status IN ('legado','pendente_estoque','reservado','separado'))
   OR event_batch_id IN (
     SELECT DISTINCT bi.batch_id FROM public.event_pick_batch_items bi
     JOIN public.event_pick_batches b ON b.id=bi.batch_id
     WHERE bi.product_id=p_id AND b.status IN ('pendente_estoque','aguardando','em_separacao','separado'))
 );
 UPDATE public.store_orders SET status='cancelado',canceled_by=auth.uid(),canceled_at=now()
 WHERE status IN ('solicitado','pendente_estoque','aprovado','separado')
 AND id IN (SELECT order_id FROM public.store_order_items WHERE product_id=p_id);
 GET DIAGNOSTICS v_cancelled = ROW_COUNT;
 UPDATE public.avulso_orders SET fulfillment_status='cancelado',canceled_by=auth.uid(),canceled_at=now()
 WHERE fulfillment_status IN ('legado','pendente_estoque','reservado','separado')
 AND id IN (SELECT order_id FROM public.avulso_order_items WHERE product_id=p_id);
 UPDATE public.event_pick_batches SET status='cancelado',updated_at=now()
 WHERE status IN ('pendente_estoque','aguardando','em_separacao','separado')
 AND id IN (SELECT batch_id FROM public.event_pick_batch_items WHERE product_id=p_id);
 -- Auditoria contábil: retirar quantidades somente após o cancelamento transacional.
 FOR v_bal IN SELECT event_id,quantity FROM public.stock_balances
  WHERE product_id=p_id AND quantity>0 ORDER BY event_id NULLS FIRST FOR UPDATE LOOP
  IF v_bal.event_id IS NULL THEN
   INSERT INTO public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   VALUES(p_id,NULL,'ajuste_loja',-v_bal.quantity,-v_bal.quantity,0,auth.uid(),
   'EXCLUSÃO ADMINISTRATIVA AVANÇADA: baixa de saldo de cadastro de teste');
  ELSE
   INSERT INTO public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   VALUES(p_id,v_bal.event_id,'baixa_evento',v_bal.quantity,0,-v_bal.quantity,auth.uid(),
   'EXCLUSÃO ADMINISTRATIVA AVANÇADA: baixa de saldo vinculado a evento; não é venda');
  END IF;
  v_qty:=v_qty+v_bal.quantity;
 END LOOP;
 UPDATE public.stock_balances SET quantity=0,updated_at=now() WHERE product_id=p_id AND quantity<>0;
 UPDATE public.products SET active=false,force_archived_at=now(),force_archived_by=auth.uid() WHERE id=p_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('products',p_id::text,'FORCE_PRODUCT_ARCHIVED',auth.uid(),
  jsonb_build_object('name',v_name,'units_removed',v_qty,'cancelled_store_orders',v_cancelled,
    'history_preserved',true,'test_cleanup',true));
 RETURN jsonb_build_object('archived',true,'units_removed',v_qty,'cancelled_orders',v_cancelled,'history_preserved',true);
END;$function$;
REVOKE ALL ON FUNCTION public.force_archive_entity(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.force_archive_entity(text,uuid,text) TO authenticated;
