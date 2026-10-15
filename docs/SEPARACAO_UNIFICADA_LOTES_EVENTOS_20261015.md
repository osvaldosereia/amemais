# AME MAIS — Central de Separação e lotes de lojas temporárias

## Fluxo diário simplificado
- **Pedidos** concentra a criação/consulta de pedidos de clientes, lojas e franquias.
- **Separação** no menu abre a fila operacional do estoque. Inclui pedidos comuns
  e **lotes individuais** das lojas temporárias. Separadores com `orders.separate`
  ou `events.separate` podem conferir e salvar o progresso, sem atribuir a eles
  autorização automática de expedição física.
- **Preparar pedido** aparece exclusivamente em registros antigos sem reserva,
  permitindo incorporá-los à nova fila sem reserva retroativa automática.
- **Resolver falta** aparece somente se há falta. É permitido aguardar a
  reposição (o banco procura completar automaticamente a reserva) ou reduzir
  quantidades com justificativa preservada no histórico.

## Loja temporária, em lotes sucessivos
1. Crie a loja temporária e indique o responsável.
2. Clique **Criar lote** no detalhe da loja e informe as quantidades por tamanho.
   Um lote admite até **10 modelos**, independentemente do número de tamanhos
   de cada modelo, com no máximo 150 SKUs. Os limites são validados também
   no Supabase, não apenas no navegador.
3. Ao salvar, o lote entra em **Separação** e **Pedidos**, identificado pelo
   nome da loja, sequência (01, 02, 03…) e identificador único.
   O sistema reserva automaticamente o que estiver livre.
4. O separador imprime **Imprimir 80 mm** e mantém a folha com os produtos
   separados. O cupom térmico agrupa por gôndola e inclui foto, modelo, variação, SKU, EAN, prateleira e quantidade. A mesma impressão é usada para pedidos comuns e lotes de eventos.
5. É possível **Salvar progresso** sem contar todos os tamanhos, sair e depois
   usar **Continuar separação**. Uma leitura EAN conta uma unidade do tamanho
   correspondente. Quando todos os SKUs estiverem completos, use
   **Concluir separação**.
6. Após conferir, um administrador/gerente com permissão de evento
   usa **Confirmar saída do lote**. Só nesse momento o estoque físico da
   central é baixado e o estoque da loja temporária é acrescido.
7. Para enviar outros itens mais tarde, basta criar **Lote 02**, **03**…
   Cada lote mantém seu histórico, documento impresso e registro de saída.
8. Até a confirmação da saída, um gerente pode revisar o lote com
   justificativa operacional, o que libera/recalcula reservas e zera
   separações parciais antigas para obrigar nova conferência.
   Envio realizado não pode ser reeditado nem despachado novamente.

## Impresso A4
- Cabeçalho: AME+, origem, **destino em destaque**, número do pedido/lote,
  identificador, data e hora.
- Itens **agrupados por modelo**, uma linha curta por tamanho com gôndola,
  prateleira (se cadastrada), SKU, EAN, quantidade solicitada.
- Campo **Separado** fica deliberadamente **em branco** para preenchimento
  à mão; coluna de conferência também fica em branco.
- O número **zero não é pré-impresso** nesses campos, porque zero poderia
  significar tanto não conferido quanto falta.
- Assinaturas do separador e conferente, campo de observações e indicação
  explícita de manter a folha junto das mercadorias.
- Cabeçalho da tabela repetido em páginas subsequentes.

## Garantias no banco
- `event_pick_batches` / `event_pick_batch_items` guardam lote, sequência,
  progresso, revisão e estado.
- `stock_reservations.event_batch_id` permite conciliar reservas de eventos,
  franquias e clientes no mesmo saldo livre, sem sobrecompromisso.
- Trigger de reposição completa lotes pendentes quando entra novo estoque.
- Enviar consome a reserva **antes** de realizar transferência física via
  `transfer_event_batch`, numa única transação.
- Duplo envio é bloqueado pelo estado do lote.
- Loja não pode encerrar com lotes a separar ou despachar. Lotes enviados
  preservam histórico até após encerramento.
- Todos os testes de criação, separação parcial, dois envios, cancelamento,
  reposição e conclusão de evento são executados com **ROLLBACK**.
- Perfis de franquia não visualizam lotes de eventos nem recebem permissão
  de gerir o estoque central.

## Variações e conferência do estoque
A configuração de variações por categoria/subcategoria e a conferência
rápida do estoque livre já fazem parte da versão principal (PR #13).
Permanecem integradas, sem reintroduzir campo Cor na adição de tamanhos.

## Homologação
Depois do deploy, conferir em celular e desktop: câmera, permissões,
impressora física A4, leitura de código de barras e navegação autenticada.
Esses testes de dispositivos não são substituídos pelos testes de código.
