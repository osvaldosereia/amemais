-- Compartilhamento externo de um único produto/modelo.
-- Token aleatório de 256 bits; guarda-se somente o SHA256 do token.
-- Dados consultados ao abrir o link (estoque atualizado, não cópia).
begin;

create table if not exists public.product_shares (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz
);
create index if not exists product_shares_expiry_idx on public.product_shares(expires_at);
create index if not exists product_shares_product_idx on public.product_shares(product_id);
alter table public.product_shares enable row level security;
revoke all on public.product_shares from public,anon,authenticated;

create or replace function public.create_product_share(p_product_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_token text;
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
    raise exception 'Somente a equipe de estoque autorizada pode compartilhar produtos';
  end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.active) then
    raise exception 'Produto não encontrado ou inativo';
  end if;
  if (select count(*) from public.product_shares s
      where s.created_by=v_actor and s.created_at>now()-interval '1 hour') >= 25 then
    raise exception 'Limite de compartilhamentos nesta hora. Aguarde para criar outro link.';
  end if;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.product_shares(product_id,token_hash,created_by)
    values(p_product_id,extensions.digest(v_token,'sha256'),v_actor);
  insert into public.audit_log(entity,entity_id,action,actor_id,details)
    values('products',p_product_id::text,'share_created',v_actor,
      jsonb_build_object('valid_days',7));
  return v_token;
end;
$$;
revoke all on function public.create_product_share(uuid) from public,anon;
grant execute on function public.create_product_share(uuid) to authenticated;

-- Executada somente pela Edge Function autenticada com service role.
-- Nunca conceder este RPC ao usuário anônimo.
create or replace function public.get_shared_product_for_server(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_product public.products%rowtype;
  v_title text;
  v_photo text;
  v_expires timestamptz;
  v_variants jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select p into v_product
    from public.product_shares s
    join public.products p on p.id=s.product_id
    where s.token_hash=extensions.digest(p_token,'sha256')
      and s.expires_at>now() and s.revoked_at is null and p.active
    limit 1;
  select s.expires_at into v_expires
    from public.product_shares s
    where s.token_hash=extensions.digest(p_token,'sha256')
      and s.expires_at>now() and s.revoked_at is null
    limit 1;
  if v_product.id is null then return null; end if;
  if v_product.apparel_model_id is not null then
    select m.name,coalesce(m.image_path,v_product.image_path)
      into v_title,v_photo from public.apparel_models m where m.id=v_product.apparel_model_id;
  else
    v_title:=v_product.name;
    v_photo:=v_product.image_path;
  end if;
  if v_title is null then return null; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',p.name,
      'size',p.apparel_size,
      'color',p.apparel_color,
      'ean',p.ean,
      'sku',p.sku,
      'stock',coalesce(stock.quantity,0)
    ) order by
      case upper(coalesce(p.apparel_size,'')) when 'PP' then 0 when 'P' then 1 when 'M' then 2
        when 'G' then 3 when 'GG' then 4 when 'XGG' then 5 when 'XXGG' then 6
        when 'EXGG' then 7 else 9 end,
      lower(coalesce(p.apparel_color,'')),p.name
  ),'[]'::jsonb)
    into v_variants
    from public.products p
    left join lateral (
      select coalesce(sum(b.quantity),0)::integer as quantity
        from public.stock_balances b
        where b.product_id=p.id and b.event_id is null
    ) stock on true
    where p.active and (
      (v_product.apparel_model_id is null and p.id=v_product.id) or
      (v_product.apparel_model_id is not null and p.apparel_model_id=v_product.apparel_model_id)
    );
  if jsonb_array_length(v_variants)=0 then return null; end if;
  return jsonb_build_object(
    'title',v_title,
    'photo_path',v_photo,
    'variants',v_variants,
    'expires_at',v_expires
  );
end;
$$;
revoke all on function public.get_shared_product_for_server(text) from public,anon,authenticated;
grant execute on function public.get_shared_product_for_server(text) to service_role;
commit;