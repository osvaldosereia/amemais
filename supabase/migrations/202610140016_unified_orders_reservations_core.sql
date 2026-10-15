
alter table public.stock_reservations alter column order_id drop not null;
alter table public.stock_reservations alter column created_by drop not null;
alter table public.stock_reservations add column if not exists avulso_order_id uuid references public.avulso_orders(id) on delete restrict;
alter table public.stock_reservations add constraint stock_reservations_one_parent check(num_nonnulls(order_id,avulso_order_id)=1);
create unique index if not exists stock_reservations_avulso_sku_unique on public.stock_reservations(avulso_order_id,product_id) where avulso_order_id is not null;
alter table public.avulso_orders add column if not exists fulfillment_status text not null default 'legado' check (fulfillment_status in ('legado','pendente_estoque','reservado','separado','concluido','cancelado','expirado'));
alter table public.avulso_orders add column if not exists expires_at timestamptz;
alter table public.avulso_orders add column if not exists separated_by uuid references public.staff_profiles(id);
alter table public.avulso_orders add column if not exists separated_at timestamptz;
alter table public.avulso_orders add column if not exists dispatched_by uuid references public.staff_profiles(id);
alter table public.avulso_orders add column if not exists dispatched_at timestamptz;
alter table public.avulso_orders add column if not exists canceled_by uuid references public.staff_profiles(id);
alter table public.avulso_orders add column if not exists canceled_at timestamptz;
alter table public.store_orders drop constraint if exists store_orders_status_check;
alter table public.store_orders add constraint store_orders_status_check check(status in ('solicitado','pendente_estoque','aprovado','separado','despachado','concluido','recebido','recebido_divergente','cancelado'));

create table if not exists public.unified_order_adjustments(
 id uuid primary key default gen_random_uuid(),
 order_kind text not null check(order_kind in ('avulso','loja')),
 order_id uuid not null,
 product_id uuid not null references public.products(id),
 original_quantity integer not null check(original_quantity>=0),
 revised_quantity integer not null check(revised_quantity>=0),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 actor_id uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists unified_order_adjustments_order_idx on public.unified_order_adjustments(order_kind,order_id);
alter table public.unified_order_adjustments enable row level security;
revoke all on public.unified_order_adjustments from public,anon;
grant select on public.unified_order_adjustments to authenticated;
create policy unified_order_adjustments_staff_read on public.unified_order_adjustments for select to authenticated
 using(app_private.has_permission('orders.read') and not app_private.role_in('franquia'));

create or replace function app_private.reserve_unified_item(p_kind text,p_order uuid,p_product uuid)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v_need integer;v_held integer;v_total integer;v_physical integer;v_extra integer;v_complete boolean;v_status text;
begin
 if p_kind='loja' then
  select status into v_status from public.store_orders where id=p_order for update;
  if v_status not in ('solicitado','pendente_estoque','aprovado') then return 0;end if;
  select quantity into v_need from public.store_order_items where order_id=p_order and product_id=p_product;
 elsif p_kind='avulso' then
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
  if v_status not in ('pendente_estoque','reservado') then return 0;end if;
  select quantity into v_need from public.avulso_order_items where order_id=p_order and product_id=p_product;
 else raise exception 'Origem inválida';end if;
 if v_need is null then return 0;end if;
 insert into public.stock_balances(product_id,event_id,quantity) values(p_product,null,0)
 on conflict(product_id) where event_id is null do nothing;
 select quantity into v_physical from public.stock_balances where product_id=p_product and event_id is null for update;
 select coalesce(sum(quantity),0) into v_total from public.stock_reservations where product_id=p_product and status='ativa';
 if p_kind='loja' then
  select quantity into v_held from public.stock_reservations
   where order_id=p_order and product_id=p_product and status='ativa' for update;
 else
  select quantity into v_held from public.stock_reservations
   where avulso_order_id=p_order and product_id=p_product and status='ativa' for update;
 end if;
 v_held:=coalesce(v_held,0);
 v_extra:=least(greatest(0,v_need-v_held),greatest(0,v_physical-v_total));
 if v_extra>0 then
  if v_held=0 then
   insert into public.stock_reservations(order_id,avulso_order_id,product_id,quantity,created_by)
   values(case when p_kind='loja' then p_order else null end,
     case when p_kind='avulso' then p_order else null end,p_product,v_extra,auth.uid());
  elsif p_kind='loja' then
   update public.stock_reservations set quantity=quantity+v_extra
    where order_id=p_order and product_id=p_product and status='ativa';
  else
   update public.stock_reservations set quantity=quantity+v_extra
    where avulso_order_id=p_order and product_id=p_product and status='ativa';
  end if;
 end if;
 if p_kind='loja' then
  select not exists(select 1 from public.store_order_items i
    left join public.stock_reservations r on r.order_id=i.order_id
      and r.product_id=i.product_id and r.status='ativa'
    where i.order_id=p_order and coalesce(r.quantity,0)<i.quantity) into v_complete;
  update public.store_orders set status=case when v_complete then 'aprovado' else 'pendente_estoque' end,
   approved_at=case when v_complete then coalesce(approved_at,now()) else null end,
   approved_by=case when v_complete then coalesce(approved_by,auth.uid()) else null end
   where id=p_order and status in ('solicitado','pendente_estoque','aprovado');
 else
  select not exists(select 1 from public.avulso_order_items i
    left join public.stock_reservations r on r.avulso_order_id=i.order_id
      and r.product_id=i.product_id and r.status='ativa'
    where i.order_id=p_order and coalesce(r.quantity,0)<i.quantity) into v_complete;
  update public.avulso_orders set fulfillment_status=case when v_complete then 'reservado' else 'pendente_estoque' end
   where id=p_order and fulfillment_status in ('pendente_estoque','reservado');
 end if;
 return v_extra;
end;$fn$;
revoke all on function app_private.reserve_unified_item(text,uuid,uuid) from public,anon,authenticated;

create or replace function app_private.reserve_unified_order(p_kind text,p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_product uuid;
begin
 if p_kind='loja' then
  perform 1 from public.store_orders where id=p_order for update;
  for v_product in select product_id from public.store_order_items where order_id=p_order order by product_id loop
   perform app_private.reserve_unified_item(p_kind,p_order,v_product);
  end loop;
 elsif p_kind='avulso' then
  perform 1 from public.avulso_orders where id=p_order for update;
  for v_product in select product_id from public.avulso_order_items where order_id=p_order order by product_id loop
   perform app_private.reserve_unified_item(p_kind,p_order,v_product);
  end loop;
 else raise exception 'Tipo inválido';end if;
end;$fn$;
revoke all on function app_private.reserve_unified_order(text,uuid) from public,anon,authenticated;
