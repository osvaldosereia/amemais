CREATE OR REPLACE FUNCTION app_private.reserve_unified_item(p_kind text, p_order uuid, p_product uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_need integer;v_held integer;v_total integer;v_physical integer;v_extra integer;v_complete boolean;v_status text;
begin
 if p_kind='loja' then
  select status into v_status from public.store_orders where id=p_order for update;
  if v_status not in ('solicitado','pendente_estoque','aprovado') then return 0;end if;
  select quantity into v_need from public.store_order_items where order_id=p_order and product_id=p_product;
 elsif p_kind='avulso' then
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
  if v_status not in ('pendente_estoque','reservado') then return 0;end if;
  select quantity into v_need from public.avulso_order_items where order_id=p_order and product_id=p_product;
 else raise exception 'Origem inválida';end if;
 if v_need is null then return 0;end if;
 insert into public.stock_balances(product_id,event_id,quantity) values(p_product,null,0)
 on conflict(product_id) where event_id is null do nothing;
 select quantity into v_physical from public.stock_balances where product_id=p_product and event_id is null for update;
 select coalesce(sum(quantity),0) into v_total from public.stock_reservations where product_id=p_product and status='ativa';
 if p_kind='loja' then
  select quantity into v_held from public.stock_reservations
   where order_id=p_order and product_id=p_product and status='ativa' for update;
 else
  select quantity into v_held from public.stock_reservations
   where avulso_order_id=p_order and product_id=p_product and status='ativa' for update;
 end if;
 v_held:=coalesce(v_held,0);
 v_extra:=least(greatest(0,v_need-v_held),greatest(0,v_physical-v_total));
 if v_extra>0 then
  if v_held=0 then
   insert into public.stock_reservations(order_id,avulso_order_id,product_id,quantity,created_by)
   values(case when p_kind='loja' then p_order else null end,
     case when p_kind='avulso' then p_order else null end,p_product,v_extra,auth.uid());
  elsif p_kind='loja' then
   update public.stock_reservations set quantity=quantity+v_extra
    where order_id=p_order and product_id=p_product and status='ativa';
  else
   update public.stock_reservations set quantity=quantity+v_extra
    where avulso_order_id=p_order and product_id=p_product and status='ativa';
  end if;
 end if;
 if p_kind='loja' then
  select not exists(select 1 from public.store_order_items i
    left join public.stock_reservations r on r.order_id=i.order_id
      and r.product_id=i.product_id and r.status='ativa'
    where i.order_id=p_order and coalesce(r.quantity,0)<i.quantity) into v_complete;
  update public.store_orders set status=case when v_complete then 'aprovado' else 'pendente_estoque' end,
   approved_at=case when v_complete then coalesce(approved_at,now()) else null end,
   approved_by=case when v_complete then coalesce(approved_by,
     case when app_private.has_permission('orders.separate') then auth.uid() else null end) else null end
   where id=p_order and status in ('solicitado','pendente_estoque','aprovado');
 else
  select not exists(select 1 from public.avulso_order_items i
    left join public.stock_reservations r on r.avulso_order_id=i.order_id
      and r.product_id=i.product_id and r.status='ativa'
    where i.order_id=p_order and coalesce(r.quantity,0)<i.quantity) into v_complete;
  update public.avulso_orders set fulfillment_status=case when v_complete then 'reservado' else 'pendente_estoque' end
   where id=p_order and fulfillment_status in ('pendente_estoque','reservado');
 end if;
 return v_extra;
end;$function$
;