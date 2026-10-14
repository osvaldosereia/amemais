-- Lojas e autorizacoes cumulativas; nao altera os saldos legados.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) between 2 and 30),
  name text not null check (length(btrim(name)) between 2 and 120),
  kind text not null default 'filial' check (kind in ('central','filial','franquia')),
  document text, address text, phone text, manager_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.staff_permissions (
  user_id uuid not null references public.staff_profiles(id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (user_id,permission)
);
create table if not exists public.staff_stores (
  user_id uuid not null references public.staff_profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  primary key(user_id,store_id)
);
create index if not exists staff_stores_store_idx on public.staff_stores(store_id);
create table if not exists public.store_stock (
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  quantity integer not null default 0 check(quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key(store_id,product_id)
);
-- store_stock is future-facing: existing stock_balances remain authoritative until migration of stock RPCs.
alter table public.stores enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_stores enable row level security;
alter table public.store_stock enable row level security;
create or replace function app_private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.staff_profiles p
   where p.id = (select auth.uid()) and p.active
     and (p.role = 'admin'
       or exists (select 1 from public.staff_permissions sp
                  where sp.user_id = p.id and sp.permission = p_permission)
       or (not exists (select 1 from public.staff_permissions sp where sp.user_id=p.id)
            and ((p.role='gerente' and p_permission = any(array[
              'products.read','products.create','products.edit','products.delete','stock.entry','stock.exit','stock.balance','events.manage','events.separate','orders.create','orders.read','movements.read','categories.manage','tags.manage','stores.read']))
             or (p.role='estoquista' and p_permission = any(array['products.read','products.create','products.edit','stock.balance']))
             or (p.role='consulta' and p_permission = any(array['products.read','orders.read','movements.read']))
             or (p.role='evento' and p_permission = any(array['events.separate','products.read']))))
     )
 );
$$;
revoke all on function app_private.has_permission(text) from public, anon;
grant execute on function app_private.has_permission(text) to authenticated;
create or replace function public.my_permissions()
returns table(permission text) language sql stable security definer set search_path=''
as $$
 select sp.permission from public.staff_permissions sp
 join public.staff_profiles p on p.id=sp.user_id
 where sp.user_id=(select auth.uid()) and p.active
$$;
revoke all on function public.my_permissions() from public,anon;
grant execute on function public.my_permissions() to authenticated;
create policy stores_read on public.stores for select to authenticated
 using(app_private.has_permission('stores.read') or exists(select 1 from public.staff_stores ss where ss.store_id=id and ss.user_id=(select auth.uid())));
create policy stores_insert on public.stores for insert to authenticated with check(app_private.has_permission('stores.manage'));
create policy stores_update on public.stores for update to authenticated using(app_private.has_permission('stores.manage')) with check(app_private.has_permission('stores.manage'));
create policy stores_delete on public.stores for delete to authenticated using(app_private.has_permission('stores.manage') and not exists(select 1 from public.staff_stores ss where ss.store_id=id) and not exists(select 1 from public.store_stock st where st.store_id=id));
create policy permissions_read on public.staff_permissions for select to authenticated using(user_id=(select auth.uid()) or app_private.has_permission('users.manage'));
create policy permissions_write on public.staff_permissions for insert to authenticated with check(app_private.has_permission('users.manage'));
create policy permissions_delete on public.staff_permissions for delete to authenticated using(app_private.has_permission('users.manage'));
create policy assignments_read on public.staff_stores for select to authenticated using(user_id=(select auth.uid()) or app_private.has_permission('users.manage'));
create policy assignments_insert on public.staff_stores for insert to authenticated with check(app_private.has_permission('users.manage'));
create policy assignments_delete on public.staff_stores for delete to authenticated using(app_private.has_permission('users.manage'));
create policy storestock_read on public.store_stock for select to authenticated using(app_private.has_permission('stores.manage') or exists(select 1 from public.staff_stores ss where ss.store_id=store_stock.store_id and ss.user_id=(select auth.uid())));
grant select,insert,update,delete on public.stores to authenticated;
grant select,insert,delete on public.staff_permissions,public.staff_stores to authenticated;
grant select on public.store_stock to authenticated;
-- Profiles with explicit permission rows can use multiple workflows while retaining legacy policy checks.
create or replace function app_private.role_in(variadic allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
 select 1 from public.staff_profiles p where p.id=(select auth.uid()) and p.active
   and (p.role=any(allowed)
     or (('gerente'=any(allowed) or 'admin'=any(allowed))
          and exists(select 1 from public.staff_permissions sp where sp.user_id=p.id
             and sp.permission=any(array['stock.entry','stock.exit','orders.create','events.manage','categories.manage','tags.manage']))))
 );
$$;
-- prevent misleading fake admin: app_private.role_in does not elevate to admin where only admin requested
create or replace function app_private.role_in(variadic allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.staff_profiles p where p.id=(select auth.uid()) and p.active
 and (p.role=any(allowed)
   or ('gerente'=any(allowed) and exists(select 1 from public.staff_permissions sp
       where sp.user_id=p.id and sp.permission=any(array['stock.entry','stock.exit','orders.create','events.manage','categories.manage','tags.manage'])))));
$$;
