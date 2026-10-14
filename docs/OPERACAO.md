# Operação — Estoque AME MAIS

## Menus e perfis

- **Admin:** usuários, cadastros, eventos, estoque, auditoria.
- **Gerente:** produtos, categorias, eventos, estoque da loja e relatórios.
- **Evento:** apenas eventos aos quais foi associado. Responsável pode registrar devolução e encerrar; operador registra vendas.
- **Consulta:** visualização de produtos, saldos, eventos e movimentações sem alterações.

Cada pessoa entra com email e senha individual cadastrados pelo administrador. Contas antigas sem senha ainda podem usar link de acesso temporariamente para definir a própria senha. O histórico registra o UUID de quem executou cada movimento e o horário. A interface apresenta o nome do usuário correspondente.

## Produtos

Categorias têm até três níveis: por exemplo, Roupas > Camisetas > Adulto; Terços > Madeira; Imagens > Nossa Senhora. Tags são termos livres separados por vírgula. Produto contém nome, SKU opcional, EAN opcional, categoria, foto e status.

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

Em **Categorias e tags**, cadastre níveis sucessivos: categoria → subcategoria → subsubcategoria (limite de três). Em **Produtos > Novo produto** os três campos são encadeados, e os botões de `+` abrem um cadastro separado; ao salvar, o novo nível é selecionado automaticamente.

Tags ficam em um catálogo reutilizável, acessível em **Categorias e tags**. No cadastro do produto, selecione tocando nos chips; **Criar tag** abre um cadastro curto em separado. Tags em uso não podem ser apagadas sem antes desvincular dos produtos.

Para foto, use **Tirar foto** (câmera) ou **Escolher da galeria**. A imagem é compactada no celular e enviada ao bucket privado. Na lista de produtos, toque na imagem para ampliá-la. O aplicativo requer conexão para consultar estoque e salvar alterações.

Em smartphones, a navegação fica no rodapé e o formulário de produto ocupa a tela, com campos e botões próprios para toque.

## Cadastro e troca de senhas

Em **Usuários > Novo usuário**, informe nome, email de login, função e senha inicial; confirme a senha. Não é necessário confirmar o email para ativar a conta. O usuário já pode fazer login imediatamente. A senha não fica visível após o cadastro e não é armazenada na tabela de usuários.

O administrador pode selecionar **Definir senha** para outro usuário. Para trocar a própria senha, use **Minha senha** no painel. Todas as ações administrativas de senha são registradas na auditoria sem incluir o texto da senha. Bloquear uma conta impede seu acesso ao estoque sem apagar seu histórico.
