
create or replace function public.confirm_avulso_order_picking(p_order uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $fn$
declare o public.avulso_orders%rowtype;v jsonb;sku uuid;qty integer;expected integer;
 checked uuid[]:='{}';
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão para separar';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status<>'reservado' then raise exception 'Pedido não está integralmente reservado';end if;
 if o.expires_at is not null and o.expires_at<=now() then raise exception 'Reserva externa expirada';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items)<>(select count(*) from public.avulso_order_items where order_id=p_order)
 then raise exception 'Confira todos os SKUs';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
    or coalesce(v->>'quantity','')!~'^[1-9][0-9]{0,6}$'
  then raise exception 'SKU ou quantidade inválida';end if;
  sku:=(v->>'product_id')::uuid;qty:=(v->>'quantity')::integer;
  if sku=any(checked) then raise exception 'SKU repetido';end if;
  checked:=array_append(checked,sku);
  select quantity into expected from public.avulso_order_items where order_id=p_order and product_id=sku;
  if expected is distinct from qty then raise exception 'Quantidade divergente para %',sku;end if;
  if not exists(select 1 from public.stock_reservations where avulso_order_id=p_order
   and product_id=sku and status='ativa' and quantity=qty)
  then raise exception 'Reserva incompleta para %',sku;end if;
 end loop;
 update public.avulso_orders set fulfillment_status='separado',separated_by=auth.uid(),separated_at=now()
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('avulso_orders',p_order::text,'PICKING_CONFIRMED',auth.uid(),
 jsonb_build_object('sku_count',cardinality(checked)));
end;$fn$;

create or replace function public.dispatch_avulso_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare o public.avulso_orders%rowtype;line record;v_current integer;v_held integer;
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão para registrar saída';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status<>'separado' then raise exception 'Pedido ainda não separado ou já concluído';end if;
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
  values(line.product_id,null,'saida_loja',line.quantity,-line.quantity,0,auth.uid(),
    'Entrega de pedido avulso '||p_order::text||' · '||o.customer_name);
 end loop;
 update public.avulso_orders set fulfillment_status='concluido',
  dispatched_by=auth.uid(),dispatched_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('avulso_orders',p_order::text,'DISPATCHED_COMPLETED',auth.uid());
end;$fn$;

create or replace function public.cancel_avulso_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare o public.avulso_orders%rowtype;
begin
 if auth.uid() is null or not app_private.has_permission('orders.cancel')
 then raise exception 'Sem permissão para cancelar';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status not in ('legado','pendente_estoque','reservado','separado')
 then raise exception 'Pedido não pode ser cancelado';end if;
 update public.stock_reservations set status='liberada',ended_by=auth.uid(),ended_at=now()
 where avulso_order_id=p_order and status='ativa';
 update public.avulso_orders set fulfillment_status='cancelado',canceled_by=auth.uid(),canceled_at=now()
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('avulso_orders',p_order::text,'CANCELED',auth.uid());
end;$fn$;

