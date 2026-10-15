-- Preparação editável e remessas físicas de lojas temporárias.
create table public.event_pick_plans(
 event_id uuid primary key references public.events(id) on delete cascade,
 status text not null default 'rascunho' check(status in ('rascunho','enviado')),
 revision integer not null default 0 check(revision>=0),
 updated_by uuid not null references public.staff_profiles(id),
 updated_at timestamptz not null default now(),
 dispatched_by uuid references public.staff_profiles(id),
 dispatched_at timestamptz
);
create table public.event_pick_plan_items(
 event_id uuid not null references public.event_pick_plans(event_id) on delete cascade,
 product_id uuid not null references public.products(id),
 quantity integer not null check(quantity between 1 and 1000000),
 primary key(event_id,product_id)
);
create table public.event_shipments(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 shipment_kind text not null check(shipment_kind in ('inicial','complemento')),
 items jsonb not null check(jsonb_typeof(items)='array'),
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now()
);
create index event_shipments_event_idx on public.event_shipments(event_id,created_at);
do $do$ declare tab text;begin
 foreach tab in array array['event_pick_plans','event_pick_plan_items','event_shipments'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon',tab);
  execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $do$;
create policy event_pick_plans_read on public.event_pick_plans for select to authenticated
 using(app_private.has_permission('events.read') or app_private.has_permission('events.manage') or app_private.event_role(event_id,'responsavel','operador'));
create policy event_pick_items_read on public.event_pick_plan_items for select to authenticated
 using(app_private.has_permission('events.read') or app_private.has_permission('events.manage') or app_private.event_role(event_id,'responsavel','operador'));
create policy event_shipments_read on public.event_shipments for select to authenticated
 using(app_private.has_permission('events.read') or app_private.has_permission('events.manage') or app_private.event_role(event_id,'responsavel','operador'));

create or replace function public.create_temporary_store(
 p_name text,p_start date,p_end date,p_notes text,p_responsible uuid
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_event uuid;
begin
 if auth.uid() is null or not app_private.has_permission('events.manage')
 or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
 if length(btrim(coalesce(p_name,''))) not between 3 and 150 or p_start is null
 or (p_end is not null and p_end<p_start) or length(coalesce(p_notes,''))>2000
 then raise exception 'Dados da loja temporária inválidos';end if;
 if p_responsible is null or not exists(select 1 from public.staff_profiles where id=p_responsible and active and role<>'franquia')
 then raise exception 'Selecione um responsável ativo';end if;
 insert into public.events(name,starts_at,ends_at,notes,status,created_by)
 values(btrim(p_name),p_start,p_end,nullif(btrim(coalesce(p_notes,'')),''),'rascunho',auth.uid())
 returning id into v_event;
 insert into public.event_members(event_id,user_id,role) values(v_event,p_responsible,'responsavel');
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',v_event::text,'STORE_CREATED',auth.uid(),jsonb_build_object('responsible',p_responsible));
 return v_event;
end;$fn$;

create or replace function public.save_event_pick_plan(p_event uuid,p_items jsonb)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v_event public.events%rowtype; v_plan public.event_pick_plans%rowtype;
 v jsonb;v_id uuid;v_qty integer;v_seen uuid[]:='{}';v_total integer:=0;
begin
 if auth.uid() is null or not app_private.has_permission('events.separate')
 or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão para separação';end if;
 select * into v_event from public.events where id=p_event for update;
 if not found or v_event.status<>'rascunho' then raise exception 'A separação inicial já foi enviada';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>150
 then raise exception 'Lista de separação inválida';end if;
 select * into v_plan from public.event_pick_plans where event_id=p_event for update;
 if found and v_plan.status<>'rascunho' then raise exception 'Separação enviada não pode ser editada';end if;
 if not found then
  insert into public.event_pick_plans(event_id,updated_by) values(p_event,auth.uid());
 end if;
 delete from public.event_pick_plan_items where event_id=p_event;
 for v in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v)<>'object' or coalesce(v->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
    or coalesce(v->>'quantity','') !~ '^[1-9][0-9]{0,6}$'
  then raise exception 'SKU ou quantidade inválida';end if;
  v_id:=(v->>'product_id')::uuid;v_qty:=(v->>'quantity')::integer;
  if v_qty>1000000 or v_id=any(v_seen) then raise exception 'SKU repetido ou quantidade excessiva';end if;
  if not exists(select 1 from public.products where id=v_id and active)
  then raise exception 'SKU inativo ou inexistente';end if;
  v_seen:=array_append(v_seen,v_id);
  insert into public.event_pick_plan_items(event_id,product_id,quantity) values(p_event,v_id,v_qty);
  v_total:=v_total+v_qty;
 end loop;
 update public.event_pick_plans set revision=revision+1,updated_at=now(),updated_by=auth.uid() where event_id=p_event;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'PICK_PLAN_SAVED',auth.uid(),jsonb_build_object('total',v_total,'skus',cardinality(v_seen)));
 return v_total;
end;$fn$;

create or replace function public.dispatch_event_pick_plan(p_event uuid)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare e public.events%rowtype;pl public.event_pick_plans%rowtype;items jsonb;v_total integer;
begin
 if auth.uid() is null or not app_private.has_permission('events.separate')
 or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'rascunho' then raise exception 'Loja já ativada ou encerrada';end if;
 select * into pl from public.event_pick_plans where event_id=p_event for update;
 if not found or pl.status<>'rascunho' then raise exception 'Separação não disponível';end if;
 select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity) order by product_id)
 into items from public.event_pick_plan_items where event_id=p_event;
 if items is null then raise exception 'Inclua produtos antes do envio';end if;
 perform public.activate_event(p_event);
 v_total:=public.transfer_event_batch(p_event,items,'Envio inicial · lista de separação rev. '||pl.revision);
 update public.event_pick_plans set status='enviado',dispatched_at=now(),dispatched_by=auth.uid() where event_id=p_event;
 insert into public.event_shipments(event_id,shipment_kind,items,created_by)
 values(p_event,'inicial',items,auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'PICK_PLAN_DISPATCHED',auth.uid(),jsonb_build_object('units',v_total,'revision',pl.revision));
 return v_total;
end;$fn$;

create or replace function public.event_send_additional(p_event uuid,p_items jsonb,p_note text)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare e public.events%rowtype;v_total integer;
begin
 if auth.uid() is null or not app_private.has_permission('events.separate')
 or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'ativo' then raise exception 'Somente lojas ativas aceitam complemento';end if;
 if length(btrim(coalesce(p_note,''))) not between 5 and 180 then raise exception 'Justifique o envio adicional';end if;
 v_total:=public.transfer_event_batch(p_event,p_items,'Complemento: '||btrim(p_note));
 insert into public.event_shipments(event_id,shipment_kind,items,created_by)
 values(p_event,'complemento',p_items,auth.uid());
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('events',p_event::text,'SUPPLEMENT_DISPATCHED',auth.uid(),jsonb_build_object('units',v_total,'reason',p_note));
 return v_total;
end;$fn$;

revoke all on function public.create_temporary_store(text,date,date,text,uuid),
 public.save_event_pick_plan(uuid,jsonb),public.dispatch_event_pick_plan(uuid),
 public.event_send_additional(uuid,jsonb,text) from public,anon;
grant execute on function public.create_temporary_store(text,date,date,text,uuid),
 public.save_event_pick_plan(uuid,jsonb),public.dispatch_event_pick_plan(uuid),
 public.event_send_additional(uuid,jsonb,text) to authenticated;