-- Mirrors the security migration already applied to Supabase production.
-- Anonymous callers must not execute privileged RPCs.
REVOKE EXECUTE ON FUNCTION public.add_apparel_variants_with_location(uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.force_archive_temporary_store(uuid) FROM anon,PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_purchase_order_with_eta(uuid,jsonb,text,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tv_recent_purchase_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_purchase_order_eta(uuid,integer) FROM anon;
