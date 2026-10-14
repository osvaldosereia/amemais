-- Pedidos avulsos: não movem estoque. Associação a evento é opcional e editável.
begin;
create table public.avulso_orders (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null check(length(btrim(customer_name)) between 2 and 120),
 customer_phone text not null check(length(customer_phone) between 8 and 20),
 created_at timestamptz not null default now(),
 source text not null check(source in ('compartilhado','interno')),
 created_by uuid references auth.users(id),
 share_id uuid references public.product_shares(id) on delete set null,
 event_id uuid references public.events(id) on delete set null,
 request_id uuid unique,
 constraint internal_orders_have_author check(source<>'interno' or created_by is not null)
);
create table public.avulso_order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.avulso_orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 product_name text not null,
 color text,
 size text,
 sku text,
 ean text,
 quantity integer not null check(quantity between 1 and 1000)
);
create index avulso_orders_created_at_idx on public.avulso_orders(created_at desc);
create index avulso_orders_event_idx on public.avulso_orders(event_id);
create index avulso_order_items_parent_idx on public.avulso_order_items(order_id);

alter table public.avulso_orders enable row level security;
alter table public.avulso_order_items enable row level security;
revoke all on public.avulso_orders,public.avulso_order_items from anon,public;
grant select on public.avulso_orders,public.avulso_order_items to authenticated;
create policy avulso_orders_read on public.avulso_orders for select to authenticated
 using(app_private.role_in('admin','gerente'));
create policy avulso_order_items_read on public.avulso_order_items for select to authenticated
 using(app_private.role_in('admin','gerente'));
-- Nenhum usuário escreve diretamente nas tabelas: todas as alterações são auditadas por RPC.
revoke insert,update,delete on public.avulso_orders,public.avulso_order_items from authenticated;

create or replace function public.create_avulso_order(
 p_name text,p_phone text,p_items jsonb,p_share_token text default null,
 p_event_id uuid default null,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_name text:=btrim(coalesce(p_name,''));
 v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 v_from_share boolean:=p_share_token is not null;
 v_share public.product_shares%rowtype;
 v_primary public.products%rowtype;
 v_order uuid;
 v_item jsonb;v_product uuid;v_p public.products%rowtype;
 v_qty integer;v_total integer:=0;
 v_seen uuid[]:='{}';
 v_existing uuid;
begin
 if length(v_name) not between 2 and 120 or length(v_phone) not between 10 and 13 then
   raise exception 'Informe nome e telefone com DDD válidos';
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then
   raise exception 'Inclua entre 1 e 40 variações no pedido';
 end if;
 if p_request_id is null then raise exception 'Identificador do pedido obrigatório'; end if;
 select id into v_existing from public.avulso_orders where request_id=p_request_id;
 if v_existing is not null then return v_existing; end if;
 if v_from_share then
   if p_share_token !~ '^[0-9a-f]{64}$' then raise exception 'Link inválido';end if;
   select * into v_share from public.product_shares
    where token_hash=extensions.digest(p_share_token,'sha256')
      and revoked_at is null and expires_at>now();
   if not found then raise exception 'Link expirado';end if;
   select * into v_primary from public.products where id=v_share.product_id and active;
   if not found then raise exception 'Produto indisponível';end if;
   if p_event_id is not null then raise exception 'Um pedido compartilhado não pode escolher evento'; end if;
   if (select count(*) from public.avulso_orders
       where share_id=v_share.id and created_at>now()-interval '1 hour') >= 30 then
       raise exception 'Muitos pedidos neste link. Tente mais tarde.';
   end if;
 else
   if auth.uid() is null or not app_private.role_in('admin','gerente') then
     raise exception 'Permissão insuficiente para criar pedidos internos';
   end if;
 end if;
 if p_event_id is not null and not exists(select 1 from public.events where id=p_event_id) then
   raise exception 'Evento não encontrado';
 end if;
 -- O pedido registra uma intenção; nunca reserva, baixa ou altera stock_balances.
 insert into public.avulso_orders(customer_name,customer_phone,source,created_by,share_id,event_id,request_id)
 values(v_name,v_phone,case when v_from_share then 'compartilhado' else 'interno' end,
        case when v_from_share then null else auth.uid() end,
        case when v_from_share then v_share.id else null end,p_event_id,p_request_id)
 returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item)<>'object'
     or coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
     or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,3}$'
       then raise exception 'Variação ou quantidade inválida'; end if;
   v_product:=(v_item->>'product_id')::uuid;
   v_qty:=(v_item->>'quantity')::integer;
   if v_qty>1000 or v_product=any(v_seen) then raise exception 'Variação repetida ou quantidade excessiva';end if;
   v_seen:=array_append(v_seen,v_product);
   select * into v_p from public.products where id=v_product and active;
   if not found then raise exception 'Produto removido ou indisponível';end if;
   if v_from_share and not (
     (v_primary.apparel_model_id is null and v_p.id=v_primary.id) or
     (v_primary.apparel_model_id is not null and v_p.apparel_model_id=v_primary.apparel_model_id)
   ) then raise exception 'Produto não pertence ao link compartilhado';end if;
   insert into public.avulso_order_items(order_id,product_id,product_name,color,size,sku,ean,quantity)
   values(v_order,v_p.id,v_p.name,v_p.apparel_color,v_p.apparel_size,v_p.sku,v_p.ean,v_qty);
   v_total:=v_total+v_qty;
   if v_total>2000 then raise exception 'Quantidade total do pedido excedida';end if;
 end loop;
 if not v_from_share then
   insert into public.audit_log(entity,entity_id,action,actor_id,details)
    values('avulso_orders',v_order::text,'created',auth.uid(),
      jsonb_build_object('event_id',p_event_id,'items',cardinality(v_seen)));
 end if;
 return v_order;
end;$$;
revoke all on function public.create_avulso_order(text,text,jsonb,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_avulso_order(text,text,jsonb,text,uuid,uuid) to service_role;
-- Para o admin, uma RPC separada impede o uso da identidade de serviço no navegador.
create or replace function public.create_internal_avulso_order(
 p_name text,p_phone text,p_items jsonb,p_event_id uuid default null,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Acesso negado';end if;
 return public.create_avulso_order(p_name,p_phone,p_items,null,p_event_id,p_request_id);
end;$$;
revoke all on function public.create_internal_avulso_order(text,text,jsonb,uuid,uuid) from public,anon;
grant execute on function public.create_internal_avulso_order(text,text,jsonb,uuid,uuid) to authenticated;

create or replace function public.assign_avulso_order_event(p_order_id uuid,p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_old uuid;
begin
 if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Acesso negado';end if;
 if p_event_id is not null and not exists(select 1 from public.events where id=p_event_id) then
    raise exception 'Evento inválido';end if;
 select event_id into v_old from public.avulso_orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado';end if;
 if v_old is not distinct from p_event_id then return; end if;
 update public.avulso_orders set event_id=p_event_id where id=p_order_id;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('avulso_orders',p_order_id::text,'event_association_changed',auth.uid(),
    jsonb_build_object('previous_event',v_old,'event_id',p_event_id));
end;$$;
revoke all on function public.assign_avulso_order_event(uuid,uuid) from public,anon;
grant execute on function public.assign_avulso_order_event(uuid,uuid) to authenticated;
commit;