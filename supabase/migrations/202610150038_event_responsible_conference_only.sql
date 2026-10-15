-- Responsável registra apenas conferência, nunca conclui a movimentação; gestor aprova.
CREATE OR REPLACE FUNCTION public.save_event_settlement(p_event uuid, p_items jsonb, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events%rowtype;v jsonb;v_id uuid;v_expected integer;
 v_good integer;v_sold integer;v_damaged integer;v_lost integer;
 v_count integer:=0;v_seen uuid[]:='{}';v_note text:=btrim(coalesce(p_note,''));
begin
 if auth.uid() is null OR not (
 (app_private.has_permission('events.manage') AND app_private.has_permission('events.close'))
 OR (app_private.has_permission('events.request') AND app_private.event_role(p_event,'responsavel'))
 ) then raise exception 'Sem autorização para conferência';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Loja temporária não está ativa';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>150
 then raise exception 'Conferência inválida';end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
  or coalesce(v->>'expected','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'good','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'sold','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'damaged','') !~ '^(0|[1-9][0-9]{0,6})$'
  or coalesce(v->>'lost','') !~ '^(0|[1-9][0-9]{0,6})$'
  then raise exception 'SKU ou quantidades inválidas';end if;
  v_id:=(v->>'product_id')::uuid;
  if v_id=any(v_seen) then raise exception 'SKU repetido';end if;
  v_seen:=array_append(v_seen,v_id);
  v_expected:=(v->>'expected')::integer;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  if v_sold<>0 then raise exception 'CDSB não registra vendas de eventos';end if;
  if v_good+v_sold+v_damaged+v_lost>v_expected then raise exception 'Quantidade maior que o saldo no local';end if;
  if (v_damaged>0 or v_lost>0) and length(v_note) not between 5 and 250
  then raise exception 'Informe justificativa para avarias/perdas';end if;
  if not exists(select 1 from public.stock_balances where product_id=v_id and event_id=p_event and quantity=v_expected and quantity>0)
  then raise exception 'Saldo alterado; atualize conferência';end if;
  v_count:=v_count+1;
 end loop;
 insert into public.event_settlement_drafts(event_id,items,note,saved_by)
 values(p_event,p_items,nullif(v_note,''),auth.uid())
 on conflict(event_id) do update set items=excluded.items,note=excluded.note,
 saved_by=excluded.saved_by,saved_at=now() where public.event_settlement_drafts.status='rascunho';
 if not found then raise exception 'Conferência já concluída';end if;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SETTLEMENT_DRAFT_SAVED',auth.uid(),jsonb_build_object('sku_count',v_count));
 return v_count;
end;$function$
;
