-- Revisões também devem reservar todos os produtos ou falhar integralmente.
CREATE OR REPLACE FUNCTION public.revise_event_pick_batch(p_batch uuid, p_items jsonb, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.event_pick_batches%rowtype;v_total integer;v_short_sku text;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate') then raise exception 'Sem permissão';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('pendente_estoque','aguardando','em_separacao','separado')
 then raise exception 'Lote já saiu ou está cancelado';end if;
 if not exists(select 1 from public.events where id=b.event_id and status in ('rascunho','ativo'))
 then raise exception 'Local encerrado';end if;
 if length(coalesce(p_note,''))>180 then raise exception 'Observação muito longa';end if;
 update public.event_pick_batches set status='pendente_estoque',revision=revision+1,
  note=nullif(btrim(coalesce(p_note,'')),''),picked_by=null,picked_at=null,updated_at=now()
 where id=p_batch;
 v_total:=app_private.set_event_batch_lines(p_batch,p_items);
 if (select status from public.event_pick_batches where id=p_batch)<>'aguardando' then
  select p.sku into v_short_sku from public.event_pick_batch_items i
  join public.products p on p.id=i.product_id
  left join public.stock_reservations r on r.event_batch_id=p_batch
    and r.product_id=i.product_id and r.status='ativa'
  where i.batch_id=p_batch and coalesce(r.quantity,0)<i.quantity
  order by i.product_id limit 1;
  raise exception 'SKU % sem disponibilidade para a quantidade solicitada. Reduza e tente novamente.',
    coalesce(v_short_sku,'desconhecido');
 end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',b.event_id::text,'EVENT_BATCH_REVISED',auth.uid(),
 jsonb_build_object('batch',p_batch,'previous_revision',b.revision,'new_revision',b.revision+1,'units',v_total));
 return v_total;
end;$function$
;