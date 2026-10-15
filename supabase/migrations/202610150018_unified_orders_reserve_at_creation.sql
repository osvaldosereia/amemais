create or replace function public.approve_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;
begin
 if auth.uid() is null or not app_private.has_permission('orders.separate') then raise exception 'Sem permissão';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status not in ('solicitado','pendente_estoque','aprovado')
 then raise exception 'Pedido não permite reservar';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso à central';end if;
 perform app_private.reserve_unified_order('loja',p_order);
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'RESERVATION_RECHECKED',auth.uid());
end;$fn$;

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
       where share_id=v_share.id and created_at>now()-interval '1 hour') >= 30 then
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

CREATE OR REPLACE FUNCTION public.create_customer_catalog_order(p_token text, p_name text, p_phone text, p_items jsonb, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_access uuid;v_order uuid;
 v_name text:=btrim(coalesce(p_name,''));
 v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 v_item jsonb;v_p public.products%rowtype;v_id uuid;v_qty integer;
 v_seen uuid[]:='{}';v_total integer:=0;
begin
 if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Acesso inválido';end if;
 select id into v_access from public.customer_catalog_access
 where token_hash=extensions.digest(p_token,'sha256')
 and revoked_at is null and expires_at>now();
 if v_access is null then raise exception 'Acesso vencido ou revogado';end if;
 if p_request_id is null then raise exception 'Identificador obrigatório';end if;
 if length(v_name) not between 2 and 120 or length(v_phone) not between 10 and 13
 then raise exception 'Informe nome e telefone com DDD válidos';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
 or jsonb_array_length(p_items) not between 1 and 40 then
 raise exception 'Escolha entre 1 e 40 variações';end if;
 -- Pedido idempotente: o mesmo envio não cria cópias após instabilidade de rede.
 select id into v_order from public.avulso_orders
 where request_id=p_request_id and customer_access_id=v_access;
 if v_order is not null then return v_order; end if;
 if (select count(*) from public.avulso_orders
     where customer_access_id=v_access and created_at>now()-interval '1 hour')>=5
 then raise exception 'Limite temporário de pedidos neste acesso';end if;
 insert into public.avulso_orders(customer_name,customer_phone,source,customer_access_id,request_id)
 values(v_name,v_phone,'cliente',v_access,p_request_id) returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object'
    or coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
    or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,3}$'
    then raise exception 'Variação ou quantidade inválida';end if;
  v_id:=(v_item->>'product_id')::uuid;
  v_qty:=(v_item->>'quantity')::integer;
  if v_id=any(v_seen) or v_qty>1000 then raise exception 'Item repetido ou quantidade excessiva';end if;
  v_seen:=array_append(v_seen,v_id);
  select * into v_p from public.products where id=v_id and active;
  if not found then raise exception 'Produto indisponível';end if;
  insert into public.avulso_order_items(order_id,product_id,product_name,color,size,sku,ean,quantity)
   values(v_order,v_p.id,v_p.name,v_p.apparel_color,v_p.apparel_size,v_p.sku,v_p.ean,v_qty);
  v_total:=v_total+v_qty;
  if v_total>2000 then raise exception 'Quantidade total excessiva';end if;
 end loop;
 update public.avulso_orders set fulfillment_status='pendente_estoque',
 expires_at=now()+interval '48 hours' where id=v_order;
 perform app_private.reserve_unified_order('avulso',v_order);
 -- A reserva nao movimenta o fisico; somente a conclusao faz a baixa.
 return v_order;
end;$function$
;

CREATE OR REPLACE FUNCTION public.create_store_order(p_from_store uuid, p_to_store uuid, p_type text, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order uuid;v_item jsonb;v_product uuid;v_qty integer;v_seen uuid[]:='{}';v_source public.stores%rowtype;v_target public.stores%rowtype;
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
 perform app_private.reserve_unified_order('loja',v_order);
 return v_order;
end;$function$
;