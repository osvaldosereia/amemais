-- AME MAIS: unidades, permissoes cumulativas e pedidos entre lojas.
-- O saldo legado da central continua em stock_balances (event_id IS NULL).
-- Saldos de outras lojas ficam exclusivamente em store_stock.
create table if not exists public.stores (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (length(btrim(code)) between 2 and 30),
 name text not null check (length(btrim(name)) between 2 and 120),
 kind text not null default 'filial' check (kind in ('central','filial','franquia')),
 is_primary boolean not null default false,
 document text, address text, phone text, manager_name text,
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index if not exists stores_one_primary on public.stores(is_primary) where is_primary;
insert into public.stores(code,name,kind,is_primary) values('CENTRAL','Loja Central','central',true)
on conflict (code) do nothing;
create table if not exists public.permission_definitions(
 permission text primary key check(permission ~ '^[a-z_]+[.][a-z_]+$'),
 module text not null,label text not null,sort_order integer not null default 0
);
insert into public.permission_definitions(permission,module,label,sort_order) values
('products.read','Produtos','Consultar produtos',10),
('products.create','Produtos','Cadastrar produtos',11),
('products.edit','Produtos','Editar produtos',12),
('products.delete','Produtos','Excluir ou desativar produtos',13),
('stock.entry','Estoque','Registrar entradas',20),
('stock.exit','Estoque','Registrar saídas',21),
('stock.balance','Estoque','Realizar balanço e ajustes',22),
('stock.destinations','Estoque','Gerenciar destinos de saída',23),
('events.read','Eventos','Consultar eventos',30),
('events.manage','Eventos','Criar e administrar eventos',31),
('events.separate','Eventos','Separar mercadorias',32),
('events.return','Eventos','Registrar devoluções',33),
('events.sell','Eventos','Registrar baixas de eventos',34),
('events.close','Eventos','Encerrar eventos',35),
('orders.read','Pedidos','Consultar pedidos avulsos',40),
('orders.internal','Pedidos','Criar pedidos avulsos',41),
('orders.assign','Pedidos','Vincular pedidos a eventos',42),
('orders.central','Lojas','Solicitar mercadorias da central',43),
('orders.franchise','Lojas','Solicitar mercadorias para franquia',44),
('orders.separate','Lojas','Separar pedidos entre lojas',45),
('orders.receive','Lojas','Conferir recebimentos de pedidos',46),
('orders.cancel','Lojas','Cancelar solicitações',47),
('movements.read','Relatórios','Consultar movimentações',50),
('movements.export','Relatórios','Exportar relatórios',51),
('categories.manage','Cadastros','Gerenciar categorias',60),
('tags.manage','Cadastros','Gerenciar tags',61),
('catalog.manage','Catálogo','Gerenciar links de clientes',70),
('products.share','Catálogo','Compartilhar produtos',71),
('stores.read','Lojas','Consultar lojas',80),
('stores.manage','Lojas','Cadastrar e administrar lojas',81),
('users.manage','Administração','Gerenciar usuários e permissões',90)
on conflict(permission) do update set module=excluded.module,label=excluded.label,sort_order=excluded.sort_order;
create table if not exists app_private.role_permission_defaults (
 role text not null,permission text not null references public.permission_definitions(permission),
 primary key(role,permission)
);
insert into app_private.role_permission_defaults(role,permission)
select 'gerente',permission from public.permission_definitions
where permission not in ('users.manage')
union all select 'estoquista',permission from public.permission_definitions
 where permission in ('products.read','products.create','products.edit','stock.balance','products.share','stores.read')
union all select 'evento',permission from public.permission_definitions
 where permission in ('products.read','events.read','events.return','events.sell')
union all select 'consulta',permission from public.permission_definitions
 where permission in ('products.read','events.read','orders.read','movements.read','stores.read')
on conflict do nothing;
alter table public.staff_profiles add column if not exists permissions_customized boolean not null default false;
create table if not exists public.staff_permissions (
 user_id uuid not null references public.staff_profiles(id) on delete cascade,
 permission text not null references public.permission_definitions(permission),
 primary key(user_id,permission)
);
create table if not exists public.staff_stores (
 user_id uuid not null references public.staff_profiles(id) on delete cascade,
 store_id uuid not null references public.stores(id),
 primary key(user_id,store_id)
);
create index if not exists staff_stores_store_idx on public.staff_stores(store_id);
insert into public.staff_stores(user_id,store_id)
select p.id,s.id from public.staff_profiles p cross join public.stores s where s.is_primary
on conflict do nothing;
create table if not exists public.store_stock (
 store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id),
 quantity integer not null default 0 check(quantity>=0),
 updated_at timestamptz not null default now(),primary key(store_id,product_id)
);
create table if not exists public.store_orders (
 id uuid primary key default gen_random_uuid(),
 from_store_id uuid not null references public.stores(id),
 to_store_id uuid not null references public.stores(id),
 request_type text not null check (request_type in ('central','franquia')),
 status text not null default 'solicitado' check(status in ('solicitado','separado','recebido','cancelado')),
 note text, created_by uuid not null references public.staff_profiles(id),
 separated_by uuid references public.staff_profiles(id),
 received_by uuid references public.staff_profiles(id),
 canceled_by uuid references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 separated_at timestamptz,received_at timestamptz,canceled_at timestamptz,
 constraint store_orders_distinct check(from_store_id<>to_store_id)
);
create index if not exists store_orders_dates on public.store_orders(created_at desc);
create table if not exists public.store_order_items (
 order_id uuid not null references public.store_orders(id) on delete restrict,
 product_id uuid not null references public.products(id),
 quantity integer not null check(quantity between 1 and 1000000),
 primary key(order_id,product_id)
);
create table if not exists public.store_transfer_log(
 id bigint generated always as identity primary key,
 order_id uuid not null references public.store_orders(id),
 store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id),
 delta integer not null check(delta<>0),
 actor_id uuid not null references public.staff_profiles(id),
 operation text not null check(operation in ('separacao','recebimento')),
 created_at timestamptz not null default now()
);
create index if not exists store_transfer_log_order on public.store_transfer_log(order_id);
create or replace function app_private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=''
as $body$
 select exists (
   select 1 from public.staff_profiles p where p.id=(select auth.uid()) and p.active
     and (p.role='admin'
          or (p.permissions_customized and exists (
               select 1 from public.staff_permissions x where x.user_id=p.id and x.permission=p_permission))
          or (not p.permissions_customized and exists(
               select 1 from app_private.role_permission_defaults d
               where d.role=p.role and d.permission=p_permission)))
 );
