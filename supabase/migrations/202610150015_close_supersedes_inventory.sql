CREATE OR REPLACE FUNCTION public.close_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v_pending integer;v_sent integer;v_sold integer;v_returned integer;v_loss integer;v_legacy integer;v_adjust integer;
begin
 if not app_private.has_permission('events.close') or not (app_private.has_permission('events.manage') or app_private.event_role(p_event_id,'responsavel')) then raise exception 'Sem permissão para encerrar consignação';end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.status<>'ativo' then raise exception 'Loja temporária não está ativa';end if;
 if exists(select 1 from public.inventory_sessions where location_type='temporaria' and location_id=p_event_id and status in ('aberta','revisao')) then
   -- Uma conferência de encerramento autorizada substitui a contagem antiga, não a executa.
   update public.inventory_sessions set status='cancelada',reviewed_by=auth.uid(),reviewed_at=now(),
    note='Substituída pela prestação de contas da loja temporária'
   where location_type='temporaria' and location_id=p_event_id and status in ('aberta','revisao');
   insert into public.audit_log(entity,entity_id,action,actor_id,details)
   values('events',p_event_id::text,'OLD_INVENTORY_SUPERSEDED',auth.uid(),
   jsonb_build_object('reason','Fechamento com conciliação completa por SKU'));
 end if;
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
end $function$
