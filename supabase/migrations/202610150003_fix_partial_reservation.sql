CREATE OR REPLACE FUNCTION public.adjust_store_order_items(p_order uuid, p_items jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.store_orders%rowtype;it record;v jsonb;qty integer;seen uuid[]:='{}';remaining integer:=0;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissão';end if;
 select * into o from public.store_orders where id=p_order for update;
 if not found or o.status not in ('solicitado','aprovado') then raise exception 'Pedido não pode ser ajustado nesta etapa';end if;
 if not app_private.can_access_store(o.from_store_id) then raise exception 'Sem acesso à central';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Informe motivo da diferença';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then raise exception 'Itens inválidos';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if coalesce(v->>'product_id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(v->>'quantity','') !~ '^(0|[1-9][0-9]{0,6})$'
  then raise exception 'Produto ou quantidade inválidos';end if;
  if (v->>'product_id')::uuid=any(seen) then raise exception 'SKU repetido';end if;
  seen:=array_append(seen,(v->>'product_id')::uuid);
  if not exists(select 1 from public.store_order_items where order_id=p_order and product_id=(v->>'product_id')::uuid)
  then raise exception 'SKU não pertence ao pedido';end if;
 end loop;
 -- Ajustes em pedido reservado só reduzem a reserva, nunca ampliam.
 for it in select * from public.store_order_items where order_id=p_order order by product_id loop
   select (x->>'quantity')::integer into qty from jsonb_array_elements(p_items) x where (x->>'product_id')::uuid=it.product_id;
   qty:=coalesce(qty,0);
   if qty>it.quantity then raise exception 'Não é permitido aumentar quantidades neste ajuste';end if;
   if qty<>it.quantity then
     insert into public.store_order_adjustments(order_id,product_id,phase,previous_quantity,approved_quantity,reason,actor_id)
     values(p_order,it.product_id,case when o.status='solicitado' then 'aprovacao' else 'separacao' end,it.quantity,qty,btrim(p_reason),auth.uid());
     if o.status='aprovado' then
       if qty=0 then
         update public.stock_reservations set status='liberada',ended_by=auth.uid(),ended_at=now()
         where order_id=p_order and product_id=it.product_id and status='ativa';
       else
         update public.stock_reservations set quantity=qty
         where order_id=p_order and product_id=it.product_id and status='ativa';
         if not found then raise exception 'Reserva não encontrada para SKU %',it.product_id;end if;
       end if;
     end if;
     if qty=0 then delete from public.store_order_items where order_id=p_order and product_id=it.product_id;
     else update public.store_order_items set quantity=qty where order_id=p_order and product_id=it.product_id;end if;
   end if;
 end loop;
 select count(*) into remaining from public.store_order_items where order_id=p_order;
 if remaining=0 then raise exception 'Mantenha ao menos um produto; para cancelar use Cancelar pedido';end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values
 ('store_orders',p_order::text,'QUANTITIES_ADJUSTED',auth.uid(),jsonb_build_object('phase',o.status,'reason',p_reason));
end;$function$
;