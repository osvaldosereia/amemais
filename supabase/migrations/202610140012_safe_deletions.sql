-- AME MAIS: exclusões seguras, sem apagar o histórico de movimentações.
begin;
create function public.remove_product_safely(p_product_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_qty integer;
begin
  if not app_private.role_in('admin','gerente') then
    raise exception 'Somente administradores e gerentes podem excluir produtos';
  end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  select coalesce(sum(quantity),0) into v_qty from public.stock_balances
    where product_id=p_product_id;
  if v_qty<>0 then
    raise exception 'Este produto ainda possui % unidade(s). Zere o estoque da loja e dos eventos antes de excluir.',v_qty;
  end if;
  if exists(select 1 from public.stock_movements where product_id=p_product_id)
    or exists(select 1 from public.stock_counts where product_id=p_product_id) then
    update public.products set active=false where id=p_product_id;
    return 'archived';
  end if;
  delete from public.stock_balances where product_id=p_product_id and quantity=0;
  delete from public.products where id=p_product_id;
  if v_product.apparel_model_id is not null
     and not exists(select 1 from public.products where apparel_model_id=v_product.apparel_model_id) then
    delete from public.apparel_models where id=v_product.apparel_model_id;
  end if;
  return 'deleted';
end;
$$;
revoke all on function public.remove_product_safely(uuid) from public,anon;
grant execute on function public.remove_product_safely(uuid) to authenticated;

create function public.remove_category_branch(p_category_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_n integer;
begin
  if not app_private.role_in('admin','gerente') then
    raise exception 'Sem permissão para excluir categorias';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(27014,301);
  if not exists(select 1 from public.categories where id=p_category_id) then
    raise exception 'Categoria não encontrada';
  end if;
  with recursive subtree as (
    select id,parent_id,0 as depth,array[id] as seen
      from public.categories where id=p_category_id
    union all
    select c.id,c.parent_id,s.depth+1,s.seen||c.id
      from public.categories c join subtree s on c.parent_id=s.id
      where not c.id=any(s.seen)
  ) select count(*) into v_n from subtree;
  if exists(
    with recursive subtree as (
      select id,array[id] as seen from public.categories where id=p_category_id
      union all
      select c.id,s.seen||c.id from public.categories c join subtree s on c.parent_id=s.id
        where not c.id=any(s.seen)
    )
    select 1 from subtree s
    where exists(select 1 from public.products p where p.category_id=s.id)
       or exists(select 1 from public.apparel_models a where a.category_id=s.id)
  ) then
    raise exception 'Há produtos vinculados a esta categoria ou a uma subcategoria. Reclassifique os produtos antes de excluir.';
  end if;
  for v_id in
    with recursive subtree as (
      select id,0 as depth,array[id] as seen from public.categories where id=p_category_id
      union all
      select c.id,s.depth+1,s.seen||c.id from public.categories c join subtree s on c.parent_id=s.id
      where not c.id=any(s.seen)
    )
    select id from subtree order by depth desc
  loop
    delete from public.categories where id=v_id;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.remove_category_branch(uuid) from public,anon;
grant execute on function public.remove_category_branch(uuid) to authenticated;

create function public.remove_tag_safely(p_tag_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_products integer;
  v_models integer;
begin
  if not app_private.role_in('admin','gerente') then
    raise exception 'Sem permissão para excluir tags';
  end if;
  select name into v_name from public.tags where id=p_tag_id for update;
  if not found then raise exception 'Tag não encontrada'; end if;
  update public.products set tags=array_remove(tags,v_name) where v_name=any(tags);
  get diagnostics v_products=row_count;
  update public.apparel_models set tags=array_remove(tags,v_name) where v_name=any(tags);
  get diagnostics v_models=row_count;
  delete from public.tags where id=p_tag_id;
  return v_products+v_models;
end;
$$;
revoke all on function public.remove_tag_safely(uuid) from public,anon;
grant execute on function public.remove_tag_safely(uuid) to authenticated;
commit;