$body$;
revoke all on function app_private.has_permission(text) from public,anon;
grant execute on function app_private.has_permission(text) to authenticated;
create or replace function app_private.can_access_store(p_store uuid)
returns boolean language sql stable security definer set search_path=''
as $body$
 select exists(select 1 from public.staff_profiles p where p.id=(select auth.uid()) and p.active
 and (p.role='admin' or exists (select 1 from public.staff_stores ss where ss.user_id=p.id and ss.store_id=p_store)));
$body$;
revoke all on function app_private.can_access_store(uuid) from public,anon;
grant execute on function app_private.can_access_store(uuid) to authenticated;
create or replace function public.my_permissions()
returns table(permission text) language sql stable security definer set search_path=''
as $body$
 select pd.permission from public.permission_definitions pd
 where app_private.has_permission(pd.permission) order by pd.sort_order,pd.permission;
$body$;
revoke all on function public.my_permissions() from public,anon;
grant execute on function public.my_permissions() to authenticated;
-- Authorized administration atomically changes a profile and its assigned stores.
create or replace function public.set_staff_access(
 p_user_id uuid,p_role text,p_permissions text[],p_store_ids uuid[])
returns void language plpgsql security definer set search_path=''
as $body$
declare v_perm text;v_store uuid;v_oldrole text;
begin
 if not app_private.has_permission('users.manage') or
    not exists(select 1 from public.staff_profiles p where p.id=auth.uid() and p.role='admin')
 then raise exception 'Somente administradores podem atribuir autorizações'; end if;
 if p_user_id=auth.uid() then raise exception 'Não altere suas próprias autorizações';end if;
 if p_role not in ('admin','gerente','estoquista','evento','consulta') then raise exception 'Perfil inválido';end if;
 select role into v_oldrole from public.staff_profiles where id=p_user_id for update;
 if not found then raise exception 'Funcionário não encontrado';end if;
 if coalesce(array_length(p_permissions,1),0)=0 then raise exception 'Selecione ao menos uma permissão';end if;
 for v_perm in select distinct unnest(p_permissions) loop
   if not exists(select 1 from public.permission_definitions where permission=v_perm)
     then raise exception 'Permissão desconhecida: %',v_perm;end if;
 end loop;
 for v_store in select distinct unnest(coalesce(p_store_ids,array[]::uuid[])) loop
   if not exists(select 1 from public.stores where id=v_store and active)
     then raise exception 'Loja inexistente ou inativa';end if;
 end loop;
 update public.staff_profiles set role=p_role,permissions_customized=true where id=p_user_id;
 delete from public.staff_permissions where user_id=p_user_id;
 insert into public.staff_permissions(user_id,permission)
 select p_user_id,v from (select distinct unnest(p_permissions) as v) q;
 delete from public.staff_stores where user_id=p_user_id;
 insert into public.staff_stores(user_id,store_id)
 select p_user_id,v from (select distinct unnest(coalesce(p_store_ids,array[]::uuid[])) v) q;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('staff_profiles',p_user_id::text,'PERMISSIONS_UPDATED',auth.uid(),
        jsonb_build_object('old_role',v_oldrole,'new_role',p_role,'permissions',p_permissions,'stores',p_store_ids));
