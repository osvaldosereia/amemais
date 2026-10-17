alter table public.categories add column if not exists variation_options text[] default null;
create or replace function app_private.valid_category_variants(p_options text[])
returns boolean language plpgsql immutable set search_path=''
as $fn$
declare v text; seen text[]:='{}';
begin
 if p_options is null then return true;end if;
 if cardinality(p_options)>32 then return false;end if;
 foreach v in array p_options loop
  if v is null or length(v) not between 1 and 16 or v<>btrim(v)
    or v ~ '[,;\n\r]' or lower(v)=any(seen) then return false;end if;
  seen:=array_append(seen,lower(v));
 end loop;
 return true;
end;$fn$;
alter table public.categories add constraint categories_variation_options_valid
 check(app_private.valid_category_variants(variation_options));
create or replace function app_private.category_variant_options(p_category uuid)
returns text[] language plpgsql stable security definer set search_path=''
as $fn$
declare v_options text[];
begin
 with recursive lineage as (
   select c.id,c.parent_id,c.variation_options,0 as distance
   from public.categories c where c.id=p_category
   union all
   select c.id,c.parent_id,c.variation_options,l.distance+1
   from public.categories c join lineage l on l.parent_id=c.id
   where l.distance<12
 )
 select variation_options into v_options
 from lineage where variation_options is not null order by distance limit 1;
 return coalesce(v_options,'{}'::text[]);
end;$fn$;
revoke all on function app_private.category_variant_options(uuid),
 app_private.valid_category_variants(text[]) from public,anon,authenticated;
-- Seed de taxonomia deve funcionar em branches sem usuários de produção.
DO $seed$
BEGIN
 ALTER TABLE public.categories DISABLE TRIGGER categories_granular_permission;
 BEGIN
  UPDATE public.categories SET variation_options=ARRAY['PP','P','M','G','GG','XGG','XXGG','EXGG']
   WHERE lower(name) IN ('camiseta','camisetas') AND variation_options IS NULL;
  UPDATE public.categories SET variation_options=ARRAY['Tamanho 10','Tamanho 12','Tamanho 14']
   WHERE lower(name)='chapéu' AND variation_options IS NULL;
 EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.categories ENABLE TRIGGER categories_granular_permission;
  RAISE;
 END;
 ALTER TABLE public.categories ENABLE TRIGGER categories_granular_permission;
END;$seed$;
create or replace function public.quick_count_available(
 p_product_id uuid,p_expected_physical integer,p_expected_reserved integer,
 p_counted_available integer,p_note text default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_physical integer;v_reserved integer;v_count integer;v_result uuid;
begin
 if auth.uid() is null or not app_private.has_permission('stock.balance')
  or not app_private.role_in('admin','gerente','estoquista')
 then raise exception 'Sem permissão para conferir estoque';end if;
 if p_expected_physical is null or p_expected_reserved is null or
    p_counted_available is null or p_expected_physical not between 0 and 1000000
    or p_expected_reserved not between 0 and 1000000
    or p_counted_available not between 0 and 1000000
 then raise exception 'Saldo livre inválido';end if;
 if length(coalesce(p_note,''))>250 then raise exception 'Observação muito longa';end if;
 insert into public.stock_balances(product_id,event_id,quantity) values(p_product_id,null,0)
 on conflict(product_id) where event_id is null do nothing;
 select quantity into v_physical from public.stock_balances
 where product_id=p_product_id and event_id is null for update;
 select coalesce(sum(quantity),0) into v_reserved from public.stock_reservations
 where product_id=p_product_id and status='ativa';
 if v_physical is distinct from p_expected_physical or v_reserved<>p_expected_reserved
 then raise exception 'Estoque ou reservas alterados. Atualize o card e confira novamente.';end if;
 v_count:=v_reserved+p_counted_available;
 if v_count>1000000 then raise exception 'Estoque total ultrapassou o limite';end if;
 v_result:=public.quick_stock_count(p_product_id,v_physical,v_count,
 coalesce(nullif(btrim(p_note),''),'Conferência rápida de estoque livre pelo card'));
 return v_result;
end;$fn$;
revoke all on function public.quick_count_available(uuid,integer,integer,integer,text) from public,anon;
grant execute on function public.quick_count_available(uuid,integer,integer,integer,text) to authenticated;