# CDSB — Redesenho do módulo Lojas

**Especificação de design — versão 1.0 (para revisão)**
**Data:** 2026-10-16
**Repositório:** osvaldosereia/amemais
**Status:** proposta funcional aprovada em conversa; documento técnico pendente de revisão do responsável. **Não autoriza implementação nem publicação.**

## 1. Objetivo e decisões aprovadas

Redesenhar a experiência de **Lojas** para desktop e mobile sem transformar a tela em uma segunda fila de pedidos. A experiência deve diferenciar claramente:
1. **Lojas:** cadastro, identificação, acompanhamento e administração da unidade;
2. **Pedidos:** única fila de preparação, separação, conferência e expedição, preservando um pedido como unidade indivisível de operação;
3. **Loja temporária:** controle logístico do evento com saldo transferido, devoluções e conciliação de diferenças, **sem registro de vendas no CDSB**.

Princípios obrigatórios:
- O **CDSB é um centro de distribuição**, não uma loja comercial.
- Loja própria tem estoque físico controlado; franquias **não** têm controle de estoque interno neste sistema.
- Uma loja temporária pode solicitar mercadorias diversas vezes, criando **pedidos independentes**, nunca lotes ou subdivisões em pedidos.
- O estado da **unidade** e o estado de **cada pedido** são independentes.
- Não criar dados de vendas, faturamento, comissão, PDV ou “vendas presumidas”.
- Preservar histórico, auditoria, regras de autorização, saldo, reservas e expedição.
- Respeitar a identidade CDSB atual: branco, azul-marinho, dourado em detalhes e cores funcionais para estado, sucesso e alerta.

### 1.1 Fora do escopo

- Construir registro de venda, financeiro, PDV e integração com plataformas de venda.
- Redesenhar a fila operacional central inteira, alterar sua regra de reservas ou reimplementar procedimentos de conferência e expedição.
- Implementar QZ Tray ou imprimir sem diálogo; a adaptação de bobinas para 57 mm constitui frente própria. **Nunca rotular um botão como “57 mm” enquanto essa impressão não estiver funcionando.**
- Excluir ou reestruturar tabelas históricas por razões meramente visuais.
- Renomear tabelas internas cuja nomenclatura legada ainda seja utilizada pelos mecanismos em operação.

## 2. Evidências do estado atual

Inspeção feita nos módulos existentes:
- src/store-hub.js / store-hub.css: lista unidades e cria cards extensos com botões para Pedidos, pedidos ativos embutidos e histórico por card;
- src/app.js: eventos de clique, autorizações, páginas de cadastro e de estoque de filiais, navegação dos pedidos, dados do evento;
- src/event-simple.js / temporary-stores-simple.css: tela temporária e componente legado de lista de separação que consulta event_pick_plans e event_pick_plan_items;
- src/event-lots.js: lista de pedidos independentes da temporária, usando event_pick_batches e event_pick_batch_items;
- src/unified-orders.js: fila operacional consolidada e etapas de separação/conferência/expedição;
- tabelas public.stores, public.events, public.store_orders, public.event_pick_batches, public.store_stock, public.stock_balances, public.store_order_receipts e tabelas de auditoria.

Problemas confirmados:
- Diversos botões da lista Lojas navegam para Pedidos com filtros levemente diferentes, oferecendo baixo valor informativo ao entrar na unidade.
- “Ver detalhes” navega ao pedido, mas abre um detalhe interno sem garantir a abertura do contêiner pai.
- eventCompactDetail ainda renderiza uma “Lista de separação” da estrutura legada, ao lado de uma lista atual de pedidos independentes, podendo mostrar quantidade zero incorreta.
- O texto “unidades conferidas” na listagem independente deriva da quantidade separada (picked), que não comprova conferência final.
- A imagem de capa grande ocupa o primeiro viewport de uma loja temporária; operações importantes aparecem muito abaixo.
- Funções de estoque e devolução de filiais estão em “Administrar cadastros”, distantes da loja correspondente.
- CSS da área conserva verde antigo em elementos que já deveriam seguir a identidade CDSB.
- As capturas avaliadas exibem diferentes larguras de desktop. Validar em viewport móvel real é parte dos testes, não pressuposição já verificada.

