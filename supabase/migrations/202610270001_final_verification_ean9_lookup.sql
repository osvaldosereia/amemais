-- CDSB: fallback de 9 dígitos na conferência final, mantendo prioridade exata.
-- Somente redefine a função, sem alterar saldos, cadastros ou pedidos.
CREATE OR REPLACE FUNCTION public.save_order_final_verification(
 p_kind text,p_order uuid,p_product uuid,p_scanned_code text,p_counted integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path='' AS $function$
DECLARE
 v_status text;v_source uuid;v_expected integer;v_code text;
 v_matches integer;v_total integer;v_verified integer;v_units integer;
 v_order_count integer;v_allow boolean;v_exact_order_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.is_active() OR app_private.role_in('franquia') THEN
   RAISE EXCEPTION 'Sem acesso à conferência';
 END IF;
 IF p_kind NOT IN ('avulso','loja','evento') OR p_order IS NULL OR p_product IS NULL THEN
   RAISE EXCEPTION 'Pedido ou SKU inválido';
 END IF;
 v_allow := app_private.has_permission('orders.separate')
   OR (p_kind='evento' AND app_private.has_permission('events.separate'));
 IF NOT v_allow THEN RAISE EXCEPTION 'Sem permissão de conferência'; END IF;
 v_code:=btrim(coalesce(p_scanned_code,''));
 IF v_code='' OR length(v_code)>120 THEN RAISE EXCEPTION 'Leia um EAN ou SKU válido'; END IF;
 IF p_counted IS NULL OR p_counted<0 OR p_counted>1000000
 THEN RAISE EXCEPTION 'Quantidade encontrada inválida'; END IF;
 -- Serializar a conferência com a expedição e com outra conferência simultânea.
 IF p_kind='avulso' THEN
   SELECT fulfillment_status INTO v_status FROM public.avulso_orders
    WHERE id=p_order FOR UPDATE;
 ELSIF p_kind='loja' THEN
   SELECT status,from_store_id INTO v_status,v_source FROM public.store_orders
    WHERE id=p_order FOR UPDATE;
   IF NOT app_private.can_access_store(v_source) THEN RAISE EXCEPTION 'Sem acesso à origem'; END IF;
 ELSE
   SELECT status INTO v_status FROM public.event_pick_batches WHERE id=p_order FOR UPDATE;
 END IF;
 IF v_status IS DISTINCT FROM 'separado' THEN
   RAISE EXCEPTION 'É necessário concluir a separação antes de conferir';
 END IF;
 SELECT quantity INTO v_expected FROM (
   SELECT product_id,quantity FROM public.avulso_order_items WHERE p_kind='avulso' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.store_order_items WHERE p_kind='loja' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.event_pick_batch_items WHERE p_kind='evento' AND batch_id=p_order
 ) source WHERE product_id=p_product;
 IF v_expected IS NULL OR v_expected<1 THEN RAISE EXCEPTION 'Produto não pertence ao pedido'; END IF;
 -- Prioridade EAN/SKU exatos, em todo o pedido, antes de comparar sufixo EAN9.
 SELECT count(*) INTO v_exact_order_count FROM (
   SELECT i.product_id FROM public.avulso_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='avulso' AND i.order_id=p_order
      AND (p.ean=v_code OR p.sku=v_code OR i.ean=v_code OR i.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.store_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='loja' AND i.order_id=p_order AND (p.ean=v_code OR p.sku=v_code)
   UNION ALL
   SELECT i.product_id FROM public.event_pick_batch_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='evento' AND i.batch_id=p_order AND (p.ean=v_code OR p.sku=v_code)
 ) exact_order_items;
 -- Valida o código digitado/escaneado no servidor, não apenas na interface.
 SELECT count(*) INTO v_matches FROM (
   SELECT i.product_id FROM public.avulso_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='avulso' AND i.order_id=p_order
      AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code OR i.ean=v_code OR i.sku=v_code)) OR ((v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)) OR (
        v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(i.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(i.ean),9)=right(v_code,9))))
   UNION ALL
   SELECT i.product_id FROM public.store_order_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='loja' AND i.order_id=p_order AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code)) OR (v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)))
   UNION ALL
   SELECT i.product_id FROM public.event_pick_batch_items i
     JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='evento' AND i.batch_id=p_order AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code)) OR (v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)))
 ) matches WHERE product_id=p_product;
 IF v_matches<>1 THEN RAISE EXCEPTION 'EAN/SKU não corresponde à variação selecionada'; END IF;
 SELECT count(*) INTO v_order_count FROM (
   SELECT i.product_id FROM public.avulso_order_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='avulso' AND i.order_id=p_order
      AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code OR i.ean=v_code OR i.sku=v_code)) OR ((v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)) OR (
        v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(i.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(i.ean),9)=right(v_code,9))))
   UNION ALL
   SELECT i.product_id FROM public.store_order_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='loja' AND i.order_id=p_order AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code)) OR (v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)))
   UNION ALL
   SELECT i.product_id FROM public.event_pick_batch_items i JOIN public.products p ON p.id=i.product_id
    WHERE p_kind='evento' AND i.batch_id=p_order AND ((v_exact_order_count>0 AND (p.ean=v_code OR p.sku=v_code)) OR (v_exact_order_count=0 AND v_code ~ '^[0-9]{9,}$'
        AND btrim(coalesce(p.ean,'')) ~ '^[0-9]{9,}$'
        AND right(btrim(p.ean),9)=right(v_code,9)))
 ) distinct_matches;
 IF v_order_count<>1 THEN RAISE EXCEPTION 'Código ambíguo neste pedido; corrija o cadastro'; END IF;
 INSERT INTO public.order_final_verifications
   (kind,order_id,product_id,expected_quantity,counted_quantity,scanned_code,verified_by,verified_at)
 VALUES (p_kind,p_order,p_product,v_expected,p_counted,v_code,auth.uid(),now())
 ON CONFLICT(kind,order_id,product_id) DO UPDATE
 SET expected_quantity=excluded.expected_quantity,
     counted_quantity=excluded.counted_quantity,
     scanned_code=excluded.scanned_code,
     verified_by=excluded.verified_by,verified_at=excluded.verified_at;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES ('order_final_verifications',p_order::text,'FINAL_COUNT_RECORDED',auth.uid(),
   jsonb_build_object('kind',p_kind,'product_id',p_product,
    'expected',v_expected,'counted',p_counted,'matched',p_counted=v_expected));
 SELECT count(*),count(*) FILTER(WHERE v.counted_quantity=i.quantity),coalesce(sum(v.counted_quantity),0)
 INTO v_total,v_verified,v_units FROM (
   SELECT product_id,quantity FROM public.avulso_order_items WHERE p_kind='avulso' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.store_order_items WHERE p_kind='loja' AND order_id=p_order
   UNION ALL SELECT product_id,quantity FROM public.event_pick_batch_items WHERE p_kind='evento' AND batch_id=p_order
 ) i LEFT JOIN public.order_final_verifications v ON
  v.kind=p_kind AND v.order_id=p_order AND v.product_id=i.product_id
  AND v.expected_quantity=i.quantity;
 RETURN jsonb_build_object('complete',v_total>0 AND v_total=v_verified,
   'matched_skus',v_verified,'total_skus',v_total,'counted_units',v_units,
   'expected',v_expected,'counted',p_counted);
END;
$function$;
