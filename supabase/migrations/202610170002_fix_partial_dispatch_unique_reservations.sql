-- Fix partial dispatch: do not duplicate a unique (order, product) reservation.
-- No change to existing historical rows, balances or order statuses on migration.
-- Requires regression tests with a real authenticated operator in an isolated environment.
CREATE OR REPLACE FUNCTION public.send_operational_order(p_kind text, p_order uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_row public.order_operational_progress%rowtype;v_status text;
 v_source uuid;v_dest uuid;v_kind text;v_event uuid;v_seq integer;v_event_status text;
 v_customer text;v_item record;v_doc jsonb;v_qty integer;v_expected integer;
 v_reserved integer;v_physical integer;v_total integer:=0;v_items jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not app_private.is_active() or not app_private.has_permission('orders.dispatch')
 then raise exception 'Sem permissão de expedição';end if;
 if p_kind not in ('loja','evento','avulso') then raise exception 'Pedido inválido';end if;
 if p_kind='loja' then
  select status,from_store_id,to_store_id into v_status,v_source,v_dest from public.store_orders
   where id=p_order for update;
  if not app_private.can_access_store(v_source) then raise exception 'Origem não autorizada';end if;
  if not exists(select 1 from public.stores where id=v_source and is_primary and active)
   then raise exception 'Origem não é a central';end if;
  select kind into v_kind from public.stores where id=v_dest and active;
  if v_kind is null then raise exception 'Destino inativo';end if;
 elsif p_kind='evento' then
  if not app_private.role_in('admin','gerente') or not app_private.has_permission('events.separate')
   then raise exception 'Envio de evento restrito ao gerente';end if;
  select status,event_id,sequence into v_status,v_event,v_seq
   from public.event_pick_batches where id=p_order for update;
  select status into v_event_status from public.events where id=v_event for update;
  if v_event_status not in ('rascunho','ativo') then raise exception 'Evento não permite envio';end if;
 else
  select fulfillment_status,customer_name into v_status,v_customer from public.avulso_orders
   where id=p_order for update;end if;
 if v_status is distinct from 'separado' then raise exception 'Pedido não disponível para expedição';end if;
 select * into v_row from public.order_operational_progress
  where kind=p_kind and order_id=p_order for update;
 if not found or v_row.stage<>'expedicao' then raise exception 'Conferência deve estar concluída para expedição';end if;
 for v_item in select product_id,quantity from public.store_order_items where p_kind='loja' and order_id=p_order
  union all select product_id,quantity from public.event_pick_batch_items where p_kind='evento' and batch_id=p_order
  union all select product_id,quantity from public.avulso_order_items where p_kind='avulso' and order_id=p_order
  order by product_id
 loop
  v_doc:=v_row.items->(v_item.product_id::text);
  if v_doc is null or jsonb_typeof(v_doc->'counted')<>'number'
  then raise exception 'SKU ainda não conferido';end if;
  v_qty:=(v_doc->>'counted')::integer;
  if v_qty<0 or v_qty>v_item.quantity or (v_doc->>'requested')::integer<>v_item.quantity
   then raise exception 'Quantidade conferida incorreta no SKU %',v_item.product_id;end if;
  select quantity into v_reserved from public.stock_reservations r where
    r.product_id=v_item.product_id and status='ativa'
    and ((p_kind='loja' and r.order_id=p_order)
     or (p_kind='evento' and r.event_batch_id=p_order)
     or (p_kind='avulso' and r.avulso_order_id=p_order))
   for update;
  if v_reserved is distinct from v_item.quantity
   then raise exception 'Reserva insuficiente no SKU %',v_item.product_id;end if;
  if v_qty>0 then
   select quantity into v_physical from public.stock_balances
    where product_id=v_item.product_id and event_id is null for update;
   if v_physical is null or v_physical<v_qty then raise exception 'Estoque insuficiente no SKU %',v_item.product_id;end if;
  end if;
  -- One reservation per order/SKU: unique indexes forbid a second historical row.
  -- Keep the original reserved quantity, record the effective shipment in
  -- operational_progress.items, and close the reservation atomically.
  -- The unshipped difference is derived from requested - counted.
  update public.stock_reservations
     set status=case when v_qty>0 then 'consumida' else 'liberada' end,
         ended_by=auth.uid(),ended_at=now()
   where product_id=v_item.product_id and status='ativa'
     and ((p_kind='loja' and order_id=p_order)
       or (p_kind='evento' and event_batch_id=p_order)
       or (p_kind='avulso' and avulso_order_id=p_order));
  if not found then raise exception 'Reserva não encontrada no SKU %',v_item.product_id;end if;
  if v_qty>0 then
   if p_kind='evento' then
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'product_id',v_item.product_id,'quantity',v_qty));
   else
    update public.stock_balances set quantity=quantity-v_qty,updated_at=now()
      where product_id=v_item.product_id and event_id is null;
    insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
    values(v_item.product_id,null,case when p_kind='loja' then 'saida_loja' else 'saida_pedido' end,
      v_qty,-v_qty,0,auth.uid(),'Pedido parcial/conferido '||p_order::text);
    if p_kind='loja' then
     insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
     values(p_order,v_source,v_item.product_id,-v_qty,
      auth.uid(),case when v_kind='franquia' then 'saida_definitiva' else 'expedicao' end);
    end if;
   end if;
  end if;
  v_total:=v_total+v_qty;
 end loop;
 if p_kind='loja' then
  update public.store_orders set status='despachado',dispatched_by=auth.uid(),dispatched_at=now() where id=p_order;
 elsif p_kind='avulso' then
  update public.avulso_orders set fulfillment_status='concluido',dispatched_by=auth.uid(),dispatched_at=now()
    where id=p_order;
 else
  if v_total>0 then
   if v_event_status='rascunho' then perform public.activate_event(v_event);end if;
   perform public.transfer_event_batch(v_event,v_items,'Envio conferido · lote '||v_seq);
   insert into public.event_shipments(event_id,shipment_kind,items,created_by)
    values(v_event,case when v_event_status='rascunho' then 'inicial' else 'complemento' end,
       v_items,auth.uid());
  end if;
  update public.event_pick_batches set status='enviado',dispatched_by=auth.uid(),
   dispatched_at=now(),updated_at=now() where id=p_order;
 end if;
 update public.order_operational_progress set stage='enviado',updated_by=auth.uid(),
 updated_at=now() where kind=p_kind and order_id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('order_operational_progress',p_order::text,'SHIPMENT_COMPLETED',auth.uid(),
  jsonb_build_object('kind',p_kind,'sent_units',v_total,'divergence',v_row.has_difference,
  'items',v_row.items));
 return jsonb_build_object('stage','enviado','sent_units',v_total,
  'has_difference',v_row.has_difference);
end;$function$
;

REVOKE ALL ON FUNCTION public.send_operational_order(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_operational_order(text,uuid) TO authenticated;
