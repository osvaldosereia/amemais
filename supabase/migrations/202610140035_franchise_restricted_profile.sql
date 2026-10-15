-- Perfil franquia: somente catálogo, solicitação e próprio destino.
alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check
 check(role in ('admin','gerente','estoquista','evento','consulta','franquia'));
insert into app_private.role_permission_defaults(role,permission) values
 ('franquia','products.read'),('franquia','orders.franchise') on conflict do nothing;
CREATE OR REPLACE FUNCTION public.set_staff_access(p_user_id uuid, p_role text, p_permissions text[], p_store_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_perm text;v_store uuid;v_oldrole text;v_effective_role text;
begin
 if not app_private.has_permission('users.manage') or
    not exists(select 1 from public.staff_profiles p where p.id=auth.uid() and p.role='admin')
 then raise exception 'Somente administradores podem atribuir autorizações';end if;
 if p_user_id=auth.uid() then raise exception 'Não altere suas próprias autorizações';end if;
 if p_role not in ('admin','gerente','estoquista','evento','consulta','franquia') then raise exception 'Perfil inválido';end if;
 if p_role='franquia' then
   if coalesce(array_length(p_permissions,1),0)<>2 or
      not (p_permissions @> array['products.read','orders.franchise']::text[]) or
      not (p_permissions <@ array['products.read','orders.franchise']::text[]) then
     raise exception 'Perfil franquia permite apenas catálogo e pedidos';end if;
   if coalesce(array_length(p_store_ids,1),0)<>1 or not exists(
      select 1 from public.stores where id=p_store_ids[1] and kind='franquia' and active
   ) then raise exception 'Escolha exatamente uma franquia ativa';end if;
 end if;
 select role into v_oldrole from public.staff_profiles where id=p_user_id for update;
 if not found then raise exception 'Funcionário não encontrado';end if;
 if coalesce(array_length(p_permissions,1),0)=0 then raise exception 'Selecione ao menos uma permissão';end if;
 for v_perm in select distinct unnest(p_permissions) loop
   if not exists(select 1 from public.permission_definitions where permission=v_perm)
     then raise exception 'Permissão desconhecida: %',v_perm;end if;
 end loop;
 for v_store in select distinct unnest(coalesce(p_store_ids,array[]::uuid[])) loop
   if not exists(select 1 from public.stores where id=v_store and active)
     then raise exception 'Loja inexistente ou inativa';end if;
 end loop;
 v_effective_role:=case when 'admin'=p_role then 'admin'
 when p_permissions && array['stock.entry','stock.exit','stock.destinations','events.manage',
 'events.separate','orders.internal','orders.assign','products.delete','categories.manage',
 'tags.manage','catalog.manage','products.share']::text[]
 then 'gerente'
 when p_permissions && array['products.create','products.edit','stock.balance']::text[]
 then 'estoquista'
 else p_role end;
 update public.staff_profiles set role=v_effective_role,permissions_customized=true where id=p_user_id;
 delete from public.staff_permissions where user_id=p_user_id;
 insert into public.staff_permissions(user_id,permission)
 select p_user_id,v from (select distinct unnest(p_permissions) as v) q;
 delete from public.staff_stores where user_id=p_user_id;
 insert into public.staff_stores(user_id,store_id)
 select p_user_id,v from (select distinct unnest(coalesce(p_store_ids,array[]::uuid[])) v) q;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('staff_profiles',p_user_id::text,'PERMISSIONS_UPDATED',auth.uid(),
        jsonb_build_object('old_role',v_oldrole,'requested_role',p_role,
          'technical_role',v_effective_role,'permissions',p_permissions,'stores',p_store_ids));
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
 return v_order;
end;$function$
;
