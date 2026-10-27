-- Restringe o atalho de permissão de reativação apenas ao status automático.
DO $migration$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_catalog.pg_get_functiondef('app_private.guard_permission_mutation()'::regprocedure);
  v_old := $old$
 if tg_table_name='products' and tg_op='UPDATE'
    and old.active is false and new.active is true
    and old.force_archived_at is null and new.force_archived_at is null
    and (
      (pg_catalog.pg_trigger_depth()>=1
       and current_setting('app.auto_activate_product',true)='enabled'
       and (v_actor is not null or current_setting('request.jwt.claim.role',true)='service_role'
          or current_setting('role',true)='service_role'))
      or
      (v_actor is not null
       and app_private.has_permission('products.edit')
       and (pg_catalog.to_jsonb(new)-'active'-'updated_at')
           is distinct from (pg_catalog.to_jsonb(old)-'active'-'updated_at'))
    ) then return new;end if;
$old$;
  v_new := $new$
 if tg_table_name='products' and tg_op='UPDATE'
    and old.active is false and new.active is true
    and old.force_archived_at is null and new.force_archived_at is null
    and pg_catalog.pg_trigger_depth()>=1
    and current_setting('app.auto_activate_product',true)='enabled'
    and (pg_catalog.to_jsonb(new)-'active'-'updated_at')
        is not distinct from (pg_catalog.to_jsonb(old)-'active'-'updated_at')
    and (v_actor is not null or current_setting('request.jwt.claim.role',true)='service_role'
       or current_setting('role',true)='service_role')
 then return new;end if;
$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a exceção de permissão automática';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);

  v_old := $old$elsif new.active is distinct from old.active then v_required:='products.delete';$old$;
  v_new := $new$elsif new.active is distinct from old.active
     and not (
       old.active is false and new.active is true
       and old.force_archived_at is null and new.force_archived_at is null
       and app_private.has_permission('products.edit')
       and (pg_catalog.to_jsonb(new)-'active'-'updated_at')
           is distinct from (pg_catalog.to_jsonb(old)-'active'-'updated_at')
     ) then v_required:='products.delete';$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação explícita do status do produto';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('app_private.protect_product_active()'::regprocedure);
  v_old := $old$(pg_catalog.pg_trigger_depth()>=1
         and current_setting('app.auto_activate_product',true)='enabled')$old$;
  v_new := $new$(pg_catalog.pg_trigger_depth()>=1
         and current_setting('app.auto_activate_product',true)='enabled'
         and (pg_catalog.to_jsonb(new)-'active'-'updated_at')
             is not distinct from (pg_catalog.to_jsonb(old)-'active'-'updated_at'))$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de status automática';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;
END;
$migration$;
