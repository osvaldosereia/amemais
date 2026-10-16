-- Catálogo central de gôndolas; preserva localizações históricas em products.
CREATE TABLE IF NOT EXISTS public.gondolas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid(),
 CONSTRAINT gondolas_name_valid CHECK (length(btrim(name)) BETWEEN 1 AND 40 AND name=btrim(name))
);
CREATE UNIQUE INDEX IF NOT EXISTS gondolas_name_ci_unique
 ON public.gondolas (lower(name));
CREATE INDEX IF NOT EXISTS gondolas_active_name_idx
 ON public.gondolas (active,name);
ALTER TABLE public.gondolas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gondolas FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.gondolas TO authenticated;
DROP POLICY IF EXISTS "gondolas_read" ON public.gondolas;
CREATE POLICY "gondolas_read" ON public.gondolas FOR SELECT TO authenticated
 USING (app_private.role_in('admin','gerente','estoquista','consulta','evento','franquia'));
DROP POLICY IF EXISTS "gondolas_insert" ON public.gondolas;
CREATE POLICY "gondolas_insert" ON public.gondolas FOR INSERT TO authenticated
 WITH CHECK (app_private.role_in('admin','gerente'));
DROP POLICY IF EXISTS "gondolas_update" ON public.gondolas;
CREATE POLICY "gondolas_update" ON public.gondolas FOR UPDATE TO authenticated
 USING (app_private.role_in('admin','gerente'))
 WITH CHECK (app_private.role_in('admin','gerente'));
-- Cria opções para os nomes já usados (ex.: 01, 3) sem regravar os produtos.
INSERT INTO public.gondolas (name)
SELECT DISTINCT btrim(gondola) FROM public.products
WHERE nullif(btrim(gondola),'') IS NOT NULL
ON CONFLICT (lower(name)) DO NOTHING;
