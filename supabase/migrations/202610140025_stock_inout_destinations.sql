-- AME MAIS: entrada e saída independentes, operações em lote com destino e auditoria.
-- Saída não representa venda e não cria transação de evento.
begin;

create table if not exists public.stock_destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint stock_destinations_name_length check (length(btrim(name)) between 2 and 90),
  constraint stock_destinations_note_length check (length(coalesce(description,'')) <= 250)
);
create unique index if not exists stock_destinations_active_name_unique
 on public.stock_destinations(lower(btrim(name))) where active;

create table if not exists public.stock_operation_batches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  operation text not null check(operation in ('entrada','saida')),
  destination_id uuid references public.stock_destinations(id) on delete restrict,
  note text,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint stock_batch_destination_rule check (
    (operation='entrada' and destination_id is null)
    or (operation='saida' and destination_id is not null)
  ),
  constraint stock_batch_note_length check(length(coalesce(note,''))<=400)
);
create index if not exists stock_batch_recent_idx on public.stock_operation_batches(created_at desc);
create index if not exists stock_batch_destination_idx on public.stock_operation_batches(destination_id);
alter table public.stock_movements add column if not exists operation_batch_id uuid
 references public.stock_operation_batches(id) on delete restrict;
create index if not exists stock_movements_batch_idx on public.stock_movements(operation_batch_id);

alter table public.stock_destinations enable row level security;
alter table public.stock_operation_batches enable row level security;
revoke all on public.stock_destinations,public.stock_operation_batches from anon,public;
grant select on public.stock_destinations,public.stock_operation_batches to authenticated;
create policy stock_destinations_read on public.stock_destinations for select to authenticated
 using(app_private.role_in('admin','gerente'));
create policy stock_operations_read on public.stock_operation_batches for select to authenticated
 using(app_private.role_in('admin','gerente'));

alter table public.stock_movements drop constraint if exists stock_movements_action_check;
alter table public.stock_movements add constraint stock_movements_action_check check (
 action in ('entrada','venda_loja','transferencia','venda_evento','devolucao',
            'ajuste_loja','baixa_evento','saida_loja')
);
alter table public.stock_movements drop constraint if exists movement_amount;
alter table public.stock_movements add constraint movement_amount check (
  (action='ajuste_loja' and delta_store=quantity and delta_event=0)
  or (action='entrada' and quantity>0 and delta_store=quantity and delta_event=0)
  or (action in ('venda_loja','saida_loja') and quantity>0 and delta_store=-quantity and delta_event=0)
  or (action='transferencia' and quantity>0 and delta_store=-quantity and delta_event=quantity)
  or (action='venda_evento' and quantity>0 and delta_store=0 and delta_event=-quantity)
  or (action='devolucao' and quantity>0 and delta_store=quantity and delta_event=-quantity)
  or (action='baixa_evento' and quantity>0 and delta_store=0 and delta_event=-quantity)
);

