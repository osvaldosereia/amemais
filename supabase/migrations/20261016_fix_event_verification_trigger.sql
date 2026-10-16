-- Correção de erro ao confirmar pedido temporário:
--   record "old" has no field "order_id"
-- Itens de lojas temporárias usam batch_id, enquanto itens de lojas e avulsos usam order_id.
-- Evitar CASE SQL com referências a campos inexistentes de RECORD nos outros tipos de trigger.
-- Não recria triggers, não altera saldos, reservas, pedidos nem registros de conferência.
CREATE OR REPLACE FUNCTION app_private.invalidate_order_final_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_kind text;
 v_parent uuid;
BEGIN
 v_kind := CASE TG_TABLE_NAME
   WHEN 'avulso_order_items' THEN 'avulso'
   WHEN 'store_order_items' THEN 'loja'
   WHEN 'event_pick_batch_items' THEN 'evento'
   ELSE NULL
 END;
 IF v_kind IS NULL THEN
   RAISE EXCEPTION 'Tabela de itens não reconhecida para invalidação da conferência: %', TG_TABLE_NAME;
 END IF;

 -- Cada referência a OLD/NEW deve estar em ramo PL/pgSQL separado:
 -- o tipo RECORD não oferece order_id para event_pick_batch_items.
 IF TG_OP='DELETE' THEN
   IF v_kind='evento' THEN
     v_parent := OLD.batch_id;
   ELSE
     v_parent := OLD.order_id;
   END IF;
 ELSE
   IF v_kind='evento' THEN
     v_parent := NEW.batch_id;
   ELSE
     v_parent := NEW.order_id;
   END IF;
 END IF;

 DELETE FROM public.order_final_verifications
 WHERE kind=v_kind AND order_id=v_parent;

 IF TG_OP='DELETE' THEN
   RETURN OLD;
 END IF;
 RETURN NEW;
END;
$function$;
