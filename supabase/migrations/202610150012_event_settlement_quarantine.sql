-- Avarias em análise: fora do estoque livre, com recuperação e descarte auditados.
create table public.stock_damages(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 origin_event_id uuid references public.events(id),
 origin_batch_id uuid unique references public.stock_operation_batches(id),
 quantity integer not null check(quantity between 1 and 1000000),
 recovered integer not null default 0 check(recovered>=0),
 discarded integer not null default 0 check(discarded>=0),
 remaining integer generated always as(quantity-recovered-discarded) stored,
 note text not null check(length(btrim(note)) between 5 and 250),
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now(),
 check(recovered+discarded<=quantity),
 check((origin_event_id is null) <> (origin_batch_id is null))
);
create index stock_damages_pending_idx on public.stock_damages(product_id,created_at desc) where recovered+discarded<quantity;
create table public.stock_damage_actions(
 id uuid primary key default gen_random_uuid(),
 damage_id uuid not null references public.stock_damages(id),
 action text not null check(action in ('recuperado','descartado')),
 quantity integer not null check(quantity between 1 and 1000000),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 actor_id uuid not null references public.staff_profiles(id),
 request_id uuid not null unique,
 created_at timestamptz not null default now()
);
create table public.event_settlement_drafts(
 event_id uuid primary key references public.events(id),
 items jsonb not null check(jsonb_typeof(items)='array'),
 note text,
 status text not null default 'rascunho' check(status in ('rascunho','concluido')),
 saved_by uuid not null references public.staff_profiles(id),
 saved_at timestamptz not null default now(),
 finalized_by uuid references public.staff_profiles(id),
 finalized_at timestamptz
);
do $do$ declare tab text;begin
 foreach tab in array array['stock_damages','stock_damage_actions','event_settlement_drafts'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon',tab);
 execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $do$;
create policy stock_damages_read on public.stock_damages for select to authenticated using(
 app_private.has_permission('stock.balance') or app_private.has_permission('events.manage')
 or (origin_event_id is not null and app_private.event_role(origin_event_id,'responsavel')));
create policy damage_actions_read on public.stock_damage_actions for select to authenticated using(
 exists(select 1 from public.stock_damages d where d.id=damage_id and (
 app_private.has_permission('stock.balance') or app_private.has_permission('events.manage')
 or (d.origin_event_id is not null and app_private.event_role(d.origin_event_id,'responsavel')))));
create policy event_settlement_drafts_read on public.event_settlement_drafts for select to authenticated using(
 app_private.has_permission('events.read') or app_private.has_permission('events.manage')
 or app_private.event_role(event_id,'responsavel','operador'));

create or replace function public.quarantine_central_stock(
 p_product uuid,p_quantity integer,p_expected integer,p_note text,p_request uuid
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_batch uuid;v_result jsonb;v_id uuid;v_note text:=btrim(coalesce(p_note,''));
 v_destination uuid;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 then raise exception 'Sem permissão para registrar avaria';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000
 or p_expected is null or p_expected<0 or p_request is null
 then raise exception 'Quantidade ou saldo inválido';end if;
 if length(v_note) not between 5 and 250 then raise exception 'Descreva a avaria';end if;
 select id into v_destination from public.stock_destinations where system_reason='avaria' and active;
 if v_destination is null then raise exception 'Destino reservado de avaria não encontrado';end if;
 v_result:=public.stock_operation_batch('saida',
 jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',p_quantity,'expected',p_expected)),
 v_destination,'AVARIA EM ANALISE: '||v_note,p_request);
 v_batch:=(v_result->>'batch_id')::uuid;
 insert into public.stock_damages(product_id,origin_batch_id,quantity,note,created_by)
 values(p_product,v_batch,p_quantity,v_note,auth.uid())
 on conflict(origin_batch_id) do nothing;
 select id into v_id from public.stock_damages where origin_batch_id=v_batch;
 if v_id is null then raise exception 'Avaria não registrada';end if;
 return v_id;
end;$fn$;
create or replace function public.resolve_stock_damage(
 p_damage uuid,p_action text,p_quantity integer,p_note text,p_request uuid
) returns integer language plpgsql security definer set search_path=''
as $fn$
declare d public.stock_damages%rowtype;v_note text:=btrim(coalesce(p_note,''));
 v_before integer;old_action public.stock_damage_actions%rowtype;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente')
 then raise exception 'Somente administração pode resolver avarias';end if;
 if p_action not in ('recuperado','descartado') or p_quantity is null or p_quantity not between 1 and 1000000
 or length(v_note) not between 5 and 250 or p_request is null then raise exception 'Informe ação, quantidade e motivo';end if;
 select * into old_action from public.stock_damage_actions where request_id=p_request;
 if found then
  if old_action.damage_id is distinct from p_damage or old_action.action<>p_action or old_action.quantity<>p_quantity
  then raise exception 'Chave de operação reutilizada';end if;
  select remaining into v_before from public.stock_damages where id=p_damage;
  return v_before;
 end if;
 select * into d from public.stock_damages where id=p_damage for update;
 if not found then raise exception 'Avaria inexistente';end if;
 if d.remaining<p_quantity then raise exception 'Quantidade em análise insuficiente';end if;
 if p_action='recuperado' then
  insert into public.stock_balances(product_id,event_id,quantity) values(d.product_id,null,0)
  on conflict(product_id) where event_id is null do nothing;
  select quantity into v_before from public.stock_balances where product_id=d.product_id and event_id is null for update;
  update public.stock_balances set quantity=quantity+p_quantity,updated_at=now()
  where product_id=d.product_id and event_id is null;
  insert into public.stock_movements(product_id,event_id,action,quantity,delta_store,delta_event,actor_id,note)
  values(d.product_id,null,'entrada',p_quantity,p_quantity,0,auth.uid(),
  'AVARIA RECUPERADA '||d.id::text||' · '||v_note);
  update public.stock_damages set recovered=recovered+p_quantity where id=p_damage;
 else
  update public.stock_damages set discarded=discarded+p_quantity where id=p_damage;
 end if;
 insert into public.stock_damage_actions(damage_id,action,quantity,reason,actor_id,request_id)
 values(p_damage,p_action,p_quantity,v_note,auth.uid(),p_request);
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('stock_damages',p_damage::text,upper(p_action),auth.uid(),
 jsonb_build_object('quantity',p_quantity,'note',v_note,'product_id',d.product_id));
 return d.remaining-p_quantity;
end;$fn$;

-- Conferência pode ser salva como rascunho; somente fechamento aplica alterações físicas.
create or replace function public.save_event_settlement(
 p_event uuid,p_items jsonb,p_note text
) returns integer language plpgsql security definer set search_path=''
as $fn$
declare e public.events%rowtype;v jsonb;v_id uuid;v_expected integer;
 v_good integer;v_sold integer;v_damaged integer;v_lost integer;
 v_count integer:=0;v_seen uuid[]:='{}';v_note text:=btrim(coalesce(p_note,''));
begin
 if auth.uid() is null or not app_private.has_permission('events.close') or not
 (app_private.has_permission('events.manage') or app_private.event_role(p_event,'responsavel'))
 then raise exception 'Sem autorização para conferência';end if;
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
end;$fn$;

create or replace function public.finalize_event_settlement(p_event uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare e public.events%rowtype;d public.event_settlement_drafts%rowtype;
 v jsonb;v_id uuid;v_expected integer;v_good integer;v_sold integer;
 v_damaged integer;v_lost integer;v_count integer;v_current integer;
begin
 if auth.uid() is null or not app_private.has_permission('events.close') or not
 (app_private.has_permission('events.manage') or app_private.event_role(p_event,'responsavel'))
 then raise exception 'Sem autorização para fechar';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Loja não está ativa';end if;
 select * into d from public.event_settlement_drafts where event_id=p_event for update;
 if not found or d.status<>'rascunho' then raise exception 'Salve a conferência primeiro';end if;
 select count(*) into v_count from public.stock_balances where event_id=p_event and quantity>0;
 if v_count<>jsonb_array_length(d.items) then raise exception 'A conferência precisa incluir todos os SKUs pendentes';end if;
 -- Valida toda a conferência antes de movimentar a primeira unidade.
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;v_expected:=(v->>'expected')::integer;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  select quantity into v_current from public.stock_balances where event_id=p_event and product_id=v_id;
  if v_current is distinct from v_expected or v_expected<>v_good+v_sold+v_damaged+v_lost
  then raise exception 'Diferença pendente ou saldo alterado no SKU %',v_id;end if;
 end loop;
 for v in select value from jsonb_array_elements(d.items) order by value->>'product_id' loop
  v_id:=(v->>'product_id')::uuid;
  v_good:=(v->>'good')::integer;v_sold:=(v->>'sold')::integer;
  v_damaged:=(v->>'damaged')::integer;v_lost:=(v->>'lost')::integer;
  if v_good>0 then perform public.move_stock(v_id,'devolucao',v_good,p_event,'Fechamento da loja · devolução de produtos bons');end if;
  if v_sold>0 then perform public.move_stock(v_id,'venda_evento',v_sold,p_event,'Fechamento da loja · venda informada');end if;
  if v_lost>0 then perform public.record_event_loss(p_event,v_id,v_lost,'perda',coalesce(d.note,'Perda informada e conferida'));end if;
  if v_damaged>0 then
   perform public.record_event_loss(p_event,v_id,v_damaged,'avaria',coalesce(d.note,'Avaria conferida'));
   insert into public.stock_damages(product_id,origin_event_id,quantity,note,created_by)
   values(v_id,p_event,v_damaged,coalesce(d.note,'Avaria informada'),auth.uid());
  end if;
 end loop;
 perform public.close_event(p_event);
 update public.event_settlement_drafts set status='concluido',finalized_by=auth.uid(),finalized_at=now()
 where event_id=p_event;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SETTLEMENT_FINALIZED',auth.uid(),
 jsonb_build_object('items',d.items,'note',d.note));
end;$fn$;
revoke all on function public.quarantine_central_stock(uuid,integer,integer,text,uuid),
 public.resolve_stock_damage(uuid,text,integer,text,uuid),
 public.save_event_settlement(uuid,jsonb,text),
 public.finalize_event_settlement(uuid) from public,anon;
grant execute on function public.quarantine_central_stock(uuid,integer,integer,text,uuid),
 public.resolve_stock_damage(uuid,text,integer,text,uuid),
 public.save_event_settlement(uuid,jsonb,text),
 public.finalize_event_settlement(uuid) to authenticated;