end;$body$;
revoke all on function public.set_staff_access(uuid,text,text[],uuid[]) from public,anon;
grant execute on function public.set_staff_access(uuid,text,text[],uuid[]) to authenticated;
-- Audit changes to store registration.
create or replace function app_private.audit_store()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('stores',coalesce(new.id,old.id)::text,tg_op,auth.uid(),
 jsonb_build_object('code',coalesce(new.code,old.code),'name',coalesce(new.name,old.name)));
 return coalesce(new,old);
end;$body$;
drop trigger if exists stores_audit on public.stores;
create trigger stores_audit after insert or update or delete on public.stores
for each row execute function app_private.audit_store();
-- Product deactivation requires delete authorization, even if edit is available.
create or replace function app_private.protect_product_active()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 if new.active is distinct from old.active
   and not app_private.has_permission('products.delete')
 then raise exception 'Sem autorização para ativar ou desativar produtos';end if;
 return new;
end;$body$;
drop trigger if exists products_permission_active on public.products;
create trigger products_permission_active before update of active on public.products
for each row execute function app_private.protect_product_active();
-- A primary store is not physically deletable or demotable.
create or replace function app_private.protect_primary_store()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 if tg_op='DELETE' then
   if old.is_primary then raise exception 'A loja principal não pode ser excluída';end if;
   return old;
 end if;
 if old.is_primary and (not new.is_primary or not new.active) then
   raise exception 'A loja principal deve permanecer ativa';end if;
 return new;
end;$body$;
drop trigger if exists stores_primary_guard on public.stores;
create trigger stores_primary_guard before update or delete on public.stores
for each row execute function app_private.protect_primary_store();
-- Disable direct mutations of transactional tables from browser.
create or replace function app_private.reject_store_mutation()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 raise exception 'Movimentações de loja somente por operações autorizadas';
end;$body$;
drop trigger if exists store_stock_reject_direct on public.store_stock;
-- No GRANT for writes to store_stock; functions use owner rights.
alter table public.stores enable row level security;
alter table public.permission_definitions enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_stores enable row level security;
alter table public.store_stock enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_transfer_log enable row level security;
create policy stores_read on public.stores for select to authenticated
 using(app_private.has_permission('stores.read') or app_private.has_permission('stores.manage') or app_private.can_access_store(id));
create policy stores_insert on public.stores for insert to authenticated with check(app_private.has_permission('stores.manage') and not is_primary);
create policy stores_update on public.stores for update to authenticated using(app_private.has_permission('stores.manage')) with check(app_private.has_permission('stores.manage'));
create policy stores_delete on public.stores for delete to authenticated using(app_private.has_permission('stores.manage') and not is_primary);
create policy permission_definitions_read on public.permission_definitions for select to authenticated using(app_private.has_permission('users.manage'));
create policy permissions_read on public.staff_permissions for select to authenticated using(user_id=(select auth.uid()) or app_private.has_permission('users.manage'));
create policy assignments_read on public.staff_stores for select to authenticated using(user_id=(select auth.uid()) or app_private.has_permission('users.manage'));
create policy storestock_read on public.store_stock for select to authenticated
 using(app_private.can_access_store(store_id) and app_private.has_permission('products.read'));
