-- AME MAIS — categorias hierárquicas sem limite de níveis predefinido.
-- Migração preserva IDs, produtos, tags e relacionamentos existentes.
begin;

alter table public.categories drop constraint if exists categories_depth_check;
alter table public.categories alter column depth type integer;
alter table public.categories add constraint categories_depth_positive check (depth >= 1);

-- Serializar alterações estruturais impede ciclos criados por edições simultâneas.
create or replace function app_private.check_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_depth integer;
  v_has_cycle boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(27014, 301);

  if new.parent_id is null then
    new.depth := 1;
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Categoria não pode ser filha de si mesma';
  end if;

  select c.depth into v_parent_depth
  from public.categories c
  where c.id = new.parent_id
  for key share;
  if v_parent_depth is null then
    raise exception 'Categoria superior não encontrada';
  end if;

  -- Caminha pelos ancestrais, não pelos filhos; seguro com profundidade variável.
  with recursive ancestor as (
    select c.id, c.parent_id, array[c.id] as visited
    from public.categories c where c.id = new.parent_id
    union all
    select c.id, c.parent_id, a.visited || c.id
    from public.categories c
      join ancestor a on c.id = a.parent_id
    where not c.id = any(a.visited)
  )
  select exists(select 1 from ancestor where id = new.id)
    into v_has_cycle;
  if v_has_cycle then
    raise exception 'Ciclo de categorias não permitido';
  end if;

  new.depth := v_parent_depth + 1;
  return new;
end;
$$;

-- A proteção existente contra mover uma categoria que já possui filhos
-- continua em vigor, conservando a profundidade dos descendentes.
commit;