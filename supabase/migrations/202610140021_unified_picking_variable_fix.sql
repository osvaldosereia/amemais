CREATE OR REPLACE FUNCTION public.confirm_avulso_order_picking(p_order uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.avulso_orders%rowtype;v jsonb;v_sku uuid;qty integer;expected integer;
 checked uuid[]:='{}';
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
 then raise exception 'Sem permissão para separar';end if;
 select * into o from public.avulso_orders where id=p_order for update;
 if not found or o.fulfillment_status<>'reservado' then raise exception 'Pedido não está integralmente reservado';end if;
 if o.expires_at is not null and o.expires_at<=now() then raise exception 'Reserva externa expirada';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items)<>(select count(*) from public.avulso_order_items where order_id=p_order)
 then raise exception 'Confira todos os SKUs';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
    or coalesce(v->>'quantity','')!~'^[1-9][0-9]{0,6}$'
  then raise exception 'SKU ou quantidade inválida';end if;
  v_sku:=(v->>'product_id')::uuid;qty:=(v->>'quantity')::integer;
  if v_sku=any(checked) then raise exception 'SKU repetido';end if;
  checked:=array_append(checked,v_sku);
  select quantity into expected from public.avulso_order_items where order_id=p_order and product_id=v_sku;
  if expected is distinct from qty then raise exception 'Quantidade divergente para %',v_sku;end if;
  if not exists(select 1 from public.stock_reservations where avulso_order_id=p_order
   and product_id=v_sku and status='ativa' and quantity=qty)
  then raise exception 'Reserva incompleta para %',v_sku;end if;
 end loop;
 update public.avulso_orders set fulfillment_status='separado',separated_by=auth.uid(),separated_at=now()
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('avulso_orders',p_order::text,'PICKING_CONFIRMED',auth.uid(),
 jsonb_build_object('sku_count',cardinality(checked)));
end;$function$
;