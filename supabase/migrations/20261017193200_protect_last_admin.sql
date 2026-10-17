-- Protege a última conta administrativa ativa contra bloqueio, remoção ou rebaixamento.
BEGIN;
CREATE OR REPLACE FUNCTION app_private.protect_last_active_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE must_check boolean:=false;
BEGIN
 IF OLD.role='admin' AND OLD.active AND OLD.archived_at IS NULL THEN
  IF TG_OP='DELETE' THEN
   must_check:=true;
  ELSE
   must_check:=NEW.role IS DISTINCT FROM 'admin' OR NEW.active IS DISTINCT FROM true
    OR NEW.archived_at IS NOT NULL;
  END IF;
  IF must_check AND NOT EXISTS (
   SELECT 1 FROM public.staff_profiles s
   WHERE s.id<>OLD.id AND s.role='admin' AND s.active AND s.archived_at IS NULL
  ) THEN
   RAISE EXCEPTION 'Não é possível remover o último administrador ativo do CDSB';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS staff_profiles_protect_last_admin ON public.staff_profiles;
CREATE TRIGGER staff_profiles_protect_last_admin
 BEFORE UPDATE OF active,role,archived_at OR DELETE ON public.staff_profiles
 FOR EACH ROW EXECUTE FUNCTION app_private.protect_last_active_admin();
COMMIT;