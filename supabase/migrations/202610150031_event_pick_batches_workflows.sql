
create or replace function public.create_event_pick_batch(p_event uuid,p_items jsonb,p_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare e public.events%rowtype;v_batch uuid;v_seq integer;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate')
 then raise exception 'Sem permissão para montar lote';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local não aceita novos lotes';end if;
 if length(coalesce(p_note,''))>180 then raise exception 'Observação muito longa';end if;
 select coalesce(max(sequence),0)+1 into v_seq from public.event_pick_batches where event_id=p_event;
 insert into public.event_pick_batches(event_id,sequence,created_by,note)
 values(p_event,v_seq,auth.uid(),nullif(btrim(coalesce(p_note,'')),'')) returning id into v_batch;
 perform app_private.set_event_batch_lines(v_batch,p_items);
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'EVENT_BATCH_CREATED',auth.uid(),
 jsonb_build_object('batch',v_batch,'sequence',v_seq));
 return v_batch;
end;$fn$;

create or replace function public.revise_event_pick_batch(p_batch uuid,p_items jsonb,p_note text)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare b public.event_pick_batches%rowtype;v_total integer;
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
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',b.event_id::text,'EVENT_BATCH_REVISED',auth.uid(),
 jsonb_build_object('batch',p_batch,'previous_revision',b.revision,'new_revision',b.revision+1,'units',v_total));
 return v_total;
end;$fn$;

create or replace function public.save_event_batch_picking(p_batch uuid,p_items jsonb)
returns text language plpgsql security definer set search_path=''
as $fn$
declare b public.event_pick_batches%rowtype;v jsonb;v_pid uuid;v_qty integer;
v_total integer;v_complete boolean;v_status text;v_expected integer;v_seen uuid[]:='{}';
begin
 if auth.uid() is null or app_private.role_in('franquia') or not
 (app_private.has_permission('orders.separate') or app_private.has_permission('events.separate'))
 then raise exception 'Sem permissão de separação';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('aguardando','em_separacao','separado')
 then raise exception 'Lote sem reserva completa ou já encerrado';end if;
 select count(*) into v_total from public.event_pick_batch_items where batch_id=p_batch;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<>v_total
 then raise exception 'Conferência precisa incluir todos os SKUs do lote';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','')!~'^[0-9a-fA-F-]{36}$'
  or coalesce(v->>'picked','')!~'^(0|[1-9][0-9]{0,6})$'
  then raise exception 'EAN, SKU ou contagem inválida';end if;
  v_pid:=(v->>'product_id')::uuid;v_qty:=(v->>'picked')::integer;
  if v_pid=any(v_seen) or v_qty>1000000 then raise exception 'SKU repetido ou quantidade excessiva';end if;
  v_seen:=array_append(v_seen,v_pid);
  select quantity into v_expected from public.event_pick_batch_items where batch_id=p_batch and product_id=v_pid;
  if v_expected is null or v_qty>v_expected then raise exception 'Contagem excedida ou SKU não pertence ao lote';end if;
  if not exists(select 1 from public.stock_reservations where event_batch_id=p_batch
     and product_id=v_pid and status='ativa' and quantity=v_expected)
  then raise exception 'Reserva não cobre todo o item %',v_pid;end if;
  update public.event_pick_batch_items set picked=v_qty where batch_id=p_batch and product_id=v_pid;
 end loop;
 select not exists(select 1 from public.event_pick_batch_items where batch_id=p_batch and picked<>quantity)
 into v_complete;
 v_status:=case when v_complete then 'separado' else 'em_separacao' end;
 update public.event_pick_batches set status=v_status,picked_by=auth.uid(),
   picked_at=case when v_complete then now() else null end,updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',b.event_id::text,'EVENT_BATCH_PICK_SAVED',auth.uid(),
 jsonb_build_object('batch',p_batch,'complete',v_complete));
 return v_status;
end;$fn$;

create or replace function public.dispatch_event_pick_batch(p_batch uuid)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare b public.event_pick_batches%rowtype;e public.events%rowtype;
line record;items jsonb;v_total integer;v_physical integer;v_reserved integer;
kind text;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate')
 then raise exception 'Sem permissão para confirmar saída física';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status<>'separado' then raise exception 'Lote ainda não conferido ou já enviado';end if;
 select * into e from public.events where id=b.event_id for update;
 if not found or e.status not in ('rascunho','ativo') then raise exception 'Local encerrado';end if;
 for line in select product_id,quantity,picked from public.event_pick_batch_items
  where batch_id=p_batch order by product_id loop
  if line.picked<>line.quantity then raise exception 'Lote com conferência incompleta';end if;
  select quantity into v_physical from public.stock_balances
   where product_id=line.product_id and event_id is null for update;
  select quantity into v_reserved from public.stock_reservations
   where product_id=line.product_id and event_batch_id=p_batch and status='ativa' for update;
  if v_reserved is distinct from line.quantity or v_physical<line.quantity
  then raise exception 'Reserva ou estoque inconsistente no SKU %',line.product_id;end if;
 end loop;
 select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity)
  order by product_id) into items from public.event_pick_batch_items where batch_id=p_batch;
 kind:=case when e.status='rascunho' then 'inicial' else 'complemento' end;
 -- Consome a reserva ANTES da transferência para evitar contar a mesma unidade duas vezes.
 update public.stock_reservations set status='consumida',ended_at=now(),ended_by=auth.uid()
 where event_batch_id=p_batch and status='ativa';
 if e.status='rascunho' then perform public.activate_event(e.id);end if;
 v_total:=public.transfer_event_batch(e.id,items,'Lote '||b.sequence||' / '||b.id::text);
 insert into public.event_shipments(event_id,shipment_kind,items,created_by)
 values(e.id,kind,items,auth.uid());
 update public.event_pick_batches set status='enviado',dispatched_by=auth.uid(),
 dispatched_at=now(),updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',e.id::text,'EVENT_BATCH_DISPATCHED',auth.uid(),
 jsonb_build_object('batch',p_batch,'sequence',b.sequence,'units',v_total,'shipment_kind',kind));
 return v_total;
end;$fn$;

create or replace function public.cancel_event_pick_batch(p_batch uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $fn$
declare b public.event_pick_batches%rowtype;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 or not app_private.has_permission('events.separate') then raise exception 'Sem permissão';end if;
 select * into b from public.event_pick_batches where id=p_batch for update;
 if not found or b.status not in ('pendente_estoque','aguardando','em_separacao','separado')
 then raise exception 'Lote já enviado ou cancelado';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 250 then raise exception 'Justifique o cancelamento';end if;
 update public.stock_reservations set status='liberada',ended_at=now(),ended_by=auth.uid()
 where event_batch_id=p_batch and status='ativa';
 update public.event_pick_batches set status='cancelado',updated_at=now() where id=p_batch;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',b.event_id::text,'EVENT_BATCH_CANCELED',auth.uid(),
 jsonb_build_object('batch',p_batch,'reason',p_reason));
end;$fn$;

revoke all on function public.create_event_pick_batch(uuid,jsonb,text),
 public.revise_event_pick_batch(uuid,jsonb,text),
 public.save_event_batch_picking(uuid,jsonb),
 public.dispatch_event_pick_batch(uuid),
 public.cancel_event_pick_batch(uuid,text) from public,anon;
grant execute on function public.create_event_pick_batch(uuid,jsonb,text),
 public.revise_event_pick_batch(uuid,jsonb,text),
 public.save_event_batch_picking(uuid,jsonb),
 public.dispatch_event_pick_batch(uuid),
 public.cancel_event_pick_batch(uuid,text) to authenticated;
