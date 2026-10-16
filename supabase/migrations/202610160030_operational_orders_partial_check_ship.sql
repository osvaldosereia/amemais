create table if not exists public.order_operational_progress(
 kind text not null check(kind in ('loja','evento','avulso')),
 order_id uuid not null,
 stage text not null check(stage in ('separacao','conferencia','expedicao','enviado')),
 items jsonb not null default '{}'::jsonb check(jsonb_typeof(items)='object'),
 has_difference boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key(kind,order_id)
);
create index if not exists order_operational_progress_stage_idx on public.order_operational_progress(stage,updated_at desc);
alter table public.order_operational_progress enable row level security;
revoke all on public.order_operational_progress from public,anon,authenticated;
grant select on public.order_operational_progress to authenticated;
drop policy if exists order_operational_progress_staff_select on public.order_operational_progress;
create policy order_operational_progress_staff_select on public.order_operational_progress
 for select to authenticated using (
  app_private.is_active() and not app_private.role_in('franquia') and (
    app_private.has_permission('orders.read')
    or app_private.has_permission('orders.separate')
    or app_private.has_permission('events.separate')
    or app_private.has_permission('orders.dispatch')));


CREATE OR REPLACE FUNCTION public.save_operational_pick(p_kind text, p_order uuid, p_items jsonb, p_finish boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_status text;v_origin uuid;v_record public.order_operational_progress%rowtype;
 v_line record;v_entry jsonb;v_result jsonb:='{}'::jsonb;v_picked integer;
 v_reason text;v_difference boolean:=false;v_total integer:=0;v_count integer:=0;
begin
 if auth.uid() is null or not app_private.is_active() or app_private.role_in('franquia')
 or not (app_private.has_permission('orders.separate')
    or (p_kind='evento' and app_private.has_permission('events.separate')))
 then raise exception 'Sem permissão de separação';end if;
 if p_kind not in ('loja','evento','avulso') or p_order is null
 or p_items is null or jsonb_typeof(p_items)<>'object'
 then raise exception 'Pedido ou lista de separação inválidos';end if;
 if p_kind='loja' then
  select status,from_store_id into v_status,v_origin from public.store_orders where id=p_order for update;
  if not app_private.can_access_store(v_origin) then raise exception 'Sem acesso à origem';end if;
 elsif p_kind='evento' then
  select status into v_status from public.event_pick_batches where id=p_order for update;
 else
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
 end if;
 if not (p_kind='loja' and v_status='aprovado'
  or p_kind='avulso' and v_status='reservado'
  or p_kind='evento' and v_status in ('aguardando','em_separacao'))
 then raise exception 'Pedido não disponível para separação';end if;
 select * into v_record from public.order_operational_progress
  where kind=p_kind and order_id=p_order for update;
 if found and v_record.stage<>'separacao' then
  raise exception 'A separação já foi encerrada';end if;
 for v_line in
  select product_id,quantity from public.store_order_items where p_kind='loja' and order_id=p_order
  union all select product_id,quantity from public.avulso_order_items where p_kind='avulso' and order_id=p_order
  union all select product_id,quantity from public.event_pick_batch_items where p_kind='evento' and batch_id=p_order
 loop
  v_count:=v_count+1;
  v_entry:=p_items->(v_line.product_id::text);
  if v_entry is null or jsonb_typeof(v_entry)<>'object'
     or coalesce(v_entry->>'quantity','') !~ '^(0|[1-9][0-9]{0,6})$'
   then raise exception 'Informe a quantidade encontrada para todos os SKUs';end if;
  v_picked:=(v_entry->>'quantity')::integer;
  if v_picked>v_line.quantity then raise exception 'Quantidade acima da solicitada';end if;
  v_reason:=btrim(coalesce(v_entry->>'reason',''));
  if v_picked<v_line.quantity then
   v_difference:=true;
   if p_finish and length(v_reason)<5 then
    raise exception 'Informe motivo da falta para cada produto divergente';end if;
  end if;
  if length(v_reason)>250 then raise exception 'Motivo excede 250 caracteres';end if;
  if not exists(select 1 from public.stock_reservations r where
    r.product_id=v_line.product_id and r.status='ativa' and r.quantity=v_line.quantity
    and ((p_kind='loja' and r.order_id=p_order)
     or (p_kind='avulso' and r.avulso_order_id=p_order)
     or (p_kind='evento' and r.event_batch_id=p_order)))
  then raise exception 'Reserva inconsistente para o SKU %',v_line.product_id;end if;
  v_result:=v_result||jsonb_build_object(v_line.product_id::text,jsonb_build_object(
   'requested',v_line.quantity,'picked',v_picked,'pick_reason',v_reason,
   'counted',null,'check_reason',''));
  v_total:=v_total+v_picked;
  if p_kind='evento' then update public.event_pick_batch_items set picked=v_picked
    where batch_id=p_order and product_id=v_line.product_id;end if;
 end loop;
 if v_count=0 or (select count(*) from jsonb_object_keys(v_result))<>(select count(*) from jsonb_object_keys(p_items))
 then raise exception 'Todos os produtos do pedido devem estar presentes uma única vez';end if;
 insert into public.order_operational_progress(kind,order_id,stage,items,has_difference,updated_at,updated_by)
 values(p_kind,p_order,case when p_finish then 'conferencia' else 'separacao' end,
  v_result,v_difference,now(),auth.uid())
 on conflict(kind,order_id) do update
 set stage=excluded.stage,items=excluded.items,has_difference=excluded.has_difference,
  updated_at=now(),updated_by=auth.uid();
 if p_finish then
  if p_kind='loja' then update public.store_orders set status='separado',
   separated_by=auth.uid(),separated_at=now() where id=p_order;
  elsif p_kind='avulso' then update public.avulso_orders set fulfillment_status='separado',
   separated_by=auth.uid(),separated_at=now() where id=p_order;
  else update public.event_pick_batches set status='separado',
   picked_by=auth.uid(),picked_at=now(),updated_at=now() where id=p_order;end if;
 elsif p_kind='evento' then
  update public.event_pick_batches set status='em_separacao',picked_by=auth.uid(),updated_at=now()
   where id=p_order;
 end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('order_operational_progress',p_order::text,
  case when p_finish then 'PICKING_COMPLETED' else 'PICKING_SAVED' end,auth.uid(),
  jsonb_build_object('kind',p_kind,'picked',v_total,'divergence',v_difference,'items',v_result));
 return jsonb_build_object('stage',case when p_finish then 'conferencia' else 'separacao' end,
 'has_difference',v_difference,'picked',v_total);
end;$function$
;
revoke all on function public.save_operational_pick(text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_operational_pick(text,uuid,jsonb,boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.save_operational_check(p_kind text, p_order uuid, p_items jsonb, p_finish boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_status text;v_source uuid;v_row public.order_operational_progress%rowtype;
 v_key text;v_item jsonb;v_count integer;v_picked integer;v_requested integer;
 v_reason text;v_result jsonb;v_diff boolean:=false;v_total integer:=0;
begin
 if auth.uid() is null or not app_private.is_active() or app_private.role_in('franquia')
 or not (app_private.has_permission('orders.separate') or
  (p_kind='evento' and app_private.has_permission('events.separate')))
 then raise exception 'Sem permissão de conferência';end if;
 if p_kind not in ('loja','evento','avulso') or p_order is null
 or p_items is null or jsonb_typeof(p_items)<>'object' then raise exception 'Conferência inválida';end if;
 if p_kind='loja' then
  select status,from_store_id into v_status,v_source from public.store_orders where id=p_order for update;
  if not app_private.can_access_store(v_source) then raise exception 'Sem acesso à origem';end if;
 elsif p_kind='evento' then
  select status into v_status from public.event_pick_batches where id=p_order for update;
 else
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;end if;
 if v_status is distinct from 'separado' then raise exception 'Pedido ainda não separado';end if;
 select * into v_row from public.order_operational_progress
  where kind=p_kind and order_id=p_order for update;
 if not found then
  -- Pedidos já separados antes desta migração também podem ser conferidos no fluxo novo.
  v_row.kind:=p_kind;v_row.order_id:=p_order;v_row.stage:='conferencia';
  v_row.items:='{}'::jsonb;v_row.has_difference:=false;
  for v_key,v_item in
   select product_id::text,jsonb_build_object('requested',quantity,
      'picked',case when p_kind='evento' then picked else quantity end,
      'pick_reason','', 'counted',null,'check_reason','')
    from public.event_pick_batch_items where p_kind='evento' and batch_id=p_order
   union all
   select product_id::text,jsonb_build_object('requested',quantity,
     'picked',quantity,'pick_reason','', 'counted',null,'check_reason','')
    from public.store_order_items where p_kind='loja' and order_id=p_order
   union all
   select product_id::text,jsonb_build_object('requested',quantity,
     'picked',quantity,'pick_reason','', 'counted',null,'check_reason','')
    from public.avulso_order_items where p_kind='avulso' and order_id=p_order
  loop
    v_row.items:=v_row.items||jsonb_build_object(v_key,v_item);
    if (v_item->>'picked')::integer <> (v_item->>'requested')::integer
       then v_row.has_difference:=true;end if;
  end loop;
  if v_row.items='{}'::jsonb then raise exception 'Pedido sem itens';end if;
  insert into public.order_operational_progress(kind,order_id,stage,items,has_difference,updated_by)
    values(p_kind,p_order,'conferencia',v_row.items,v_row.has_difference,auth.uid());
 end if;
 if v_row.stage<>'conferencia' then raise exception 'Pedido não está na etapa de conferência';end if;
 if (select count(*) from jsonb_object_keys(p_items))<>(select count(*) from jsonb_object_keys(v_row.items))
 then raise exception 'Confira todos os SKUs';end if;
 v_result:=v_row.items;
 for v_key,v_item in select key,value from jsonb_each(v_row.items) loop
  if p_items->v_key is null or
  coalesce(p_items->v_key->>'quantity','') !~ '^(0|[1-9][0-9]{0,6})$'
  then raise exception 'Contagem não informada para o SKU %',v_key;end if;
  v_count:=(p_items->v_key->>'quantity')::integer;
  v_picked:=(v_item->>'picked')::integer;
  v_requested:=(v_item->>'requested')::integer;
  if v_count>v_requested then raise exception 'Conferência excede quantidade solicitada para o SKU %',v_key;end if;
  v_reason:=btrim(coalesce(p_items->v_key->>'reason',''));
  if v_count<>v_picked or v_count<>v_requested then
   v_diff:=true;
   if p_finish and length(v_reason)<5 and (v_count<>v_picked or length(coalesce(v_item->>'pick_reason',''))<5) then
    raise exception 'Justifique divergência da conferência no SKU %',v_key;end if;
  end if;
  if length(v_reason)>250 then raise exception 'Motivo excede 250 caracteres';end if;
  v_result:=jsonb_set(v_result,array[v_key],v_item||
    jsonb_build_object('counted',v_count,'check_reason',v_reason));
  v_total:=v_total+v_count;
 end loop;
 v_diff:=v_diff or v_row.has_difference;
 update public.order_operational_progress set
  stage=case when p_finish then 'expedicao' else 'conferencia' end,
  items=v_result,has_difference=v_diff,updated_at=now(),updated_by=auth.uid()
  where kind=p_kind and order_id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('order_operational_progress',p_order::text,
  case when p_finish then 'CHECK_COMPLETED' else 'CHECK_SAVED' end,
  auth.uid(),jsonb_build_object('kind',p_kind,'counted',v_total,'divergence',v_diff,'items',v_result));
 return jsonb_build_object('stage',case when p_finish then 'expedicao' else 'conferencia' end,
  'has_difference',v_diff,'counted',v_total);
end;$function$
;
revoke all on function public.save_operational_check(text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_operational_check(text,uuid,jsonb,boolean) to authenticated;

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
  -- As reservas não expedidas são liberadas sem baixa no saldo físico.
  -- Registra explicitamente as unidades não atendidas como reserva liberada.
  if v_qty>0 and v_qty<v_item.quantity then
   insert into public.stock_reservations(
     order_id,product_id,quantity,status,created_by,created_at,ended_by,ended_at,avulso_order_id,event_batch_id)
   select r.order_id,r.product_id,v_item.quantity-v_qty,'liberada',
     r.created_by,r.created_at,auth.uid(),now(),r.avulso_order_id,r.event_batch_id
   from public.stock_reservations r where r.product_id=v_item.product_id
     and r.status='ativa' and ((p_kind='loja' and r.order_id=p_order)
      or (p_kind='evento' and r.event_batch_id=p_order)
      or (p_kind='avulso' and r.avulso_order_id=p_order));
  end if;
  update public.stock_reservations set quantity=case when v_qty>0 then v_qty else quantity end,
    status=case when v_qty>0 then 'consumida' else 'liberada' end,
    ended_by=auth.uid(),ended_at=now()
   where product_id=v_item.product_id and status='ativa'
    and ((p_kind='loja' and order_id=p_order)
     or (p_kind='evento' and event_batch_id=p_order)
     or (p_kind='avulso' and avulso_order_id=p_order));
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
revoke all on function public.send_operational_order(text,uuid) from public,anon,authenticated;
grant execute on function public.send_operational_order(text,uuid) to authenticated;