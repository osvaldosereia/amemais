-- Verificação da role efetiva via SET ROLE usada pelo PostgREST, inclusive com sb_secret.
CREATE OR REPLACE FUNCTION app_private.guard_permission_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_required text;v_actor uuid:=auth.uid();
begin
 -- Pedidos enviados por links públicos têm token validado na RPC SECURITY DEFINER.
 -- Tabelas públicas não possuem GRANT de escrita nem política RLS para anon.
 if v_actor is null and tg_table_name='avulso_orders' then
  if tg_op='INSERT' and new.created_by is null and new.source in ('cliente','compartilhado')
  then return new;end if;
  if tg_op='UPDATE' and old.created_by is null and new.created_by is null
    and new.source=old.source and new.customer_name=old.customer_name
    and new.customer_phone=old.customer_phone and new.id=old.id
    and new.event_id is not distinct from old.event_id
    and new.customer_access_id is not distinct from old.customer_access_id
    and new.share_id is not distinct from old.share_id
    and new.fulfillment_status in ('pendente_estoque','reservado','expirado')
    and old.fulfillment_status in ('legado','pendente_estoque','reservado')
    and new.separated_by is not distinct from old.separated_by
    and new.dispatched_by is not distinct from old.dispatched_by
  then return new;end if;
 end if;
 -- Backend com role service_role só pode alterar o caminho da capa do próprio evento.
 -- Qualquer outra mutação mantém a checagem de usuário/permissão existente.
 if tg_table_name='events' and tg_op='UPDATE'
   and (current_setting('request.jwt.claim.role',true)='service_role' or current_setting('role',true)='service_role')
   and (to_jsonb(new)-'cover_path')=(to_jsonb(old)-'cover_path')
   and new.cover_path like ('events/'||old.id::text||'/%.webp')
 then return new;end if;
 if v_actor is null then raise exception 'Autenticação necessária';end if;
 case tg_table_name
 when 'products' then
   if tg_op='INSERT' then v_required:='products.create';
   elsif tg_op='DELETE' then v_required:='products.delete';
   elsif new.active is distinct from old.active then v_required:='products.delete';
   elsif new.historical_category_path is distinct from old.historical_category_path
     and app_private.has_permission('categories.manage') then v_required:='categories.manage';
   else v_required:='products.edit';end if;
 when 'apparel_models' then
   if tg_op='INSERT' then v_required:='products.create';else v_required:='products.edit';end if;
 when 'categories' then v_required:='categories.manage';
 when 'tags' then v_required:='tags.manage';
 when 'events' then
   if tg_op='UPDATE' and new.status='encerrado' and old.status<>'encerrado'
    then v_required:='events.close';
    else v_required:='events.manage';end if;
 when 'event_members' then v_required:='events.manage';
 when 'stock_destinations' then v_required:='stock.destinations';
 when 'customer_catalog_access' then v_required:='catalog.manage';
 when 'product_shares' then v_required:='products.share';
 when 'avulso_orders' then
   if tg_op='INSERT' and new.created_by is null then return new;end if;
   if tg_op='UPDATE' and new.event_id is distinct from old.event_id
     then v_required:='orders.assign';
     else v_required:='orders.internal';end if;
 else raise exception 'Tabela sem política de mutação';
 end case;
 if not app_private.has_permission(v_required) then
    raise exception 'Sem permissão para a operação: %',v_required;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;$function$

