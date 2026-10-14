-- AME MAIS: acesso de cliente por link, catálogo sem estoque e comprovante imutável.
begin;
create table public.customer_catalog_access (
  id uuid primary key default gen_random_uuid(),
  label text not null check(length(btrim(label)) between 2 and 100),
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  revoked_at timestamptz
);
create index customer_catalog_access_expiry_idx on public.customer_catalog_access(expires_at);
alter table public.customer_catalog_access enable row level security;
revoke all on public.customer_catalog_access from public,anon;
grant select on public.customer_catalog_access to authenticated;
create policy customer_access_admin_read on public.customer_catalog_access for select to authenticated
 using(app_private.role_in('admin','gerente'));

alter table public.avulso_orders
  add column customer_access_id uuid references public.customer_catalog_access(id) on delete set null,
  add column receipt_token_hash bytea unique;
alter table public.avulso_orders drop constraint if exists avulso_orders_source_check;
alter table public.avulso_orders add constraint avulso_orders_source_check
  check(source in ('compartilhado','interno','cliente'));

create or replace function public.create_customer_catalog_access(p_label text)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_label text:=btrim(coalesce(p_label,''));
  v_token text;
begin
  if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
  if length(v_label) not between 2 and 100 then raise exception 'Informe identificação do acesso';end if;
  if (select count(*) from public.customer_catalog_access where created_by=auth.uid()
        and created_at>now()-interval '1 hour')>=20 then
    raise exception 'Limite de links criados nesta hora';end if;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.customer_catalog_access(label,token_hash,created_by)
   values(v_label,extensions.digest(v_token,'sha256'),auth.uid());
  return v_token;
end;$$;
revoke all on function public.create_customer_catalog_access(text) from public,anon;
grant execute on function public.create_customer_catalog_access(text) to authenticated;

create or replace function public.revoke_customer_catalog_access(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not app_private.role_in('admin','gerente') then raise exception 'Sem permissão';end if;
  update public.customer_catalog_access set revoked_at=now()
  where id=p_id and revoked_at is null;
  if not found then raise exception 'Acesso não encontrado ou já revogado';end if;
end;$$;
revoke all on function public.revoke_customer_catalog_access(uuid) from public,anon;
grant execute on function public.revoke_customer_catalog_access(uuid) to authenticated;

-- Apenas o backend com service role pode consultar o catálogo público.
create or replace function public.get_customer_catalog_for_server(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_access uuid; v_rows jsonb;
begin
 if p_token !~ '^[0-9a-f]{64}$' then return null;end if;
 select id into v_access from public.customer_catalog_access
  where token_hash=extensions.digest(p_token,'sha256') and revoked_at is null and expires_at>now();
 if v_access is null then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'model_id',p.apparel_model_id,
   'title',coalesce(m.name,p.name),
   'size',p.apparel_size,'color',p.apparel_color,
   'sku',p.sku,'ean',p.ean,'image_path',coalesce(m.image_path,p.image_path)
 ) order by coalesce(m.name,p.name),p.apparel_color,p.apparel_size),'[]'::jsonb)
 into v_rows from (
   select * from public.products where active order by name,id limit 1500
 ) p left join public.apparel_models m on m.id=p.apparel_model_id;
 return jsonb_build_object('products',v_rows);
end;$$;
revoke all on function public.get_customer_catalog_for_server(text) from public,anon,authenticated;
grant execute on function public.get_customer_catalog_for_server(text) to service_role;

