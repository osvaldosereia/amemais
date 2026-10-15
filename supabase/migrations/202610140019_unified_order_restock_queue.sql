
create or replace function app_private.allocate_pending_on_restock()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v record;
begin
 if new.event_id is not null then return new;end if;
 if tg_op='INSERT' then
  if new.quantity<=0 then return new;end if;
 else
  if new.quantity<=old.quantity then return new;end if;
 end if;
 perform app_private.expire_unconfirmed_catalog_orders();
 for v in
  select kind,order_id from (
   select 'loja'::text kind,o.id order_id,o.created_at
    from public.store_orders o join public.store_order_items i on i.order_id=o.id
    where o.status='pendente_estoque' and i.product_id=new.product_id
   union all
   select 'avulso'::text kind,o.id order_id,o.created_at
    from public.avulso_orders o join public.avulso_order_items i on i.order_id=o.id
    where o.fulfillment_status='pendente_estoque' and i.product_id=new.product_id
      and (o.expires_at is null or o.expires_at>now())
  ) pending order by created_at,order_id
 loop
  perform app_private.reserve_unified_item(v.kind,v.order_id,new.product_id);
 end loop;
 return new;
end;$fn$;
drop trigger if exists stock_central_allocate_waitlist on public.stock_balances;
create trigger stock_central_allocate_waitlist
 after insert or update of quantity on public.stock_balances
 for each row execute function app_private.allocate_pending_on_restock();

create or replace function public.expire_catalog_order_reservations()
returns integer language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão';end if;
 return app_private.expire_unconfirmed_catalog_orders();
end;$fn$;
revoke all on function public.expire_catalog_order_reservations() from public,anon;
grant execute on function public.expire_catalog_order_reservations() to authenticated;
