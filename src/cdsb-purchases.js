// CDSB: compras administrativas. Criar/imprimir pedidos não altera saldo nem reservas.
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n||0).toLocaleString('pt-BR');
const fmtDate=s=>s?new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
export function purchaseSuggestions(products,balances,reservations,orders=[],orderItems=[]){
 const stock=new Map(),held=new Map(),incoming=new Map();
 for(const b of balances)if(!b.event_id)stock.set(b.product_id,(stock.get(b.product_id)||0)+Number(b.quantity||0));
 for(const r of reservations)if(r.status==='ativa')held.set(r.product_id,(held.get(r.product_id)||0)+Number(r.quantity||0));
 const open=new Set(orders.filter(o=>o.status==='enviado').map(o=>o.id));
 for(const it of orderItems)if(open.has(it.purchase_order_id))
  incoming.set(it.product_id,(incoming.get(it.product_id)||0)+Number(it.quantity||0));
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
 const open=new Map((orders||[]).filter(o=>o.status==='enviado').map(o=>[o.id,o]));
 const pending=new Map();
 for(const it of items||[]){
  const order=open.get(it.purchase_order_id);if(!order)continue;
  const current=pending.get(it.product_id)||{quantity:0,dates:[],orders:[]};
  current.quantity+=Number(it.quantity||0);
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
 for(const p of products.filter(p=>p.active&&!p.force_archived_at)){
  const m=byModel.get(p.apparel_model_id);
  const key=m?'model:'+m.id:'product:'+p.id;
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
export function purchasesPage({products=[],models=[],suppliers=[],balances=[],reservations=[],orders=[],items=[],button,filter=''}) {
 const groups=purchasingGroups(products,models,balances,reservations,orders,items);
 const relevant=groups.filter(g=>!filter||g.supplier_id===filter);
 const below=groups.filter(g=>g.variants.some(p=>p.min_stock>0&&p.free<p.min_stock&&p.pending===0));
 const open=orders.filter(o=>['rascunho','enviado'].includes(o.status)).length;
 const noSupplier=groups.filter(g=>!g.supplier_id).length;
 const options='<option value="">Todos os fornecedores</option>'+
  suppliers.filter(s=>s.active).map(s=>'<option value="'+h(s.id)+'"'+(filter===s.id?' selected':'')+'>'+h(s.name)+'</option>').join('');
 const productCards=relevant.slice(0,150).map(g=>{
  const supplier=suppliers.find(s=>s.id===g.supplier_id)?.name||'Sem fornecedor';
  const image=g.photo?'<img data-photo-path="'+h(g.photo)+'" alt="Foto: '+h(g.title)+'" loading="lazy">':'<span class="buy-no-photo">Sem foto</span>';
  const cards=g.variants.map(p=>{
   const need=p.min_stock>p.free?Math.max(0,p.min_stock-p.free-p.pending):0;
   const warning=p.pending?'Encomendado: '+f(p.pending)+' un. · '+(p.pendingDate?'prev. '+fmtDate(p.pendingDate):'sem previsão'):
    (p.min_stock>0&&p.free<p.min_stock?'Abaixo do mínimo — avaliar histórico':'Estoque em avaliação');
   return '<div class="buy-variant"><div class="buy-variant-name"><strong>'+h(p.apparel_size||'Único')+'</strong>'+
    '<small>'+h([p.apparel_color!=='Única'?p.apparel_color:'',p.sku?'SKU '+p.sku:''].filter(Boolean).join(' · '))+'</small>'+
    '<small>'+h(warning)+'</small></div><div class="buy-variant-values"><span>Disponível <b>'+f(p.free)+'</b></span>'+
    '<span>Mínimo <b>'+f(p.min_stock)+'</b></span>'+
    '<span>Sugestão <b>'+f(need)+'</b></span></div></div>';
  }).join('');
  return '<article class="buy-group-card"><div class="buy-group-head"><div class="buy-group-photo">'+image+'</div>'+
   '<div class="buy-group-title"><h3>'+h(g.title)+'</h3><small>'+h(supplier)+' · '+g.variants.length+' variação(ões)</small>'+
   '<div class="buy-group-metrics"><span>Livre: <b>'+f(g.available)+'</b></span>'+
   '<span>Encomendado: <b>'+f(g.pending)+'</b></span></div></div></div>'+
   '<div class="buy-variants">'+cards+'</div><div class="buy-group-actions">'+
   button('Relatório de saídas','buy-product-report','data-group="'+h(g.key)+'"','small')+
   (g.supplier_id?button('Selecionar para compra','buy-new','data-supplier="'+h(g.supplier_id)+'"','small primary'):'')+
   '</div></article>';
 }).join('');
 const purchaseCards=orders.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,40).map(o=>{
  const supplier=suppliers.find(s=>s.id===o.supplier_id)?.name||'Fornecedor';
  const its=items.filter(i=>i.purchase_order_id===o.id);
  const total=its.reduce((n,i)=>n+Number(i.quantity||0),0);
  const status={rascunho:'Rascunho',enviado:'Encomendado',finalizado:'Concluído',cancelado:'Cancelado'}[o.status]||o.status;
  const overdue=o.status==='enviado'&&o.expected_arrival_date&&o.expected_arrival_date<new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  return '<article class="buy-order"><div><strong>PC-'+f(o.number)+' · '+h(supplier)+'</strong>'+
   '<small>'+f(its.length)+' SKU(s) · '+f(total)+' unidades · '+fmtDate(o.created_at)+'</small>'+
   '<small>Prazo: '+(o.estimated_days?f(o.estimated_days)+' dias corridos':'não informado')+
   ' · Previsão: '+fmtDate(o.expected_arrival_date)+(overdue?' · ATRASADO':'')+'</small></div>'+
   '<span class="buy-status">'+h(status)+'</span><div class="buy-order-actions">'+
   button('Baixar PDF','buy-print-order','data-id="'+h(o.id)+'"','small')+
   (['rascunho','enviado'].includes(o.status)?button('Alterar previsão','buy-eta-edit','data-id="'+h(o.id)+'"','small'):'')+
   (o.status==='rascunho'?button('Confirmar encomenda','buy-status','data-id="'+h(o.id)+'" data-status="enviado"','small primary'):'')+
   (o.status==='enviado'?button('Concluir recebimento','buy-status','data-id="'+h(o.id)+'" data-status="finalizado"','small'):'')+
   (['rascunho','enviado'].includes(o.status)?button('Cancelar','buy-status','data-id="'+h(o.id)+'" data-status="cancelado"','small danger'):'')+
   '</div></article>';
 }).join('');
 return '<div class="buy-page"><header class="pagehead"><div><h1>Compras</h1>'+
  '<p>Selecione variações, compare estoques e histórico logístico e acompanhe encomendas.</p></div>'+
  '<div class="actions">'+button('+ Pedido de compra','buy-new','','primary')+
  button('Fornecedores','buy-suppliers','','small')+'</div></header>'+
  '<div class="buy-stat-grid"><div><strong>'+f(below.length)+'</strong><span>Modelos abaixo do mínimo sem encomenda</span></div>'+
  '<div><strong>'+f(open)+'</strong><span>Compras em aberto</span></div>'+
  '<div><strong>'+f(noSupplier)+'</strong><span>Sem fornecedor</span></div></div>'+
  '<section class="panel"><header class="buy-section-head"><div><h2>Catálogo para reposição</h2>'+
  '<small>Estoque baixo não comprova demanda. Consulte as saídas antes de comprar.</small></div>'+
  button('Imprimir relatório','buy-print-alerts','','small')+'</header>'+
  '<div class="buy-filters"><label>Fornecedor <select data-buy-filter>'+options+'</select></label></div>'+
  '<div class="buy-group-grid">'+(productCards||'<p class="buy-empty">Nenhum produto neste filtro.</p>')+'</div></section>'+
  '<section class="panel"><header class="buy-section-head"><h2>Pedidos de compra</h2></header>'+
  (purchaseCards||'<p class="buy-empty">Nenhum pedido cadastrado.</p>')+'</section>'+
  '<p class="buy-note">Pedidos de compra não adicionam estoque físico. Apenas entradas confirmadas atualizam o saldo.</p></div>';
}
export function supplierListHTML(suppliers,button){
 return '<div class="supplier-list">'+suppliers.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>
  '<article class="supplier-row"><div><strong>'+h(s.name)+'</strong>'+
   '<small>'+h([s.contact_name,s.phone,s.email].filter(Boolean).join(' · '))+'</small>'+
   (!s.active?'<small>Inativo</small>':'')+'</div>'+
   button('Editar','buy-supplier-edit','data-id="'+h(s.id)+'"','small')+'</article>'
 ).join('')+'</div>';
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
