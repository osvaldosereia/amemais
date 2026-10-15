CREATE OR REPLACE FUNCTION public.update_apparel_variant(p_product_id uuid, p_size text, p_color text, p_sku text, p_ean text, p_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_model public.apparel_models%rowtype;v_old_size text;v_old_color text;
begin
 if not app_private.role_in('admin','gerente','estoquista') then raise exception 'Acesso negado'; end if;
 select m.* into v_model from public.products p
   join public.apparel_models m on m.id=p.apparel_model_id
   where p.id=p_product_id;
 if not found then raise exception 'Variação não encontrada'; end if;
 select apparel_size,apparel_color into v_old_size,v_old_color from public.products
 where id=p_product_id for update;
 p_color:=v_old_color; -- Cor histórica permanece inalterada: o campo não é mais editável.
 p_size:=btrim(coalesce(p_size,''));
 if lower(p_size) is distinct from lower(v_old_size)
   and not exists(select 1 from unnest(app_private.category_variant_options(v_model.category_id)) allowed
     where lower(allowed)=lower(p_size))
 then raise exception 'Variação não cadastrada nesta categoria: %',p_size;end if;
 p_sku:=nullif(btrim(coalesce(p_sku,'')),'');
 p_ean:=nullif(regexp_replace(coalesce(p_ean,''),'[\s-]','','g'),'');
 if length(p_color) not between 2 and 40 or length(p_size) not between 1 and 16 then
   raise exception 'Cor ou tamanho inválidos';
 end if;
 if length(coalesce(p_sku,''))>80 or (p_ean is not null and p_ean !~ '^[0-9]{8,14}$') then
   raise exception 'SKU ou EAN inválido';
 end if;
 update public.products set apparel_color=p_color,apparel_size=p_size,
   name=v_model.name||' · '||case when p_color='Única' then p_size else p_color||' / '||p_size end,
   sku=p_sku,ean=p_ean,active=coalesce(p_active,true)
   where id=p_product_id;
 return true;
end;
$function$
;