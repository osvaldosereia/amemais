-- Guard avulso dispatch movements against an actual checked order and consumed reservation.
CREATE OR REPLACE FUNCTION app_private.guard_stock_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_required text;v_primary uuid;v_order_ok boolean:=false;v_avulso_ok boolean:=false;
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
 if new.action='saida_pedido' and new.operation_batch_id is null then
   select exists (
    select 1 from public.avulso_orders o
    join public.avulso_order_items oi on oi.order_id=o.id
    join public.order_operational_progress progress
      on progress.kind='avulso' and progress.order_id=o.id
    join public.stock_reservations reservation
      on reservation.avulso_order_id=o.id and reservation.product_id=oi.product_id
    where new.note='Pedido parcial/conferido '||o.id::text
      and o.fulfillment_status='separado'
      and oi.product_id=new.product_id
      and (progress.items->(oi.product_id::text)->>'counted')::integer=new.quantity
      and progress.stage='expedicao'
      and reservation.status='consumida'
      and reservation.quantity=new.quantity
      and new.event_id is null
      and new.actor_id=auth.uid()
   ) into v_avulso_ok;
 end if;
 v_required:=case new.action
 when 'entrada' then 'stock.entry'
 when 'venda_loja' then 'stock.exit'
 when 'saida_loja' then case when v_order_ok then 'orders.separate' else 'stock.exit' end
 when 'saida_pedido' then case when v_avulso_ok then 'orders.dispatch' else null end
 when 'ajuste_loja' then 'stock.balance'
 when 'transferencia' then 'events.separate'
 when 'devolucao' then 'events.return'
 when 'venda_evento' then 'events.sell'
 when 'baixa_evento' then 'events.close'
 else null end;
 if v_required is null or not app_private.has_permission(v_required) then
    raise exception 'Movimentacao nao autorizada (%)',coalesce(new.action,'?');end if;
 if new.action in ('entrada','venda_loja','saida_loja','saida_pedido','ajuste_loja','transferencia','devolucao')
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
end;$function$
