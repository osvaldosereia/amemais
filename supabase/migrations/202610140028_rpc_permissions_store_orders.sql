-- Granular enforcement for pre-existing SECURITY DEFINER inventory RPCs.
-- Keep legacy procedures transactional, but replace role-only checks with exact permissions.
DO $patch$
declare v record; v_oid oid; v_def text; v_old text; v_new text; v_start integer; v_finish integer;
begin
 for v in select * from (values
 ('activate_event','events.manage'),
 ('add_apparel_variants','products.create'),
 ('assign_avulso_order_event','orders.assign'),
 ('close_event','events.close'),
 ('create_apparel','products.create'),
 ('create_apparel_with_location','products.create'),
 ('create_avulso_order','orders.internal'),
 ('create_customer_catalog_access','catalog.manage'),
 ('create_internal_avulso_order','orders.internal'),
 ('create_product_share','products.share'),
 ('create_single_product_with_stock','products.create'),
 ('deactivate_stock_destination','stock.destinations'),
 ('quick_stock_count','stock.balance'),
 ('quick_stock_count_batch','stock.balance'),
 ('remove_category_branch','categories.manage'),
 ('remove_product_safely','products.delete'),
 ('remove_tag_safely','tags.manage'),
 ('revoke_customer_catalog_access','catalog.manage'),
 ('save_stock_destination','stock.destinations'),
 ('set_apparel_photo','products.edit'),
 ('transfer_event_batch','events.separate'),
 ('update_apparel_variant','products.edit')
 ) as m(name,permission) loop
   select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=v.name;
   if v_oid is null then raise exception 'Required RPC missing: %',v.name;end if;
   v_def:=pg_get_functiondef(v_oid);
   v_old:='app_private.role_in(''admin'',''gerente'',''estoquista'')';
   v_new:='app_private.has_permission('||quote_literal(v.permission)||')';
   v_def:=replace(v_def,v_old,v_new);
   v_old:='app_private.role_in(''admin'',''gerente'')';
   v_def:=replace(v_def,v_old,v_new);
   -- Some RPCs allow event membership as an alternative: permission remains mandatory.
   if v.name in ('close_event') then
     if position(E'\nbegin\n' in v_def)=0 then raise exception 'Unexpected body of %',v.name;end if;
     v_def:=replace(v_def,E'\nbegin\n',E'\nbegin\n  if not app_private.has_permission(''events.close'') then raise exception ''Sem autorização para encerrar evento''; end if;\n');
   end if;
   if v.name='create_single_product_with_stock' then
     v_def:=replace(v_def,E'\nbegin\n',E'\nbegin\n  if coalesce(p_initial_quantity,0)>0 and not app_private.has_permission(''stock.entry'') then raise exception ''O saldo inicial exige permissão de entrada'';end if;\n');
   end if;
   if v.name in ('create_apparel','add_apparel_variants') then
     v_def:=replace(v_def,E'\nbegin\n',E'\nbegin\n  if jsonb_typeof(p_variants)=''array'' and not app_private.has_permission(''stock.entry'') and exists(select 1 from jsonb_array_elements(p_variants) x where coalesce(x->>''quantity'',x->>''qty'',''0'') ~ ''^[0-9]+$'' and coalesce(x->>''quantity'',x->>''qty'',''0'')::numeric>0) then raise exception ''Saldo inicial exige autorização de entrada'';end if;\n');
   end if;
   if position('app_private.role_in(' in v_def)>0 then
     raise exception 'Unconverted role check in %',v.name;
   end if;
   execute v_def;
 end loop;
 -- stock_operation_batch: action-specific auth
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='stock_operation_batch';
 v_def:=pg_get_functiondef(v_oid);
 v_old:='app_private.role_in(''admin'',''gerente'')';
 v_new:='(case when p_operation=''entrada'' then app_private.has_permission(''stock.entry'') when p_operation=''saida'' then app_private.has_permission(''stock.exit'') else false end)';
 if position(v_old in v_def)=0 then raise exception 'stock_operation_batch authorization not found';end if;
 execute replace(v_def,v_old,v_new);
 -- move_stock: use p_action to enforce least privilege, not a generic manager flag.
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='move_stock';
 v_def:=pg_get_functiondef(v_oid);
 v_start:=position(E'  if p_action in (''entrada'',''venda_loja'',''transferencia'',''ajuste_loja'') then' in v_def);
 v_finish:=position(E'  -- Cria saldos ausentes' in v_def);
 if v_start=0 or v_finish<=v_start then raise exception 'move_stock authorization block changed';end if;
 v_def:=substring(v_def from 1 for v_start-1) || $guard$
  if (p_action='entrada' and not app_private.has_permission('stock.entry'))
  or (p_action='venda_loja' and not app_private.has_permission('stock.exit'))
  or (p_action='ajuste_loja' and not app_private.has_permission('stock.balance'))
  or (p_action='transferencia' and not app_private.has_permission('events.separate'))
  or (p_action='devolucao' and not app_private.has_permission('events.return'))
  or (p_action='venda_evento' and not app_private.has_permission('events.sell'))
  then raise exception 'Sem autorização para esta movimentação';end if;
  if p_action in ('devolucao','venda_evento')
     and not (app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel','operador'))
  then raise exception 'Funcionário não vinculado ao evento';end if;

$guard$ || substring(v_def from v_finish);
 execute v_def;
end;$patch$;

-- Request workflows: the destination requests, the source separates, the destination receives.
create or replace function public.create_store_order(
 p_from_store uuid,p_to_store uuid,p_type text,p_items jsonb,p_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_order uuid;v_item jsonb;v_product uuid;v_qty integer;v_seen uuid[]:='{}';v_source public.stores%rowtype;v_target public.stores%rowtype;
begin
 if not (case p_type when 'central' then app_private.has_permission('orders.central')
                       when 'franquia' then app_private.has_permission('orders.franchise') else false end)
 then raise exception 'Sem autorização para solicitar este tipo de pedido';end if;
 if p_from_store=p_to_store then raise exception 'Origem e destino devem ser diferentes';end if;
 select * into v_source from public.stores where id=p_from_store and active;
 select * into v_target from public.stores where id=p_to_store and active;
 if v_source.id is null or v_target.id is null then raise exception 'Loja inexistente ou inativa';end if;
 if not app_private.can_access_store(p_to_store) then raise exception 'Sem vínculo com a loja solicitante';end if;
 if p_type='central' and not v_source.is_primary then raise exception 'Pedido para central exige origem na loja principal';end if;
 if p_type='franquia' and v_target.kind<>'franquia' then raise exception 'Pedido de franquia exige loja franqueada';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100
 then raise exception 'Informe de 1 a 100 produtos';end if;
 if length(coalesce(p_note,''))>500 then raise exception 'Observação muito longa';end if;
 insert into public.store_orders(from_store_id,to_store_id,request_type,created_by,note)
 values(p_from_store,p_to_store,p_type,auth.uid(),nullif(btrim(coalesce(p_note,'')),'')) returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item)<>'object' or
      coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$' or
      coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,6}$'
   then raise exception 'Produto ou quantidade inválidos';end if;
   v_product:=(v_item->>'product_id')::uuid;v_qty:=(v_item->>'quantity')::integer;
   if v_qty>1000000 or v_product=any(v_seen) then raise exception 'Quantidade excessiva ou produto repetido';end if;
   if not exists(select 1 from public.products where id=v_product and active) then raise exception 'Produto não encontrado';end if;
   v_seen:=array_append(v_seen,v_product);
   insert into public.store_order_items(order_id,product_id,quantity) values(v_order,v_product,v_qty);
 end loop;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',v_order::text,'REQUESTED',auth.uid(),jsonb_build_object('from',p_from_store,'to',p_to_store,'type',p_type));
 return v_order;
