-- AME MAIS Estoque / migração inicial (Supabase PostgreSQL 15+)
-- Execute somente em um projeto Supabase dedicado ao AME MAIS Estoque.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  email text not null,
  role text not null default 'evento' check (role in ('admin','gerente','evento','consulta')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 90),
  depth smallint not null default 1 check (depth between 1 and 3),
  created_at timestamptz not null default now()
);
create unique index categories_sibling_unique on public.categories (parent_id, lower(name)) nulls not distinct;
create index categories_parent_idx on public.categories(parent_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 180),
  sku text unique,
  ean text unique check (ean is null or ean ~ '^[0-9]{8,14}$'),
  category_id uuid references public.categories(id) on delete restrict,
  tags text[] not null default '{}',
  image_path text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on public.products(lower(name));
create index products_category_idx on public.products(category_id);
create index products_tags_idx on public.products using gin(tags);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 150),
  starts_at date not null,
  ends_at date,
  notes text,
  status text not null default 'rascunho' check (status in ('rascunho','ativo','encerrado')),
  created_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_event_dates check (ends_at is null or ends_at >= starts_at)
);

create table public.event_members (
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid not null references public.staff_profiles(id) on delete restrict,
  role text not null default 'operador' check (role in ('responsavel','operador')),
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create index event_members_user_idx on public.event_members(user_id,event_id);

create table public.stock_balances (
  product_id uuid not null references public.products(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);
create unique index balances_store_unique on public.stock_balances(product_id) where event_id is null;
create unique index balances_event_unique on public.stock_balances(product_id,event_id) where event_id is not null;
create index balances_event_idx on public.stock_balances(event_id,product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  event_id uuid references public.events(id),
  action text not null check (action in ('entrada','venda_loja','transferencia','venda_evento','devolucao','ajuste_loja')),
  quantity integer not null check (quantity <> 0),
  delta_store integer not null,
  delta_event integer not null,
  actor_id uuid not null references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  constraint movement_amount check (
    (action = 'ajuste_loja' and delta_store = quantity and delta_event = 0)
    or (action = 'entrada' and quantity > 0 and delta_store = quantity and delta_event = 0)
    or (action = 'venda_loja' and quantity > 0 and delta_store = -quantity and delta_event = 0)
    or (action = 'transferencia' and quantity > 0 and delta_store = -quantity and delta_event = quantity)
    or (action = 'venda_evento' and quantity > 0 and delta_store = 0 and delta_event = -quantity)
    or (action = 'devolucao' and quantity > 0 and delta_store = quantity and delta_event = -quantity)
  )
);
create index movements_created_idx on public.stock_movements(created_at desc);
create index movements_event_idx on public.stock_movements(event_id,created_at desc);
create index movements_product_idx on public.stock_movements(product_id,created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id text not null,
  action text not null,
  actor_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_log(created_at desc);

-- Funções auxiliares isoladas do Data API; checagens consultam a tabela de papéis.
create function app_private.is_active()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.staff_profiles p where p.id = (select auth.uid()) and p.active); $$;

create function app_private.role_in(variadic allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.staff_profiles p where p.id = (select auth.uid()) and p.active and p.role = any(allowed)); $$;

create function app_private.event_role(p_event uuid, variadic allowed text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from public.event_members m join public.staff_profiles p on p.id=m.user_id
  where m.event_id=p_event and m.user_id=(select auth.uid()) and p.active and m.role = any(allowed)
); $$;
revoke all on function app_private.is_active(), app_private.role_in(text[]), app_private.event_role(uuid,text[]) from public;
grant execute on function app_private.is_active(), app_private.role_in(text[]), app_private.event_role(uuid,text[]) to authenticated;

create function app_private.check_category()
returns trigger language plpgsql set search_path = ''
as $$
declare p_depth smallint;
begin
  if new.parent_id is null then new.depth := 1;
  else
    if new.parent_id = new.id then raise exception 'Categoria não pode ser filha de si mesma'; end if;
    select depth into p_depth from public.categories where id = new.parent_id;
    if p_depth is null or p_depth >= 3 then raise exception 'Apenas 3 níveis de categorias'; end if;
    new.depth := p_depth + 1;
    if tg_op = 'UPDATE' and exists (
      with recursive children as (
        select id from public.categories where parent_id = new.id
        union all select c.id from public.categories c join children x on c.parent_id = x.id
      ) select 1 from children where id = new.parent_id
    ) then raise exception 'Ciclo de categorias não permitido'; end if;
  end if;
  -- Evita mover categoria com descendentes para profundidade inválida.
  if tg_op = 'UPDATE' and new.depth <> old.depth and exists (
    with recursive descendants as (
      select id, 1 as distance from public.categories where parent_id = new.id
      union all select c.id, d.distance + 1 from public.categories c join descendants d on c.parent_id = d.id
    ) select 1 from descendants where distance + new.depth > 3
  ) then raise exception 'Mudança ultrapassaria 3 níveis'; end if;
  return new;
end $$;
create trigger trg_category_depth before insert or update of parent_id on public.categories
for each row execute function app_private.check_category();

create function app_private.touch_product()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;
create trigger trg_product_touch before update on public.products for each row execute function app_private.touch_product();

create function app_private.audit_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  v_id := case when tg_op='DELETE' then old.id::text else new.id::text end;
  insert into public.audit_log(entity,entity_id,action,actor_id,details)
  values (tg_table_name,v_id,tg_op,(select auth.uid()),
    case when tg_op='DELETE' then jsonb_build_object('old',to_jsonb(old))
         when tg_op='INSERT' then jsonb_build_object('new',to_jsonb(new))
         else jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)) end);
  return coalesce(new,old);
