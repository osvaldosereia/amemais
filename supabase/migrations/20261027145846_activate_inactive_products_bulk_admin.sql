create or replace function public.activate_inactive_products_bulk()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_product_id uuid;
  v_considered integer := 0;
  v_activated integer := 0;
  v_skipped_conflicts integer := 0;
  v_archived_preserved integer := 0;
begin
  if v_actor is null or not app_private.role_in('admin') then
    raise exception 'Somente um administrador pode ativar produtos inativos';
  end if;

  select count(*) into v_archived_preserved
  from public.products
  where active is false and force_archived_at is not null;

  for v_product_id in
    select p.id
    from public.products p
    where p.active is false
      and p.force_archived_at is null
    order by p.created_at, p.id
    for update
  loop
    v_considered := v_considered + 1;
    begin
      update public.products
      set active = true
      where id = v_product_id
        and active is false
        and force_archived_at is null;
      if found then
        v_activated := v_activated + 1;
      end if;
    exception
      when unique_violation then
        v_skipped_conflicts := v_skipped_conflicts + 1;
    end;
  end loop;

  return jsonb_build_object(
    'considered', v_considered,
    'activated', v_activated,
    'skipped_conflicts', v_skipped_conflicts,
    'archived_preserved', v_archived_preserved
  );
end;
$function$;

revoke all on function public.activate_inactive_products_bulk() from public, anon;
grant execute on function public.activate_inactive_products_bulk() to authenticated;
