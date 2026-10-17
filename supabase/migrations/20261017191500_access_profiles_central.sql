-- AME MAIS | perfis administráveis sem substituir as permissões efetivas existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.access_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{2,63}$'),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 90),
 description text NOT NULL DEFAULT '' CHECK (length(description)<=500),
 role_kind text NOT NULL CHECK (role_kind IN ('admin','gerente','estoquista','evento','consulta','franquia')),
 is_system boolean NOT NULL DEFAULT false,
 is_protected boolean NOT NULL DEFAULT false,
 is_active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.access_profile_permissions (
 profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
 permission text NOT NULL REFERENCES public.permission_definitions(permission),
 PRIMARY KEY(profile_id,permission)
);
CREATE TABLE IF NOT EXISTS public.staff_profile_assignments (
 user_id uuid PRIMARY KEY REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE RESTRICT,
 managed boolean NOT NULL DEFAULT false,
 assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_profile_assignments_profile_idx
 ON public.staff_profile_assignments(profile_id);

ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profile_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_profiles_admin_read ON public.access_profiles;
CREATE POLICY access_profiles_admin_read ON public.access_profiles
 FOR SELECT TO authenticated USING (app_private.role_in('admin'));
DROP POLICY IF EXISTS access_profile_permissions_admin_read ON public.access_profile_permissions;
CREATE POLICY access_profile_permissions_admin_read ON public.access_profile_permissions
 FOR SELECT TO authenticated USING (app_private.role_in('admin'));
DROP POLICY IF EXISTS staff_profile_assignments_admin_read ON public.staff_profile_assignments;
CREATE POLICY staff_profile_assignments_admin_read ON public.staff_profile_assignments
 FOR SELECT TO authenticated USING (app_private.role_in('admin'));
REVOKE ALL ON public.access_profiles,public.access_profile_permissions,
 public.staff_profile_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.access_profiles,public.access_profile_permissions,
 public.staff_profile_assignments TO authenticated;

-- Perfis-base servem de referência. Não alteramos o acesso efetivo de nenhum usuário.
INSERT INTO public.access_profiles(code,name,description,role_kind,is_system,is_protected)
VALUES
 ('admin_cdsb','Administrador CDSB','Acesso administrativo protegido.','admin',true,true),
 ('gerente_cdsb','Gerente CDSB','Gestão operacional do centro de distribuição.','gerente',true,true),
 ('separador_cdsb','Separador CDSB','Separação e conferência de pedidos.','estoquista',true,true),
 ('responsavel_evento','Responsável por loja temporária','Operação de evento autorizado.','evento',true,true),
 ('consulta_cdsb','Consulta','Visualização de informações autorizadas.','consulta',true,true),
 ('loja_permanente','Loja permanente','Pedidos da franquia vinculada.','franquia',true,true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.access_profile_permissions(profile_id,permission)
SELECT ap.id,pd.permission FROM public.access_profiles ap
JOIN public.permission_definitions pd ON
 CASE ap.role_kind
  WHEN 'admin' THEN true
  WHEN 'gerente' THEN pd.permission=ANY(ARRAY[
   'products.read','products.create','products.edit','products.delete',
   'stock.entry','stock.exit','stock.balance','stock.destinations',
   'events.read','events.manage','events.separate','events.return','events.close',
   'orders.read','orders.internal','orders.assign','orders.central',
   'orders.franchise','orders.separate','orders.receive','orders.cancel',
   'orders.dispatch','movements.read','movements.export','categories.manage',
   'tags.manage','catalog.manage','products.share','stores.read','stores.manage','purchases.manage'])
  WHEN 'estoquista' THEN pd.permission=ANY(ARRAY['products.read','orders.read','orders.separate'])
  WHEN 'evento' THEN pd.permission=ANY(ARRAY['products.read','events.read','events.request'])
  WHEN 'consulta' THEN pd.permission=ANY(ARRAY['products.read','events.read','orders.read','movements.read','stores.read'])
  WHEN 'franquia' THEN pd.permission=ANY(ARRAY['products.read','orders.franchise'])
  ELSE false END
WHERE ap.is_system
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_profile_assignments(user_id,profile_id,managed)
SELECT s.id,ap.id,false FROM public.staff_profiles s JOIN public.access_profiles ap
 ON ap.role_kind=s.role AND ap.is_system
WHERE ap.code=CASE s.role
 WHEN 'admin' THEN 'admin_cdsb'
 WHEN 'gerente' THEN 'gerente_cdsb'
 WHEN 'estoquista' THEN 'separador_cdsb'
 WHEN 'evento' THEN 'responsavel_evento'
 WHEN 'consulta' THEN 'consulta_cdsb'
 WHEN 'franquia' THEN 'loja_permanente'
 END
ON CONFLICT(user_id) DO NOTHING;

-- Gestão de perfis exclusivamente por administradores. A classificação técnica
-- permanece compatível com as políticas e navegação legadas.
CREATE OR REPLACE FUNCTION public.save_access_profile(
 p_id uuid,p_name text,p_description text,p_role_kind text,p_permissions text[],p_is_active boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_id uuid;v_code text;v_existing public.access_profiles%rowtype;v_uid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin') THEN
  RAISE EXCEPTION 'Somente administrador pode gerenciar perfis';END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 90 OR
  length(coalesce(p_description,''))>500 THEN RAISE EXCEPTION 'Nome ou descrição inválidos';END IF;
 IF p_role_kind NOT IN ('gerente','consulta','estoquista','evento','franquia') THEN
  RAISE EXCEPTION 'Classificação técnica indisponível para perfil personalizado';END IF;
 IF cardinality(coalesce(p_permissions,ARRAY[]::text[]))=0 OR
  cardinality(p_permissions)>35 OR
  cardinality(p_permissions)<>cardinality(ARRAY(SELECT DISTINCT unnest(p_permissions))) THEN
  RAISE EXCEPTION 'Selecione permissões válidas e não repetidas';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_permissions) k
  WHERE NOT EXISTS (SELECT 1 FROM public.permission_definitions d WHERE d.permission=k)) THEN
  RAISE EXCEPTION 'Permissão desconhecida';END IF;
 IF p_role_kind='gerente' AND p_permissions && ARRAY['users.manage','events.sell','system.force_delete']::text[] THEN
  RAISE EXCEPTION 'Permissão reservada ao administrador';END IF;
 IF p_role_kind='consulta' AND EXISTS(SELECT 1 FROM unnest(p_permissions) x
  WHERE x<>ALL(ARRAY['products.read','orders.read','stores.read','movements.read','movements.export','events.read'])) THEN
  RAISE EXCEPTION 'Consulta aceita somente permissões de leitura';END IF;
 IF p_role_kind='estoquista' AND
  (cardinality(p_permissions)<>3 OR NOT p_permissions @> ARRAY['products.read','orders.read','orders.separate']::text[]) THEN
  RAISE EXCEPTION 'Separador segue permissões obrigatórias da operação';END IF;
 IF p_role_kind='evento' AND
  (cardinality(p_permissions)<>3 OR NOT p_permissions @> ARRAY['products.read','events.read','events.request']::text[]) THEN
  RAISE EXCEPTION 'Responsável de evento segue permissões obrigatórias';END IF;
 IF p_role_kind='franquia' AND
  (cardinality(p_permissions)<>2 OR NOT p_permissions @> ARRAY['products.read','orders.franchise']::text[]) THEN
  RAISE EXCEPTION 'Loja permanente segue permissões obrigatórias';END IF;
 IF p_id IS NULL THEN
  v_code:='perfil_'||substr(replace(gen_random_uuid()::text,'-',''),1,24);
  INSERT INTO public.access_profiles(code,name,description,role_kind,is_active,created_by)
  VALUES(v_code,btrim(p_name),coalesce(p_description,''),p_role_kind,coalesce(p_is_active,true),auth.uid())
  RETURNING id INTO v_id;
 ELSE
  SELECT * INTO v_existing FROM public.access_profiles WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado';END IF;
  IF v_existing.is_protected OR v_existing.is_system THEN
   RAISE EXCEPTION 'Perfis-base são protegidos; duplique para personalizar';END IF;
  IF v_existing.role_kind<>p_role_kind THEN
   RAISE EXCEPTION 'Não altere a classificação de um perfil existente; duplique o perfil';END IF;
  IF NOT coalesce(p_is_active,true) AND EXISTS(
   SELECT 1 FROM public.staff_profile_assignments WHERE profile_id=p_id AND managed
  ) THEN RAISE EXCEPTION 'Transfira os usuários antes de desativar o perfil';END IF;
  UPDATE public.access_profiles SET name=btrim(p_name),description=coalesce(p_description,''),
   is_active=coalesce(p_is_active,true),updated_at=now()
  WHERE id=p_id RETURNING id INTO v_id;
 END IF;

 DELETE FROM public.access_profile_permissions WHERE profile_id=v_id;
 INSERT INTO public.access_profile_permissions(profile_id,permission)
 SELECT v_id,p FROM unnest(p_permissions) p;

 -- Somente contas que aceitaram explicitamente um perfil gerenciado são atualizadas.
 FOR v_uid IN SELECT s.user_id FROM public.staff_profile_assignments s
  JOIN public.staff_profiles u ON u.id=s.user_id
  WHERE s.profile_id=v_id AND s.managed AND u.archived_at IS NULL AND u.role<>'admin'
  ORDER BY s.user_id FOR UPDATE OF s LOOP
  DELETE FROM public.staff_permissions WHERE user_id=v_uid;
  INSERT INTO public.staff_permissions(user_id,permission)
  SELECT v_uid,p FROM unnest(p_permissions) p;
  UPDATE public.staff_profiles SET permissions_customized=true WHERE id=v_uid;
  INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
  VALUES('staff_profiles',v_uid::text,'PROFILE_PERMISSIONS_APPLIED',auth.uid(),
   jsonb_build_object('profile_id',v_id));
 END LOOP;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('access_profiles',v_id::text,'ACCESS_PROFILE_SAVED',auth.uid(),
  jsonb_build_object('name',p_name,'role_kind',p_role_kind,'active',coalesce(p_is_active,true),
   'permission_count',cardinality(p_permissions)));
 RETURN v_id;
END;$fn$;

CREATE OR REPLACE FUNCTION public.assign_access_profile(
 p_user_id uuid,p_profile_id uuid,p_store_ids uuid[] DEFAULT NULL,p_event_ids uuid[] DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_profile public.access_profiles%rowtype;v_user public.staff_profiles%rowtype;
 v_permissions text[];v_stores uuid[];v_events uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin') THEN
  RAISE EXCEPTION 'Somente administrador pode atribuir perfis';END IF;
 IF p_user_id IS NULL OR p_user_id=auth.uid() THEN
  RAISE EXCEPTION 'Não é possível alterar as próprias autorizações';END IF;
 SELECT * INTO v_profile FROM public.access_profiles WHERE id=p_profile_id FOR SHARE;
 IF NOT FOUND OR NOT v_profile.is_active OR v_profile.role_kind='admin' THEN
  RAISE EXCEPTION 'Perfil inválido ou protegido';END IF;
 SELECT * INTO v_user FROM public.staff_profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR v_user.archived_at IS NOT NULL OR v_user.role='admin' THEN
  RAISE EXCEPTION 'Usuário inválido ou administrador protegido';END IF;
 SELECT array_agg(permission ORDER BY permission) INTO v_permissions FROM public.access_profile_permissions
 WHERE profile_id=p_profile_id;
 IF cardinality(coalesce(v_permissions,ARRAY[]::text[]))=0 THEN
  RAISE EXCEPTION 'Perfil sem permissões';END IF;
 SELECT coalesce(p_store_ids,array_agg(s.store_id)) INTO v_stores
 FROM public.staff_stores s WHERE s.user_id=p_user_id;
 SELECT coalesce(p_event_ids,array_agg(e.event_id)) INTO v_events
 FROM public.event_members e WHERE e.user_id=p_user_id;
 v_stores:=coalesce(v_stores,ARRAY[]::uuid[]);
 v_events:=coalesce(v_events,ARRAY[]::uuid[]);
 PERFORM public.set_staff_access_v2(p_user_id,v_profile.role_kind,v_permissions,v_stores,v_events);
 INSERT INTO public.staff_profile_assignments(user_id,profile_id,managed,assigned_by,assigned_at)
 VALUES(p_user_id,p_profile_id,true,auth.uid(),now())
 ON CONFLICT(user_id) DO UPDATE
 SET profile_id=EXCLUDED.profile_id,managed=true,assigned_by=EXCLUDED.assigned_by,assigned_at=now();
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('staff_profiles',p_user_id::text,'ACCESS_PROFILE_ASSIGNED',auth.uid(),
  jsonb_build_object('profile_id',p_profile_id,'role_kind',v_profile.role_kind));
END;$fn$;

-- Ao usar o formulário legado de permissões personalizadas, desacoplar o perfil gerenciado.
CREATE OR REPLACE FUNCTION public.detach_access_profile(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.role_in('admin') OR p_user_id=auth.uid() THEN
  RAISE EXCEPTION 'Sem permissão';END IF;
 UPDATE public.staff_profile_assignments SET managed=false,assigned_by=auth.uid(),assigned_at=now()
 WHERE user_id=p_user_id;
END;$fn$;

REVOKE ALL ON FUNCTION public.save_access_profile(uuid,text,text,text,text[],boolean),
 public.assign_access_profile(uuid,uuid,uuid[],uuid[]),
 public.detach_access_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_access_profile(uuid,text,text,text,text[],boolean),
 public.assign_access_profile(uuid,uuid,uuid[],uuid[]),
 public.detach_access_profile(uuid) TO authenticated;
COMMIT;
