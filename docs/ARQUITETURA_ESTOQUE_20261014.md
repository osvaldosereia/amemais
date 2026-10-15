# AME MAIS ESTOQUE — Arquitetura operacional (14/10/2026)

## Escopo
O sistema registra **mercadorias sob controle físico da AME MAIS**, suas reservas, movimentações e consignações. Faturamento, nota fiscal, frete e a logística comercial permanecem externos. **Franquias não possuem estoque controlado.**

## Locais e documentos
- **Central (loja principal):** saldos físicos legados em `stock_balances(event_id IS NULL)`. As quantidades existentes e seu histórico permanecem preservados.
- **Lojas permanentes não franqueadas:** saldos em `store_stock`; recebimentos do pedido interno atualizam esse saldo após confirmação.
- **Lojas temporárias/eventos:** saldos consignados em `stock_balances(event_id IS NOT NULL)`, responsáveis por local e devolução de sobras. O tipo evento é uma apresentação de loja temporária, sem recriar documentos antigos.
- **Franquias:** unidades do tipo `franquia`, usadas exclusivamente como destinatárias de solicitações e saídas definitivas. Não escrevemos saldo em `store_stock` para elas.
- **Saídas avulsas:** lançadas pela tela Saída, com destino ativo e baixa definitiva na central.

## Quantidades
- **Físico central:** `stock_balances.quantity` para a central.
- **Reservado / separado:** soma de `stock_reservations.quantity` com `status='ativa'`; a separação continua reservada até a saída.
- **Livre para novas operações:** `max(físico - reservado, 0)`.
- **Loja temporária:** saldo físico separado por `event_id`; não se soma à central.
- **Franquias:** sem saldo; mercadorias saem definitivamente do sistema na confirmação de saída.

### Pedido de franquia
`solicitado` → `aprovado` (reservado, sem baixa) → `separado` (conferência por SKU ou EAN, sem baixa) → `concluido` (saída física e baixa definitiva).
Cancelamento antes da saída libera reserva. Não se marca recebimento de estoque na franquia. Número externo pode ser informado para conciliação com outro sistema.

### Pedido de loja interna
`solicitado` → `aprovado` → `separado` → `despachado` (saída da central) → `recebido` (entrada na loja).
O fluxo atual exige conferência integral por SKU e recebimento integral; atendimento parcial/documentos de divergência devem ser implementados antes de usar esses cenários.

### Loja temporária / consignação
Criação → ativação → envio efetivo da mercadoria → registro de vendas e perdas/avarias **com justificativa** → devolução das sobras → encerramento **apenas após saldo zero**. O sistema não executa mais a antiga baixa automática das sobras no encerramento. As baixas legadas anteriores continuam históricas e são exibidas como **sem classificação** quando não possuem um motivo novo.

## Controles de integridade
- Reserva é transacional e bloqueia a linha do produto; pedidos simultâneos não podem reservar a mesma unidade duas vezes.
- Entradas, saídas, transferências, contagens e ajustes legados não podem baixar o físico da central abaixo da reserva ativa.
- Separação exige conferência exata por SKU; essa etapa nunca baixa o físico.
- Saída física consome a reserva, baixa o saldo e grava movimento e auditoria em uma única transação.
- O fechamento de consignação é rejeitado se restar saldo não conciliado.
- O papel técnico `franquia` só pode ter `products.read` e `orders.franchise` e exige vínculo com uma única franquia ativa. RLS nega ao perfil a leitura de saldos centrais, reservas e estoque das lojas.
- Links públicos de produtos compartilhados exibem **disponibilidade após reservas**, não estoque físico bruto.

## Verificações efetuadas no Supabase
Em transações com `ROLLBACK`, sem deixar alterações de teste:
1. Criação de pedido, aprovação e reserva: estoque físico inalterado.
2. Conferência de separação: estoque físico inalterado.
3. Saída física de franquia: baixa apenas nesse momento, status concluído, reserva consumida.
4. Segunda reserva superior ao livre: operação negada.
5. Ajuste abaixo do reservado: operação negada.
6. Cancelamento: reserva liberada.
7. Encerramento de loja temporária com saldo: operação negada.
8. Baixa de avaria em loja temporária: apenas saldo consignado reduzido.
9. Perfil franquia sob RLS autenticada: 8 produtos visíveis; **0** saldos centrais, **0** reservas, **0** saldos de outras lojas; não pode separar nem baixar estoque.

## Limites conhecidos
- A central e a loja central permanecem um mesmo local de saldo, até que a operação confirme a necessidade de separação física.
- Recebimentos parciais e expedições parciais não estão implementados. O operador deve revisar o pedido antes da aprovação.
- As telas de entrada/saída e balanço atuais operam a central; a loja não franqueada tem recebimento interno, mas os movimentos próprios de saída, balanço e transferência de retorno precisam de fluxo completo adicional.
- A contagem rápida é um ajuste de físico, sem sessão de inventário formal com dupla conferência.
- Indicadores históricos de eventos continuam limitados ao volume de movimentos carregados na UI; consolidação no banco é uma melhoria futura.
- Não foram executados testes de interface em navegador real nesta rodada. Avaliação das regras SQL foi feita por transações revertidas; código JS foi validado sintaticamente.
