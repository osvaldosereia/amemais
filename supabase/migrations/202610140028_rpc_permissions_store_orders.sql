-- Store order lifecycle RPCs. Individual authorization is enforced by RLS and permission triggers.
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
 if not (app_private.has_permission('orders.cancel') and app_private.can_access_store(v_order.to_store_id))
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
