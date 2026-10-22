-- Balanço rápido por EAN/SKU. Sem justificativa digitada; auditoria automática obrigatória.
-- Registro privado para prevenir repetição da mesma ação ao clicar ou bipar mais de uma vez.
CREATE TABLE IF NOT EXISTS app_private.quick_stock_requests(
 request_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id),
 mode text NOT NULL CHECK(mode IN ('contagem','entrada','saida')),
 expected integer NOT NULL,
 quantity integer NOT NULL,
 result_quantity integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.quick_stock_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_stock_update(
 p_product_id uuid,p_mode text,p_expected integer,p_quantity integer,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_current integer;v_reserved integer;
        v_result integer;v_delta integer;v_old app_private.quick_stock_requests%rowtype;
BEGIN
 IF v_actor IS NULL OR NOT app_private.role_in('admin','gerente','estoquista') OR
    (p_mode='contagem' AND NOT app_private.has_permission('stock.balance')) OR
    (p_mode='entrada' AND NOT app_private.has_permission('stock.entry')) OR
    (p_mode='saida' AND NOT app_private.has_permission('stock.exit')) THEN
   RAISE EXCEPTION 'Sem permissão para esta operação';
 END IF;
 IF p_mode NOT IN ('contagem','entrada','saida') OR p_request_id IS NULL OR
    p_product_id IS NULL OR p_expected NOT BETWEEN 0 AND 1000000 OR
    p_quantity NOT BETWEEN 0 AND 1000000 OR
    (p_mode<>'contagem' AND p_quantity=0) THEN
   RAISE EXCEPTION 'Operação ou quantidade inválida';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(34273,pg_catalog.hashtext(p_request_id::text));
 SELECT * INTO v_old FROM app_private.quick_stock_requests WHERE request_id=p_request_id;
 IF FOUND THEN
   IF v_old.actor_id<>v_actor OR v_old.product_id<>p_product_id OR
      v_old.mode<>p_mode OR v_old.expected<>p_expected OR v_old.quantity<>p_quantity THEN
     RAISE EXCEPTION 'Identificador da operação reutilizado incorretamente';
   END IF;
   RETURN jsonb_build_object('replayed',true,'quantity',v_old.result_quantity);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id
    AND active AND force_archived_at IS NULL) THEN
   RAISE EXCEPTION 'Produto não encontrado ou inativo';
 END IF;
 INSERT INTO public.stock_balances(product_id,event_id,quantity)
 VALUES(p_product_id,NULL,0)
 ON CONFLICT(product_id) WHERE event_id IS NULL DO NOTHING;
 SELECT quantity INTO v_current FROM public.stock_balances
  WHERE product_id=p_product_id AND event_id IS NULL FOR UPDATE;
 IF v_current IS DISTINCT FROM p_expected THEN
   RAISE EXCEPTION 'Saldo alterado por outro usuário. Releia o produto antes de salvar';
 END IF;
 SELECT coalesce(sum(quantity),0)::integer INTO v_reserved
 FROM public.stock_reservations WHERE product_id=p_product_id AND status='ativa';
 v_result:=CASE p_mode WHEN 'contagem' THEN p_quantity
   WHEN 'entrada' THEN v_current+p_quantity ELSE v_current-p_quantity END;
 IF v_result<0 OR v_result>1000000 OR v_result<v_reserved THEN
   RAISE EXCEPTION 'Estoque inválido ou abaixo das unidades reservadas (% reservadas)',v_reserved;
 END IF;
 v_delta:=v_result-v_current;
 IF p_mode='contagem' THEN
   PERFORM public.quick_stock_count(p_product_id,v_current,v_result,'Contagem rápida por EAN/SKU');
 ELSIF v_delta<>0 THEN
   UPDATE public.stock_balances SET quantity=v_result,updated_at=now()
     WHERE product_id=p_product_id AND event_id IS NULL;
   INSERT INTO public.stock_movements(
     product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   VALUES(p_product_id,NULL,CASE WHEN p_mode='entrada' THEN 'entrada' ELSE 'saida_loja' END,
      p_quantity,v_delta,0,v_actor,
      CASE WHEN p_mode='entrada' THEN 'Entrada rápida por EAN/SKU' ELSE 'Saída rápida por EAN/SKU' END);
 END IF;
 INSERT INTO app_private.quick_stock_requests(request_id,actor_id,product_id,mode,
 expected,quantity,result_quantity)
 VALUES(p_request_id,v_actor,p_product_id,p_mode,p_expected,p_quantity,v_result);
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('products',p_product_id::text,'quick_stock_'||p_mode,v_actor,
 jsonb_build_object('request_id',p_request_id,'previous',v_current,
 'new',v_result,'delta',v_delta,'reserved',v_reserved));
 RETURN jsonb_build_object('replayed',false,'quantity',v_result,'delta',v_delta);
END;
$fn$;
REVOKE ALL ON FUNCTION public.quick_stock_update(uuid,text,integer,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_stock_update(uuid,text,integer,integer,uuid) TO authenticated;

-- Produto Único: nome, categoria, tags, EAN, SKU e contagem física na mesma transação.
CREATE OR REPLACE FUNCTION public.save_single_product_workspace(
 p_product_id uuid,p_name text,p_category uuid,p_tags text[],p_active boolean,
 p_sku text,p_ean text,p_expected_sku text,p_expected_ean text,
 p_expected_quantity integer,p_quantity integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_product public.products%rowtype;v_current integer;v_reserved integer;
        v_sku text:=nullif(btrim(coalesce(p_sku,'')),'');
        v_ean text:=nullif(btrim(coalesce(p_ean,'')),'');
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_permission('products.edit') THEN
  RAISE EXCEPTION 'Sem permissão para editar produtos';
 END IF;
 SELECT * INTO v_product FROM public.products WHERE id=p_product_id AND
    force_archived_at IS NULL AND apparel_model_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto único não encontrado'; END IF;
 IF cardinality(app_private.category_variant_options(p_category))>0 THEN
  RAISE EXCEPTION 'Categoria passou a ter tamanhos. Atualize as variações na ficha';
 END IF;
 IF coalesce(v_product.sku,'') IS DISTINCT FROM coalesce(p_expected_sku,'') OR
    coalesce(v_product.ean,'') IS DISTINCT FROM coalesce(p_expected_ean,'') THEN
  RAISE EXCEPTION 'SKU ou EAN alterado por outro usuário. Reabra o cadastro';
 END IF;
 IF length(coalesce(v_sku,''))>80 OR
    (v_ean IS NOT NULL AND v_ean !~ '^[0-9]{8,14}$') OR
    p_quantity NOT BETWEEN 0 AND 1000000 OR
    p_expected_quantity NOT BETWEEN 0 AND 1000000 THEN
  RAISE EXCEPTION 'SKU, EAN ou estoque inválido';
 END IF;
 INSERT INTO public.stock_balances(product_id,event_id,quantity)
  VALUES(p_product_id,NULL,0)
 ON CONFLICT(product_id) WHERE event_id IS NULL DO NOTHING;
 SELECT quantity INTO v_current FROM public.stock_balances
  WHERE product_id=p_product_id AND event_id IS NULL FOR UPDATE;
 IF v_current IS DISTINCT FROM p_expected_quantity THEN
  RAISE EXCEPTION 'Saldo alterado por outro usuário. Reabra o cadastro';
 END IF;
 SELECT coalesce(sum(quantity),0)::integer INTO v_reserved
 FROM public.stock_reservations WHERE product_id=p_product_id AND status='ativa';
 IF p_quantity<v_reserved THEN RAISE EXCEPTION
  'Estoque abaixo de % unidade(s) reservada(s)',v_reserved; END IF;
 IF p_quantity<>v_current AND (NOT app_private.has_permission('stock.balance')
     OR NOT app_private.role_in('admin','gerente','estoquista')) THEN
  RAISE EXCEPTION 'Sem permissão para alterar o estoque';
 END IF;
 PERFORM public.save_product_basic_with_tags(
   p_product_id,false,p_name,p_category,p_tags,p_active);
 UPDATE public.products SET sku=v_sku,ean=v_ean WHERE id=p_product_id;
 IF p_quantity<>v_current THEN
   PERFORM public.quick_stock_count(p_product_id,v_current,p_quantity,
     'Contagem pelo cadastro do produto Único');
 END IF;
 RETURN p_product_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_single_product_workspace(
 uuid,text,uuid,text[],boolean,text,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_single_product_workspace(
 uuid,text,uuid,text[],boolean,text,text,text,text,integer,integer) TO authenticated;
