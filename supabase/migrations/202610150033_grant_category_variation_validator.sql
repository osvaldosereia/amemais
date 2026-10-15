-- This IMMUTABLE validator runs inside a CHECK constraint on public.categories.
-- PostgreSQL checks EXECUTE privilege when authenticated users insert/update the row.
-- It is a pure boolean function; no table access or privileges are escalated.
grant execute on function app_private.valid_category_variants(text[]) to authenticated;
revoke execute on function app_private.valid_category_variants(text[]) from anon,public;
