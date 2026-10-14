-- Categorias iniciais para roupas. Preserva toda a árvore legada e não cria produtos fictícios.
do $$
declare v_root uuid;v_name text;
begin
 select id into v_root from public.categories
  where parent_id is null and lower(name)='roupas' order by created_at limit 1;
 if v_root is null then raise exception 'Categoria Roupas não encontrada'; end if;
 foreach v_name in array array['Camisetas','Camisas','Polos','Blusas','Vestidos','Casacos','Calças','Outras roupas'] loop
   insert into public.categories(parent_id,name)
   values(v_root,v_name) on conflict do nothing;
 end loop;
end $$;