**Fonte da verdade:** a estrutura operacional real permanece no Supabase; novos indicadores são derivados dos registros existentes e não criam cópias de pedidos/saldos.

## 3. Arquitetura da informação

### 3.1 Navegação principal

Menu principal mantém **Lojas** e **Pedidos** como destinos distintos. Lojas apresenta:
- Busca por nome, código e identificação acessível;
- Segmentação Todas / Próprias / Franquias / Temporárias;
- Filtros: situação ativa/inativa ou preparação/operação/encerrada (conforme tipo), com ordenação consistente;
- Criação de unidade com escolha explícita do tipo, quando autorizado;
- Cards de unidade com entrada **Abrir unidade**, ação principal única, e menu administrativo secundário.

Pedidos apresenta:
- Fila operacional global já existente;
- Filtro de destino ao acessar o pedido a partir de uma unidade;
- Abertura específica do pedido, com destaque visual e expansão coerente;
- Link **Voltar à unidade** que retorna ao contexto correto sem perder aba ou filtros quando viável.

Não deverá existir “fila de separação” independente dentro de Lojas.

### 3.2 Tipos e responsabilidades

| Tipo de unidade | Origem dos dados | Abas internas | Estoque |
| --- | --- | --- | --- |
| Loja própria | stores, kind=filial e ownership_type=propria | Visão geral, Pedidos, Estoque, Movimentações, Configurações | store_stock/controles já existentes |
| Franquia | stores, kind=franquia | Visão geral, Pedidos, Recebimentos, Cadastro | Sem saldo físico interno calculado pelo CDSB |
| Temporária | events + membros/transferências/pedidos | Visão geral, Pedidos, Mercadorias, Fechamento, Equipe, Histórico | stock_balances da unidade temporária; conciliação |
| CD / CDSB | stores.is_primary/kind=central | Não aparece como loja comercial | Administração central já existente |

A loja Cristo Rei possui código especial CRISTOREICBA no sistema atual; identificá-la por registro e regra comercial existente, mas **não** confundir stores.is_primary (CDSB) com a loja própria Cristo Rei. No futuro, não depender exclusivamente do código especial para a identificação de toda loja própria.

## 4. Lista de unidades: UI/UX

### 4.1 Cabeçalho e filtros

Título “Lojas”; descrição breve “Unidades próprias, franquias e temporárias”; busca; contagens agrupadas; filtros por tipo/situação e ordenação; controle “Nova unidade” mostra opções permitidas. Nunca apresentar ação cujo perfil não possui permissão.

### 4.2 Card compacto

Card padrão:
- **Identidade**: nome da unidade, marcador de tipo e status da própria unidade, identificação secundária concisa;
- **Indicadores (máximo três)**: diferenças por tipo;
- **Ação**: “Abrir unidade” é única ação principal;
- **Administração**: menu de três pontos com editar, ativar/desativar ou exclusão autorizada (ações perigosas distantes do CTA);
- **Capa**: miniatura opcional em temporárias, sem banner que ocupe a altura da tela; sem imagem placeholder expansiva.

Indicadores:
- Própria: pedidos ativos vinculados, saldo físico controlado da unidade, recebimentos pendentes;
- Franquia: solicitações abertas, aguardando envio, aguardando recebimento; nunca mostrar saldo físico “0” como se fosse conhecido;
- Temporária: pedidos ainda ativos vinculados, unidades fisicamente no local e pendências de conciliação/fechamento.

Quando o valor não puder ser calculado confiavelmente por permissões ou falta de dados, mostrar “Indisponível”/suprimir o indicador, não zero inventado. Status do pedido e status da unidade não podem compartilhar uma única classificação.

