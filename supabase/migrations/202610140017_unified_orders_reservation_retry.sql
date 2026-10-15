
create or replace function app_private.expire_unconfirmed_catalog_orders()
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v record;v_count integer:=0;
begin
 for v in select id from public.avulso_orders where source<>'interno'
  and fulfillment_status in ('pendente_estoque','reservado') and expires_at<=now()
  for update skip locked loop
  update public.stock_reservations set status='liberada',ended_at=now()
    where avulso_order_id=v.id and status='ativa';
  update public.avulso_orders set fulfillment_status='expirado' where id=v.id;
  v_count:=v_count+1;
 end loop;
 return v_count;
end;$fn$;
revoke all on function app_private.expire_unconfirmed_catalog_orders() from public,anon,authenticated;

create or replace function public.retry_unified_order_reservation(p_kind text,p_order uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_status text;
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão para reservar';end if;
 perform app_private.expire_unconfirmed_catalog_orders();
 if p_kind='loja' then
  select status into v_status from public.store_orders where id=p_order for update;
  if v_status not in ('solicitado','pendente_estoque','aprovado') then raise exception 'Pedido não permite nova reserva';end if;
  if not exists(select 1 from public.store_orders o where o.id=p_order and app_private.can_access_store(o.from_store_id))
  then raise exception 'Sem acesso à central';end if;
 elsif p_kind='avulso' then
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
  if v_status not in ('legado','pendente_estoque','reservado') then raise exception 'Pedido não permite nova reserva';end if;
  update public.avulso_orders set fulfillment_status='pendente_estoque' where id=p_order and fulfillment_status='legado';
 else raise exception 'Tipo inválido';end if;
 perform app_private.reserve_unified_order(p_kind,p_order);
 if p_kind='loja' then select status into v_status from public.store_orders where id=p_order;
 else select fulfillment_status into v_status from public.avulso_orders where id=p_order;end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values(case when p_kind='loja' then 'store_orders' else 'avulso_orders' end,p_order::text,
  'RESERVATION_RECHECKED',auth.uid(),jsonb_build_object('status',v_status));
 return jsonb_build_object('status',v_status);
end;$fn$;
revoke all on function public.retry_unified_order_reservation(text,uuid) from public,anon;
grant execute on function public.retry_unified_order_reservation(text,uuid) to authenticated;
