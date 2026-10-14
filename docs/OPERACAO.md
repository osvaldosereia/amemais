# Operação — Estoque AME MAIS

## Menus e perfis

- **Admin:** usuários, cadastros, eventos, estoque, auditoria.
- **Gerente:** produtos, categorias, eventos, estoque da loja e relatórios.
- **Evento:** apenas eventos aos quais foi associado. Responsável pode registrar devolução e encerrar; operador registra vendas.
- **Consulta:** visualização de produtos, saldos, eventos e movimentações sem alterações.

Cada pessoa entra com email e senha individual cadastrados pelo administrador. Contas antigas sem senha ainda podem usar link de acesso temporariamente para definir a própria senha. O histórico registra o UUID de quem executou cada movimento e o horário. A interface apresenta o nome do usuário correspondente.

## Produtos

Categorias e subcategorias podem ter quantos níveis forem necessários, como Roupas > Camisetas > Adulto > Modelos > Estampas. Tags são rótulos reutilizáveis cadastrados em **Categorias e tags**. Produto contém nome, SKU opcional, EAN opcional, categoria, foto e status.

Uma peça de roupa com tamanho/cor diferente deve ter SKU/EAN e saldo próprio (produto distinto). O cadastro de produto não altera o saldo por si só: use **Entrada** para quantidade inicial.

Fotos de celular são reduzidas até 1280 px e aproximadamente 450 KB antes do envio. O arquivo vai para bucket privado; acesso é temporário e depende de login.

## Eventos — fluxo correto

1. O gerente cria um evento com nome, início e término estimado.
2. Associa colaboradores como **responsável** ou **operador**.
3. Ativa o evento e transfere quantidades da loja.
4. Durante o evento, registra cada venda, diminuindo apenas o saldo daquele evento.
5. No retorno, o responsável registra devoluções dos produtos não vendidos para a loja.
6. O evento só pode ser encerrado com saldo zero em todos os itens.

**Exemplo:** Loja tem 30 terços. Transfere 12 ao evento → loja 18, evento 12. Vende 7 → evento 5. Devolve 5 → loja 23, evento 0. Encerra evento. Histórico mostra os três movimentos com usuários e datas.

Uma transferência adicional é permitida enquanto o evento estiver ativo, respeitando o saldo. Eventos encerrados são somente leitura.

## Lançamentos e correções

Ações de estoque da loja: **Entrada**, **Venda loja**, **Ajuste** (requer motivo). Ações de evento: **Transferir**, **Venda evento**, **Devolver**. Todos os lançamentos têm quantidade explícita, nome do produto, usuário e data/hora.

Os saldos são conferidos dentro de transação SQL com bloqueio de linhas, evitando corrida entre dois operadores. Não é permitido saldo negativo. Um erro de lançamento deve ser corrigido por outra movimentação válida com justificativa; o histórico anterior permanece.

## Limitações conscientes da versão inicial

- Operações exigem conexão à internet; não há lançamentos offline, evitando conflitos de sincronização.
- Não há integração automática com PDV, Bling ou emissor fiscal; vendas são registradas manualmente e devem ser conciliadas com o caixa.
- O relatório apresenta histórico recente e exportação CSV; não substitui demonstrações contábeis.
- O leitor usa biblioteca ZXing quando disponível; câmera pode variar conforme permissões e dispositivo.
- Atualize políticas, testes e procedimentos de backup antes de uso com grande volume.

## Categorias, tags e fotos (interface móvel)

Em **Categorias e tags**, crie uma categoria principal e depois use **+ Subcategoria** em qualquer nível, sem limite fixo. Em **Produtos > Novo produto**, os campos de categoria surgem conforme você escolhe cada nível. O botão `+` de cada campo abre uma tela de criação separada, sem perder os dados já preenchidos; ao salvar, a nova subcategoria fica selecionada.

Tags ficam em um catálogo reutilizável, acessível em **Categorias e tags**. No cadastro do produto, selecione tocando nos chips; **Criar tag** abre um cadastro curto em separado. Tags em uso não podem ser apagadas sem antes desvincular dos produtos.

