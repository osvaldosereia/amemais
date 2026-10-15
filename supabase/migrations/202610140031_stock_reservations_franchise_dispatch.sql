
-- AME MAIS / 2026-10-14 / disponibilidade, franquias e consignacao
-- Nao altera saldos legados nem apaga movimentacoes.
alter table public.store_orders drop constraint store_orders_status_check;
alter table public.store_orders add constraint store_orders_status_check check
 (status in ('solicitado','aprovado','separado','despachado','concluido','recebido','cancelado'));
alter table public.store_orders
 add column if not exists approved_by uuid references public.staff_profiles(id),
 add column if not exists approved_at timestamptz,
 add column if not exists dispatched_by uuid references public.staff_profiles(id),
 add column if not exists dispatched_at timestamptz,
 add column if not exists external_reference text;
alter table public.store_orders add constraint store_orders_external_ref_length
 check (external_reference is null or length(external_reference)<=120);
alter table public.store_transfer_log drop constraint if exists store_transfer_log_operation_check;
alter table public.store_transfer_log add constraint store_transfer_log_operation_check
 check (operation in ('separacao','recebimento','saida_definitiva','expedicao'));

create table if not exists public.stock_reservations(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.store_orders(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check (quantity between 1 and 1000000),
 status text not null default 'ativa' check (status in ('ativa','consumida','liberada')),
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 ended_by uuid references public.staff_profiles(id),
 ended_at timestamptz,
 unique(order_id,product_id),
 foreign key(order_id,product_id) references public.store_order_items(order_id,product_id)
);
create index if not exists stock_reservations_active_product on public.stock_reservations(product_id) where status='ativa';
alter table public.stock_reservations enable row level security;
drop policy if exists reservations_read_central on public.stock_reservations;
create policy reservations_read_central on public.stock_reservations for select to authenticated using(
 app_private.can_access_store((select id from public.stores where is_primary))
 and (app_private.has_permission('orders.separate') or app_private.has_permission('stock.balance')
      or app_private.has_permission('stock.entry') or app_private.has_permission('stock.exit')
      or app_private.has_permission('products.read')));
revoke all on public.stock_reservations from public,anon,authenticated;
grant select on public.stock_reservations to authenticated;

-- Reservas sao um compromisso sobre fisico; nenhum caminho legado pode baixar abaixo da reserva.
create or replace function app_private.protect_reserved_central()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_reserved bigint;
begin
 if old.event_id is not null then
   return case when tg_op='DELETE' then old else new end;
 end if;
 select coalesce(sum(quantity),0) into v_reserved
 from public.stock_reservations where product_id=old.product_id and status='ativa';
 if tg_op='DELETE' and v_reserved>0 then
   raise exception 'Produto com unidades reservadas. Cancele os pedidos antes de remover o saldo.';
 end if;
 if tg_op='UPDATE' and (new.event_id is distinct from old.event_id or new.quantity<v_reserved) then
   raise exception 'Estoque comprometido: % unidade(s) reservada(s); nao e permitido reduzir o fisico abaixo da reserva.',v_reserved;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$fn$;
drop trigger if exists protect_reserved_central on public.stock_balances;
create trigger protect_reserved_central before update or delete on public.stock_balances
for each row execute function app_private.protect_reserved_central();

-- O acesso do franqueado e ao catalogo e seus pedidos; nunca ao estoque fisico de franquias.
drop policy if exists storestock_read on public.store_stock;
create policy storestock_read on public.store_stock for select to authenticated
using(app_private.can_access_store(store_id) and app_private.has_permission('products.read')
      and exists(select 1 from public.stores s where s.id=store_id and s.kind<>'franquia'));

create or replace function public.approve_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_item record;v_qty integer;v_res integer;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissao para aprovar pedidos';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'solicitado' then raise exception 'Pedido nao esta aguardando aprovacao';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 if not exists(select 1 from public.stores where id=v_order.from_store_id and is_primary and active)
 then raise exception 'A aprovacao exige origem na central';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   insert into public.stock_balances(product_id,event_id,quantity) values(v_item.product_id,null,0)
     on conflict (product_id) where event_id is null do nothing;
   select quantity into v_qty from public.stock_balances
      where product_id=v_item.product_id and event_id is null for update;
   select coalesce(sum(quantity),0) into v_res from public.stock_reservations
      where product_id=v_item.product_id and status='ativa';
   if v_qty-v_res<v_item.quantity then
      raise exception 'Saldo livre insuficiente para %: fisico %, reservado %, solicitado %',
      v_item.product_id,v_qty,v_res,v_item.quantity;
   end if;
   insert into public.stock_reservations(order_id,product_id,quantity,created_by)
    values(p_order,v_item.product_id,v_item.quantity,auth.uid());
 end loop;
 update public.store_orders set status='aprovado',approved_by=auth.uid(),approved_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'APPROVED_RESERVED',auth.uid());
