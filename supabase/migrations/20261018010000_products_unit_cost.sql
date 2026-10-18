-- Custo unitário de aquisição opcional por SKU/variação.
-- NULL = ainda não informado; nunca estimar com base no preço de venda.
alter table public.products add column if not exists cost_price numeric(12,2);
alter table public.products add constraint products_cost_price_valid
  check (cost_price is null or (cost_price >= 0 and cost_price <= 99999999.99));
comment on column public.products.cost_price is
 'Preço de custo unitário em reais. NULL significa custo desconhecido; 0 é um custo informado explicitamente.';

-- Atualiza a mesma RPC do catálogo preservando assinatura, permissões e estoque.
-- Suporte a hierarquias de categorias do CDSB com mais de três níveis.
create or replace function public.import_products_batch(
  p_rows jsonb, p_create_categories boolean default false,
  p_update_existing boolean default false, p_import_initial_stock boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb; v_sku text; v_name text; v_ean text; v_barcode text;
  v_unit text; v_tags text[]; v_tag text; v_canonical_tag text;
  v_price numeric; v_cost numeric; v_min integer; v_order_min integer; v_initial integer;
  v_supplier uuid; v_supplier_name text; v_category uuid; v_parent uuid;
  v_category_name text; v_level integer; v_parent_depth integer;
  v_category_fields text[]; v_model uuid; v_family text; v_size text; v_color text;
  v_garment text; v_audience text; v_age text; v_existing uuid; v_product uuid;
  v_count integer := 0; v_inserted integer := 0; v_updated integer := 0; v_skipped integer := 0;
  v_created_categories integer := 0; v_stock_entries integer := 0;
begin
  if v_actor is null or not app_private.role_in('admin') then
    raise exception 'Somente um administrador pode importar o catálogo';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then
    raise exception 'Envie até 60 registros por lote';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_count := v_count + 1;
    if upper(btrim(coalesce(v_row->>'Importar',''))) <> 'SIM' then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_sku := nullif(btrim(coalesce(v_row->>'SKU','')),'');
    v_name := btrim(coalesce(v_row->>'Nome',''));
    v_ean := nullif(regexp_replace(coalesce(v_row->>'Codigo de barras',''),'[[:space:]-]','','g'),'');
    if v_sku is null or length(v_sku)>80 or length(v_name) not between 2 and 180 then
      raise exception 'Linha %: SKU ou nome inválido',v_count;
    end if;
    if v_ean is not null and v_ean !~ '^[0-9]{8,14}$' then
      raise exception 'SKU %: código de barras deve conter de 8 a 14 dígitos',v_sku;
    end if;
    v_unit := upper(btrim(coalesce(nullif(v_row->>'Unidade',''),'UN')));
    if v_unit not in ('UN','PC','CX') then raise exception 'SKU %: unidade inválida',v_sku;end if;
    v_price := nullif(replace(coalesce(v_row->>'Preco venda',''),' ',''),'')::numeric;
    if v_price is not null and (v_price<0 or v_price>99999999.99) then
      raise exception 'SKU %: preço inválido',v_sku;
    end if;
    v_cost := nullif(replace(replace(btrim(coalesce(v_row->>'Preco custo','')),',','.'),' ',''),'')::numeric;
    if v_cost is not null and (v_cost < 0 or v_cost > 99999999.99 or v_cost <> round(v_cost,2)) then
      raise exception 'SKU %: preço de custo inválido',v_sku;
    end if;
    v_min := coalesce(nullif(v_row->>'Estoque minimo','')::integer,0);
    v_order_min := coalesce(nullif(v_row->>'Pedido minimo','')::integer,1);
    if v_min not between 0 and 1000000 or v_order_min not between 1 and 1000000 then
      raise exception 'SKU %: estoque mínimo ou pedido mínimo inválido',v_sku;
    end if;
    v_initial := nullif(v_row->>'Estoque inicial','')::integer;
    if v_initial is not null and (v_initial < 0 or v_initial > 1000000) then
      raise exception 'SKU %: estoque inicial inválido',v_sku;
    end if;
    if v_initial is not null and v_initial>0 and not p_import_initial_stock then
      raise exception 'SKU %: estoque inicial informado exige confirmação separada',v_sku;
    end if;
    v_supplier := null;
    v_supplier_name := nullif(btrim(coalesce(v_row->>'Fornecedor','')),'');
    if v_supplier_name is not null then
      select id into v_supplier from public.suppliers
      where lower(name)=lower(v_supplier_name) and active limit 1;
      if v_supplier is null then
        raise exception 'SKU %: fornecedor "%" não cadastrado',v_sku,v_supplier_name;
      end if;
    end if;
    v_parent := null; v_category := null; v_parent_depth := 0;
    v_category_fields := array[
      nullif(btrim(coalesce(v_row->>'Categoria','')),''),
      nullif(btrim(coalesce(v_row->>'Subcategoria','')),'')
    ] || coalesce(regexp_split_to_array(
      nullif(btrim(coalesce(v_row->>'Subsubcategoria','')),''),
      '[[:space:]]*>[[:space:]]*'), '{}'::text[]);
    if cardinality(v_category_fields)>8 then
      raise exception 'SKU %: caminho de categorias excede 8 níveis',v_sku;
    end if;
    if v_category_fields[1] is null or v_category_fields[1] in ('A classificar','Operacionais') then
      raise exception 'SKU %: categoria deve ser revisada',v_sku;
    end if;
    for v_level in 1..cardinality(v_category_fields) loop
      v_category_name := v_category_fields[v_level];
      exit when v_category_name is null;
      if length(v_category_name) not between 2 and 90 then
        raise exception 'SKU %: nome de categoria inválido',v_sku;
      end if;
      select id into v_category from public.categories
      where lower(name)=lower(v_category_name) and parent_id is not distinct from v_parent
      order by created_at,id limit 1;
      if v_category is null then
        if not p_create_categories then
          raise exception 'SKU %: categoria "%" não existe (autorize a criação)',v_sku,v_category_name;
        end if;
        insert into public.categories(name,parent_id,depth)
        values(v_category_name,v_parent,v_parent_depth+1)
        returning id into v_category;
        v_created_categories := v_created_categories + 1;
      end if;
      v_parent := v_category;
      v_parent_depth := v_parent_depth + 1;
    end loop;
    v_tags := '{}'::text[];
    for v_tag in select distinct btrim(x) from regexp_split_to_table(coalesce(v_row->>'Tags',''),',') x
      where length(btrim(x)) >= 2 and length(btrim(x)) <= 50 limit 30
    loop
      select name into v_canonical_tag from public.tags where lower(name)=lower(v_tag) limit 1;
      if v_canonical_tag is null then
        insert into public.tags(name) values(v_tag) returning name into v_canonical_tag;
      end if;
      v_tags := array_append(v_tags,v_canonical_tag);
    end loop;
    v_model := null;
    v_family := nullif(btrim(coalesce(v_row->>'Familia','')),'');
    v_size := nullif(upper(btrim(coalesce(v_row->>'Tamanho',''))),'');
    v_color := nullif(btrim(coalesce(v_row->>'Cor','')),'');
    if v_family is not null or v_size is not null or v_color is not null then
      if v_family is null or v_size is null or v_color is null then
        raise exception 'SKU %: variação exige Família, Tamanho e Cor definidos',v_sku;
      end if;
      if length(v_family)>110 or length(v_size)>16 or length(v_color)>40 or length(v_color)<2 then
        raise exception 'SKU %: modelo, tamanho ou cor inválido',v_sku;
      end if;
      v_garment := coalesce(nullif(v_row->>'Tipo roupa',''),'Outro');
      v_audience := coalesce(nullif(v_row->>'Publico',''),'Unissex');
      v_age := coalesce(nullif(v_row->>'Faixa etaria',''),'Adulto');
      if v_garment not in ('Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro')
        or v_audience not in ('Feminino','Masculino','Unissex')
        or v_age not in ('Adulto','Infantil','Bebê') then
        raise exception 'SKU %: atributos de vestuário inválidos',v_sku;
      end if;
      select id into v_model from public.apparel_models
       where lower(name)=lower(v_family) and category_id=v_category
       and force_archived_at is null
       order by created_at,id limit 1;
      if v_model is null then
        insert into public.apparel_models(
          name,garment_type,audience,age_group,category_id,tags,created_by
        ) values(v_family,v_garment,v_audience,v_age,v_category,v_tags,v_actor)
        returning id into v_model;
      end if;
    end if;
    select id into v_existing from public.products where sku=v_sku and active limit 1;
    if v_ean is not null and exists (
      select 1 from public.products where ean=v_ean and active
      and (v_existing is null or id<>v_existing)
    ) then
      raise exception 'SKU %: código de barras % já pertence a outro produto',v_sku,v_ean;
    end if;
    if v_existing is not null then
      if not p_update_existing then
        v_skipped := v_skipped + 1; continue;
      end if;
      if v_model is not null and exists(
        select 1 from public.products
        where id=v_existing and apparel_model_id is not null and apparel_model_id<>v_model
      ) then
        raise exception 'SKU %: modelo diferente do cadastrado; corrija antes de atualizar',v_sku;
      end if;
      update public.products set
        name=v_name,ean=coalesce(v_ean,ean),category_id=v_category,tags=v_tags,
        sale_price=coalesce(v_price,sale_price),cost_price=coalesce(v_cost,cost_price),sales_unit=v_unit,
        sap_code=coalesce(nullif(v_row->>'Codigo SAP',''),sap_code),
        legacy_code=coalesce(nullif(v_row->>'Codigo original',''),legacy_code),
        external_photo_url=coalesce(nullif(v_row->>'Foto URL',''),external_photo_url),
        supplier_id=coalesce(v_supplier,supplier_id),
        min_stock=v_min,minimum_order_quantity=v_order_min,
        gondola=coalesce(nullif(v_row->>'Gondola',''),gondola),
        prateleira=coalesce(nullif(v_row->>'Prateleira',''),prateleira),
        apparel_model_id=coalesce(v_model,apparel_model_id),
        apparel_size=coalesce(v_size,apparel_size),
        apparel_color=coalesce(v_color,apparel_color)
      where id=v_existing;
      v_updated := v_updated+1;
    else
      insert into public.products(
        name,sku,ean,category_id,tags,supplier_id,
        min_stock,minimum_order_quantity,gondola,prateleira,created_by,active,
        apparel_model_id,apparel_size,apparel_color,sale_price,cost_price,sales_unit,
        sap_code,legacy_code,external_photo_url
      ) values(
        v_name,v_sku,v_ean,v_category,v_tags,v_supplier,
        v_min,v_order_min,nullif(v_row->>'Gondola',''),nullif(v_row->>'Prateleira',''),
        v_actor,coalesce(upper(v_row->>'Ativo'),'SIM')='SIM',
        v_model,v_size,v_color,v_price,v_cost,v_unit,
        nullif(v_row->>'Codigo SAP',''),nullif(v_row->>'Codigo original',''),
        nullif(v_row->>'Foto URL','')
      ) returning id into v_product;
      v_inserted := v_inserted+1;
      if v_initial is not null and v_initial>0 then
        perform public.move_stock(v_product,'entrada',v_initial);
        v_stock_entries:=v_stock_entries+1;
      end if;
    end if;
    v_existing := null;
  end loop;
  return jsonb_build_object('total',v_count,'inseridos',v_inserted,'atualizados',v_updated,
    'ignorados',v_skipped,'categoriasCriadas',v_created_categories,'estoquesLancados',v_stock_entries);
end;
$$;
revoke all on function public.import_products_batch(jsonb,boolean,boolean,boolean) from public,anon;
grant execute on function public.import_products_batch(jsonb,boolean,boolean,boolean) to authenticated;
comment on function public.import_products_batch(jsonb,boolean,boolean,boolean)
is 'Admin-only, up to 60 rows per transaction. Existing stock never overwritten. Categorization needs explicit opt-in.';