end;$fn$;

create or replace function public.separate_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_item record;v_current integer;v_source_primary boolean;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem autorização para separar mercadorias';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'solicitado' then raise exception 'Pedido indisponível para separação';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem vínculo com o estoque de origem';end if;
 select is_primary into v_source_primary from public.stores where id=v_order.from_store_id and active;
 if v_source_primary is null then raise exception 'Origem inativa';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   if v_source_primary then
     insert into public.stock_balances(product_id,event_id,quantity) values(v_item.product_id,null,0)
       on conflict (product_id) where event_id is null do nothing;
     select quantity into v_current from public.stock_balances
       where product_id=v_item.product_id and event_id is null for update;
     if v_current<v_item.quantity then raise exception 'Saldo insuficiente do produto %',v_item.product_id;end if;
     update public.stock_balances set quantity=quantity-v_item.quantity,updated_at=now()
       where product_id=v_item.product_id and event_id is null;
     insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
       values(v_item.product_id,null,'saida_loja',v_item.quantity,-v_item.quantity,0,auth.uid(),
         'Separação para loja - pedido '||p_order::text);
   else
     insert into public.store_stock(store_id,product_id,quantity)
       values(v_order.from_store_id,v_item.product_id,0) on conflict do nothing;
     select quantity into v_current from public.store_stock
       where store_id=v_order.from_store_id and product_id=v_item.product_id for update;
     if v_current<v_item.quantity then raise exception 'Saldo insuficiente do produto %',v_item.product_id;end if;
     update public.store_stock set quantity=quantity-v_item.quantity,updated_at=now()
       where store_id=v_order.from_store_id and product_id=v_item.product_id;
   end if;
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
    values(p_order,v_order.from_store_id,v_item.product_id,-v_item.quantity,auth.uid(),'separacao');
 end loop;
 update public.store_orders set status='separado',separated_by=auth.uid(),separated_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'SEPARATED',auth.uid());
