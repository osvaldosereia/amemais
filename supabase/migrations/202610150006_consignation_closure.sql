create table public.consignation_closures(
 event_id uuid primary key references public.events(id),sent_units integer not null,
 sold_units integer not null,returned_units integer not null,loss_units integer not null,
 legacy_unclassified_units integer not null,inventory_adjustment_units integer not null,
 pending_units integer not null,closed_by uuid not null references public.staff_profiles(id),
 closed_at timestamptz not null default now(),
 check(pending_units=0)
);
alter table public.consignation_closures enable row level security;
revoke all on public.consignation_closures from public,anon;
grant select on public.consignation_closures to authenticated;
create policy consignation_closures_read on public.consignation_closures for select to authenticated using(app_private.has_permission('events.manage') or app_private.has_permission('events.close'));
create or replace function public.close_event(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype;v_pending integer;v_sent integer;v_sold integer;v_returned integer;v_loss integer;v_legacy integer;v_adjust integer;
begin
 if not app_private.has_permission('events.close') or not (app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel')) then raise exception 'Sem permissão para encerrar consignação';end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.status<>'ativo' then raise exception 'Loja temporária não está ativa';end if;
 if exists(select 1 from public.inventory_sessions where location_type='temporaria' and location_id=p_event_id and status in ('aberta','revisao')) then raise exception 'Existe inventário pendente nesta loja';end if;
 select coalesce(sum(quantity),0) into v_pending from public.stock_balances where event_id=p_event_id;
 if v_pending<>0 then raise exception 'Consignação não conciliada: % unidades pendentes',v_pending;end if;
 select coalesce(sum(quantity) filter(where action='transferencia'),0),
 coalesce(sum(quantity) filter(where action='venda_evento'),0),
 coalesce(sum(quantity) filter(where action='devolucao'),0),
 coalesce(sum(quantity) filter(where action='baixa_evento' and note ~ '^(PERDA|AVARIA|CONSUMO|OUTRO): '),0),
 coalesce(sum(quantity) filter(where action='baixa_evento' and not(note ~ '^(PERDA|AVARIA|CONSUMO|OUTRO): ')),0)
 into v_sent,v_sold,v_returned,v_loss,v_legacy
 from public.stock_movements where event_id=p_event_id;
 select coalesce(sum((details->>'delta')::integer),0) into v_adjust
 from public.audit_log where entity='inventory_sessions' and action='TEMPORARY_VARIANCE' and
 entity_id in (select id::text from public.inventory_sessions where location_type='temporaria' and location_id=p_event_id);
 if v_sent-v_sold-v_returned-v_loss-v_legacy+v_adjust<>0 then raise exception 'Histórico de consignação não concilia com estoque. Revise movimentações';end if;
 insert into public.consignation_closures(event_id,sent_units,sold_units,returned_units,loss_units,legacy_unclassified_units,inventory_adjustment_units,pending_units,closed_by)
 values(p_event_id,v_sent,v_sold,v_returned,v_loss,v_legacy,v_adjust,0,auth.uid());
 update public.events set status='encerrado',closed_by=auth.uid(),closed_at=now() where id=p_event_id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details) values('events',p_event_id::text,'CLOSED_RECONCILED',auth.uid(),jsonb_build_object('sent',v_sent,'sold',v_sold,'returned',v_returned,'loss',v_loss,'legacy',v_legacy,'inventory_adjustments',v_adjust));
end $$;
revoke all on function public.close_event(uuid) from public,anon;
grant execute on function public.close_event(uuid) to authenticated;