### 4.3 Estados vazios e volume

- Sem unidades: texto orientativo e CTA contextual para criar, se autorizado.
- Unidade sem pedidos: pequeno estado vazio; não exibir containers grandes de histórico e fila vazia.
- Unidade sem estoque controlado (franquia): explicar que saldo físico não é gerenciado.
- Listagem volumosa: filtro e busca instantâneos, paginação ou carregamento progressivo quando necessário; preservação de filtros ao voltar.
- Indicadores baseados na última carga sincronizada; sinalizar indisponibilidade caso atualização falhe.

## 5. Página interna da unidade

### 5.1 Estrutura compartilhada

- Breadcrumb Lojas / Tipo / Unidade + retorno consistente;
- Cabeçalho compacto: nome, tipo, situação, datas e responsável quando pertinentes, configurações autorizadas;
- Área “Atenção necessária”: prioridade real baseada em pedidos e pendências, sem texto genérico que sugira erro inexistente;
- Indicadores úteis e abas contextualizadas;
- Conteúdo principal focado na aba selecionada. Nunca mostrar todo o histórico operacional numa página vertical única;
- CTA por página vinculado à etapa real (criar pedido, receber, conferir devolução), somente com autorização e pré-condições satisfeitas.

### 5.2 Loja própria

**Visão geral**: saldo físico agregado, pedidos em andamento, entregas a receber, últimas movimentações. **Pedidos**: pedidos relacionados à unidade; opção de criar quando autorizado, detalhes, situação e retorno. **Estoque**: visualização por produto/variação e saldo, aproveitando cálculos existentes. **Movimentações**: saída/contagem e devolução à central conforme regras atuais, inclusive estoque em trânsito e confirmação física de recebimento. **Configurações**: cadastro, gerente, contatos, ativação, dados administrativos.

Não permitir ação com saldo da central ao executar contagem da filial. Expor as ferramentas que hoje estão em “Administrar cadastros” na unidade certa, preservando o motor de movimentação.

### 5.3 Franquia

**Visão geral**: situação das solicitações, andamento da preparação e recebimentos; **Pedidos**: solicitar mercadorias e acompanhar; **Recebimentos**: registrar e consultar quando permitido; **Cadastro**: dados autorizados.
Não controlar saldo interno, inventariar mercadorias ou exibir “estoque 0”. A franquia autenticada vê apenas os seus registros e unidades vinculadas.

### 5.4 Loja temporária

**Visão geral**: situação da unidade, período, responsável, resumo de pedidos, estoque físico enviado e não conciliado, pendências de devolução; **Pedidos**: cada solicitação real da unidade, com código, status correto, unidades solicitadas/separadas/conferidas e acesso ao registro; **Mercadorias**: saldos atuais por SKU/variação, enviados e devolvidos a partir da movimentação registrada; **Fechamento**: conferência física por SKU e justificativas; **Equipe**: responsáveis e operadores vinculados; **Histórico**: envios, devoluções, baixas e auditoria.

Substituir visualização baseada na “Lista de separação” legada por pedidos independentes. Não apagar planilhas ou documentos históricos associados a eventos anteriores: apenas retirar sua condição de fluxo atual onde já substituídos. Capa: pequena no cabeçalho e opção de trocar/excluir somente nas configurações.

## 6. Fluxos de operação da temporária

### 6.1 Unidade e pedidos independentes

Ciclo da unidade: **Preparação → Em operação → Em conciliação → Encerrada**.
Observação: estados de apresentação derivados de events.status e da situação da conciliação; o banco hoje usa rascunho, ativo, encerrado. **Não adicionar uma nova enumeração ao banco sem justificativa de regra validada.**

Ciclo do pedido: criação → reserva/pendência de estoque → separação → conferência → expedição → histórico/cancelamento. Os estágios continuam definidos pela fonte de pedidos unificada.

