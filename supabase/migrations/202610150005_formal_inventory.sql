create table public.inventory_sessions(id uuid primary key default gen_random_uuid(),location_type text not null check(location_type in ('central','filial','temporaria')),location_id uuid,title text not null,status text not null default 'aberta' check(status in ('aberta','revisao','aplicada','cancelada')),created_by uuid not null references public.staff_profiles(id),created_at timestamptz default now(),reviewed_by uuid references public.staff_profiles(id),reviewed_at timestamptz,note text,check((location_type='central' and location_id is null) or(location_type<>'central' and location_id is not null)));
create table public.inventory_session_items(session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),expected_quantity integer not null check(expected_quantity>=0),counted_quantity integer check(counted_quantity>=0),counted_by uuid references public.staff_profiles(id),counted_at timestamptz,primary key(session_id,product_id));
alter table public.inventory_sessions enable row level security;alter table public.inventory_session_items enable row level security;
revoke all on public.inventory_sessions,public.inventory_session_items from public,anon;
grant select on public.inventory_sessions,public.inventory_session_items to authenticated;
create policy inv_read on public.inventory_sessions for select to authenticated using((location_type='central' and app_private.has_permission('stock.balance')) or(location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(location_id)) or(location_type='temporaria' and app_private.has_permission('events.manage')));
create policy inv_items_read on public.inventory_session_items for select to authenticated using(exists(select 1 from public.inventory_sessions s where s.id=session_id and ((s.location_type='central' and app_private.has_permission('stock.balance')) or(s.location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(s.location_id)) or(s.location_type='temporaria' and app_private.has_permission('events.manage')))));
create or replace function public.inventory_start(p_type text,p_location uuid,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or length(btrim(coalesce(p_title,''))) not between 3 and 120 then raise exception 'Identificação inválida';end if;
 if p_type='central' then
  if p_location is not null or not app_private.has_permission('stock.balance') then raise exception 'Sem acesso central';end if;
 elsif p_type='filial' then
  if not app_private.has_permission('stores.manage') or not app_private.can_access_store(p_location) or not exists(select 1 from public.stores where id=p_location and kind='filial' and active) then raise exception 'Filial inválida';end if;
 elsif p_type='temporaria' then
  if not app_private.has_permission('events.manage') or not exists(select 1 from public.events where id=p_location and status='ativo') then raise exception 'Loja temporária inválida';end if;
 else raise exception 'Tipo inválido';end if;
 if exists(select 1 from public.inventory_sessions where location_type=p_type and location_id is not distinct from p_location and status in ('aberta','revisao')) then raise exception 'Inventário pendente neste local';end if;
 insert into public.inventory_sessions(location_type,location_id,title,created_by) values(p_type,p_location,btrim(p_title),auth.uid()) returning id into v_id;
 insert into public.inventory_session_items(session_id,product_id,expected_quantity)
 select v_id,p.id,case when p_type='filial' then coalesce((select quantity from public.store_stock where store_id=p_location and product_id=p.id),0) else coalesce((select quantity from public.stock_balances where product_id=p.id and event_id is not distinct from p_location),0) end
 from public.products p where p.active;
 insert into public.audit_log(entity,entity_id,action,actor_id) values('inventory_sessions',v_id::text,'OPENED',auth.uid());
 return v_id;
end $$;
create or replace function public.inventory_count(p_session uuid,p_product uuid,p_counted integer) returns void language plpgsql security definer set search_path='' as $$
declare s public.inventory_sessions%rowtype;
begin
 select * into s from public.inventory_sessions where id=p_session for update;
 if not found or s.status<>'aberta' then raise exception 'Sessão não está aberta';end if;
 if not ((s.location_type='central' and app_private.has_permission('stock.balance')) or(s.location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(s.location_id)) or(s.location_type='temporaria' and app_private.has_permission('events.manage'))) then raise exception 'Sem acesso';end if;
 if p_counted is null or p_counted not between 0 and 1000000 then raise exception 'Contagem inválida';end if;
 update public.inventory_session_items set counted_quantity=p_counted,counted_by=auth.uid(),counted_at=now() where session_id=p_session and product_id=p_product;
 if not found then raise exception 'Produto não pertence à sessão';end if;
end $$;
create or replace function public.inventory_submit(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.inventory_sessions%rowtype;
begin
 select * into s from public.inventory_sessions where id=p_session for update;
 if not found or s.status<>'aberta' then raise exception 'Sessão não está aberta';end if;
 if not ((s.location_type='central' and app_private.has_permission('stock.balance')) or(s.location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(s.location_id)) or(s.location_type='temporaria' and app_private.has_permission('events.manage'))) then raise exception 'Sem acesso';end if;
 if exists(select 1 from public.inventory_session_items where session_id=p_session and counted_quantity is null) then raise exception 'Conte todos os SKUs, inclusive zeros';end if;
 update public.inventory_sessions set status='revisao' where id=p_session;
 insert into public.audit_log(entity,entity_id,action,actor_id) values('inventory_sessions',p_session::text,'SUBMITTED',auth.uid());
end $$;
create or replace function public.inventory_finalize(p_session uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare s public.inventory_sessions%rowtype;i record;v_current integer;v_reserved integer;v_delta integer;
begin
 select * into s from public.inventory_sessions where id=p_session for update;
 if not found or s.status<>'revisao' then raise exception 'Sessão não está em revisão';end if;
 if not ((s.location_type='central' and app_private.has_permission('stock.balance')) or(s.location_type='filial' and app_private.has_permission('stores.manage') and app_private.can_access_store(s.location_id)) or(s.location_type='temporaria' and app_private.has_permission('events.manage'))) then raise exception 'Sem autorização';end if;
 if p_approve is null then raise exception 'Decisão obrigatória';end if;
 if p_approve and exists(select 1 from public.inventory_session_items where session_id=p_session and counted_quantity<>expected_quantity) and length(btrim(coalesce(p_note,''))) not between 5 and 250 then raise exception 'Justificativa obrigatória';end if;
 if p_approve then
  for i in select * from public.inventory_session_items where session_id=p_session order by product_id loop
   if s.location_type='filial' then
    insert into public.store_stock(store_id,product_id,quantity) values(s.location_id,i.product_id,0) on conflict do nothing;
    select quantity into v_current from public.store_stock where store_id=s.location_id and product_id=i.product_id for update;
   else
    insert into public.stock_balances(product_id,event_id,quantity) values(i.product_id,s.location_id,0) on conflict do nothing;
    select quantity into v_current from public.stock_balances where product_id=i.product_id and event_id is not distinct from s.location_id for update;
   end if;
   if v_current is distinct from i.expected_quantity then raise exception 'Saldo mudou durante inventário; abra nova sessão';end if;
   if s.location_type='central' then
    select coalesce(sum(quantity),0) into v_reserved from public.stock_reservations where product_id=i.product_id and status='ativa';
    if i.counted_quantity<v_reserved then raise exception 'Contagem inferior às reservas do SKU %',i.product_id;end if;
   end if;
   v_delta:=i.counted_quantity-v_current;
   if v_delta<>0 then
    if s.location_type='filial' then
     update public.store_stock set quantity=i.counted_quantity,updated_at=now() where store_id=s.location_id and product_id=i.product_id;
     insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id) values(s.location_id,i.product_id,'ajuste',v_current,v_delta,i.counted_quantity,'Inventário '||p_session::text,auth.uid());
    elsif s.location_type='central' then
     update public.stock_balances set quantity=i.counted_quantity,updated_at=now() where product_id=i.product_id and event_id is null;
     insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note) values(i.product_id,null,'ajuste_loja',v_delta,v_delta,0,auth.uid(),'Inventário '||p_session::text);
    else
     -- Ajustes em consignação não devem simular transferências da central.
     update public.stock_balances set quantity=i.counted_quantity,updated_at=now() where product_id=i.product_id and event_id=s.location_id;
     insert into public.audit_log(entity,entity_id,action,actor_id,details) values('inventory_sessions',p_session::text,'TEMPORARY_VARIANCE',auth.uid(),jsonb_build_object('product_id',i.product_id,'delta',v_delta,'before',v_current,'after',i.counted_quantity));
    end if;
   end if;
  end loop;
 end if;
 update public.inventory_sessions set status=case when p_approve then 'aplicada' else 'cancelada' end,reviewed_by=auth.uid(),reviewed_at=now(),note=nullif(btrim(coalesce(p_note,'')),'') where id=p_session;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values('inventory_sessions',p_session::text,case when p_approve then 'APPLIED' else 'REJECTED' end,auth.uid(),jsonb_build_object('note',p_note));
end $$;
revoke all on function public.inventory_start(text,uuid,text),public.inventory_count(uuid,uuid,integer),public.inventory_submit(uuid),public.inventory_finalize(uuid,boolean,text) from public,anon;
grant execute on function public.inventory_start(text,uuid,text),public.inventory_count(uuid,uuid,integer),public.inventory_submit(uuid),public.inventory_finalize(uuid,boolean,text) to authenticated;