Para foto, use **Tirar foto** (câmera) ou **Escolher da galeria**. A imagem é compactada no celular e enviada ao bucket privado. Na lista de produtos, toque na imagem para ampliá-la. O aplicativo requer conexão para consultar estoque e salvar alterações.

Em smartphones, a navegação fica no rodapé e o formulário de produto ocupa a tela, com campos e botões próprios para toque.

## Cadastro e troca de senhas

Em **Usuários > Novo usuário**, informe nome, email de login, função e senha inicial; confirme a senha. Não é necessário confirmar o email para ativar a conta. O usuário já pode fazer login imediatamente. A senha não fica visível após o cadastro e não é armazenada na tabela de usuários.

O administrador pode selecionar **Definir senha** para outro usuário. Para trocar a própria senha, use **Minha senha** no painel. Todas as ações administrativas de senha são registradas na auditoria sem incluir o texto da senha. Bloquear uma conta impede seu acesso ao estoque sem apagar seu histórico.

## Seleção visual de categorias (celular e desktop)

Na lista de produtos, o filtro **Todas as categorias** abre um painel do AME MAIS, em vez do seletor nativo do telefone. No cadastro ou na edição do produto, **Escolher categoria** abre o mesmo painel. Use a busca por nome ou caminho completo, toque no nome para selecionar imediatamente ou na seta lateral para entrar no próximo nível. **Sem categoria** e **Todas as categorias** limpam a escolha conforme o contexto. Os filtros de tags também utilizam o painel próprio.

O botão **+ Categoria / + Subcategoria** abre um formulário separado do seletor e mantém os dados já digitados no produto. Ao criar, a categoria nova é selecionada automaticamente.

Na administração, a hierarquia mostra tons de fundo distintos conforme o nível, com grupos principais mais destacados. Toque na pequena seta ao lado do nome para recolher ou expandir as subcategorias. O visual foi adaptado para cartões em telas pequenas. Não há mudança na estrutura do Supabase nem migração de produtos.

## Perfil Estoquista e Balanço rápido

**Estoquista:** acessa somente **Produtos** e **Balanço rápido**. Pode cadastrar e editar produtos, ler EAN e enviar fotos compactadas. Utiliza as categorias e tags existentes, mas não administra seus cadastros. Não pode usar movimentações livres, eventos, administração de usuários ou relatórios gerais. Os controles também são aplicados via políticas RLS e RPC no Supabase, não apenas pela interface.

**Balanço rápido (loja):** encontre o produto pelo nome, EAN, SKU ou câmera. O cartão apresenta nome, foto, saldo da loja e campo vazio **Quantidade contada**. Digite o total físico e pressione **Conferir**. Quando há diferença, o sistema pede confirmação, ajusta a quantidade pelo RPC `quick_stock_count` e registra a movimentação e o usuário responsável. Quando os valores são iguais, a conferência é registrada sem movimentar estoque.

As contagens são transacionais: um saldo modificado depois que a tela foi aberta bloqueia a correção e pede atualização, evitando substituir alterações concorrentes. Estoques de eventos não são incluídos no balanço da loja. O saldo não pode ficar negativo. Os registros de contagem ficam em `stock_counts` e alterações de quantidade em `stock_movements`.

## Produtos com tamanhos, gôndola e prateleira

Todo cadastro começa em **Produtos → Novo produto**. Não há seção separada para roupas. Preencha nome, categoria, foto, tags e os campos opcionais **Gôndola** e **Prateleira**. Esses campos também aparecem na lista de produtos e no balanço rápido.

Para produtos **sem variações**, deixe desmarcada a opção **Este produto tem tamanhos?**, informe o SKU, EAN (se houver) e estoque inicial normalmente.