Uma unidade em preparação pode ter um pedido já separado e aguardando conferência, sem que isso mude a unidade automaticamente para “Em operação”.

A unidade pode criar novos pedidos posteriormente enquanto ativa, respeitando autorização e regras de saldo. Nenhum pedido gera subdivisões ou “lotes” visíveis. Cada novo pedido é independente e possui seus registros próprios.

### 6.2 Transferência física

Somente a expedição concluída e autorizada transfere quantidades para o local e consome a reserva na central, de acordo com os procedimentos atuais. Criar, editar, reservar ou separar pedidos **não altera** o saldo físico transferido.

Quantidade exibida no resumo deve usar movimentações/saldos confirmados, nunca somar pedidos ainda não expedidos.

### 6.3 Fechamento sem registro de vendas

Ao retornar mercadorias, para cada SKU/variação, classificar a quantidade física ainda pendente de conciliação em:
- **Devolvidas boas:** seguem a operação física de retorno para a central conforme validação existente; só se tornam disponíveis quando entrada/registro correspondente for confirmado;
- **Avariadas:** registradas no fluxo de avarias, sem ficarem disponíveis automaticamente como estoque bom;
- **Não devolvidas:** baixa ou pendência logística justificada conforme regra operacional atualmente autorizada; **não** são vendas e não geram valor financeiro.

Validação invariável por SKU: **quantidade ainda a conciliar = devolvidas boas + avariadas + não devolvidas**. A quantidade ainda a conciliar deriva do saldo físico remanescente e movimentos já efetivados, para evitar contagem duplicada.

O responsável informa justificativa obrigatória para avarias, diferenças não devolvidas e ajustes relevantes, associada ao usuário, horário, evento e SKU. Se houver diferença não resolvida ou entrada/baixa não confirmada, impedir encerramento e mostrar explicação acionável.

Após conciliação e ausência de saldo físico pendente, possibilitar encerramento autorizado, mantendo pedidos, movimentos e auditoria. Reabrir, corrigir ou excluir não deverá reverter movimentos silenciosamente.

### 6.4 Separado não é conferido

Números no pedido:
- **Solicitado:** quantidade pedida;
- **Separado:** quantidade efetivamente separada e registrada;
- **Conferido:** quantidade aprovada por conferência final;
- **Enviado:** quantidade efetivamente expedida.
Nunca rotular dados de picked como “conferidos”. Se não houver conferência final, mostrar “A conferir” ou “Conferência pendente”, nunca presumir por equivalência com separado.

## 7. Navegação dos botões (contrato funcional)

| Ação | Origem | Destino/efeito |
| --- | --- | --- |
| Abrir unidade | card de unidade | Página interna do tipo correto |
| Novo pedido | aba Pedidos da unidade | Criação associada à unidade atual; sem troca de destino inadvertida |
| Abrir pedido | resumo/aba Pedidos | Registro exato na fila unificada, com painel pai e filhos abertos conforme necessidade |
| Voltar à unidade | Pedidos com contexto | Retorna à aba e unidade de origem; restabelece contexto de navegação |
| Separar / Conferir / Expedir | tela de pedido | Abre a operação única que já existe, somente na etapa e permissão corretas |
| Estoque / Movimentar / Devolver | página própria | Formulário específico da própria unidade; audita alterações |
| Conferir fechamento | temporária | Formulário de conciliação por SKU, sem campo vendas |
| Equipe | temporária | Gerenciar membros autorizados sem mudar status do pedido |
| Editar cadastro | menu/contexto de unidade | Modal administrativo específico |
| Excluir/Arquivar | menu de administração | Prévia dos impactos, autorização reforçada e confirmação; preservar movimentos e histórico |
| Ver histórico | aba Histórico | Consulta sem mexer no estado operacional |
| Imprimir | pedido específico | Gerador funcional existente; migração a 57 mm em trabalho separado |

