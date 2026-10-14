-- Defense in depth for legacy SECURITY DEFINER flows:
-- triggers execute for every call path, including direct REST RPC calls.
create or replace function app_private.guard_permission_mutation()
returns trigger language plpgsql security definer set search_path=''
as $body$
declare v_required text;v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Autenticação necessária';end if;
 case tg_table_name
 when 'products' then
   if tg_op='INSERT' then v_required:='products.create';
   elsif tg_op='DELETE' then v_required:='products.delete';
   elsif new.active is distinct from old.active then v_required:='products.delete';
   elsif new.historical_category_path is distinct from old.historical_category_path
     and app_private.has_permission('categories.manage') then v_required:='categories.manage';
   else v_required:='products.edit';end if;
 when 'apparel_models' then
   if tg_op='INSERT' then v_required:='products.create';else v_required:='products.edit';end if;
 when 'categories' then v_required:='categories.manage';
 when 'tags' then v_required:='tags.manage';
 when 'events' then
   if tg_op='UPDATE' and new.status='encerrado' and old.status<>'encerrado'
    then v_required:='events.close';
    else v_required:='events.manage';end if;
 when 'event_members' then v_required:='events.manage';
 when 'stock_destinations' then v_required:='stock.destinations';
 when 'customer_catalog_access' then v_required:='catalog.manage';
 when 'product_shares' then v_required:='products.share';
 when 'avulso_orders' then
   if tg_op='INSERT' and new.created_by is null then return new;end if;
   if tg_op='UPDATE' and new.event_id is distinct from old.event_id
     then v_required:='orders.assign';
     else v_required:='orders.internal';end if;
 else raise exception 'Tabela sem política de mutação';
 end case;
 if not app_private.has_permission(v_required) then
    raise exception 'Sem permissão para a operação: %',v_required;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;$body$;

drop trigger if exists products_granular_permission on public.products;
create trigger products_granular_permission before insert or update or delete
 on public.products for each row execute function app_private.guard_permission_mutation();
drop trigger if exists apparel_granular_permission on public.apparel_models;
create trigger apparel_granular_permission before insert or update or delete
 on public.apparel_models for each row execute function app_private.guard_permission_mutation();
drop trigger if exists categories_granular_permission on public.categories;
create trigger categories_granular_permission before insert or update or delete
 on public.categories for each row execute function app_private.guard_permission_mutation();
drop trigger if exists tags_granular_permission on public.tags;
create trigger tags_granular_permission before insert or update or delete
 on public.tags for each row execute function app_private.guard_permission_mutation();
drop trigger if exists events_granular_permission on public.events;
create trigger events_granular_permission before insert or update or delete
 on public.events for each row execute function app_private.guard_permission_mutation();
drop trigger if exists event_members_granular_permission on public.event_members;
create trigger event_members_granular_permission before insert or update or delete
 on public.event_members for each row execute function app_private.guard_permission_mutation();
drop trigger if exists destinations_granular_permission on public.stock_destinations;
create trigger destinations_granular_permission before insert or update or delete
 on public.stock_destinations for each row execute function app_private.guard_permission_mutation();
drop trigger if exists catalog_links_granular_permission on public.customer_catalog_access;
create trigger catalog_links_granular_permission before insert or update or delete
 on public.customer_catalog_access for each row execute function app_private.guard_permission_mutation();
drop trigger if exists product_shares_granular_permission on public.product_shares;
create trigger product_shares_granular_permission before insert or update or delete
 on public.product_shares for each row execute function app_private.guard_permission_mutation();
drop trigger if exists avulso_orders_granular_permission on public.avulso_orders;
create trigger avulso_orders_granular_permission before insert or update or delete
 on public.avulso_orders for each row execute function app_private.guard_permission_mutation();