end;$fn$;

-- Separacao nao baixa fisico: apenas confirma a conferencia operacional.
create or replace function public.separate_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_expected integer;v_reserved integer;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissao para separar';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'aprovado' then raise exception 'Aprove e reserve o pedido antes de separar';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 select count(*) into v_expected from public.store_order_items where order_id=p_order;
 select count(*) into v_reserved from public.stock_reservations where order_id=p_order and status='ativa';
 if v_expected<>v_reserved then raise exception 'Reservas incompletas no pedido';end if;
 update public.store_orders set status='separado',separated_by=auth.uid(),separated_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id)
 values('store_orders',p_order::text,'PICKED',auth.uid());
end;$fn$;

-- Esta e a UNICA etapa em que mercadoria de franquia deixa o estoque AME MAIS.
create or replace function public.dispatch_store_order(p_order uuid,p_external_reference text default null)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_item record;v_current integer;v_target_kind text;v_reserved integer;
begin
 if not app_private.has_permission('orders.separate') then raise exception 'Sem permissao para registrar saida';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'separado' then raise exception 'Pedido ainda nao separado ou ja expedido';end if;
 if not app_private.can_access_store(v_order.from_store_id) then raise exception 'Sem acesso a origem';end if;
 if not exists(select 1 from public.stores where id=v_order.from_store_id and is_primary and active)
 then raise exception 'Origem deve ser a central';end if;
 select kind into v_target_kind from public.stores where id=v_order.to_store_id and active;
 if v_target_kind is null then raise exception 'Destino inativo';end if;
 if length(coalesce(p_external_reference,''))>120 then raise exception 'Referencia externa longa demais';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   select quantity into v_current from public.stock_balances where product_id=v_item.product_id
     and event_id is null for update;
   select quantity into v_reserved from public.stock_reservations where order_id=p_order
     and product_id=v_item.product_id and status='ativa' for update;
   if v_reserved is distinct from v_item.quantity or v_current<v_item.quantity then
     raise exception 'Separacao inconsistente para %',v_item.product_id;
   end if;
   update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
    where order_id=p_order and product_id=v_item.product_id and status='ativa';
   update public.stock_balances set quantity=quantity-v_item.quantity,updated_at=now()
    where product_id=v_item.product_id and event_id is null;
   insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
    values(v_item.product_id,null,'saida_loja',v_item.quantity,-v_item.quantity,0,auth.uid(),
      'Separacao para loja - pedido '||p_order::text);
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
    values(p_order,v_order.from_store_id,v_item.product_id,-v_item.quantity,auth.uid(),
      case when v_target_kind='franquia' then 'saida_definitiva' else 'expedicao' end);
 end loop;
 update public.store_orders set status=case when v_target_kind='franquia' then 'concluido' else 'despachado' end,
     dispatched_by=auth.uid(),dispatched_at=now(),external_reference=nullif(btrim(coalesce(p_external_reference,'')),'')
 where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('store_orders',p_order::text,'DISPATCHED',auth.uid(),
   jsonb_build_object('destination_kind',v_target_kind,'external_reference',p_external_reference));
end;$fn$;

create or replace function public.receive_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;v_item record;v_kind text;
begin
 if not app_private.has_permission('orders.receive') then raise exception 'Sem permissao para receber';end if;
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status<>'despachado' then raise exception 'Pedido nao esta em transito';end if;
 if not app_private.can_access_store(v_order.to_store_id) then raise exception 'Sem acesso ao destino';end if;
 select kind into v_kind from public.stores where id=v_order.to_store_id and active;
 if v_kind is null or v_kind='franquia' then raise exception 'Franquia nao possui estoque interno controlado';end if;
 for v_item in select * from public.store_order_items where order_id=p_order order by product_id loop
   insert into public.store_stock(store_id,product_id,quantity)
   values(v_order.to_store_id,v_item.product_id,0) on conflict do nothing;
   perform 1 from public.store_stock where store_id=v_order.to_store_id
      and product_id=v_item.product_id for update;
   update public.store_stock set quantity=quantity+v_item.quantity,updated_at=now()
     where store_id=v_order.to_store_id and product_id=v_item.product_id;
   insert into public.store_transfer_log(order_id,store_id,product_id,delta,actor_id,operation)
     values(p_order,v_order.to_store_id,v_item.product_id,v_item.quantity,auth.uid(),'recebimento');
 end loop;
 update public.store_orders set status='recebido',received_by=auth.uid(),received_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id) values('store_orders',p_order::text,'RECEIVED',auth.uid());