end $$;
create trigger audit_products after insert or update or delete on public.products for each row execute function app_private.audit_changes();
create trigger audit_events after insert or update or delete on public.events for each row execute function app_private.audit_changes();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function app_private.audit_changes();
-- event_members tem chave composta; usa gatilho específico.
create function app_private.audit_members()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log(entity,entity_id,action,actor_id,details)
  values ('event_members',coalesce(new.event_id,old.event_id)::text,tg_op,(select auth.uid()),
    case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new,old);
end $$;
create trigger audit_event_members after insert or update or delete on public.event_members for each row execute function app_private.audit_members();
create trigger audit_staff after insert or update on public.staff_profiles for each row execute function app_private.audit_changes();

-- Movimentações auditáveis nunca podem ser alteradas nem excluídas.
create function app_private.prevent_mutation() returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Histórico imutável'; end $$;
create trigger movements_immutable before update or delete on public.stock_movements
for each row execute function app_private.prevent_mutation();

-- API atômica: bloqueia linhas do evento e dos saldos; nunca confia no saldo do navegador.
create function public.move_stock(
  p_product_id uuid, p_action text, p_quantity integer,
  p_event_id uuid default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
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
  return v_id;
end $$;

create function public.activate_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app_private.role_in('admin','gerente') then raise exception 'Acesso negado'; end if;
  update public.events set status='ativo' where id=p_event_id and status='rascunho';
  if not found then raise exception 'Evento não encontrado ou já iniciado'; end if;
end $$;

create function public.close_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_status text;
begin
  if not (app_private.role_in('admin','gerente') or app_private.event_role(p_event_id,'responsavel')) then
    raise exception 'Acesso negado'; end if;
  select status into v_status from public.events where id=p_event_id for update;
  if v_status is distinct from 'ativo' then raise exception 'Evento não está ativo'; end if;
  if exists(select 1 from public.stock_balances where event_id=p_event_id and quantity<>0) then
    raise exception 'Ainda há produtos no evento. Registre vendas ou devoluções.'; end if;
  update public.events set status='encerrado',closed_by=(select auth.uid()),closed_at=now() where id=p_event_id;
end $$;

revoke execute on function public.move_stock(uuid,text,integer,uuid,text),
 public.activate_event(uuid), public.close_event(uuid) from public, anon;
grant execute on function public.move_stock(uuid,text,integer,uuid,text),
 public.activate_event(uuid), public.close_event(uuid) to authenticated;

-- Nenhum cliente escreve diretamente nos saldos ou no livro de movimentos.
revoke all on public.staff_profiles,public.categories,public.products,public.events,
 public.event_members,public.stock_balances,public.stock_movements,public.audit_log from public, anon, authenticated;
grant select on public.staff_profiles,public.categories,public.products,public.events,
 public.event_members,public.stock_balances,public.stock_movements,public.audit_log to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update on public.products to authenticated;
grant insert(name,starts_at,ends_at,notes,created_by) on public.events to authenticated;
grant update(name,starts_at,ends_at,notes) on public.events to authenticated;
grant insert, update, delete on public.event_members to authenticated;
grant update(full_name,role,active) on public.staff_profiles to authenticated;

alter table public.staff_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log enable row level security;

create function app_private.shares_event(p_other_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from public.event_members mine
  join public.event_members theirs on mine.event_id = theirs.event_id
  where mine.user_id = (select auth.uid()) and theirs.user_id = p_other_user
); $$;
revoke all on function app_private.shares_event(uuid) from public;
grant execute on function app_private.shares_event(uuid) to authenticated;

create policy staff_read on public.staff_profiles for select to authenticated using (
  id=(select auth.uid()) or app_private.role_in('admin','gerente') or
  (app_private.is_active() and app_private.shares_event(id)));
create policy staff_edit on public.staff_profiles for update to authenticated
  using(app_private.role_in('admin')) with check(app_private.role_in('admin'));

create policy categories_read on public.categories for select to authenticated using(app_private.is_active());
create policy categories_write on public.categories for all to authenticated
  using(app_private.role_in('admin','gerente')) with check(app_private.role_in('admin','gerente'));
create policy products_read on public.products for select to authenticated using(app_private.is_active());
create policy products_insert on public.products for insert to authenticated
  with check(app_private.role_in('admin','gerente') and created_by=(select auth.uid()));
create policy products_update on public.products for update to authenticated
  using(app_private.role_in('admin','gerente')) with check(app_private.role_in('admin','gerente'));

create policy events_read on public.events for select to authenticated using(
  app_private.role_in('admin','gerente','consulta') or app_private.event_role(id,'responsavel','operador'));
create policy events_insert on public.events for insert to authenticated
  with check(app_private.role_in('admin','gerente') and created_by=(select auth.uid()));
create policy events_update on public.events for update to authenticated
  using(app_private.role_in('admin','gerente')) with check(app_private.role_in('admin','gerente'));

create policy members_read on public.event_members for select to authenticated using(
  app_private.role_in('admin','gerente') or user_id=(select auth.uid()));
create policy members_manage on public.event_members for all to authenticated
  using(app_private.role_in('admin','gerente')) with check(app_private.role_in('admin','gerente'));

create policy balances_read on public.stock_balances for select to authenticated using(
  app_private.role_in('admin','gerente','consulta') or
  (event_id is not null and app_private.event_role(event_id,'responsavel','operador')));
create policy movements_read on public.stock_movements for select to authenticated using(
  app_private.role_in('admin','gerente','consulta') or
  (event_id is not null and app_private.event_role(event_id,'responsavel','operador')));
create policy audit_read on public.audit_log for select to authenticated using(app_private.role_in('admin','gerente'));

-- Fotos privadas: URLs de curta duração; só gestores inserem.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ame-produtos','ame-produtos',false,512000,array['image/webp','image/jpeg'])
on conflict(id) do nothing;
create policy ame_photos_read on storage.objects for select to authenticated
  using(bucket_id='ame-produtos' and app_private.is_active());
create policy ame_photos_insert on storage.objects for insert to authenticated
  with check(bucket_id='ame-produtos' and app_private.role_in('admin','gerente'));
create policy ame_photos_delete on storage.objects for delete to authenticated
  using(bucket_id='ame-produtos' and app_private.role_in('admin','gerente'));

-- Exemplos iniciais, ajustáveis pelo gerente.
insert into public.categories(name) values
 ('Roupas'),('Terços'),('Imagens'),('Quadros'),('Acessórios'),('Livros');
commit;
