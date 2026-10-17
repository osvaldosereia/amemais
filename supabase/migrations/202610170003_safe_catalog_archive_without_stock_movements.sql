-- CDSB: catalog archiving is never an implicit physical stock write.
-- Draft migration: apply only after isolated PostgreSQL verification.
-- Store / temporary-store archival retains the previous transactional semantics.
CREATE OR REPLACE FUNCTION public.force_archive_preview(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_name text;v_primary boolean;v_balance bigint:=0;v_branch bigint:=0;v_requests integer:=0;v_orders integer:=0;v_history integer:=0;
BEGIN
 IF NOT app_private.role_in('admin','gerente') OR NOT app_private.has_permission('system.force_delete')
 THEN RAISE EXCEPTION 'Sem autonomia para exclusão avançada'; END IF;
 CASE p_kind
 WHEN 'product' THEN
  SELECT name INTO v_name FROM public.products WHERE id=p_id AND force_archived_at IS NULL;
  SELECT coalesce(sum(quantity),0) INTO v_balance FROM public.stock_balances WHERE product_id=p_id;
  SELECT coalesce(sum(quantity),0) INTO v_branch FROM public.store_stock WHERE product_id=p_id;
  v_balance:=v_balance+v_branch;
  SELECT count(*) INTO v_requests FROM public.stock_reservations WHERE product_id=p_id AND status='ativa';
  SELECT count(*) INTO v_orders FROM (
   SELECT o.id::text key FROM public.store_order_items i JOIN public.store_orders o ON o.id=i.order_id
    WHERE i.product_id=p_id AND o.status IN ('solicitado','pendente_estoque','aprovado','separado')
   UNION ALL
   SELECT o.id::text FROM public.avulso_order_items i JOIN public.avulso_orders o ON o.id=i.order_id
    WHERE i.product_id=p_id AND o.fulfillment_status IN ('legado','solicitado','pendente_estoque','reservado','separado')
   UNION ALL
   SELECT b.id::text FROM public.event_pick_batch_items i JOIN public.event_pick_batches b ON b.id=i.batch_id
    WHERE i.product_id=p_id AND b.status IN ('pendente_estoque','aguardando','em_separacao','separado')
  ) pending;
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
   'pending_records',v_orders,'active_reservations',v_requests,'branch_units',v_branch,'history_records',v_history,'preserves_history',true);
END;$function$;

CREATE OR REPLACE FUNCTION public.force_archive_model_preview(p_model uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_name text;v_total int;v_active int;v_central bigint;v_events bigint;v_branches bigint:=0;v_reserved bigint;
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
 SELECT coalesce(sum(ss.quantity),0) INTO v_branches
 FROM public.store_stock ss JOIN public.products p ON p.id=ss.product_id
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
   AND o.fulfillment_status IN ('legado','solicitado','pendente_estoque','reservado','separado')
  UNION
  SELECT ('evento:'||b.id::text) FROM public.event_pick_batches b
   JOIN public.event_pick_batch_items it ON it.batch_id=b.id
   JOIN public.products p ON p.id=it.product_id
   WHERE p.apparel_model_id=p_model AND p.force_archived_at IS NULL
   AND b.status IN ('pendente_estoque','aguardando','em_separacao','separado')
 ) pending;
 RETURN jsonb_build_object('name',v_name,'kind','model','variant_count',v_total,
  'active_variants',v_active,'stock_units',v_central+v_events+v_branches,
  'cd_units',v_central,'event_units',v_events,'branch_units',v_branches,'reserved_units',v_reserved,
  'pending_records',v_order_count,'active_reservations',v_reservations,
  'history_records',v_history,'preserves_history',true);
END;$fn$;


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
 -- Arquivamento do catálogo NUNCA baixa saldo, libera reservas ou cancela pedidos.
 -- O administrador resolve pendências no fluxo específico antes de arquivar.
 -- Locks dos saldos existentes impedem que uma contagem simultânea passe despercebida.
 PERFORM 1 FROM public.stock_balances WHERE product_id=p_id
  ORDER BY event_id NULLS FIRST FOR UPDATE;
 PERFORM 1 FROM public.store_stock WHERE product_id=p_id
  ORDER BY store_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.stock_balances WHERE product_id=p_id AND quantity>0)
   OR EXISTS(SELECT 1 FROM public.store_stock WHERE product_id=p_id AND quantity>0)
 THEN RAISE EXCEPTION 'Há estoque físico no CDSB, em filiais ou temporárias. Regularize antes de arquivar; o arquivamento nunca efetua baixa automática'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_reservations WHERE product_id=p_id AND status='ativa')
  OR EXISTS(
    SELECT 1 FROM public.store_order_items i JOIN public.store_orders o ON o.id=i.order_id
    WHERE i.product_id=p_id AND o.status IN ('solicitado','pendente_estoque','aprovado','separado'))
  OR EXISTS(
    SELECT 1 FROM public.avulso_order_items i JOIN public.avulso_orders o ON o.id=i.order_id
    WHERE i.product_id=p_id AND o.fulfillment_status IN ('legado','solicitado','pendente_estoque','reservado','separado'))
  OR EXISTS(
    SELECT 1 FROM public.event_pick_batch_items i JOIN public.event_pick_batches b ON b.id=i.batch_id
    WHERE i.product_id=p_id AND b.status IN ('pendente_estoque','aguardando','em_separacao','separado'))
 THEN RAISE EXCEPTION 'Produto possui reserva ou pedido aberto. Conclua ou cancele o pedido separadamente antes de arquivar'; END IF;
 UPDATE public.products SET active=false,force_archived_at=now(),force_archived_by=auth.uid()
 WHERE id=p_id AND force_archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto já arquivado'; END IF;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('products',p_id::text,'PRODUCT_CATALOG_ARCHIVED',auth.uid(),
   jsonb_build_object('name',v_name,'units_removed',0,'cancelled_orders',0,
    'history_preserved',true,'catalog_only',true));
 RETURN jsonb_build_object('archived',true,'units_removed',0,
   'cancelled_orders',0,'history_preserved',true,'catalog_only',true);
END;$function$;

-- Prevent stock being added to an archived SKU after its balance reached zero.
-- Lock the parent product during stock growth so it serializes with catalog archiving.
CREATE OR REPLACE FUNCTION app_private.reject_archived_product_stock_growth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
BEGIN
 IF (TG_OP='INSERT' AND NEW.quantity>0)
    OR (TG_OP='UPDATE' AND NEW.quantity>OLD.quantity) THEN
   PERFORM 1 FROM public.products WHERE id=NEW.product_id AND force_archived_at IS NULL FOR KEY SHARE;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Produto arquivado: não é permitido adicionar estoque';
   END IF;
 END IF;
 RETURN NEW;
END;$guard$;
REVOKE ALL ON FUNCTION app_private.reject_archived_product_stock_growth() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS reject_archived_product_stock_growth ON public.stock_balances;
CREATE TRIGGER reject_archived_product_stock_growth
 BEFORE INSERT OR UPDATE ON public.stock_balances
 FOR EACH ROW EXECUTE FUNCTION app_private.reject_archived_product_stock_growth();
DROP TRIGGER IF EXISTS reject_archived_product_stock_growth ON public.store_stock;
CREATE TRIGGER reject_archived_product_stock_growth
 BEFORE INSERT OR UPDATE ON public.store_stock
 FOR EACH ROW EXECUTE FUNCTION app_private.reject_archived_product_stock_growth();

