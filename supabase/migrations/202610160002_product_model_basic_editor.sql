-- Edição dos dados gerais do modelo sem modificar saldos nem fotos.
create or replace function public.update_product_model_basic(
 p_model uuid,p_name text,p_tags text[],p_category uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare v_name text:=btrim(coalesce(p_name,'')); v_tag text; v_tags text[]:=array[]::text[];
begin
 if auth.uid() is null or not app_private.has_permission('products.edit') then
   raise exception 'Sem permissão para editar produtos';
 end if;
 if char_length(v_name) not between 1 and 180 then
   raise exception 'Nome do produto inválido';
 end if;
 if p_category is null or not exists(select 1 from public.categories where id=p_category) then
   raise exception 'Categoria inválida';
 end if;
 if coalesce(array_length(p_tags,1),0)>30 then
   raise exception 'Limite de 30 tags por produto';
 end if;
 foreach v_tag in array coalesce(p_tags,array[]::text[]) loop
   v_tag:=btrim(coalesce(v_tag,''));
   if char_length(v_tag)>60 then raise exception 'Tag acima de 60 caracteres';end if;
   if v_tag<>'' and not (v_tag=any(v_tags)) then
     v_tags:=array_append(v_tags,v_tag);
   end if;
 end loop;
 update public.apparel_models
  set name=v_name,tags=v_tags,category_id=p_category
  where id=p_model and force_archived_at is null;
 if not found then raise exception 'Modelo inexistente ou excluído';end if;
 update public.products set category_id=p_category,tags=v_tags
  where apparel_model_id=p_model and force_archived_at is null;
 insert into public.audit_log(entity,entity_id,action,actor_id,details)
 values('apparel_models',p_model::text,'update_model_basic',auth.uid(),
  pg_catalog.jsonb_build_object('name',v_name,'category',p_category,'tags',v_tags));
 return p_model;
end;$function$;
revoke all on function public.update_product_model_basic(uuid,text,text[],uuid) from public,anon;
grant execute on function public.update_product_model_basic(uuid,text,text[],uuid) to authenticated;
