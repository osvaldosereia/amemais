-- Expande a galeria de modelos e produtos individuais de 3 para 6 fotos.
-- Preserva caminhos, imagens, saldos e histórico já existentes.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_gallery_max_three;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_gallery_max_six;
ALTER TABLE public.products ADD CONSTRAINT products_gallery_max_six
 CHECK (image_paths IS NULL OR cardinality(image_paths) <= 6);
ALTER TABLE public.apparel_models DROP CONSTRAINT IF EXISTS apparel_gallery_max_three;
ALTER TABLE public.apparel_models DROP CONSTRAINT IF EXISTS apparel_gallery_max_six;
ALTER TABLE public.apparel_models ADD CONSTRAINT apparel_gallery_max_six
 CHECK (image_paths IS NULL OR cardinality(image_paths) <= 6);

CREATE OR REPLACE FUNCTION public.set_apparel_gallery(p_model uuid, p_paths text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_first text;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('products.edit')
    OR NOT app_private.role_in('admin','gerente','estoquista') THEN
    RAISE EXCEPTION 'Sem autorização para modificar fotos';
 END IF;
 IF p_paths IS NULL OR cardinality(p_paths)>6 OR array_position(p_paths,NULL) IS NOT NULL
    OR EXISTS(SELECT 1 FROM unnest(p_paths) path WHERE length(path)>400 OR path='' OR path !~ '^apparel/[0-9a-f-]{36}/')
 THEN RAISE EXCEPTION 'Galeria inválida (até seis imagens)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.apparel_models WHERE id=p_model) THEN RAISE EXCEPTION 'Modelo não encontrado'; END IF;
 v_first:=p_paths[1];
 UPDATE public.apparel_models SET image_paths=p_paths,image_path=v_first WHERE id=p_model;
 UPDATE public.products SET image_paths=p_paths,image_path=v_first WHERE apparel_model_id=p_model;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('apparel_models',p_model::text,'GALLERY_UPDATED',auth.uid(),jsonb_build_object('photos',cardinality(p_paths)));
END;$function$;
