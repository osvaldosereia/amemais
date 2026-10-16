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


## Atualização: Painel Gerencial 360° (16/10/2026)

URL: https://cdsb.net.br/painel-tv.html

### Sete telas rotativas
1. Operação ao vivo: 20 s
2. Inteligência de estoque: 25 s
3. Franquias e solicitações dos últimos 30 dias: 30 s
4. Próximos eventos e separação por categoria: 25 s
5. Eventos encerrados e devoluções por categoria: 30 s
6. Avarias e comparativo de categorias: 30 s
7. Compras e produtividade: 25 s

O ciclo completo dura 3 minutos e 5 segundos. É possível pausar, avançar, retroceder, entrar em tela cheia e configurar o tempo de cada página entre 10 e 120 segundos. A preferência é salva no navegador. A atualização dos dados permanece a cada 30 segundos. Listas de franquias e eventos são paginadas entre as voltas.

### Ocorrências com identificação completa
A faixa fixa prioriza código curto do pedido, tipo de destino (franquia, loja própria, evento ou avulso), nome do destino, motivo do problema, produto, SKU e quantidades solicitada, identificada e faltante. As fontes incluem falhas de conferência, falta de reservas de pedidos e reduções de quantidades registradas na separação. Não são exibidos nomes nem telefones de clientes.

### Análises
- Estoque: 10 menores saldos disponíveis, gôndolas, mínimo e unidades reservadas.
- Franquias: solicitadas e expedidas por categoria principal nos últimos 30 dias, incluindo franquias ativas sem pedidos.
- Eventos futuros: quantidades solicitadas, separadas e enviadas por categoria.
- Eventos encerrados: envio, devolução, não devolução e avarias por categoria. Não devolvido NÃO equivale a venda confirmada.
- Avarias: quantidade e ocorrências por categoria dos últimos 30 dias.
- Categorias: comparação da demanda dos últimos 30 dias com os 30 anteriores e gráfico de tendência de 14 dias.
- Compras e produtividade: ordens de compra abertas e conferências e expedições do dia.

### Segurança
Uma segunda consulta, public.tv_management_snapshot(), é somente leitura e exige sessão autenticada, perfil ativo não arquivado e papel gerente/admin. Acesso anônimo revogado. Os textos são escapados na interface e os dados são atualizados a cada 30 segundos. Na falha de rede, os resultados antigos ficam identificados como não atualizados. Os relatórios não realizam movimentos de estoque nem alteram pedidos.
