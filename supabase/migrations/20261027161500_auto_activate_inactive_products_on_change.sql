-- Reativação automática segura quando um produto inativo é alterado.
-- Produtos arquivados permanecem fora dos fluxos e nunca são reativados.

CREATE OR REPLACE FUNCTION app_private.activate_product_after_related_change(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_previous text;
BEGIN
  IF auth.uid() IS NULL
     AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
     AND current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Autenticação necessária para reativar o produto';
  END IF;
  v_previous := current_setting('app.auto_activate_product',true);
  PERFORM set_config('app.auto_activate_product','enabled',true);
  UPDATE public.products
     SET active=true
   WHERE id=p_product_id
     AND active=false
     AND force_archived_at IS NULL;
  PERFORM set_config('app.auto_activate_product',coalesce(v_previous,''),true);
END;
$function$;

REVOKE ALL ON FUNCTION app_private.activate_product_after_related_change(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.auto_activate_product_after_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.active=false AND NEW.active=false
     AND OLD.force_archived_at IS NULL
     AND NEW.force_archived_at IS NULL
     AND (pg_catalog.to_jsonb(NEW)-'active'-'updated_at')
         IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-'active'-'updated_at') THEN
    NEW.active := true;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.auto_activate_product_after_edit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS products_reactivate_inactive_after_edit ON public.products;
CREATE TRIGGER products_reactivate_inactive_after_edit
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION app_private.auto_activate_product_after_edit();

CREATE OR REPLACE FUNCTION app_private.auto_activate_model_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_product_id uuid;
BEGIN
  IF OLD.force_archived_at IS NULL
     AND NEW.force_archived_at IS NULL
     AND (pg_catalog.to_jsonb(NEW)-'id'-'created_at'-'updated_at'-'force_archived_at')
         IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-'id'-'created_at'-'updated_at'-'force_archived_at') THEN
    FOR v_product_id IN
      SELECT p.id
        FROM public.products p
       WHERE p.apparel_model_id=NEW.id
         AND p.active=false
         AND p.force_archived_at IS NULL
    LOOP
      PERFORM app_private.activate_product_after_related_change(v_product_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.auto_activate_model_products() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS apparel_models_reactivate_inactive_products ON public.apparel_models;
CREATE TRIGGER apparel_models_reactivate_inactive_products
AFTER UPDATE ON public.apparel_models
FOR EACH ROW
EXECUTE FUNCTION app_private.auto_activate_model_products();

CREATE OR REPLACE FUNCTION app_private.auto_activate_product_after_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.quantity IS NOT DISTINCT FROM NEW.quantity THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM app_private.activate_product_after_related_change(NEW.product_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.auto_activate_product_after_stock_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS stock_balances_reactivate_inactive_product ON public.stock_balances;
CREATE TRIGGER stock_balances_reactivate_inactive_product
AFTER INSERT OR UPDATE ON public.stock_balances
FOR EACH ROW
EXECUTE FUNCTION app_private.auto_activate_product_after_stock_change();

-- Um cadastro alterado pode ativar o produto sem conceder permissão para uma
-- ativação manual isolada. A ativação via estoque usa um marcador definido
-- apenas pelo helper privado acima.
DO $migration$
DECLARE
  v_def text;
  v_anchor text;
  v_branch text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_catalog.pg_get_functiondef('app_private.guard_permission_mutation()'::regprocedure);
  v_anchor := $anchor$ if v_actor is null then raise exception 'Autenticação necessária';end if;$anchor$;
  v_branch := $branch$
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
$branch$;
  IF pg_catalog.strpos(v_def,v_anchor)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o ponto de validação de permissão de produtos';
  END IF;
  v_def := pg_catalog.replace(v_def,v_anchor,v_branch||v_anchor);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('app_private.protect_product_active()'::regprocedure);
  v_old := $old$
 if new.active is distinct from old.active
   and not app_private.has_permission('products.delete')
 then raise exception 'Sem autorização para ativar ou desativar produtos';end if;
$old$;
  v_new := $new$
 if new.active is distinct from old.active
   and not (
      old.active is false and new.active is true
      and old.force_archived_at is null and new.force_archived_at is null
      and (
        (pg_catalog.pg_trigger_depth()>=1
         and current_setting('app.auto_activate_product',true)='enabled')
        or
        (app_private.has_permission('products.edit')
         and (pg_catalog.to_jsonb(new)-'active'-'updated_at')
             is distinct from (pg_catalog.to_jsonb(old)-'active'-'updated_at'))
      )
   )
   and not app_private.has_permission('products.delete')
 then raise exception 'Sem autorização para ativar ou desativar produtos';end if;
$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a proteção de status do produto';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;
END;
$migration$;

-- Estoque pode ser contado em produto inativo; o produto é reativado pelo helper
-- dentro da operação autorizada, inclusive quando a contagem confirma o saldo atual.
DO $migration$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_catalog.pg_get_functiondef('public.quick_stock_count(uuid,integer,integer,text)'::regprocedure);
  v_old := $old$if not exists(select 1 from public.products where id=p_product_id and active) then$old$;
  v_new := $new$if not exists(select 1 from public.products where id=p_product_id and force_archived_at is null) then$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de produto no balanço rápido';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  v_old := $old$  if not exists(select 1 from public.products where id=p_product_id and force_archived_at is null) then
    raise exception 'Produto inexistente ou inativo';
  end if;$old$;
  v_new := $new$  if not exists(select 1 from public.products where id=p_product_id and force_archived_at is null) then
    raise exception 'Produto inexistente ou arquivado';
  end if;
  perform app_private.activate_product_after_related_change(p_product_id);$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível adicionar a reativação autorizada ao balanço rápido';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('public.quick_stock_update(uuid,text,integer,integer,uuid)'::regprocedure);
  v_old := $old$    AND active AND force_archived_at IS NULL) THEN$old$;
  v_new := $new$    AND force_archived_at IS NULL) THEN$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de produto na atualização rápida';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('public.quick_stock_count_batch(jsonb,text)'::regprocedure);
  v_old := $old$where id=v_product and active=true
      and force_archived_at is null$old$;
  v_new := $new$where id=v_product and force_archived_at is null$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de produto no balanço agrupado';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('public.stock_operation_batch(text,jsonb,uuid,text,uuid)'::regprocedure);
  v_old := $old$where id=v_product and active$old$;
  v_new := $new$where id=v_product and force_archived_at is null$new$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação de produto na movimentação em lote';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,v_new);
  EXECUTE v_def;

  v_def := pg_catalog.pg_get_functiondef('public.save_product_workspace(uuid,boolean,text,uuid,text[],boolean,text,text,text,text,jsonb)'::regprocedure);
  v_old := $old$
     IF NOT v_product.active THEN
       RAISE EXCEPTION 'Reative o tamanho % antes de editá-lo',v_size;
     END IF;
$old$;
  IF pg_catalog.strpos(v_def,v_old)=0 THEN
    RAISE EXCEPTION 'Não foi possível localizar o bloqueio de edição de variações inativas';
  END IF;
  v_def := pg_catalog.replace(v_def,v_old,'');
  EXECUTE v_def;
END;
$migration$;
