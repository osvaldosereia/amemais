CREATE OR REPLACE FUNCTION public.set_staff_access(p_user_id uuid, p_role text, p_permissions text[], p_store_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_permission text;v_store uuid;v_oldrole text;v_main uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.staff_profiles WHERE id=auth.uid() AND active AND archived_at IS NULL AND role='admin'
 ) THEN RAISE EXCEPTION 'Somente administradores ativos podem atribuir autorizações';END IF;
 IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'Não altere suas próprias autorizações';END IF;
 IF p_role NOT IN ('admin','gerente','estoquista','evento','consulta','franquia')
 THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
 SELECT role INTO v_oldrole FROM public.staff_profiles
 WHERE id=p_user_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado ou arquivado';END IF;
 IF cardinality(coalesce(p_permissions,array[]::text[]))=0
 THEN RAISE EXCEPTION 'Selecione ao menos uma permissão';END IF;
 IF cardinality(p_permissions)<>cardinality(ARRAY(SELECT DISTINCT unnest(p_permissions)))
 THEN RAISE EXCEPTION 'Permissão repetida';END IF;
 IF cardinality(coalesce(p_store_ids,array[]::uuid[]))<>cardinality(ARRAY(SELECT DISTINCT unnest(coalesce(p_store_ids,array[]::uuid[]))))
 THEN RAISE EXCEPTION 'Unidade repetida';END IF;
 FOREACH v_permission IN ARRAY p_permissions LOOP
  IF NOT EXISTS(SELECT 1 FROM public.permission_definitions WHERE permission=v_permission)
  THEN RAISE EXCEPTION 'Permissão desconhecida: %',v_permission;END IF;
 END LOOP;
 FOREACH v_store IN ARRAY coalesce(p_store_ids,array[]::uuid[]) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id=v_store AND active)
  THEN RAISE EXCEPTION 'Unidade inexistente ou inativa'; END IF;
 END LOOP;
 SELECT id INTO v_main FROM public.stores WHERE is_primary AND active LIMIT 1;
 IF p_role='franquia' THEN
  IF p_permissions<>ARRAY['products.read','orders.franchise']::text[]
    AND (p_permissions @> ARRAY['products.read','orders.franchise']::text[]) IS NOT TRUE
   THEN RAISE EXCEPTION 'Perfil Loja precisa de catálogo e pedidos'; END IF;
  IF cardinality(p_permissions)<>2
   OR cardinality(coalesce(p_store_ids,array[]::uuid[]))<>1
   OR NOT EXISTS(SELECT 1 FROM public.stores WHERE id=p_store_ids[1] AND kind='franquia' AND active)
  THEN RAISE EXCEPTION 'Loja permanente exige uma unidade ativa e somente pedidos/catálogo';END IF;
 ELSIF p_role='estoquista' THEN
  IF NOT (p_permissions @> ARRAY['products.read','orders.read','orders.separate']::text[])
     OR cardinality(p_permissions)<>3
     OR cardinality(coalesce(p_store_ids,array[]::uuid[]))<>1
     OR p_store_ids[1] IS DISTINCT FROM v_main
  THEN RAISE EXCEPTION 'Separador só pode conferir pedidos no CDSB'; END IF;
 ELSIF p_role='evento' THEN
  IF NOT (p_permissions @> ARRAY['products.read','events.read','events.request']::text[])
     OR cardinality(p_permissions)<>3
     OR cardinality(coalesce(p_store_ids,array[]::uuid[]))<>0
  THEN RAISE EXCEPTION 'Responsável de evento usa apenas o perfil de solicitação e conferência';END IF;
 ELSIF p_role='consulta' THEN
  IF EXISTS(SELECT 1 FROM unnest(p_permissions) permission
    WHERE permission NOT IN ('products.read','orders.read','stores.read','movements.read',
      'movements.export','events.read'))
  THEN RAISE EXCEPTION 'Consulta somente pode receber permissões de leitura';END IF;
 ELSIF p_role='gerente' THEN
  IF p_permissions && ARRAY['users.manage','events.sell']::text[]
  THEN RAISE EXCEPTION 'Gerentes não podem administrar usuários ou registrar vendas de eventos';END IF;
 END IF;
 UPDATE public.staff_profiles SET role=p_role,permissions_customized=true WHERE id=p_user_id;
 DELETE FROM public.staff_permissions WHERE user_id=p_user_id;
 INSERT INTO public.staff_permissions(user_id,permission)
 SELECT p_user_id,v FROM unnest(p_permissions) AS v;
 DELETE FROM public.staff_stores WHERE user_id=p_user_id;
 INSERT INTO public.staff_stores(user_id,store_id)
 SELECT p_user_id,v FROM unnest(coalesce(p_store_ids,array[]::uuid[])) AS v;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('staff_profiles',p_user_id::text,'PERMISSIONS_UPDATED',auth.uid(),
 jsonb_build_object('old_role',v_oldrole,'role',p_role,'permissions',p_permissions,'store_ids',p_store_ids));
END;$function$
;