O clique em um pedido **nunca** abrirá apenas o filtro de “todos os pedidos” sem selecionar o registro desejado.

## 8. Segurança, consistência e integração

- Reutilizar guards de leitura e escrita e controles existentes de hasPermission, assignedStore, memberRole e escopos da franquia; restrições devem ser também impostas no banco/RPC, não apenas ocultando botões.
- Evitar alterar permissões de RLS por questões de layout. Verificar antes de qualquer futura alteração de banco.
- A identidade e a natureza da unidade derivam do registro de origem (stores vs events), não de texto/capa.
- Não criar novas tabelas para cartões de resumo; calcular com dados já autorizados, filtrados por unidade.
- Operações de estoque e reserva devem permanecer atômicas e auditadas pelo backend atual. Interface não manipula saldos diretamente.
- Exclusão avançada exige prévia de impactos e validação de permissões; histórico sempre preservado de acordo com mecanismos já existentes. **Nunca efetuar exclusão direta silenciosa**.
- Não migrar registros históricos nem converter pedidos antigos sem justificativa e estratégia de migração separada.

## 9. Desktop, tablet, mobile e acessibilidade

- Desktop: 1 ou 2 cards por linha conforme espaço útil (sem quantidade fixa), informações alinhadas e bom uso de largura.
- Mobile: 1 card por linha, botões com área de toque adequada (preferência 44 px), título curto mas sem truncar identidade, filtros horizontais roláveis, abas com overflow horizontal explícito ou navegação compacta.
- Barra lateral existente respeitada; nenhuma alteração não relacionada à identidade/logotipo.
- Capas opcionais pequenas com proporção fixa; evitar banner alto no primeiro viewport.
- Evitar rolagem horizontal da página; longos identificadores/SKUs devem quebrar linha sem sobreposição.
- Todos os botões devem ter nome acessível, estados de foco, retorno de erro e aviso das consequências nas operações críticas.
- Menus de três pontos devem funcionar por toque e teclado; não depender de hover; manter legível contraste das cores.
- Validar visualmente com larguras de referência 360, 390, 768, 1024 e desktop amplo, além de mouse, touch, teclado e telas vazias.

## 10. Arquitetura e componentes propostos

Manter a aplicação frontend atual e sua integração com Supabase; modularizar sem reescrever serviços de banco:
- **src/store-hub.js:** modelo de apresentação de unidades, lista filtrável e cards sucintos;
- **store-hub.css + cdsb-theme.css:** ajustes visuais, responsividade e paleta;
- **src/app.js:** roteamento por contexto, painéis internos, handlers e guards;
- **src/event-simple.js:** tela temporária sem dependência visual da lista legada; resumo do fechamento;
- **src/event-lots.js:** lista de pedidos independentes com dados e rotulagem corretos (nome legado pode permanecer internamente);
- **src/unified-orders.js:** abertura do pedido correto e retorno ao contexto;
- **testes:** estender cobertura de store-hub, temporárias e fluxo contextual; criar testes específicos de conciliação e permissões.

Propor um pequeno **adaptador de dados para a visualização da unidade**, independente do código HTML, que deriva status e métricas de dados existentes. Um card não deverá executar RPCs por conta própria.

A atualização visual, o roteamento e a conciliação são blocos separáveis para permitir revisão e rollback. Nenhuma alteração de schema é pressuposta. Se implementação exigir mudança de banco, documentar sua motivação, rollback e testes antes de aplicar.

## 11. Falhas e observabilidade

- Falha ao carregar unidades: mostrar erro e ação “Tentar novamente”, sem exibir zeros que pareçam dados válidos;
- Pedido não acessível por mudança de permissão: aviso claro e retorno seguro à unidade;
- Operação desatualizada (etapa/quantidade mudou): bloquear envio e exigir atualização dos dados antes de gravar;
- Falha em RPC: nenhuma confirmação visual falsa nem manipulação local presumida do saldo; preservar formulário para tentativa posterior quando seguro;
- Conflito de conciliação: informar SKU, valor esperado, contabilizado e pendência específica;
- Falha no recurso de capa: interface utilizável sem imagem;
- Registrar erros técnicos no mecanismo existente sem expor dados sensíveis na interface.

