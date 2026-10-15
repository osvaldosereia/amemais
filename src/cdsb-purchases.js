// CDSB: compras administrativas. Criar/imprimir pedidos não altera saldo nem reservas.
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n||0).toLocaleString('pt-BR');
const fmtDate=s=>s?new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
export function purchaseSuggestions(products,balances,reservations,orders=[],orderItems=[]){
 const stock=new Map(),held=new Map(),incoming=new Map();
 for(const b of balances)if(!b.event_id)stock.set(b.product_id,(stock.get(b.product_id)||0)+Number(b.quantity||0));
 for(const r of reservations)if(r.status==='ativa')held.set(r.product_id,(held.get(r.product_id)||0)+Number(r.quantity||0));
 const open=new Set(orders.filter(o=>['rascunho','enviado'].includes(o.status)).map(o=>o.id));
 for(const it of orderItems)if(open.has(it.purchase_order_id))
  incoming.set(it.product_id,(incoming.get(it.product_id)||0)+Number(it.quantity||0));
 return products.filter(p=>p.active&&Number(p.min_stock||0)>0).map(p=>{
  const physical=stock.get(p.id)||0,reserved=held.get(p.id)||0,available=Math.max(0,physical-reserved);
  const ordered=incoming.get(p.id)||0,minimum=Number(p.min_stock)||0;
  const suggested=Math.max(0,minimum-available-ordered);
  return {...p,physical,reserved,available,ordered,minimum,suggested};
 }).filter(p=>p.suggested>0).sort((a,b)=>b.suggested-a.suggested||a.name.localeCompare(b.name,'pt-BR'));
}
export function purchasesPage({products=[],suppliers=[],balances=[],reservations=[],orders=[],items=[],button,filter=''}) {
 const suggestions=purchaseSuggestions(products,balances,reservations,orders,items);
 const relevant=filter?suggestions.filter(p=>p.supplier_id===filter):suggestions;
 const none=suggestions.filter(p=>!p.supplier_id);
 const pending=orders.filter(o=>['rascunho','enviado'].includes(o.status)).length;
 const choices='<option value="">Todos os fornecedores</option>'+
 suppliers.filter(s=>s.active).map(s=>'<option value="'+h(s.id)+'"'+(filter===s.id?' selected':'')+'>'+h(s.name)+'</option>').join('');
 const body=relevant.slice(0,120).map(p=>
  '<tr><td><strong>'+h(p.name)+'</strong><small>'+h([p.apparel_color,p.apparel_size,p.sku].filter(Boolean).join(' · '))+'</small></td>'+
  '<td>'+h(suppliers.find(s=>s.id===p.supplier_id)?.name||'Sem fornecedor')+'</td>'+
  '<td class="num">'+f(p.available)+'</td><td class="num">'+f(p.minimum)+'</td>'+
  '<td class="num">'+f(p.ordered)+'</td><td class="num"><strong>'+f(p.suggested)+'</strong></td></tr>').join('');
 const list=orders.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,25).map(o=>{
  const s=suppliers.find(x=>x.id===o.supplier_id);
  const count=items.filter(i=>i.purchase_order_id===o.id).reduce((n,x)=>n+Number(x.quantity||0),0);
  const status={rascunho:'Rascunho',enviado:'Enviado ao fornecedor',finalizado:'Finalizado',cancelado:'Cancelado'}[o.status]||o.status;
  return '<article class="buy-order"><div><strong>Compra #'+f(o.number)+'</strong><small>'+h(s?.name||'Fornecedor')+' · '+fmtDate(o.created_at)+' · '+f(count)+' unidades</small></div>'+
   '<span class="buy-status">'+status+'</span><div class="buy-order-actions">'+
   button('Imprimir','buy-print-order','data-id="'+h(o.id)+'"','small')+
   (o.status==='rascunho'?button('Marcar enviado','buy-status','data-id="'+h(o.id)+'" data-status="enviado"','small primary'):'')+
   (o.status==='enviado'?button('Finalizar','buy-status','data-id="'+h(o.id)+'" data-status="finalizado"','small'):'')+
   (['rascunho','enviado'].includes(o.status)?button('Cancelar','buy-status','data-id="'+h(o.id)+'" data-status="cancelado"','small danger'):'')+
   '</div></article>';
 }).join('');
 return '<div class="buy-page"><header class="pagehead"><div><h1>Compras</h1><p>Reposição orientada pelo estoque disponível e pelo mínimo de cada SKU.</p></div>'+
 '<div class="actions">'+button('+ Pedido de compra','buy-new','','primary')+
 button('Fornecedores','buy-suppliers','','small')+'</div></header>'+
 '<div class="buy-stat-grid"><div><strong>'+f(suggestions.length)+'</strong><span>SKUs abaixo do mínimo</span></div>'+
 '<div><strong>'+f(pending)+'</strong><span>Compras em aberto</span></div>'+
 '<div><strong>'+f(none.length)+'</strong><span>Sem fornecedor definido</span></div></div>'+
 '<section class="panel"><header class="buy-section-head"><div><h2>Sugestões de reposição</h2>'+
 '<small>Disponível = físico − reserva ativa. Compras abertas são consideradas para evitar pedidos duplicados.</small></div>'+
 button('Imprimir relatório','buy-print-alerts','','small')+'</header>'+
 '<div class="buy-filters"><label>Fornecedor <select data-buy-filter>'+choices+'</select></label></div>'+
 '<div class="buy-table-wrap"><table class="buy-table"><thead><tr><th>Produto / SKU</th><th>Fornecedor</th>'+
 '<th>Disponível</th><th>Mínimo</th><th>Em compra</th><th>Sugestão</th></tr></thead><tbody>'+
 (body||'<tr><td colspan="6">Nenhum produto abaixo do mínimo neste filtro.</td></tr>')+'</tbody></table></div></section>'+
 '<section class="panel"><header class="buy-section-head"><h2>Pedidos de compra</h2></header>'+
 (list||'<p class="buy-empty">Nenhum pedido de compra ainda. Monte um pedido por fornecedor.</p>')+
 '</section><p class="buy-note">Pedidos de compra não alteram estoque. Ao receber mercadorias, registre a entrada física na seção Produtos → Entrada.</p></div>';
}
export function supplierListHTML(suppliers,button){
 return '<div class="supplier-list">'+suppliers.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>
  '<article class="supplier-row"><div><strong>'+h(s.name)+'</strong>'+
   '<small>'+h([s.contact_name,s.phone,s.email].filter(Boolean).join(' · '))+'</small>'+
   (!s.active?'<small>Inativo</small>':'')+'</div>'+
   button('Editar','buy-supplier-edit','data-id="'+h(s.id)+'"','small')+'</article>'
 ).join('')+'</div>';
}
export function purchaseOrderRows(products,suppliers,balances,reservations,orders,items){
 const sugg=new Map(purchaseSuggestions(products,balances,reservations,orders,items).map(p=>[p.id,p]));
 return products.filter(p=>p.active&&p.supplier_id).map(p=>{
  const item=sugg.get(p.id),quantity=item?.suggested||0;
  return '<div class="buy-product-row" data-buy-product data-supplier="'+h(p.supplier_id)+'" data-search="'+
   h([p.name,p.sku,p.ean,p.apparel_size,p.apparel_color].filter(Boolean).join(' ').toLowerCase())+'">'+
   '<div><strong>'+h(p.name)+'</strong><small>'+h([p.apparel_color,p.apparel_size,p.sku].filter(Boolean).join(' · '))+
   (item?'<br>Sugestão '+f(item.suggested)+' · disponível '+f(item.available):'')+'</small></div>'+
   '<input type="number" min="0" max="1000000" step="1" inputmode="numeric" data-buy-quantity data-product="'+h(p.id)+'" value="'+quantity+'">'+
   '</div>';
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