Para roupas, marque **Este produto tem tamanhos?**. Escolha uma categoria dentro de **Roupas**, tipo, público, faixa etária e cor. Toque nos tamanhos disponíveis: **P, M, G, GG, XGG, XXGG, EXGG** (ou use **Selecionar P, M, G, GG**). Para cada tamanho selecionado preencha ou confirme o código interno (SKU, gerado inicialmente e editável), informe o EAN real se existir e a quantidade física da loja. Não invente números EAN. Ao salvar, o Supabase cria um modelo e um registro de estoque por tamanho, preservando uma foto compartilhada e os valores iniciais de localização.

Exemplo orientativo, não inserido automaticamente: *Camiseta Nossa Senhora*, cor Branca, tamanho P (4 unidades), M (8), G (5). Cada variação possui identificação própria para leitura por câmera, contagem, venda e transferência de eventos.

Em **Produtos**, os tamanhos aparecem como itens identificados por cor e tamanho. **Editar** permite mudar EAN, SKU, cor, tamanho, gôndola e prateleira sem mexer no estoque. Para alterar quantidade use as operações de estoque permitidas ao perfil ou o Balanço rápido.

## Exclusão com proteção do histórico

**Produtos → Excluir:** permitido a administrador ou gerente. Caso o produto tenha saldo em loja ou eventos, a exclusão é bloqueada até zerar todos os saldos. Sem movimentações nem contagens, o produto pode ser apagado definitivamente. Se existir histórico, o produto é **desativado**, não apagado, mantendo os vínculos para auditoria. Use **Mostrar inativos** na tela de Produtos para localizá-lo ou reativá-lo quando necessário.

**Categorias → Excluir:** permite excluir um ramo inteiro quando não existirem produtos ativos nem saldos de estoque vinculados à categoria ou a suas subcategorias. Produtos e modelos desativados continuam no banco com o caminho da antiga categoria registrado em `historical_category_path`, e suas movimentações e auditorias são preservadas. A exclusão da categoria não apaga esses produtos nem altera quantidades. **Tags → Excluir:** a tag pode ser desvinculada dos produtos antes de ser apagada. Em todos os casos há confirmação antes da alteração. O banco valida as regras e registra a auditoria; o administrador não precisa fazer operações diretamente no Supabase.


## Produtos agrupados e inclusão posterior de tamanhos

Em **Produtos**, cada modelo de roupa aparece em **um único cartão**. Abaixo da foto ficam todas as combinações de cor e tamanho, com código interno/EAN e a quantidade disponível **na loja** de cada variação. O total do modelo é a soma dessas quantidades. Produtos sem variação também aparecem em um cartão único.

Se já foi cadastrada uma camiseta tamanho P e depois chegarem M, G ou outro tamanho, abra **Produtos**, encontre o cartão da camiseta e toque em **+ Novos tamanhos**. Confirme a cor, marque somente os tamanhos novos e informe o estoque inicial. SKU vazio gera um código interno exclusivo; informe EAN somente se houver etiqueta com código válido. O cadastro existente e seu histórico permanecem no mesmo modelo.

## Separação e devolução nos eventos

1. Crie o evento e **ative-o**.
2. Em **Eventos → Gerenciar evento → Separar produtos para o evento**, consulte os cartões dos modelos com seus tamanhos e saldos disponíveis **na loja**. Informe quantas unidades de cada tamanho serão enviadas. Zero significa não enviar. Use a busca por nome, SKU ou EAN.
3. Toque em **Confirmar transferência** e confirme o resumo. A operação ocorre como um lote: se qualquer quantidade ultrapassar o saldo ou houver erro, nenhuma parte da separação será aplicada. As quantidades são subtraídas da loja e adicionadas ao estoque do evento, com movimentações auditadas.
4. Registre as vendas do evento normalmente; cada venda baixa seu tamanho específico.
5. Na volta, abra **Eventos → Gerenciar evento → Devolução rápida por EAN**. Leia o código de barras no botão da tela ou na navegação inferior, ou pesquise o nome e o tamanho. Cada variação mostra quantas unidades **ainda restam no evento**.
6. Digite quantas unidades voltaram fisicamente ou toque em **Tudo** e depois **Devolver**. Confirme. O sistema reduz o saldo do evento, repõe o da loja e registra data, usuário e histórico.
7. Repita com os demais tamanhos. Quando não houver pendências no evento, o responsável poderá encerrá-lo.

