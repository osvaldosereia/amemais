
-- A separacao exige contagem conferida por SKU. Nao altera o saldo fisico.
create or replace function public.confirm_store_order_picking(p_order uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_line jsonb;v_id uuid;v_quantity integer;
 v_seen uuid[]:='{}'::uuid[];v_expected integer;v_count integer;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissao para separar';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'aprovado' then raise exception 'Pedido precisa estar aprovado e reservado';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or
    jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Informe os itens conferidos';end if;
 for v_line in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_line)<>'object'
      or coalesce(v_line->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]{0,6}$' then
      raise exception 'Conferencia contem item invalido';end if;
   v_id:=(v_line->>'product_id')::uuid;
   v_quantity:=(v_line->>'quantity')::integer;
   if v_id=any(v_seen) then raise exception 'SKU repetido na conferencia';end if;
   v_seen:=array_append(v_seen,v_id);
   select quantity into v_expected from public.store_order_items
     where order_id=p_order and product_id=v_id;
   if v_expected is null or v_quantity<>v_expected
   then raise exception 'Quantidade nao confere para o SKU %',v_id;end if;
   if not exists(select 1 from public.stock_reservations
     where order_id=p_order and product_id=v_id and status='ativa' and quantity=v_quantity)
   then raise exception 'Reserva inconsistente para o SKU %',v_id;end if;
 end loop;
 select count(*) into v_count from public.store_order_items where order_id=p_order;
 if v_count<>coalesce(array_length(v_seen,1),0) then
   raise exception 'Conferencia incompleta. Verifique todos os SKUs';end if;
 update public.store_orders set status='separado',separated_by=auth.uid(),separated_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',p_order::text,'PICKING_CONFIRMED',auth.uid(),
   jsonb_build_object('sku_count',v_count,'scanned_or_counted',true));
end;$fn$;
revoke all on function public.separate_store_order(uuid) from public,anon,authenticated;
revoke all on function public.confirm_store_order_picking(uuid,jsonb) from public,anon;
grant execute on function public.confirm_store_order_picking(uuid,jsonb) to authenticated;