## 12. Critérios de aceite / cenários verificáveis

**A. Identidade e escopo**
1. CDSB não aparece como unidade comercial; Cristo Rei aparece uma vez como própria.
2. Franquias veem somente unidades e pedidos autorizados.
3. O gestor vê, filtra e abre próprias, franquias e temporárias em desktop e mobile.

**B. Navegação**
4. Todos os cards abrem sua unidade; nenhum CTA principal redireciona indiscriminadamente à fila de Pedidos.
5. Abrir pedido #AA003 seleciona o pedido correto e expande o painel necessário; voltar retorna à unidade/aba de origem.
6. Busca/filtros permanecem consistentes durante navegação, respeitando permissões.

**C. Pedidos e estoques**
7. Criar pedido na temporária gera um único pedido independente e o coloca na fila central, sem “lotes”.
8. Reserva/separação/conferência não faz transferência física; expedição física autorizada atualiza saldos uma vez.
9. Quantidade separada nunca recebe rótulo “conferida”; divergências exibem motivo.
10. Loja própria pode realizar apenas operações permitidas em seu próprio saldo.
11. Franquia não recebe indicador falso de estoque físico.

**D. Conciliação da temporária**
12. A página não duplica a lista de separação antiga nem exibe zero conflitante com pedido ativo.
13. Em cada SKU: boas + avariadas + não devolvidas = saldo a conciliar. Divergências exigem justificativa.
14. Não devolvidas não são classificadas como vendas nem geram receita.
15. Encerramento só ocorre com saldo conciliado, mantendo rastreabilidade.
16. Histórico anterior permanece acessível; nenhuma operação de teste exclui saldos reais.

**E. UX, segurança e deploy**
17. Desktop e tamanhos 360/390/768/1024 px sem scroll horizontal, corte de botões ou sobreposição.
18. Ações de administração só aparecem com permissão e são validadas no servidor; ações destrutivas pedem confirmação adequada.
19. Regressões existentes de lojas, pedidos, estoque e temporárias continuam verdes.
20. Lançamento pode ser revertido sem migração destrutiva.

## 13. Estratégia de integração, revisão e liberação

Recomenda-se implementação em branch isolada, com testes antes de cada integração. Ordem funcional sugerida:
1. Corrigir navegação pontual, rótulos de contagem e duplicação legada de temporárias;
2. Refazer lista de unidades e páginas internas;
3. Integrar operações e conciliação, validar permissões e comportamento mobile;
4. Testar com dados sintéticos, revisar regressões em CI e publicar quando aprovado.

Essas fases são **orientação de integração**, não plano de implementação com tarefas detalhadas. O plano formal deve ser escrito **somente após a aprovação desta especificação escrita**.

### 13.1 Decisões consolidadas

- **Sim:** gestão unificada das unidades por tipo, com páginas internas diferentes.
- **Sim:** fila operacional única de Pedidos, pedidos independentes e rastreabilidade.
- **Sim:** retorno de boas, avariadas e não devolvidas, com justificativa e fechamento logístico.
- **Não:** registro de vendas ou inferência de vendas a partir de mercadorias faltantes.
- **Não:** criação de novos lotes de pedido ou reescrita desnecessária das regras de estoque.
- **Não:** marcar como impresso em 57 mm sem que a funcionalidade correspondente esteja concluída.

### 13.2 Critério para seguir

Responsável revisa este arquivo e confirma a especificação. Após isso, preparar plano técnico detalhado em documento separado e pedir a escolha de execução. Até então, esta branch altera **somente documentação**.
