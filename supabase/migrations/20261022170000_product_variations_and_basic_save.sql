-- Cadastro conjunto de tamanhos de um SKU legado em uma única transação.
-- A conversão e as novas entradas de estoque falham ou confirmam em conjunto.
CREATE OR REPLACE FUNCTION public.convert_single_product_with_variants(
 p_product_id uuid,p_size text,p_type text,p_audience text,p_age_group text,p_variants jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_model uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin','gerente','estoquista')
    OR NOT app_private.has_permission('products.create')
    OR NOT app_private.has_permission('products.edit') THEN
  RAISE EXCEPTION 'Sem permissão para cadastrar variações';
 END IF;
 IF p_variants IS NULL OR jsonb_typeof(p_variants)<>'array' OR
    jsonb_array_length(p_variants)>32 THEN
   RAISE EXCEPTION 'Informe até 32 variações válidas';
 END IF;
 v_model:=public.convert_single_product_to_apparel(
    p_product_id,p_size,p_type,p_audience,p_age_group);
 IF jsonb_array_length(p_variants)>0 THEN
   PERFORM public.add_apparel_variants_with_location(v_model,p_variants);
 END IF;
 RETURN v_model;
END;
$fn$;
REVOKE ALL ON FUNCTION public.convert_single_product_with_variants(uuid,text,text,text,text,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_single_product_with_variants(uuid,text,text,text,text,jsonb)
 TO authenticated;

-- O mesmo salvamento de cadastro é usado para produtos únicos e modelos.
-- Tags novas só podem ser criadas quando há permissão de gerenciar tags;
-- tudo é atômico, inclusive a atualização do produto/modelo.
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
 IF NOT EXISTS(SELECT 1 FROM public.categories WHERE id=p_category)
    THEN RAISE EXCEPTION 'Categoria inexistente'; END IF;
 IF coalesce(array_length(p_tags,1),0)>30
    THEN RAISE EXCEPTION 'Máximo de 30 tags'; END IF;
 FOREACH v_tag IN ARRAY coalesce(p_tags,'{}'::text[]) LOOP
  v_tag:=btrim(v_tag);
  IF v_tag='' THEN CONTINUE; END IF;
  IF char_length(v_tag) NOT BETWEEN 2 AND 40 OR position(',' in v_tag)>0 THEN
    RAISE EXCEPTION 'Tag inválida: % (2 a 40 caracteres)',v_tag;
  END IF;
  IF lower(v_tag)=ANY(v_seen) THEN CONTINUE; END IF;
  v_seen:=array_append(v_seen,lower(v_tag));
  -- Proteção contra registros concorrentes do mesmo nome, sem duplicar tags.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('cdsb:tag:'||lower(v_tag)));
  SELECT name INTO v_existing FROM public.tags
   WHERE lower(name)=lower(v_tag) ORDER BY name LIMIT 1;
  IF v_existing IS NULL THEN
   IF NOT app_private.has_permission('tags.manage') THEN
    RAISE EXCEPTION 'Tag "%" não existe. Solicite o cadastro em Tags ou escolha uma tag existente.',v_tag;
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
  IF v_count<>1 THEN RAISE EXCEPTION 'Produto não encontrado ou desativado'; END IF;
 END IF;
 RETURN p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_product_basic_with_tags(uuid,boolean,text,uuid,text[],boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_product_basic_with_tags(uuid,boolean,text,uuid,text[],boolean)
 TO authenticated;
