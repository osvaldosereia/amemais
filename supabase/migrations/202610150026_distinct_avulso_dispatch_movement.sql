
alter table public.stock_movements drop constraint if exists movement_amount;
alter table public.stock_movements add constraint movement_amount CHECK ((((action = 'ajuste_loja'::text) AND (delta_store = quantity) AND (delta_event = 0)) OR ((action = 'entrada'::text) AND (quantity > 0) AND (delta_store = quantity) AND (delta_event = 0)) OR ((action = ANY (ARRAY['venda_loja'::text, 'saida_loja'::text, 'saida_pedido'::text])) AND (quantity > 0) AND (delta_store = (- quantity)) AND (delta_event = 0)) OR ((action = 'transferencia'::text) AND (quantity > 0) AND (delta_store = (- quantity)) AND (delta_event = quantity)) OR ((action = 'venda_evento'::text) AND (quantity > 0) AND (delta_store = 0) AND (delta_event = (- quantity))) OR ((action = 'devolucao'::text) AND (quantity > 0) AND (delta_store = quantity) AND (delta_event = (- quantity))) OR ((action = 'baixa_evento'::text) AND (quantity > 0) AND (delta_store = 0) AND (delta_event = (- quantity)))));
alter table public.stock_movements drop constraint if exists stock_movements_action_check;
alter table public.stock_movements add constraint stock_movements_action_check CHECK ((action = ANY (ARRAY['entrada'::text, 'venda_loja'::text, 'transferencia'::text, 'venda_evento'::text, 'devolucao'::text, 'ajuste_loja'::text, 'baixa_evento'::text, 'saida_loja'::text, 'saida_pedido'::text])));
CREATE OR REPLACE FUNCTION public.dispatch_avulso_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.avulso_orders%rowtype;line record;v_current integer;v_held integer;
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate')
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
CREATE OR REPLACE FUNCTION public.create_avulso_order(p_name text, p_phone text, p_items jsonb, p_share_token text DEFAULT NULL::text, p_event_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_name text:=btrim(coalesce(p_name,''));
 v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 v_from_share boolean:=p_share_token is not null;
 v_share public.product_shares%rowtype;
 v_primary public.products%rowtype;
 v_order uuid;
 v_item jsonb;v_product uuid;v_p public.products%rowtype;
 v_qty integer;v_total integer:=0;
 v_seen uuid[]:='{}';
 v_existing uuid;
begin
 if length(v_name) not between 2 and 120 or length(v_phone) not between 10 and 13 then
   raise exception 'Informe nome e telefone com DDD válidos';
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then
   raise exception 'Inclua entre 1 e 40 variações no pedido';
 end if;
 if p_request_id is null then raise exception 'Identificador do pedido obrigatório'; end if;
 select id into v_existing from public.avulso_orders where request_id=p_request_id;
 if v_existing is not null then return v_existing; end if;
 if v_from_share then
   if p_share_token !~ '^[0-9a-f]{64}$' then raise exception 'Link inválido';end if;
   select * into v_share from public.product_shares
    where token_hash=extensions.digest(p_share_token,'sha256')
      and revoked_at is null and expires_at>now();
   if not found then raise exception 'Link expirado';end if;
   select * into v_primary from public.products where id=v_share.product_id and active;
   if not found then raise exception 'Produto indisponível';end if;
   if p_event_id is not null then raise exception 'Um pedido compartilhado não pode escolher evento'; end if;
   if (select count(*) from public.avulso_orders
       where share_id=v_share.id and created_at>now()-interval '1 hour') >= 5 then
       raise exception 'Muitos pedidos neste link. Tente mais tarde.';
   end if;
 else
   if auth.uid() is null or not app_private.role_in('admin','gerente') then
     raise exception 'Permissão insuficiente para criar pedidos internos';
   end if;
 end if;
 if p_event_id is not null and not exists(select 1 from public.events where id=p_event_id) then
   raise exception 'Evento não encontrado';
 end if;
 -- O pedido passa a reservar o livre, sem baixar fisico antes da entrega.
 insert into public.avulso_orders(customer_name,customer_phone,source,created_by,share_id,event_id,request_id)
 values(v_name,v_phone,case when v_from_share then 'compartilhado' else 'interno' end,
        case when v_from_share then null else auth.uid() end,
        case when v_from_share then v_share.id else null end,p_event_id,p_request_id)
 returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item)<>'object'
     or coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
     or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,3}$'
       then raise exception 'Variação ou quantidade inválida'; end if;
   v_product:=(v_item->>'product_id')::uuid;
   v_qty:=(v_item->>'quantity')::integer;
   if v_qty>1000 or v_product=any(v_seen) then raise exception 'Variação repetida ou quantidade excessiva';end if;
   v_seen:=array_append(v_seen,v_product);
   select * into v_p from public.products where id=v_product and active;
   if not found then raise exception 'Produto removido ou indisponível';end if;
   if v_from_share and not (
     (v_primary.apparel_model_id is null and v_p.id=v_primary.id) or
     (v_primary.apparel_model_id is not null and v_p.apparel_model_id=v_primary.apparel_model_id)
   ) then raise exception 'Produto não pertence ao link compartilhado';end if;
   insert into public.avulso_order_items(order_id,product_id,product_name,color,size,sku,ean,quantity)
   values(v_order,v_p.id,v_p.name,v_p.apparel_color,v_p.apparel_size,v_p.sku,v_p.ean,v_qty);
   v_total:=v_total+v_qty;
   if v_total>2000 then raise exception 'Quantidade total do pedido excedida';end if;
 end loop;
 update public.avulso_orders set fulfillment_status='pendente_estoque',
 expires_at=case when v_from_share then now()+interval '48 hours' else null end where id=v_order;
 perform app_private.reserve_unified_order('avulso',v_order);
 if not v_from_share then
   insert into public.audit_log(entity,entity_id,action,actor_id,details)
    values('avulso_orders',v_order::text,'created',auth.uid(),
      jsonb_build_object('event_id',p_event_id,'items',cardinality(v_seen)));
 end if;
 return v_order;
end;$function$
;