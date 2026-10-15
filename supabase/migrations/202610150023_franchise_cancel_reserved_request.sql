CREATE OR REPLACE FUNCTION public.cancel_store_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.store_orders%rowtype;
begin
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status not in ('solicitado','pendente_estoque','aprovado','separado')
 then raise exception 'Pedido nao pode mais ser cancelado';end if;
 if not ((v_order.status in ('solicitado','pendente_estoque','aprovado') and v_order.created_by=auth.uid()
    and app_private.can_access_store(v_order.to_store_id))
   or (app_private.has_permission('orders.cancel') and app_private.can_access_store(v_order.to_store_id)))
 then raise exception 'Sem permissao para cancelar';end if;
 update public.stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
   where order_id=p_order and status='ativa';
 update public.store_orders set status='cancelado',canceled_by=auth.uid(),canceled_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id) values('store_orders',p_order::text,'CANCELED',auth.uid());
end;$function$
;