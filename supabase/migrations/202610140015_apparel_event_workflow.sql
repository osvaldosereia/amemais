-- AME MAIS: incrementos de tamanhos e separação de evento em lote, mantendo histórico.
begin;

create function public.add_apparel_variants(p_model_id uuid,p_variants jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_model public.apparel_models%rowtype;
  v_item jsonb;
  v_count integer;
  v_color text;
  v_size text;
  v_sku text;
  v_ean text;
  v_qty integer;
  v_product_id uuid;
  v_seen text[] := '{}';
  v_pair text;
begin
  if not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Sem permissão para cadastrar tamanhos';
  end if;
  select * into v_model from public.apparel_models where id=p_model_id for update;
  if not found then raise exception 'Modelo de roupa não encontrado'; end if;
  if p_variants is null or jsonb_typeof(p_variants)<>'array' or
     jsonb_array_length(p_variants) not between 1 and 40 then
    raise exception 'Informe de 1 a 40 variações';
  end if;
  v_count := 0;
  for v_item in select value from jsonb_array_elements(p_variants) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'Variação inválida'; end if;
    v_size:=upper(btrim(coalesce(v_item->>'size','')));
    v_color:=btrim(coalesce(v_item->>'color',''));
    v_sku:=nullif(btrim(coalesce(v_item->>'sku','')),'');
    v_ean:=nullif(regexp_replace(coalesce(v_item->>'ean',''),'[[:space:]-]','','g'),'');
    if length(v_size) not between 1 and 16 or length(v_color) not between 2 and 40 then
      raise exception 'Preencha corretamente tamanho e cor';
    end if;
    v_pair:=lower(v_color)||'|'||v_size;
    if v_pair=any(v_seen) then raise exception 'Tamanho/cor repetido no formulário: % / %',v_color,v_size; end if;
    v_seen:=array_append(v_seen,v_pair);
    if exists(select 1 from public.products p where p.apparel_model_id=p_model_id
      and lower(p.apparel_color)=lower(v_color) and upper(p.apparel_size)=v_size) then
      raise exception 'O tamanho % da cor % já existe neste produto',v_size,v_color;
    end if;
    if length(coalesce(v_sku,''))>80 or (v_ean is not null and v_ean !~ '^[0-9]{8,14}$') then
      raise exception 'SKU ou EAN inválido para o tamanho %',v_size;
    end if;
    if v_item->>'quantity' is null or (v_item->>'quantity') !~ '^[0-9]{1,7}$' then
      raise exception 'Estoque inicial inválido para tamanho %',v_size;
    end if;
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty>1000000 then raise exception 'Quantidade excessiva no tamanho %',v_size; end if;
    if v_sku is null then
      v_sku:='AM-'||replace(p_model_id::text,'-','')||'-'||substr(md5(lower(v_color)),1,8)||'-'||v_size;
    end if;
    if exists(select 1 from public.products where sku=v_sku) then
      raise exception 'Código interno "%" já existe. Deixe vazio para gerar outro.',v_sku;
    end if;
    if v_ean is not null and exists(select 1 from public.products where ean=v_ean) then
      raise exception 'EAN "%" já existe em outro produto',v_ean;
    end if;
    insert into public.products(
      name,sku,ean,category_id,tags,apparel_model_id,apparel_size,apparel_color,
      gondola,prateleira,image_path,created_by
    ) values(
      v_model.name||' · '||v_color||' / '||v_size,v_sku,v_ean,v_model.category_id,
      v_model.tags,p_model_id,v_size,v_color,
      (select p.gondola from public.products p where p.apparel_model_id=p_model_id order by p.created_at limit 1),
      (select p.prateleira from public.products p where p.apparel_model_id=p_model_id order by p.created_at limit 1),
      v_model.image_path,auth.uid()
    ) returning id into v_product_id;
    insert into public.stock_balances(product_id,event_id,quantity)
      values(v_product_id,null,0);
    if v_qty>0 then
      if app_private.role_in('estoquista') then
        perform public.quick_stock_count(v_product_id,0,v_qty,'Estoque inicial de novo tamanho');
      else
        perform public.move_stock(v_product_id,'entrada',v_qty,null,'Estoque inicial de novo tamanho');
      end if;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.add_apparel_variants(uuid,jsonb) from public,anon;
grant execute on function public.add_apparel_variants(uuid,jsonb) to authenticated;

create function public.transfer_event_batch(p_event_id uuid,p_items jsonb,p_note text default null)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_item jsonb;
  v_id uuid;
  v_quantity integer;
  v_total integer:=0;
  v_count integer;
  v_seen uuid[]:='{}';
begin
  if not app_private.role_in('admin','gerente') then raise exception 'Apenas administradores e gerentes podem separar mercadorias'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or
     jsonb_array_length(p_items) not between 1 and 150 then
    raise exception 'Informe entre 1 e 150 variações para transferir';
  end if;
  if length(coalesce(p_note,''))>250 then raise exception 'Observação muito longa'; end if;
  -- Bloqueio único para o evento, e produtos sempre ordenados para diminuir contenção.
  perform 1 from public.events where id=p_event_id and status='ativo' for update;
  if not found then raise exception 'Evento não está ativo'; end if;
  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'product_id','') !~
      '^[0-9a-fA-F-]{36}$' then raise exception 'Produto inválido'; end if;
    v_id:=(v_item->>'product_id')::uuid;
    if v_id=any(v_seen) then raise exception 'Produto repetido na separação'; end if;
    v_seen:=array_append(v_seen,v_id);
    if coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,6}$' then
      raise exception 'Quantidade de transferência inválida';
    end if;
    v_quantity:=(v_item->>'quantity')::integer;
    if v_quantity>1000000 then raise exception 'Quantidade excessiva'; end if;
    perform public.move_stock(v_id,'transferencia',v_quantity,p_event_id,
      nullif(btrim(coalesce(p_note,'')),''));
    v_total:=v_total+v_quantity;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.transfer_event_batch(uuid,jsonb,text) from public,anon;
grant execute on function public.transfer_event_batch(uuid,jsonb,text) to authenticated;
commit;