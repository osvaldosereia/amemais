# AME MAIS Estoque

Sistema web de gestão de produtos, estoque da loja e estoques temporários de eventos da **empresa AME MAIS**.

**Empresa independente:** projeto Supabase exclusivo dentro da **mesma organização Pro** do proprietário. Não consulta nem sincroniza bancos de outras empresas.

## Situação

- Aplicação responsiva em HTML, CSS e JavaScript com publicação automatizada via GitHub Pages.
- Banco PostgreSQL exclusivo com RLS nas oito tabelas públicas do sistema.
- Autenticação por **email (link sem senha)**, ativação inicial protegida por código de uso único e convites de colaboradores pelo administrador.
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
4. Após a ativação, gerencie convites em **Usuários** e faça testes de ponta a ponta antes do uso comercial.
5. Depois da ativação, recomenda-se desativar inscrições públicas em **Authentication > Providers > Email**, mantendo os convites administrativos; valide o fluxo de convites antes de restringir cadastro.

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
- `supabase/functions/admin-create-user/`: convites administrativos.
- `docs/INSTALACAO.md`: instalação e testes.
- `docs/OPERACAO.md`: operação diária e regras de eventos.
- `.github/workflows/pages.yml`: publicação.

**Limite atual:** vendas são registradas manualmente; não há integração automática de PDV, nota fiscal ou Bling.

A configuração final do domínio personalizado (GitHub Pages, Registro.br e URLs permitidas no Supabase Auth) está detalhada em [Instalação — Domínio](docs/INSTALACAO.md#0-domínio-próprio-cdsbnetbr). **Não considerar o domínio ativo antes de confirmar o DNS e o HTTPS.**