create policy storeorders_read on public.store_orders for select to authenticated
 using(app_private.has_permission('orders.read') and
 (app_private.can_access_store(from_store_id) or app_private.can_access_store(to_store_id))
 or created_by=(select auth.uid()));
create policy orderitems_read on public.store_order_items for select to authenticated
 using(exists(select 1 from public.store_orders o where o.id=order_id));
create policy transferlog_read on public.store_transfer_log for select to authenticated
 using(exists(select 1 from public.store_orders o where o.id=order_id));
grant select,insert,update,delete on public.stores to authenticated;
grant select on public.permission_definitions,public.staff_permissions,public.staff_stores,
 public.store_stock,public.store_orders,public.store_order_items,public.store_transfer_log to authenticated;
-- Existing legacy RLS grants must be narrowed before enabling customized profiles.
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
 using(app_private.has_permission('categories.manage')) with check(app_private.has_permission('categories.manage'));
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert to authenticated with check(app_private.has_permission('tags.manage'));
drop policy if exists tags_delete on public.tags;
create policy tags_delete on public.tags for delete to authenticated using(app_private.has_permission('tags.manage'));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
 with check(app_private.has_permission('products.create') and created_by=(select auth.uid()));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
 using(app_private.has_permission('products.edit')) with check(app_private.has_permission('products.edit'));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
 with check(app_private.has_permission('events.manage') and created_by=(select auth.uid()));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
 using(app_private.has_permission('events.manage')) with check(app_private.has_permission('events.manage'));
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
 using(app_private.has_permission('events.read') or app_private.has_permission('events.manage') or app_private.event_role(id,'responsavel','operador'));
drop policy if exists members_manage on public.event_members;
create policy members_manage on public.event_members for all to authenticated
 using(app_private.has_permission('events.manage')) with check(app_private.has_permission('events.manage'));
drop policy if exists members_read on public.event_members;
create policy members_read on public.event_members for select to authenticated
 using(app_private.has_permission('events.manage') or user_id=(select auth.uid()));
drop policy if exists stock_destinations_read on public.stock_destinations;
create policy stock_destinations_read on public.stock_destinations for select to authenticated
 using(app_private.has_permission('stock.exit') or app_private.has_permission('stock.destinations'));
drop policy if exists balances_read on public.stock_balances;
create policy balances_read on public.stock_balances for select to authenticated using(
 (event_id is null and (app_private.has_permission('products.read') or app_private.has_permission('stock.balance') or app_private.has_permission('stock.entry') or app_private.has_permission('stock.exit')))
 or (event_id is not null and (app_private.has_permission('events.manage') or app_private.event_role(event_id,'responsavel','operador'))));
drop policy if exists movements_read on public.stock_movements;
create policy movements_read on public.stock_movements for select to authenticated using(
 app_private.has_permission('movements.read') or (event_id is not null and app_private.event_role(event_id,'responsavel','operador')));
drop policy if exists stock_counts_read on public.stock_counts;
create policy stock_counts_read on public.stock_counts for select to authenticated using(
 app_private.has_permission('stock.balance') or actor_id=(select auth.uid()));
drop policy if exists avulso_orders_read on public.avulso_orders;
create policy avulso_orders_read on public.avulso_orders for select to authenticated using(app_private.has_permission('orders.read'));
drop policy if exists avulso_order_items_read on public.avulso_order_items;
create policy avulso_order_items_read on public.avulso_order_items for select to authenticated using(app_private.has_permission('orders.read'));
drop policy if exists customer_access_admin_read on public.customer_catalog_access;
create policy customer_access_admin_read on public.customer_catalog_access for select to authenticated using(app_private.has_permission('catalog.manage'));
drop policy if exists staff_read on public.staff_profiles;
create policy staff_read on public.staff_profiles for select to authenticated using(
 id=(select auth.uid()) or app_private.has_permission('users.manage') or
 (app_private.has_permission('events.manage') and app_private.is_active()) or
 (app_private.is_active() and app_private.shares_event(id)));
-- Staff updates still restricted to admins by old staff_edit policy.
-- All RPCs below must use exact action permissions rather than inherited manager titles.
