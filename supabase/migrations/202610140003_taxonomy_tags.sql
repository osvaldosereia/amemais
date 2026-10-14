-- AME MAIS: taxonomia e tags reutilizáveis, sem alterar saldos.
begin;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    length(btrim(name)) between 2 and 40
    and name = btrim(name)
    and position(',' in name) = 0
  ),
  created_at timestamptz not null default now()
);
create unique index tags_name_lower_unique on public.tags(lower(name));
create index tags_name_idx on public.tags(name);
alter table public.tags enable row level security;
revoke all on public.tags from public, anon, authenticated;
grant select, insert, delete on public.tags to authenticated;
create policy tags_read on public.tags for select to authenticated
  using(app_private.is_active());
create policy tags_insert on public.tags for insert to authenticated
  with check(app_private.role_in('admin','gerente'));
create policy tags_delete on public.tags for delete to authenticated
  using(app_private.role_in('admin','gerente'));
create trigger audit_tags after insert or update or delete on public.tags
  for each row execute function app_private.audit_changes();

-- Um rótulo usado por produtos não pode ser excluído; evita produtos "órfãos".
create function app_private.prevent_used_tag_delete()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.products p
    where old.name = any(p.tags)
  ) then
    raise exception 'Esta tag está em uso. Retire-a dos produtos antes de excluir.';
  end if;
  return old;
end;
$$;
create trigger tags_in_use before delete on public.tags
  for each row execute function app_private.prevent_used_tag_delete();

-- Subárvore com descendentes não pode ser movida; mantém depth consistente.
create function app_private.prevent_category_tree_move()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.parent_id is distinct from old.parent_id
     and exists(select 1 from public.categories c where c.parent_id = old.id)
  then
    raise exception 'Categoria com subcategorias não pode mudar de nível.';
  end if;
  return new;
end;
$$;
create trigger category_tree_move before update of parent_id on public.categories
  for each row execute function app_private.prevent_category_tree_move();

-- Todas as tags de produtos devem pertencer ao catálogo de rótulos.
create function app_private.validate_product_tags()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if coalesce(array_length(new.tags,1),0) > 30 then
    raise exception 'Máximo de 30 tags por produto';
  end if;
  if exists (
    select 1 from unnest(new.tags) as label
    where not exists(select 1 from public.tags t where t.name = label)
  ) then
    raise exception 'Cadastre as tags antes de vinculá-las ao produto';
  end if;
  if (select count(*) from unnest(new.tags) as label) <>
     (select count(distinct lower(label)) from unnest(new.tags) as label) then
    raise exception 'Tags duplicadas';
  end if;
  return new;
end;
$$;
create trigger product_tags_validate before insert or update of tags on public.products
  for each row execute function app_private.validate_product_tags();

commit;