create or replace function public.create_customer_catalog_order(
 p_token text,p_name text,p_phone text,p_items jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_access uuid;v_order uuid;
 v_name text:=btrim(coalesce(p_name,''));
 v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 v_item jsonb;v_p public.products%rowtype;v_id uuid;v_qty integer;
 v_seen uuid[]:='{}';v_total integer:=0;
begin
 if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Acesso inválido';end if;
 select id into v_access from public.customer_catalog_access
 where token_hash=extensions.digest(p_token,'sha256')
 and revoked_at is null and expires_at>now();
 if v_access is null then raise exception 'Acesso vencido ou revogado';end if;
 if p_request_id is null then raise exception 'Identificador obrigatório';end if;
 if length(v_name) not between 2 and 120 or length(v_phone) not between 10 and 13
 then raise exception 'Informe nome e telefone com DDD válidos';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
 or jsonb_array_length(p_items) not between 1 and 40 then
 raise exception 'Escolha entre 1 e 40 variações';end if;
 -- Pedido idempotente: o mesmo envio não cria cópias após instabilidade de rede.
 select id into v_order from public.avulso_orders
 where request_id=p_request_id and customer_access_id=v_access;
 if v_order is not null then return v_order; end if;
 if (select count(*) from public.avulso_orders
     where customer_access_id=v_access and created_at>now()-interval '1 hour')>=50
 then raise exception 'Limite temporário de pedidos neste acesso';end if;
 insert into public.avulso_orders(customer_name,customer_phone,source,customer_access_id,request_id)
 values(v_name,v_phone,'cliente',v_access,p_request_id) returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object'
    or coalesce(v_item->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
    or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,3}$'
    then raise exception 'Variação ou quantidade inválida';end if;
  v_id:=(v_item->>'product_id')::uuid;
  v_qty:=(v_item->>'quantity')::integer;
  if v_id=any(v_seen) or v_qty>1000 then raise exception 'Item repetido ou quantidade excessiva';end if;
  v_seen:=array_append(v_seen,v_id);
  select * into v_p from public.products where id=v_id and active;
  if not found then raise exception 'Produto indisponível';end if;
  insert into public.avulso_order_items(order_id,product_id,product_name,color,size,sku,ean,quantity)
   values(v_order,v_p.id,v_p.name,v_p.apparel_color,v_p.apparel_size,v_p.sku,v_p.ean,v_qty);
  v_total:=v_total+v_qty;
  if v_total>2000 then raise exception 'Quantidade total excessiva';end if;
 end loop;
 -- Intencionalmente: nenhum insert/update em stock_movements ou stock_balances.
 return v_order;
end;$$;
revoke all on function public.create_customer_catalog_order(text,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_customer_catalog_order(text,text,text,jsonb,uuid) to service_role;

-- Emite um comprovante que contém somente o snapshot imutável do pedido.
create or replace function public.issue_avulso_receipt_for_server(
 p_order_id uuid,p_request_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_token text;
begin
 if not exists(select 1 from public.avulso_orders
    where id=p_order_id and request_id=p_request_id)
 then raise exception 'Pedido não encontrado';end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 update public.avulso_orders set receipt_token_hash=extensions.digest(v_token,'sha256')
 where id=p_order_id;
 return v_token;
end;$$;
revoke all on function public.issue_avulso_receipt_for_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_avulso_receipt_for_server(uuid,uuid) to service_role;

create or replace function public.get_avulso_receipt_for_server(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.avulso_orders%rowtype;v_items jsonb;
begin
 if p_token !~ '^[0-9a-f]{64}$' then return null;end if;
 select * into v_order from public.avulso_orders
 where receipt_token_hash=extensions.digest(p_token,'sha256');
 if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'name',i.product_name,'size',i.size,'color',i.color,'sku',i.sku,'ean',i.ean,'quantity',i.quantity
 ) order by i.product_name,i.color,i.size),'[]'::jsonb) into v_items
 from public.avulso_order_items i where i.order_id=v_order.id;
 return jsonb_build_object('id',v_order.id,'name',v_order.customer_name,
   'phone',v_order.customer_phone,'created_at',v_order.created_at,
   'items',v_items);
end;$$;
revoke all on function public.get_avulso_receipt_for_server(text) from public,anon,authenticated;
grant execute on function public.get_avulso_receipt_for_server(text) to service_role;
commit;