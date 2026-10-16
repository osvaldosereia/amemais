-- Gestão 360: rankings operacionais sem itens fictícios. Consulta somente-leitura, isolada do snapshot legado.
create or replace function public.tv_product_rankings()
returns jsonb language sql stable security definer set search_path = ''
as $fn$
with authorized as (
 select exists(select 1 from public.staff_profiles p
  where p.id=auth.uid() and p.active is true and p.archived_at is null
  and p.role in ('admin','gerente')) ok
),
stock as (
 select p.id,p.name,p.sku,p.ean,p.apparel_size,p.gondola,p.created_at,p.min_stock,
  coalesce(b.physical,0)::integer as physical,
  coalesce(r.reserved,0)::integer as reserved
 from public.products p
 left join lateral (
  select sum(quantity)::integer physical from public.stock_balances b
  where b.product_id=p.id and b.event_id is null
 ) b on true
 left join lateral (
  select sum(quantity)::integer reserved from public.stock_reservations r
  where r.product_id=p.id and r.status='ativa'
 ) r on true
 where p.active is true and p.force_archived_at is null
),
requests as (
 select i.product_id,o.created_at as ordered_at,i.quantity::integer units
 from public.store_order_items i join public.store_orders o on o.id=i.order_id
 left join public.admin_removed_orders d on d.kind='loja' and d.order_id=o.id
 where d.order_id is null and o.status not in ('cancelado','expirado')
 union all
 select i.product_id,b.created_at,i.quantity
 from public.event_pick_batch_items i join public.event_pick_batches b on b.id=i.batch_id
 left join public.admin_removed_orders d on d.kind='evento' and d.order_id=b.id
 where d.order_id is null and b.status not in ('cancelado','expirado')
 union all
 select i.product_id,o.created_at,i.quantity
 from public.avulso_order_items i join public.avulso_orders o on o.id=i.order_id
 left join public.admin_removed_orders d on d.kind='avulso' and d.order_id=o.id
 where d.order_id is null and o.fulfillment_status not in ('cancelado','expirado')
),
request_aggregate as (
 select product_id,
  sum(units) filter(where ordered_at>=now()-interval '30 days')::integer as requested_30d,
  max(ordered_at) last_order_at
 from requests group by product_id
),
products as (
 select s.*, (s.physical-s.reserved)::integer available,
  coalesce(q.requested_30d,0)::integer requested_30d,q.last_order_at,
  case when q.last_order_at is not null
       then (now()::date-q.last_order_at::date)
       else (now()::date-s.created_at::date) end::integer days_without_order
 from stock s left join request_aggregate q on q.product_id=s.id
)
select case when (select ok from authorized) then jsonb_build_object(
 'generated_at', now(),
 'top_stock', coalesce((select jsonb_agg(row_to_json(x) order by x.available desc,x.name)
   from (select id,name,sku,apparel_size,gondola,physical,reserved,available,min_stock
    from products order by available desc,name,id limit 80) x),'[]'::jsonb),
 'most_ordered',coalesce((select jsonb_agg(row_to_json(x) order by x.requested_30d desc,x.name)
   from (select id,name,sku,apparel_size,gondola,physical,available,requested_30d
    from products where requested_30d>0
    order by requested_30d desc,name,id limit 80) x),'[]'::jsonb),
 'dormant',coalesce((select jsonb_agg(row_to_json(x) order by x.days_without_order desc,x.name)
   from (select id,name,sku,apparel_size,gondola,physical,available,last_order_at,days_without_order
    from products where available>0 and created_at<now()-interval '90 days'
    and (last_order_at is null or last_order_at<now()-interval '90 days')
    order by days_without_order desc,name,id limit 80) x),'[]'::jsonb),
 'totals',jsonb_build_object(
  'dormant_count',(select count(*) from products where available>0
     and created_at<now()-interval '90 days'
     and (last_order_at is null or last_order_at<now()-interval '90 days')),
  'ordered_30d',(select coalesce(sum(requested_30d),0) from products))
) else null end
$fn$;
revoke all on function public.tv_product_rankings() from public,anon,authenticated;
grant execute on function public.tv_product_rankings() to authenticated;
