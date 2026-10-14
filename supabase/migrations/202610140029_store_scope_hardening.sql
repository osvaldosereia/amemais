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
-- Backend access to the central warehouse must also check the user's assigned store.
DO $storeguards$
declare v_name text;v_def text;v_oid oid;v_extra text;
begin
 foreach v_name in array array[
  'stock_operation_batch','quick_stock_count','quick_stock_count_batch','move_stock',
  'create_single_product_with_stock','create_apparel','add_apparel_variants'
 ] loop
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=v_name;
  if v_oid is null then raise exception 'RPC missing: %',v_name;end if;
  v_def:=pg_get_functiondef(v_oid);
  if position(E'\nbegin\n' in v_def)=0 then raise exception 'Unexpected RPC body: %',v_name;end if;
  v_extra:=case v_name
   when 'create_single_product_with_stock' then
     'if coalesce(p_initial_quantity,0)>0 and not app_private.can_access_store((select id from public.stores where is_primary)) then raise exception ''Sem acesso ao estoque da central'';end if;'
   when 'create_apparel' then
     'if not app_private.can_access_store((select id from public.stores where is_primary)) then raise exception ''Sem acesso à central'';end if;'
   when 'add_apparel_variants' then
     'if not app_private.can_access_store((select id from public.stores where is_primary)) then raise exception ''Sem acesso à central'';end if;'
   when 'move_stock' then
     'if p_action in (''entrada'',''venda_loja'',''ajuste_loja'',''transferencia'',''devolucao'') and not app_private.can_access_store((select id from public.stores where is_primary)) then raise exception ''Sem acesso à central'';end if;'
   else
     'if not app_private.can_access_store((select id from public.stores where is_primary)) then raise exception ''Sem acesso ao estoque da central'';end if;'
   end;
  execute replace(v_def,E'\nbegin\n',E'\nbegin\n  '||v_extra||E'\n');
 end loop;
end;$storeguards$;
-- Do not allow untrusted updates to financial identifiers in products.
create or replace function app_private.protect_product_identity()
returns trigger language plpgsql security definer set search_path=''
as $f$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by then
  raise exception 'Identidade e autoria do produto não podem ser alteradas';
 end if;
 return new;
end;$f$;
drop trigger if exists products_identity_guard on public.products;
create trigger products_identity_guard before update of id,created_by on public.products
for each row execute function app_private.protect_product_identity();
