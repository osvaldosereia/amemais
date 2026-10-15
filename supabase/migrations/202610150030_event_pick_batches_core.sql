-- Lotes físicos identificados, com até 10 modelos (variações não contam).
create table public.event_pick_batches (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 sequence integer not null check(sequence>=1),
 status text not null default 'pendente_estoque'
  check(status in ('pendente_estoque','aguardando','em_separacao','separado','enviado','cancelado')),
 note text,
 revision integer not null default 1,
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 picked_by uuid references public.staff_profiles(id),
 picked_at timestamptz,
 dispatched_by uuid references public.staff_profiles(id),
 dispatched_at timestamptz,
 unique(event_id,sequence)
);
create table public.event_pick_batch_items (
 batch_id uuid not null references public.event_pick_batches(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 1000000),
 picked integer not null default 0 check(picked>=0),
 primary key(batch_id,product_id),
 check(picked<=quantity)
);
create index event_pick_batches_status_idx on public.event_pick_batches(status,created_at);
create index event_pick_batch_items_product_idx on public.event_pick_batch_items(product_id);
alter table public.event_pick_batches enable row level security;
alter table public.event_pick_batch_items enable row level security;
revoke all on public.event_pick_batches,public.event_pick_batch_items from public,anon;
grant select on public.event_pick_batches,public.event_pick_batch_items to authenticated;
create policy event_pick_batches_read on public.event_pick_batches for select to authenticated using (
 not app_private.role_in('franquia') and
 (app_private.has_permission('orders.separate') or app_private.has_permission('events.separate')
 or app_private.has_permission('events.manage') or app_private.has_permission('events.read'))
);
create policy event_pick_batch_items_read on public.event_pick_batch_items for select to authenticated using(
 exists (select 1 from public.event_pick_batches b where b.id=batch_id)
);
alter table public.stock_reservations add column event_batch_id uuid references public.event_pick_batches(id) on delete restrict;
alter table public.stock_reservations drop constraint stock_reservations_one_parent;
alter table public.stock_reservations add constraint stock_reservations_one_parent
 check(num_nonnulls(order_id,avulso_order_id,event_batch_id)=1);
create unique index stock_reservations_event_batch_product_unique
 on public.stock_reservations(event_batch_id,product_id) where event_batch_id is not null;

create or replace function app_private.allocate_event_batch_stock(p_batch uuid)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare b public.event_pick_batches%rowtype;line record;v_physical integer;
 v_held integer;v_other integer;v_add integer;v_short boolean:=false;v_total integer:=0;
begin
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('pendente_estoque','aguardando') then return 0;end if;
 for line in select i.product_id,i.quantity from public.event_pick_batch_items i
   where i.batch_id=p_batch order by i.product_id loop
  insert into public.stock_balances(product_id,event_id,quantity)
   values(line.product_id,null,0) on conflict(product_id) where event_id is null do nothing;
  select quantity into v_physical from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select coalesce(sum(quantity),0) into v_other from public.stock_reservations
   where product_id=line.product_id and status='ativa';
  select quantity into v_held from public.stock_reservations where event_batch_id=p_batch
   and product_id=line.product_id and status='ativa' for update;
  v_held:=coalesce(v_held,0);
  v_add:=least(greatest(0,line.quantity-v_held),greatest(0,v_physical-v_other));
  if v_add>0 then
   if v_held=0 then
    insert into public.stock_reservations(event_batch_id,product_id,quantity,created_by)
      values(p_batch,line.product_id,v_add,b.created_by);
   else
    update public.stock_reservations set quantity=quantity+v_add
     where event_batch_id=p_batch and product_id=line.product_id and status='ativa';
   end if;
  end if;
  if v_held+v_add<line.quantity then v_short:=true;end if;
  v_total:=v_total+v_add;
 end loop;
 update public.event_pick_batches
  set status=case when v_short then 'pendente_estoque' else 'aguardando' end,updated_at=now()
  where id=p_batch;
 return v_total;
end;$fn$;
revoke all on function app_private.allocate_event_batch_stock(uuid) from public,anon,authenticated;

create or replace function app_private.set_event_batch_lines(p_batch uuid,p_items jsonb)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v jsonb;v_id uuid;v_qty integer;v_seen uuid[]:='{}';v_models integer;v_total integer:=0;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 150 then
   raise exception 'Inclua entre 1 e 150 variações';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object'
   or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
   or coalesce(v->>'quantity','')!~'^[1-9][0-9]{0,6}$'
  then raise exception 'Código ou quantidade inválida';end if;
  v_id:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if v_qty>1000000 or v_id=any(v_seen) then raise exception 'SKU duplicado ou quantidade excessiva';end if;
  if not exists(select 1 from public.products where id=v_id and active)
   then raise exception 'SKU inativo ou inexistente';end if;
  v_seen:=array_append(v_seen,v_id);
  v_total:=v_total+v_qty;
 end loop;
 select count(distinct coalesce(p.apparel_model_id,p.id)) into v_models
 from public.products p where p.id=any(v_seen);
 if v_models>10 then raise exception 'Cada lote admite no máximo 10 modelos de produto; tamanhos não contam como novos modelos';end if;
 delete from public.stock_reservations where event_batch_id=p_batch and status='ativa';
 delete from public.event_pick_batch_items where batch_id=p_batch;
 for v in select value from jsonb_array_elements(p_items) loop
  insert into public.event_pick_batch_items(batch_id,product_id,quantity)
   values(p_batch,(v->>'product_id')::uuid,(v->>'quantity')::integer);
 end loop;
 perform app_private.allocate_event_batch_stock(p_batch);
 return v_total;
end;$fn$;
revoke all on function app_private.set_event_batch_lines(uuid,jsonb) from public,anon,authenticated;
