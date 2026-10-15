// AME MAIS | Interface compacta para consignação, avarias e folha de separação A4.
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const format=n=>Number(n||0).toLocaleString('pt-BR');
export function eventPickingRows(items,models,planItems=[],qtyAvailable=()=>0){
 const quantities=new Map(planItems.map(row=>[row.product_id,Number(row.quantity)||0]));
 const modelById=new Map(models.map(x=>[x.id,x])),groups=new Map();
 for(const p of items.filter(p=>p.active||quantities.has(p.id))){
  const key=p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id;
  if(!groups.has(key))groups.set(key,{key,title:modelById.get(p.apparel_model_id)?.name||p.name,products:[]});
  groups.get(key).products.push({...p,planned:quantities.get(p.id)||0,available:qtyAvailable(p.id)});
 }
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'))
 .map(g=>({...g,products:g.products.sort((a,b)=>
    String(a.apparel_color||'').localeCompare(String(b.apparel_color||''),'pt-BR')||
    String(a.apparel_size||'').localeCompare(String(b.apparel_size||''),'pt-BR'))}));
}
export function eventPlanForm(groups,{h=esc,additional=false}={}){
 return '<p class="help">Busque pelo modelo, tamanho, SKU ou EAN. Quantidades podem ser alteradas antes de confirmar o envio.</p>'+
 '<div class="event-plan-search"><input type="search" class="search" data-plan-search placeholder="Buscar produto, tamanho ou EAN…" autocomplete="off" aria-label="Buscar na separação">'+
 '<button type="button" class="button" data-action="event-plan-scan">📷 Ler EAN</button></div>'+
 '<div class="event-plan-list">'+groups.map(group=>
  '<section class="event-plan-group" data-plan-group data-search="'+h([group.title,...group.products.flatMap(p=>[p.name,p.apparel_size,p.apparel_color,p.ean,p.sku])].join(' ').toLowerCase())+'">'+
    '<h3>'+h(group.title)+'</h3>'+group.products.map(p=>
      '<div class="event-plan-row" data-plan-row data-search="'+h([p.name,p.apparel_size,p.apparel_color,p.ean,p.sku].join(' ').toLowerCase())+'">'+
        '<div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
        '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small>'+
        '<small>Livre na central: <b>'+format(p.available)+'</b></small></div>'+
        '<label><span>Separar</span><input type="number" inputmode="numeric" min="0" max="1000000" step="1"'+
         ' data-plan-qty data-id="'+h(p.id)+'" value="'+(additional?0:p.planned||0)+'" aria-label="Quantidade de '+h(p.name)+'"></label>'+
      '</div>').join('')+'</section>').join('')+'</div>'+
 (additional?'<label class="field"><span>Motivo do complemento *</span><textarea name="reason" required maxlength="180" placeholder="Ex.: reposição adicional solicitada"></textarea></label>':'')+
 '<p class="help">Imprima a lista antes de confirmar a saída física. O envio é validado novamente contra o estoque livre.</p>';
}
export function eventSettlementForm(groups,balances,draft=null,{h=esc}={}){
 const counted=new Map((draft?.items||[]).map(x=>[x.product_id,x]));
 const qtyMap=new Map(balances.map(x=>[x.product_id,Number(x.quantity)||0]));
 return '<p class="help">Para cada tamanho, informe o destino de todas as unidades restantes. Avarias ficam em análise; só voltam ao estoque quando recuperadas.</p>'+
 '<div class="event-settle-groups">'+groups.map(g=>'<section class="event-settle-group">'+
 '<h3>'+h(g.title)+'</h3>'+g.products.filter(p=>(qtyMap.get(p.id)||0)>0).map(p=>{
  const expected=qtyMap.get(p.id)||0,prior=counted.get(p.id);
  const values=prior?.expected===expected?prior:null;
  return '<article class="event-settle-row" data-settle-row data-id="'+h(p.id)+'" data-expected="'+expected+'">'+
   '<header><div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
   '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small></div>'+
   '<span class="event-settle-expected">'+expected+' a conferir</span></header>'+
   '<div class="event-settle-fields">'+[
     ['good','Voltaram boas'],['sold','Vendidas'],['damaged','Avariadas'],['lost','Perdidas']
   ].map(([key,label])=>'<label><span>'+label+'</span><input data-settle-field="'+key+
    '" type="number" min="0" max="'+expected+'" step="1" inputmode="numeric" value="'+(values?values[key]||0:0)+'"></label>').join('')+'</div>'+
   '<div class="event-settle-foot"><small data-settle-remaining>Pendente: '+expected+'</small>'+
   '<button type="button" data-action="event-fill-sold">Marcar restante vendido</button></div>'+
  '</article>';
 }).join('')+'</section>').join('')+'</div>'+
 '<label class="field"><span>Justificativa de avarias / perdas (obrigatória quando houver)</span>'+
 '<textarea name="note" maxlength="250" placeholder="Ex.: duas camisetas com costura aberta">'+h(draft?.note||'')+'</textarea></label>'+
 '<div class="event-settle-summary" data-settle-summary aria-live="polite">Preencha a conferência de todos os tamanhos.</div>';
}
export function eventCompactDetail(data){
 const {event:e,members=[],plan=null,planItems=[],shipments=[],balances=[],movements=[],
  damageItems=[],closure=null,groupInventory,products=[],models=[],photoButton=()=>'',h=esc,
  button=()=>'',niceDate=x=>x,username=x=>x,canPlan=false,canClose=false,canManage=false}=data;
 const active=e.status==='ativo',draft=e.status==='rascunho',closed=e.status==='encerrado';
 const current=balances.filter(b=>b.event_id===e.id&&Number(b.quantity)>0);
 const pending=current.reduce((sum,b)=>sum+Number(b.quantity),0);
 const actualShipments=shipments.filter(row=>row.event_id===e.id);
 const shipped=actualShipments.length?actualShipments.reduce((sum,row)=>sum+(row.items||[])
   .reduce((n,item)=>n+Number(item.quantity||0),0),0):
   movements.filter(m=>m.event_id===e.id&&m.action==='transferencia')
   .reduce((sum,m)=>sum+Number(m.quantity||0),0);
 const planned=planItems.filter(x=>x.event_id===e.id).reduce((n,x)=>n+Number(x.quantity),0);
 const damaged=damageItems.filter(x=>x.origin_event_id===e.id)
   .reduce((n,x)=>n+Number(x.remaining||0),0);
 const groups=groupInventory(products.filter(p=>current.some(b=>b.product_id===p.id)),models);
 const status=draft?'Preparação':active?'Em operação':'Encerrada';
 const primary=draft?
   (canPlan?button(plan?'Editar separação':'Preparar mercadorias','event-plan','','primary')+
    (planned?button('Imprimir A4','event-print','','small')+
     button('Confirmar envio','event-dispatch','','primary'):''):''):
   active?(pending?
     (canClose?button('Conferir fechamento','event-settle','','primary'):'')+
     (canPlan?button('Enviar complemento','event-supplement','','small'):''):
     (canClose?button('Encerrar loja','event-close','data-id="'+h(e.id)+'"','primary'):'')+
     (canPlan?button('Enviar complemento','event-supplement','','small'):''))
     +(shipped?button('Imprimir A4','event-print','','small'):''):'';
 const summaries=draft?[['Para separar',planned],['Variações',planItems.filter(x=>x.event_id===e.id).length]]:
  [['Enviadas',closure?.sent_units??shipped],['No local',pending],['Avariadas em análise',damaged]];
 const responsible=members.filter(x=>x.event_id===e.id&&x.role==='responsavel').map(x=>username(x.user_id)).join(', ')||'Não informado';
 const productsMarkup=groups.length?groups.map(g=>{
  const count=g.products.reduce((n,p)=>n+Number(current.find(b=>b.product_id===p.id)?.quantity||0),0);
  return '<details class="event-product-compact"><summary><div class="event-product-thumb">'+photoButton(g.main)+'</div>'+
    '<div><strong>'+h(g.title)+'</strong><small>'+g.products.length+' tamanho(s) pendente(s)</small></div>'+
    '<b>'+format(count)+' un.</b><span aria-hidden="true">▾</span></summary>'+
    '<div class="event-product-variants">'+g.products.map(p=>'<div><span>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+
      '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small></span>'+
      '<b>'+format(current.find(b=>b.product_id===p.id)?.quantity||0)+' un.</b></div>').join('')+'</div></details>';
 }).join(''):'<p class="muted">'+(draft?'Defina as quantidades de cada tamanho na separação.':'Nenhuma unidade pendente no local.')+'</p>';
 return '<div class="event-simple">'+
 '<button type="button" class="event-back" data-action="back-events">← Lojas temporárias</button>'+
 '<header class="event-simple-head"><div><h1>'+h(e.name)+'</h1>'+
 '<p>'+h(niceDate(e.starts_at))+(e.ends_at?' a '+h(niceDate(e.ends_at)):'')+
 ' · Responsável: '+h(responsible)+'</p></div><span class="event-simple-status">'+status+'</span></header>'+
 '<div class="event-step-strip"><span class="'+(draft?'active':'done')+'">1. Separação</span>'+
 '<span class="'+(active?'active':closed?'done':'')+'">2. Envio</span>'+
 '<span class="'+(closed?'done':'')+'">3. Fechamento</span></div>'+
 '<div class="event-simple-metrics">'+summaries.map(([name,v])=>'<div><small>'+h(name)+'</small><strong>'+format(v)+'</strong></div>').join('')+'</div>'+
 '<div class="event-simple-actions">'+primary+'</div>'+
 (draft?'<p class="event-simple-guidance">Monte sua lista, imprima em A4, confira o que foi encontrado e ajuste as quantidades antes de confirmar a saída física.</p>':
  active&&pending?'<p class="event-simple-guidance">Na volta, informe quantos produtos retornaram bons, foram vendidos, ficaram avariados ou foram perdidos. O sistema só encerra quando tudo estiver conciliado.</p>':'')+
 (active&&pending?'<section class="event-simple-section"><header><h2>Produtos ainda no local</h2><small>'+pending+' unidades pendentes</small></header>'+productsMarkup+'</section>':
 draft?'<section class="event-simple-section"><header><h2>Lista de separação</h2><small>'+planned+' unidades previstas</small></header>'+
 (planItems.filter(x=>x.event_id===e.id).length?
  planItems.filter(x=>x.event_id===e.id).map(x=>{
   const p=products.find(p=>p.id===x.product_id);
   return '<div class="event-plan-preview"><span>'+h(p?.name||'Produto')+
   ' · '+h([p?.apparel_color,p?.apparel_size].filter(Boolean).join(' / '))+
   '<small>SKU '+h(p?.sku||'—')+'</small></span><strong>'+x.quantity+' un.</strong></div>';
  }).join(''):productsMarkup)+'</section>':'')+
 (closed?'<div class="event-simple-guidance">Prestação de contas encerrada. Os saldos e o histórico foram preservados.</div>':'')+
 '<details class="event-simple-secondary"><summary>Equipe e informações da loja</summary>'+
 '<div class="event-team-list">'+members.filter(m=>m.event_id===e.id).map(m=>
 '<div><span>'+h(username(m.user_id))+' · '+h(m.role)+'</span>'+
 (canManage&&!closed?button('Remover','member-remove','data-user="'+h(m.user_id)+'" data-event="'+h(e.id)+'"','small'):'')+
 '</div>').join('')+'</div>'+
 (canManage&&!closed?button('+ Adicionar responsável / operador','member-add','data-id="'+h(e.id)+'"','small'):'')+
 (e.notes?'<p>'+h(e.notes)+'</p>':'')+'</details>'+
 '<details class="event-simple-secondary"><summary>Histórico e rastreabilidade</summary>'+
 '<div class="event-audit-list">'+movements.filter(m=>m.event_id===e.id).slice(0,80).map(m=>
 '<div><span>'+h(products.find(p=>p.id===m.product_id)?.name||'SKU')+
 ' · '+h(m.action)+' <small>'+h(m.note||'')+'</small></span><strong>'+m.quantity+' un.</strong></div>').join('')+
 '</div></details></div>';
}
export function damageListHTML(damages,products,events,actions=[],{h=esc,button=()=>''}={}){
 const open=damages.filter(d=>Number(d.remaining)>0),closed=damages.filter(d=>Number(d.remaining)===0);
 const card=d=>{const p=products.find(p=>p.id===d.product_id),event=events.find(x=>x.id===d.origin_event_id);
 return '<article class="damage-item"><div><strong>'+h(p?.name||'SKU')+'</strong>'+
 '<small>'+h([p?.apparel_color,p?.apparel_size].filter(Boolean).join(' · '))+
 ' · '+h(event?'Origem: '+event.name:'Origem: central')+'</small>'+
 '<small>'+h(d.note)+'</small></div><div class="damage-item-result">'+
 '<strong>'+d.remaining+' em análise</strong><small>Inicial '+d.quantity+
 ' · Recuperado '+d.recovered+' · Descartado '+d.discarded+'</small>'+
 (d.remaining>0?button('Resolver','damage-resolve','data-id="'+h(d.id)+'"','small primary'):'')+'</div></article>';};
 return '<header class="pagehead"><div><h1>Produtos em análise</h1>'+
 '<p>Avarias fora do estoque disponível até recuperação ou descarte.</p></div>'+
 '<div class="actions">'+button('← Produtos','view','data-view="produtos"','small')+'</div></header>'+
 '<div class="event-simple-metrics"><div><small>Unidades em análise</small><strong>'+
 format(open.reduce((n,d)=>n+Number(d.remaining),0))+'</strong></div><div><small>Ocorrências abertas</small><strong>'+open.length+'</strong></div></div>'+
 '<section class="event-simple-section"><header><h2>Aguardando decisão</h2></header>'+
 (open.length?open.map(card).join(''):'<p class="muted">Nenhuma avaria pendente.</p>')+'</section>'+
 (closed.length?'<details class="event-simple-secondary"><summary>Ocorrências resolvidas ('+closed.length+')</summary>'+
 closed.map(card).join('')+'</details>':'');
}
export function a4PickingHTML({event,items=[],products=[],models=[],responsible='',version='',
 printedAt='',status='Planejado'}){
 const byId=new Map(products.map(p=>[p.id,p])),byModel=new Map(models.map(m=>[m.id,m])),groups=new Map();
 for(const x of items){
  if(!x.quantity||x.quantity<1)continue;
  const p=byId.get(x.product_id);if(!p)continue;
  const key=p.apparel_model_id||p.id;
  if(!groups.has(key))groups.set(key,{name:byModel.get(p.apparel_model_id)?.name||p.name,rows:[]});
  groups.get(key).rows.push({p,qty:x.quantity});
 }
 const sections=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const total=items.reduce((n,x)=>n+Number(x.quantity||0),0);
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
 '<title>Lista de separação - '+esc(event.name)+'</title>'+
 '<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1c3528;font-size:10.5pt}'+
 'header{display:flex;justify-content:space-between;border-bottom:2px solid #166b4b;padding-bottom:10px;margin-bottom:12px}'+
 'h1{font-size:16pt;margin:4px 0}h2{font-size:11pt;background:#eaf3ed;padding:6px;margin:13px 0 5px}'+
 '.brand{font-size:19pt;color:#166b4b;font-weight:800}.meta{line-height:1.5;text-align:right}'+
 'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #bacdc0;padding:7px 6px;text-align:left;word-break:break-word}'+
 'th{background:#f0f5f1;font-size:9pt}.center{text-align:center}.hand{min-width:48px;height:28px}.group{break-inside:avoid-page}'+
 '.summary{margin:12px 0;padding:8px;border:1px solid #b5cfc0;background:#f4faf6}'+
 '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:37px}.sign{border-top:1px solid #71897a;padding-top:5px;text-align:center}'+
 '.subtitle{font-size:9pt;color:#536b5b}.pagefooter{font-size:8pt;color:#6e8374;margin-top:16px}'+
 '@media screen{body{width:190mm;margin:12mm auto}}@media print{.no-print{display:none}}</style></head><body>'+
 '<header><div><div class="brand">AME+ STORE</div><h1>LISTA DE SEPARAÇÃO</h1>'+
 '<div class="subtitle">Conferência física antes do envio</div></div>'+
 '<div class="meta"><b>'+esc(event.name)+'</b><div>Início: '+esc(event.starts_at)+
 (event.ends_at?' · Fim: '+esc(event.ends_at):'')+'</div><div>Responsável: '+esc(responsible||'—')+
 '</div><div>Data da impressão: '+esc(printedAt)+'</div><div>'+esc(status)+' · '+esc(version)+'</div></div></header>'+
 sections.map(g=>'<section class="group"><h2>'+esc(g.name)+'</h2><table><thead><tr>'+
 '<th style="width:14%">Tamanho / cor</th><th style="width:20%">SKU</th><th style="width:27%">EAN</th>'+
 '<th class="center" style="width:13%">Previsto</th><th class="center" style="width:13%">Separado</th>'+
 '<th class="center" style="width:13%">Conf.</th></tr></thead><tbody>'+
 g.rows.map(x=>'<tr><td>'+esc([x.p.apparel_size,x.p.apparel_color].filter(Boolean).join(' · ')||'Único')+
 '</td><td>'+esc(x.p.sku||'—')+'</td><td>'+esc(x.p.ean||'—')+'</td>'+
 '<td class="center"><b>'+x.qty+'</b></td><td class="hand"></td><td class="center">□</td></tr>').join('')+
 '</tbody></table></section>').join('')+
 '<div class="summary"><b>Total previsto: '+total+' unidades · '+items.length+' variações</b>'+
 '<p>Observações / divergências: _______________________________________________________________</p></div>'+
 '<div class="signatures"><div class="sign">Separado por · Data / hora</div>'+
 '<div class="sign">Conferido por · Data / hora</div></div>'+
 '<div class="pagefooter">Ao encontrar divergências, atualize a separação no sistema antes de confirmar o envio.</div>'+
 '<script>window.addEventListener("load",()=>{window.focus();window.print()});<\/script></body></html>';
}
