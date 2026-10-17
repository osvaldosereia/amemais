# Homologação isolada — expedição e reservas (CDSB)

> Executar **somente** em projeto/branch de banco de testes. Não rodar casos abaixo em produção.
> A suíte `tests/partial-dispatch-guards.test.mjs` valida contratos de código, **não** substitui transações reais.

## Preparação obrigatória
- Confirmar que o banco de testes inclui migrações da produção e `order_operational_progress`, `save_operational_pick`, `save_operational_check`, `send_operational_order`; comparar presença e assinatura da RPC antes de aplicar a correção.
- Aplicar **somente ao banco isolado** `202610170002_fix_partial_dispatch_unique_reservations.sql`.
- Criar usuários **fictícios** de admin, gerente, estoquista, filial e franquia com permissões reais; não usar dados pessoais ou senhas de produção.
- Criar produtos/variações e destinos fictícios; identificar movimentos e pedidos por IDs de teste.
- Capturar antes/depois de cada teste: `stock_balances`, `stock_reservations`, `order_operational_progress`, `stock_movements`, `store_transfer_log` e `audit_log`.
- Confirmar que nenhum teste está conectado ao projeto de produção.

## Casos de aceite

| ID | Cenário | Preparação | Resultado obrigatório |
| --- | --- | --- | --- |
| E01 | Expedição completa (loja) | Central com 30 unidades; pedido/reserva 10; separar e conferir 10 | Central 20; reserva única consumida com 10; 1 movimentação; etapa enviada |
| E02 | Parcial (loja) | Central 30; pedido/reserva 10; separar e conferir 8, justificar falta 2 | Central 22; reserva única consumida com **8**; 2 não enviadas identificadas em pedido/progresso; 1 movimentação |
| E03 | Parcial (avulso) | Central 30; pedido/reserva 10; conferir 8 | Central 22; reserva única consumida com 8; pedido concluído; sem duplicar SKU |
| E04 | Parcial (temporária) | Central 30; pedido/reserva 10; conferir 8 | Central 22; estoque temporário +8; 1 remessa; sem duplicar reserva |
| E05 | SKU zero em pedido misto | Duas variações pedidas; conferir 0 de uma e 4 da outra | Primeira reserva liberada; nenhum movimento dela; segunda consumida com 4 |
| E06 | Pedido inteiramente zero | Conferir 0 para todos os SKUs | RPC rejeita, não despacha, não baixa estoque nem encerra reservas; pedido permanece disponível para revisão/cancelamento |
| E07 | Segunda expedição do mesmo pedido | Repetir E02 após sucesso | Segunda chamada falha por status/etapa; nenhuma nova movimentação ou remessa |
| E08 | Duas chamadas simultâneas | Dois operadores autorizados enviam o **mesmo** pedido ao mesmo tempo | Uma única operação conclui; outra rejeitada; saldo e auditoria sem duplicação |
| E09 | Duas expedições de SKUs concorrentes | Pedidos distintos disputam o mesmo SKU | Bloqueios/validadores impedem saldo negativo e dupla utilização da mesma reserva |
| E10 | Estoque insuficiente durante envio | Saldo reduzido antes de concluir, de forma autorizada e consistente | Falha integral, sem movimentação parcial de SKUs anteriores |
| E11 | Perfil sem acesso | Estoquista sem `orders.dispatch`, franquia tentando agir na central | RPC rejeita acesso, nenhum efeito colateral |
| E12 | Recebimento | Loja própria recebe pedido parcial E02 | Credita **somente 8**, não 10, uma vez; divergências ficam auditáveis |

## Verificações de concorrência
- Usar **sessões PostgreSQL independentes** e controlar o início simultâneo. Teste sequencial não prova concorrência.
- Conferir locks por pedido/SKU, comportamento em espera e eventual timeout/deadlock; se ocorrer deadlock, a transação deve ser revertida integralmente e o operador receber orientação de atualização/repetição segura.
- Validar estado final por contagem de movimentações e totais, não apenas por mensagem da interface.

## Aceite final
- 12/12 cenários executados com evidências dos saldos antes/depois.
- Testes automatizados do GitHub concluídos com sucesso.
- Revisão do SQL por responsável técnico antes de aplicar no ambiente publicado.
- Somente após validação fazer merge/deploy; jamais usar a migração como teste diretamente na produção.
