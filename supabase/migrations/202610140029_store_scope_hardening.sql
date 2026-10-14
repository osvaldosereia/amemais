-- Isolate the historic central warehouse from new shop stock.
drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using(
 app_private.has_permission('products.read') or app_private.has_permission('products.create')
 or app_private.has_permission('products.edit') or app_private.has_permission('stock.entry')
 or app_private.has_permission('stock.exit') or app_private.has_permission('stock.balance')
 or app_private.has_permission('orders.central') or app_private.has_permission('orders.franchise')
 or app_private.has_permission('orders.separate') or app_private.has_permission('orders.receive')
 or app_private.has_permission('events.separate'));
drop policy if exists apparel_models_select on public.apparel_models;
create policy apparel_models_select on public.apparel_models for select to authenticated using(
 app_private.has_permission('products.read') or app_private.has_permission('products.create')
 or app_private.has_permission('products.edit') or app_private.has_permission('stock.entry')
 or app_private.has_permission('stock.exit') or app_private.has_permission('orders.separate'));
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using(
 app_private.has_permission('products.read') or app_private.has_permission('products.create')
 or app_private.has_permission('categories.manage'));
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select to authenticated using(
 app_private.has_permission('products.read') or app_private.has_permission('products.create')
 or app_private.has_permission('tags.manage'));
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select to authenticated using(
 app_private.has_permission('stores.read') or app_private.has_permission('stores.manage')
 or app_private.can_access_store(id) or
 (is_primary and (app_private.has_permission('orders.central') or app_private.has_permission('orders.franchise')
  or app_private.has_permission('orders.separate'))));
drop policy if exists storeorders_read on public.store_orders;
create policy storeorders_read on public.store_orders for select to authenticated using(
 (app_private.has_permission('orders.read') and (app_private.can_access_store(from_store_id) or app_private.can_access_store(to_store_id))) or
 (app_private.has_permission('orders.separate') and app_private.can_access_store(from_store_id)) or
 (app_private.has_permission('orders.receive') and app_private.can_access_store(to_store_id)) or
 created_by=(select auth.uid()));
drop policy if exists balances_read on public.stock_balances;
create policy balances_read on public.stock_balances for select to authenticated using(
 (event_id is null
  and app_private.can_access_store((select id from public.stores where is_primary))
  and (app_private.has_permission('products.read') or app_private.has_permission('stock.balance')
   or app_private.has_permission('stock.entry') or app_private.has_permission('stock.exit')
   or app_private.has_permission('orders.separate')))
 or (event_id is not null and (app_private.has_permission('events.manage')
   or app_private.has_permission('events.separate') or app_private.event_role(event_id,'responsavel','operador'))));
drop policy if exists movements_read on public.stock_movements;
create policy movements_read on public.stock_movements for select to authenticated using(
 (event_id is null and app_private.has_permission('movements.read')
   and app_private.can_access_store((select id from public.stores where is_primary)))
 or (event_id is not null and ((app_private.has_permission('movements.read')
   and app_private.can_access_store((select id from public.stores where is_primary)))
   or app_private.event_role(event_id,'responsavel','operador'))));
