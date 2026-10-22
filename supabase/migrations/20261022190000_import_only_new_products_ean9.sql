-- Somente novos produtos: SKU, EAN completo e sufixo de 9 dígitos.
-- O parâmetro p_update_existing fica na assinatura por compatibilidade, mas é ignorado.
-- Nenhum cadastro, foto, variação ou estoque existente é alterado.
create or replace function public.import_products_batch(
  p_rows jsonb, p_create_categories boolean default false,
  p_update_existing boolean default false, p_import_initial_stock boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb; v_sku text; v_name text; v_ean text; v_barcode text;
  v_unit text; v_tags text[]; v_tag text; v_canonical_tag text;
  v_price numeric; v_min integer; v_order_min integer; v_initial integer;
  v_supplier uuid; v_supplier_name text; v_category uuid; v_parent uuid;
  v_category_name text; v_level integer; v_parent_depth integer;
  v_category_fields text[]; v_model uuid; v_family text; v_size text; v_color text;
  v_garment text; v_audience text; v_age text; v_product uuid;
  v_count integer := 0; v_inserted integer := 0; v_updated integer := 0; v_skipped integer := 0;
  v_created_categories integer := 0; v_stock_entries integer := 0;
begin
  if v_actor is null or not app_private.role_in('admin') then
    raise exception 'Somente um administrador pode importar o catálogo';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then
    raise exception 'Envie até 60 registros por lote';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(782622,915019);
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
    -- Antes de criar categorias, tags, modelos ou movimentar estoque:
    -- ignorar SKU/EAN existentes, inclusive inativos ou arquivados.
    if exists (
      select 1 from public.products p
      where lower(btrim(coalesce(p.sku,'')))=lower(v_sku)
         or (v_ean is not null and (
          regexp_replace(coalesce(p.ean,''),'[[:space:]-]','','g')=v_ean
          or (v_ean ~ '^[0-9]{9,}$'
           and regexp_replace(coalesce(p.ean,''),'[[:space:]-]','','g') ~ '^[0-9]{9,}$'
           and right(regexp_replace(coalesce(p.ean,''),'[[:space:]-]','','g'),9)=right(v_ean,9))
         ))
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_unit := upper(btrim(coalesce(nullif(v_row->>'Unidade',''),'UN')));
    if v_unit not in ('UN','PC','CX') then raise exception 'SKU %: unidade inválida',v_sku;end if;
    v_price := nullif(replace(coalesce(v_row->>'Preco venda',''),' ',''),'')::numeric;
    if v_price is not null and (v_price<0 or v_price>99999999.99) then
      raise exception 'SKU %: preço inválido',v_sku;
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
      nullif(btrim(coalesce(v_row->>'Subcategoria','')),''),
      nullif(btrim(coalesce(v_row->>'Subsubcategoria','')),'')
    ];
    if v_category_fields[1] is null or v_category_fields[1] in ('A classificar','Operacionais') then
      raise exception 'SKU %: categoria deve ser revisada',v_sku;
    end if;
    for v_level in 1..3 loop
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
      insert into public.products(
        name,sku,ean,category_id,tags,supplier_id,
        min_stock,minimum_order_quantity,gondola,prateleira,created_by,active,
        apparel_model_id,apparel_size,apparel_color,sale_price,sales_unit,
        sap_code,legacy_code,external_photo_url
      ) values(
        v_name,v_sku,v_ean,v_category,v_tags,v_supplier,
        v_min,v_order_min,nullif(v_row->>'Gondola',''),nullif(v_row->>'Prateleira',''),
        v_actor,coalesce(upper(v_row->>'Ativo'),'SIM')='SIM',
        v_model,v_size,v_color,v_price,v_unit,
        nullif(v_row->>'Codigo SAP',''),nullif(v_row->>'Codigo original',''),
        nullif(v_row->>'Foto URL','')
      ) returning id into v_product;
      v_inserted := v_inserted+1;
      if v_initial is not null and v_initial>0 then
        perform public.move_stock(v_product,'entrada',v_initial);
        v_stock_entries:=v_stock_entries+1;
      end if;
  end loop;
  return jsonb_build_object('total',v_count,'inseridos',v_inserted,'atualizados',v_updated,
    'ignorados',v_skipped,'categoriasCriadas',v_created_categories,'estoquesLancados',v_stock_entries);
end;
$$;

revoke all on function public.import_products_batch(jsonb,boolean,boolean,boolean) from public,anon;
grant execute on function public.import_products_batch(jsonb,boolean,boolean,boolean) to authenticated;
comment on function public.import_products_batch(jsonb,boolean,boolean,boolean)
is 'Importação exclusiva de novos produtos. SKU/EAN/sufixo9 existentes são ignorados; nunca atualiza qualquer registro preexistente.';
