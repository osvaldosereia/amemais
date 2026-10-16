-- Novos pedidos devem ter destino em unidade cadastrada.
-- Histórico de clientes e pedidos antigos preservado.
revoke all on function public.create_internal_avulso_order(text,text,jsonb,uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_customer_catalog_access(text) from public,anon,authenticated;