create or replace function public.save_stock_destination(
  p_name text,p_description text default null,p_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text:=btrim(coalesce(p_name,''));
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
 if length(v_name) not between 2 and 90 or length(coalesce(p_description,''))>250 then
  raise exception 'Nome ou descrição de destino inválidos';end if;
 if p_id is null then
  insert into public.stock_destinations(name,description,created_by)
   values(v_name,nullif(btrim(coalesce(p_description,'')),''),auth.uid()) returning id into v_id;
 else
  update public.stock_destinations set name=v_name,
   description=nullif(btrim(coalesce(p_description,'')),'')
   where id=p_id and active returning id into v_id;
  if v_id is null then raise exception 'Destino indisponível';end if;
 end if;
 return v_id;
end;$$;
revoke all on function public.save_stock_destination(text,text,uuid) from public,anon;
grant execute on function public.save_stock_destination(text,text,uuid) to authenticated;

create or replace function public.deactivate_stock_destination(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
 update public.stock_destinations set active=false where id=p_id and active;
 if not found then raise exception 'Destino não encontrado';end if;
 -- Se foi utilizado anteriormente, seus movimentos e sua denominação ficam preservados.
end;$$;
revoke all on function public.deactivate_stock_destination(uuid) from public,anon;
grant execute on function public.deactivate_stock_destination(uuid) to authenticated;

create or replace function public.stock_operation_batch(
 p_operation text,p_items jsonb,p_destination_id uuid default null,
 p_note text default null,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_batch uuid;v_existing record;
 v_line jsonb;v_item record;v_ids uuid[]:='{}'::uuid[];
 v_product uuid;v_expected integer;v_qty integer;v_current integer;
 v_results jsonb:='[]'::jsonb;v_total integer:=0;v_count integer:=0;
 v_delta integer;v_note text:=nullif(btrim(coalesce(p_note,'')),'');
begin
 if v_actor is null or not app_private.role_in('admin','gerente') then
  raise exception 'Somente administração pode movimentar estoque';end if;
 if p_operation not in ('entrada','saida') then raise exception 'Operação inválida';end if;
 if p_request_id is null then raise exception 'Identificador da operação obrigatório';end if;
 if length(coalesce(p_note,''))>400 then raise exception 'Observação longa demais';end if;
 if p_operation='saida' then
   if p_destination_id is null or not exists(select 1 from public.stock_destinations
       where id=p_destination_id and active) then
       raise exception 'Selecione um destino ativo para a saída';end if;
 elsif p_destination_id is not null then raise exception 'Entrada não aceita destino de saída';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
   or jsonb_array_length(p_items) not between 1 and 100 then
   raise exception 'Selecione entre 1 e 100 variações';end if;

 perform pg_catalog.pg_advisory_xact_lock(8127,hashtext(p_request_id::text));
 select id,operation,destination_id into v_existing
   from public.stock_operation_batches where request_id=p_request_id;
 if found then
   if v_existing.operation<>p_operation or
     v_existing.destination_id is distinct from p_destination_id then
     raise exception 'Identificador reutilizado para uma operação diferente';end if;
   select coalesce(jsonb_agg(jsonb_build_object(
       'product_id',m.product_id,'quantity',m.quantity,
       'new_stock',(select quantity from public.stock_balances b
                   where b.product_id=m.product_id and b.event_id is null)
       ) order by m.product_id),'[]'::jsonb) into v_results
     from public.stock_movements m where m.operation_batch_id=v_existing.id;
   return jsonb_build_object('batch_id',v_existing.id,'replayed',true,
     'items',v_results);
 end if;

 -- Validação de todas as linhas antes da gravação.
 for v_line in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_line)<>'object' or
     coalesce(v_line->>'product_id','') !~ '^[0-9a-fA-F-]{36}$' or
     coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]{0,6}$' or
     coalesce(v_line->>'expected','') !~ '^[0-9]{1,7}$' then
     raise exception 'Produto ou quantidade inválida';end if;
   v_product:=(v_line->>'product_id')::uuid;
   v_qty:=(v_line->>'quantity')::integer;
   v_expected:=(v_line->>'expected')::integer;
   if v_qty>1000000 or v_expected>1000000 or v_product=any(v_ids) then
     raise exception 'Produto repetido ou quantidade acima do limite';end if;
   if not exists(select 1 from public.products where id=v_product and active)
     then raise exception 'Produto inexistente ou inativo';end if;
   v_ids:=array_append(v_ids,v_product);
   v_total:=v_total+v_qty;v_count:=v_count+1;
   if v_total>10000000 then raise exception 'Limite total de unidades excedido';end if;
 end loop;

 insert into public.stock_operation_batches(request_id,operation,destination_id,note,actor_id)
  values(p_request_id,p_operation,p_destination_id,v_note,v_actor) returning id into v_batch;

 -- Todos os saldos são bloqueados em ordem estável para evitar deadlocks.
 for v_item in
   select (x.value->>'product_id')::uuid id,
          (x.value->>'quantity')::integer qty,
          (x.value->>'expected')::integer expected
   from jsonb_array_elements(p_items) x order by (x.value->>'product_id')::uuid
 loop
   insert into public.stock_balances(product_id,event_id,quantity)
     values(v_item.id,null,0)
     on conflict (product_id) where event_id is null do nothing;
   select quantity into v_current from public.stock_balances
    where product_id=v_item.id and event_id is null for update;
   if v_current is distinct from v_item.expected then
     raise exception 'Saldo atualizado por outro operador. Confira novamente os itens antes de salvar.';
   end if;
   v_delta:=case when p_operation='entrada' then v_item.qty else -v_item.qty end;
   if v_current+v_delta<0 then
     raise exception 'Estoque insuficiente para o produto %. Disponível: %',v_item.id,v_current;
   end if;
   update public.stock_balances set quantity=v_current+v_delta,updated_at=now()
     where product_id=v_item.id and event_id is null;
   insert into public.stock_movements(
     product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note,operation_batch_id)
   values(v_item.id,null,case when p_operation='entrada' then 'entrada' else 'saida_loja' end,
     v_item.qty,v_delta,0,v_actor,v_note,v_batch);
   v_results:=v_results||jsonb_build_array(jsonb_build_object(
     'product_id',v_item.id,'quantity',v_item.qty,'previous_stock',v_current,
     'new_stock',v_current+v_delta));
 end loop;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('stock_operation_batches',v_batch::text,p_operation,v_actor,
 jsonb_build_object('destination_id',p_destination_id,'quantity',v_total,'different_products',v_count));
 return jsonb_build_object('batch_id',v_batch,'replayed',false,
   'total',v_total,'count',v_count,'items',v_results);
end;$$;
revoke all on function public.stock_operation_batch(text,jsonb,uuid,text,uuid) from public,anon;
grant execute on function public.stock_operation_batch(text,jsonb,uuid,text,uuid) to authenticated;

commit;