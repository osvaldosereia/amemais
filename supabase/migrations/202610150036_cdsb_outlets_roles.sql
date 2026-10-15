-- Rodada 1: origem CDSB, destinos permanentes sem estoque interno e permissões por unidade.
-- Não altera saldos, reservas nem remove usuários/lojas legados.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS ownership_type text NOT NULL DEFAULT 'terceiro';
ALTER TABLE public.stores ADD CONSTRAINT stores_ownership_type_check CHECK(ownership_type IN ('propria','terceiro','cdsb'));
UPDATE public.stores SET name='Centro de Distribuição São Bento (CDSB)',ownership_type='cdsb'
WHERE is_primary AND kind='central';
INSERT INTO public.stores(code,name,kind,is_primary,ownership_type,active)
VALUES
 ('CRISTOREICBA','Loja Cristo Rei Cuiabá','franquia',false,'propria',true),
 ('FRANQPOCONE','Franquia Poconé - MT','franquia',false,'terceiro',true),
 ('FRANQBORBOREMA','Franquia Borborema - SP','franquia',false,'terceiro',true),
 ('FRANQSOUZA','Franquia Souza - Paraíba','franquia',false,'terceiro',true)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, ownership_type=EXCLUDED.ownership_type;
-- Conceder histórico compartilhado aos usuários AUTORIZADOS da mesma unidade, e não apenas ao criador.
DROP POLICY IF EXISTS storeorders_read ON public.store_orders;
CREATE POLICY storeorders_read ON public.store_orders FOR SELECT TO authenticated USING(
 (app_private.has_permission('orders.read') AND
    (app_private.can_access_store(from_store_id) OR app_private.can_access_store(to_store_id)))
 OR (app_private.has_permission('orders.separate') AND app_private.can_access_store(from_store_id))
 OR (app_private.has_permission('orders.receive') AND app_private.can_access_store(to_store_id))
 OR (app_private.has_permission('orders.franchise') AND app_private.can_access_store(to_store_id))
 OR created_by=(SELECT auth.uid())
);
INSERT INTO public.permission_definitions(permission,module,label,sort_order)
VALUES ('events.request','events','Solicitar produtos para loja temporária',145)
ON CONFLICT(permission) DO NOTHING;
-- Perfis comerciais nunca podem receber estoque controlado neste sistema.
CREATE OR REPLACE FUNCTION app_private.prevent_commercial_store_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_kind text;
BEGIN
 SELECT kind INTO v_kind FROM public.stores WHERE id=NEW.store_id;
 IF v_kind='franquia' THEN
   RAISE EXCEPTION 'Lojas permanentes usam somente pedidos; estoque no destino não é controlado no CDSB';
 END IF;
 RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS forbid_commercial_store_balance ON public.store_stock;
CREATE TRIGGER forbid_commercial_store_balance
 BEFORE INSERT OR UPDATE ON public.store_stock
 FOR EACH ROW EXECUTE FUNCTION app_private.prevent_commercial_store_balance();
