-- Painel de TV do CDSB. Uma consulta agregada, sem nomes ou telefones de clientes.
-- Acesso exclusivamente a administradores/gerentes ativos. Não concede alterações.
CREATE OR REPLACE FUNCTION public.tv_operations_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
WITH authorization AS (
 SELECT EXISTS(
  SELECT 1 FROM public.staff_profiles p
  WHERE p.id = auth.uid() AND p.active IS TRUE AND p.archived_at IS NULL
    AND p.role IN ('admin','gerente')
 ) allowed
),
raw_orders AS (
 SELECT 'avulso'::text kind,o.id,COALESCE(c.code,'—')::text code,
  'Pedido avulso'::text destination,COALESCE(o.fulfillment_status,'solicitado')::text status,
  o.created_at,o.separated_at as separated_at,o.dispatched_at
 FROM public.avulso_orders o
 LEFT JOIN public.order_public_codes c ON c.kind='avulso' AND c.order_id=o.id
 LEFT JOIN public.admin_removed_orders d ON d.kind='avulso' AND d.order_id=o.id
 WHERE d.order_id IS NULL
 UNION ALL
 SELECT 'loja',o.id,COALESCE(c.code,'—'),
  COALESCE(s.name,'Loja própria / franquia'),COALESCE(o.status,'solicitado'),
  o.created_at,o.separated_at,o.dispatched_at
 FROM public.store_orders o
 LEFT JOIN public.stores s ON s.id=o.to_store_id
 LEFT JOIN public.order_public_codes c ON c.kind='loja' AND c.order_id=o.id
 LEFT JOIN public.admin_removed_orders d ON d.kind='loja' AND d.order_id=o.id
 WHERE d.order_id IS NULL
 UNION ALL
 SELECT 'evento',o.id,COALESCE(c.code,'—'),
  COALESCE(e.name,'Loja temporária'),COALESCE(o.status,'aguardando'),
  o.created_at,o.picked_at,o.dispatched_at
 FROM public.event_pick_batches o
 LEFT JOIN public.events e ON e.id=o.event_id
 LEFT JOIN public.order_public_codes c ON c.kind='evento' AND c.order_id=o.id
 LEFT JOIN public.admin_removed_orders d ON d.kind='evento' AND d.order_id=o.id
 WHERE d.order_id IS NULL
),
line_items AS (
 SELECT 'avulso'::text kind,order_id,product_id,quantity FROM public.avulso_order_items
 UNION ALL SELECT 'loja',order_id,product_id,quantity FROM public.store_order_items
 UNION ALL SELECT 'evento',batch_id,product_id,quantity FROM public.event_pick_batch_items
),
counts AS (
 SELECT l.kind,l.order_id,COUNT(*)::integer skus,COALESCE(SUM(l.quantity),0)::integer units,
  COUNT(*) FILTER (WHERE v.product_id IS NOT NULL AND
   v.counted_quantity=l.quantity AND v.expected_quantity=l.quantity)::integer checked,
  COUNT(*) FILTER (WHERE v.product_id IS NOT NULL AND
   (v.counted_quantity<>l.quantity OR v.expected_quantity<>l.quantity))::integer divergent,
  MAX(v.verified_at) last_verified_at
 FROM line_items l
 LEFT JOIN public.order_final_verifications v
  ON v.kind=l.kind AND v.order_id=l.order_id AND v.product_id=l.product_id
 GROUP BY l.kind,l.order_id
),
staged AS (
 SELECT o.*,COALESCE(c.skus,0) skus,COALESCE(c.units,0) units,
  COALESCE(c.checked,0) checked,COALESCE(c.divergent,0) divergent,
  c.last_verified_at,
  CASE
   WHEN o.status IN ('cancelado','expirado') THEN 'cancelado'
   WHEN o.status IN ('despachado','enviado','concluido','recebido','recebido_divergente') THEN 'enviado'
   WHEN o.status='pendente_estoque' THEN 'falta'
   WHEN o.status='separado' AND COALESCE(c.skus,0)>0 AND COALESCE(c.checked,0)=c.skus
     THEN 'conferido'
   WHEN o.status='separado' THEN 'conferencia'
   WHEN o.status='em_separacao' THEN 'separacao'
   WHEN o.status IN ('solicitado','legado','reservado','aprovado','aguardando') THEN 'separar'
   ELSE 'outro'
  END stage,
  CASE WHEN o.status='separado' THEN COALESCE(o.separated_at,o.created_at)
       ELSE o.created_at END stage_since
 FROM raw_orders o
 LEFT JOIN counts c ON c.kind=o.kind AND c.order_id=o.id
),
active AS (
 SELECT *,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-stage_since))/60))::integer age_minutes
 FROM staged
 WHERE stage NOT IN ('cancelado','enviado')
),
priority AS (
 SELECT a.code,a.destination,a.kind,a.stage,a.age_minutes,a.units,a.skus,
  a.divergent, a.stage_since,
  CASE a.stage WHEN 'falta' THEN 0 WHEN 'conferencia' THEN 1 WHEN 'conferido' THEN 2
   WHEN 'separacao' THEN 3 WHEN 'separar' THEN 4 ELSE 5 END as weight
 FROM active a
 ORDER BY weight, a.age_minutes DESC, a.created_at ASC
 LIMIT 6
),
recent_actions AS (
 SELECT s.code,s.kind,'Enviado para expedição'::text description,s.dispatched_at occurrence
 FROM staged s WHERE s.stage='enviado' AND s.dispatched_at IS NOT NULL
 UNION ALL
 SELECT s.code,s.kind,'Conferência concluída',s.last_verified_at
 FROM staged s WHERE s.checked=s.skus AND s.skus>0 AND s.last_verified_at IS NOT NULL
 UNION ALL
 SELECT s.code,s.kind,'Novo pedido recebido',s.created_at
 FROM staged s WHERE s.created_at>=now()-interval '48 hours'
)
SELECT CASE WHEN (SELECT allowed FROM authorization) THEN
 jsonb_build_object(
  'generated_at',now(),
  'time_zone','America/Cuiaba',
  'metrics',jsonb_build_object(
   'to_pick',(SELECT count(*) FROM active WHERE stage IN ('separar','separacao')),
   'checking',(SELECT count(*) FROM active WHERE stage='conferencia'),
   'checked',(SELECT count(*) FROM active WHERE stage='conferido'),
   'finished_today',(SELECT count(*) FROM staged WHERE stage='enviado'
       AND (dispatched_at AT TIME ZONE 'America/Cuiaba')::date=
           (now() AT TIME ZONE 'America/Cuiaba')::date)
  ),
  'alerts',jsonb_build_object(
   'shortage',(SELECT count(*) FROM active WHERE stage='falta'),
   'divergence',(SELECT count(*) FROM active WHERE divergent>0),
   'late',(SELECT count(*) FROM active WHERE stage IN ('separar','separacao','conferencia','conferido')
                      AND age_minutes>=60),
   'awaiting_dispatch',(SELECT count(*) FROM active WHERE stage='conferido')
  ),
  'today',jsonb_build_object(
    'shipments',(SELECT count(*) FROM staged WHERE stage='enviado'
     AND (dispatched_at AT TIME ZONE 'America/Cuiaba')::date=
         (now() AT TIME ZONE 'America/Cuiaba')::date),
    'shipped_units',(SELECT COALESCE(sum(units),0) FROM staged WHERE stage='enviado'
     AND (dispatched_at AT TIME ZONE 'America/Cuiaba')::date=
         (now() AT TIME ZONE 'America/Cuiaba')::date),
    'event_lots',(SELECT count(*) FROM staged WHERE kind='evento'
     AND (created_at AT TIME ZONE 'America/Cuiaba')::date=
         (now() AT TIME ZONE 'America/Cuiaba')::date),
    'customer_orders',(SELECT count(*) FROM staged WHERE kind='avulso'
     AND (created_at AT TIME ZONE 'America/Cuiaba')::date=
         (now() AT TIME ZONE 'America/Cuiaba')::date)
  ),
  'priority',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'code',code,'destination',destination,'kind',kind,'stage',stage,
   'minutes',age_minutes,'units',units,'sku_count',skus,'divergences',divergent
  ) ORDER BY weight,age_minutes DESC) FROM priority),'[]'::jsonb),
  'recent',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'code',code,'kind',kind,'text',description,'at',occurrence
  ) ORDER BY occurrence DESC) FROM (
    SELECT code,kind,description,occurrence FROM recent_actions
    WHERE occurrence IS NOT NULL ORDER BY occurrence DESC LIMIT 5
  ) t),'[]'::jsonb)
 )
 ELSE NULL END
$function$;
REVOKE ALL ON FUNCTION public.tv_operations_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tv_operations_snapshot() TO authenticated;
