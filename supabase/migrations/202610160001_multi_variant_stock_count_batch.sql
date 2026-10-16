-- Balanço de todas as variações do card em uma única transação.
-- Conserva a trilha de auditoria implementada por quick_stock_count.
create or replace function public.quick_stock_count_batch(
 p_items jsonb,p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_line jsonb; v_row record; v_ids uuid[] := '{}'::uuid[];
  v_product uuid; v_expected integer; v_reserved integer; v_counted integer;
  v_current integer; v_current_reserved integer;
  v_changes integer := 0; v_total integer := 0; v_result jsonb := '[]'::jsonb;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if auth.uid() is null or not app_private.has_permission('stock.balance')
     or not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Sem permissão para realizar balanço';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Selecione entre 1 e 100 variações para conferir';
  end if;
  if length(coalesce(v_note,''))>250 then raise exception 'Justificativa longa demais';end if;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line)<>'object'
       or coalesce(v_line->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_line->>'expected','') !~ '^(0|[1-9][0-9]{0,6})$'
       or coalesce(v_line->>'reserved','') !~ '^(0|[1-9][0-9]{0,6})$'
       or coalesce(v_line->>'counted','') !~ '^(0|[1-9][0-9]{0,6})$' then
      raise exception 'Dados do balanço inválidos';
    end if;
    v_product := (v_line->>'product_id')::uuid;
    v_expected := (v_line->>'expected')::integer;
    v_reserved := (v_line->>'reserved')::integer;
    v_counted := (v_line->>'counted')::integer;
    if v_product = any(v_ids) or v_expected>1000000 or v_reserved>1000000
       or v_counted>1000000 then
      raise exception 'Produto repetido ou quantidade inválida';
    end if;
    if v_counted < v_reserved then
      raise exception 'Contagem não pode ficar abaixo das unidades reservadas';
    end if;
    if not exists(select 1 from public.products where id=v_product and active=true
      and force_archived_at is null) then
      raise exception 'Um produto do balanço está inativo ou indisponível';
    end if;
    v_ids := pg_catalog.array_append(v_ids,v_product);
    if v_counted <> v_expected then v_changes := v_changes+1; end if;
  end loop;
  if v_changes>0 and (v_note is null or length(v_note)<5) then
    raise exception 'Explique a divergência em pelo menos 5 caracteres';
  end if;
  -- Trava saldos em ordem fixa; falha integralmente se qualquer valor mudou.
  for v_row in
    select (x.value->>'product_id')::uuid id,
           (x.value->>'expected')::integer expected,
           (x.value->>'reserved')::integer reserved,
           (x.value->>'counted')::integer counted
    from pg_catalog.jsonb_array_elements(p_items) x
    order by (x.value->>'product_id')::uuid
  loop
    insert into public.stock_balances(product_id,event_id,quantity)
       values(v_row.id,null,0)
       on conflict (product_id) where event_id is null do nothing;
    select quantity into v_current from public.stock_balances
       where product_id=v_row.id and event_id is null for update;
    select coalesce(sum(quantity),0) into v_current_reserved
       from public.stock_reservations where product_id=v_row.id and status='ativa';
    if v_current is distinct from v_row.expected or v_current_reserved<>v_row.reserved then
      raise exception 'Estoque ou reservas mudaram durante o balanço. Recarregue os produtos.';
    end if;
    if v_row.counted < v_current_reserved then
      raise exception 'A contagem não pode ficar abaixo das unidades reservadas';
    end if;
    v_total := v_total+v_row.counted;
  end loop;
  -- A função já existente registra stock_counts e stock_movements com ator.
  for v_row in
    select (x.value->>'product_id')::uuid id,
           (x.value->>'expected')::integer expected,
           (x.value->>'counted')::integer counted
    from pg_catalog.jsonb_array_elements(p_items) x
    order by (x.value->>'product_id')::uuid
  loop
    perform public.quick_stock_count(
      v_row.id,v_row.expected,v_row.counted,
      coalesce(v_note,'Balanço conjunto de variações pelo catálogo')
    );
    v_result := v_result || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('product_id',v_row.id,'counted',v_row.counted));
  end loop;
  return pg_catalog.jsonb_build_object('variations',pg_catalog.jsonb_array_length(p_items),
    'differences',v_changes,'physical_total',v_total,'items',v_result);
end;
$function$;
revoke all on function public.quick_stock_count_batch(jsonb,text) from public,anon;
grant execute on function public.quick_stock_count_batch(jsonb,text) to authenticated;
