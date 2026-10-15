# AME MAIS ESTOQUE — Cards compactos, balanço livre e variações por categoria

## Onde operar

**Produtos** continua sendo a tela diária. Cada card reúne um modelo e mostra, em dois blocos do mesmo tamanho, **Reservado** e **Livre**. O total **Físico** fica discreto e permanece igual a Reservado + Livre. No celular, os dois blocos ocupam a largura inteira do card; no desktop, ficam ao lado do nome e da foto. Os tamanhos começam recolhidos, com o mesmo padrão em ambos os dispositivos.

Toque em **Ver tamanhos**. Abaixo de cada SKU haverá:

- Tamanho, nome, SKU, EAN, localização e físico (consulta).
- Reservado: somente leitura, gerido por Pedidos.
- Livre: campo numérico editável para perfis com autorização de contagem.
- Ao mudar o valor do Livre, aparece **Salvar** na própria linha. **Gerenciar** continua disponível para Entrada, Saída excepcional, Contagem e Edição cadastral. Produto de tamanho único não repete o botão Gerenciar.

Salvar chama `quick_count_available`, que verifica o estoque físico e as reservas **na mesma transação**, calcula `novo físico = reservado + livre informado`, usa `quick_stock_count` para registrar histórico e preserva as reservas ativas. Se uma entrada ou pedido alterar os dados enquanto o card estiver aberto, a operação é recusada e o usuário precisa atualizar a lista. Se o ajuste adicionar unidades e houver pedidos pendentes, o motor de reservas pode destinar essas unidades a eles automaticamente.

Exemplo: físico 30, reservado 5, livre 25. Conferindo livre 20, o físico passa a 25, o reservado permanece 5, e a diferença de -5 é registrada com operador, horário e motivo "Conferência rápida". Não se edita a quantidade reservada diretamente.

## Configurar variações na categoria

Em **Categorias → Editar** (ou **Nova categoria/subcategoria**) há três modos:

1. **Herdar** da categoria superior (padrão para subcategorias).
2. **Personalizar**, usando vírgulas ou uma linha por opção: `P, M, G, GG, XGG` ou `Tamanho 10, Tamanho 12, Tamanho 14`.
3. **Sem variações**, adequado a produtos simples.

São permitidas até 32 opções, cada uma com 1–16 caracteres; duplicatas (ignorando caixa) e rótulos inválidos são bloqueados no formulário e no banco. A subcategoria pode sobrescrever ou desativar a herança. O card da categoria indica as variações efetivas.

Ao cadastrar produto, **primeiro selecione a categoria**. Se ela definir ou herdar variações, a opção **Cadastrar variações** é habilitada. Selecione os rótulos desejados e informe SKU (opcional), EAN (opcional) e estoque inicial para cada um. Funciona também fora da categoria Roupas: por exemplo, Chapéu. Todos são SKUs independentes.

**Cor não é mais solicitada** na criação de produtos por variação, no acréscimo de novos tamanhos ou na edição de uma variação. Para manter compatibilidade com o banco atual, novos SKUs usam o marcador técnico `Única` sem exibi-lo; as cores dos SKUs antigos são preservadas no histórico, inclusive o nome de variação antiga com Branco/Preto.

Categoria nova sem configuração não expõe variações. Categorias Camiseta/Camisetas receberam inicialmente PP, P, M, G, GG, XGG, XXGG, EXGG, e Chapéu recebeu Tamanho 10, Tamanho 12, Tamanho 14, **todos editáveis**. As configurações alteram as opções para **novos SKUs** e não excluem nem renomeiam as unidades existentes.

## Integração com Pedidos

A unificação anterior da seção **Pedidos** foi entregue na PR #12. Os cards refletem suas reservas e a contagem livre respeita os bloqueios da central. As entradas de fornecedor, a separação, os eventos temporários e os recebimentos de filiais permanecem com suas regras existentes.

## Validação

- SQL em transações revertidas: herança e interrupção da herança, criação e edição de tamanhos personalizados, rejeição de tamanho não permitido, recálculo do físico, preservação das reservas, histórico de contagem, recusa de saldo obsoleto.
- Testes Node do card e dos formulários de categoria.
- Nenhuma movimentação real de estoque foi produzida pelos testes.
- Necessário homologar visualmente após a publicação no GitHub Pages, com acesso autenticado e em tela mobile real.
