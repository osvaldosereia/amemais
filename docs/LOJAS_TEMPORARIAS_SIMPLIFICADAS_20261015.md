# AME MAIS — Lojas temporárias simplificadas e estoque em análise

## Fluxo para a operação diária

1. Em **Lojas temporárias**, clique em **Nova loja temporária** e informe nome,
   período, responsável e observações. O cadastro começa em preparação.
2. Clique **Preparar mercadorias**, busque produto, modelo, tamanho, SKU ou EAN
   (pode usar câmera), e informe quantidades. **Salvar lista de separação**
   ainda não altera o estoque. A lista pode ser reaberta e editada à vontade.
3. Clique **Imprimir A4**. O relatório de trabalho contém local, responsável,
   data, produtos agrupados, cor/tamanho, SKU, EAN, quantidade solicitada,
   campos vazios para separar/conferir, assinaturas e observações.
   O navegador abre a impressão; também é possível **Salvar como PDF** por
   meio da caixa de impressão do próprio navegador.
4. Se houver divergência física, **edite a lista e reimprima** antes do envio.
5. Após confirmar as quantidades separadas, clique **Confirmar envio**.
   O servidor verifica disponibilidade atual e, numa única transação, ativa
   a loja, registra a transferência da central para a loja e arquiva uma
   remessa auditável. Um envio não pode ser confirmado duas vezes.
6. Após o envio, alterações no que já saiu não sobrescrevem o histórico.
   Use **Enviar complemento** para mercadorias adicionais, com justificativa.
7. Na devolução, clique **Conferir fechamento**. Para cada SKU/tamanho,
   registre **Voltaram boas**, **Vendidas**, **Avariadas** e **Perdidas**.
   É possível salvar rascunho; somente **Salvar e concluir loja** altera saldos.
   O sistema exige que a soma por SKU seja exatamente igual ao saldo físico
   pendente, incluindo quantidades zero, e justificativa para avarias/perdas.
8. A conclusão é transacional: mercadorias boas voltam ao estoque central,
   vendas e perdas saem definitivamente, e avarias vão para **Produtos →
   Avarias em análise**. A loja só encerra com saldo zerado e conciliação
   histórica consistente. Não há manipulação de faturamento ou NF.

## Avarias
- Avarias de lojas temporárias e da central ficam **fora do estoque livre**.
- Enquanto estiverem em análise, não podem ser separadas para novos envios.
- Administradores/gerentes podem resolver qualquer parte da ocorrência:
  **Recuperado** devolve à central com histórico; **Descartado** registra
  destino final sem nova baixa da central (a peça já está suspensa).
- A quantidade total permanece rastreável mesmo após decisões parciais.
- O antigo fluxo de saída por avaria foi redirecionado à quarentena;
  o endpoint antigo impede registrar avaria como baixa comum.

## Inventário formal
Não foi apagado: o menu principal não o exibe. Administradores ainda
podem acessá-lo em **Balanço rápido → Conferência formal**. Dados e
sessões anteriores permanecem.

## Compatibilidade
- Lojas temporárias antigas já ativadas, como o Evento Teste 1, podem usar
  diretamente a nova conferência de fechamento e envios complementares;
  seus movimentos antigos permanecem.
- Registros das remessas novas ficam em tabelas próprias e também em
  `stock_movements`.
- Relatórios de lojas já enviadas recuperam os dados históricos diretamente
  do banco, em vez de depender dos movimentos carregados parcialmente
  para a interface.

## Garantias e testes
- Revisão do plano **sem movimentar o estoque**.
- Bloqueio de envio maior que o físico/disponível.
- Envio inicial idempotente por estado da loja.
- Fechamento bloqueado se houver unidades sem destino.
- Devolução, venda, perda, avaria e encerramento em uma única transação.
- Recuperação e descarte parcial com histórico e chave idempotente.
- Perfis de franquia não recebem controle de estoque central.
- Testes em transações com `ROLLBACK` para preservar dados reais.

A publicação automatizada pelo GitHub não equivale a um teste real de
câmera, impressão A4 ou navegação autenticada. Esses testes operacionais
continuam necessários após o deploy.
