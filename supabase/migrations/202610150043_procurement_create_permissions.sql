-- Metadados de reposição podem ser gravados pelo cadastrador original sem conceder edição global.
CREATE OR REPLACE FUNCTION public.set_product_procurement(p_product uuid,p_supplier uuid,p_min_stock integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_creator uuid;
BEGIN
 SELECT created_by INTO v_creator FROM public.products WHERE id=p_product FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto inexistente'; END IF;
 IF auth.uid() IS NULL OR NOT (
  app_private.has_permission('products.edit') OR
  (app_private.has_permission('products.create') AND v_creator=auth.uid())
 ) THEN RAISE EXCEPTION 'Sem autorização para configuração de compra'; END IF;
 IF p_min_stock IS NULL OR p_min_stock NOT BETWEEN 0 AND 1000000
 THEN RAISE EXCEPTION 'Estoque mínimo inválido'; END IF;
 IF p_supplier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier AND active)
 THEN RAISE EXCEPTION 'Fornecedor inválido ou inativo'; END IF;
 UPDATE public.products SET supplier_id=p_supplier,min_stock=p_min_stock WHERE id=p_product;
END;$fn$;
REVOKE ALL ON FUNCTION public.set_product_procurement(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_product_procurement(uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_apparel_procurement(p_model uuid,p_supplier uuid,p_min_stock integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_creator uuid;
BEGIN
 SELECT created_by INTO v_creator FROM public.apparel_models WHERE id=p_model FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado'; END IF;
 IF auth.uid() IS NULL OR NOT (
   app_private.has_permission('products.edit') OR
   (app_private.has_permission('products.create') AND v_creator=auth.uid())
 ) THEN RAISE EXCEPTION 'Sem permissão para alterar reposição do modelo'; END IF;
 IF p_min_stock IS NULL OR p_min_stock NOT BETWEEN 0 AND 1000000
 THEN RAISE EXCEPTION 'Estoque mínimo inválido'; END IF;
 IF p_supplier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier AND active)
 THEN RAISE EXCEPTION 'Fornecedor não disponível'; END IF;
 UPDATE public.products SET supplier_id=p_supplier,min_stock=p_min_stock
 WHERE apparel_model_id=p_model;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('apparel_models',p_model::text,'PROCUREMENT_UPDATED',auth.uid(),
  jsonb_build_object('supplier_id',p_supplier,'min_per_sku',p_min_stock));
END;$fn$;
REVOKE ALL ON FUNCTION public.set_apparel_procurement(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_apparel_procurement(uuid,uuid,integer) TO authenticated;