**Importante:** a devolução não cria novos produtos e não ajusta diretamente o estoque físico informado no Balanço rápido; é uma movimentação de retorno do evento, vinculada ao produto original. Somente saldo ainda disponível no evento pode ser devolvido, evitando devoluções duplicadas. Se o código não estiver legível, o leitor permite selecionar uma foto ou digitar o EAN. O leitor tenta a câmera nativa e, quando necessário, um método alternativo; alguns aparelhos também permitem ligar a luz pelo leitor.

## Administração de Categorias e Tags (visual 2026-10-14)

A gestão foi separada em **Categorias** e **Tags** no menu lateral e em **Mais** no celular.

Em **Categorias**, os grupos começam recolhidos. Toque na seta **ou no nome** para expandir as subcategorias. Use a busca por nome/caminho, **Expandir tudo** ou **Recolher tudo**. Cada categoria mostra quantos **produtos ativos** pertencem diretamente a ela. Registros desativados não são contados como produtos disponíveis; quando existirem, aparece uma indicação separada de **inativos no histórico**. Esses registros não são apagados automaticamente porque podem estar ligados a movimentações e à auditoria. Você pode excluir categorias que tenham somente registros históricos inativos com saldo zero: o sistema mantém os produtos e modelos arquivados e salva seu caminho original antes de retirar a categoria.

Em **Tags**, a lista fica pesquisável e apresenta as tags mais usadas primeiro. A quantidade de uso considera **somente produtos ativos**, contando uma roupa com vários tamanhos como um modelo para fins de sugestão e estatística de tags.

No **cadastro de produtos**, selecione primeiro a categoria. O sistema apresentará na frente as tags dos produtos ativos cadastrados nessa mesma categoria, priorizando correspondência exata, subcategorias e ascendentes. As tags já selecionadas continuam marcadas; o botão **Ver outras tags** mostra todas as opções que não apareceram nas sugestões, sem restringir nenhuma.

## Hierarquia visual e exclusão de categorias arquivadas

Na lista de **Categorias**, cada subnível recebe recuo horizontal progressivo e linhas-guia, tanto no computador quanto no celular. Toque no nome ou na seta para expandir o grupo. A administração distingue **ativos** de **registros históricos inativos**.

Se o ramo tiver zero produtos ativos e nenhum saldo na loja ou em eventos, **Excluir** remove a categoria e suas subcategorias. Produtos e modelos históricos permanecem disponíveis para auditoria; sua antiga classificação é salva no próprio registro. Categorias com produtos ativos exigem reclassificar ou desativar os produtos primeiro. Essa alteração não elimina produtos nem seus movimentos.

## Recadastro de produto com SKU ou EAN antigo

Quando um produto for **excluído/desativado**, ele continua disponível no banco para o histórico, mas seu **código interno (SKU) e seu EAN podem ser reutilizados em um novo produto ativo**. Isso vale para produto simples, cadastro inicial de roupas e inclusão de novos tamanhos. Dois produtos **ativos** nunca podem possuir o mesmo SKU ou o mesmo EAN; o sistema informa o conflito em português. Uma tentativa de reativar o produto antigo enquanto outro ativo usa seu código é bloqueada.

No cadastro de produtos simples, **produto e quantidade inicial** são gravados em uma única operação no Supabase. Se ocorrer erro, a transação é revertida integralmente. O envio da foto acontece depois; se a foto falhar, o produto **continua salvo** e o aviso será *Produto cadastrado; foto pendente de envio*, evitando recadastramentos acidentais.

Na lista de Produtos, caso uma pesquisa ou filtro oculte mercadorias cadastradas, use **Limpar filtros** ou **Mostrar todos os produtos**. Registros excluídos não aparecem normalmente, mas podem ser consultados em **Mostrar inativos**.
