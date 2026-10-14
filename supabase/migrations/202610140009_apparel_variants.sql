-- AME MAIS | Modelo de roupas com variantes (cor, tamanho, SKU/EAN e saldo independentes).
-- Mantém cada variação como public.products para funcionar com eventos, balanço e histórico existentes.
begin;

create table public.apparel_models (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 2 and 110),
 garment_type text not null check (garment_type in ('Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro')),
 audience text not null check (audience in ('Feminino','Masculino','Unissex')),
 age_group text not null check (age_group in ('Adulto','Infantil','Bebê')),
 category_id uuid not null references public.categories(id) on delete restrict,
 tags text[] not null default '{}',
 image_path text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index apparel_models_created_idx on public.apparel_models(created_at desc);
alter table public.apparel_models enable row level security;
revoke all on public.apparel_models from public,anon,authenticated;
grant select on public.apparel_models to authenticated;
create policy apparel_models_select on public.apparel_models for select to authenticated using(app_private.is_active());
create trigger apparel_models_audit after insert or update or delete on public.apparel_models
 for each row execute function app_private.audit_changes();

alter table public.products
 add column apparel_model_id uuid references public.apparel_models(id) on delete restrict,
 add column apparel_size text,
 add column apparel_color text;
alter table public.products add constraint apparel_variant_fields
 check (
  (apparel_model_id is null and apparel_size is null and apparel_color is null)
  or
  (apparel_model_id is not null and length(btrim(apparel_size)) between 1 and 16
    and length(btrim(apparel_color)) between 2 and 40)
 );
create index products_apparel_model_idx on public.products(apparel_model_id)
 where apparel_model_id is not null;
create unique index apparel_variant_unique on public.products
 (apparel_model_id,lower(apparel_color),upper(apparel_size))
 where apparel_model_id is not null;

create function public.create_apparel(
 p_name text,p_type text,p_audience text,p_age_group text,
 p_category_id uuid,p_tags text[],p_variants jsonb
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_model uuid;
 v_product uuid;
 v_variant jsonb;
 v_color text;
 v_size text;
 v_sku text;
 v_ean text;
 v_qty integer;
 v_item_name text;
begin
 if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
   raise exception 'Sem permissão para cadastrar roupas';
 end if;
 p_name := btrim(coalesce(p_name,''));
 if length(p_name) not between 2 and 110 then raise exception 'Nome deve ter de 2 a 110 caracteres'; end if;
 if p_type not in ('Camiseta','Camisa','Polo','Blusa','Vestido','Casaco','Outro')
   or p_audience not in ('Feminino','Masculino','Unissex')
   or p_age_group not in ('Adulto','Infantil','Bebê') then
   raise exception 'Tipo, público ou faixa etária inválidos';
 end if;
 if p_category_id is null or not exists (
    with recursive parents as (
      select id,parent_id,name from public.categories where id=p_category_id
      union all
      select c.id,c.parent_id,c.name from public.categories c join parents x on c.id=x.parent_id
    )
    select 1 from parents where parent_id is null and lower(name)='roupas'
 ) then
   raise exception 'Escolha uma categoria dentro de Roupas';
 end if;
 if p_variants is null or jsonb_typeof(p_variants)<>'array'
   or jsonb_array_length(p_variants) not between 1 and 40 then
   raise exception 'Informe de 1 a 40 variações';
 end if;
 if coalesce(array_length(p_tags,1),0)>30 then raise exception 'Máximo de 30 tags'; end if;
 p_tags:=coalesce(p_tags,'{}'::text[]);
 insert into public.apparel_models(name,garment_type,audience,age_group,category_id,tags,created_by)
   values(p_name,p_type,p_audience,p_age_group,p_category_id,p_tags,v_actor)
   returning id into v_model;
 for v_variant in select value from jsonb_array_elements(p_variants) loop
   if jsonb_typeof(v_variant)<>'object' then raise exception 'Variação inválida'; end if;
   v_color:=btrim(coalesce(v_variant->>'color',''));
   v_size:=upper(btrim(coalesce(v_variant->>'size','')));
   v_sku:=nullif(btrim(coalesce(v_variant->>'sku','')),'');
   v_ean:=nullif(regexp_replace(coalesce(v_variant->>'ean',''),'[\s-]','','g'),'');
   if length(v_color) not between 2 and 40 or length(v_size) not between 1 and 16 then
      raise exception 'Informe cor e tamanho válidos';
   end if;
   if length(coalesce(v_sku,''))>80 or (v_ean is not null and v_ean !~ '^[0-9]{8,14}$') then
      raise exception 'SKU ou EAN inválido';
   end if;
   if (v_variant->>'quantity') is null or (v_variant->>'quantity') !~ '^[0-9]{1,7}$' then
      raise exception 'Quantidade inicial inválida';
   end if;
   v_qty:=(v_variant->>'quantity')::integer;
   if v_qty>1000000 then raise exception 'Quantidade inicial muito alta'; end if;
   v_item_name:=p_name||' · '||v_color||' / '||v_size;
   insert into public.products(
     name,sku,ean,category_id,tags,apparel_model_id,apparel_size,apparel_color,created_by
   ) values (
     v_item_name,v_sku,v_ean,p_category_id,p_tags,v_model,v_size,v_color,v_actor
   ) returning id into v_product;
   insert into public.stock_balances(product_id,event_id,quantity)
     values(v_product,null,0);
   if v_qty>0 then
     if app_private.role_in('estoquista') then
       perform public.quick_stock_count(v_product,0,v_qty,'Estoque inicial: roupa');
     else
       perform public.move_stock(v_product,'entrada',v_qty);
     end if;
   end if;
 end loop;
 return v_model;
end;
$$;
revoke all on function public.create_apparel(text,text,text,text,uuid,text[],jsonb) from public,anon;
grant execute on function public.create_apparel(text,text,text,text,uuid,text[],jsonb) to authenticated;

create function public.set_apparel_photo(p_model_id uuid,p_path text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.role_in('admin','gerente','estoquista') then
   raise exception 'Sem permissão para alterar foto de roupa';
 end if;
 if not exists(select 1 from public.apparel_models where id=p_model_id
               and (created_by=v_actor or app_private.role_in('admin','gerente'))) then
   raise exception 'Modelo inexistente ou acesso negado';
 end if;
 if p_path is null or p_path !~ ('^apparel/'||p_model_id::text||'/[0-9a-f-]{36}\.(webp|jpg)$') then
   raise exception 'Caminho de imagem inválido';
 end if;
 update public.apparel_models set image_path=p_path where id=p_model_id;
 update public.products set image_path=p_path where apparel_model_id=p_model_id;
 return true;
end;
$$;
revoke all on function public.set_apparel_photo(uuid,text) from public,anon;
grant execute on function public.set_apparel_photo(uuid,text) to authenticated;

commit;