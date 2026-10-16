-- Pedidos de destino obrigatório: reserva atômica, sem exposição de saldos
CREATE OR REPLACE FUNCTION app_private.set_event_batch_lines(p_batch uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;v_id uuid;v_qty integer;v_seen uuid[]:='{}';v_total integer:=0;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 5000 then
   raise exception 'Inclua entre 1 e 150 variações';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object'
   or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
   or coalesce(v->>'quantity','')!~'^[1-9][0-9]{0,6}$'
  then raise exception 'Código ou quantidade inválida';end if;
  v_id:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if v_qty>1000000 or v_id=any(v_seen) then raise exception 'SKU duplicado ou quantidade excessiva';end if;
  if not exists(select 1 from public.products where id=v_id and active)
   then raise exception 'SKU inativo ou inexistente';end if;
  v_seen:=array_append(v_seen,v_id);
  v_total:=v_total+v_qty;
 end loop;
 delete from public.stock_reservations where event_batch_id=p_batch and status='ativa';
 delete from public.event_pick_batch_items where batch_id=p_batch;
 for v in select value from jsonb_array_elements(p_items) loop
  insert into public.event_pick_batch_items(batch_id,product_id,quantity)
   values(p_batch,(v->>'product_id')::uuid,(v->>'quantity')::integer);
 end loop;
 perform app_private.allocate_event_batch_stock(p_batch);
 return v_total;
end;$function$
;
CREATE OR REPLACE FUNCTION public.create_store_order(p_from_store uuid, p_to_store uuid, p_type text, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order uuid;v_item jsonb;v_product uuid;v_qty integer;v_seen uuid[]:='{}';v_source public.stores%rowtype;v_target public.stores%rowtype;v_short_sku text;v_short_id uuid;
begin
 if exists(select 1 from public.staff_profiles where id=auth.uid() and role='franquia')
     and p_type<>'franquia' then raise exception 'Franquias só podem solicitar para sua própria unidade';end if;
 if not (case p_type when 'central' then app_private.has_permission('orders.central')
                       when 'franquia' then app_private.has_permission('orders.franchise') else false end)
 then raise exception 'Sem autorização para solicitar este tipo de pedido';end if;
 if p_from_store=p_to_store then raise exception 'Origem e destino devem ser diferentes';end if;
 select * into v_source from public.stores where id=p_from_store and active;
 select * into v_target from public.stores where id=p_to_store and active;
 if v_source.id is null or v_target.id is null then raise exception 'Loja inexistente ou inativa';end if;
 if not app_private.can_access_store(p_to_store) then raise exception 'Sem vínculo com a loja solicitante';end if;
 if not v_source.is_primary then raise exception 'Todo pedido deve sair do CD principal';end if;
 if p_type='franquia' and v_target.kind<>'franquia' then raise exception 'Pedido de franquia exige loja franqueada';end if;
 if p_type='central' and v_target.kind<>'filial' then raise exception 'Pedido de loja deve ir a uma filial';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 5000
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
 perform app_private.reserve_unified_order('loja',v_order);
 -- A criação inteira falha quando qualquer SKU não puder ser integralmente reservado.
 if (select status from public.store_orders where id=v_order)<>'aprovado' then
   select i.product_id,p.sku into v_short_id,v_short_sku
   from public.store_order_items i
   join public.products p on p.id=i.product_id
   left join public.stock_reservations r on r.order_id=v_order
     and r.product_id=i.product_id and r.status='ativa'
   where i.order_id=v_order and coalesce(r.quantity,0)<i.quantity
   order by i.product_id limit 1;
   raise exception 'Produto SKU % indisponível para a quantidade solicitada. Reduza e tente novamente.',
     coalesce(v_short_sku,v_short_id::text,'desconhecido');
 end if;
 return v_order;
end;$function$
;
CREATE OR REPLACE FUNCTION public.create_event_pick_batch(p_event uuid, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v_batch uuid;v_seq integer;v_short_sku text;v_short_id uuid;
begin
 if auth.uid() is null OR not (
   (app_private.role_in('admin','gerente') AND app_private.has_permission('events.separate'))
   OR (app_private.has_permission('events.request') AND app_private.event_role(p_event,'responsavel','operador'))
 ) THEN raise exception 'Sem permissão para solicitar produtos deste evento'; END IF;
 select * into e from public.events where id=p_event for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local não aceita novos lotes';end if;
 if length(coalesce(p_note,''))>180 then raise exception 'Observação muito longa';end if;
 select coalesce(max(sequence),0)+1 into v_seq from public.event_pick_batches where event_id=p_event;
 insert into public.event_pick_batches(event_id,sequence,created_by,note)
 values(p_event,v_seq,auth.uid(),nullif(btrim(coalesce(p_note,'')),'')) returning id into v_batch;
 perform app_private.set_event_batch_lines(v_batch,p_items);
 if (select status from public.event_pick_batches where id=v_batch)<>'aguardando' then
   select i.product_id,p.sku into v_short_id,v_short_sku
   from public.event_pick_batch_items i
   join public.products p on p.id=i.product_id
   left join public.stock_reservations r on r.event_batch_id=v_batch
     and r.product_id=i.product_id and r.status='ativa'
   where i.batch_id=v_batch and coalesce(r.quantity,0)<i.quantity
   order by i.product_id limit 1;
   raise exception 'Produto SKU % indisponível para a quantidade solicitada. Reduza e tente novamente.',
      coalesce(v_short_sku,v_short_id::text,'desconhecido');
 end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'EVENT_BATCH_CREATED',auth.uid(),
 jsonb_build_object('batch',v_batch,'sequence',v_seq));
 return v_batch;
end;$function$
;
-- Defesa adicional: não expor saldo físico ou reservas às contas de franquia
drop policy if exists balances_read on public.stock_balances;
create policy balances_read on public.stock_balances for select to authenticated
using (not app_private.role_in('franquia') and (
 (event_id is null and app_private.can_access_store((select id from public.stores where is_primary))
    and (app_private.has_permission('products.read') or app_private.has_permission('stock.balance')
       or app_private.has_permission('stock.entry') or app_private.has_permission('stock.exit')
       or app_private.has_permission('orders.separate')))
 or (event_id is not null and (app_private.has_permission('events.manage')
    or app_private.has_permission('events.separate')
    or app_private.event_role(event_id,'responsavel','operador')))
));
drop policy if exists reservations_read_central on public.stock_reservations;
create policy reservations_read_central on public.stock_reservations for select to authenticated
using (not app_private.role_in('franquia') and
 app_private.can_access_store((select id from public.stores where is_primary))
 and (app_private.has_permission('orders.separate') or app_private.has_permission('stock.balance')
  or app_private.has_permission('stock.entry') or app_private.has_permission('stock.exit')
  or app_private.has_permission('products.read')));
