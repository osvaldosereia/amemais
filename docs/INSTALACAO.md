# Instalação — AME MAIS Estoque

## 0. Domínio próprio cdsb.net.br

O domínio oficial da aplicação será **https://cdsb.net.br/** (domínio principal, sem prefixo admin). A publicação atual usa **GitHub Pages a partir da branch main**, com fluxo automático do GitHub.

**No GitHub**: [Settings > Pages](https://github.com/osvaldosereia/amemais/settings/pages) > **Custom domain** > informe `cdsb.net.br` > **Save**. Ative **Enforce HTTPS** quando o certificado estiver disponível.

**No Registro.br**: não mude os servidores DNS existentes. Acesse **Modo Avançado / Zona DNS** e configure os registros abaixo no domínio raiz:

| Tipo | Nome | Valor |
|---|---|---|
| A | @ (ou campo em branco) | 185.199.108.153 |
| A | @ (ou campo em branco) | 185.199.109.153 |
| A | @ (ou campo em branco) | 185.199.110.153 |
| A | @ (ou campo em branco) | 185.199.111.153 |
| CNAME | www | osvaldosereia.github.io |

O `www` é opcional, mas recomendado. Não inclua `https://` nos registros. Revise entradas DNS antigas do domínio raiz que entrem em conflito; preserve registros de e-mail (MX, SPF, DKIM, DMARC). A propagação do DNS e o certificado HTTPS podem levar até 24 horas.

**Importante:** configure sempre **Custom domain** em Settings > Pages. Não use mais de uma forma de publicação simultaneamente.

Depois configure o **Supabase Auth** do projeto AME MAIS (seção 1) para o domínio novo. Links de convites de colaboradores já apontam para `https://cdsb.net.br/`; o formulário de login usa automaticamente o endereço atual do site.

## Projeto e banco

O projeto Supabase **AME MAIS Estoque** já foi criado dentro da mesma organização Pro, isolado de todos os outros projetos: [abrir Supabase](https://supabase.com/dashboard/project/awcclxehwzvvgajgpnmf).

**As migrações já foram aplicadas**:
- `202610140001_initial.sql`: tabelas, RLS, inventário, categorias, eventos, auditoria e fotos privadas;
- `202610140002_initial_admin_activation.sql`: ativação do primeiro administrador por código secreto único;
- `202610140006_unlimited_categories.sql`: hierarquia de categorias com profundidade variável e prevenção de ciclos.

Não reaplique as migrações no banco atual.

## 1. Configuração necessária: URLs de autenticação

A conexão Supabase usada nesta implementação não permite alterar remotamente a configuração de redirects do Auth. Assim, o gestor precisa conferir uma vez em [Authentication > URL Configuration](https://supabase.com/dashboard/project/awcclxehwzvvgajgpnmf/auth/url-configuration):

- **Site URL**: `https://cdsb.net.br/`
- **Redirect URLs**: adicionar `https://cdsb.net.br/`

Salve as alterações. Isso permite retornar ao aplicativo depois de clicar no link de login, sem cair em `localhost`. O email deve estar habilitado em Auth Providers. Para grandes volumes de email configure SMTP próprio de acordo com limites do provedor.

## 2. Primeiro administrador — sem operação SQL manual

1. Abra [AME MAIS Estoque](https://cdsb.net.br/).
2. Informe seu email e clique **Receber link de acesso**.
3. Abra o email recebido e clique no link de confirmação.
4. O site mostrará **Ativar administrador**. Informe seu nome e o **código de ativação de uso único** entregue exclusivamente ao gestor via conversa privada.
5. O sistema verifica o email confirmado e o hash do código no servidor; somente um usuário pode fazer a ativação.
6. O código expira em 30 dias a partir da configuração e não está salvo em texto simples no banco ou GitHub.

**Nunca compartilhe o código publicamente, nem o inclua no repositório.**

Após ativar, faça login apenas com seu email. Se o link de email não retornar ao site, reveja a configuração de URLs acima.

## 3. Cadastrar equipe sem confirmação de email

Em **Usuários > Novo usuário**, o administrador informa nome, email de login, perfil e senha inicial (6 a 128 caracteres), com confirmação. A Edge Function **admin-create-user** (versão 5 ou superior) verifica a sessão e a função de administrador e usa `auth.admin.createUser({ email, password, email_confirm: true })`, sem enviar convites. O novo usuário pode entrar imediatamente.

Para colaboradores já cadastrados, use **Definir senha** na tabela de usuários. Para definir a própria senha, use **Minha senha**, disponível na navegação. Contas antigas sem senha podem usar o acesso por link **somente para recuperar a sessão e cadastrar uma senha**.

Nunca armazene ou envie senhas em planilhas públicas, tickets, emails coletivos ou no GitHub. Distribua a senha inicial por canal seguro e incentive sua troca após o primeiro acesso.

Mantenha inscrições públicas desabilitadas no Supabase; a aplicação não oferece cadastro aberto.

## 4. Aplicação

O arquivo `config.js` já aponta **somente para o projeto novo da AME MAIS**, usando URL e chave publicável. Não há nenhuma chave de serviço no código público.

A publicação utiliza **GitHub Pages → Deploy from a branch (main, /root)**. O workflow manual duplicado foi removido, pois ocasionava conflito entre duas implantações. Confira o status em [GitHub Actions](https://github.com/osvaldosereia/amemais/actions).

## 5. Testes antes de liberar

1. Ative admin e entre por link de email.
2. Cadastre um produto e dê entrada de 10 unidades.
3. Crie evento, ative, vincule um usuário e transfira 6.
4. Registre venda de 2, devolva 4 e encerre.
5. Confirme 8 na loja e zero no evento; analise histórico, autor e horários.
6. Tente saldo negativo e acesso sem permissão, ambos devem falhar.
7. Tire foto e escaneie EAN em celular com navegador e HTTPS.
8. Confira emissão de convites, bloqueio de usuário e exportação CSV.

**Limitações:** sem modo offline nem conciliação automática com caixa ou emissão fiscal. Faça backup e teste de restauração antes de uso intensivo.
