# Implantação — AME MAIS Estoque

## 1. Banco exclusivo

**Não reutilize um banco Supabase que tenha dados de outros sistemas.** Crie um projeto Supabase exclusivo para este aplicativo (verifique custos e região antes de criar).

No SQL Editor do novo projeto, execute o arquivo `supabase/migrations/202610140001_initial.sql` integralmente. A migração habilita RLS, movimentações atômicas, papéis, bucket privado e auditoria.

## 2. Primeiro administrador

No Supabase Dashboard > Authentication > Users, crie o usuário administrador com email e senha forte. Copie o UUID do usuário, e execute, substituindo os campos:

```sql
insert into public.staff_profiles (id, full_name, email, role, active)
values ('UUID_DO_USUARIO', 'Administrador AME MAIS', 'email@exemplo.com', 'admin', true);
```

Essa etapa é deliberadamente manual, para impedir que alguém se cadastre como administrador pela internet. **Não habilite cadastro público** no projeto Auth. Configure confirmação de email e recuperação de senha conforme sua política interna.

## 3. Cadastrar usuários pelo sistema

Implante a Edge Function `supabase/functions/admin-create-user/index.ts` com o nome **admin-create-user**, habilitando a verificação de JWT (`verify_jwt=true`). A Function usa as variáveis internas do Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. A chave privilegiada **nunca** é utilizada no navegador nem salva no GitHub.

O administrador poderá registrar colaboradores com senhas individuais e funções pelo menu **Usuários**. Remova acessos desativando o usuário, não apagando o histórico.

## 4. Aplicação web

Edite `config.js` com:
- `supabaseUrl`: URL pública da API do projeto novo.
- `supabasePublishableKey`: chave **publishable**, ou a chave legada `anon` quando necessário.

Essas duas configurações são públicas e podem ser enviadas ao navegador; nenhuma outra chave deve entrar no repositório.

É um site estático sem etapa de compilação. Publique por HTTPS em GitHub Pages, Cloudflare Pages, Netlify ou hospedagem similar, mantendo os arquivos e pastas. Para testes locais, use um servidor HTTP local: `python3 -m http.server 8000` e abra `http://localhost:8000`. Abrir `index.html` por `file://` não é suportado.

Para GitHub Pages, publique o branch `main` na raiz. A URL será `https://osvaldosereia.github.io/amemais/`, **somente após ativar Pages**. O app depende da CDN `esm.sh` para o cliente Supabase e o leitor de código, fixados por versão; recomenda-se empacotar dependências localmente quando houver pipeline de produção.

## 5. Conferência antes do uso

1. Efetue login como admin e cadastre um gerente e um operador.
2. Crie produto e dê entrada de 10 unidades.
3. Crie e ative evento, vincule operador e transfira 6 unidades.
4. Venda 2 unidades no evento, devolva 4 e encerre.
5. Confirme loja com 8 unidades e evento com 0; confira histórico e autor.
6. Tente vender mais que o saldo disponível: operação deve ser recusada.
7. Teste que usuário de evento não consegue alterar estoque da loja.
8. Teste compactação de foto e EAN pelo celular em HTTPS.

## Segurança operacional

- Habilite backup/recuperação de banco conforme volume de operações e política do projeto Supabase.
- Prefira contas individuais; não compartilhe senhas.
- Usuários inativos ficam bloqueados imediatamente pelas políticas do banco.
- Movimentos não podem ser editados ou excluídos; correções exigem movimentação compensatória autorizada, mantendo o histórico.
- O leitor de EAN requer permissão de câmera e HTTPS; entrada manual é alternativa.
- Exporte relatórios de movimentação periodicamente para conferência administrativa.
