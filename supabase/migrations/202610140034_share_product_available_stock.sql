-- O link compartilhado mostra quantidade livre; reservas nao podem ser oferecidas novamente.
CREATE OR REPLACE FUNCTION public.get_shared_product_for_server(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_product public.products%rowtype;
  v_title text;
  v_photo text;
  v_expires timestamptz;
  v_variants jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select p.* into v_product
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
      'product_id',p.id,
      'name',p.name,
      'size',p.apparel_size,
      'color',p.apparel_color,
      'ean',p.ean,
      'sku',p.sku,
      'stock',greatest(0,coalesce(stock.quantity,0)-coalesce((select sum(r.quantity) from public.stock_reservations r where r.product_id=p.id and r.status='ativa'),0))
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
$function$
;
