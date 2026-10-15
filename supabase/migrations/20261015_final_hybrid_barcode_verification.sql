-- Conferência final híbrida EAN/SKU + quantidade física, independente da separação.
CREATE TABLE IF NOT EXISTS public.order_final_verifications (
 kind text NOT NULL CHECK(kind IN ('avulso','loja','evento')),
 order_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id),
 expected_quantity integer NOT NULL CHECK(expected_quantity BETWEEN 1 AND 1000000),
 counted_quantity integer NOT NULL CHECK(counted_quantity BETWEEN 0 AND 1000000),
 scanned_code text NOT NULL CHECK(length(scanned_code) BETWEEN 1 AND 120),
 verified_by uuid NOT NULL REFERENCES auth.users(id),
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,order_id,product_id)
);
CREATE INDEX IF NOT EXISTS order_final_verifications_order_idx
 ON public.order_final_verifications(kind,order_id);
ALTER TABLE public.order_final_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_final_verifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_final_verifications TO authenticated;
DROP POLICY IF EXISTS order_final_verifications_staff_read ON public.order_final_verifications;
CREATE POLICY order_final_verifications_staff_read ON public.order_final_verifications
 FOR SELECT TO authenticated USING (
   app_private.is_active() AND
   (app_private.has_permission('orders.read') OR
    app_private.has_permission('orders.separate') OR
    app_private.has_permission('events.separate'))
 );

