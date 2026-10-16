-- Painel gerencial 360º: agregações somente-leitura e sem dados pessoais.
-- Mantém o snapshot operacional legado. Nenhum movimento de estoque é modificado.
create or replace function public.tv_management_snapshot()
returns jsonb language sql stable security definer set search_path = ''
as $fn$
with recursive
gate as (
 select exists(select 1 from public.staff_profiles p
  where p.id=auth.uid() and p.active is true and p.archived_at is null
  and p.role in ('admin','gerente')) ok
),
cat_tree as (
 select c.id,c.id as root_id,c.name as root_name from public.categories c where c.parent_id is null
 union all
 select c.id,t.root_id,t.root_name from public.categories c
 join cat_tree t on c.parent_id=t.id
),
product_cats as (
 select p.id,p.name,p.sku,p.ean,p.apparel_size,p.gondola,p.min_stock,
   coalesce(t.root_name,'Sem categoria') category,
   p.created_at,p.active
 from public.products p left join cat_tree t on t.id=p.category_id
 where p.force_archived_at is null
),
physical as (
 select b.product_id,sum(b.quantity)::integer qty
 from public.stock_balances b where b.event_id is null group by b.product_id
),
reserved as (
 select r.product_id,sum(r.quantity)::integer qty
 from public.stock_reservations r where r.status='ativa' group by r.product_id
),
stocks as (
 select p.*,coalesce(ph.qty,0) physical,coalesce(re.qty,0) reserved,
   greatest(0,coalesce(ph.qty,0)-coalesce(re.qty,0)) available
 from product_cats p left join physical ph on ph.product_id=p.id
 left join reserved re on re.product_id=p.id
 where p.active=true
),
order_ctx as (
 select 'loja'::text kind,o.id,coalesce(c.code,upper(left(o.id::text,5))) code,
   case when s.kind='franquia' then 'Franquia'
        when s.kind='filial' then 'Loja própria'
        else 'Loja' end destination_type,
   coalesce(s.name,'Destino não identificado') destination,
   o.status,o.created_at,o.separated_at
 from public.store_orders o
 left join public.stores s on s.id=o.to_store_id
 left join public.order_public_codes c on c.kind='loja' and c.order_id=o.id
 left join public.admin_removed_orders d on d.kind='loja' and d.order_id=o.id
 where d.order_id is null
 union all
 select 'evento',b.id,coalesce(c.code,upper(left(b.id::text,5))),
  'Loja temporária',coalesce(e.name,'Evento não identificado'),b.status,b.created_at,b.picked_at
 from public.event_pick_batches b
 join public.events e on e.id=b.event_id and e.deleted_at is null
 left join public.order_public_codes c on c.kind='evento' and c.order_id=b.id
 left join public.admin_removed_orders d on d.kind='evento' and d.order_id=b.id
 where d.order_id is null
 union all
 select 'avulso',o.id,coalesce(c.code,upper(left(o.id::text,5))),
  'Pedido avulso','Pedido avulso',o.fulfillment_status,o.created_at,o.separated_at
 from public.avulso_orders o
 left join public.order_public_codes c on c.kind='avulso' and c.order_id=o.id
 left join public.admin_removed_orders d on d.kind='avulso' and d.order_id=o.id
 where d.order_id is null
),
order_lines as (
 select 'loja'::text kind,i.order_id,i.product_id,i.quantity from public.store_order_items i
 union all select 'evento',i.batch_id,i.product_id,i.quantity from public.event_pick_batch_items i
 union all select 'avulso',i.order_id,i.product_id,i.quantity from public.avulso_order_items i
),
issues as (
 select x.code,x.kind,x.destination_type,x.destination,'Divergência na conferência'::text issue,
   coalesce(p.name,'Produto sem cadastro') product,coalesce(p.sku,'') sku,
   v.expected_quantity expected,v.counted_quantity found,
   greatest(0,v.expected_quantity-v.counted_quantity) missing,
   v.verified_at as happened,1 as priority
 from public.order_final_verifications v
 join order_ctx x on x.kind=v.kind and x.id=v.order_id
 left join public.products p on p.id=v.product_id
 where v.expected_quantity<>v.counted_quantity
   and v.verified_at>=now()-interval '72 hours'
   and x.status not in ('cancelado','expirado')
 union all
 select x.code,x.kind,x.destination_type,x.destination,
   case when a.reason ilike '%encontr%' or a.reason ilike '%localiz%'
        then 'Produto não encontrado na separação' else 'Quantidade reduzida na separação' end,
   coalesce(p.name,'Produto sem cadastro'),coalesce(p.sku,''),
   a.original_quantity,a.revised_quantity,
   greatest(0,a.original_quantity-a.revised_quantity),
   a.created_at,0
 from public.unified_order_adjustments a
 join order_ctx x on x.kind=a.order_kind and x.id=a.order_id
 left join public.products p on p.id=a.product_id
 where a.original_quantity>a.revised_quantity
   and a.created_at>=now()-interval '72 hours'
   and x.status not in ('cancelado','expirado')
 union all
 select x.code,x.kind,x.destination_type,x.destination,'Falta de estoque'::text,
   coalesce(p.name,'Produto sem cadastro'),coalesce(p.sku,''),
   l.quantity,coalesce(r.qty,0),
   greatest(0,l.quantity-coalesce(r.qty,0)),
   x.created_at,0
 from order_ctx x join order_lines l on l.kind=x.kind and l.order_id=x.id
 left join public.products p on p.id=l.product_id
 left join lateral (
   select sum(s.quantity)::integer qty from public.stock_reservations s
   where s.product_id=l.product_id and s.status='ativa'
   and ((x.kind='loja' and s.order_id=x.id)
      or (x.kind='evento' and s.event_batch_id=x.id)
      or (x.kind='avulso' and s.avulso_order_id=x.id))
 ) r on true
 where x.status='pendente_estoque' and l.quantity>coalesce(r.qty,0)
),
franchise_lines as (
 select s.id store_id,s.name franchise,coalesce(p.category,'Sem categoria') category,
   i.quantity, (o.status in ('despachado','recebido','recebido_divergente','concluido')) dispatched
 from public.store_orders o
 join public.stores s on s.id=o.to_store_id and s.kind='franquia' and s.force_archived_at is null
 join public.store_order_items i on i.order_id=o.id
 left join product_cats p on p.id=i.product_id
 left join public.admin_removed_orders d on d.kind='loja' and d.order_id=o.id
 where d.order_id is null and o.created_at>=now()-interval '30 days'
 and o.status<>'cancelado'
),
franchise_agg as (
 select franchise,category,sum(quantity)::integer requested,
 sum(case when dispatched then quantity else 0 end)::integer shipped
 from franchise_lines group by franchise,category
),
event_in_progress as (
 select e.id event_id,e.name event_name,e.starts_at,
   coalesce(p.category,'Sem categoria') category,
   sum(i.quantity)::integer requested,
   sum(case when b.status in ('separado','enviado') then i.quantity
            else least(greatest(coalesce(i.picked,0),0),i.quantity) end)::integer prepared,
   sum(case when b.status='enviado' then i.quantity else 0 end)::integer sent
 from public.events e
 join public.event_pick_batches b on b.event_id=e.id
   and b.status<>'cancelado'
 join public.event_pick_batch_items i on i.batch_id=b.id
 left join product_cats p on p.id=i.product_id
 where e.deleted_at is null and e.status in ('rascunho','ativo')
   and (e.ends_at is null or e.ends_at>=current_date-1)
 group by e.id,e.name,e.starts_at,p.category
),
event_closed as (
 select e.id event_id,e.name event_name,e.closed_at,
   coalesce(p.category,'Sem categoria') category,
   coalesce(sum(m.quantity) filter(where m.action='transferencia'),0)::integer sent,
   coalesce(sum(m.quantity) filter(where m.action='devolucao'),0)::integer returned,
   coalesce(sum(m.quantity) filter(where m.action='venda_evento'),0)::integer historical_sales,
   coalesce(sum(m.quantity) filter(where m.action='baixa_evento'),0)::integer nonreturned,
   coalesce(sum(m.quantity) filter(where m.action='baixa_evento' and m.note ilike 'AVARIA:%'),0)::integer damaged
 from public.events e
 join public.stock_movements m on m.event_id=e.id
 left join product_cats p on p.id=m.product_id
 where e.status='encerrado' and e.deleted_at is null
   and e.closed_at>=now()-interval '120 days'
 group by e.id,e.name,e.closed_at,p.category
),
damage_rows as (
 select m.product_id,abs(m.delta_store)::integer units,b.created_at
 from public.stock_operation_batches b
 join public.stock_movements m on m.operation_batch_id=b.id
 where b.exception_reason='avaria' and m.delta_store<0
 union all
 select d.product_id,d.quantity,d.created_at from public.stock_damages d
 where d.origin_event_id is not null or
   (d.origin_batch_id is not null and not exists (
    select 1 from public.stock_operation_batches b
    where b.id=d.origin_batch_id and b.exception_reason='avaria'
   ))
),
damage_agg as (
 select coalesce(p.category,'Sem categoria') category,
 sum(d.units)::integer units,
 count(*)::integer occurrences
 from damage_rows d left join product_cats p on p.id=d.product_id
 where d.created_at>=now()-interval '30 days'
 group by p.category
),
demands as (
 select o.created_at demand_at,i.product_id,i.quantity
 from public.store_orders o join public.store_order_items i on i.order_id=o.id
 where o.status<>'cancelado' and o.created_at>=now()-interval '60 days'
 union all
 select b.created_at,i.product_id,i.quantity
 from public.event_pick_batches b join public.event_pick_batch_items i on i.batch_id=b.id
 where b.status<>'cancelado' and b.created_at>=now()-interval '60 days'
 union all
 select o.created_at,i.product_id,i.quantity
 from public.avulso_orders o join public.avulso_order_items i on i.order_id=o.id
 where o.fulfillment_status not in ('cancelado','expirado')
  and o.created_at>=now()-interval '60 days'
),
demand_agg as (
 select coalesce(p.category,'Sem categoria') category,
 sum(d.quantity) filter(where d.demand_at>=now()-interval '30 days')::integer current_units,
 sum(d.quantity) filter(where d.demand_at<now()-interval '30 days')::integer previous_units
 from demands d left join product_cats p on p.id=d.product_id group by p.category
),
trend as (
 select (current_date-g.i)::date dte,
  coalesce((select sum(d.quantity) from demands d
    where (d.demand_at at time zone 'America/Cuiaba')::date=(current_date-g.i)::date),0)::integer units
 from generate_series(0,13) g(i)
),
purchases as (
 select po.status,po.id from public.purchase_orders po
 where po.status in ('rascunho','enviado')
)
select case when (select ok from gate) then jsonb_build_object(
 'generated_at',now(),
 'issues',coalesce((select jsonb_agg(row_to_json(v) order by v.priority,v.happened desc)
   from (select code,kind,destination_type,destination,issue,product,sku,expected,found,missing,
    happened,priority from issues order by priority,happened desc limit 16) v),'[]'::jsonb),
 'low_stock',coalesce((select jsonb_agg(row_to_json(v) order by v.available,v.name)
  from (select name,sku,apparel_size,gondola,category,physical,reserved,available,min_stock
    from stocks order by available asc,name limit 10) v),'[]'::jsonb),
 'stock_summary',jsonb_build_object(
  'products',(select count(*) from stocks),
  'zero',(select count(*) from stocks where available=0),
  'below_min',(select count(*) from stocks where min_stock>0 and available<min_stock),
  'reserved',(select coalesce(sum(reserved),0) from stocks),
  'physical',(select coalesce(sum(physical),0) from stocks)
 ),
 'franchises',coalesce((select jsonb_agg(row_to_json(v) order by v.franchise,v.requested desc)
   from (select franchise,category,requested,shipped from franchise_agg
    order by franchise,requested desc limit 160) v),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(row_to_json(v) order by v.starts_at,v.event_name,v.requested desc)
   from (select event_name,starts_at,category,requested,prepared,sent
    from event_in_progress order by starts_at nulls last,event_name,requested desc limit 120) v),'[]'::jsonb),
 'closed_events',coalesce((select jsonb_agg(row_to_json(v) order by v.closed_at desc,v.event_name)
   from (select event_name,closed_at,category,sent,returned,historical_sales,nonreturned,damaged
    from event_closed order by closed_at desc limit 100) v),'[]'::jsonb),
 'damages',coalesce((select jsonb_agg(row_to_json(v) order by v.units desc)
   from (select category,units,occurrences from damage_agg order by units desc limit 16) v),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(row_to_json(v) order by v.current_units desc)
   from (select category,coalesce(current_units,0) current_units,coalesce(previous_units,0) previous_units
    from demand_agg order by current_units desc nulls last limit 16) v),'[]'::jsonb),
 'trend',coalesce((select jsonb_agg(jsonb_build_object('day',dte,'units',units) order by dte) from trend),'[]'::jsonb),
 'purchases',jsonb_build_object(
   'open',(select count(*) from purchases),
   'sent',(select count(*) from purchases where status='enviado')
 ),
 'quality',jsonb_build_object(
   'checks_today',(select count(distinct(kind,order_id)) from public.order_final_verifications
    where (verified_at at time zone 'America/Cuiaba')::date=
          (now() at time zone 'America/Cuiaba')::date)
 )
) else null end
$fn$;
revoke all on function public.tv_management_snapshot() from public,anon,authenticated;
grant execute on function public.tv_management_snapshot() to authenticated;
