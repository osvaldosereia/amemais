-- AME MAIS | Endereçamento do estoque e cadastro unificado de roupas.
begin;
alter table public.products
  add column gondola text,
  add column prateleira text;
alter table public.products add constraint product_gondola_length check (gondola is null or length(gondola) <= 40);
alter table public.products add constraint product_prateleira_length check (prateleira is null or length(prateleira) <= 40);

-- A operação inteira (modelo + 7 possíveis variações + estoque + localização)
-- ocorre na mesma transação. Caso uma variação falhe, nada é gravado.
create function public.create_apparel_with_location(
 p_name text,p_type text,p_audience text,p_age_group text,
 p_category_id uuid,p_tags text[],p_variants jsonb,
 p_gondola text,p_prateleira text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_model uuid;
 v_gondola text:=nullif(btrim(coalesce(p_gondola,'')),'');
 v_prateleira text:=nullif(btrim(coalesce(p_prateleira,'')),'');
begin
 if not app_private.role_in('admin','gerente','estoquista') then
   raise exception 'Sem permissão';
 end if;
 if length(coalesce(v_gondola,''))>40 or length(coalesce(v_prateleira,''))>40 then
   raise exception 'Gôndola e Prateleira devem conter até 40 caracteres';
 end if;
 v_model:=public.create_apparel(p_name,p_type,p_audience,p_age_group,p_category_id,p_tags,p_variants);
 update public.products set gondola=v_gondola,prateleira=v_prateleira
   where apparel_model_id=v_model;
 return v_model;
end;
$$;
revoke all on function public.create_apparel_with_location(text,text,text,text,uuid,text[],jsonb,text,text) from public,anon;
grant execute on function public.create_apparel_with_location(text,text,text,text,uuid,text[],jsonb,text,text) to authenticated;
commit;