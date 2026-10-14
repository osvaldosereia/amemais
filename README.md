# AME MAIS Estoque

Sistema web de gestão de produtos, estoque da loja e estoques temporários de eventos da **empresa AME MAIS**.

**Empresa independente:** projeto Supabase exclusivo dentro da **mesma organização Pro** do proprietário. Não consulta nem sincroniza bancos de outras empresas.

## Situação

- Aplicação responsiva em HTML, CSS e JavaScript com publicação pelo GitHub Pages (branch main).
- Banco PostgreSQL exclusivo com RLS nas oito tabelas públicas do sistema.
- Autenticação com **email e senha definidos pelo administrador**, sem convite ou confirmação por email no cadastro de colaboradores. Contas legadas podem entrar temporariamente por link para definir sua senha.
- Papéis: administrador, gerente, equipe do evento (responsável/operador) e consulta.
- Estoque e movimentos transacionais e auditáveis, com devolução e encerramento de eventos.
- Imagens compactadas antes do envio para bucket privado; leitura EAN via câmera.
- [Supabase AME MAIS](https://supabase.com/dashboard/project/awcclxehwzvvgajgpnmf)
- [Site AME MAIS (domínio oficial, após apontamento DNS)](https://cdsb.net.br/)

## Primeira ativação

1. Confirme a configuração do Supabase Auth em [URL Configuration](https://supabase.com/dashboard/project/awcclxehwzvvgajgpnmf/auth/url-configuration):
   - **Site URL:** `https://cdsb.net.br/`
   - **Redirect URLs:** adicione `https://cdsb.net.br/`.
2. Abra o site e informe seu email. Supabase envia um link de confirmação/acesso.
3. Depois de confirmar o email, digite seu nome e o **código de ativação temporário entregue diretamente ao gestor**. O código não está no GitHub.
4. Após a ativação, cadastre colaboradores em **Usuários** informando email, função e senha inicial. Defina a sua própria senha em **Minha senha**. Faça testes de ponta a ponta antes do uso comercial.
5. Mantenha o cadastro público desabilitado. A função protegida cria usuários pelo Admin Auth API, diretamente e sem email de confirmação.

A conta Supabase Pro do gestor **não é outra conta do aplicativo**. O aplicativo usa autenticação própria para associar cada ação ao responsável.

## Segurança

- A primeira ativação requer email comprovado, código secreto aleatório, validação transacional e prazo de expiração.
- O código é armazenado no banco somente por hash SHA-256, não pode ser lido pelo navegador e é invalidado após a primeira utilização.
- Saldos não podem ser escritos diretamente pelo navegador. Apenas RPCs protegidas movimentam produtos.
- A chave privilegiada Supabase não é publicada no GitHub.
- Testes funcionais com sessões reais ainda precisam ser realizados antes da liberação da equipe.

## Arquivos

- `index.html`, `styles.css`, `src/`: interface web.
- `config.js`: apenas URL e chave pública do Supabase.
- `supabase/migrations/`: estrutura e ativação segura.
- `supabase/functions/admin-create-user/`: criação de usuário com senha e redefinição administrativa.
- `docs/INSTALACAO.md`: instalação e testes.
- `docs/OPERACAO.md`: operação diária e regras de eventos.
- Publicação: GitHub Pages configurado para a branch `main` (sem workflow duplicado).

**Limite atual:** vendas são registradas manualmente; não há integração automática de PDV, nota fiscal ou Bling.

A configuração final do domínio personalizado (GitHub Pages, Registro.br e URLs permitidas no Supabase Auth) está detalhada em [Instalação — Domínio](docs/INSTALACAO.md#0-domínio-próprio-cdsbnetbr). **Não considerar o domínio ativo antes de confirmar o DNS e o HTTPS.**

## Operação mobile

No celular, o sistema usa navegação inferior, botões de toque ampliados e formulários em tela cheia. Em **Produtos > Novo produto**, use **Tirar foto** para abrir a câmera ou **Escolher da galeria** para buscar imagens. O arquivo é compactado no aparelho antes do envio. A foto de cada produto pode ser ampliada por toque.

A seleção rápida de categoria, subcategoria e subsubcategoria fica separada dos botões `+` de criação. Tags existentes são escolhidas por toque; o botão **Criar tag** abre cadastro curto sem apagar o formulário de produto. Há suporte básico a instalação na tela inicial via manifesto web.

## Cadastro sem email de confirmação

O administrador preenche nome, email de login, função, senha inicial e confirmação da senha no painel **Usuários**. O backend valida o JWT do administrador, usa o Supabase Auth Admin API com `email_confirm: true` (sem envio de link) e vincula a conta a `staff_profiles`. A senha não é salva no banco da aplicação nem nos logs. É possível redefinir senhas por **Usuários > Definir senha**. Cada usuário pode trocar a própria senha pelo menu **Minha senha**.

As contas preexistentes criadas por link continuam preservadas. Para entrar pela primeira vez após a atualização e estabelecer senha, existe a opção **Ainda não tenho senha (acesso antigo)** no login. Não use links de confirmação para criar novas contas.

O sistema aceita senhas a partir de **6 caracteres** na interface e no serviço de cadastro. Senhas mais longas continuam recomendadas para administradores. A política de senhas do Supabase Auth deve permitir esse mínimo.
