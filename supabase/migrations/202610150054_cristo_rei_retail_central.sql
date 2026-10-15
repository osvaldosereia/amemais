-- Separação conceitual: o CDSB é o centro de distribuição (kind=central,
-- is_primary=true). A loja física Cristo Rei é unidade própria (kind=filial).
-- Não mover pedidos, produtos, reservas nem saldos: apenas corrigir o tipo.
UPDATE public.stores
SET kind='filial'
WHERE code='CRISTOREICBA'
  AND name='Loja Cristo Rei Cuiabá'
  AND ownership_type='propria'
  AND kind='franquia'
  AND is_primary=false
  AND force_archived_at IS NULL;
