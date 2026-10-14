-- Balanço rápido de múltiplas variações: transação única, sem atualização global da tela.
begin;
create or replace function public.quick_stock_count_batch(p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_expected integer;
  v_counted integer;
  v_seen uuid[]:='{}'::uuid[];
  v_count integer:=0;
  v_changes integer:=0;
  v_result jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Sem permissão para balanço rápido';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
      or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'Selecione de 1 a 60 variações para conferir';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    if jsonb_typeof(v_item)<>'object' or
      coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(v_item->>'expected','') !~ '^[0-9]{1,7}$'
      or coalesce(v_item->>'counted','') !~ '^[0-9]{1,7}$' then
      raise exception 'Variação ou quantidade inválida no balanço';
    end if;
    v_product_id:=(v_item->>'product_id')::uuid;
    if v_product_id=any(v_seen) then
      raise exception 'A variação aparece repetida na mesma contagem';
    end if;
    v_seen:=array_append(v_seen,v_product_id);
    v_expected:=(v_item->>'expected')::integer;
    v_counted:=(v_item->>'counted')::integer;
    if v_expected>1000000 or v_counted>1000000 then
      raise exception 'Quantidade acima do limite permitido';
    end if;
    perform public.quick_stock_count(v_product_id,v_expected,v_counted,'Contagem agrupada por produto');
    v_count:=v_count+1;
    if v_expected<>v_counted then v_changes:=v_changes+1; end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'product_id',v_product_id,'expected',v_expected,'counted',v_counted
    ));
  end loop;
  return jsonb_build_object('saved',v_count,'adjusted',v_changes,'items',v_result);
end;
$$;
revoke all on function public.quick_stock_count_batch(jsonb) from public,anon;
grant execute on function public.quick_stock_count_batch(jsonb) to authenticated;
commit;