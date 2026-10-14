-- Cadastro de produto simples + estoque inicial em uma transação.
-- SKU automático considera também a cor em produtos com várias cores.
begin;

create or replace function public.create_single_product_with_stock(
  p_name text,p_sku text,p_ean text,p_category_id uuid,p_tags text[],
  p_gondola text,p_prateleira text,p_initial_quantity integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid:=auth.uid();
  v_name text:=btrim(coalesce(p_name,''));
  v_sku text:=nullif(btrim(coalesce(p_sku,'')),'');
  v_ean text:=nullif(regexp_replace(coalesce(p_ean,''),'[[:space:]-]','','g'),'');
  v_gondola text:=nullif(btrim(coalesce(p_gondola,'')),'');
  v_prateleira text:=nullif(btrim(coalesce(p_prateleira,'')),'');
begin
  if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Sem permissão para cadastrar produtos';
  end if;
  if length(v_name) not between 2 and 180 then
    raise exception 'Nome do produto deve conter entre 2 e 180 caracteres';
  end if;
  if length(coalesce(v_sku,''))>80 then raise exception 'Código interno muito longo'; end if;
  if v_ean is not null and v_ean !~ '^[0-9]{8,14}$' then
    raise exception 'EAN precisa conter entre 8 e 14 números';
  end if;
  if length(coalesce(v_gondola,''))>40 or length(coalesce(v_prateleira,''))>40 then
    raise exception 'Gôndola ou prateleira muito longa';
  end if;
  if coalesce(array_length(p_tags,1),0)>30 then
    raise exception 'Número máximo de tags excedido';
  end if;
  if p_initial_quantity is null or p_initial_quantity<0 or p_initial_quantity>1000000 then
    raise exception 'Estoque inicial inválido';
  end if;

  insert into public.products(
    name,sku,ean,category_id,tags,gondola,prateleira,created_by,active
  ) values(
    v_name,v_sku,v_ean,p_category_id,coalesce(p_tags,'{}'::text[]),
    v_gondola,v_prateleira,v_actor,true
  ) returning id into v_id;

  -- Se falhar uma entrada no estoque, a transação desfaz também o produto.
  if p_initial_quantity>0 then
    if app_private.role_in('estoquista') then
      perform public.quick_stock_count(v_id,0,p_initial_quantity,'Cadastro inicial');
    else
      perform public.move_stock(v_id,'entrada',p_initial_quantity);
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_single_product_with_stock(text,text,text,uuid,text[],text,text,integer) from public,anon;
grant execute on function public.create_single_product_with_stock(text,text,text,uuid,text[],text,text,integer) to authenticated;

create or replace function public.create_apparel(
 p_name text,p_type text,p_audience text,p_age_group text,
 p_category_id uuid,p_tags text[],p_variants jsonb
) returns uuid language plpgsql security definer set search_path = ''
as $$
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
 if p_category_id is null or not exists (
    with recursive parents as (
      select id,parent_id,name from public.categories where id=p_category_id
      union all
      select c.id,c.parent_id,c.name from public.categories c join parents x on c.id=x.parent_id
    )
    select 1 from parents where parent_id is null and lower(name)='roupas'
 ) then
   raise exception 'Escolha uma categoria dentro de Roupas';
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
   v_color:=btrim(coalesce(v_variant->>'color',''));
   v_size:=upper(btrim(coalesce(v_variant->>'size','')));
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
   v_item_name:=p_name||' · '||v_color||' / '||v_size;
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
$$;
commit;
