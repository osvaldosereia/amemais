-- Conversão transacional de SKU único em modelo com variações sem recriar o SKU.
-- Preserva product.id, EAN, SKU, saldos, reservas, pedidos e registros históricos.
CREATE OR REPLACE FUNCTION public.convert_single_product_to_apparel(
 p_product_id uuid, p_size text, p_type text, p_audience text, p_age_group text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_product public.products%rowtype;
 v_model_id uuid;
 v_size text;
BEGIN
 IF NOT app_private.role_in('admin','gerente','estoquista')
    OR NOT app_private.has_permission('products.create')
    OR NOT app_private.has_permission('products.edit') THEN
  RAISE EXCEPTION 'Sem permissão para ativar variações';
 END IF;
 SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND OR v_product.apparel_model_id IS NOT NULL
   OR v_product.force_archived_at IS NOT NULL OR NOT v_product.active THEN
  RAISE EXCEPTION 'Produto inválido ou já possui variações';
 END IF;
 IF length(btrim(v_product.name))>110 THEN
  RAISE EXCEPTION 'Reduza o nome do produto para até 110 caracteres';
 END IF;
 SELECT allowed INTO v_size
 FROM unnest(app_private.category_variant_options(v_product.category_id)) allowed
 WHERE lower(btrim(allowed))=lower(btrim(coalesce(p_size,'')))
 LIMIT 1;
 IF v_size IS NULL THEN RAISE EXCEPTION 'Tamanho não configurado na categoria'; END IF;
 IF p_type NOT IN ('Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro')
    OR p_audience NOT IN ('Feminino','Masculino','Unissex')
    OR p_age_group NOT IN ('Adulto','Infantil','Bebê') THEN
  RAISE EXCEPTION 'Classificação da roupa inválida';
 END IF;
 INSERT INTO public.apparel_models (
  name,garment_type,audience,age_group,category_id,tags,
  image_path,image_paths,created_by,historical_category_path
 ) VALUES (
  v_product.name,p_type,p_audience,p_age_group,v_product.category_id,
  v_product.tags,v_product.image_path,v_product.image_paths,
  auth.uid(),v_product.historical_category_path
 ) RETURNING id INTO v_model_id;
 UPDATE public.products
 SET apparel_model_id=v_model_id, apparel_size=v_size, apparel_color='Única',
     name=v_product.name||' · '||v_size
 WHERE id=p_product_id;
 RETURN v_model_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.convert_single_product_to_apparel(uuid,text,text,text,text)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_single_product_to_apparel(uuid,text,text,text,text)
 TO authenticated;
