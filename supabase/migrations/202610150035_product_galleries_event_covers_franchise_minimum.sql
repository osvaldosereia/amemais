
-- Galerias (máximo de três imagens) e capa de lojas temporárias.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.apparel_models ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_path text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS franchise_min_qty integer;
UPDATE public.products SET image_paths=ARRAY[image_path] WHERE image_path IS NOT NULL AND cardinality(image_paths)=0;
UPDATE public.apparel_models SET image_paths=ARRAY[image_path] WHERE image_path IS NOT NULL AND cardinality(image_paths)=0;
ALTER TABLE public.products ADD CONSTRAINT products_gallery_max_three CHECK (cardinality(image_paths)<=3);
ALTER TABLE public.apparel_models ADD CONSTRAINT apparel_gallery_max_three CHECK (cardinality(image_paths)<=3);
ALTER TABLE public.categories ADD CONSTRAINT category_franchise_min_qty CHECK (franchise_min_qty IS NULL OR franchise_min_qty BETWEEN 1 AND 1000000);
CREATE OR REPLACE FUNCTION public.set_apparel_gallery(p_model uuid,p_paths text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_first text;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('products.edit')
    OR NOT app_private.role_in('admin','gerente','estoquista') THEN
    RAISE EXCEPTION 'Sem autorização para modificar fotos';
 END IF;
 IF p_paths IS NULL OR cardinality(p_paths)>3 OR array_position(p_paths,NULL) IS NOT NULL
    OR EXISTS(SELECT 1 FROM unnest(p_paths) path WHERE length(path)>400 OR path='' OR path !~ '^apparel/[0-9a-f-]{36}/')
 THEN RAISE EXCEPTION 'Galeria inválida (até três imagens)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.apparel_models WHERE id=p_model) THEN RAISE EXCEPTION 'Modelo não encontrado'; END IF;
 v_first:=p_paths[1];
 UPDATE public.apparel_models SET image_paths=p_paths,image_path=v_first WHERE id=p_model;
 UPDATE public.products SET image_paths=p_paths,image_path=v_first WHERE apparel_model_id=p_model;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('apparel_models',p_model::text,'GALLERY_UPDATED',auth.uid(),jsonb_build_object('photos',cardinality(p_paths)));
END;$fn$;
REVOKE ALL ON FUNCTION public.set_apparel_gallery(uuid,text[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_apparel_gallery(uuid,text[]) TO authenticated;

-- Quantidade mínima por SKU, herdada da categoria pai mais próxima.
CREATE OR REPLACE FUNCTION app_private.franchise_minimum(p_category uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 WITH RECURSIVE chain AS (
  SELECT id,parent_id,franchise_min_qty,0 AS distance FROM public.categories WHERE id=p_category
  UNION ALL
  SELECT c.id,c.parent_id,c.franchise_min_qty,chain.distance+1
  FROM public.categories c JOIN chain ON c.id=chain.parent_id WHERE chain.distance<5
 )
 SELECT coalesce((SELECT franchise_min_qty FROM chain WHERE franchise_min_qty IS NOT NULL ORDER BY distance LIMIT 1),0);
$fn$;
REVOKE ALL ON FUNCTION app_private.franchise_minimum(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.franchise_minimum(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.validate_franchise_order_minimum()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_kind text;v_min integer;v_product text;
BEGIN
 SELECT s.kind INTO v_kind FROM public.store_orders o
 JOIN public.stores s ON s.id=o.to_store_id WHERE o.id=NEW.order_id;
 IF v_kind='franquia' THEN
  SELECT app_private.franchise_minimum(coalesce(m.category_id,p.category_id)),p.name
  INTO v_min,v_product FROM public.products p
  LEFT JOIN public.apparel_models m ON m.id=p.apparel_model_id WHERE p.id=NEW.product_id;
  IF NEW.quantity<coalesce(v_min,0) THEN
    RAISE EXCEPTION 'Pedido mínimo para %: % unidade(s) por tamanho/SKU',v_product,v_min;
  END IF;
 END IF;
 RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS check_franchise_order_minimum ON public.store_order_items;
CREATE TRIGGER check_franchise_order_minimum BEFORE INSERT OR UPDATE OF quantity,product_id,order_id
ON public.store_order_items FOR EACH ROW EXECUTE FUNCTION app_private.validate_franchise_order_minimum();

-- Bucket privado para capas; usuários autenticados acessam e gestores modificam.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ame-eventos','ame-eventos',false,2097152,ARRAY['image/webp','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY ame_event_cover_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='ame-eventos' AND app_private.is_active());
CREATE POLICY ame_event_cover_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='ame-eventos' AND app_private.has_permission('events.manage'));
CREATE POLICY ame_event_cover_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='ame-eventos' AND app_private.has_permission('events.manage'));
