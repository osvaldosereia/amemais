-- AME MAIS • Estoquista e contagem física de estoque (sem acesso aos eventos).
begin;

alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check
  check(role in ('admin','gerente','estoquista','evento','consulta'));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
  with check(app_private.role_in('admin','gerente','estoquista') and created_by=(select auth.uid()));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using(app_private.role_in('admin','gerente','estoquista'))
  with check(app_private.role_in('admin','gerente','estoquista'));

drop policy if exists balances_read on public.stock_balances;
create policy balances_read on public.stock_balances for select to authenticated
  using(
    app_private.role_in('admin','gerente','consulta')
    or (event_id is null and app_private.role_in('estoquista'))
    or (event_id is not null and app_private.event_role(event_id,'responsavel','operador'))
  );

drop policy if exists ame_photos_insert on storage.objects;
create policy ame_photos_insert on storage.objects for insert to authenticated
  with check(bucket_id='ame-produtos' and app_private.role_in('admin','gerente','estoquista'));

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  expected_quantity integer not null check(expected_quantity>=0),
  counted_quantity integer not null check(counted_quantity between 0 and 1000000),
  delta integer not null,
  actor_id uuid not null references auth.users(id),
  note text,
  movement_id uuid references public.stock_movements(id),
  created_at timestamptz not null default now(),
  check(delta=counted_quantity-expected_quantity)
);
create index stock_counts_product_time on public.stock_counts(product_id,created_at desc);
create index stock_counts_actor_time on public.stock_counts(actor_id,created_at desc);
alter table public.stock_counts enable row level security;
revoke all on public.stock_counts from public,anon,authenticated;
grant select on public.stock_counts to authenticated;
create policy stock_counts_read on public.stock_counts for select to authenticated
  using(app_private.role_in('admin','gerente') or (actor_id=(select auth.uid()) and app_private.role_in('estoquista')));
create trigger audit_stock_counts after insert on public.stock_counts
  for each row execute function app_private.audit_changes();

create function public.quick_stock_count(
  p_product_id uuid,
  p_expected integer,
  p_counted integer,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_store integer;
  v_delta integer;
  v_move uuid;
  v_result uuid;
begin
  if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Acesso negado ao balanço rápido';
  end if;
  if p_expected is null or p_expected < 0 or p_expected > 1000000
     or p_counted is null or p_counted < 0 or p_counted > 1000000 then
    raise exception 'Quantidade inválida';
  end if;
  if length(coalesce(p_note,'')) > 250 then raise exception 'Observação muito longa'; end if;
  if not exists(select 1 from public.products where id=p_product_id and active) then
    raise exception 'Produto inexistente ou inativo';
  end if;

  insert into public.stock_balances(product_id,event_id,quantity)
    values(p_product_id,null,0)
    on conflict (product_id) where event_id is null do nothing;
  select quantity into v_store from public.stock_balances
    where product_id=p_product_id and event_id is null for update;

  if v_store is distinct from p_expected then
    raise exception 'Saldo alterado por outra operação. Atualize o balanço e conte novamente';
  end if;
  v_delta := p_counted - v_store;
  if v_delta <> 0 then
    update public.stock_balances set quantity=p_counted,updated_at=now()
      where product_id=p_product_id and event_id is null;
    insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
      values(p_product_id,null,'ajuste_loja',v_delta,v_delta,0,v_actor,
        'Balanço rápido: '||v_store||' → '||p_counted||
        case when nullif(btrim(coalesce(p_note,'')),'') is not null then ' · '||btrim(p_note) else '' end)
      returning id into v_move;
  end if;
  insert into public.stock_counts(product_id,expected_quantity,counted_quantity,delta,actor_id,note,movement_id)
    values(p_product_id,v_store,p_counted,v_delta,v_actor,nullif(btrim(coalesce(p_note,'')),''),v_move)
    returning id into v_result;
  return v_result;
end;
$$;
revoke all on function public.quick_stock_count(uuid,integer,integer,text) from public,anon;
grant execute on function public.quick_stock_count(uuid,integer,integer,text) to authenticated;
commit;