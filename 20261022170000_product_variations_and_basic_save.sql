-- CDSB · gravação atômica do cadastro + variações + contagem auditada
-- A categoria define as variações disponíveis; nenhum SKU vazio é criado sem dados.
CREATE OR REPLACE FUNCTION public.save_product_basic_with_tags(
 p_id uuid,p_is_model boolean,p_name text,p_category uuid,p_tags text[],p_active boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_tag text; v_existing text; v_tags text[]:='{}'; v_seen text[]:='{}';
        v_name text:=btrim(coalesce(p_name,'')); v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('products.edit')
   THEN RAISE EXCEPTION 'Sem permissão para editar produtos'; END IF;
 IF char_length(v_name) NOT BETWEEN 1 AND 180
    THEN RAISE EXCEPTION 'Nome do produto inválido'; END IF;
 IF p_category IS NULL OR NOT EXISTS(SELECT 1 FROM public.categories WHERE id=p_category)
    THEN RAISE EXCEPTION 'Categoria inexistente'; END IF;
 IF coalesce(array_length(p_tags,1),0)>30
    THEN RAISE EXCEPTION 'Máximo de 30 tags'; END IF;
 FOREACH v_tag IN ARRAY coalesce(p_tags,'{}'::text[]) LOOP
  v_tag:=btrim(coalesce(v_tag,''));
  IF v_tag='' THEN CONTINUE; END IF;
  IF char_length(v_tag) NOT BETWEEN 2 AND 40 OR position(',' in v_tag)>0 THEN
    RAISE EXCEPTION 'Tag inválida: % (2 a 40 caracteres)',v_tag;
  END IF;
  IF lower(v_tag)=ANY(v_seen) THEN CONTINUE; END IF;
  v_seen:=array_append(v_seen,lower(v_tag));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('cdsb:tag:'||lower(v_tag)));
  SELECT name INTO v_existing FROM public.tags
   WHERE lower(name)=lower(v_tag) ORDER BY name LIMIT 1;
  IF v_existing IS NULL THEN
   IF NOT app_private.has_permission('tags.manage') THEN
    RAISE EXCEPTION 'Tag "%" ainda não existe. Cadastre em Tags ou utilize uma tag existente.',v_tag;
   END IF;
   INSERT INTO public.tags(name) VALUES(v_tag);
   v_existing:=v_tag;
  END IF;
  v_tags:=array_append(v_tags,v_existing);
  v_existing:=NULL;
 END LOOP;
 IF p_is_model THEN
  PERFORM public.update_product_model_basic(p_id,v_name,v_tags,p_category);
 ELSE
  UPDATE public.products
   SET name=v_name,tags=v_tags,category_id=p_category,active=coalesce(p_active,active)
   WHERE id=p_id AND force_archived_at IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
 END IF;
 RETURN p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_product_basic_with_tags(uuid,boolean,text,uuid,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_product_basic_with_tags(uuid,boolean,text,uuid,text[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_product_workspace(
 p_id uuid, p_is_model boolean, p_name text, p_category uuid, p_tags text[],
 p_active boolean, p_original_size text, p_type text, p_audience text,
 p_age_group text, p_rows jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_model_id uuid; v_model public.apparel_models%rowtype;
 v_product public.products%rowtype; v_template public.products%rowtype;
 v_item jsonb; v_size text; v_canonical text; v_original text;
 v_sku text; v_ean text; v_qty integer; v_expected integer; v_actual integer;
 v_existing uuid; v_allowed text[]; v_color text; v_seen text[]:='{}';
 v_need_conversion boolean:=false; v_ref uuid; v_reserved integer;
 v_created integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('products.edit') THEN
   RAISE EXCEPTION 'Sem permissão para editar produtos';
 END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>40 THEN
   RAISE EXCEPTION 'Lista de variações inválida';
 END IF;
 IF p_is_model THEN
   SELECT * INTO v_model FROM public.apparel_models
     WHERE id=p_id AND force_archived_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Modelo de produto não encontrado'; END IF;
   v_model_id:=v_model.id;
 ELSE
   SELECT * INTO v_product FROM public.products
     WHERE id=p_id AND force_archived_at IS NULL FOR UPDATE;
   IF NOT FOUND OR v_product.apparel_model_id IS NOT NULL THEN
     RAISE EXCEPTION 'Produto não encontrado ou já convertido em modelo';
   END IF;
 END IF;
 v_allowed:=app_private.category_variant_options(p_category);
 v_original:=lower(regexp_replace(btrim(coalesce(p_original_size,'')),'^tamanho[[:space:]]+','','i'));
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
   IF jsonb_typeof(v_item)<>'object' THEN RAISE EXCEPTION 'Variação inválida'; END IF;
   v_size:=btrim(coalesce(v_item->>'size',''));
   v_canonical:=lower(regexp_replace(v_size,'^tamanho[[:space:]]+','','i'));
   IF v_size='' OR NOT EXISTS(
      SELECT 1 FROM unnest(v_allowed) x
      WHERE lower(regexp_replace(btrim(x),'^tamanho[[:space:]]+','','i'))=v_canonical
   ) THEN RAISE EXCEPTION 'Tamanho não definido na categoria: %',v_size; END IF;
   IF v_canonical=ANY(v_seen) THEN RAISE EXCEPTION 'Tamanho duplicado: %',v_size; END IF;
   v_seen:=array_append(v_seen,v_canonical);
   IF NOT p_is_model AND v_original='' AND
      ((v_item->>'sku') IS DISTINCT FROM '' AND NULLIF(btrim(coalesce(v_item->>'sku','')),'') IS NOT NULL
        OR nullif(btrim(coalesce(v_item->>'ean','')),'') IS NOT NULL
        OR coalesce(nullif(v_item->>'quantity',''),'0')<>'0') THEN
     RAISE EXCEPTION 'Selecione o tamanho ao qual pertence o SKU atual antes de cadastrar novos tamanhos';
   END IF;
 END LOOP;
 IF NOT p_is_model AND v_original<>'' THEN
   IF NOT EXISTS(SELECT 1 FROM unnest(v_allowed) x
     WHERE lower(regexp_replace(btrim(x),'^tamanho[[:space:]]+','','i'))=v_original)
   THEN RAISE EXCEPTION 'Tamanho original não permitido pela categoria'; END IF;
   v_need_conversion:=true;
   IF NOT app_private.has_permission('products.create') THEN
     RAISE EXCEPTION 'Sem permissão para criar variações';
   END IF;
 END IF;
 PERFORM public.save_product_basic_with_tags(p_id,p_is_model,p_name,p_category,p_tags,p_active);
 IF v_need_conversion THEN
   v_model_id:=public.convert_single_product_to_apparel(
     p_id,p_original_size,p_type,p_audience,p_age_group);
 ELSIF NOT p_is_model THEN
   RETURN NULL::uuid;
 END IF;
 SELECT * INTO v_model FROM public.apparel_models WHERE id=v_model_id FOR UPDATE;
 SELECT * INTO v_template FROM public.products
    WHERE apparel_model_id=v_model_id AND force_archived_at IS NULL
    ORDER BY created_at,id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Modelo sem SKU de referência'; END IF;
 v_color:=coalesce(nullif(v_template.apparel_color,''),'Única');
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
   v_size:=btrim(v_item->>'size');
   v_canonical:=lower(regexp_replace(v_size,'^tamanho[[:space:]]+','','i'));
   IF v_need_conversion AND v_canonical=v_original THEN CONTINUE; END IF;
   v_sku:=nullif(btrim(coalesce(v_item->>'sku','')),'');
   v_ean:=nullif(regexp_replace(coalesce(v_item->>'ean',''),'[[:space:]-]','','g'),'');
   IF length(coalesce(v_sku,''))>80 OR (v_ean IS NOT NULL AND v_ean!~'^[0-9]{8,14}$') THEN
     RAISE EXCEPTION 'SKU ou EAN inválido no tamanho %',v_size;
   END IF;
   IF coalesce(v_item->>'quantity','') !~ '^[0-9]{1,7}$' THEN
     RAISE EXCEPTION 'Informe estoque inteiro entre 0 e 1.000.000 em %',v_size;
   END IF;
   v_qty:=(v_item->>'quantity')::integer;
   IF v_qty>1000000 THEN RAISE EXCEPTION 'Estoque acima de 1.000.000 no tamanho %',v_size; END IF;
   v_existing:=nullif(v_item->>'id','')::uuid;
   SELECT * INTO v_product FROM public.products p
     WHERE p.apparel_model_id=v_model_id AND p.force_archived_at IS NULL
       AND lower(coalesce(p.apparel_color,'Única'))=lower(v_color)
       AND lower(regexp_replace(btrim(p.apparel_size),'^tamanho[[:space:]]+','','i'))=v_canonical
     FOR UPDATE;
   IF FOUND THEN
     IF v_existing IS DISTINCT FROM v_product.id THEN
       RAISE EXCEPTION 'As variações mudaram. Recarregue a ficha de %',v_size;
     END IF;
     IF NOT v_product.active THEN
       RAISE EXCEPTION 'Reative o tamanho % antes de editá-lo',v_size;
     END IF;
     IF coalesce(v_product.sku,'') IS DISTINCT FROM coalesce(v_item->>'expected_sku','')
       OR coalesce(v_product.ean,'') IS DISTINCT FROM coalesce(v_item->>'expected_ean','')
     THEN RAISE EXCEPTION 'Códigos alterados em outra sessão (%). Atualize o cadastro',v_size; END IF;
     IF coalesce(v_product.sku,'') IS DISTINCT FROM coalesce(v_sku,'')
       OR coalesce(v_product.ean,'') IS DISTINCT FROM coalesce(v_ean,'') THEN
       UPDATE public.products SET sku=v_sku,ean=v_ean WHERE id=v_product.id;
     END IF;
     v_ref:=v_product.id;
   ELSE
     IF v_existing IS NOT NULL THEN
       RAISE EXCEPTION 'Variação % não está mais disponível. Atualize o cadastro',v_size;
     END IF;
     IF v_qty=0 AND v_sku IS NULL AND v_ean IS NULL THEN CONTINUE; END IF;
     IF NOT app_private.has_permission('products.create') THEN
       RAISE EXCEPTION 'Sem permissão para cadastrar novas variações';
     END IF;
     INSERT INTO public.products (
       name,sku,ean,category_id,tags,apparel_model_id,apparel_size,apparel_color,
       gondola,prateleira,image_path,image_paths,created_by,
       min_stock,minimum_order_quantity,supplier_id,sale_price,cost_price,sales_unit
     ) VALUES (
       v_model.name||' · '||v_size,v_sku,v_ean,v_model.category_id,v_model.tags,
       v_model_id,v_size,v_color,v_template.gondola,v_template.prateleira,
       v_model.image_path,v_model.image_paths,auth.uid(),v_template.min_stock,
       v_template.minimum_order_quantity,v_template.supplier_id,
       v_template.sale_price,v_template.cost_price,v_template.sales_unit
     ) RETURNING id INTO v_ref;
     INSERT INTO public.stock_balances(product_id,event_id,quantity)
       VALUES(v_ref,NULL,0) ON CONFLICT (product_id) WHERE event_id IS NULL DO NOTHING;
     v_created:=v_created+1;
   END IF;
   SELECT coalesce((SELECT b.quantity FROM public.stock_balances b
     WHERE b.product_id=v_ref AND b.event_id IS NULL),0) INTO v_actual;
   IF v_actual IS DISTINCT FROM v_qty THEN
     IF not app_private.has_permission('stock.balance') THEN
       RAISE EXCEPTION 'Sem permissão para ajustar estoque em %',v_size;
     END IF;
     IF v_existing IS NOT NULL AND
        v_actual IS DISTINCT FROM nullif(v_item->>'expected_quantity','')::integer THEN
       RAISE EXCEPTION 'Estoque de % foi alterado em outra sessão. Atualize o cadastro',v_size;
     END IF;
     SELECT coalesce(sum(r.quantity),0)::integer INTO v_reserved
       FROM public.stock_reservations r WHERE r.product_id=v_ref AND r.status='ativa';
     IF v_qty<v_reserved THEN
       RAISE EXCEPTION 'Estoque em % menor que % unidade(s) reservada(s)',v_size,v_reserved;
     END IF;
     PERFORM public.quick_stock_count(v_ref,v_actual,v_qty,'Contagem pelo cadastro de variações');
   END IF;
 END LOOP;
 RETURN v_model_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_product_workspace(uuid,boolean,text,uuid,text[],boolean,text,text,text,text,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_product_workspace(uuid,boolean,text,uuid,text[],boolean,text,text,text,text,jsonb)
 TO authenticated;
