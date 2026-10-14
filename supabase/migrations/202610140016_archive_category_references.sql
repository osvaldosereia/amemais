-- Permitir excluir categorias sem produtos ativos, preservando o histórico de estoque.
-- Modelos de roupas arquivados podem ficar sem categoria corrente.
begin;

alter table public.products
  add column if not exists historical_category_path text;
alter table public.apparel_models
  add column if not exists historical_category_path text;
alter table public.apparel_models
  alter column category_id drop not null;

create or replace function app_private.category_path_for_history(p_category_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  with recursive ancestry as (
    select c.id,c.parent_id,c.name,0 as distance,array[c.id] as visited
      from public.categories c where c.id=p_category_id
    union all
    select c.id,c.parent_id,c.name,a.distance+1,a.visited||c.id
      from public.categories c join ancestry a on c.id=a.parent_id
      where not c.id=any(a.visited)
  )
  select string_agg(a.name,' / ' order by a.distance desc)
  from ancestry a;
$$;
revoke all on function app_private.category_path_for_history(uuid) from public,anon,authenticated;

create or replace function public.remove_category_branch(p_category_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_archived integer:=0;
  v_models integer:=0;
  v_id uuid;
begin
  if not app_private.role_in('admin','gerente') then
    raise exception 'Sem permissão para excluir categorias';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(27014,301);

  with recursive subtree as (
    select c.id,array[c.id] as visited
      from public.categories c where c.id=p_category_id
    union all
    select c.id,s.visited||c.id
      from public.categories c join subtree s on c.parent_id=s.id
      where not c.id=any(s.visited)
  )
  select array_agg(id) into v_ids from subtree;
  if v_ids is null then raise exception 'Categoria não encontrada'; end if;
  v_count:=cardinality(v_ids);

  -- A categoria pode ser excluída apenas se não houver produtos ativos
  -- nem estoque físico associado a registros antigos.
  if exists(
    select 1 from public.products p
    where (p.category_id=any(v_ids)
           or p.apparel_model_id in (
             select m.id from public.apparel_models m
             where m.category_id=any(v_ids)
           )) and p.active
  ) then
    raise exception 'Esta categoria contém produtos ativos. Reclassifique ou desative os produtos antes de excluir.';
  end if;
  if exists(
    select 1 from public.stock_balances sb
    join public.products p on p.id=sb.product_id
    where sb.quantity<>0 and (
      p.category_id=any(v_ids) or p.apparel_model_id in (
        select m.id from public.apparel_models m
        where m.category_id=any(v_ids)
      )
    )
  ) then
    raise exception 'Ainda há estoque na loja ou em eventos vinculado a esta categoria. Zere os saldos antes de excluir.';
  end if;

  -- As movimentações mantêm product_id; nenhuma movimentação, produto
  -- ou modelo é excluído aqui. O caminho antigo fica gravado nos arquivos.
  update public.products p
    set historical_category_path=app_private.category_path_for_history(p.category_id),
        category_id=null
    where not p.active and p.category_id=any(v_ids);
  get diagnostics v_archived=row_count;

  update public.apparel_models m
    set historical_category_path=app_private.category_path_for_history(m.category_id),
        category_id=null
    where m.category_id=any(v_ids);
  get diagnostics v_models=row_count;

  for v_id in
    select c.id from public.categories c
    where c.id=any(v_ids) order by c.depth desc
  loop
    delete from public.categories where id=v_id;
  end loop;

  insert into public.audit_log(entity,entity_id,action,actor_id,details)
    values ('categories',p_category_id::text,'delete_branch_archive',auth.uid(),
      jsonb_build_object('categories_removed',v_count,
                         'inactive_products_unlinked',v_archived,
                         'archived_models_unlinked',v_models));
  return v_count;
end;
$$;
revoke all on function public.remove_category_branch(uuid) from public,anon;
grant execute on function public.remove_category_branch(uuid) to authenticated;

commit;