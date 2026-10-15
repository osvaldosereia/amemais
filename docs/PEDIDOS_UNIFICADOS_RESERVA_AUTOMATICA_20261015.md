# AME MAIS — Pedidos unificados com reserva automática

## Operação
**Pedidos** é a seção única da central para pedidos avulsos, clientes via catálogo/link,
franquias e filiais. Os tipos continuam nas tabelas originais (avulso_orders e
store_orders), preservando seus IDs, fontes, permissões e histórico. A interface
reúne os registros em uma fila única com busca, filtro, total solicitado,
reservado e faltante em cada SKU, impressão A4, leitura EAN e conclusão.

## Fluxos
1. O pedido novo é gravado e, na mesma transação, reserva todas as unidades
   livres possíveis. O saldo **físico permanece intacto**.
2. Cada SKU guarda quantidade solicitada e reserva parcial. Se houver falta,
   o pedido fica **Com falta**; não é possível separá-lo parcialmente sem
   justificar um ajuste ou aguardar reposição.
3. Entradas físicas na central tentam atender automaticamente os pedidos
   pendentes para cada SKU, em ordem cronológica; não sobrescrevem as
   quantidades originais.
4. **Rever reservas** permite reavaliar pedidos pendentes e ativar pedidos
   antigos (sem reserva retroativa automática).
5. **Ajustar quantidades** permite reduzir ou remover um SKU com motivo e
   registro de antes/depois em unified_order_adjustments. Nunca aumenta a
   quantidade solicitada durante esse ajuste; não altera estoque físico.
6. **Conferir separação** exige todos os SKUs e quantidades reservadas, com
   câmera EAN ou conferência manual. O físico continua na central.
7. **Confirmar saída** consome as reservas, reduz estoque físico e registra
   movimento auditado em uma única transação.
   - Avulso/cliente: pedido concluído na entrega/saída.
   - Franquia: concluído na saída da central; franquia **não tem estoque gerido**.
   - Filial: passa a **despachado**, depois exige conferência de recebimento
     pela filial, preservando o fluxo existente.
8. Cancelamento libera todas as reservas ainda ativas e mantém histórico.

## Cliente via link
O catálogo público usa a Edge Function shared-product com service role,
valida token e aplica limites. Pedidos externos novos reservam estoque por
até **48 horas**, sem exibir disponibilidade ao cliente. A tarefa pg_cron
`ame-expirar-pedidos-externos` verifica a expiração **a cada hora**. Pedidos
expirados mantêm histórico, mas as reservas são liberadas.

## Segurança e consistência
- A tabela stock_reservations é compartilhada: cada reserva aponta para
  **uma única origem** (pedido de loja ou pedido avulso), com chave de
  unicidade por SKU/origem; os gatilhos de proteção física continuam somando
  as reservas ativas das duas fontes.
- Todas as alocações bloqueiam as linhas de saldo para evitar sobrecompromisso
  concorrente. Não se reduz o físico abaixo de reservas.
- RLS e permissões continuam segregadas. Franquias podem solicitar e cancelar
  seus próprios pedidos antes de separar, mas não consultar saldos da central,
  pedidos de clientes ou os pedidos de outras unidades.
- Avarias, eventos temporários, entradas de fornecedor e inventários
  continuam fluxos independentes.
- Não há faturamento, emissão de nota fiscal ou transportadora duplicada.

## Compatibilidade
Os dois pedidos avulsos existentes foram preservados em status **legado**,
sem reservar estoque retroativamente. Um operador autorizado pode reavaliar
suas reservas e prepará-los. Nenhum saldo físico foi alterado na implantação.

## Testes
Testes SQL em transações revertidas confirmaram: criação e reserva, falta,
reserva parcial, reposição automática, separação, baixa física, prevenção de
dupla expedição, cancelamento, ajuste de quantidade e pedido externo via
token, além da liberação de reservas expiradas.
Testes Node verificam renderização, restrição do portal de franquia,
campos de EAN, impressão A4 e resumo de faltas.

Homologação manual de câmera, A4 e telas autenticadas ainda necessária
após a publicação no GitHub Pages.
