-- Desativa a emissão de novos pedidos para destinatários sem unidade cadastrada.
-- Preserva pedidos e links antigos para auditoria; não altera suas informações.
CREATE OR REPLACE FUNCTION public.create_avulso_order(
 p_name text,p_phone text,p_items jsonb,p_share_token text DEFAULT NULL::text,
 p_event_id uuid DEFAULT NULL::uuid,p_request_id uuid DEFAULT NULL::uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Pedidos para clientes avulsos foram desativados. Escolha uma loja própria, franquia ou loja temporária cadastrada.';
END;$$;
