// CDSB: compras administrativas. Criar/imprimir pedidos não altera saldo nem reservas.
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n||0).toLocaleString('pt-BR');
const fmtDate=s=>s?new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(s))?s+'T12:00:00Z':s).toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
export function purchaseSuggestions(products,balances,reservations,orders=[],orderItems=[]){
 const stock=new Map(),held=new Map(),incoming=new Map();
 for(const b of balances)if(!b.event_id)stock.set(b.product_id,(stock.get(b.product_id)||0)+Number(b.quantity||0));
 for(const r of reservations)if(r.status==='ativa')held.set(r.product_id,(held.get(r.product_id)||0)+Number(r.quantity||0));
 const open=new Set(orders.filter(o=>['enviado','recebido_parcial'].includes(o.status)).map(o=>o.id));
 for(const it of orderItems)if(open.has(it.purchase_order_id))
  incoming.set(it.product_id,(incoming.get(it.product_id)||0)+Math.max(0,Number(it.quantity||0)-Number(it.received_quantity||0)));
 return products.filter(p=>p.active&&Number(p.min_stock||0)>0).map(p=>{
  const physical=stock.get(p.id)||0,reserved=held.get(p.id)||0,available=Math.max(0,physical-reserved);
  const ordered=incoming.get(p.id)||0,minimum=Number(p.min_stock)||0;
  const suggested=Math.max(0,minimum-available-ordered);
  return {...p,physical,reserved,available,ordered,minimum,suggested};
 }).filter(p=>p.suggested>0).sort((a,b)=>b.suggested-a.suggested||a.name.localeCompare(b.name,'pt-BR'));
}
// Apenas pedidos efetivamente encomendados são anunciados como "a caminho".
// Rascunhos não representam compromisso de aquisição, recebidos não são contabilizados.
export function purchasePendingByProduct(orders=[],items=[]){
 const open=new Map((orders||[]).filter(o=>['enviado','recebido_parcial'].includes(o.status)).map(o=>[o.id,o]));
 const pending=new Map();
 for(const it of items||[]){
  const order=open.get(it.purchase_order_id);if(!order)continue;
  const current=pending.get(it.product_id)||{quantity:0,dates:[],orders:[]};
  current.quantity+=Math.max(0,Number(it.quantity||0)-Number(it.received_quantity||0));
  if(order.expected_arrival_date)current.dates.push(order.expected_arrival_date);
  current.orders.push(order.number);
  pending.set(it.product_id,current);
 }
 return pending;
}
export function purchasingGroups(products=[],models=[],balances=[],reservations=[],orders=[],items=[]){
 const existing=purchasePendingByProduct(orders,items);
 const stock=new Map(),reserved=new Map(),groups=new Map();
 for(const x of balances||[])if(!x.event_id)stock.set(x.product_id,(stock.get(x.product_id)||0)+Number(x.quantity||0));
 for(const r of reservations||[])if(r.status==='ativa')reserved.set(r.product_id,(reserved.get(r.product_id)||0)+Number(r.quantity||0));
 const byModel=new Map(models.map(m=>[m.id,m]));
 const suppliersByModel=new Map();
 for(const p of products.filter(p=>p.active&&!p.force_archived_at&&p.apparel_model_id)){
  const set=suppliersByModel.get(p.apparel_model_id)||new Set();
  set.add(String(p.supplier_id||'sem-fornecedor'));suppliersByModel.set(p.apparel_model_id,set);
 }
 for(const p of products.filter(p=>p.active&&!p.force_archived_at)){
  const m=byModel.get(p.apparel_model_id);
  const splitSupplier=m&&suppliersByModel.get(m.id)?.size>1;
  const key=m?'model:'+m.id+(splitSupplier?':supplier:'+String(p.supplier_id||'sem-fornecedor'):''):'product:'+p.id;
  if(!groups.has(key))groups.set(key,{key,title:m?.name||p.name,photo:m?.image_path||p.image_path,
   supplier_id:p.supplier_id,variants:[],available:0,pending:0,minimum:0});
  const group=groups.get(key);
  const physical=stock.get(p.id)||0,free=Math.max(0,physical-(reserved.get(p.id)||0));
  const enroute=existing.get(p.id)||{quantity:0,dates:[],orders:[]};
  group.variants.push({...p,free,physical,pending:enroute.quantity,
   pendingDate:enroute.dates.slice().sort()[0]||null});
  group.available+=free;group.pending+=enroute.quantity;group.minimum+=Number(p.min_stock||0);
 }
 return [...groups.values()].sort((x,y)=>x.title.localeCompare(y.title,'pt-BR',{numeric:true}));
}

