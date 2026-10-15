CREATE OR REPLACE FUNCTION public.add_apparel_variants(p_model_id uuid, p_variants jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    v_size:=btrim(coalesce(v_item->>'size',''));
    if not exists(select 1 from unnest(app_private.category_variant_options(v_model.category_id)) allowed
      where lower(allowed)=lower(v_size)) then raise exception 'Variação não permitida nesta categoria: %',v_size;end if;
    v_color:=btrim(coalesce(nullif(v_item->>'color',''),'Única'));
    v_sku:=nullif(btrim(coalesce(v_item->>'sku','')),'');
    v_ean:=nullif(regexp_replace(coalesce(v_item->>'ean',''),'[[:space:]-]','','g'),'');
    if length(v_size) not between 1 and 16 or length(v_color) not between 2 and 40 then
      raise exception 'Preencha corretamente tamanho e cor';
    end if;
    v_pair:=lower(v_color)||'|'||upper(v_size);
    if v_pair=any(v_seen) then raise exception 'Tamanho/cor repetido no formulário: % / %',v_color,v_size; end if;
    v_seen:=array_append(v_seen,v_pair);
    if exists(select 1 from public.products p where p.apparel_model_id=p_model_id and p.active
      and lower(p.apparel_color)=lower(v_color) and upper(p.apparel_size)=upper(v_size)) then
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
    if exists(select 1 from public.products where sku=v_sku and active) then
      raise exception 'Código interno "%" já existe. Deixe vazio para gerar outro.',v_sku;
    end if;
    if v_ean is not null and exists(select 1 from public.products where ean=v_ean and active) then
      raise exception 'EAN "%" já existe em outro produto',v_ean;
    end if;
    insert into public.products(
      name,sku,ean,category_id,tags,apparel_model_id,apparel_size,apparel_color,
      gondola,prateleira,image_path,created_by
    ) values(
      v_model.name||' · '||case when v_color='Única' then v_size else v_color||' / '||v_size end,v_sku,v_ean,v_model.category_id,
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_apparel(p_name text, p_type text, p_audience text, p_age_group text, p_category_id uuid, p_tags text[], p_variants jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := auth.uid();
 v_model uuid;
 v_product uuid;
 v_variant jsonb;
 v_color text;
 v_size text;
 v_sku text;
 v_ean text;
 v_qty integer;
 v_item_name text;
begin
 if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
   raise exception 'Sem permissão para cadastrar roupas';
 end if;
 p_name := btrim(coalesce(p_name,''));
 if length(p_name) not between 2 and 110 then raise exception 'Nome deve ter de 2 a 110 caracteres'; end if;
 if p_type not in ('Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro')
   or p_audience not in ('Feminino','Masculino','Unissex')
   or p_age_group not in ('Adulto','Infantil','Bebê') then
   raise exception 'Tipo, público ou faixa etária inválidos';
 end if;
 if p_category_id is null or cardinality(app_private.category_variant_options(p_category_id))=0 then
   raise exception 'Escolha uma categoria com variações configuradas';
 end if;
 if p_variants is null or jsonb_typeof(p_variants)<>'array'
   or jsonb_array_length(p_variants) not between 1 and 40 then
   raise exception 'Informe de 1 a 40 variações';
 end if;
 if coalesce(array_length(p_tags,1),0)>30 then raise exception 'Máximo de 30 tags'; end if;
 p_tags:=coalesce(p_tags,'{}'::text[]);
 insert into public.apparel_models(name,garment_type,audience,age_group,category_id,tags,created_by)
   values(p_name,p_type,p_audience,p_age_group,p_category_id,p_tags,v_actor)
   returning id into v_model;
 for v_variant in select value from jsonb_array_elements(p_variants) loop
   if jsonb_typeof(v_variant)<>'object' then raise exception 'Variação inválida'; end if;
   v_color:=btrim(coalesce(nullif(v_variant->>'color',''),'Única'));
   v_size:=btrim(coalesce(v_variant->>'size',''));
   if not exists(select 1 from unnest(app_private.category_variant_options(p_category_id)) allowed
     where lower(allowed)=lower(v_size)) then raise exception 'Variação não permitida nesta categoria: %',v_size;end if;
   v_sku:=nullif(btrim(coalesce(v_variant->>'sku','')),'');
   v_ean:=nullif(regexp_replace(coalesce(v_variant->>'ean',''),'[\s-]','','g'),'');
   if length(v_color) not between 2 and 40 or length(v_size) not between 1 and 16 then
      raise exception 'Informe cor e tamanho válidos';
   end if;
   -- Código automático único e estável, sem reaproveitar SKU de outro modelo.
   if v_sku is null then
     v_sku := 'AM-' || replace(v_model::text,'-','') || '-' || substr(md5(lower(v_color)),1,8) || '-' || v_size;
   end if;
   if exists(select 1 from public.products where sku=v_sku and active) then
     raise exception 'Código interno "%" já cadastrado. Informe outro SKU ou deixe vazio para gerar automaticamente.',v_sku;
   end if;
   if v_ean is not null and exists(select 1 from public.products where ean=v_ean and active) then
     raise exception 'EAN "%" já cadastrado em outro produto. Confira o código de barras.',v_ean;
   end if;
   if length(coalesce(v_sku,''))>80 or (v_ean is not null and v_ean !~ '^[0-9]{8,14}$') then
      raise exception 'SKU ou EAN inválido';
   end if;
   if (v_variant->>'quantity') is null or (v_variant->>'quantity') !~ '^[0-9]{1,7}$' then
      raise exception 'Quantidade inicial inválida';
   end if;
   v_qty:=(v_variant->>'quantity')::integer;
   if v_qty>1000000 then raise exception 'Quantidade inicial muito alta'; end if;
   v_item_name:=p_name||' · '||case when v_color='Única' then v_size else v_color||' / '||v_size end;
   insert into public.products(
     name,sku,ean,category_id,tags,apparel_model_id,apparel_size,apparel_color,created_by
   ) values (
     v_item_name,v_sku,v_ean,p_category_id,p_tags,v_model,v_size,v_color,v_actor
   ) returning id into v_product;
   insert into public.stock_balances(product_id,event_id,quantity)
     values(v_product,null,0);
   if v_qty>0 then
     if app_private.role_in('estoquista') then
       perform public.quick_stock_count(v_product,0,v_qty,'Estoque inicial: roupa');
     else
       perform public.move_stock(v_product,'entrada',v_qty);
     end if;
   end if;
 end loop;
 return v_model;
end;
$function$
;