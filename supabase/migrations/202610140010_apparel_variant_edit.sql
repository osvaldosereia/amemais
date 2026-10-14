-- Permite corrigir cor, tamanho e identificação sem mexer nos saldos e sem quebrar o histórico.
begin;
create function public.update_apparel_variant(
 p_product_id uuid,p_size text,p_color text,p_sku text,p_ean text,p_active boolean
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_model public.apparel_models%rowtype;
begin
 if not app_private.role_in('admin','gerente','estoquista') then raise exception 'Acesso negado'; end if;
 select m.* into v_model from public.products p
   join public.apparel_models m on m.id=p.apparel_model_id
   where p.id=p_product_id;
 if not found then raise exception 'Variação não encontrada'; end if;
 p_color:=btrim(coalesce(p_color,''));
 p_size:=upper(btrim(coalesce(p_size,'')));
 p_sku:=nullif(btrim(coalesce(p_sku,'')),'');
 p_ean:=nullif(regexp_replace(coalesce(p_ean,''),'[\s-]','','g'),'');
 if length(p_color) not between 2 and 40 or length(p_size) not between 1 and 16 then
   raise exception 'Cor ou tamanho inválidos';
 end if;
 if length(coalesce(p_sku,''))>80 or (p_ean is not null and p_ean !~ '^[0-9]{8,14}$') then
   raise exception 'SKU ou EAN inválido';
 end if;
 update public.products set apparel_color=p_color,apparel_size=p_size,
   name=v_model.name||' · '||p_color||' / '||p_size,
   sku=p_sku,ean=p_ean,active=coalesce(p_active,true)
   where id=p_product_id;
 return true;
end;
$$;
revoke all on function public.update_apparel_variant(uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.update_apparel_variant(uuid,text,text,text,text,boolean) to authenticated;
commit;