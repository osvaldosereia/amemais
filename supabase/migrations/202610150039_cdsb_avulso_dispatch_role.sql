-- Somente expedidores confirmam saída física de pedido avulso.
CREATE OR REPLACE FUNCTION public.dispatch_avulso_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.avulso_orders%rowtype;line record;v_current integer;v_held integer;
begin
 if auth.uid() is null or not app_private.has_permission('orders.dispatch')
 then raise exception 'Sem permissão para registrar saída';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status<>'separado' then raise exception 'Pedido ainda não separado ou já concluído';end if;
 for line in select product_id,quantity from public.avulso_order_items
  where order_id=p_order order by product_id loop
  select quantity into v_current from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select quantity into v_held from public.stock_reservations
   where avulso_order_id=p_order and product_id=line.product_id and status='ativa' for update;
  if v_current is null or v_current<line.quantity or v_held is distinct from line.quantity
  then raise exception 'Separação ou estoque inconsistente no SKU %',line.product_id;end if;
  update public.stock_reservations set status='consumida',ended_by=auth.uid(),ended_at=now()
  where avulso_order_id=p_order and product_id=line.product_id and status='ativa';
  update public.stock_balances set quantity=quantity-line.quantity,updated_at=now()
  where product_id=line.product_id and event_id is null;
  insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
  values(line.product_id,null,'saida_pedido',line.quantity,-line.quantity,0,auth.uid(),
    'Entrega de pedido avulso '||p_order::text||' · '||o.customer_name);
 end loop;
 update public.avulso_orders set fulfillment_status='concluido',
  dispatched_by=auth.uid(),dispatched_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('avulso_orders',p_order::text,'DISPATCHED_COMPLETED',auth.uid());
end;$function$
;