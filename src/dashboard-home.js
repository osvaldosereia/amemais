import {DASHBOARD_ORDER_STAGES,dashboardOrderSummary} from './dashboard-operations.js?v=20261016ops1';

// Camada exclusiva da página inicial. Cards operacionais de outras seções não são alterados.
export function renderOperationsDashboard({state,h,uiIcon,qtyAvailable,categoryChain,
  purchaseSuggestions,hasPermission,canRegisterProducts,permittedView,unifiedOrderRecords,dateToday}){
  const all=state.items.filter(p=>p.active&&!p.force_archived_at);
  const productIds=new Set(all.map(p=>p.id));
  const total=state.balances.filter(b=>!b.event_id&&productIds.has(b.product_id))
    .reduce((sum,b)=>sum+Number(b.quantity||0),0);
  const eventTotal=state.balances.filter(b=>b.event_id&&productIds.has(b.product_id))
    .reduce((sum,b)=>sum+Number(b.quantity||0),0);
  const zero=all.filter(p=>qtyAvailable(p.id)===0).length;
  const reserved=state.stockReservations.filter(x=>x.status==='ativa'&&productIds.has(x.product_id))
    .reduce((sum,x)=>sum+Number(x.quantity||0),0);
  const available=Math.max(0,total-reserved);
  const activeEvents=state.events.filter(e=>e.status==='ativo'&&!e.deleted_at).length;
  const movementsToday=state.movements.filter(m=>m.created_at&&new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(m.created_at))===dateToday()).length;
  const canSeeOrders=permittedView('pedidos'),canSeeProducts=permittedView('produtos');
  const summary=canSeeOrders?dashboardOrderSummary(unifiedOrderRecords()):null;
  const replenishments=hasPermission('purchases.manage')?
    purchaseSuggestions(all,state.balances,state.stockReservations,state.purchaseOrders,state.purchaseItems):[];
  const roots=state.categories.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const categoryCards=canSeeProducts?roots.slice(0,6).map(c=>{
    const count=all.filter(p=>categoryChain(p.category_id).some(path=>path.id===c.id)).length;
    return '<button type="button" class="c-category-card" data-action="home-category" data-id="'+h(c.id)+'">'+
      '<span class="c-category-icon">'+uiIcon('layers',18)+'</span>'+
      '<strong>'+h(c.name)+'</strong><small>'+count+' variação(ões)</small></button>';
  }).join(''):'';
  const metrics=[
    {label:'Produtos ativos',value:all.length,icon:'package',tone:'blue',hint:'Variações cadastradas'},
    {label:'Sem disponibilidade',value:zero,icon:'alert',tone:'red',hint:'Variações sem estoque livre'},
    {label:'Movimentações',value:movementsToday,icon:'arrows',tone:'blue',hint:'Hoje'},
    {label:'Eventos ativos',value:activeEvents,icon:'calendar',tone:'orange',hint:'Em andamento'}
  ];
  const stageNames={a_separar:'A separar',em_separacao:'Em separação',
    a_conferir:'A conferir',pronto_saida:'Para enviar',pendente_estoque:'Com falta',a_preparar:'A preparar'};
  const work=summary?'<section class="c-dashboard-section c-work-section" aria-label="Operação do dia">'+
    '<div class="c-section-heading"><h2>Operação do dia</h2>'+
      '<button type="button" data-action="view" data-view="pedidos">Ver pedidos '+uiIcon('chevron',16)+'</button></div>'+
    '<div class="c-work-grid">'+DASHBOARD_ORDER_STAGES.map(stage=>
      '<button type="button" class="c-work-card c-work-'+stage.key+'" data-action="dashboard-orders" data-status="'+stage.key+'">'+
        '<span class="c-work-icon">'+uiIcon(stage.icon,20)+'</span>'+
        '<strong>'+Number(summary.counts[stage.key]||0).toLocaleString('pt-BR')+'</strong>'+
        '<span>'+h(stage.label)+'</span>'+uiIcon('chevron',16)+'</button>').join('')+'</div>'+
    '<div class="c-dashboard-attention"><div class="c-section-heading"><h2>Pedidos que precisam de atenção</h2>'+
      '<button type="button" data-action="dashboard-orders" data-status="todos">Abrir fila '+uiIcon('chevron',16)+'</button></div>'+
      (summary.attention.length?'<div class="c-attention-list">'+summary.attention.slice(0,4).map(({order,stage})=>
        '<button type="button" class="c-attention-item" data-action="dashboard-order-open" data-kind="'+h(order.kind)+'" data-id="'+h(order.id)+'">'+
        '<span class="c-attention-mark">'+uiIcon(stage==='pendente_estoque'?'alert':'clipboard',19)+'</span>'+
        '<span class="c-attention-info"><strong>Pedido '+h(order.code&&order.code!=='—'?'#'+order.code:'')+' · '+h(order.target||'Destino não informado')+'</strong>'+
        '<small>'+h(stageNames[stage]||'Pendente')+' · '+Number(order.total||0).toLocaleString('pt-BR')+' unidade(s)</small></span>'+
        uiIcon('chevron',17)+'</button>').join('')+'</div>':
        '<p class="c-dash-empty c-work-empty">Nenhum pedido pendente na fila neste momento.</p>')+'</div></section>':'';
  return '<div class="c-dashboard">'+
    '<div class="c-welcome"><span class="c-eyebrow">CENTRAL DE OPERAÇÕES</span>'+
    '<h1>Visão geral</h1><p>Estoque, pedidos e prioridades do centro de distribuição.</p></div>'+
    '<section class="c-hero" aria-label="Resumo das unidades no centro de distribuição"><div class="c-hero-main">'+
      '<span class="c-hero-label">'+uiIcon('package',19)+' Físico na central</span>'+
      '<strong class="c-hero-number">'+total.toLocaleString('pt-BR')+'</strong>'+
      '<span class="c-hero-sub">'+available.toLocaleString('pt-BR')+' disponíveis · '+
        reserved.toLocaleString('pt-BR')+' reservadas · '+eventTotal.toLocaleString('pt-BR')+' em lojas temporárias</span></div>'+
      '<div class="c-hero-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div></section>'+
    work+
    (canSeeProducts?'<section class="c-dashboard-section c-dashboard-tools"><div class="c-section-heading"><h2>Localizar produto</h2></div>'+
      '<div class="c-home-search">'+uiIcon('search',19)+
      '<input data-dashboard-product-query type="search" autocomplete="off" inputmode="search" placeholder="Nome, EAN, SKU ou variação" aria-label="Buscar produto pelo nome, EAN ou SKU">'+
      '<button type="button" data-action="dashboard-product-search">Buscar</button></div></section>':'')+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Acesso rápido</h2></div>'+
      '<div class="c-dashboard-actions">'+
      (canRegisterProducts()?'<button type="button" class="c-action-primary" data-action="product-new">'+uiIcon('plus',19)+' Novo produto</button>':'')+
      (hasPermission('stock.entry')?'<button type="button" class="c-action-outline" data-action="stock-receive-shipment">'+uiIcon('arrow-down-to-line',19)+' Receber remessa</button>':'')+
      '<button type="button" class="c-action-outline" data-action="global-scan">'+uiIcon('scan',19)+' Ler EAN</button>'+
      (canSeeOrders?'<button type="button" class="c-action-outline" data-action="view" data-view="pedidos">'+uiIcon('clipboard',19)+' Pedidos</button>':'')+
      (['admin','gerente'].includes(state.profile?.role)?
        '<button type="button" class="c-action-outline" data-action="open-tv">'+uiIcon('trend',19)+' Painel TV</button>':'')+
      '</div></section>'+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Indicadores da central</h2></div>'+
      '<div class="c-metric-grid">'+metrics.map(c=>
        '<div class="c-metric c-metric-'+c.tone+'"><div class="c-metric-icon">'+uiIcon(c.icon,20)+'</div>'+
        '<div class="c-metric-data"><span>'+h(c.label)+'</span><strong>'+c.value.toLocaleString('pt-BR')+'</strong>'+
        '<small>'+h(c.hint)+'</small></div></div>').join('')+'</div></section>'+
    (canSeeProducts?'<section class="c-dashboard-section c-dashboard-alerts"><div class="c-section-heading"><h2>Precisam de atenção</h2></div>'+
      '<div class="c-alert-list">'+
        '<button type="button" class="c-alert-link" data-action="dashboard-stock-shortage">'+
          uiIcon('alert',19)+'<span><strong>'+zero+' variação(ões) sem disponibilidade</strong>'+
          '<small>Consultar primeiro os menores estoques</small></span>'+uiIcon('chevron',17)+'</button>'+
        (hasPermission('purchases.manage')?'<button type="button" class="c-alert-link" data-action="view" data-view="compras">'+
          uiIcon('package',19)+'<span><strong>'+replenishments.length+' variação(ões) com sugestão de compra</strong>'+
          '<small>Considera estoque mínimo, reservas e mercadorias encomendadas</small></span>'+uiIcon('chevron',17)+'</button>':'')+
        (activeEvents&&permittedView('lojas')?'<button type="button" class="c-alert-link" data-action="view" data-view="lojas">'+
          uiIcon('calendar',19)+'<span><strong>'+activeEvents+' loja(s) temporária(s) ativa(s)</strong>'+
          '<small>Ver pedidos e devoluções das unidades</small></span>'+uiIcon('chevron',17)+'</button>':'')+
      '</div></section>':'')+
    (canSeeProducts?'<section class="c-dashboard-section c-dashboard-categories"><div class="c-section-heading"><h2>Categorias</h2>'+
      '<button type="button" data-action="view" data-view="produtos">Ver produtos '+uiIcon('chevron',17)+'</button></div>'+
      (categoryCards?'<div class="c-category-grid">'+categoryCards+'</div>':
        '<p class="c-dash-empty">Cadastre categorias para organizar os produtos.</p>')+'</section>':'')+
    '</div>';
}
