-- Cadastra localização independente de cada variação na mesma transação
-- que cria o modelo, sem alterar saldos, reservas nem movimentações.
CREATE OR REPLACE FUNCTION public.create_apparel_with_location(
 p_name text, p_type text, p_audience text, p_age_group text,
 p_category_id uuid, p_tags text[], p_variants jsonb,
 p_gondola text, p_prateleira text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_model uuid;
 v_gondola text := nullif(btrim(coalesce(p_gondola,'')),'');
 v_prateleira text := nullif(btrim(coalesce(p_prateleira,'')),'');
BEGIN
 IF NOT app_private.role_in('admin','gerente','estoquista') THEN
  RAISE EXCEPTION 'Sem permissão';
 END IF;
 IF length(coalesce(v_gondola,''))>40 OR length(coalesce(v_prateleira,''))>40 THEN
  RAISE EXCEPTION 'Gôndola e prateleira devem conter até 40 caracteres';
 END IF;
 IF jsonb_typeof(p_variants)='array' THEN
  IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_variants) AS row(variant)
   WHERE length(btrim(coalesce(row.variant->>'gondola','')))>40
      OR length(btrim(coalesce(row.variant->>'prateleira','')))>40
  ) THEN
   RAISE EXCEPTION 'Gôndola e prateleira da variação devem conter até 40 caracteres';
  END IF;
 END IF;
 -- A validação do cadastro e as entradas iniciais continuam na rotina existente.
 v_model := public.create_apparel(p_name,p_type,p_audience,p_age_group,p_category_id,p_tags,p_variants);
 UPDATE public.products AS p
 SET gondola=coalesce(nullif(btrim(coalesce(row.variant->>'gondola','')),''),v_gondola),
     prateleira=coalesce(nullif(btrim(coalesce(row.variant->>'prateleira','')),''),v_prateleira)
 FROM jsonb_array_elements(p_variants) AS row(variant)
 WHERE p.apparel_model_id = v_model
   AND lower(p.apparel_size)=lower(btrim(coalesce(row.variant->>'size','')))
   AND lower(p.apparel_color)=lower(btrim(coalesce(nullif(row.variant->>'color',''),'Única')));
 RETURN v_model;
END;
$function$;

-- Acrescenta localizações por variação às inclusões posteriores, na mesma transação.
CREATE OR REPLACE FUNCTION public.add_apparel_variants_with_location(
 p_model_id uuid, p_variants jsonb
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 count_created integer;
 entry jsonb;
 label text;
 shade text;
 gondola_text text;
 shelf_text text;
BEGIN
 IF NOT app_private.role_in('admin','gerente','estoquista') THEN
  RAISE EXCEPTION 'Sem permissão para cadastrar variações';
 END IF;
 IF jsonb_typeof(p_variants)<>'array' THEN
  RAISE EXCEPTION 'Informe variações válidas';
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
  IF length(btrim(coalesce(entry->>'gondola','')))>40 OR
     length(btrim(coalesce(entry->>'prateleira','')))>40 THEN
   RAISE EXCEPTION 'Gôndola e prateleira têm limite de 40 caracteres';
  END IF;
 END LOOP;
 count_created := public.add_apparel_variants(p_model_id,p_variants);
 FOR entry IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
  label := btrim(coalesce(entry->>'size',''));
  shade := btrim(coalesce(nullif(entry->>'color',''),'Única'));
  gondola_text := nullif(btrim(coalesce(entry->>'gondola','')),'');
  shelf_text := nullif(btrim(coalesce(entry->>'prateleira','')),'');
  UPDATE public.products AS p
   SET gondola=coalesce(gondola_text,p.gondola),
       prateleira=coalesce(shelf_text,p.prateleira)
   WHERE p.apparel_model_id=p_model_id AND p.active
     AND lower(p.apparel_size)=lower(label)
     AND lower(p.apparel_color)=lower(shade);
 END LOOP;
 RETURN count_created;
END;
$function$;
REVOKE ALL ON FUNCTION public.add_apparel_variants_with_location(uuid,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.add_apparel_variants_with_location(uuid,jsonb) TO authenticated;