end;$fn$;

create or replace function public.receive_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_item record;v_target_primary boolean;
begin
 if not app_private.has_permission('orders.receive') then raise exception 'Sem autorização para receber mercadorias';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'separado' then raise exception 'Pedido não está aguardando recebimento';end if;
 if not app_private.can_access_store(v_order.to_store_id) then raise exception 'Sem vínculo com a loja de destino';end if;
 select is_primary into v_target_primary from public.stores where id=v_order.to_store_id and active;
 if v_target_primary is null then raise exception 'Loja de destino inativa';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   if v_target_primary then
     insert into public.stock_balances(product_id,event_id,quantity) values(v_item.product_id,null,0)
       on conflict (product_id) where event_id is null do nothing;
     perform 1 from public.stock_balances
       where product_id=v_item.product_id and event_id is null for update;
     update public.stock_balances set quantity=quantity+v_item.quantity,updated_at=now()
       where product_id=v_item.product_id and event_id is null;
     insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
      values(v_item.product_id,null,'entrada',v_item.quantity,v_item.quantity,0,auth.uid(),
       'Recebimento da loja - pedido '||p_order::text);
   else
     insert into public.store_stock(store_id,product_id,quantity)
      values(v_order.to_store_id,v_item.product_id,0) on conflict do nothing;
     perform 1 from public.store_stock where store_id=v_order.to_store_id and product_id=v_item.product_id for update;
     update public.store_stock set quantity=quantity+v_item.quantity,updated_at=now()
       where store_id=v_order.to_store_id and product_id=v_item.product_id;
   end if;
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
    values(p_order,v_order.to_store_id,v_item.product_id,v_item.quantity,auth.uid(),'recebimento');
 end loop;
 update public.store_orders set status='recebido',received_by=auth.uid(),received_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'RECEIVED',auth.uid());
end;$fn$;

create or replace function public.cancel_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;
begin
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'solicitado' then raise exception 'Somente pedidos não separados podem ser cancelados';end if;
 if not (v_order.created_by=auth.uid() or
   (app_private.has_permission('orders.cancel') and app_private.can_access_store(v_order.to_store_id)))
 then raise exception 'Sem autorização para cancelar este pedido';end if;
 update public.store_orders set status='cancelado',canceled_by=auth.uid(),canceled_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'CANCELED',auth.uid());
end;$fn$;
revoke all on function public.create_store_order(uuid,uuid,text,jsonb,text),
 public.separate_store_order(uuid),public.receive_store_order(uuid),public.cancel_store_order(uuid)
 from public,anon;
grant execute on function public.create_store_order(uuid,uuid,text,jsonb,text),
 public.separate_store_order(uuid),public.receive_store_order(uuid),public.cancel_store_order(uuid)
 to authenticated;
