-- Exclusão administrativa de produto inteiro (modelo + TODAS as variações).
-- Exclusão lógica preserva históricos, pedidos antigos e integridade das chaves estrangeiras.
-- Nenhum produto é afetado ao executar esta migração.

ALTER TABLE public.apparel_models
 ADD COLUMN IF NOT EXISTS force_archived_at timestamptz,
 ADD COLUMN IF NOT EXISTS force_archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.force_archive_model_preview(p_model uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_name text;v_total int;v_active int;v_central bigint;v_events bigint;v_reserved bigint;
        v_reservations int;v_history bigint;v_order_count bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin')
    OR NOT app_private.has_permission('system.force_delete') THEN
   RAISE EXCEPTION 'Somente administrador com autonomia de exclusão pode remover modelos completos';
 END IF;
 SELECT name INTO v_name FROM public.apparel_models
 WHERE id=p_model AND force_archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado ou já excluído';END IF;
 SELECT count(*),count(*) FILTER(WHERE active) INTO v_total,v_active
 FROM public.products WHERE apparel_model_id=p_model AND force_archived_at IS NULL;
 IF v_total=0 THEN RAISE EXCEPTION 'Modelo sem variações disponíveis para excluir';END IF;
 SELECT coalesce(sum(b.quantity) FILTER(WHERE b.event_id IS NULL),0),
        coalesce(sum(b.quantity) FILTER(WHERE b.event_id IS NOT NULL),0)
 INTO v_central,v_events
 FROM public.stock_balances b JOIN public.products p ON p.id=b.product_id
 WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL;
 SELECT coalesce(sum(r.quantity),0),count(*) INTO v_reserved,v_reservations
 FROM public.stock_reservations r JOIN public.products p ON p.id=r.product_id
 WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL AND r.status='ativa';
 SELECT count(*) INTO v_history FROM public.stock_movements m
 JOIN public.products p ON p.id=m.product_id
 WHERE p.apparel_model_id=p_model;
 SELECT count(*) INTO v_order_count FROM (
  SELECT ('loja:'||o.id::text) ref FROM public.store_orders o
   JOIN public.store_order_items it ON it.order_id=o.id
   JOIN public.products p ON p.id=it.product_id
   WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL
   AND o.status IN ('solicitado','pendente_estoque','aprovado','separado')
  UNION
  SELECT ('avulso:'||o.id::text) FROM public.avulso_orders o
   JOIN public.avulso_order_items it ON it.order_id=o.id
   JOIN public.products p ON p.id=it.product_id
   WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL
   AND o.fulfillment_status IN ('legado','pendente_estoque','reservado','separado')
  UNION
  SELECT ('evento:'||b.id::text) FROM public.event_pick_batches b
   JOIN public.event_pick_batch_items it ON it.batch_id=b.id
   JOIN public.products p ON p.id=it.product_id
   WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL
   AND b.status IN ('pendente_estoque','aguardando','em_separacao','separado')
 ) pending;
 RETURN jsonb_build_object('name',v_name,'kind','model','variant_count',v_total,
  'active_variants',v_active,'stock_units',v_central+v_events,
  'cd_units',v_central,'event_units',v_events,'reserved_units',v_reserved,
  'pending_records',v_order_count,'active_reservations',v_reservations,
  'history_records',v_history,'preserves_history',true);
END;$fn$;

CREATE OR REPLACE FUNCTION public.force_archive_model(p_model uuid,p_confirm text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_name text;v_variant record;v_result jsonb;
        v_count integer:=0;v_units bigint:=0;v_cancelled integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin')
    OR NOT app_private.has_permission('system.force_delete') THEN
   RAISE EXCEPTION 'Somente administrador com autonomia de exclusão pode remover modelos completos';
 END IF;
 -- O lock do modelo impede a criação simultânea de outra variação via FK.
 SELECT name INTO v_name FROM public.apparel_models
 WHERE id=p_model AND force_archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado ou já excluído';END IF;
 IF trim(coalesce(p_confirm,'')) IS DISTINCT FROM v_name THEN
   RAISE EXCEPTION 'Digite exatamente o nome do produto completo para autorizar';
 END IF;
 -- A transação única reusa os controles de reservas, auditoria e estoque já existentes.
 -- Se qualquer SKU falhar, TODOS os cancelamentos e baixas são revertidos.
 FOR v_variant IN
  SELECT id,name FROM public.products
  WHERE apparel_model_id=p_model AND force_archived_at IS NULL
  ORDER BY id FOR UPDATE
 LOOP
  v_result:=public.force_archive_entity('product',v_variant.id,v_variant.name);
  v_count:=v_count+1;
  v_units:=v_units+coalesce((v_result->>'units_removed')::bigint,0);
  v_cancelled:=v_cancelled+coalesce((v_result->>'cancelled_orders')::integer,0);
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'Nenhuma variação disponível para excluir';END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE apparel_model_id=p_model AND force_archived_at IS NULL)
 THEN RAISE EXCEPTION 'Uma variação não foi arquivada, transação revertida';END IF;
 UPDATE public.apparel_models
 SET force_archived_at=now(),force_archived_by=auth.uid()
 WHERE id=p_model;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('apparel_models',p_model::text,'FORCE_MODEL_ARCHIVED',auth.uid(),
  jsonb_build_object('name',v_name,'variants_archived',v_count,
   'units_removed',v_units,'cancelled_store_orders',v_cancelled,
   'history_preserved',true));
 RETURN jsonb_build_object('archived',true,'model_id',p_model,
  'variants_archived',v_count,'units_removed',v_units,
  'cancelled_orders',v_cancelled,'history_preserved',true);
END;$fn$;

REVOKE ALL ON FUNCTION public.force_archive_model_preview(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.force_archive_model(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.force_archive_model_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_archive_model(uuid,text) TO authenticated;