CREATE OR REPLACE FUNCTION public.save_order_final_verification(
 p_kind text,p_order uuid,p_product uuid,p_scanned_code text,p_counted integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path='' AS $function$
DECLARE
 v_status text;v_source uuid;v_expected integer;v_code text;
 v_matches integer;v_total integer;v_verified integer;v_units integer;
 v_order_count integer;v_allow boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.is_active() OR app_private.role_in('franquia') THEN
   RAISE EXCEPTION 'Sem acesso à conferência';
 END IF;
 IF p_kind NOT IN ('avulso','loja','evento') OR p_order IS NULL OR p_product IS NULL THEN
   RAISE EXCEPTION 'Pedido ou SKU inválido';
 END IF;
 v_allow := app_private.has_permission('orders.separate')
   OR (p_kind='evento' AND app_private.has_permission('events.separate'));
 IF NOT v_allow THEN RAISE EXCEPTION 'Sem permissão de conferência'; END IF;
 v_code:=btrim(coalesce(p_scanned_code,''));
 IF v_code='' OR length(v_code)>120 THEN RAISE EXCEPTION 'Leia um EAN ou SKU válido'; END IF;
 IF p_counted IS NULL OR p_counted<0 OR p_counted>1000000
 THEN RAISE EXCEPTION 'Quantidade encontrada inválida'; END IF;
 -- Serializar a conferência com a expedição e com outra conferência simultânea.
 IF p_kind='avulso' THEN
   SELECT fulfillment_status INTO v_status FROM public.avulso_orders
    WHERE id=p_order FOR UPDATE;
 ELSIF p_kind='loja' THEN
   SELECT status,from_store_id INTO v_status,v_source FROM public.store_orders
    WHERE id=p_order FOR UPDATE;
   IF NOT app_private.can_access_store(v_source) THEN RAISE EXCEPTION 'Sem acesso à origem'; END IF;
 ELSE
   SELECT status INTO v_status FROM public.event_pick_batches WHERE id=p_order FOR UPDATE;
 END IF;
 IF v_status IS DISTINCT FROM 'separado' THEN
   RAISE EXCEPTION 'É necessário concluir a separação antes de conferir';
 END IF;
 SELECT quantity INTO v_expected FROM (
   SELECT product_id,quantity FROM public.avulso_order_items WHERE p_kind='avulso' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.store_order_items WHERE p_kind='loja' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.event_pick_batch_items WHERE p_kind='evento' AND batch_id=p_order
 ) source WHERE product_id=p_product;
 IF v_expected IS NULL OR v_expected<1 THEN RAISE EXCEPTION 'Produto não pertence ao pedido'; END IF;
 -- Valida o código digitado/escaneado no servidor, não apenas na interface.
 SELECT count(*) INTO v_matches FROM (
   SELECT i.product_id FROM public.avulso_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='avulso' AND i.order_id=p_order
      AND (p.ean=v_code OR p.sku=v_code OR i.ean=v_code OR i.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.store_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='loja' AND i.order_id=p_order AND (p.ean=v_code OR p.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.event_pick_batch_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='evento' AND i.batch_id=p_order AND (p.ean=v_code OR p.sku=v_code)
 ) matches WHERE product_id=p_product;
 IF v_matches<>1 THEN RAISE EXCEPTION 'EAN/SKU não corresponde à variação selecionada'; END IF;
 SELECT count(*) INTO v_order_count FROM (
   SELECT i.product_id FROM public.avulso_order_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='avulso' AND i.order_id=p_order
      AND (p.ean=v_code OR p.sku=v_code OR i.ean=v_code OR i.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.store_order_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='loja' AND i.order_id=p_order AND (p.ean=v_code OR p.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.event_pick_batch_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='evento' AND i.batch_id=p_order AND (p.ean=v_code OR p.sku=v_code)
 ) distinct_matches;
 IF v_order_count<>1 THEN RAISE EXCEPTION 'Código ambíguo neste pedido; corrija o cadastro'; END IF;
 INSERT INTO public.order_final_verifications
   (kind,order_id,product_id,expected_quantity,counted_quantity,scanned_code,verified_by,verified_at)
 VALUES (p_kind,p_order,p_product,v_expected,p_counted,v_code,auth.uid(),now())
 ON CONFLICT(kind,order_id,product_id) DO UPDATE
 SET expected_quantity=excluded.expected_quantity,
     counted_quantity=excluded.counted_quantity,
     scanned_code=excluded.scanned_code,
     verified_by=excluded.verified_by,verified_at=excluded.verified_at;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES ('order_final_verifications',p_order::text,'FINAL_COUNT_RECORDED',auth.uid(),
   jsonb_build_object('kind',p_kind,'product_id',p_product,
    'expected',v_expected,'counted',p_counted,'matched',p_counted=v_expected));
 SELECT count(*),count(*) FILTER(WHERE v.counted_quantity=i.quantity),coalesce(sum(v.counted_quantity),0)
 INTO v_total,v_verified,v_units FROM (
   SELECT product_id,quantity FROM public.avulso_order_items WHERE p_kind='avulso' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.store_order_items WHERE p_kind='loja' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.event_pick_batch_items WHERE p_kind='evento' AND batch_id=p_order
 ) i LEFT JOIN public.order_final_verifications v ON
  v.kind=p_kind AND v.order_id=p_order AND v.product_id=i.product_id
  AND v.expected_quantity=i.quantity;
 RETURN jsonb_build_object('complete',v_total>0 AND v_total=v_verified,
   'matched_skus',v_verified,'total_skus',v_total,'counted_units',v_units,
   'expected',v_expected,'counted',p_counted);
END;
$function$;
REVOKE ALL ON FUNCTION public.save_order_final_verification(text,uuid,uuid,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_order_final_verification(text,uuid,uuid,text,integer)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_order_final_verification(p_kind text,p_order uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_total integer;v_confirmed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.is_active() THEN
  RAISE EXCEPTION 'Sessão de usuário inválida'; END IF;
 IF p_kind NOT IN ('avulso','loja','evento') OR p_order IS NULL THEN
  RAISE EXCEPTION 'Pedido inválido'; END IF;
 SELECT count(*),count(*) FILTER(WHERE v.product_id IS NOT NULL AND
    v.counted_quantity=i.quantity AND v.expected_quantity=i.quantity)
 INTO v_total,v_confirmed
 FROM (
  SELECT product_id,quantity FROM public.avulso_order_items WHERE p_kind='avulso' AND order_id=p_order
  UNION ALL SELECT product_id,quantity FROM public.store_order_items WHERE p_kind='loja' AND order_id=p_order
  UNION ALL SELECT product_id,quantity FROM public.event_pick_batch_items WHERE p_kind='evento' AND batch_id=p_order
 ) i LEFT JOIN public.order_final_verifications v ON
     v.kind=p_kind AND v.order_id=p_order AND v.product_id=i.product_id;
 IF v_total=0 OR v_total<>v_confirmed THEN
  RAISE EXCEPTION 'Conferência final incompleta. Leia cada SKU e informe a quantidade física antes da saída';
 END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.assert_order_final_verification(text,uuid)
 FROM PUBLIC,anon,authenticated;

-- Se houver alteração nos itens, invalida a contagem anterior.
CREATE OR REPLACE FUNCTION app_private.invalidate_order_final_verification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_kind text;v_parent uuid;
BEGIN
 v_kind:=CASE TG_TABLE_NAME WHEN 'avulso_order_items' THEN 'avulso'
   WHEN 'store_order_items' THEN 'loja' WHEN 'event_pick_batch_items' THEN 'evento' END;
 v_parent:=CASE WHEN TG_OP='DELETE' THEN
    CASE WHEN v_kind='evento' THEN OLD.batch_id ELSE OLD.order_id END
  ELSE CASE WHEN v_kind='evento' THEN NEW.batch_id ELSE NEW.order_id END END;
 DELETE FROM public.order_final_verifications WHERE kind=v_kind AND order_id=v_parent;
 RETURN coalesce(NEW,OLD);
END;$function$;
REVOKE ALL ON FUNCTION app_private.invalidate_order_final_verification() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS avulso_final_count_invalidate ON public.avulso_order_items;
CREATE TRIGGER avulso_final_count_invalidate AFTER INSERT OR UPDATE OR DELETE
 ON public.avulso_order_items FOR EACH ROW
 EXECUTE FUNCTION app_private.invalidate_order_final_verification();
DROP TRIGGER IF EXISTS store_final_count_invalidate ON public.store_order_items;
CREATE TRIGGER store_final_count_invalidate AFTER INSERT OR UPDATE OR DELETE
 ON public.store_order_items FOR EACH ROW
 EXECUTE FUNCTION app_private.invalidate_order_final_verification();
DROP TRIGGER IF EXISTS event_final_count_invalidate ON public.event_pick_batch_items;
CREATE TRIGGER event_final_count_invalidate AFTER INSERT OR UPDATE OR DELETE
 ON public.event_pick_batch_items FOR EACH ROW
 EXECUTE FUNCTION app_private.invalidate_order_final_verification();

-- Bloqueio transacional de saída física nos três tipos de pedido.
CREATE OR REPLACE FUNCTION public.dispatch_event_pick_batch(p_batch uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.event_pick_batches%rowtype;e public.events%rowtype;
line record;items jsonb;v_total integer;v_physical integer;v_reserved integer;
kind text;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate')
 then raise exception 'Sem permissão para confirmar saída física';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status<>'separado' then raise exception 'Lote ainda não conferido ou já enviado';end if;
 PERFORM public.assert_order_final_verification('evento',p_batch);
 select * into e from public.events where id=b.event_id for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local encerrado';end if;
 for line in select product_id,quantity,picked from public.event_pick_batch_items
  where batch_id=p_batch order by product_id loop
  if line.picked<>line.quantity then raise exception 'Lote com conferência incompleta';end if;
  select quantity into v_physical from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select quantity into v_reserved from public.stock_reservations
   where product_id=line.product_id and event_batch_id=p_batch and status='ativa' for update;
  if v_reserved is distinct from line.quantity or v_physical<line.quantity
  then raise exception 'Reserva ou estoque inconsistente no SKU %',line.product_id;end if;
 end loop;
 select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity)
  order by product_id) into items from public.event_pick_batch_items where batch_id=p_batch;
 kind:=case when e.status='rascunho' then 'inicial' else 'complemento' end;
 -- Consome a reserva ANTES da transferência para evitar contar a mesma unidade duas vezes.
 update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
 where event_batch_id=p_batch and status='ativa';
 if e.status='rascunho' then perform public.activate_event(e.id);end if;
 v_total:=public.transfer_event_batch(e.id,items,'Lote '||b.sequence||' / '||b.id::text);
 insert into public.event_shipments(event_id,shipment_kind,items,created_by)
 values(e.id,kind,items,auth.uid());
 update public.event_pick_batches set status='enviado',dispatched_by=auth.uid(),
 dispatched_at=now(),updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',e.id::text,'EVENT_BATCH_DISPATCHED',auth.uid(),
 jsonb_build_object('batch',p_batch,'sequence',b.sequence,'units',v_total,'shipment_kind',kind));
 return v_total;
end;$function$


CREATE OR REPLACE FUNCTION public.dispatch_avulso_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.avulso_orders%rowtype;line record;v_current integer;v_held integer;
begin
 if auth.uid() is null or not app_private.has_permission('orders.dispatch')
 then raise exception 'Sem permissão para registrar saída';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status<>'separado' then raise exception 'Pedido ainda não separado ou já concluído';end if;
 PERFORM public.assert_order_final_verification('avulso',p_order);
 for line in select product_id,quantity from public.avulso_order_items
  where order_id=p_order order by product_id loop
  select quantity into v_current from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select quantity into v_held from public.stock_reservations
   where avulso_order_id=p_order and product_id=line.product_id and status='ativa' for update;
  if v_current is null or v_current<line.quantity or v_held is distinct from line.quantity
  then raise exception 'Separação ou estoque inconsistente no SKU %',line.product_id;end if;
  update public.stock_reservations set status='consumida',ended_by=auth.uid(),ended_at=now()
  where avulso_order_id=p_order and product_id=line.product_id and status='ativa';
  update public.stock_balances set quantity=quantity-line.quantity,updated_at=now()
  where product_id=line.product_id and event_id is null;
  insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
  values(line.product_id,null,'saida_pedido',line.quantity,-line.quantity,0,auth.uid(),
    'Entrega de pedido avulso '||p_order::text||' · '||o.customer_name);
 end loop;
 update public.avulso_orders set fulfillment_status='concluido',
  dispatched_by=auth.uid(),dispatched_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('avulso_orders',p_order::text,'DISPATCHED_COMPLETED',auth.uid());
end;$function$


CREATE OR REPLACE FUNCTION public.dispatch_store_order(p_order uuid, p_external_reference text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.store_orders%rowtype;v_item record;v_current integer;v_target_kind text;v_reserved integer;
begin
 if not app_private.has_permission('orders.dispatch') then raise exception 'Sem permissao para registrar saida';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'separado' then raise exception 'Pedido ainda nao separado ou ja expedido';end if;
 PERFORM public.assert_order_final_verification('loja',p_order);
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 if not exists(select 1 from public.stores where id=v_order.from_store_id and is_primary and active)
 then raise exception 'Origem deve ser a central';end if;
 select kind into v_target_kind from public.stores where id=v_order.to_store_id and active;
 if v_target_kind is null then raise exception 'Destino inativo';end if;
 if length(coalesce(p_external_reference,''))>120 then raise exception 'Referencia externa longa demais';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   select quantity into v_current from public.stock_balances where product_id=v_item.product_id
     and event_id is null for update;
   select quantity into v_reserved from public.stock_reservations where order_id=p_order
     and product_id=v_item.product_id and status='ativa' for update;
   if v_reserved is distinct from v_item.quantity or v_current<v_item.quantity then
     raise exception 'Separacao inconsistente para %',v_item.product_id;
   end if;
   update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
    where order_id=p_order and product_id=v_item.product_id and status='ativa';
   update public.stock_balances set quantity=quantity-v_item.quantity,updated_at=now()
    where product_id=v_item.product_id and event_id is null;
   insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
    values(v_item.product_id,null,'saida_loja',v_item.quantity,-v_item.quantity,0,auth.uid(),
      'Separacao para loja - pedido '||p_order::text);
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
    values(p_order,v_order.from_store_id,v_item.product_id,-v_item.quantity,auth.uid(),
      case when v_target_kind='franquia' then 'saida_definitiva' else 'expedicao' end);
 end loop;
 update public.store_orders set status='despachado',
     dispatched_by=auth.uid(),dispatched_at=now(),external_reference=nullif(btrim(coalesce(p_external_reference,'')),'')
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',p_order::text,'DISPATCHED',auth.uid(),
   jsonb_build_object('destination_kind',v_target_kind,'external_reference',p_external_reference));
end;$function$

