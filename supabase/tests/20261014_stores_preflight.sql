-- Verificações de pré-publicação: executar com papel administrativo em ambiente de homologação.
-- Nenhuma consulta abaixo modifica dados.
select 'central_unica' as teste, count(*)=1 as passou
from public.stores where is_primary and kind='central';
select 'permissoes_catalogadas' as teste, count(*)>=20 as passou
from public.permission_definitions;
select 'rls_habilitado' as teste, bool_and(relrowsecurity) as passou
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('stores','staff_permissions','staff_stores','store_stock','store_orders','store_order_items','store_transfer_log');
select 'sem_saldos_negativos' as teste, count(*)=0 as passou
from public.store_stock where quantity<0;
select 'sem_permissoes_orfas' as teste, count(*)=0 as passou
from public.staff_permissions sp left join public.permission_definitions pd on pd.permission=sp.permission
where pd.permission is null;
select 'central_legada_preservada' as teste,
  (select coalesce(sum(quantity),0) from public.stock_balances where event_id is null) as unidades_estoque_legado,
  (select coalesce(sum(quantity),0) from public.store_stock ss join public.stores s on s.id=ss.store_id where s.is_primary) as unidades_estoque_novo;
-- Testes funcionais obrigatórios: usuário admin, gerente customizado, estoquista e usuário de filial;
-- criar pedido, separar, receber, tentar receber duas vezes, cancelar, testar saldo insuficiente
-- e confirmar que falhas não geram movimentações parciais.
