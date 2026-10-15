# Movimentações pelo card — AME MAIS Estoque

## Nova navegação
As opções **Entrada** e **Saída** deixam o menu principal. A seção **Produtos**
concentra os lançamentos pontuais pelo botão **Movimentar**, disponível no card do
modelo e nas linhas de tamanho/SKU. A home reutiliza os mesmos cards.

O botão **Receber remessa**, na própria seção Produtos e no início, abre o
carrinho de entrada em lote existente, com busca/EAN, seleção de variações,
quantidades e histórico. Há botão explícito para voltar a Produtos.
Nenhuma funcionalidade de controle por franquia, pedidos, inventário ou consignação
foi alterada neste fluxo.

## Entrada
1. Buscar pelo EAN/SKU ou localizar o modelo e tocar em **Movimentar**.
2. Selecionar o tamanho/SKU, operação **Entrada**, quantidade e, se desejar,
   fornecedor, remessa ou referência.
3. Confirmar. A RPC `stock_operation_batch` registra entrada física com saldo
   esperado, auditoria e chave idempotente. Ao cadastrar produto novo, é possível
   informar quantidade inicial com entrada histórica já existente.
4. Para receber vários tamanhos/produtos juntos, usar **Receber remessa**.
   Ao cadastrar novo SKU enquanto monta a remessa, deixar estoque inicial em 0
   e adicionar o item ao carrinho para não duplicar a entrada.

## Saída excepcional
1. Selecionar SKU e **Saída** em **Movimentar**.
2. Informar quantidade, motivo e justificativa (5–250 caracteres).
   Os motivos persistidos são `avaria`, `extravio`, `diretoria`,
   `doacao` e `outro`. Diretoria/doação exigem nome de quem recebeu.
3. Confirmar a **baixa definitiva**. A RPC `record_stock_exception` usa
   `stock_operation_batch` e grava categoria e eventual destinatário em
   `stock_operation_batches`. A justificativa também fica na descrição do
   movimento; os destinos de motivo fixo não podem ser alterados/desativados.
4. O servidor recusa baixas maiores que o **estoque livre** (físico menos
   reservas ativas) e recusa saldo esperado desatualizado. Repetições com a
   mesma chave não baixam novamente o estoque.

**Importante:** avaria que continuará fisicamente sob custódia da empresa,
aguardando análise, não deve ser lançada como baixa definitiva. Use o inventário
ou tratamento operacional adequado, conforme a situação.

## Permissões e isolamento
O frontend exibe os controles apenas a perfis autorizados. A RPC mantém a
restrição administrativa do lote existente; franquias não têm permissão para
baixas do estoque central. Pedidos de franquias continuam encerrando o controle
na saída física, pelo fluxo próprio.

## Homologação
- Testes em transação com `ROLLBACK`: entrada, baixa justificada, replay
  idempotente, falta de destinatário em doação, proteção de reserva ativa,
  acesso negado ao perfil franquia e proteção de destinos fixos.
- Testes sintáticos de arquivos JavaScript e verificações do renderizador
  compartilhado/entrada em lote.
- Ainda é necessário confirmar navegação/câmera e layout em navegador
  autenticado num dispositivo real após publicação pelo GitHub Pages.
