-- Configurador: vínculos de eventos pelo administrador, uma operação atômica com perfil e lojas.
CREATE OR REPLACE FUNCTION public.set_staff_access_v2(
 p_user_id uuid,p_role text,p_permissions text[],p_store_ids uuid[],p_event_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_event uuid;v_prev_role text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.staff_profiles WHERE id=auth.uid() AND active AND role='admin' AND archived_at IS NULL
 ) THEN RAISE EXCEPTION 'Somente administradores podem alterar vínculos';END IF;
 SELECT role INTO v_prev_role FROM public.staff_profiles WHERE id=p_user_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário inexistente ou arquivado';END IF;
 IF p_role<>'evento' AND cardinality(coalesce(p_event_ids,ARRAY[]::uuid[]))<>0
 THEN RAISE EXCEPTION 'Somente responsável por loja temporária pode receber vínculo de evento';END IF;
 IF cardinality(coalesce(p_event_ids,ARRAY[]::uuid[]))<>
    cardinality(ARRAY(SELECT DISTINCT unnest(coalesce(p_event_ids,ARRAY[]::uuid[]))))
 THEN RAISE EXCEPTION 'Evento duplicado';END IF;
 FOREACH v_event IN ARRAY coalesce(p_event_ids,ARRAY[]::uuid[]) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=v_event AND deleted_at IS NULL AND status IN ('rascunho','ativo'))
  THEN RAISE EXCEPTION 'Evento inativo ou não encontrado';END IF;
 END LOOP;
 PERFORM public.set_staff_access(p_user_id,p_role,p_permissions,p_store_ids);
 IF v_prev_role='evento' OR p_role='evento' THEN
  DELETE FROM public.event_members WHERE user_id=p_user_id;
 END IF;
 IF p_role='evento' THEN
  INSERT INTO public.event_members(event_id,user_id,role)
  SELECT DISTINCT e,p_user_id,'responsavel' FROM unnest(coalesce(p_event_ids,ARRAY[]::uuid[])) e;
 END IF;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('staff_profiles',p_user_id::text,'EVENT_ACCESS_UPDATED',auth.uid(),
 jsonb_build_object('event_ids',coalesce(p_event_ids,ARRAY[]::uuid[])));
END;$function$;
REVOKE ALL ON FUNCTION public.set_staff_access_v2(uuid,text,text[],uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_staff_access_v2(uuid,text,text[],uuid[],uuid[]) TO authenticated;
