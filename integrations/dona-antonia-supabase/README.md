# Geração de capas por IA — AME MAIS Estoque

A função `generate-event-cover` no projeto Supabase **AME MAIS Estoque**
(`awcclxehwzvvgajgpnmf`) valida a sessão, a função do colaborador e o acesso à loja
temporária. Ela encaminha o JWT do colaborador e o identificador da loja para
`ame-estoque-cover-ai`, no projeto **Dona Antônia**
(`ssbesxgaijknwsjbsbcz`).

O gateway do projeto Dona Antônia está versionado em
`integrations/dona-antonia-supabase/functions/ame-estoque-cover-ai/index.ts`
e implantado nesse **outro** projeto, não no Supabase AME Estoque.

## Segurança

- O gateway tem `verify_jwt=false` **somente** porque a assinatura JWT é de
  outro projeto. O código faz validação online no Supabase Auth do AME,
  consulta o colaborador ativo, testa a permissão `events.manage` e verifica
  a loja via RLS. Ausência de autenticação retorna HTTP 401.
- O gateway usa a configuração OpenAI já existente no backend Dona Antônia:
  `OPENAI_API_KEY` no ambiente ou a RPC
  `get_conversation_worker_provider_secret_v1` acessível apenas ao
  `service_role`. Não copia, retorna nem armazena a chave no site ou no projeto AME.
- Somente a imagem produzida (base64 WebP) retorna ao AME; o frontend a
  normaliza para 1600x900 e a salva no Storage `ame-eventos`, depois atualiza
  `events.cover_path`. As regras RLS de escrita do sistema são mantidas.
- A chave `sb_publishable_...` presente no código é uma chave **pública** do
  projeto AME, não é uma credencial privilegiada.
- A integração gera custos de API OpenAI na organização/projeto que possui
  a credencial e depende da disponibilidade de ambos os projetos Supabase.

## Reimplantação

Atualizar `supabase/functions/generate-event-cover/index.ts` no projeto AME
com `verify_jwt=true`. Atualizar o gateway no projeto Dona Antônia
com `verify_jwt=false`, mantendo a autorização explícita por Auth no código.
Não transportar uma service-role key nem `OPENAI_API_KEY` para o GitHub.

Teste básico: requisição anônima ao gateway deve retornar 401; requisição
autorizada via app gera a imagem e a associa ao evento. Erros upstream de
permissão ou limite OpenAI retornam mensagens específicas à interface.
