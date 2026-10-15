CREATE OR REPLACE FUNCTION app_private.allocate_pending_on_restock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v record;
begin
 if new.event_id is not null then return new;end if;
 if tg_op='INSERT' then
  if new.quantity<=0 then return new;end if;
 else
  if new.quantity<=old.quantity then return new;end if;
 end if;
 perform app_private.expire_unconfirmed_catalog_orders();
 for v in
  select kind,order_id from (
   select 'loja'::text kind,o.id order_id,o.created_at
    from public.store_orders o join public.store_order_items i on i.order_id=o.id
    where o.status='pendente_estoque' and i.product_id=new.product_id
   union all
   select 'avulso'::text kind,o.id order_id,o.created_at
    from public.avulso_orders o join public.avulso_order_items i on i.order_id=o.id
    where o.fulfillment_status='pendente_estoque' and i.product_id=new.product_id
      and (o.expires_at is null or o.expires_at>now())
   union all
   select 'evento'::text kind,b.id order_id,b.created_at
   from public.event_pick_batches b join public.event_pick_batch_items i on i.batch_id=b.id
   where b.status='pendente_estoque' and i.product_id=new.product_id
  ) pending order by created_at,order_id
 loop
  if v.kind='evento' then perform app_private.allocate_event_batch_stock(v.order_id);
  else perform app_private.reserve_unified_item(v.kind,v.order_id,new.product_id);end if;
 end loop;
 return new;
end;$function$;
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
 if exists(select 1 from public.event_pick_batches
 where event_id=p_event_id and status not in ('enviado','cancelado'))
 then raise exception 'Há lotes aguardando separação ou saída. Envie ou cancele todos antes de encerrar';end if;
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
end $function$;