// Espelha a pesquisa e segmentação do catálogo de Produtos, preservando o modelo inteiro.
const buyNormalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('pt-BR').trim();
const buyGondolaKey=value=>buyNormalized(value).replace(/^gondola\s*[:#-]?\s*/,'')
 .replace(/^0+(?=[0-9])/,'').trim();
const buyCollator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
const buySortOptions=[
 ['priority','Prioridade de reposição'],['shortage','Maior necessidade de compra'],
 ['name-asc','Nome: A a Z'],['name-desc','Nome: Z a A'],
 ['available-desc','Maior estoque disponível'],['available-asc','Menor estoque disponível'],
 ['physical-desc','Maior estoque físico'],['physical-asc','Menor estoque físico'],
 ['gondola','Ordem das gôndolas'],['recent','Cadastrados recentemente']
];
function buyCategoryBranch(id,selected,byId){
 if(!selected)return true;
 let current=id;
 const seen=new Set();
 while(current&&!seen.has(String(current))){
  if(String(current)===String(selected))return true;
  seen.add(String(current));
  current=byId.get(String(current))?.parent_id;
 }
 return false;
}
function buyCategoryName(id,categories){
 if(!id)return 'Todas as categorias';
 const byId=new Map(categories.map(cat=>[String(cat.id),cat]));
 const names=[];const seen=new Set();
 let current=String(id);
 while(current&&!seen.has(current)){
  seen.add(current);
  const cat=byId.get(current);
  if(!cat)break;
  names.unshift(cat.name);
  current=cat.parent_id?String(cat.parent_id):'';
 }
 return names.join(' / ')||'Todas as categorias';
}
export function filterPurchaseGroups(groups=[],filters={},categories=[]){
 const q=buyNormalized(filters.search||'').split(/\s+/).filter(Boolean);
 const category=String(filters.category||''),tag=buyNormalized(filters.tag||'');
 const gondola=buyGondolaKey(filters.gondola||''),supplier=String(filters.supplier||'');
 const byId=new Map(categories.map(c=>[String(c.id),c]));
 const shortage=g=>g.variants.reduce((n,p)=>n+Math.max(0,Number(p.min_stock||0)-p.free-p.pending),0);
 const result=groups.filter(g=>{
  if(filters.onlyReplenishment&&shortage(g)===0)return false;
  if(filters.missingSupplier&&g.supplier_id)return false;
  if(supplier&&String(g.supplier_id||'')!==supplier)return false;
  // Só a relevância é filtrada; todas as variações permanecem no card correspondente.
  if(category&&!g.variants.some(p=>buyCategoryBranch(p.category_id||g.category_id,category,byId)))return false;
  if(tag&&!g.variants.some(p=>(p.tags||[]).some(t=>buyNormalized(t)===tag)))return false;
  if(gondola&&!g.variants.some(p=>buyGondolaKey(p.gondola)===gondola))return false;
  if(q.length&&!g.variants.some(p=>{
   const searchable=buyNormalized([
    g.title,p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira,...(p.tags||[])
   ].join(' '));
   return q.every(term=>searchable.includes(term));
  }))return false;
  return true;
 });
 const byName=(a,b)=>buyCollator.compare(a.title,b.title)||buyCollator.compare(a.key,b.key);
 const location=g=>g.variants.map(p=>buyGondolaKey(p.gondola)).filter(Boolean).sort(buyCollator.compare.bind(buyCollator))[0]||'';
 const physical=g=>g.variants.reduce((sum,p)=>sum+Number(p.physical||0),0);
 const recent=g=>g.variants.reduce((latest,p)=>String(p.created_at||'')>latest?String(p.created_at||''):latest,'');
 return result.sort((a,b)=>{
  switch(filters.sort){
   case 'priority':return Number(shortage(b)>0)-Number(shortage(a)>0)||shortage(b)-shortage(a)||byName(a,b);
   case 'shortage':return shortage(b)-shortage(a)||byName(a,b);
   case 'name-desc':return -byName(a,b);
   case 'available-desc':return b.available-a.available||byName(a,b);
   case 'available-asc':return a.available-b.available||byName(a,b);
   case 'physical-desc':return physical(b)-physical(a)||byName(a,b);
   case 'physical-asc':return physical(a)-physical(b)||byName(a,b);
   case 'recent':return recent(b).localeCompare(recent(a))||byName(a,b);
   case 'gondola':{
    const ga=location(a),gb=location(b);
    return (!ga&&gb)?1:(!gb&&ga)?-1:buyCollator.compare(ga,gb)||byName(a,b);
   }
   default:return byName(a,b);
  }
 });
}

export function purchasesPage({products=[],models=[],suppliers=[],categories=[],tags=[],balances=[],reservations=[],orders=[],items=[],button,filter='',catalog={},cart=new Map(),expanded=new Set(),tab='reposicao',tasksHTML='',orderFilter='',tasks=[]}) {
 const groups=purchasingGroups(products,models,balances,reservations,orders,items);
 const cartCount=[...cart.values()].reduce((n,q)=>n+(Number(q)||0),0);
 const cartSkus=cart.size;
 const cartSuppliers=new Set(products.filter(p=>cart.has(p.id)).map(p=>p.supplier_id).filter(Boolean)).size;
 const relevant=filterPurchaseGroups(groups,{...catalog,supplier:filter},categories);
 const filtersApplied=Boolean(catalog.search||catalog.category||catalog.tag||catalog.gondola||filter||catalog.missingSupplier);
 const shownCount=(Math.max(0,Number(catalog.page)||0)+1)*30;
 const visibleGroups=relevant.slice(0,shownCount);
 const more=relevant.length>visibleGroups.length;
 const gondolaOptions=new Map();
 for(const g of groups)for(const p of g.variants){
  const key=buyGondolaKey(p.gondola);
  if(key&&!gondolaOptions.has(key))gondolaOptions.set(key,'Gôndola '+String(p.gondola).trim()
   .replace(/^g[oô]ndola\s*[:#-]?\s*/i,''));
 }
 const optionsGondola=[...gondolaOptions].sort((a,b)=>buyCollator.compare(a[1],b[1]));
 const buySelect=(key,label,options)=>'<label class="catalog-filter-field"><span>'+label+'</span><select data-buy-catalog="'+key+'">'+
  options.map(([v,name])=>'<option value="'+h(v)+'"'+(String(catalog[key]||'')===String(v)?' selected':'')+'>'+h(name)+'</option>').join('')+
  '</select></label>';
 const below=groups.reduce((n,g)=>n+g.variants.filter(p=>Math.max(0,Number(p.min_stock||0)-p.free-p.pending)>0).length,0);
 const open=orders.filter(o=>['rascunho','enviado','recebido_parcial'].includes(o.status)).length;
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
 const overdueCount=orders.filter(o=>['enviado','recebido_parcial'].includes(o.status)&&o.expected_arrival_date&&o.expected_arrival_date<today).length;
 const noSupplier=groups.filter(g=>!g.supplier_id).length;
 const options='<option value="">Todos os fornecedores</option>'+
  suppliers.filter(s=>s.active).map(s=>'<option value="'+h(s.id)+'"'+(filter===s.id?' selected':'')+'>'+h(s.name)+'</option>').join('');
 const productCards=visibleGroups.map(g=>{
  const supplier=suppliers.find(s=>s.id===g.supplier_id)?.name||'Sem fornecedor';
  const gondolas=[...new Set(g.variants.map(p=>p.gondola).filter(Boolean))].slice(0,2).join(' · ');
  const categoryId=g.variants.find(p=>p.category_id)?.category_id;
  const categoryName=categories.find(c=>String(c.id)===String(categoryId))?.name||'—';
  const isExpanded=expanded.has(g.key);
  const commonAttrs='data-group="'+h(g.key)+'"';
  const image=g.photo?'<img data-photo-path="'+h(g.photo)+'" alt="Foto: '+h(g.title)+'" loading="lazy">':'<span class="buy-no-photo">Sem foto</span>';
  const picked=g.variants.filter(p=>cart.has(p.id));
  const pickedUnits=picked.reduce((sum,p)=>sum+Number(cart.get(p.id)||0),0);
  const cards=g.variants.map(p=>{
   const moq=Math.max(1,Number(p.minimum_order_quantity||1));
   const selected=cart.has(p.id),quantity=selected?Number(cart.get(p.id)):moq;
   return '<div class="buy-variant" data-buy-sku="'+h(p.id)+'" data-buy-group="'+h(g.key)+'">'+
    '<div class="buy-variant-pick"><label class="buy-variant-name">'+
    '<input type="checkbox" data-buy-inline-select data-product="'+h(p.id)+'"'+(selected?' checked':'')+''+
    ' aria-label="Selecionar tamanho '+h(p.apparel_size||'Único')+' do '+h(g.title)+'">'+
    '<span><strong>'+h(p.apparel_size||'Único')+'</strong>'+
    '<small>'+h([p.apparel_color!=='Única'?p.apparel_color:'',p.sku?'SKU '+p.sku:''].filter(Boolean).join(' · '))+'</small></span></label>'+
    '<div class="buy-variant-values"><span>Disponível <b>'+f(p.free)+'</b></span>'+
    '<span class="buy-moq">Pedido mínimo <b>'+f(moq)+'</b></span></div></div>'+
    '<div class="buy-inline-order"><label>Quantidade a pedir <input type="number" min="'+String(moq)+'" max="1000000" step="1"'+
    ' inputmode="numeric" data-buy-inline-qty data-product="'+h(p.id)+'" value="'+String(quantity)+'"'+
    (selected?'':' disabled')+' aria-label="Quantidade para tamanho '+h(p.apparel_size||'Único')+'"></label></div></div>';
  }).join('');
  const ico=(kind)=>{
   const paths={
    cart:'<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l2.6 12.5h12.9l2-9.5H5"/>',
    magic:'<path d="m4 20 12-12 4 4L8 24M15 3l1.5-1.5L18 3l1.5-1.5M4 6h4M6 4v4"/>',
    chart:'<path d="M3 21V9M8 21V13M13 21V5M18 21V10M22 21H2"/>'
   };
   return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';
  };
  const action=(text,actionName,kind,extra='',primary=false,disabled=false)=>
   '<button type="button" class="buy-card-action'+(primary?' is-primary':'')+'" data-action="'+actionName+'" '+
   commonAttrs+' '+extra+' aria-label="'+h(text)+'" title="'+h(text)+'"'+(disabled?' disabled':'')+'>'+
   ico(kind)+'<span class="buy-action-label">'+h(text)+'</span></button>';
  return '<article class="buy-group-card buy-quick-card" data-buy-card="'+h(g.key)+'">'+
   '<div class="buy-group-head"><div class="buy-group-photo">'+image+'</div>'+
    '<div class="buy-group-title"><h3>'+h(g.title)+'</h3>'+
      '<small>'+h(supplier)+' · '+g.variants.length+' variação(ões)'+(gondolas?' · Gôndola '+h(gondolas):'')+'</small>'+
      '<div class="buy-group-metrics"><span>Livre: <b>'+f(g.available)+'</b></span>'+
       '<span>Encomendado: <b>'+f(g.pending)+'</b></span>'+
      '</div></div>'+
    '<div class="buy-card-meta"><div><small>Fornecedor</small><strong>'+h(supplier)+'</strong></div>'+
     '<div><small>Categoria</small><strong>'+h(categoryName)+'</strong></div></div>'+
   '</div>'+
   '<div class="buy-card-toolbar" role="group" aria-label="Operações para '+h(g.title)+'">'+
     action(isExpanded?'Fechar compra':'Abrir compra','buy-open-group','cart',
      'aria-expanded="'+String(isExpanded)+'" aria-controls="buy-panel-'+h(g.key)+'"',true)+

     '<span class="buy-card-selected" data-buy-picked="'+h(g.key)+'" aria-live="polite">'+
      (pickedUnits?picked.length+' tamanho(s) · '+f(pickedUnits)+' un.':'Nenhuma variação selecionada')+'</span>'+
   '</div>'+
   '<details class="buy-variation-disclosure buy-one-panel" id="buy-panel-'+h(g.key)+'" data-buy-expand="'+h(g.key)+'"'+(isExpanded?' open':'')+'>'+
    '<summary class="buy-panel-accessible-summary">Variações, quantidades e histórico de saídas de '+h(g.title)+'</summary>'+
    '<div class="buy-panel-column-head" aria-hidden="true"><span>Tamanho / SKU</span><span>Disponível / pedido mínimo</span><span>Quantidade a pedir</span></div>'+
    '<div class="buy-variants">'+cards+'</div>'+
    '<section class="buy-panel-history" data-buy-outflow="'+h(g.key)+'" aria-live="polite">'+
      '<div class="buy-panel-history-head"><strong>Saídas do CD · últimos 90 dias</strong>'+
      '<small>Não equivalem necessariamente a vendas.</small></div>'+
      '<p class="buy-history-loading">Abra a compra para consultar o histórico.</p></section>'+
    '<div class="buy-panel-footer"><strong data-buy-panel-total="'+h(g.key)+'">'+
      (pickedUnits?picked.length+' tamanho(s) · '+f(pickedUnits)+' unidades':'Selecione as variações para montar o pedido')+
     '</strong>'+
     '<button type="button" class="button primary" data-action="buy-add-to-draft" data-group="'+h(g.key)+'" data-buy-panel-review="'+h(g.key)+'"'+(pickedUnits?'':' hidden')+'>Adicionar ao pedido</button>'+
    '</div>'+
   '</details></article>';
 }).join('');
 const purchaseCards=orders.filter(o=>orderFilter==='abertas'?['rascunho','enviado','recebido_parcial'].includes(o.status):orderFilter==='atrasadas'?['enviado','recebido_parcial'].includes(o.status)&&o.expected_arrival_date&&o.expected_arrival_date<today:true).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,40).map(o=>{
  const supplier=suppliers.find(s=>s.id===o.supplier_id)?.name||'Fornecedor';
  const its=items.filter(i=>i.purchase_order_id===o.id);
  const total=its.reduce((n,i)=>n+Number(i.quantity||0),0);
  const received=its.reduce((n,i)=>n+Number(i.received_quantity||0),0);
  const status={rascunho:'Rascunho',enviado:'Encomendado',recebido_parcial:'Recebido parcialmente',finalizado:'Recebido',cancelado:'Cancelado'}[o.status]||o.status;
  const overdue=['enviado','recebido_parcial'].includes(o.status)&&o.expected_arrival_date&&o.expected_arrival_date<new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  return '<article class="buy-order"><div><strong>PC-'+f(o.number)+' · '+h(supplier)+'</strong>'+
   '<small>'+f(its.length)+' SKU(s) · '+f(received)+' / '+f(total)+' unidades recebidas · '+fmtDate(o.created_at)+'</small>'+
   '<small>Prazo: '+(o.estimated_days?f(o.estimated_days)+' dias corridos':'não informado')+
   ' · Previsão: '+fmtDate(o.expected_arrival_date)+(overdue?' · ATRASADO':'')+'</small></div>'+
   '<span class="buy-status">'+h(status)+'</span><div class="buy-order-actions">'+
   button('Abrir pedido','buy-order-open','data-id="'+h(o.id)+'"','small primary')+
   (['enviado','recebido_parcial'].includes(o.status)?button('Conferir recebimento','buy-receive','data-id="'+h(o.id)+'"','small'):'')+
   (['rascunho','enviado'].includes(o.status)?button('Cancelar','buy-status','data-id="'+h(o.id)+'" data-status="cancelado"','small danger'):'')+
   '</div></article>';
 }).join('');
 return '<div class="buy-page"><header class="pagehead"><div><h1>Compras</h1>'+
  '<p>Selecione variações, compare estoques e histórico logístico e acompanhe encomendas.</p></div>'+
  '<div class="actions">'+button('Pedidos de compra','buy-tab','data-tab="pedidos"','primary')+
  button('Gerenciar fornecedores','buy-suppliers','','small')+'</div></header>'+
  '<nav class="buy-tabs" aria-label="Áreas de Compras">'+
  [['reposicao','Reposição'],['pedidos','Pedidos de compra'],['acompanhamento','Acompanhamento'],['fornecedores','Fornecedores']].map(([id,label])=>
  '<button type="button" data-action="buy-tab" data-tab="'+id+'" class="buy-tab'+(tab===id?' is-active':'')+'" aria-current="'+(tab===id?'page':'false')+'">'+label+'</button>').join('')+'</nav>'+
  '<div class="buy-stat-grid"><button type="button" data-action="buy-stat" data-stat="repor"><strong>'+f(below)+'</strong><span>Variações para repor</span></button>'+
  '<button type="button" data-action="buy-stat" data-stat="abertas"><strong>'+f(open)+'</strong><span>Compras em aberto</span></button>'+
  '<button type="button" data-action="buy-stat" data-stat="atrasadas"><strong>'+f(overdueCount)+'</strong><span>Compras atrasadas</span></button>'+ 
  '<button type="button" data-action="buy-stat" data-stat="sem-fornecedor"><strong>'+f(noSupplier)+'</strong><span>Modelos sem fornecedor</span></button></div>'+
  (tab==='reposicao'?'<section class="panel"><header class="buy-section-head"><div><h2>Catálogo para reposição</h2>'+
  '<small>Estoque baixo não comprova demanda. Consulte as saídas antes de comprar.</small></div>'+
  button('Relatório de reposição','buy-print-alerts','','small')+'</header>'+
  '<div class="product-toolbar-v3 buy-catalog-toolbar">'+
    '<div class="product-search-row">'+
      '<input id="buy-catalog-search" class="search" type="search" autocomplete="off"'+
      ' value="'+h(catalog.search||'')+'" placeholder="Buscar nome, EAN, SKU, cor ou gôndola…"'+
      ' aria-label="Buscar produtos para comprar"></div>'+
    '<div class="product-filter-row">'+
      '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="buy-filter" aria-haspopup="dialog">'+
        '<span>'+h(buyCategoryName(catalog.category,categories))+'</span><span aria-hidden="true">⌄</span></button>'+
      '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="buy-tag" aria-haspopup="dialog">'+
        '<span>'+h(catalog.tag||'Tags')+'</span><span aria-hidden="true">⌄</span></button></div>'+
    '<div class="catalog-sorting-row">'+
      buySelect('sort','Ordenar por',buySortOptions)+
      buySelect('gondola','Gôndola',[['','Todas as gôndolas'],...optionsGondola])+
      '<label class="catalog-filter-field"><span>Fornecedor</span><select data-buy-filter>'+options+'</select></label>'+
    '</div>'+
    '<div class="buy-filter-tools">'+
      '<label class="buy-only-toggle"><input type="checkbox" data-buy-only-replenishment'+(catalog.onlyReplenishment?' checked':'')+'> Somente itens para repor</label>'+
      '<span class="buy-result-count" aria-live="polite">'+relevant.length+' modelo(s) encontrado(s)</span>'+
      (filtersApplied?button('Limpar filtros','buy-clear-filters','','small'):'')+
    '</div>'+
   '</div>'+
  '<div class="buy-group-grid">'+(productCards||'<p class="buy-empty">Nenhum modelo corresponde à busca e aos filtros escolhidos.</p>')+'</div>'+
  (more?'<div class="buy-scroll-sentinel" data-buy-scroll-sentinel>'+
    '<span>Role para carregar mais produtos · '+visibleGroups.length+' de '+relevant.length+'</span>'+
    '<button type="button" data-action="buy-load-more" class="button small buy-scroll-fallback" hidden>Carregar mais 30</button>'+
   '</div>':'')+
  '</section>'+
  '' : '')+
  (tab==='pedidos'?'<section class="panel"><header class="buy-section-head"><div><h2>Pedidos de compra · fornecedores</h2><small>Pedidos feitos aos fornecedores, não às lojas ou franquias.</small></div>'+ (orderFilter?button('Ver todos','buy-orders-all','','small'):'')+'</header>'+
  (purchaseCards||'<p class="buy-empty">Nenhum pedido corresponde ao filtro selecionado.</p>')+'</section>':'')+
  (tab==='acompanhamento'?tasksHTML:'')+
  (tab==='fornecedores'?'<section class="panel"><header class="buy-section-head"><h2>Fornecedores</h2>'+button('Novo fornecedor','buy-supplier-new','','small primary')+'</header>'+supplierListHTML(suppliers,button,{products,orders,tasks})+'</section>':'')+
  '<p class="buy-note">Pedidos de compra de fornecedores são independentes dos pedidos das lojas. Somente recebimentos conferidos atualizam o estoque físico.</p></div>';
}
export function supplierListHTML(suppliers,button,{products=[],orders=[],tasks=[]}={}){
 return '<div class="supplier-list supplier-directory">'+suppliers.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>{
  const skus=products.filter(p=>p.supplier_id===s.id).length;
  const purchases=orders.filter(o=>o.supplier_id===s.id).length;
  const pendings=tasks.filter(t=>t.supplier_id===s.id&&['pendente','em_andamento'].includes(t.status)).length;
  const details=[s.contact_name,s.contact_role,s.phone,s.whatsapp,s.email].filter(Boolean).join(' · ');
  const terms=[s.delivery_days?'Entrega: '+s.delivery_days+' dias':'',
   s.payment_terms?'Pagamento: '+s.payment_terms:'',
   s.minimum_order_amount!=null?'Pedido mín.: R$ '+Number(s.minimum_order_amount).toLocaleString('pt-BR',{minimumFractionDigits:2}):'']
   .filter(Boolean);
  return '<article class="supplier-row supplier-directory-card"><div class="supplier-directory-info">'+
   '<strong>'+h(s.name)+'</strong>'+
   (s.legal_name&&s.legal_name!==s.name?'<small>'+h(s.legal_name)+'</small>':'')+
   (details?'<small>'+h(details)+'</small>':'')+
   '<div class="supplier-directory-metrics"><span>'+skus+' SKU(s)</span><span>'+purchases+' compra(s)</span>'+
    '<span>'+pendings+' tarefa(s)</span></div>'+
   (terms.length?'<small>'+h(terms.join(' · '))+'</small>':'')+
   (!s.active?'<small class="supplier-directory-inactive">Inativo</small>':'')+'</div>'+
   button('Editar','buy-supplier-edit','data-id="'+h(s.id)+'"','small')+'</article>';
 }).join('')+'</div>';
}
export function purchaseOrderRows(products,suppliers,balances,reservations,orders,items,models=[]){
 const groups=purchasingGroups(products,models,balances,reservations,orders,items).filter(g=>g.supplier_id);
 return groups.map(g=>{
  const search=h([g.title,...g.variants.flatMap(p=>[p.sku,p.ean,p.apparel_size,p.apparel_color])].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR'));
  const image=g.photo?'<img data-photo-path="'+h(g.photo)+'" alt="" loading="lazy">':'<span>▧</span>';
  return '<article class="buy-cart-group" data-supplier="'+h(g.supplier_id)+'" data-search="'+search+'">'+
   '<header><div class="buy-cart-photo">'+image+'</div><div><strong>'+h(g.title)+'</strong>'+
   '<small>'+g.variants.length+' variações · livre '+f(g.available)+' · encomendado '+f(g.pending)+'</small></div></header>'+
   g.variants.map(p=>{
    const suggestion=Math.max(0,Number(p.min_stock||0)-p.free-p.pending);
    return '<div class="buy-product-row" data-buy-product data-supplier="'+h(p.supplier_id)+'" data-search="'+search+'">'+
     '<label><input type="checkbox" data-buy-select aria-label="Selecionar '+h(p.apparel_size||p.name)+'">'+
     '<span><strong>'+h(p.apparel_size||'Único')+'</strong><small>SKU '+h(p.sku||'—')+
     ' · Livre '+f(p.free)+' · Mín. '+f(p.min_stock)+' · A caminho '+f(p.pending)+
     (suggestion?' · referência '+f(suggestion):'')+'</small></span></label>'+
     '<input type="number" min="1" max="1000000" step="1" inputmode="numeric" data-buy-quantity data-product="'+h(p.id)+'" value="'+Math.max(1,suggestion)+'" disabled aria-label="Quantidade para '+h(p.name)+' '+h(p.apparel_size||'')+'">'+
    '</div>';
   }).join('')+'</article>';
 }).join('');
}
export function purchaseOrderDocument(order,supplier,items){
 const title='Pedido de compra #'+f(order.number);
 const body=items.map((item,i)=>'<tr><td>'+String(i+1)+'</td><td>'+h(item.product_name)+'</td>'+
 '<td>'+h(item.sku||'—')+'</td><td>'+h(item.ean||'—')+'</td><td class="num">'+f(item.quantity)+'</td></tr>').join('');
 const total=items.reduce((n,i)=>n+Number(i.quantity||0),0);
 return printPage(title,
 '<div class="report-sub"><b>Fornecedor:</b> '+h(supplier?.name||'—')+
 '<div><b>Contato:</b> '+h(supplier?.contact_name||'—')+' · '+h(supplier?.phone||'—')+' · '+h(supplier?.email||'—')+'</div>'+
 '<div><b>Data:</b> '+fmtDate(order.created_at)+' · <b>Situação:</b> '+h(order.status)+'</div></div>'+
 '<table><thead><tr><th>#</th><th>Produto</th><th>SKU</th><th>EAN</th><th>Quantidade</th></tr></thead><tbody>'+body+'</tbody></table>'+
 '<p><strong>'+f(items.length)+' SKUs · '+f(total)+' unidades</strong></p>'+
 (order.note?'<p><b>Observações:</b> '+h(order.note)+'</p>':'')+
 '<div class="print-signatures"><span>Comprador / data</span><span>Fornecedor / data</span></div>'+
 '<p class="print-hint">Documento de compra. Não comprova entrada no estoque. O recebimento deve ser lançado no CDSB.</p>');
}
export function replenishmentDocument(suggestions,suppliers){
 const body=suggestions.map(p=>'<tr><td>'+h(p.name)+'</td><td>'+h([p.apparel_size,p.sku].filter(Boolean).join(' · '))+'</td>'+
 '<td>'+h(suppliers.find(s=>s.id===p.supplier_id)?.name||'SEM FORNECEDOR')+'</td>'+
 '<td class="num">'+f(p.available)+'</td><td class="num">'+f(p.minimum)+'</td>'+
 '<td class="num">'+f(p.ordered)+'</td><td class="num"><b>'+f(p.suggested)+'</b></td></tr>').join('');
 return printPage('Relatório de reposição · CDSB','<p>Produtos com estoque disponível abaixo do mínimo, já descontando compras abertas das sugestões.</p>'+
 '<table><thead><tr><th>Produto</th><th>Variação / SKU</th><th>Fornecedor</th><th>Livre</th><th>Mín.</th><th>Compra</th><th>Sugestão</th></tr></thead><tbody>'+body+'</tbody></table>'+
 '<p><strong>'+f(suggestions.length)+' SKUs com reposição sugerida.</strong></p>');
}
export function printPage(title,content){
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+h(title)+'</title>'+
 '<style>@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#1c2f23}'+
 'header{border-bottom:2px solid #176747;padding-bottom:9px;margin-bottom:18px}header small{color:#466351;font-size:9pt}'+
 'h1{font-size:16pt;margin:5px 0}table{border-collapse:collapse;width:100%;font-size:9pt}'+
 'td,th{border:1px solid #bfcfc2;padding:7px;text-align:left;overflow-wrap:anywhere}'+
 'thead{display:table-header-group}th{background:#e7f1ea}tr{break-inside:avoid}.num{text-align:right}'+
 '.report-sub{line-height:1.8;margin-bottom:16px}.print-signatures{display:flex;gap:24px;margin-top:48px}'+
 '.print-signatures span{flex:1;border-top:1px solid;padding-top:7px;text-align:center}'+
 '.print-hint{margin-top:25px;font-size:8pt;color:#59695d}</style></head><body>'+
 '<header><small>CDSB · CENTRO DE DISTRIBUIÇÃO SÃO BENTO</small><h1>'+h(title)+'</h1>'+
 '<small>Emissão '+new Date().toLocaleString('pt-BR')+'</small></header>'+content+
 '<script>window.addEventListener("load",()=>{window.focus();window.print()})</script></body></html>';
}