-- Ajustes explícitos de atendimento; a solicitação original fica em histórico auditado.
create or replace function public.adjust_unified_order_shortage(
 p_kind text,p_order uuid,p_items jsonb,p_reason text
) returns void language plpgsql security definer set search_path=''
as $fn$
declare v_status text;v jsonb;v_sku uuid;v_qty integer;
 v_seen uuid[]:='{}';v_old integer;v_held integer;v_any integer:=0;v_changes integer:=0;line record;
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justifique a diferença';end if;
 if p_kind='loja' then
  select status into v_status from public.store_orders where id=p_order for update;
  if v_status not in ('solicitado','pendente_estoque','aprovado') then raise exception 'Pedido não pode ser ajustado';end if;
  if not exists(select 1 from public.store_orders o where o.id=p_order and app_private.can_access_store(o.from_store_id))
  then raise exception 'Sem acesso à central';end if;
 elsif p_kind='avulso' then
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
  if v_status not in ('legado','pendente_estoque','reservado') then raise exception 'Pedido não pode ser ajustado';end if;
 else raise exception 'Tipo inválido';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100
 then raise exception 'Lista de produtos inválida';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
   or coalesce(v->>'quantity','')!~'^(0|[1-9][0-9]{0,6})$' then raise exception 'SKU ou quantidade inválidos';end if;
  v_sku:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if v_sku=any(v_seen) or v_qty>1000000 then raise exception 'SKU repetido ou quantidade excessiva';end if;
  v_seen:=array_append(v_seen,v_sku);
  if p_kind='loja' then
   select quantity into v_old from public.store_order_items where order_id=p_order and product_id=v_sku;
  else
   select quantity into v_old from public.avulso_order_items where order_id=p_order and product_id=v_sku;
  end if;
  if v_old is null or v_qty>v_old then raise exception 'SKU inexistente ou quantidade aumentada';end if;
  v_any:=v_any+v_qty;
 end loop;
 if v_any=0 then raise exception 'Para cancelar todo o pedido, use Cancelar';end if;
 if p_kind='loja' then
  if (select count(*) from public.store_order_items where order_id=p_order)<>cardinality(v_seen)
  then raise exception 'Informe todos os SKUs do pedido';end if;
 else
  if (select count(*) from public.avulso_order_items where order_id=p_order)<>cardinality(v_seen)
  then raise exception 'Informe todos os SKUs do pedido';end if;
 end if;
 for v in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
  v_sku:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if p_kind='loja' then
   select quantity into v_old from public.store_order_items where order_id=p_order and product_id=v_sku for update;
   select quantity into v_held from public.stock_reservations
    where order_id=p_order and product_id=v_sku and status='ativa' for update;
  else
   select quantity into v_old from public.avulso_order_items where order_id=p_order and product_id=v_sku for update;
   select quantity into v_held from public.stock_reservations
    where avulso_order_id=p_order and product_id=v_sku and status='ativa' for update;
  end if;
  if v_qty=v_old then continue;end if;
  v_changes:=v_changes+1;
  insert into public.unified_order_adjustments(order_kind,order_id,product_id,
    original_quantity,revised_quantity,reason,actor_id)
   values(p_kind,p_order,v_sku,v_old,v_qty,btrim(p_reason),auth.uid());
  if p_kind='loja' then
   if v_qty=0 then
    delete from public.stock_reservations where order_id=p_order and product_id=v_sku;
    delete from public.store_order_items where order_id=p_order and product_id=v_sku;
   else
    update public.store_order_items set quantity=v_qty where order_id=p_order and product_id=v_sku;
    if coalesce(v_held,0)>v_qty then update public.stock_reservations
     set quantity=v_qty where order_id=p_order and product_id=v_sku and status='ativa';end if;
   end if;
  else
   if v_qty=0 then
    delete from public.stock_reservations where avulso_order_id=p_order and product_id=v_sku;
    delete from public.avulso_order_items where order_id=p_order and product_id=v_sku;
   else
    update public.avulso_order_items set quantity=v_qty where order_id=p_order and product_id=v_sku;
    if coalesce(v_held,0)>v_qty then update public.stock_reservations
     set quantity=v_qty where avulso_order_id=p_order and product_id=v_sku and status='ativa';end if;
   end if;
  end if;
 end loop;
 if v_changes=0 then raise exception 'Nenhuma quantidade alterada';end if;
 if p_kind='loja' then
  perform app_private.reserve_unified_order('loja',p_order);
 else
  update public.avulso_orders set fulfillment_status='pendente_estoque'
   where id=p_order and fulfillment_status='legado';
  perform app_private.reserve_unified_order('avulso',p_order);
 end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values(case when p_kind='loja' then 'store_orders' else 'avulso_orders' end,
 p_order::text,'SHORTAGE_ADJUSTED',auth.uid(),jsonb_build_object('reason',p_reason,'changes',v_changes));
end;$fn$;

revoke all on function public.confirm_avulso_order_picking(uuid,jsonb),
 public.dispatch_avulso_order(uuid),public.cancel_avulso_order(uuid),
 public.adjust_unified_order_shortage(text,uuid,jsonb,text) from public,anon;
grant execute on function public.confirm_avulso_order_picking(uuid,jsonb),
 public.dispatch_avulso_order(uuid),public.cancel_avulso_order(uuid),
 public.adjust_unified_order_shortage(text,uuid,jsonb,text) to authenticated;
