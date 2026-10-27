// AME MAIS | Interface compacta para consignação, avarias e folha de separação A4.
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const format=n=>Number(n||0).toLocaleString('pt-BR');
export function eventPickingRows(items,models,planItems=[],qtyAvailable=()=>0){
 const quantities=new Map(planItems.map(row=>[row.product_id,Number(row.quantity)||0]));
 const modelById=new Map(models.map(x=>[x.id,x])),groups=new Map();
 for(const p of items.filter(p=>p.active||quantities.has(p.id))){
  const key=p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id;
  if(!groups.has(key))groups.set(key,{key,title:modelById.get(p.apparel_model_id)?.name||p.name,products:[]});
  const availability=qtyAvailable(p.id);
  const stock=availability&&typeof availability==='object'?availability:{total:Number(availability)||0,label:''};
  groups.get(key).products.push({...p,planned:quantities.get(p.id)||0,
   available:Number(stock.total)||0,availabilityLabel:String(stock.label||'')});
 }
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'))
 .map(g=>({...g,products:g.products.sort((a,b)=>
    String(a.apparel_color||'').localeCompare(String(b.apparel_color||''),'pt-BR')||
    String(a.apparel_size||'').localeCompare(String(b.apparel_size||''),'pt-BR'))}));
}
export function eventPlanForm(groups,{h=esc,additional=false,showAvailable=true}={}){
 return '<p class="help">Busque pelo modelo, tamanho, SKU ou EAN. Quantidades podem ser alteradas antes de confirmar o envio.</p>'+
 '<div class="event-plan-search"><input type="search" class="search" data-plan-search placeholder="Buscar produto, tamanho ou EAN…" autocomplete="off" aria-label="Buscar na separação">'+
 '<button type="button" class="button" data-action="event-plan-scan">📷 Ler EAN</button></div>'+
 '<div class="event-plan-list">'+groups.map(group=>
  '<section class="event-plan-group" data-plan-group data-search="'+h([group.title,...group.products.flatMap(p=>[p.name,p.apparel_size,p.apparel_color,p.ean,p.sku])].join(' ').toLowerCase())+'">'+
    '<h3>'+h(group.title)+'</h3>'+group.products.map(p=>
      '<div class="event-plan-row" data-plan-row data-search="'+h([p.name,p.apparel_size,p.apparel_color,p.ean,p.sku].join(' ').toLowerCase())+'">'+
        '<div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
        '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small>'+
        (showAvailable?'<small>'+h(p.availabilityLabel||('Livre no CDSB: '+format(p.available)))+'</small>':'')+'</div>'+
        '<label><span>Separar</span><input type="number" inputmode="numeric" min="0" max="1000000" step="1"'+
         ' data-plan-qty data-id="'+h(p.id)+'" value="'+(additional?0:p.planned||0)+'" aria-label="Quantidade de '+h(p.name)+'"></label>'+
      '</div>').join('')+'</section>').join('')+'</div>'+
 (additional?'<label class="field"><span>Motivo do complemento *</span><textarea name="reason" required maxlength="180" placeholder="Ex.: reposição adicional solicitada"></textarea></label>':'')+
 '<p class="help">Ao salvar, o pedido entra na seção Pedidos. A impressão em A4 e a saída física são feitas ali, uma remessa por vez.</p>';
}
export function eventSettlementForm(groups,balances,draft=null,{h=esc,sources=[],stores=[]}={}){
 const counted=new Map((draft?.items||[]).map(x=>[x.product_id,x]));
 const qtyMap=new Map(balances.map(x=>[x.product_id,Number(x.quantity)||0]));
 const storeById=new Map(stores.map(x=>[x.id,x]));
 const originText=productId=>{
  const remaining=sources.filter(x=>x.product_id===productId&&Number(x.remaining_quantity)>0);
  if(!remaining.length)return 'Origem não identificada';
  const grouped=new Map();
  for(const row of remaining){
   const store=storeById.get(row.source_store_id);
   const label=row.source_store_id?(store?.is_primary?'CD':store?.name||'Loja de origem'):'Origem não identificada (retorno ao CD)';
   grouped.set(label,(grouped.get(label)||0)+Number(row.remaining_quantity||0));
  }
  return [...grouped].map(([label,qty])=>label+' '+qty).join(' · ');
 };
 return '<p class="help">O CDSB controla somente o que enviou e o que retornou. Informe devoluções, avarias e quantidades não devolvidas. Não registramos vendas.</p>'+
 '<div class="event-settle-groups">'+groups.map(g=>'<section class="event-settle-group">'+
 '<h3>'+h(g.title)+'</h3>'+g.products.filter(p=>(qtyMap.get(p.id)||0)>0).map(p=>{
  const expected=qtyMap.get(p.id)||0,prior=counted.get(p.id);
  const values=prior?.expected===expected?prior:null;
  return '<article class="event-settle-row" data-settle-row data-id="'+h(p.id)+'" data-expected="'+expected+'">'+
   '<header><div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
   '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small>'+
   '<small>Origem para devolução: '+h(originText(p.id))+'</small></div>'+
   '<span class="event-settle-expected">'+expected+' a conferir</span></header>'+
   '<div class="event-settle-fields">'+[
     ['good','Devolvidas boas'],['damaged','Avariadas'],['lost','Não devolvidas']
   ].map(([key,label])=>'<label><span>'+label+'</span><input data-settle-field="'+key+
    '" type="number" min="0" max="'+expected+'" step="1" inputmode="numeric" value="'+(values?values[key]||0:0)+'"></label>').join('')+'</div>'+
   '<div class="event-settle-foot"><small data-settle-remaining>Pendente: '+expected+'</small>'+
   '<small>Não devolvidas não são classificadas como vendas.</small></div>'+
  '</article>';
 }).join('')+'</section>').join('')+'</div>'+
 '<label class="field"><span>Justificativa para avarias ou diferenças não devolvidas (obrigatória)</span>'+
 '<textarea name="note" maxlength="250" placeholder="Ex.: 2 peças avariadas e 3 não devolvidas pelo evento">'+h(draft?.note||'')+'</textarea></label>'+
 '<div class="event-settle-summary" data-settle-summary aria-live="polite">Preencha a conferência de todos os tamanhos.</div>';
}
export function eventCompactDetail(data){
 const {event:e,members=[],balances=[],movements=[],damageItems=[],closure=null,
   products=[],models=[],groupInventory=()=>[],h=esc,button=()=>'',
   niceDate=x=>x,username=x=>x,canManage=false,canClose=false,canSettle=false,
   canDelete=false,ordersMarkup='',openOrders=0,tab='resumo'}=data;
 const active=e.status==='ativo',draft=e.status==='rascunho',closed=e.status==='encerrado';
 const local=balances.filter(b=>b.event_id===e.id&&Number(b.quantity)>0);
 const pending=local.reduce((s,b)=>s+Number(b.quantity||0),0);
 const damaged=damageItems.filter(x=>x.origin_event_id===e.id).reduce((s,d)=>s+Number(d.remaining||0),0);
 const status=draft?'Preparação':closed?'Encerrada':pending?'Em operação':'Em operação';
 const tabs={resumo:'Visão geral',pedidos:'Pedidos',mercadorias:'Mercadorias',
  fechamento:'Fechamento',equipe:'Equipe',historico:'Histórico'};
 const current=Object.hasOwn(tabs,tab)?tab:'resumo';
 const title=(t,actions='')=>'<div class="su-section-header"><h2>'+t+'</h2>'+actions+'</div>';
 const orderTab=button('Ver pedidos da loja','event-unit-tab','data-tab="pedidos"','small');
 const productsHtml=()=>{
  if(!local.length)return '<p class="su-empty">Nenhuma mercadoria com saldo físico nesta loja temporária.</p>';
  const groups=groupInventory(products.filter(p=>local.some(b=>b.product_id===p.id)),models);
  if(!groups.length)return '<div class="su-data-list">'+local.map(b=>
   '<div><span>'+h(products.find(p=>p.id===b.product_id)?.name||'Produto')+'</span><strong>'+
   format(b.quantity)+' un.</strong></div>').join('')+'</div>';
  return groups.map(g=>'<details class="event-product-compact"><summary><div class="event-product-thumb">'+
     (typeof data.photoButton==='function'?data.photoButton(g.main):'')+'</div>'+
     '<div><strong>'+h(g.title)+'</strong><small>Variações e quantidades no local</small></div>'+
     '<b>'+format(g.products.reduce((s,p)=>s+Number(local.find(b=>b.product_id===p.id)?.quantity||0),0))+' un.</b><span aria-hidden="true">▾</span></summary>'+
     '<div class="event-product-variants">'+g.products.filter(p=>local.some(b=>b.product_id===p.id)).map(p=>
      '<div><span>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+
      '<small>SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</small></span><b>'+
      format(local.find(b=>b.product_id===p.id)?.quantity||0)+' un.</b></div>').join('')+'</div></details>').join('');
 };
 let panel='';
 if(current==='resumo'){
  panel=title('Visão geral')+
    '<p class="su-next">'+(closed?'Loja encerrada. O histórico de pedidos e de movimentações foi preservado.':
      draft?'Loja em preparação. Crie pedidos independentes para enviar mercadorias à fila do CDSB.':
      pending?'Existem '+format(pending)+' unidade(s) fisicamente no local. Confira as devoluções quando retornarem.':
      'Não há mercadorias pendentes de retorno. Verifique pedidos e fechamento.')+'</p>'+
    title('Pedidos e mercadorias',orderTab)+
    '<div class="su-data-list"><div><span>Estoque físico no local</span><strong>'+format(pending)+' un.</strong></div>'+
    '<div><span>Avarias em análise</span><strong>'+format(damaged)+' un.</strong></div></div>';
 }else if(current==='pedidos'){
  panel=title('Pedidos independentes desta loja')+(ordersMarkup||'<p class="su-empty">Nenhum pedido criado para esta loja.</p>');
 }else if(current==='mercadorias'){
  panel=title('Mercadorias atualmente no local')+productsHtml();
 }else if(current==='fechamento'){
  panel=title('Conciliação logística')+
   '<p class="su-next">Controle apenas devolvidas boas, avariadas e não devolvidas. O CDSB não registra vendas.</p>'+
   '<div class="su-data-list"><div><span>Saldo físico a conciliar</span><strong>'+format(pending)+' un.</strong></div>'+
   '<div><span>Avariadas em análise</span><strong>'+format(damaged)+' un.</strong></div></div>'+
   (closed?'<p class="su-empty">Fechamento concluído e histórico preservado.</p>':
    active&&pending?(canSettle?button('Conferir devolução','event-settle','','primary')+
      '<p class="su-pending">Conclua a conciliação por produto antes de encerrar a unidade.</p>':
      '<p class="su-pending">Há mercadorias a conciliar. Solicite a conferência a um responsável autorizado.</p>'):
    active&&openOrders>0?'<p class="su-pending">'+format(openOrders)+' pedido'+(openOrders===1?'':'s')+' pendente'+(openOrders===1?'':'s')+' de expedição ou cancelamento. Resolva antes de encerrar a loja.</p>':
    active&&canClose?button('Encerrar loja','event-close','data-id="'+h(e.id)+'"','primary'):
    '<p class="su-empty">Aguardando início da operação ou autorização para encerramento.</p>');
 }else if(current==='equipe'){
  panel=title('Equipe e responsáveis')+'<div class="su-data-list">'+
   (members.filter(m=>m.event_id===e.id).length?members.filter(m=>m.event_id===e.id).map(m=>
    '<div><span>'+h(username(m.user_id))+' · '+h(m.role)+'</span>'+
    (canManage&&!closed?button('Remover','member-remove','data-user="'+h(m.user_id)+'" data-event="'+h(e.id)+'"','small'):'')+
    '</div>').join(''):'<p class="su-empty">Nenhum operador vinculado.</p>')+'</div>'+
   (canManage&&!closed?button('+ Adicionar responsável / operador','member-add','data-id="'+h(e.id)+'"','small'):'');
 }else{
  panel=title('Histórico e rastreabilidade')+
   (movements.filter(m=>m.event_id===e.id).length?'<div class="su-data-list">'+
   movements.filter(m=>m.event_id===e.id).slice(0,80).map(m=>
    '<div><span>'+h(products.find(p=>p.id===m.product_id)?.name||'Produto')+' · '+
     h(m.action)+'<small>'+h(m.note||'')+'</small></span><strong>'+format(m.quantity)+' un.</strong></div>').join('')+
   '</div>':'<p class="su-empty">Nenhuma movimentação registrada.</p>');
 }
 const mainAction=canManage&&!closed?button(e.cover_path?'Trocar capa':'Adicionar capa','event-cover-edit','data-id="'+h(e.id)+'"','small'):'';
 const canDeleteOption=canDelete?button('Excluir cadastro','event-delete','data-id="'+h(e.id)+'"','small danger'):'';
 const responsible=members.filter(m=>m.event_id===e.id&&m.role==='responsavel').map(m=>username(m.user_id)).join(', ')||'Não informado';
 return '<div class="event-simple su-page event-unit-page">'+
  '<button type="button" class="event-back" data-action="back-events">← Lojas</button>'+
  '<header class="event-simple-head su-header"><div><h1>'+h(e.name)+'</h1>'+
    '<p>'+h(niceDate(e.starts_at))+(e.ends_at?' a '+h(niceDate(e.ends_at)):'')+
    ' · Responsável: '+h(responsible)+'</p></div><span class="event-simple-status">'+status+'</span></header>'+
  '<div class="su-overview"><div><small>Saldo físico no local</small><strong>'+format(pending)+' un.</strong></div>'+
  '<div><small>Avariadas em análise</small><strong>'+format(damaged)+' un.</strong></div>'+
  '<div><small>Estado da loja</small><strong class="su-compact-state">'+status+'</strong></div></div>'+
  '<div class="su-tabs" role="tablist" aria-label="Administrar loja temporária">'+
   Object.entries(tabs).map(([key,label])=>'<button type="button" role="tab" data-action="event-unit-tab" data-tab="'+key+
    '" class="'+(key===current?'is-current':'')+'" aria-selected="'+(key===current)+'">'+label+'</button>').join('')+
  '</div><section class="su-panel">'+panel+'</section>'+
  (mainAction||canDeleteOption?'<div class="event-simple-actions su-admin-tools">'+mainAction+canDeleteOption+'</div>':'')+
  '</div>';
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
 printedAt='',status='Planejado',photoUrls={}}){
 const byId=new Map(products.map(p=>[p.id,p])),byModel=new Map(models.map(m=>[m.id,m])),groups=new Map();
 for(const x of items){
  if(!x.quantity||x.quantity<1)continue;
  const p=byId.get(x.product_id);if(!p)continue;
  const key=p.apparel_model_id||p.id;
  if(!groups.has(key))groups.set(key,{name:byModel.get(p.apparel_model_id)?.name||p.name,
   imagePath:byModel.get(p.apparel_model_id)?.image_path||p.image_path||'',rows:[]});
  if(!groups.get(key).imagePath&&p.image_path)groups.get(key).imagePath=p.image_path;
  groups.get(key).rows.push({p,qty:x.quantity});
 }
 const sections=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const total=items.reduce((n,x)=>n+Number(x.quantity||0),0);
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
 '<title>Lista de separação - '+esc(event.name)+'</title>'+
 '<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1c3528;font-size:10.5pt}'+
 'header{display:flex;justify-content:space-between;border-bottom:2px solid #166b4b;padding-bottom:10px;margin-bottom:12px}'+
 'h1{font-size:16pt;margin:4px 0}h2{font-size:11pt;background:#eaf3ed;padding:6px;margin:13px 0 5px}'+
  '.event-print-title{display:flex;align-items:center;gap:9px}.event-print-photo{display:block;width:49px;height:49px;object-fit:contain;border:1px solid #dce7dd;background:#fff;border-radius:5px}'+
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
 sections.map(g=>'<section class="group"><h2 class="event-print-title">'+
  (g.imagePath&&photoUrls[g.imagePath]?'<img class="event-print-photo" src="'+esc(photoUrls[g.imagePath])+'" alt="Foto do modelo '+esc(g.name)+'">':'')+
  esc(g.name)+'</h2><table><thead><tr>'+
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
 '<script>window.addEventListener("load",()=>{Promise.all(Array.from(document.images,im=>im.complete?Promise.resolve():new Promise(resolve=>{im.onload=resolve;im.onerror=resolve}))).then(()=>{window.focus();window.print()})});<\/script></body></html>';
}
