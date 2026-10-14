# AME MAIS Estoque

Sistema web de gestão de produtos, estoque da loja e estoques temporários de eventos da **empresa AME MAIS**.

**Empresa independente:** usa um projeto Supabase exclusivo, dentro da mesma organização administrativa de outras empresas. Nenhum banco de outra empresa é consultado, modificado ou sincronizado.

## Situação

- Código web responsivo publicado no GitHub (HTML, CSS, JavaScript).
- Banco PostgreSQL dedicado instalado e com **RLS nas 8 tabelas**.
- Supabase Auth com cadastro restrito e funções de operador, responsável, gerente, administrador e consulta.
- Movimentações transacionais, imutáveis e com responsável.
- Fotos de celular compactadas antes do upload e armazenadas em bucket privado.
- Leitura EAN pela câmera, com digitação manual como alternativa.
- Projeto Supabase: [AME MAIS Estoque](https://supabase.com/dashboard/project/awcclxehwzvvgajgpnmf).
- Publicação configurada via GitHub Actions Pages. Antes de usar o endereço público, verifique se a implantação foi concluída e se o GitHub Pages está ativado.

## Primeiro acesso (obrigatório)

O novo banco começa **sem usuários**. Para cadastrar o primeiro administrador, siga [Instalação](docs/INSTALACAO.md#2-primeiro-administrador): crie o usuário no Auth do novo projeto, copie o UUID e vincule em `staff_profiles` como admin. Em seguida, o administrador poderá cadastrar outras pessoas pela tela Usuários.

**Não crie conta de administrador via cadastro público; não forneça senhas em commits ou mensagens.**

## Regras essenciais

1. Cada produto tem nome, SKU opcional, EAN opcional, foto, tags e categoria em até três níveis.
2. A loja e cada evento possuem saldos separados.
3. Transferência para evento não é venda.
4. O evento só encerra com saldo zero, após registrar vendas ou devolver todos os itens.
5. Ninguém edita/exclui registros antigos de movimentação; alterações são lançamentos novos e auditáveis.
6. As permissões também são aplicadas no banco, não apenas na interface.
7. Nenhum lançamento funciona offline, prevenindo conflitos de sincronização.

## Arquivos

- `index.html`, `styles.css`, `src/`: site web.
- `config.js`: somente URL e chave **publishable** do Supabase dedicado.
- `supabase/migrations/`: estrutura do banco.
- `supabase/functions/admin-create-user/`: cadastro seguro de colaboradores.
- `docs/INSTALACAO.md`: implantação, primeiro administrador e testes.
- `docs/OPERACAO.md`: como usar produtos, eventos e auditoria.
- `.github/workflows/pages.yml`: publicação do site.

**Atenção:** a integração com caixa/PDV ou emissão de notas fiscais não está incluída. Vendas de eventos são lançadas manualmente. A aplicação precisa de teste funcional com conta real antes de ser liberada para toda a equipe.
