-- Códigos públicos imutáveis: duas letras e três algarismos, partilhados por
-- pedidos avulsos, pedidos de loja e lotes de lojas temporárias.
-- O UUID permanece a chave interna; a sequência nunca é reiniciada/reutilizada.
CREATE SEQUENCE IF NOT EXISTS public.order_public_code_sequence
 AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 675324 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.order_public_codes (
 kind text NOT NULL CHECK (kind IN ('avulso','loja','evento')),
 order_id uuid NOT NULL,
 code varchar(5) NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2}[0-9]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT order_public_codes_pkey PRIMARY KEY(kind,order_id)
);
ALTER TABLE public.order_public_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_public_codes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_public_codes TO authenticated;
DROP POLICY IF EXISTS order_public_codes_staff_read ON public.order_public_codes;
CREATE POLICY order_public_codes_staff_read ON public.order_public_codes
 FOR SELECT TO authenticated USING (app_private.is_active());

CREATE OR REPLACE FUNCTION app_private.allocate_order_public_code()
RETURNS varchar(5) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path = '' AS $function$
DECLARE v_serial bigint; v_letters integer;
BEGIN
 v_serial := nextval('public.order_public_code_sequence'::regclass);
 v_letters := ((v_serial-1)/999)::integer;
 RETURN (chr(65+v_letters/26)||chr(65+mod(v_letters,26))||
   lpad((mod(v_serial-1,999)+1)::text,3,'0'))::varchar(5);
END;
$function$;
REVOKE ALL ON FUNCTION app_private.allocate_order_public_code() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.register_order_public_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_kind text;
BEGIN
 v_kind := CASE TG_TABLE_NAME
   WHEN 'avulso_orders' THEN 'avulso'
   WHEN 'store_orders' THEN 'loja'
   WHEN 'event_pick_batches' THEN 'evento'
   ELSE NULL END;
 IF v_kind IS NULL THEN RAISE EXCEPTION 'Origem de pedido inválida'; END IF;
 INSERT INTO public.order_public_codes(kind,order_id,code)
 VALUES(v_kind,NEW.id,app_private.allocate_order_public_code())
 ON CONFLICT(kind,order_id) DO NOTHING;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.register_order_public_code() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS avulso_order_assign_public_code ON public.avulso_orders;
CREATE TRIGGER avulso_order_assign_public_code
 AFTER INSERT ON public.avulso_orders FOR EACH ROW
 EXECUTE FUNCTION app_private.register_order_public_code();
DROP TRIGGER IF EXISTS store_order_assign_public_code ON public.store_orders;
CREATE TRIGGER store_order_assign_public_code
 AFTER INSERT ON public.store_orders FOR EACH ROW
 EXECUTE FUNCTION app_private.register_order_public_code();
DROP TRIGGER IF EXISTS event_batch_assign_public_code ON public.event_pick_batches;
CREATE TRIGGER event_batch_assign_public_code
 AFTER INSERT ON public.event_pick_batches FOR EACH ROW
 EXECUTE FUNCTION app_private.register_order_public_code();

-- Registro único também para pedidos existentes; não reescreve nem altera pedidos.
INSERT INTO public.order_public_codes(kind,order_id,code)
SELECT kind,order_id,app_private.allocate_order_public_code() FROM (
 SELECT 'avulso'::text kind,id order_id,created_at FROM public.avulso_orders
 UNION ALL SELECT 'loja',id,created_at FROM public.store_orders
 UNION ALL SELECT 'evento',id,created_at FROM public.event_pick_batches
) AS x
WHERE NOT EXISTS(SELECT 1 FROM public.order_public_codes c
 WHERE c.kind=x.kind AND c.order_id=x.order_id)
ORDER BY created_at,kind,order_id;

-- O comprovante público já é protegido pelo token secreto do recibo; apenas
-- acrescentamos o mesmo código gravado, sem expor os pedidos a consultas anônimas.
CREATE OR REPLACE FUNCTION public.get_avulso_receipt_for_server(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_order public.avulso_orders%rowtype; v_items jsonb; v_code text;
BEGIN
 IF p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO v_order FROM public.avulso_orders
 WHERE receipt_token_hash=extensions.digest(p_token,'sha256');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT code INTO v_code FROM public.order_public_codes
 WHERE kind='avulso' AND order_id=v_order.id;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',i.product_name,'size',i.size,'color',i.color,
   'sku',i.sku,'ean',i.ean,'quantity',i.quantity
 ) ORDER BY i.product_name,i.color,i.size),'[]'::jsonb) INTO v_items
 FROM public.avulso_order_items i WHERE i.order_id=v_order.id;
 RETURN jsonb_build_object('id',v_order.id,'code',v_code,
   'name',v_order.customer_name,'phone',v_order.customer_phone,
   'created_at',v_order.created_at,'items',v_items);
END;
$function$;
