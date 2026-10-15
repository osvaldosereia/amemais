// Fila operacional única: clientes, pedidos avulsos, filiais e franquias.
// As fontes continuam preservadas; cada tipo guarda suas próprias regras de destino.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number(x||0).toLocaleString('pt-BR');
const statuses={
 legado:['Antigo · sem reserva','pending'],
 solicitado:['Aguardando reserva','pending'],
 pendente_estoque:['Com falta','shortage'],
 aguardando:['A separar','ready'],em_separacao:['Em separação','picked'],
 enviado:['Enviado','complete'],
 reservado:['A separar','ready'],aprovado:['A separar','ready'],
 separado:['Separado','picked'],despachado:['Despachado','picked'],
 concluido:['Concluído','complete'],recebido:['Recebido','complete'],
 recebido_divergente:['Recebido com diferença','shortage'],
 cancelado:['Cancelado','closed'],expirado:['Reserva expirada','closed']
};
export function makeUnifiedOrders({avulsoOrders=[],avulsoItems=[],storeOrders=[],storeItems=[],
 eventBatches=[],eventBatchItems=[],events=[],models=[],
 reservations=[],stores=[],products=[],adjustments=[],portal=false,userId=null}){
 const storeById=new Map(stores.map(x=>[x.id,x]));
 const eventById=new Map(events.map(x=>[x.id,x]));
 const productById=new Map(products.map(x=>[x.id,x]));
 const modelById=new Map(models.map(x=>[x.id,x]));
 const photoByModel=new Map();
 for(const item of products){
  const key=item.apparel_model_id||item.id;
  if(item.image_path&&!photoByModel.has(key))photoByModel.set(key,item.image_path);
 }
 const held=new Map();
 for(const r of reservations.filter(x=>x.status==='ativa')){
  const parent=r.event_batch_id?'evento:'+r.event_batch_id:
   r.avulso_order_id?'avulso:'+r.avulso_order_id:'loja:'+r.order_id;
  const key=parent+':'+r.product_id;
  held.set(key,(held.get(key)||0)+Number(r.quantity||0));
 }
 const rows=(kind,orderId,lines)=>lines.map(line=>{
  const p=productById.get(line.product_id),model=p?.apparel_model_id?modelById.get(p.apparel_model_id):null;
  const quantity=Number(line.quantity||0);
  const reserved=held.get(kind+':'+orderId+':'+line.product_id)||0;
  return {id:line.product_id,name:p?.name||line.product_name||'Produto',
    modelId:p?.apparel_model_id||p?.id||line.product_id,
    modelTitle:model?.name||p?.name||line.product_name||'Produto',
    color:p?.apparel_color??line.color??'',size:p?.apparel_size??line.size??'',
    sku:p?.sku||line.sku||'',ean:p?.ean||line.ean||'',
    gondola:p?.gondola||'',prateleira:p?.prateleira||'',
    imagePath:model?.image_path||photoByModel.get(p?.apparel_model_id||p?.id)||p?.image_path||'',
    quantity,reserved,picked:Number(line.picked||0),
    missing:Math.max(0,quantity-reserved)};
 });
 const common=(kind,order,lines,origin,target,status)=>{
  const mapped=rows(kind,order.id,lines);
  const terminal=['enviado','despachado','concluido','recebido','recebido_divergente','cancelado','expirado'].includes(status);
  const unchecked=['legado','solicitado'].includes(status);
  return {kind,id:order.id,eventId:order.event_id||null,
   sequence:order.sequence||null,created_at:order.created_at,status,
   origin,target,source:order.source||order.request_type||kind,
   customerPhone:kind==='avulso'?order.customer_phone:'',
   externalReference:order.external_reference||'',expires_at:order.expires_at,
   lines:mapped,total:mapped.reduce((n,l)=>n+l.quantity,0),
   reserved:mapped.reduce((n,l)=>n+l.reserved,0),
   missing:terminal||unchecked?0:mapped.reduce((n,l)=>n+l.missing,0),
   adjustments:adjustments.filter(a=>a.order_kind===kind&&a.order_id===order.id),
   isOwner:order.created_by===userId,raw:order};
 };
 const av=portal?[]:avulsoOrders.map(o=>common('avulso',o,
  avulsoItems.filter(x=>x.order_id===o.id),'Central',o.customer_name,
  o.fulfillment_status||'legado'));
 const lojas=storeOrders.filter(o=>!portal||o.created_by===userId).map(o=>
  common('loja',o,storeItems.filter(x=>x.order_id===o.id),
   storeById.get(o.from_store_id)?.name||'Central',
   storeById.get(o.to_store_id)?.name||'Loja',o.status));
 const batches=portal?[]:eventBatches.map(b=>{
  const event=eventById.get(b.event_id);
  return common('evento',b,eventBatchItems.filter(x=>x.batch_id===b.id),
   'Estoque central',event?.name||'Loja temporária',b.status);
 });
 return [...av,...lojas,...batches].sort((a,b)=>
  String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
export function groupedOrderLines(lines){
 const groups=new Map();
 for(const line of lines){
  const key=String(line.modelId||line.id);
  if(!groups.has(key))groups.set(key,{key,title:line.modelTitle||line.name,imagePath:line.imagePath||'',lines:[]});
  if(!groups.get(key).imagePath&&line.imagePath)groups.get(key).imagePath=line.imagePath;
  groups.get(key).lines.push(line);
 }
 return [...groups.values()].map(g=>({
  ...g,total:g.lines.reduce((n,l)=>n+l.quantity,0),
  reserved:g.lines.reduce((n,l)=>n+l.reserved,0),
  missing:g.lines.reduce((n,l)=>n+l.missing,0)
 }));
}
export function unifiedOrderCard(o,{button=()=>'',canProcess=false,canCancel=false,canReceive=false,
 canDispatch=false,portal=false,time=x=>x}={}){
 const info=statuses[o.status]||[o.status,'pending'];
 const data='data-id="'+esc(o.id)+'" data-kind="'+esc(o.kind)+'"';
 const process=canProcess&&!portal;
 const event=o.kind==='evento',terminal=['despachado','enviado','concluido','recebido',
  'recebido_divergente','cancelado','expirado'].includes(o.status);
 const ready=['reservado','aprovado','aguardando'].includes(o.status),
  waiting=o.status==='pendente_estoque',inProgress=o.status==='em_separacao';
 const actions=[];
 if(event){
  if(process&&(ready||inProgress))
   actions.push(button(inProgress?'Continuar separação':'Separar lote','event-batch-pick',data,'small primary'));
  if(canDispatch&&o.status==='separado')
   actions.push(button('Confirmar saída do lote','event-batch-dispatch',data,'small primary'));
  if(canCancel&&!terminal)actions.push(button('Editar lote','event-batch-edit',data,'small'));
  if(canCancel&&!terminal)actions.push(button('Cancelar lote','event-batch-cancel',data,'small danger'));
 }else{
  if(process&&['legado','solicitado'].includes(o.status))
   actions.push(button('Preparar pedido','order-retry',data,'small primary'));
  if(process&&waiting)
   actions.push(button('Resolver falta','order-shortage-adjust',data,'small primary'));
  if(process&&ready)
   actions.push(button('Separar',o.kind==='avulso'?'avulso-pick':'store-order-separate',data,'small primary'));
  if(process&&o.status==='separado')
   actions.push(button('Confirmar saída',o.kind==='avulso'?'avulso-dispatch':'store-order-dispatch',data,'small primary'));
  if(canReceive&&o.kind==='loja'&&o.status==='despachado')
   actions.push(button('Conferir recebimento','store-order-receive',data,'small primary'));
  if(canCancel&&['legado','solicitado','pendente_estoque','aprovado','reservado','separado'].includes(o.status))
   actions.push(button('Cancelar',o.kind==='avulso'?'avulso-cancel':'store-order-cancel',data,'small danger'));
 }
 if(!portal&&o.lines.length&&!waiting&&!['legado','solicitado','cancelado','expirado'].includes(o.status))
  actions.push(button('Imprimir lote A4','order-print-a4',data,'small'));
 const originLabel=event?'Loja temporária · Lote '+String(o.sequence).padStart(2,'0'):
  o.kind==='avulso'?(o.raw.source==='cliente'?'Cliente catálogo':
   o.raw.source==='compartilhado'?'Cliente link':'Pedido avulso'):
   o.raw.request_type==='franquia'?'Franquia':'Filial';
 const unchecked=['legado','solicitado'].includes(o.status);
 const groups=groupedOrderLines(o.lines);
 const content=groups.map((g,i)=>'<section class="uo-model-group">'+
   '<div class="uo-model-head"><div class="uo-model-identity">'+
    (g.imagePath?'<img class="uo-model-photo" data-photo-path="'+esc(g.imagePath)+'" alt="Foto do modelo '+esc(g.title)+'" loading="lazy">':'<span class="uo-model-photo uo-photo-empty" aria-hidden="true">▧</span>')+
    '<strong>'+esc(g.title)+'</strong></div>'+
    '<span>'+n(g.total)+' un. · '+g.lines.length+' variação(ões)</span></div>'+
   g.lines.map(l=>'<div class="uo-model-variant">'+
    '<div class="uo-variant-identity"><b>'+esc([l.color,l.size].filter(x=>x&&x!=='Única').join(' · ')||'Único')+'</b>'+
      '<small>SKU '+esc(l.sku||'—')+' · EAN '+esc(l.ean||'—')+'</small>'+
      '<small>'+esc(l.gondola?'Gôndola '+l.gondola:'Local não informado')+
       (l.prateleira?' · Prateleira '+esc(l.prateleira):'')+'</small></div>'+
    '<div class="uo-variant-quantities"><b>'+n(l.quantity)+' un.</b>'+
    (portal?'':terminal?'<small>'+(['cancelado','expirado'].includes(o.status)?'Cancelado':'Enviado')+'</small>':
      unchecked?'<small>Para preparar</small>':
      '<small>'+n(l.reserved)+' reservadas</small>'+
      (l.missing?'<small class="is-short">'+n(l.missing)+' faltam</small>':''))+
    '</div></div>').join('')+'</section>').join('');
 const waitingText=event?
  'Este lote aguarda reposição. As unidades disponíveis já estão reservadas; assim que entrar mercadoria, o sistema completa a reserva.':
  'Faltam unidades. Você pode aguardar a reposição ou registrar uma redução justificada no pedido.';
 return '<article class="uo-card" data-order-card data-search="'+esc([
  o.id,o.target,o.origin,originLabel,...o.lines.flatMap(l=>[l.name,l.modelTitle,l.size,l.sku,l.ean,l.gondola])].join(' ').toLocaleLowerCase('pt-BR'))+
  '" data-order-id="'+esc(o.id)+'" data-order-kind="'+esc(o.kind)+'" data-order-status="'+esc(o.status)+'">'+
  '<header><div class="uo-head"><small>'+esc(originLabel)+' · '+esc(time(o.created_at))+'</small>'+
   '<h3>'+(event?'Lote '+String(o.sequence).padStart(2,'0')+' · #':'Pedido #')+
    esc(o.id.slice(0,8).toUpperCase())+'</h3>'+
   '<strong>'+esc(o.target)+'</strong></div>'+
   '<span class="uo-pill '+info[1]+'">'+esc(info[0])+'</span></header>'+
  '<div class="uo-metrics"><span>'+n(o.total)+' unidades · '+groups.length+' modelo(s)</span>'+
   (portal?'':terminal?'<span>Saída/encerramento registrado</span>':
    unchecked?'<span>Pendente de preparação</span>':
    '<span>'+n(o.reserved)+' reservadas</span>'+
     (o.missing?'<span class="uo-alert">'+n(o.missing)+' faltam</span>':'<span class="uo-ok">Pronto para separar</span>'))+
  '</div>'+
  (waiting&&!portal?'<p class="uo-shortage">'+waitingText+'</p>':'')+
  (o.status==='legado'?'<p class="uo-shortage">Pedido anterior ao novo sistema de reservas. Use Preparar pedido uma única vez para colocá-lo na fila.</p>':'')+
  (o.status==='expirado'?'<p class="uo-shortage">Prazo de confirmação expirado. Histórico preservado.</p>':'')+
  '<details class="uo-details"><summary>Produtos e tamanhos ('+groups.length+' modelo(s), '+o.lines.length+' variações)</summary>'+
   '<div class="uo-model-list">'+content+'</div>'+
   (o.adjustments.length?'<div class="uo-audit"><strong>Alterações justificadas</strong>'+
    o.adjustments.slice(-8).map(a=>'<p>'+esc(a.original_quantity)+' → '+esc(a.revised_quantity)+
    ' un. · '+esc(a.reason)+'</p>').join('')+'</div>':'')+'</details>'+
  (o.externalReference?'<small>Referência externa: '+esc(o.externalReference)+'</small>':'')+
  '<div class="uo-actions">'+actions.join('')+'</div></article>';
}
export function unifiedOrdersPage(orders,{
 button=()=>'',time=x=>x,portal=false,separationOnly=false,
 canProcess=()=>false,canCancel=()=>false,canReceive=()=>false,canDispatch=()=>false,
 canAvulso=false,canStore=false,canLink=false,linksMarkup='',summaryLink=''
}={}){
 const active=['legado','solicitado','reservado','aprovado','aguardando','em_separacao','separado'];
 const visible=separationOnly?orders.filter(o=>active.includes(o.status)||o.status==='pendente_estoque'):orders;
 const backlog=orders.filter(o=>active.includes(o.status)).length;
 const waiting=orders.filter(o=>o.status==='pendente_estoque').length;
 const done=orders.filter(o=>['enviado','concluido','recebido','recebido_divergente'].includes(o.status)).length;
 const cards=visible.map(o=>unifiedOrderCard(o,{button,time,portal,
  canProcess:canProcess(o),canCancel:canCancel(o),canReceive:canReceive(o),
  canDispatch:canDispatch(o)})).join('');
 const actions=!separationOnly?
  (((canAvulso||canStore)?button(portal?'+ Montar pedido':'+ Novo pedido','unified-order-new','','primary'):'')+
   (canLink?button('+ Link para cliente','customer-link-new','','small'):'')):'';
 return '<section class="uo-page">'+
  '<div class="pagehead"><div><h1>'+(separationOnly?'Separação':'Pedidos')+'</h1>'+
   '<p>'+(separationOnly?'Fila dos separadores · pedidos e lotes de lojas temporárias.':
    'Todos os pedidos e remessas de lojas temporárias em uma fila única.')+'</p></div>'+
   '<div class="actions">'+actions+'</div></div>'+
  '<div class="uo-summary"><div><small>A separar</small><strong>'+backlog+'</strong></div>'+
   '<div><small>Aguardando estoque</small><strong>'+waiting+'</strong></div>'+
   '<div><small>Concluídos</small><strong>'+done+'</strong></div></div>'+
  '<div class="uo-tools"><label class="uo-search">Buscar<input type="search" data-unified-search placeholder="Pedido, lote, destino, SKU ou EAN…" autocomplete="off"></label>'+
   '<label class="uo-filter">Situação<select data-unified-status><option value="todos">Todos</option>'+
   '<option value="pendentes">A separar</option><option value="pendente_estoque">Com falta</option>'+
   '<option value="concluidos">Concluídos</option><option value="encerrados">Cancelados / expirados</option></select></label></div>'+
  '<div class="uo-list">'+(visible.length?cards:
    '<p class="uo-no-work">Nenhum pedido ou lote aguardando separação.</p>')+'</div>'+
  '<p class="uo-empty-filter" data-unified-empty hidden>Nenhum item encontrado com estes filtros.</p>'+
  (!separationOnly&&!portal&&canLink?'<details class="uo-customer-links"><summary>Links de acesso para clientes'+
   (summaryLink?' · '+esc(summaryLink):'')+'</summary>'+linksMarkup+'</details>':'')+
  '<p class="help">A lista é uma fila de trabalho. A reserva não reduz o físico; a saída é registrada somente após a conferência completa. Lotes de eventos são enviados separadamente.</p>'+
 '</section>';
}
export function filterUnifiedOrders(container,query,status){
 const q=String(query||'').trim().toLocaleLowerCase('pt-BR');
 let visible=0;
 for(const card of container.querySelectorAll('[data-order-card]')){
  const s=card.dataset.orderStatus;
  const match=status==='todos'||!status||
    (status==='pendentes'&&['legado','solicitado','reservado','aprovado','aguardando','em_separacao','separado','despachado'].includes(s))||
    (status==='concluidos'&&['enviado','concluido','recebido','recebido_divergente'].includes(s))||
    (status==='encerrados'&&['cancelado','expirado'].includes(s))||
    status===s;
  card.hidden=!match||!card.dataset.search.includes(q);
  if(!card.hidden)visible++;
 }
 const empty=container.querySelector('[data-unified-empty]');
 if(empty)empty.hidden=visible!==0;
 return visible;
}
export function pickingOrderRows(order,{h=esc}={}){
 const isEvent=order.kind==='evento';
 return '<p class="help">Separe por gôndola e confira pelo EAN ou quantidade. Salve a conferência para continuar em outro momento. O estoque físico só sai na expedição.</p>'+
 '<div class="uo-pick-toolbar"><button type="button" class="button" data-action="'+
 (isEvent?'event-batch-scan':'order-scan-ean')+'">📷 Ler EAN</button>'+
 '<span>Separadas: <b data-picked-total>'+n(order.lines.reduce((a,l)=>a+(l.picked||0),0))+
 '</b> / '+n(order.total)+' unidades</span></div>'+
 '<div class="uo-picking">'+groupedOrderLines(order.lines).map(group=>
  '<section class="uo-pick-model"><h3 class="uo-pick-heading">'+
   (group.imagePath?'<img class="uo-model-photo" data-photo-path="'+h(group.imagePath)+'" alt="Foto do modelo '+h(group.title)+'">':'')+
   '<span>'+h(group.title)+' <small>'+group.lines.length+' variações</small></span></h3>'+
   group.lines.map(l=>'<div class="store-picking-line" data-picking-row="'+h(l.id)+'">'+
    '<div><strong>'+h([l.color,l.size].filter(x=>x&&x!=='Única').join(' · ')||'Único')+
    '</strong><small>SKU '+h(l.sku||'—')+' · EAN '+h(l.ean||'—')+'</small>'+
    '<small>'+h(l.gondola?'Gôndola '+l.gondola:'Local não informado')+
     (l.prateleira?' · Prateleira '+h(l.prateleira):'')+'</small></div>'+
    '<label>Separado<input type="number" data-pick-qty data-id="'+h(l.id)+'" data-expected="'+l.quantity+
     '" min="0" max="'+l.quantity+'" step="1" inputmode="numeric"'+
     (l.picked>0?' value="'+l.picked+'"':' placeholder="—"')+'></label></div>').join('')+
  '</section>').join('')+'</div>'+
 (isEvent?'<p class="help">Você pode salvar quantidades parciais e voltar depois. Cada leitura soma uma unidade, até o limite solicitado.</p>':'');
}
export function shortageEditRows(order,{h=esc}={}){
 return '<p class="help">Você pode simplesmente aguardar: quando entrar mercadoria, a reserva será completada automaticamente. Se precisar enviar menos, informe abaixo quanto poderá ser atendido e explique o motivo. A solicitação original permanece no histórico.</p>'+
 '<div class="uo-picking">'+order.lines.map(l=>'<div class="store-picking-line">'+
 '<div><strong>'+h(l.name)+'</strong><small>'+h([l.color,l.size,l.sku,l.ean].filter(Boolean).join(' · '))+
 '</small><small>Solicitado '+l.quantity+' · Reservado '+l.reserved+' · Falta '+l.missing+'</small></div>'+
 '<label>Enviar<input type="number" data-shortage-qty data-id="'+h(l.id)+'" data-original="'+l.quantity+
 '" min="0" max="'+l.quantity+'" step="1" inputmode="numeric" value="'+l.quantity+'"></label></div>').join('')+'</div>'+
 '<label class="field">Justificativa obrigatória<textarea name="reason" minlength="5" maxlength="250" required placeholder="Ex.: furo identificado na separação"></textarea></label>';
}
export function pickingA4HTML(order,{printedAt='',brand='AME+ STORE',photoUrls={}}={}){
 const groups=groupedOrderLines(order.lines);
 const compactGroups=groups.map(g=>'<tbody class="lot-group"><tr class="lot-group-title"><td colspan="7"><div class="lot-heading">'+
  (g.imagePath&&photoUrls[g.imagePath]?'<img class="lot-photo" src="'+esc(photoUrls[g.imagePath])+'" alt="Foto do modelo '+esc(g.title)+'">':'')+
  '<div>'+esc(g.title)+' · '+g.lines.length+' variação(ões) · '+n(g.total)+' unidades</div></div></td></tr>'+
  g.lines.map(l=>'<tr><td>'+esc([l.color,l.size].filter(x=>x&&x!=='Única').join(' · ')||'Único')+
   '</td><td>'+esc(l.gondola?'Gôndola '+l.gondola:'Não informada')+
    (l.prateleira?' / '+esc(l.prateleira):'')+
   '</td><td>'+esc(l.sku||'—')+'</td><td>'+esc(l.ean||'—')+'</td>'+
   '<td class="center"><b>'+n(l.quantity)+'</b></td>'+
   '<td class="write"></td><td class="center check"></td></tr>').join('')+'</tbody>').join('');
 const name=order.kind==='evento'?'LOTE DE EVENTO':'PEDIDO';
 const code=order.kind==='evento'?'Lote '+String(order.sequence||'').padStart(2,'0'): 'Pedido';
 const reserve=order.reserved>0?' · Reservado: '+n(order.reserved):'';
 const shortage=order.missing>0?' · Faltando: '+n(order.missing):'';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
  '<title>Separação '+esc(code)+' '+esc(order.id.slice(0,8))+'</title>'+
  '<style>@page{size:A4 portrait;margin:10mm 10mm 12mm}*{box-sizing:border-box}'+
  'body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#192f24;margin:0}'+
  'header{display:flex;justify-content:space-between;gap:14px;border-bottom:2px solid #155f42;padding-bottom:7px;margin-bottom:9px}'+
  '.brand{font-size:13pt;color:#176747;font-weight:900;letter-spacing:.2pt}h1{font-size:13pt;margin:2px 0 4px}'+
  '.reference{font-size:8pt;color:#66796d;overflow-wrap:anywhere}.meta{text-align:right;line-height:1.4;font-size:8pt}'+
  '.header-note{font-size:8pt;margin:7px 0 11px;padding:6px;background:#f3f7f3;border:1px solid #dee8e0}'+
  'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}'+
  'th,td{border:1px solid #bdcdc1;padding:4px 5px;vertical-align:middle;overflow-wrap:anywhere}'+
  'th{background:#eaf2ec;font-size:7.5pt}td{font-size:7.7pt;line-height:1.2}'+
  '.lot-group-title td{font-weight:800;background:#f0f6f1;color:#1a5036;padding:5px}'+
  '.lot-heading{display:flex;align-items:center;gap:9px;min-height:38px}.lot-photo{width:43px;height:43px;object-fit:contain;border:1px solid #d2ded5;border-radius:5px;background:#fff;flex:none}'+
  '.lot-group{break-inside:avoid-page}tr{break-inside:avoid}.center{text-align:center;font-variant-numeric:tabular-nums}'+
  '.write{height:22px}.check{height:22px}.totals{font-size:8.5pt;margin-top:10px;padding:6px 0;border-top:1px solid #9cb7a3}'+
  '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:29px}'+
  '.signatures>div{border-top:1px solid #53665a;text-align:center;padding-top:5px;font-size:8pt}'+
  '.instructions{font-size:7.5pt;color:#526658;margin-top:9px}'+
  '</style></head><body>'+
  '<header><div><div class="brand">'+esc(brand)+'</div><h1>SEPARAÇÃO · '+name+'</h1>'+
   '<div class="reference">'+esc(code)+' #'+esc(order.id.slice(0,8).toUpperCase())+'</div>'+
   '<div class="reference">Identificador: '+esc(order.id)+'</div></div>'+
   '<div class="meta"><b>DESTINO: '+esc(order.target)+'</b><div>Origem: '+esc(order.origin)+'</div>'+
    '<div>Emissão: '+esc(printedAt)+'</div></div></header>'+
  '<div class="header-note"><b>'+n(groups.length)+' modelo(s) · '+n(order.lines.length)+' variação(ões) · '+
   n(order.total)+' unidades solicitadas</b>. Marque somente após encontrar cada item.</div>'+
  '<table><thead><tr><th style="width:14%">Variação</th><th style="width:22%">Gôndola / local</th>'+
  '<th style="width:15%">SKU</th><th style="width:21%">EAN</th>'+
  '<th style="width:9%">Qtde</th><th style="width:12%">Separado</th><th style="width:7%">✓</th>'+
  '</tr></thead>'+compactGroups+'</table>'+
  '<div class="totals"><b>Total solicitado: '+n(order.total)+' unidades'+reserve+shortage+
   '</b><div>Observações / divergências: _________________________________________________</div></div>'+
  '<div class="signatures"><div>Separador · assinatura / hora</div><div>Conferente · assinatura / hora</div></div>'+
  '<p class="instructions">Mantenha esta folha junto das mercadorias deste lote. O envio físico só será registrado após confirmação no sistema.</p>'+
  '<script>window.addEventListener("load",()=>{Promise.all(Array.from(document.images,im=>im.complete?Promise.resolve():new Promise(resolve=>{im.onload=resolve;im.onerror=resolve}))).then(()=>{window.focus();window.print()})});</script></body></html>';
}
