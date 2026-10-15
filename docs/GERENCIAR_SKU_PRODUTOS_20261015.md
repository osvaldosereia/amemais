# AME MAIS Estoque — Gerenciamento de SKU na seção Produtos

## Tela diária

- **Produtos** é o ponto de entrada para localização e operação por SKU; o
  menu **Balanço rápido** foi ocultado. Inventário formal continua acessível
  apenas para administrador pelo botão da seção Produtos.
- A lista mostra **até cinco modelos** inicialmente, com **Ver mais 5 produtos**
  e **Mostrar menos**. Um modelo conta como um card, independentemente de quantas
  variações possua. A busca e os filtros continuam pesquisando todo o catálogo.
- O card mostra sempre **físico / reservado / livre**, inclusive quando a
  reserva é zero. Os tamanhos começam recolhidos tanto no desktop quanto no
  celular. As variações são renderizadas **uma única vez**, sem botões
  repetidos. Cada tamanho tem apenas **Gerenciar**; SKU avulso possui botão
  Gerenciar próprio.
- Clique em **Gerenciar** para abrir um painel lateral no computador ou um
  painel inferior no celular, preservando a lista atrás dele.
- **Busca pelo EAN**: leitor de câmera abre o modelo filtrado e o SKU
  correspondente; se a pessoa digitar EAN ou SKU exato, pode usar Enter para
  abrir o painel. Código desconhecido mantém o resultado de busca para
  permitir cadastro.
- O painel mostra o SKU, EAN, localização, físico, reservado e livre. Em seção
  recolhida, permite consultar reservas ativas e movimentos recentes daquele
  SKU (histórico completo continua na seção Movimentações).

## Quatro ações, sem editar saldo diretamente

| Ação | Gravação | Proteções |
|---|---|---|
| Entrada | `stock_operation_batch('entrada')` | saldo esperado, quantidade inteira positiva, chave idempotente |
| Saída | `record_stock_exception`; avaria em `quarantine_central_stock` | limite do livre, motivo, justificativa e destinatário em doação/diretoria |
| Conferir | `quick_stock_count` | saldo esperado, contagem de zero válida, proteção de reservas, justificativa quando há diferença |
| Editar | atualização dos campos básicos de `products` sob RLS | validação SKU/EAN, campos cadastrais não alteram quantidade |

**Reservas não são editáveis.** As reservas vêm dos pedidos, e conferir uma
quantidade física menor que o total reservado é bloqueado pelo banco.

Os botões aparecem somente se o perfil possui permissão correspondente;
franquias não operam estoque central. Os fluxos de franquias, filiais,
consignação, remessas e inventário formal não foram modificados.

## Homologação

- Testes de UI Node: geração de card retrátil com uma ação por SKU, saldos
  físico/reservado/livre, permissão, sanitização, validação das quatro ações,
  busca/limite de cinco produtos.
- Transação Supabase revertida: contagem de SKU com reservas, bloqueio abaixo
  do reservado e bloqueio de saldo esperado obsoleto.
- Pendente: teste manual do painel real em navegador autenticado, da câmera
  do dispositivo e dos fluxos com usuário operador.

Nenhuma migração de dados nem modificação de saldos é necessária para esta
mudança. A lógica transacional existente foi reutilizada.
