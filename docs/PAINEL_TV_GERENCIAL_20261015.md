# Painel Operacional — Modo TV · CDSB

**URL:** https://osvaldosereia.github.io/amemais/painel-tv.html

## Abertura

Acesse o AME MAIS Estoque com uma conta **Administrador CDSB** ou **Gerente CDSB** e use **Painel TV** no menu esquerdo, ou **Abrir Painel TV** na tela Início. O painel abre em uma janela independente. Coloque-a no monitor de 32 polegadas e utilize o botão de tela cheia (ou F11). No Windows, **Win + P → Estender** permite deixar o sistema administrativo no monitor principal.

A TV é somente leitura. Não tem botões para separação, baixa, exclusão ou alterações.

## Origem e atualização

Os indicadores são produzidos na função read-only `public.tv_operations_snapshot()` e retornados para a página por uma chamada RPC autenticada, atualizada a cada **30 segundos**. Em erro de rede, o último retrato permanece marcado como **Sem atualização**, não como dados em tempo real.

### Estados
- **A separar**: solicitado, legado, reservado, aprovado, aguardando e em separação.
- **A conferir**: separado sem conferência final completa.
- **Conferidos**: separado com todas as quantidades conferidas iguais às solicitadas.
- **Enviados hoje**: expedidos no dia de Cuiabá, considerados pelo campo `dispatched_at`.
- **Falta de estoque**: status `pendente_estoque`.
- **Divergência**: pelo menos um SKU conferido com quantidade diferente do pedido.
- **Pedidos acima do tempo**: mais de 60 minutos na etapa atual de separação/conferência.
- **Aguardando liberação**: conferidos que ainda não tiveram saída física registrada.

A fila prioriza falta de estoque, conferência e pedidos prontos para saída, seguidos de separação, considerando o tempo de espera. O painel mostra apenas **códigos curtos de pedido** e destinos operacionais — não mostra nomes nem telefones de clientes. Pedidos cancelados e pedidos removidos administrativamente são retirados da fila.

### Métricas diárias

O fuso usado é `America/Cuiaba`. A contagem de unidades expedidas soma os itens dos pedidos com `dispatched_at` no dia. Os contadores de lotes temporários e pedidos avulsos representam cadastros feitos no dia, não necessariamente envios.

## Segurança

A rotina de dados só responde para contas `staff_profiles` ativas, não arquivadas, cujo papel seja `admin` ou `gerente`. Não há permissão para `anon`; `authenticated` pode invocar a função, mas perfis sem autorização recebem resposta nula.

## Testes

- Banco: consulta como administrador retornou as informações reais do lote AA003.
- Banco: conta com perfil separador não recebeu dados.
- Permissões: chamada anônima desabilitada.
- JS: sintaxe do módulo e da aplicação principal válida.
- Interface: teste sintético da renderização de métricas, fila, alertas e histórico; dados HTML escapados.
- Estilos: layout Full HD e adaptação para outras resoluções.
- Não foi realizada inspeção visual física na TV de 32 polegadas. Ajustes finais de escala/overscan podem depender da TV e do sistema operacional.