create or replace function app_private.guard_stock_action()
returns trigger language plpgsql security definer set search_path=''
as $body$
declare v_required text;v_primary uuid;v_order_ok boolean:=false;
begin
 select id into v_primary from public.stores where is_primary;
 if new.action='saida_loja' and new.operation_batch_id is null
  and new.note like 'Separação para loja - pedido %' then
  select exists(
   select 1 from public.store_orders o join public.store_order_items oi on oi.order_id=o.id
   where ('Separação para loja - pedido '||o.id::text)=new.note
    and o.status='solicitado' and o.from_store_id=v_primary
    and oi.product_id=new.product_id and oi.quantity=new.quantity
    and app_private.can_access_store(o.from_store_id)
  ) into v_order_ok;
 end if;
 v_required:=case new.action
  when 'entrada' then 'stock.entry'
  when 'venda_loja' then 'stock.exit'
  when 'saida_loja' then case when v_order_ok then 'orders.separate' else 'stock.exit' end
  when 'ajuste_loja' then 'stock.balance'
  when 'transferencia' then 'events.separate'
  when 'devolucao' then 'events.return'
  when 'venda_evento' then 'events.sell'
  when 'baixa_evento' then 'events.close'
  else null end;
 if v_required is null or not app_private.has_permission(v_required) then
   raise exception 'Movimentação não autorizada (%).',coalesce(new.action,'?');
 end if;
 if new.action in ('entrada','venda_loja','saida_loja','ajuste_loja','transferencia','devolucao')
   and not app_private.can_access_store(v_primary) then
   raise exception 'Sem acesso ao estoque central';
 end if;
 if new.action='devolucao' and not (app_private.has_permission('events.manage')
      or app_private.event_role(new.event_id,'responsavel')) then
   raise exception 'Somente responsáveis podem devolver mercadorias deste evento';
 end if;
 if new.action='venda_evento' and not (app_private.has_permission('events.manage')
      or app_private.event_role(new.event_id,'responsavel','operador')) then
   raise exception 'Funcionário não vinculado a este evento';
 end if;
 if new.action='baixa_evento' and not (app_private.has_permission('events.manage')
      or app_private.event_role(new.event_id,'responsavel')) then
   raise exception 'Sem autorização para encerrar este evento';
 end if;
 return new;
end;$body$;
drop trigger if exists movement_granular_permission on public.stock_movements;
create trigger movement_granular_permission before insert on public.stock_movements
 for each row execute function app_private.guard_stock_action();

create or replace function app_private.guard_count_action()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 if not app_private.has_permission('stock.balance') or
    not app_private.can_access_store((select id from public.stores where is_primary))
 then raise exception 'Sem autorização para realizar balanço da central';end if;
 return new;
end;$body$;
drop trigger if exists stock_counts_granular_permission on public.stock_counts;
create trigger stock_counts_granular_permission before insert on public.stock_counts
 for each row execute function app_private.guard_count_action();

create or replace function app_private.guard_new_stock_balance()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 if new.event_id is null and new.quantity>0 and
 (not app_private.has_permission('stock.entry')
   or not app_private.can_access_store((select id from public.stores where is_primary)))
 then raise exception 'Estoque inicial exige autorização de entrada na central';end if;
 return new;
end;$body$;
drop trigger if exists new_balance_permission on public.stock_balances;
create trigger new_balance_permission before insert on public.stock_balances
 for each row execute function app_private.guard_new_stock_balance();

create or replace function app_private.guard_stock_batch()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
 if not app_private.has_permission(case new.operation when 'entrada' then 'stock.entry' else 'stock.exit' end)
    or not app_private.can_access_store((select id from public.stores where is_primary))
 then raise exception 'Sem autorização para o lote de estoque';end if;
 return new;
end;$body$;
drop trigger if exists batches_granular_permission on public.stock_operation_batches;
create trigger batches_granular_permission before insert on public.stock_operation_batches
 for each row execute function app_private.guard_stock_batch();

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using(
 app_private.has_permission('movements.read') or app_private.has_permission('users.manage')
);
-- Retain the original technical role only when required by legacy RPC guards;
-- exact authorization is still independently enforced by triggers and RLS.
create or replace function public.set_staff_access(
 p_user_id uuid,p_role text,p_permissions text[],p_store_ids uuid[])
returns void language plpgsql security definer set search_path=''
as $body$
declare v_perm text;v_store uuid;v_oldrole text;v_effective_role text;
begin
 if not app_private.has_permission('users.manage') or
    not exists(select 1 from public.staff_profiles p where p.id=auth.uid() and p.role='admin')
 then raise exception 'Somente administradores podem atribuir autorizações';end if;
 if p_user_id=auth.uid() then raise exception 'Não altere suas próprias autorizações';end if;
 if p_role not in ('admin','gerente','estoquista','evento','consulta') then raise exception 'Perfil inválido';end if;
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
end;$body$;
revoke all on function public.set_staff_access(uuid,text,text[],uuid[]) from public,anon;
grant execute on function public.set_staff_access(uuid,text,text[],uuid[]) to authenticated;
