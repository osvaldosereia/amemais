-- AME MAIS: eventos registram exclusivamente separações e retornos.
-- Ao encerrar, não retornados são baixados de estoque do evento com auditoria,
-- sem associar a venda/doação/perda e sem repor a loja.
begin;

alter table public.stock_movements drop constraint if exists stock_movements_action_check;
alter table public.stock_movements add constraint stock_movements_action_check
  check (action in (
    'entrada','venda_loja','transferencia','venda_evento','devolucao',
    'ajuste_loja','baixa_evento'
  ));
alter table public.stock_movements drop constraint if exists movement_amount;
alter table public.stock_movements add constraint movement_amount check (
  (action='ajuste_loja' and delta_store=quantity and delta_event=0)
  or (action='entrada' and quantity>0 and delta_store=quantity and delta_event=0)
  or (action='venda_loja' and quantity>0 and delta_store=-quantity and delta_event=0)
  or (action='transferencia' and quantity>0 and delta_store=-quantity and delta_event=quantity)
  or (action='venda_evento' and quantity>0 and delta_store=0 and delta_event=-quantity)
  or (action='devolucao' and quantity>0 and delta_store=quantity and delta_event=-quantity)
  or (action='baixa_evento' and quantity>0 and delta_store=0 and delta_event=-quantity)
);

create or replace function public.close_event(p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_status text;
 v_actor uuid:=auth.uid();
 v_balance record;
 v_count integer:=0;
begin
 if v_actor is null or not (app_private.role_in('admin','gerente')
   or app_private.event_role(p_event_id,'responsavel')) then
   raise exception 'Acesso negado';
 end if;
 select status into v_status from public.events where id=p_event_id for update;
 if v_status is distinct from 'ativo' then raise exception 'Evento não está ativo'; end if;

 -- Ainda não retornados não viram estoque da loja.
 -- Cada unidade restante recebe baixa neutra e fica documentada por produto.
 for v_balance in
   select b.product_id,b.quantity from public.stock_balances b
   where b.event_id=p_event_id and b.quantity>0 order by b.product_id for update
 loop
   insert into public.stock_movements(
     product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
   values(v_balance.product_id,p_event_id,'baixa_evento',
     v_balance.quantity,0,-v_balance.quantity,v_actor,
     'Baixa de unidades não retornadas ao encerrar o evento');
   update public.stock_balances
     set quantity=0,updated_at=now()
     where product_id=v_balance.product_id and event_id=p_event_id;
   v_count:=v_count+v_balance.quantity;
 end loop;
 update public.events set status='encerrado',closed_by=v_actor,closed_at=now()
   where id=p_event_id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event_id::text,'close_with_unreturned_stock',v_actor,
  jsonb_build_object('unreturned_quantity',v_count));
end;
$$;
revoke all on function public.close_event(uuid) from public,anon;
grant execute on function public.close_event(uuid) to authenticated;

commit;