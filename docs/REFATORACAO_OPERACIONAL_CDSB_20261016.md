# CDSB — Plano de refatoração operacional (16/10/2026)

## Objetivo
Reduzir ambiguidades de interface sem alterar o contrato transacional do estoque. Uma operação deve possuir um fluxo canônico, com atalhos contextuais que apontem para ele, não implementações paralelas.

## Matriz de responsabilidades

| Domínio | Tela canônica | Operações | Atalhos permitidos | Restrições |
| --- | --- | --- | --- | --- |
| Produtos | Produtos | Criar/editar modelo, fotos, variações, SKU/EAN, gôndola, consultar saldos | Início, compras e leitura EAN podem abrir produto | Não executar balanço dentro do card |
| Estoque | Estoque (nova entrada de navegação) | Entrada, saída excepcional, contagem rápida, inventário formal, recebimento | Produto pode pré-selecionar SKU | Preservar RPCs, motivos e auditoria |
| Pedidos | Pedidos | Criar solicitação, reservar, separar, conferir, expedir, receber quando aplicável | Lojas e Início podem abrir pedido filtrado | Uma solicitação é um pedido, sem lotes artificiais |
| Compras | Compras | Reposição, fornecedor, quantidades por SKU, PDF, ETA, acompanhar compra | Produto pode abrir reposição | Recebimento físico exige conferência no fluxo Estoque |
| Lojas | Lojas | Cadastro e gestão de unidades, estoque local, devolução, encerramento temporário | Pedido da unidade abre Pedidos com contexto | Não criar fila paralela de separação |
| Atividades | Atividades | Histórico e auditoria com filtros | Produto, pedido e loja abrem histórico filtrado | Sem mutações de estoque pelo histórico |
| Administração | Administração | Categorias, tags, gôndolas, usuários, permissões | Cadastro pode abrir seletor de categoria/gôndola | A autorização continua no Supabase/RLS |

## Pontos de código e risco

- `src/app.js`: menu `nav`, `pageContent()`, `productsPage()`, `ordersPage()`, `storesPage()`, `movementsPage()`; risco alto de regressão pela centralização de estado e eventos.
- `src/stock-workflows.js`: ações do card `Balanço rápido`, `Movimentar`, `Histórico`, editor e variações; converter em atalhos ao fluxo canônico antes de remover UI.
- `src/stock-inout.js`: entrada/saída e seleção de destino; preservar validação de lote/idempotência.
- `src/unified-orders.js`: separação, conferência, envio, recebimento e impressão; preservar transições de estado.
- `src/cdsb-purchases.js`: revisão por fornecedor, ETA, PDF e conclusão de recebimento; verificar fronteira com estoque.
- `src/store-unit.js` e `src/store-hub.js`: contexto da unidade, pedidos e devoluções.
- `src/dashboard-home.js`: somente atalhos e indicadores, sem duplicar lógica de negócio.
- CSS de cards: existem versões sucessivas (`product-cards-v2/v3/v4`, `product-card-clean-v8`, `product-card-cdsb-square`, etc.); consolidar somente após regressão visual.

## Ordem de implementação

1. Adicionar navegação explícita de Estoque e agrupar cadastros auxiliares, sem remover rotas legadas.
2. Padronizar o card de Produto em resumo compacto (foto, nome, variações, gôndola, físico, reservado, disponível), detalhe de variações sem miniaturas e edição separada.
3. Substituir abas de balanço/movimentação/histórico dentro do card por links para o fluxo canônico com SKU pré-selecionado.
4. Unificar apresentação das ações de pedido conforme status (uma ação principal por etapa).
5. Harmonizar cards de compras, lojas e recebimento sem compartilhar ações inadequadas entre contextos.
6. Consolidar CSS e validar responsividade em 320, 360, 390, 430, 768, 1024 e 1440 px.

## Critérios de aceite obrigatórios

- Estoque físico, reservado e disponível nunca confundidos; saldo por SKU permanece acessível.
- Pedido único por solicitação; sem lotes internos adicionados por interface.
- Nenhuma movimentação ou exclusão sem autorização e registro auditável.
- Nenhuma alteração destrutiva de esquema ou dados sem migração e validação específicas.
- Fluxos testados: cadastro/edição, entrada, contagem, pedido de loja, separação, conferência, envio, recebimento, compra, devolução e encerramento temporário.
- Navegação com teclado, alvos de toque adequados, contraste e layout sem overflow.
- Testes existentes executados antes do merge; mudanças feitas em PR e sem deploy automático até revisão.

## Regra de execução
Cada PR deve conter escopo pequeno, testes e evidência das mudanças. O banco Supabase não será alterado na fase de reorganização visual, salvo quando a auditoria demonstrar necessidade funcional.
