begin;

create table public.event_branch_stock_reservations (
  batch_id uuid not null references public.event_pick_batches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 1000000),
  status text not null default 'ativa' check (status in ('ativa','consumida','liberada')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid,
  primary key (batch_id, product_id, store_id)
);
create index event_branch_reservations_available_idx
  on public.event_branch_stock_reservations(store_id,product_id)
  where status='ativa';

create table public.event_stock_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  source_store_id uuid references public.stores(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 1000000),
  remaining_quantity integer not null check (remaining_quantity between 0 and quantity),
  movement_id uuid references public.stock_movements(id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_stock_sources_balance_idx
  on public.event_stock_sources(event_id,product_id,created_at,id)
  where remaining_quantity > 0;
create unique index event_stock_sources_movement_unique
  on public.event_stock_sources(movement_id) where movement_id is not null;

alter table public.event_branch_stock_reservations enable row level security;
alter table public.event_stock_sources enable row level security;
revoke all on table public.event_branch_stock_reservations,public.event_stock_sources from public,anon,authenticated;
grant select on table public.event_branch_stock_reservations,public.event_stock_sources to authenticated;

create policy event_branch_stock_reservations_read
on public.event_branch_stock_reservations for select to authenticated
using (
  app_private.has_permission('events.separate')
  or app_private.has_permission('events.read')
  or app_private.has_permission('events.manage')
  or exists (
    select 1 from public.event_pick_batches b
    where b.id=batch_id
      and app_private.event_role(b.event_id,'responsavel','operador')
  )
);
create policy event_stock_sources_read
on public.event_stock_sources for select to authenticated
using (
  app_private.has_permission('events.separate')
  or app_private.has_permission('events.read')
  or app_private.has_permission('events.manage')
  or app_private.has_permission('events.close')
  or app_private.has_permission('events.return')
  or app_private.event_role(event_id,'responsavel','operador')
);

-- O saldo que já estava em consignações abertas veio do CD antes desta mudança.
insert into public.event_stock_sources(event_id,product_id,source_store_id,quantity,remaining_quantity)
select sb.event_id,sb.product_id,central.id,sb.quantity,sb.quantity
from public.stock_balances sb
cross join lateral (select id from public.stores where is_primary limit 1) central
where sb.event_id is not null and sb.quantity>0
  and not exists (
    select 1 from public.event_stock_sources s
    where s.event_id=sb.event_id and s.product_id=sb.product_id
  );

create or replace function app_private.consume_event_stock_sources(
  p_event uuid,p_product uuid,p_quantity integer
) returns void
language plpgsql security definer set search_path=''
as $function$
declare v_src record;v_left integer:=p_quantity;v_take integer;
begin
 if p_quantity is null or p_quantity<1 or p_quantity>1000000 then
  raise exception 'Quantidade de origem inválida';
 end if;
 for v_src in
  select id,remaining_quantity
  from public.event_stock_sources
  where event_id=p_event and product_id=p_product and remaining_quantity>0
  order by created_at,id for update
 loop
  exit when v_left=0;
  v_take:=least(v_left,v_src.remaining_quantity);
  update public.event_stock_sources
   set remaining_quantity=remaining_quantity-v_take
   where id=v_src.id;
  v_left:=v_left-v_take;
 end loop;
 if v_left>0 then
  raise exception 'Rastreio de origem inconsistente para produto %',p_product;
 end if;
end;$function$;

create or replace function app_private.adjust_event_stock_sources(
  p_event uuid,p_product uuid,p_delta integer
) returns void
language plpgsql security definer set search_path=''
as $function$
begin
 if p_delta>0 then
  -- Ajuste de contagem sem origem física identificada.
  insert into public.event_stock_sources(event_id,product_id,source_store_id,quantity,remaining_quantity)
  values(p_event,p_product,null,p_delta,p_delta);
 elsif p_delta<0 then
  perform app_private.consume_event_stock_sources(p_event,p_product,abs(p_delta));
 end if;
end;$function$;

create or replace function app_private.transfer_store_stock_to_event(
  p_event uuid,p_store uuid,p_product uuid,p_quantity integer,p_note text,p_batch uuid default null
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
 e public.events%rowtype;v_store public.stores%rowtype;
 v_before integer;v_reserved integer:=0;v_owned integer:=0;v_event integer;
 v_id uuid;v_reason text;v_note text;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
   or not app_private.has_permission('events.separate') then
  raise exception 'Sem permissão para separar mercadorias';
 end if;
 if p_quantity is null or p_quantity<1 or p_quantity>1000000 then
  raise exception 'Quantidade de transferência inválida';
 end if;
 select * into e from public.events where id=p_event and status='ativo' for update;
 if not found then raise exception 'Loja temporária não está ativa';end if;
 select * into v_store from public.stores where id=p_store for update;
 if not found or not v_store.active or v_store.kind<>'filial' or v_store.is_primary then
  raise exception 'A origem precisa ser uma filial ativa';
 end if;
 if not exists(select 1 from public.products where id=p_product and active) then
  raise exception 'Produto não encontrado ou inativo';
 end if;
 if p_batch is not null then
  select coalesce(sum(quantity),0) into v_owned
  from public.event_branch_stock_reservations
  where batch_id=p_batch and product_id=p_product and store_id=p_store and status='ativa';
  if v_owned<p_quantity then raise exception 'Reserva da filial inconsistente no SKU %',p_product;end if;
 end if;
 select coalesce(sum(quantity),0) into v_reserved
 from public.event_branch_stock_reservations
 where store_id=p_store and product_id=p_product and status='ativa'
   and (p_batch is null or batch_id<>p_batch);
 insert into public.store_stock(store_id,product_id,quantity)
 values(p_store,p_product,0) on conflict do nothing;
 select quantity into v_before from public.store_stock
 where store_id=p_store and product_id=p_product for update;
 if v_before-p_quantity<v_reserved then
  raise exception 'Saldo livre insuficiente na filial para o SKU %',p_product;
 end if;
 update public.store_stock set quantity=v_before-p_quantity,updated_at=now()
 where store_id=p_store and product_id=p_product;
 v_reason:=left('Envio para loja temporária: '||e.name||' · origem preservada',250);
 insert into public.store_stock_movements(
   store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id
 ) values(p_store,p_product,'saida',v_before,-p_quantity,v_before-p_quantity,v_reason,auth.uid());

 insert into public.stock_balances(product_id,event_id,quantity)
 values(p_product,p_event,0)
 on conflict(product_id,event_id) where event_id is not null do nothing;
 select quantity into v_event from public.stock_balances
 where product_id=p_product and event_id=p_event for update;
 update public.stock_balances set quantity=v_event+p_quantity,updated_at=now()
 where product_id=p_product and event_id=p_event;
 v_note:=left('Origem: '||v_store.name||case when nullif(btrim(coalesce(p_note,'')),'') is null
  then '' else ' · '||btrim(p_note) end,250);
 insert into public.stock_movements(
   product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note
 ) values(p_product,p_event,'transferencia',p_quantity,0,p_quantity,auth.uid(),v_note)
 returning id into v_id;
 insert into public.event_stock_sources(
  event_id,product_id,source_store_id,quantity,remaining_quantity,movement_id
 ) values(p_event,p_product,p_store,p_quantity,p_quantity,v_id);
 return v_id;
end;$function$;

create or replace function app_private.return_event_stock_by_source(
  p_event uuid,p_product uuid,p_quantity integer,p_note text
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
 e public.events%rowtype;v_src record;v_store public.stores%rowtype;
 v_primary uuid;v_event integer;v_before integer;v_left integer:=p_quantity;
 v_take integer;v_id uuid;v_first uuid;v_target uuid;v_delta_store integer;
 v_stock_reason text;v_movement_note text;
begin
 if auth.uid() is null or not app_private.has_permission('events.return')
   or not (app_private.role_in('admin','gerente') or app_private.event_role(p_event,'responsavel')) then
  raise exception 'Sem autorização para devolver mercadorias';
 end if;
 if p_quantity is null or p_quantity<1 or p_quantity>1000000 then
  raise exception 'Quantidade de devolução inválida';
 end if;
 select * into e from public.events where id=p_event and status='ativo' for update;
 if not found then raise exception 'Evento não está ativo';end if;
 select id into v_primary from public.stores where is_primary limit 1;
 if v_primary is null then raise exception 'CD principal não encontrado';end if;
 select quantity into v_event from public.stock_balances
 where product_id=p_product and event_id=p_event for update;
 if v_event is null or v_event<p_quantity then raise exception 'Estoque insuficiente na loja temporária';end if;
 if (select coalesce(sum(remaining_quantity),0) from public.event_stock_sources
     where event_id=p_event and product_id=p_product)<p_quantity then
  raise exception 'Origem do produto não conciliada; não é possível devolver';
 end if;
 for v_src in
  select id,source_store_id,remaining_quantity
  from public.event_stock_sources
  where event_id=p_event and product_id=p_product and remaining_quantity>0
  order by created_at desc,id desc for update
 loop
  exit when v_left=0;
  v_take:=least(v_left,v_src.remaining_quantity);
  v_target:=coalesce(v_src.source_store_id,v_primary);
  select * into v_store from public.stores where id=v_target for update;
  if not found then raise exception 'Loja de origem do produto não encontrada';end if;
  v_delta_store:=0;
  if v_store.is_primary then
   insert into public.stock_balances(product_id,event_id,quantity)
   values(p_product,null,0)
   on conflict(product_id) where event_id is null do nothing;
   select quantity into v_before from public.stock_balances
   where product_id=p_product and event_id is null for update;
   update public.stock_balances set quantity=v_before+v_take,updated_at=now()
   where product_id=p_product and event_id is null;
   v_delta_store:=v_take;
   v_movement_note:=left('Retorno à origem CD · '||coalesce(nullif(btrim(p_note),''),e.name),250);
  else
   if v_store.kind<>'filial' then
    raise exception 'A loja de origem não aceita saldo físico de filial';
   end if;
   insert into public.store_stock(store_id,product_id,quantity)
   values(v_target,p_product,0) on conflict do nothing;
   select quantity into v_before from public.store_stock
   where store_id=v_target and product_id=p_product for update;
   update public.store_stock set quantity=v_before+v_take,updated_at=now()
   where store_id=v_target and product_id=p_product;
   v_stock_reason:=left('Retorno de loja temporária '||e.name||' · origem preservada',250);
   insert into public.store_stock_movements(
    store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id
   ) values(v_target,p_product,'entrada',v_before,v_take,v_before+v_take,v_stock_reason,auth.uid());
   v_movement_note:=left('Retorno à origem '||v_store.name||' · '||coalesce(nullif(btrim(p_note),''),e.name),250);
  end if;
  insert into public.stock_movements(
   product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note
  ) values(p_product,p_event,'devolucao',v_take,v_delta_store,-v_take,auth.uid(),v_movement_note)
  returning id into v_id;
  if v_first is null then v_first:=v_id;end if;
  update public.event_stock_sources set remaining_quantity=remaining_quantity-v_take
  where id=v_src.id;
  v_left:=v_left-v_take;
 end loop;
 if v_left>0 then raise exception 'Origem do produto insuficiente para devolver';end if;
 update public.stock_balances set quantity=v_event-p_quantity,updated_at=now()
 where product_id=p_product and event_id=p_event;
 return v_first;
end;$function$;

create or replace function app_private.allocate_event_batch_stock(p_batch uuid)
 returns integer
 language plpgsql security definer set search_path=''
as $function$
declare
 b public.event_pick_batches%rowtype;line record;
 v_central integer;v_central_held integer;v_central_other integer;v_central_add integer;
 v_branch_store uuid;v_branch integer;v_branch_held integer;v_branch_other integer;
 v_branch_need integer;v_branch_add integer;v_short boolean:=false;v_total integer:=0;
begin
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('pendente_estoque','aguardando') then return 0;end if;
 select id into v_branch_store from public.stores
 where active and kind='filial' and not is_primary and name ilike '%cristo rei%'
 order by name,id limit 1;
 for line in select product_id,quantity from public.event_pick_batch_items
  where batch_id=p_batch order by product_id loop
  insert into public.stock_balances(product_id,event_id,quantity)
  values(line.product_id,null,0)
  on conflict(product_id) where event_id is null do nothing;
  select quantity into v_central from public.stock_balances
  where product_id=line.product_id and event_id is null for update;
  select coalesce(sum(quantity) filter(where event_batch_id=p_batch),0),
         coalesce(sum(quantity) filter(where event_batch_id is distinct from p_batch),0)
   into v_central_held,v_central_other
  from public.stock_reservations
  where product_id=line.product_id and status='ativa';
  v_central_add:=least(greatest(0,line.quantity-v_central_held),
    greatest(0,v_central-v_central_held-v_central_other));
  if v_central_add>0 then
   if v_central_held=0 then
    insert into public.stock_reservations(event_batch_id,product_id,quantity,created_by)
    values(p_batch,line.product_id,v_central_add,b.created_by);
   else
    update public.stock_reservations set quantity=quantity+v_central_add
    where event_batch_id=p_batch and product_id=line.product_id and status='ativa';
   end if;
   v_central_held:=v_central_held+v_central_add;
  end if;

  update public.event_branch_stock_reservations
   set status='liberada',ended_at=now(),ended_by=auth.uid()
   where batch_id=p_batch and product_id=line.product_id and status='ativa'
     and (v_branch_store is null or store_id<>v_branch_store);
  v_branch_held:=0;
  if v_branch_store is not null then
   select quantity into v_branch_held from public.event_branch_stock_reservations
    where batch_id=p_batch and product_id=line.product_id and store_id=v_branch_store
      and status='ativa' for update;
   v_branch_held:=coalesce(v_branch_held,0);
   v_branch_need:=greatest(0,line.quantity-v_central_held);
   if v_branch_held>v_branch_need then
    if v_branch_need=0 then
     update public.event_branch_stock_reservations
      set status='liberada',ended_at=now(),ended_by=auth.uid()
      where batch_id=p_batch and product_id=line.product_id and store_id=v_branch_store and status='ativa';
    else
     update public.event_branch_stock_reservations set quantity=v_branch_need
      where batch_id=p_batch and product_id=line.product_id and store_id=v_branch_store and status='ativa';
    end if;
    v_branch_held:=v_branch_need;
   end if;
   if v_branch_need>0 then
    insert into public.store_stock(store_id,product_id,quantity)
    values(v_branch_store,line.product_id,0) on conflict do nothing;
    select quantity into v_branch from public.store_stock
    where store_id=v_branch_store and product_id=line.product_id for update;
    select coalesce(sum(quantity) filter(where batch_id<>p_batch),0)
    into v_branch_other from public.event_branch_stock_reservations
    where store_id=v_branch_store and product_id=line.product_id and status='ativa';
    v_branch_add:=least(greatest(0,v_branch_need-v_branch_held),
      greatest(0,v_branch-v_branch_held-v_branch_other));
    if v_branch_add>0 then
     insert into public.event_branch_stock_reservations(batch_id,product_id,store_id,quantity,status)
     values(p_batch,line.product_id,v_branch_store,v_branch_held+v_branch_add,'ativa')
     on conflict(batch_id,product_id,store_id) do update
      set quantity=excluded.quantity,status='ativa',ended_at=null,ended_by=null;
     v_branch_held:=v_branch_held+v_branch_add;
    end if;
   end if;
  end if;
  if v_central_held+v_branch_held<line.quantity then v_short:=true;end if;
  v_total:=v_total+v_central_held+v_branch_held;
 end loop;
 update public.event_pick_batches
  set status=case when v_short then 'pendente_estoque' else 'aguardando' end,updated_at=now()
  where id=p_batch;
 return v_total;
end;$function$;

create or replace function app_private.allocate_pending_event_batches_on_branch_restock()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_batch uuid;
begin
 if tg_op='INSERT' and new.quantity<=0 then return new;end if;
 if tg_op='UPDATE' and new.quantity<=old.quantity then return new;end if;
 if not exists(select 1 from public.stores where id=new.store_id and kind='filial'
   and active and not is_primary and name ilike '%cristo rei%') then return new;end if;
 for v_batch in
  select distinct b.id
  from public.event_pick_batches b
  join public.event_pick_batch_items i on i.batch_id=b.id
  join public.events e on e.id=b.event_id
  where i.product_id=new.product_id and b.status='pendente_estoque'
    and e.status in ('rascunho','ativo')
  order by b.id
 loop
  perform app_private.allocate_event_batch_stock(v_batch);
 end loop;
 return new;
end;$function$;

drop trigger if exists store_stock_allocate_event_batches on public.store_stock;
create trigger store_stock_allocate_event_batches
after insert or update of quantity on public.store_stock
for each row execute function app_private.allocate_pending_event_batches_on_branch_restock();

create or replace function public.transfer_event_batch(
 p_event_id uuid,p_items jsonb,p_note text default null
) returns integer
language plpgsql security definer set search_path=''
as $function$
declare
 v_item jsonb;v_id uuid;v_quantity integer;v_total integer:=0;
 v_seen uuid[]:='{}';v_primary uuid;v_branch_store uuid;v_branch_name text;
 v_central integer;v_central_held integer;v_branch integer;v_branch_held integer;
 v_take_central integer;v_take_branch integer;v_note text;
begin
 if not app_private.role_in('admin','gerente') then
  raise exception 'Apenas administradores e gerentes podem separar mercadorias';
 end if;
 if not app_private.has_permission('events.separate') then raise exception 'Sem permissão';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 150 then
  raise exception 'Informe entre 1 e 150 variações para transferir';
 end if;
 if length(coalesce(p_note,''))>250 then raise exception 'Observação muito longa';end if;
 perform 1 from public.events where id=p_event_id and status='ativo' for update;
 if not found then raise exception 'Evento não está ativo';end if;
 select id into v_primary from public.stores where is_primary limit 1;
 select id,name into v_branch_store,v_branch_name from public.stores
 where active and kind='filial' and not is_primary and name ilike '%cristo rei%'
 order by name,id limit 1;
 if v_primary is null then raise exception 'CD principal não encontrado';end if;
 for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
  if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
  then raise exception 'Produto inválido';end if;
  v_id:=(v_item->>'product_id')::uuid;
  if v_id=any(v_seen) then raise exception 'Produto repetido na separação';end if;
  v_seen:=array_append(v_seen,v_id);
  if coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,6}$' then
   raise exception 'Quantidade de transferência inválida';
  end if;
  v_quantity:=(v_item->>'quantity')::integer;
  if v_quantity>1000000 then raise exception 'Quantidade excessiva';end if;
  if not exists(select 1 from public.products where id=v_id and active) then
   raise exception 'Produto não encontrado ou inativo';
  end if;

  insert into public.stock_balances(product_id,event_id,quantity)
   values(v_id,null,0) on conflict(product_id) where event_id is null do nothing;
  select quantity into v_central from public.stock_balances
   where product_id=v_id and event_id is null for update;
  select coalesce(sum(quantity),0) into v_central_held from public.stock_reservations
   where product_id=v_id and status='ativa';
  v_take_central:=least(v_quantity,greatest(0,v_central-v_central_held));
  v_take_branch:=v_quantity-v_take_central;
  if v_take_branch>0 and v_branch_store is not null then
   insert into public.store_stock(store_id,product_id,quantity)
    values(v_branch_store,v_id,0) on conflict do nothing;
   select quantity into v_branch from public.store_stock
    where store_id=v_branch_store and product_id=v_id for update;
   select coalesce(sum(quantity),0) into v_branch_held from public.event_branch_stock_reservations
    where store_id=v_branch_store and product_id=v_id and status='ativa';
   v_take_branch:=least(v_take_branch,greatest(0,v_branch-v_branch_held));
  else
   v_take_branch:=0;
  end if;
  if v_take_central+v_take_branch<>v_quantity then
   raise exception 'Estoque insuficiente no CD e na loja Cristo Rei para o SKU %',v_id;
  end if;
  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_take_central>0 then
   perform public.move_stock(v_id,'transferencia',v_take_central,p_event_id,
    left('Origem: CD'||case when v_note is null then '' else ' · '||v_note end,250));
  end if;
  if v_take_branch>0 then
   perform app_private.transfer_store_stock_to_event(
    p_event_id,v_branch_store,v_id,v_take_branch,v_note,null
   );
  end if;
  v_total:=v_total+v_quantity;
 end loop;
 return v_total;
end;$function$;

create or replace function public.dispatch_event_pick_batch(p_batch uuid)
returns integer language plpgsql security definer set search_path=''
as $function$
declare
 b public.event_pick_batches%rowtype;e public.events%rowtype;
 line record;v_item jsonb;v_src jsonb;v_items jsonb:='[]'::jsonb;v_sources jsonb;
 v_total integer:=0;v_primary uuid;v_central integer;v_central_other integer;
 v_central_physical integer;v_branch uuid;v_branch_quantity integer;
 v_branch_other integer;v_branch_physical integer;v_branch_count integer;
 v_store public.stores%rowtype;v_kind text;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
  or not app_private.has_permission('events.separate') then
  raise exception 'Sem permissão para confirmar saída física';
 end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status<>'separado' then raise exception 'Lote ainda não conferido ou já enviado';end if;
 perform public.assert_order_final_verification('evento',p_batch);
 select * into e from public.events where id=b.event_id for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local encerrado';end if;
 select id into v_primary from public.stores where is_primary limit 1;
 if v_primary is null then raise exception 'CD principal não encontrado';end if;
 for line in select product_id,quantity,picked from public.event_pick_batch_items
  where batch_id=p_batch order by product_id loop
  if line.picked<>line.quantity then raise exception 'Lote com conferência incompleta';end if;
  insert into public.stock_balances(product_id,event_id,quantity)
   values(line.product_id,null,0) on conflict(product_id) where event_id is null do nothing;
  select quantity into v_central_physical from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select coalesce(sum(quantity),0) into v_central from public.stock_reservations
   where product_id=line.product_id and event_batch_id=p_batch and status='ativa';
  select coalesce(sum(quantity),0) into v_central_other from public.stock_reservations
   where product_id=line.product_id and event_batch_id is distinct from p_batch and status='ativa';
  if v_central_physical<v_central+v_central_other then
   raise exception 'Estoque central ou reservas inconsistentes no SKU %',line.product_id;
  end if;
  select count(distinct store_id) into v_branch_count
   from public.event_branch_stock_reservations
   where batch_id=p_batch and product_id=line.product_id and status='ativa';
  if v_branch_count>1 then raise exception 'Mais de uma origem de filial reservada no SKU %',line.product_id;end if;
  select store_id,quantity into v_branch,v_branch_quantity
   from public.event_branch_stock_reservations
   where batch_id=p_batch and product_id=line.product_id and status='ativa'
   order by store_id limit 1 for update;
  v_branch_quantity:=coalesce(v_branch_quantity,0);
  if v_branch_quantity>0 then
   insert into public.store_stock(store_id,product_id,quantity)
    values(v_branch,line.product_id,0) on conflict do nothing;
   select quantity into v_branch_physical from public.store_stock
    where store_id=v_branch and product_id=line.product_id for update;
   select coalesce(sum(quantity),0) into v_branch_other
    from public.event_branch_stock_reservations
    where store_id=v_branch and product_id=line.product_id
      and batch_id<>p_batch and status='ativa';
   if v_branch_physical<v_branch_quantity+v_branch_other then
    raise exception 'Saldo reservado da filial inconsistente no SKU %',line.product_id;
   end if;
  else
   v_branch:=null;v_branch_physical:=0;v_branch_other:=0;
  end if;
  if v_central+v_branch_quantity<>line.quantity then
   raise exception 'Reserva de origem incompleta no SKU %',line.product_id;
  end if;
  v_sources:='[]'::jsonb;
  if v_central>0 then
   v_sources:=v_sources||jsonb_build_array(jsonb_build_object('store_id',v_primary,'quantity',v_central));
  end if;
  if v_branch_quantity>0 then
   v_sources:=v_sources||jsonb_build_array(jsonb_build_object('store_id',v_branch,'quantity',v_branch_quantity));
  end if;
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
   'product_id',line.product_id,'quantity',line.quantity,'sources',v_sources
  ));
 end loop;
 v_kind:=case when e.status='rascunho' then 'inicial' else 'complemento' end;
 if e.status='rascunho' then perform public.activate_event(e.id);end if;
 for v_item in select value from jsonb_array_elements(v_items) loop
  for v_src in select value from jsonb_array_elements(v_item->'sources') loop
   v_branch:=(v_src->>'store_id')::uuid;
   v_branch_quantity:=(v_src->>'quantity')::integer;
   if v_branch=v_primary then
    perform public.move_stock((v_item->>'product_id')::uuid,'transferencia',v_branch_quantity,e.id,
     left('Origem: CD · Lote '||b.sequence||' / '||b.id::text,250));
   else
    perform app_private.transfer_store_stock_to_event(
     e.id,v_branch,(v_item->>'product_id')::uuid,v_branch_quantity,
     'Lote '||b.sequence||' / '||b.id::text,p_batch
    );
   end if;
  end loop;
  v_total:=v_total+(v_item->>'quantity')::integer;
 end loop;
 update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
  where event_batch_id=p_batch and status='ativa';
 update public.event_branch_stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
  where batch_id=p_batch and status='ativa';
 insert into public.event_shipments(event_id,shipment_kind,items,created_by)
 values(e.id,v_kind,v_items,auth.uid());
 update public.event_pick_batches set status='enviado',dispatched_by=auth.uid(),
  dispatched_at=now(),updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',e.id::text,'EVENT_BATCH_DISPATCHED',auth.uid(),
  jsonb_build_object('batch',p_batch,'sequence',b.sequence,'units',v_total,
   'shipment_kind',v_kind,'sources',v_items));
 return v_total;
