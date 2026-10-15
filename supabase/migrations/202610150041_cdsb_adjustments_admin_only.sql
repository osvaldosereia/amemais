-- Mudanças de quantidades exigem gestão do CDSB, nunca apenas permissão para separar.
CREATE OR REPLACE FUNCTION public.adjust_store_order_items(p_order uuid, p_items jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.store_orders%rowtype;it record;v jsonb;qty integer;seen uuid[]:='{}';remaining integer:=0;
begin
 if not app_private.has_permission('orders.dispatch') then raise exception 'Sem permissão';end if;
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
CREATE OR REPLACE FUNCTION public.adjust_unified_order_shortage(p_kind text, p_order uuid, p_items jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_status text;v jsonb;v_sku uuid;v_qty integer;
 v_seen uuid[]:='{}';v_old integer;v_held integer;v_any integer:=0;v_changes integer:=0;line record;
begin
 if auth.uid() is null or not app_private.has_permission('orders.dispatch')
 then raise exception 'Sem permissão';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justifique a diferença';end if;
 if p_kind='loja' then
  select status into v_status from public.store_orders where id=p_order for update;
  if v_status not in ('solicitado','pendente_estoque','aprovado') then raise exception 'Pedido não pode ser ajustado';end if;
  if not exists(select 1 from public.store_orders o where o.id=p_order and app_private.can_access_store(o.from_store_id))
  then raise exception 'Sem acesso à central';end if;
 elsif p_kind='avulso' then
  select fulfillment_status into v_status from public.avulso_orders where id=p_order for update;
  if v_status not in ('legado','pendente_estoque','reservado') then raise exception 'Pedido não pode ser ajustado';end if;
 else raise exception 'Tipo inválido';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100
 then raise exception 'Lista de produtos inválida';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
   or coalesce(v->>'quantity','')!~'^(0|[1-9][0-9]{0,6})$' then raise exception 'SKU ou quantidade inválidos';end if;
  v_sku:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if v_sku=any(v_seen) or v_qty>1000000 then raise exception 'SKU repetido ou quantidade excessiva';end if;
  v_seen:=array_append(v_seen,v_sku);
  if p_kind='loja' then
   select quantity into v_old from public.store_order_items where order_id=p_order and product_id=v_sku;
  else
   select quantity into v_old from public.avulso_order_items where order_id=p_order and product_id=v_sku;
  end if;
  if v_old is null or v_qty>v_old then raise exception 'SKU inexistente ou quantidade aumentada';end if;
  v_any:=v_any+v_qty;
 end loop;
 if v_any=0 then raise exception 'Para cancelar todo o pedido, use Cancelar';end if;
 if p_kind='loja' then
  if (select count(*) from public.store_order_items where order_id=p_order)<>cardinality(v_seen)
  then raise exception 'Informe todos os SKUs do pedido';end if;
 else
  if (select count(*) from public.avulso_order_items where order_id=p_order)<>cardinality(v_seen)
  then raise exception 'Informe todos os SKUs do pedido';end if;
 end if;
 for v in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
  v_sku:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if p_kind='loja' then
   select quantity into v_old from public.store_order_items where order_id=p_order and product_id=v_sku for update;
   select quantity into v_held from public.stock_reservations
    where order_id=p_order and product_id=v_sku and status='ativa' for update;
  else
   select quantity into v_old from public.avulso_order_items where order_id=p_order and product_id=v_sku for update;
   select quantity into v_held from public.stock_reservations
    where avulso_order_id=p_order and product_id=v_sku and status='ativa' for update;
  end if;
  if v_qty=v_old then continue;end if;
  v_changes:=v_changes+1;
  insert into public.unified_order_adjustments(order_kind,order_id,product_id,
    original_quantity,revised_quantity,reason,actor_id)
   values(p_kind,p_order,v_sku,v_old,v_qty,btrim(p_reason),auth.uid());
  if p_kind='loja' then
   if v_qty=0 then
    delete from public.stock_reservations where order_id=p_order and product_id=v_sku;
    delete from public.store_order_items where order_id=p_order and product_id=v_sku;
   else
    update public.store_order_items set quantity=v_qty where order_id=p_order and product_id=v_sku;
    if coalesce(v_held,0)>v_qty then update public.stock_reservations
     set quantity=v_qty where order_id=p_order and product_id=v_sku and status='ativa';end if;
   end if;
  else
   if v_qty=0 then
    delete from public.stock_reservations where avulso_order_id=p_order and product_id=v_sku;
    delete from public.avulso_order_items where order_id=p_order and product_id=v_sku;
   else
    update public.avulso_order_items set quantity=v_qty where order_id=p_order and product_id=v_sku;
    if coalesce(v_held,0)>v_qty then update public.stock_reservations
     set quantity=v_qty where avulso_order_id=p_order and product_id=v_sku and status='ativa';end if;
   end if;
  end if;
 end loop;
 if v_changes=0 then raise exception 'Nenhuma quantidade alterada';end if;
 if p_kind='loja' then
  perform app_private.reserve_unified_order('loja',p_order);
 else
  update public.avulso_orders set fulfillment_status='pendente_estoque'
   where id=p_order and fulfillment_status='legado';
  perform app_private.reserve_unified_order('avulso',p_order);
 end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values(case when p_kind='loja' then 'store_orders' else 'avulso_orders' end,
 p_order::text,'SHORTAGE_ADJUSTED',auth.uid(),jsonb_build_object('reason',p_reason,'changes',v_changes));
end;$function$
;