end;$fn$;

create or replace function public.cancel_store_order(p_order uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_order public.store_orders%rowtype;
begin
 select * into v_order from public.store_orders where id=p_order for update;
 if not found or v_order.status not in ('solicitado','aprovado','separado')
 then raise exception 'Pedido nao pode mais ser cancelado';end if;
 if not ((v_order.status='solicitado' and v_order.created_by=auth.uid())
   or (app_private.has_permission('orders.cancel') and app_private.can_access_store(v_order.to_store_id)))
 then raise exception 'Sem permissao para cancelar';end if;
 update public.stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
   where order_id=p_order and status='ativa';
 update public.store_orders set status='cancelado',canceled_by=auth.uid(),canceled_at=now() where id=p_order;
 insert into public.audit_log(entity,entity_id,action,actor_id) values('store_orders',p_order::text,'CANCELED',auth.uid());
end;$fn$;

-- Novo fechamento: so encerra a consignacao quando tudo estiver conciliado.
create or replace function public.close_event(p_event_id uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_event public.events%rowtype;v_remaining integer;
begin
 if not app_private.has_permission('events.close') or
    not (app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel'))
 then raise exception 'Sem autorizacao para encerrar loja temporaria';end if;
 select * into v_event from public.events where id=p_event_id for update;
 if not found or v_event.status<>'ativo' then raise exception 'Loja temporaria nao esta ativa';end if;
 select coalesce(sum(quantity),0) into v_remaining from public.stock_balances where event_id=p_event_id;
 if v_remaining<>0 then
   raise exception 'Consignacao nao conciliada: % unidade(s) ainda estao no local. Registre venda, devolucao ou baixa justificada antes de encerrar.',v_remaining;
 end if;
 update public.events set status='encerrado',closed_by=auth.uid(),closed_at=now() where id=p_event_id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event_id::text,'CLOSED_RECONCILED',auth.uid(),jsonb_build_object('remaining',0));
end;$fn$;

-- As regras de autorizacao legadas sao mantidas, agora na saida fisica e nao na separacao.
create or replace function app_private.guard_stock_action()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_required text;v_primary uuid;v_order_ok boolean:=false;
begin
 select id into v_primary from public.stores where is_primary;
 if new.action='saida_loja' and new.operation_batch_id is null
    and new.note like 'Separacao para loja - pedido %' then
   select exists(
    select 1 from public.store_orders o join public.store_order_items oi on oi.order_id=o.id
    where ('Separacao para loja - pedido '||o.id::text)=new.note
      and o.status='separado' and o.from_store_id=v_primary
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
    raise exception 'Movimentacao nao autorizada (%)',coalesce(new.action,'?');end if;
 if new.action in ('entrada','venda_loja','saida_loja','ajuste_loja','transferencia','devolucao')
    and not app_private.can_access_store(v_primary) then
    raise exception 'Sem acesso ao estoque central';end if;
 if new.action='devolucao' and not(app_private.has_permission('events.manage')
    or app_private.event_role(new.event_id,'responsavel')) then
    raise exception 'Somente responsaveis podem devolver mercadorias';end if;
 if new.action='venda_evento' and not(app_private.has_permission('events.manage')
    or app_private.event_role(new.event_id,'responsavel','operador')) then
    raise exception 'Funcionario nao vinculado a loja temporaria';end if;
 if new.action='baixa_evento' and not(app_private.has_permission('events.manage')
    or app_private.event_role(new.event_id,'responsavel')) then
    raise exception 'Sem autorizacao para baixa';end if;
 return new;
end;$fn$;

revoke all on function public.approve_store_order(uuid) from public,anon;
revoke all on function public.dispatch_store_order(uuid,text) from public,anon;
grant execute on function public.approve_store_order(uuid),public.dispatch_store_order(uuid,text) to authenticated;