end;$function$;

CREATE OR REPLACE FUNCTION app_private.set_event_batch_lines(p_batch uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;v_id uuid;v_qty integer;v_seen uuid[]:='{}';v_total integer:=0;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 5000 then
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
 update public.event_branch_stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
  where batch_id=p_batch and status='ativa';
 delete from public.stock_reservations where event_batch_id=p_batch and status='ativa';
 delete from public.event_pick_batch_items where batch_id=p_batch;
 for v in select value from jsonb_array_elements(p_items) loop
  insert into public.event_pick_batch_items(batch_id,product_id,quantity)
   values(p_batch,(v->>'product_id')::uuid,(v->>'quantity')::integer);
 end loop;
 perform app_private.allocate_event_batch_stock(p_batch);
 return v_total;
end;$function$;

CREATE OR REPLACE FUNCTION public.cancel_event_pick_batch(p_batch uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.event_pick_batches%rowtype;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate') then raise exception 'Sem permissão';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('pendente_estoque','aguardando','em_separacao','separado')
 then raise exception 'Lote já enviado ou cancelado';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justifique o cancelamento';end if;
 update public.stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
 where event_batch_id=p_batch and status='ativa';
 update public.event_branch_stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
 where batch_id=p_batch and status='ativa';
 update public.event_pick_batches set status='cancelado',updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',b.event_id::text,'EVENT_BATCH_CANCELED',auth.uid(),
 jsonb_build_object('batch',p_batch,'reason',p_reason));
end;$function$;

CREATE OR REPLACE FUNCTION public.move_stock(p_product_id uuid, p_action text, p_quantity integer, p_event_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_event_status text;
  v_store integer;
  v_event integer := 0;
  v_ds integer := 0;
  v_de integer := 0;
  v_id uuid;
begin
  if v_actor is null or not app_private.is_active() then raise exception 'Acesso negado'; end if;
  if p_quantity is null or p_quantity = 0 or abs(p_quantity::bigint) > 1000000 then raise exception 'Quantidade inválida'; end if;
  if p_action not in ('entrada','venda_loja','transferencia','venda_evento','devolucao','ajuste_loja') then raise exception 'Operação inválida'; end if;
  if not exists (select 1 from public.products where id = p_product_id and (active or p_action in ('devolucao','venda_evento'))) then raise exception 'Produto não encontrado ou inativo'; end if;

  if p_action in ('transferencia','venda_evento','devolucao') then
    if p_event_id is null then raise exception 'Selecione um evento'; end if;
    select status into v_event_status from public.events where id=p_event_id for update;
    if v_event_status is distinct from 'ativo' then raise exception 'Evento não está ativo'; end if;
  elsif p_event_id is not null then raise exception 'Esta operação é exclusiva da loja'; end if;

  if p_action in ('entrada','venda_loja','transferencia','ajuste_loja') then
    if not app_private.role_in('admin','gerente') then raise exception 'Somente administração pode movimentar estoque da loja'; end if;
  elsif p_action = 'devolucao' then
    if not (app_private.role_in('admin','gerente') or app_private.event_role(p_event_id,'responsavel')) then
      raise exception 'Somente responsáveis podem devolver'; end if;
  else
    if not (app_private.role_in('admin','gerente') or app_private.event_role(p_event_id,'responsavel','operador')) then
      raise exception 'Usuário não está vinculado ao evento'; end if;
  end if;

  if p_action='devolucao' then
    return app_private.return_event_stock_by_source(p_event_id,p_product_id,p_quantity,p_note);
  end if;

  -- Cria saldos ausentes e bloqueia SEMPRE primeiro a loja, depois o evento.
  insert into public.stock_balances(product_id,event_id,quantity)
    values(p_product_id,null,0)
    on conflict (product_id) where event_id is null do nothing;
  select quantity into v_store from public.stock_balances
    where product_id=p_product_id and event_id is null for update;
  if p_event_id is not null then
    insert into public.stock_balances(product_id,event_id,quantity)
      values(p_product_id,p_event_id,0)
      on conflict (product_id,event_id) where event_id is not null do nothing;
    select quantity into v_event from public.stock_balances
      where product_id=p_product_id and event_id=p_event_id for update;
  end if;

  case p_action
    when 'entrada' then if p_quantity < 0 then raise exception 'Quantidade deve ser positiva'; end if; v_ds:=p_quantity;
    when 'venda_loja' then if p_quantity < 0 then raise exception 'Quantidade deve ser positiva'; end if; v_ds:=-p_quantity;
    when 'transferencia' then if p_quantity < 0 then raise exception 'Quantidade deve ser positiva'; end if; v_ds:=-p_quantity; v_de:=p_quantity;
    when 'venda_evento' then if p_quantity < 0 then raise exception 'Quantidade deve ser positiva'; end if; v_de:=-p_quantity;
    when 'devolucao' then if p_quantity < 0 then raise exception 'Quantidade deve ser positiva'; end if; v_ds:=p_quantity; v_de:=-p_quantity;
    when 'ajuste_loja' then
      if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Ajuste exige justificativa'; end if;
      v_ds:=p_quantity;
  end case;

  if v_store + v_ds < 0 or v_event + v_de < 0 then raise exception 'Estoque insuficiente'; end if;
  update public.stock_balances set quantity=v_store+v_ds,updated_at=now()
    where product_id=p_product_id and event_id is null;
  if p_event_id is not null then
    update public.stock_balances set quantity=v_event+v_de,updated_at=now()
      where product_id=p_product_id and event_id=p_event_id;
  end if;
  insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
  values(p_product_id,p_event_id,p_action,p_quantity,v_ds,v_de,v_actor,nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
  if p_action='transferencia' then
    insert into public.event_stock_sources(event_id,product_id,source_store_id,quantity,remaining_quantity,movement_id)
    values(p_event_id,p_product_id,(select id from public.stores where is_primary limit 1),p_quantity,p_quantity,v_id);
  elsif p_action='venda_evento' then
    perform app_private.consume_event_stock_sources(p_event_id,p_product_id,p_quantity);
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.record_event_loss(p_event_id uuid, p_product_id uuid, p_quantity integer, p_reason text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event public.events%rowtype;v_balance integer;v_note text;
begin
 if not app_private.has_permission('events.close') or
   not(app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel'))
 then raise exception 'Sem autorizacao para registrar perdas da loja temporaria';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000
 then raise exception 'Quantidade invalida';end if;
 if p_reason not in ('perda','avaria','consumo','outro')
 then raise exception 'Classifique o motivo';end if;
 v_note:=btrim(coalesce(p_note,''));
 if length(v_note) not between 5 and 250
 then raise exception 'Justificativa obrigatoria entre 5 e 250 caracteres';end if;
 select * into v_event from public.events where id=p_event_id for update;
 if not found or v_event.status<>'ativo' then raise exception 'Loja temporaria nao esta ativa';end if;
 select quantity into v_balance from public.stock_balances
   where product_id=p_product_id and event_id=p_event_id for update;
 if v_balance is null or v_balance<p_quantity
 then raise exception 'Saldo da loja temporaria insuficiente';end if;
 perform app_private.consume_event_stock_sources(p_event_id,p_product_id,p_quantity);
 update public.stock_balances set quantity=quantity-p_quantity,updated_at=now()
  where product_id=p_product_id and event_id=p_event_id;
 insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
 values(p_product_id,p_event_id,'baixa_evento',p_quantity,0,-p_quantity,auth.uid(),
  upper(p_reason)||': '||v_note);
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event_id::text,'LOSS_RECORDED',auth.uid(),
  jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'reason',p_reason,'note',v_note));
end;$function$;

CREATE OR REPLACE FUNCTION public.inventory_finalize(p_session uuid, p_approve boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.inventory_sessions%rowtype;i record;v_current integer;v_reserved integer;v_delta integer;
begin
 select * into s from public.inventory_sessions where id=p_session for update;
 if not found or s.status<>'revisao' then raise exception 'Sessão não está em revisão';end if;
 if not ((s.location_type='central' and app_private.has_permission('stock.balance')) or(s.location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(s.location_id)) or(s.location_type='temporaria' and app_private.has_permission('events.manage'))) then raise exception 'Sem autorização';end if;
 if p_approve is null then raise exception 'Decisão obrigatória';end if;
 if p_approve and exists(select 1 from public.inventory_session_items where session_id=p_session and counted_quantity<>expected_quantity) and length(btrim(coalesce(p_note,''))) not between 5 and 250 then raise exception 'Justificativa obrigatória';end if;
 if p_approve then
  for i in select * from public.inventory_session_items where session_id=p_session order by product_id loop
   if s.location_type='filial' then
    insert into public.store_stock(store_id,product_id,quantity) values(s.location_id,i.product_id,0) on conflict do nothing;
    select quantity into v_current from public.store_stock where store_id=s.location_id and product_id=i.product_id for update;
   else
    insert into public.stock_balances(product_id,event_id,quantity) values(i.product_id,s.location_id,0) on conflict do nothing;
    select quantity into v_current from public.stock_balances where product_id=i.product_id and event_id is not distinct from s.location_id for update;
   end if;
   if v_current is distinct from i.expected_quantity then raise exception 'Saldo mudou durante inventário; abra nova sessão';end if;
   if s.location_type='filial' then
    select coalesce(sum(quantity),0) into v_reserved from public.event_branch_stock_reservations
     where store_id=s.location_id and product_id=i.product_id and status='ativa';
    if i.counted_quantity<v_reserved then raise exception 'Contagem inferior às reservas para lojas temporárias do SKU %',i.product_id;end if;
   end if;
   if s.location_type='central' then
    select coalesce(sum(quantity),0) into v_reserved from public.stock_reservations where product_id=i.product_id and status='ativa';
    if i.counted_quantity<v_reserved then raise exception 'Contagem inferior às reservas do SKU %',i.product_id;end if;
   end if;
   v_delta:=i.counted_quantity-v_current;
   if v_delta<>0 then
    if s.location_type='filial' then
     update public.store_stock set quantity=i.counted_quantity,updated_at=now() where store_id=s.location_id and product_id=i.product_id;
     insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id) values(s.location_id,i.product_id,'ajuste',v_current,v_delta,i.counted_quantity,'Inventário '||p_session::text,auth.uid());
    elsif s.location_type='central' then
     update public.stock_balances set quantity=i.counted_quantity,updated_at=now() where product_id=i.product_id and event_id is null;
     insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note) values(i.product_id,null,'ajuste_loja',v_delta,v_delta,0,auth.uid(),'Inventário '||p_session::text);
    else
     -- Ajustes em consignação não devem simular transferências da central.
     update public.stock_balances set quantity=i.counted_quantity,updated_at=now() where product_id=i.product_id and event_id=s.location_id;
     perform app_private.adjust_event_stock_sources(s.location_id,i.product_id,v_delta);
     insert into public.audit_log(entity,entity_id,action,actor_id,details) values('inventory_sessions',p_session::text,'TEMPORARY_VARIANCE',auth.uid(),jsonb_build_object('product_id',i.product_id,'delta',v_delta,'before',v_current,'after',i.counted_quantity));
    end if;
   end if;
  end loop;
 end if;
 update public.inventory_sessions set status=case when p_approve then 'aplicada' else 'cancelada' end,reviewed_by=auth.uid(),reviewed_at=now(),note=nullif(btrim(coalesce(p_note,'')),'') where id=p_session;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values('inventory_sessions',p_session::text,case when p_approve then 'APPLIED' else 'REJECTED' end,auth.uid(),jsonb_build_object('note',p_note));
end $function$;

CREATE OR REPLACE FUNCTION public.record_branch_stock_movement(p_store uuid, p_product uuid, p_operation text, p_quantity integer, p_expected integer, p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_store public.stores%rowtype;v_before integer;v_after integer;v_delta integer;v_reserved integer;
begin
 if auth.uid() is null or not app_private.has_permission('stores.manage') and
    not app_private.has_permission('orders.receive')
 then raise exception 'Sem permissao para movimentar estoque da filial';end if;
 if not app_private.can_access_store(p_store) then raise exception 'Sem acesso a filial';end if;
 select * into v_store from public.stores where id=p_store for update;
 if not found or not v_store.active or v_store.kind<>'filial' or v_store.is_primary
 then raise exception 'A operacao exige filial propria ativa';end if;
 if p_operation not in ('saida','ajuste') then raise exception 'Operacao nao permitida';end if;
 if p_quantity is null or p_quantity<0 or p_quantity>1000000 or
    (p_operation='saida' and p_quantity=0) then raise exception 'Quantidade invalida';end if;
 if p_expected is null or p_expected<0 then raise exception 'Informe o saldo esperado';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justificativa obrigatoria';end if;
 if not exists(select 1 from public.products where id=p_product) then raise exception 'Produto inexistente';end if;
 insert into public.store_stock(store_id,product_id,quantity) values(p_store,p_product,0) on conflict do nothing;
 select quantity into v_before from public.store_stock where store_id=p_store and product_id=p_product for update;
 if v_before<>p_expected then raise exception 'Saldo alterado por outra operacao. Atualize antes de salvar';end if;
 v_after:=case when p_operation='saida' then v_before-p_quantity else p_quantity end;
 if v_after<0 then raise exception 'Estoque insuficiente na filial';end if;
 select coalesce(sum(quantity),0) into v_reserved from public.event_branch_stock_reservations
  where store_id=p_store and product_id=p_product and status='ativa';
 if v_after<v_reserved then raise exception 'Saldo abaixo das unidades reservadas para loja temporária (%)',v_reserved;end if;
 v_delta:=v_after-v_before;
 if v_delta=0 then raise exception 'Sem diferenca para registrar';end if;
 update public.store_stock set quantity=v_after,updated_at=now() where store_id=p_store and product_id=p_product;
 insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id)
 values(p_store,p_product,p_operation,v_before,v_delta,v_after,btrim(p_reason),auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_stock',p_store::text,case when p_operation='saida' then 'BRANCH_EXIT' else 'BRANCH_COUNT' end,
 auth.uid(),jsonb_build_object('product_id',p_product,'before',v_before,'after',v_after,'reason',p_reason));
 return v_after;
end;$function$;

CREATE OR REPLACE FUNCTION public.dispatch_branch_return(p_store uuid, p_product uuid, p_quantity integer, p_expected integer, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_current integer;v_reserved integer;
begin
 if not app_private.has_permission('orders.receive') and not app_private.has_permission('stores.manage')
 then raise exception 'Sem permissão';end if;
 if not app_private.can_access_store(p_store) or not exists(select 1 from public.stores where id=p_store and kind='filial' and active)
 then raise exception 'Filial inválida';end if;
 if p_quantity is null or p_quantity<1 or p_quantity>1000000 or p_expected is null then raise exception 'Quantidade inválida';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Motivo obrigatório';end if;
 select quantity into v_current from public.store_stock where store_id=p_store and product_id=p_product for update;
 if v_current is distinct from p_expected then raise exception 'Saldo alterado. Atualize antes de devolver';end if;
 if v_current<p_quantity then raise exception 'Saldo insuficiente na filial';end if;
 select coalesce(sum(quantity),0) into v_reserved from public.event_branch_stock_reservations
  where store_id=p_store and product_id=p_product and status='ativa';
 if v_current-p_quantity<v_reserved then raise exception 'Unidades reservadas para loja temporária não podem ser devolvidas à central';end if;
 update public.store_stock set quantity=quantity-p_quantity,updated_at=now() where store_id=p_store and product_id=p_product;
 insert into public.branch_returns(from_store_id,product_id,quantity,reason,created_by)
 values(p_store,p_product,p_quantity,btrim(p_reason),auth.uid()) returning id into v_id;
 insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id)
 values(p_store,p_product,'saida',v_current,-p_quantity,v_current-p_quantity,'Retorno para central: '||left(btrim(p_reason),220),auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('branch_returns',v_id::text,'RETURN_DISPATCHED',auth.uid(),jsonb_build_object('store_id',p_store,'product_id',p_product,'quantity',p_quantity));
 return v_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.close_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v_pending integer;v_sent integer;v_sold integer;v_returned integer;v_loss integer;v_legacy integer;v_adjust integer;
begin
 if not app_private.has_permission('events.close') or not (app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel')) then raise exception 'Sem permissão para encerrar consignação';end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.status<>'ativo' then raise exception 'Loja temporária não está ativa';end if;
 if exists(select 1 from public.event_pick_batches
 where event_id=p_event_id and status not in ('enviado','cancelado'))
 then raise exception 'Há lotes aguardando separação ou saída. Envie ou cancele todos antes de encerrar';end if;
 if exists(select 1 from public.inventory_sessions where location_type='temporaria' and location_id=p_event_id and status in ('aberta','revisao')) then
   -- Uma conferência de encerramento autorizada substitui a contagem antiga, não a executa.
   update public.inventory_sessions set status='cancelada',reviewed_by=auth.uid(),reviewed_at=now(),
    note='Substituída pela prestação de contas da loja temporária'
   where location_type='temporaria' and location_id=p_event_id and status in ('aberta','revisao');
   insert into public.audit_log(entity,entity_id,action,actor_id,details)
   values('events',p_event_id::text,'OLD_INVENTORY_SUPERSEDED',auth.uid(),
   jsonb_build_object('reason','Fechamento com conciliação completa por SKU'));
 end if;
 select coalesce(sum(quantity),0) into v_pending from public.stock_balances where event_id=p_event_id;
 if v_pending<>0 then raise exception 'Consignação não conciliada: % unidades pendentes',v_pending;end if;
 if exists (
   select 1 from public.stock_balances sb
   where sb.event_id=p_event_id and sb.quantity<>
     coalesce((select sum(s.remaining_quantity) from public.event_stock_sources s
       where s.event_id=sb.event_id and s.product_id=sb.product_id),0)
 ) then raise exception 'Rastreio de origem da consignação não conciliado';end if;
 if exists(select 1 from public.event_stock_sources where event_id=p_event_id and remaining_quantity>0)
 then raise exception 'Há unidades de origem sem devolução ou baixa registrada';end if;
 select coalesce(sum(quantity) filter(where action='transferencia'),0),
 coalesce(sum(quantity) filter(where action='venda_evento'),0),
 coalesce(sum(quantity) filter(where action='devolucao'),0),
 coalesce(sum(quantity) filter(where action='baixa_evento' and note ~ '^(PERDA|AVARIA|CONSUMO|OUTRO): '),0),
 coalesce(sum(quantity) filter(where action='baixa_evento' and not(note ~ '^(PERDA|AVARIA|CONSUMO|OUTRO): ')),0)
 into v_sent,v_sold,v_returned,v_loss,v_legacy
 from public.stock_movements where event_id=p_event_id;
 select coalesce(sum((details->>'delta')::integer),0) into v_adjust
 from public.audit_log where entity='inventory_sessions' and action='TEMPORARY_VARIANCE' and
 entity_id in (select id::text from public.inventory_sessions where location_type='temporaria' and location_id=p_event_id);
 if v_sent-v_sold-v_returned-v_loss-v_legacy+v_adjust<>0 then raise exception 'Histórico de consignação não concilia com estoque. Revise movimentações';end if;
 insert into public.consignation_closures(event_id,sent_units,sold_units,returned_units,loss_units,legacy_unclassified_units,inventory_adjustment_units,pending_units,closed_by)
 values(p_event_id,v_sent,v_sold,v_returned,v_loss,v_legacy,v_adjust,0,auth.uid());
 update public.events set status='encerrado',closed_by=auth.uid(),closed_at=now() where id=p_event_id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values('events',p_event_id::text,'CLOSED_RECONCILED',auth.uid(),jsonb_build_object('sent',v_sent,'sold',v_sold,'returned',v_returned,'loss',v_loss,'legacy',v_legacy,'inventory_adjustments',v_adjust));
end $function$;

revoke all on function app_private.consume_event_stock_sources(uuid,uuid,integer), app_private.adjust_event_stock_sources(uuid,uuid,integer), app_private.transfer_store_stock_to_event(uuid,uuid,uuid,integer,text,uuid), app_private.return_event_stock_by_source(uuid,uuid,integer,text), app_private.allocate_event_batch_stock(uuid), app_private.allocate_pending_event_batches_on_branch_restock() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.finalize_event_settlement(p_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;d public.event_settlement_drafts%rowtype;
 v jsonb;v_id uuid;v_expected integer;v_good integer;v_sold integer;
 v_damaged integer;v_lost integer;v_count integer;v_current integer;
begin
 if auth.uid() is null or not app_private.has_permission('events.close') or not app_private.has_permission('events.manage')
 then raise exception 'Sem autorização para fechar';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Loja não está ativa';end if;
 select * into d from public.event_settlement_drafts where event_id=p_event for update;
 if not found or d.status<>'rascunho' then raise exception 'Salve a conferência primeiro';end if;
 select count(*) into v_count from public.stock_balances where event_id=p_event and quantity>0;
 if v_count<>jsonb_array_length(d.items) then raise exception 'A conferência precisa incluir todos os SKUs pendentes';end if;
 -- Valida toda a conferência antes de movimentar a primeira unidade.
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;v_expected:=(v->>'expected')::integer;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  select quantity into v_current from public.stock_balances where event_id=p_event and product_id=v_id;
  if v_current is distinct from v_expected or v_expected<>v_good+v_sold+v_damaged+v_lost
  then raise exception 'Diferença pendente ou saldo alterado no SKU %',v_id;end if;
 end loop;
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  if v_sold<>0 then raise exception 'A conferência não pode registrar vendas'; end if;
  -- Baixas consomem primeiro os lotes antigos; os produtos bons retornam às origens restantes.
  if v_lost>0 then perform public.record_event_loss(p_event,v_id,v_lost,'outro',coalesce(d.note,'Quantidade não devolvida na conferência'));end if;
  if v_damaged>0 then
   perform public.record_event_loss(p_event,v_id,v_damaged,'avaria',coalesce(d.note,'Avaria conferida'));
   insert into public.stock_damages(product_id,origin_event_id,quantity,note,created_by)
   values(v_id,p_event,v_damaged,coalesce(d.note,'Avaria informada'),auth.uid());
  end if;
  if v_good>0 then perform public.move_stock(v_id,'devolucao',v_good,p_event,'Fechamento da loja · devolução à origem registrada');end if;
 end loop;
 perform public.close_event(p_event);
 update public.event_settlement_drafts set status='concluido',finalized_by=auth.uid(),finalized_at=now()
 where event_id=p_event;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SETTLEMENT_FINALIZED',auth.uid(),
 jsonb_build_object('items',d.items,'note',d.note));
end;$function$;

commit;
