-- Etapa 1: pedidos parcialmente atendidos, divergências no recebimento e retornos de filiais.
create table if not exists public.store_order_adjustments(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.store_orders(id),
 product_id uuid not null references public.products(id),phase text not null check(phase in ('aprovacao','separacao')),
 previous_quantity integer not null check(previous_quantity>0),approved_quantity integer not null check(approved_quantity>=0),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 actor_id uuid not null references public.staff_profiles(id),created_at timestamptz not null default now(),
 check(approved_quantity<=previous_quantity)
);
create table if not exists public.store_order_receipts(
 order_id uuid not null references public.store_orders(id),product_id uuid not null references public.products(id),
 expected_quantity integer not null check(expected_quantity>0),
 received_quantity integer not null check(received_quantity>=0),
 missing_quantity integer generated always as (expected_quantity-received_quantity) stored,
 reason text,actor_id uuid not null references public.staff_profiles(id),created_at timestamptz not null default now(),
 primary key(order_id,product_id),check(received_quantity<=expected_quantity),
 check(received_quantity=expected_quantity or length(btrim(coalesce(reason,'')))>=5)
);
create table if not exists public.branch_returns(
 id uuid primary key default gen_random_uuid(),from_store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id),quantity integer not null check(quantity>0),
 status text not null default 'em_transito' check(status in ('em_transito','recebido')),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 created_by uuid not null references public.staff_profiles(id),created_at timestamptz not null default now(),
 received_by uuid references public.staff_profiles(id),received_at timestamptz
);
create index if not exists branch_returns_status_idx on public.branch_returns(status,created_at desc);
do $x$ declare t text;begin
 foreach t in array array['store_order_adjustments','store_order_receipts','branch_returns'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $x$;
create policy adjustments_read on public.store_order_adjustments for select to authenticated using(
 app_private.has_permission('orders.read') and exists(select 1 from public.store_orders o where o.id=order_id and
 (app_private.can_access_store(o.from_store_id) or app_private.can_access_store(o.to_store_id))));
create policy receipts_read on public.store_order_receipts for select to authenticated using(
 app_private.has_permission('orders.read') and exists(select 1 from public.store_orders o where o.id=order_id and
 (app_private.can_access_store(o.from_store_id) or app_private.can_access_store(o.to_store_id))));
create policy branch_returns_read on public.branch_returns for select to authenticated using(
 app_private.has_permission('stores.read') and app_private.can_access_store(from_store_id));

-- Conferência parcial antes da aprovação: linhas omitidas/zero são canceladas, pedido original auditado.
create or replace function public.adjust_store_order_items(p_order uuid,p_items jsonb,p_reason text)
returns void language plpgsql security definer set search_path=''
as $fn$
declare o public.store_orders%rowtype;it record;v jsonb;qty integer;seen uuid[]:='{}';remaining integer:=0;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissão';end if;
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
       update public.stock_reservations set status='liberada',ended_by=auth.uid(),ended_at=now()
        where order_id=p_order and product_id=it.product_id and status='ativa';
       if qty>0 then insert into public.stock_reservations(order_id,product_id,quantity,created_by)
         values(p_order,it.product_id,qty,auth.uid());end if;
     end if;
     if qty=0 then delete from public.store_order_items where order_id=p_order and product_id=it.product_id;
     else update public.store_order_items set quantity=qty where order_id=p_order and product_id=it.product_id;end if;
   end if;
 end loop;
 select count(*) into remaining from public.store_order_items where order_id=p_order;
 if remaining=0 then raise exception 'Mantenha ao menos um produto; para cancelar use Cancelar pedido';end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values
 ('store_orders',p_order::text,'QUANTITIES_ADJUSTED',auth.uid(),jsonb_build_object('phase',o.status,'reason',p_reason));
end;$fn$;
revoke all on function public.adjust_store_order_items(uuid,jsonb,text) from public,anon;
grant execute on function public.adjust_store_order_items(uuid,jsonb,text) to authenticated;

-- Recebimento exige quantidades conferidas. Divergência permanece documentada sem criar saldo fictício.
create or replace function public.receive_store_order_checked(p_order uuid,p_items jsonb,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $fn$
declare o public.store_orders%rowtype;it record;v jsonb;qty integer;seen uuid[]:='{}';missing integer:=0;
begin
 if not app_private.has_permission('orders.receive') then raise exception 'Sem permissão para receber';end if;
 select * into o from public.store_orders where id=p_order for update;
 if not found or o.status<>'despachado' then raise exception 'Pedido não está em trânsito';end if;
 if not app_private.can_access_store(o.to_store_id) or not exists(
 select 1 from public.stores where id=o.to_store_id and kind='filial' and active)
 then raise exception 'Destino não é filial autorizada';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Conferência inválida';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if coalesce(v->>'product_id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(v->>'quantity','') !~ '^(0|[1-9][0-9]{0,6})$'
  then raise exception 'Item inválido';end if;
  if (v->>'product_id')::uuid=any(seen) then raise exception 'SKU repetido';end if;
  seen:=array_append(seen,(v->>'product_id')::uuid);
 end loop;
 if (select count(*) from public.store_order_items where order_id=p_order)<>array_length(seen,1)
 then raise exception 'Conferência deve incluir todos os SKUs';end if;
 for it in select * from public.store_order_items where order_id=p_order order by product_id loop
  select (x->>'quantity')::integer into qty from jsonb_array_elements(p_items) x where (x->>'product_id')::uuid=it.product_id;
  if qty is null or qty>it.quantity then raise exception 'Quantidade inválida para %',it.product_id;end if;
  if qty<it.quantity then
    missing:=missing+it.quantity-qty;
    if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justifique divergências de recebimento';end if;
  end if;
  insert into public.store_order_receipts(order_id,product_id,expected_quantity,received_quantity,reason,actor_id)
   values(p_order,it.product_id,it.quantity,qty,case when qty<it.quantity then btrim(p_reason) end,auth.uid());
  if qty>0 then
   insert into public.store_stock(store_id,product_id,quantity) values(o.to_store_id,it.product_id,0) on conflict do nothing;
   perform 1 from public.store_stock where store_id=o.to_store_id and product_id=it.product_id for update;
   update public.store_stock set quantity=quantity+qty,updated_at=now() where store_id=o.to_store_id and product_id=it.product_id;
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
   values(p_order,o.to_store_id,it.product_id,qty,auth.uid(),'recebimento');
  end if;
 end loop;
 update public.store_orders set status=case when missing>0 then 'recebido_divergente' else 'recebido' end,
 received_by=auth.uid(),received_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',p_order::text,'RECEIVED_CHECKED',auth.uid(),jsonb_build_object('missing_units',missing,'reason',p_reason));
end;$fn$;
revoke all on function public.receive_store_order(uuid) from public,anon,authenticated;
revoke all on function public.receive_store_order_checked(uuid,jsonb,text) from public,anon;
grant execute on function public.receive_store_order_checked(uuid,jsonb,text) to authenticated;

-- Devolução da filial: saída em trânsito, entrada na central somente após conferência.
create or replace function public.dispatch_branch_return(p_store uuid,p_product uuid,p_quantity integer,p_expected integer,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_id uuid;v_current integer;
begin
 if not app_private.has_permission('orders.receive') and not app_private.has_permission('stores.manage')
 then raise exception 'Sem permissão';end if;
 if not app_private.can_access_store(p_store) or not exists(select 1 from public.stores where id=p_store and kind='filial' and active)
 then raise exception 'Filial inválida';end if;
 if p_quantity is null or p_quantity<1 or p_quantity>1000000 or p_expected is null then raise exception 'Quantidade inválida';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Motivo obrigatório';end if;
 select quantity into v_current from public.store_stock where store_id=p_store and product_id=p_product for update;
 if v_current is distinct from p_expected then raise exception 'Saldo alterado. Atualize antes de devolver';end if;
 if v_current<p_quantity then raise exception 'Saldo insuficiente na filial';end if;
 update public.store_stock set quantity=quantity-p_quantity,updated_at=now() where store_id=p_store and product_id=p_product;
 insert into public.branch_returns(from_store_id,product_id,quantity,reason,created_by)
 values(p_store,p_product,p_quantity,btrim(p_reason),auth.uid()) returning id into v_id;
 insert into public.store_stock_movements(store_id,product_id,operation,previous_quantity,quantity_delta,new_quantity,reason,actor_id)
 values(p_store,p_product,'saida',v_current,-p_quantity,v_current-p_quantity,'Retorno para central: '||left(btrim(p_reason),220),auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('branch_returns',v_id::text,'RETURN_DISPATCHED',auth.uid(),jsonb_build_object('store_id',p_store,'product_id',p_product,'quantity',p_quantity));
 return v_id;
end;$fn$;
create or replace function public.receive_branch_return(p_return uuid,p_quantity integer)
returns void language plpgsql security definer set search_path=''
as $fn$
declare r public.branch_returns%rowtype;v_before integer;
begin
 if not app_private.has_permission('stock.entry') then raise exception 'Sem permissão para receber na central';end if;
 select * into r from public.branch_returns where id=p_return for update;
 if not found or r.status<>'em_transito' then raise exception 'Devolução já recebida ou inexistente';end if;
 if p_quantity is distinct from r.quantity then raise exception 'Quantidade divergente: mantenha em trânsito e reconcilie antes do recebimento';end if;
 insert into public.stock_balances(product_id,event_id,quantity) values(r.product_id,null,0)
 on conflict(product_id) where event_id is null do nothing;
 select quantity into v_before from public.stock_balances where product_id=r.product_id and event_id is null for update;
 update public.stock_balances set quantity=quantity+r.quantity,updated_at=now() where product_id=r.product_id and event_id is null;
 insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
 values(r.product_id,null,'entrada',r.quantity,r.quantity,0,auth.uid(),'Devolução de filial '||r.id::text);
 update public.branch_returns set status='recebido',received_by=auth.uid(),received_at=now() where id=r.id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('branch_returns',r.id::text,'RETURN_RECEIVED',auth.uid(),jsonb_build_object('quantity',r.quantity,'previous_central',v_before));
end;$fn$;
revoke all on function public.dispatch_branch_return(uuid,uuid,integer,integer,text) from public,anon;
revoke all on function public.receive_branch_return(uuid,integer) from public,anon;
grant execute on function public.dispatch_branch_return(uuid,uuid,integer,integer,text) to authenticated;
grant execute on function public.receive_branch_return(uuid,integer) to authenticated;