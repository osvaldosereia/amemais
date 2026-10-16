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
 reservations=[],stores=[],products=[],adjustments=[],codes=[],progress=[],portal=false,userId=null}){
 const codeMap=new Map(codes.map(x=>[x.kind+':'+x.order_id,x.code]));
 const progressMap=new Map(progress.map(x=>[x.kind+':'+x.order_id,x]));
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
  const destinationKind=kind==='evento'?'evento':kind==='avulso'?'avulso':
    (storeById.get(order.to_store_id)?.kind==='franquia'||order.request_type==='franquia'?'franquia':'loja');
  return {kind,destinationKind,id:order.id,code:codeMap.get(kind+':'+order.id)||'—',eventId:order.event_id||null,
   sequence:order.sequence||null,created_at:order.created_at,status,
   origin,target,source:order.source||order.request_type||kind,workflow:progressMap.get(kind+':'+order.id)||null,
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

const locationSort=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
function shortLocation(value){
 const raw=String(value||'').trim().replace(/^g[oô]ndola\s*/i,'');
 if(!raw)return '';
 return /^\d+$/.test(raw)?String(Number(raw)):raw;
}
export function groupedOrderByLocation(lines=[]){
 const sections=new Map();
 for(const line of lines){
  const key=shortLocation(line.gondola);
  if(!sections.has(key))sections.set(key,[]);
  sections.get(key).push(line);
 }
 return [...sections].sort((a,b)=>!a[0]?1:!b[0]?-1:locationSort.compare(a[0],b[0])).map(([key,items])=>({
  key,title:key?'Gôndola '+key:'Sem gôndola cadastrada',
  lines:items.sort((a,b)=>locationSort.compare(a.prateleira||'',b.prateleira||'')||
    locationSort.compare(a.modelTitle||a.name||'',b.modelTitle||b.name||'')||
    locationSort.compare(a.size||'',b.size||'')),
  total:items.reduce((total,item)=>total+Number(item.quantity||0),0)
 }));
}
function orderWorkflow(o,verified=false){
 const status=o.status,stage=['cancelado','expirado','despachado','enviado','concluido','recebido','recebido_divergente'].includes(status)?
  (o.workflow?.stage==='enviado'?'enviado':null):o.workflow?.stage;
 if(stage==='separacao')return ['Em separação','picked','Separação em andamento'];
 if(stage==='conferencia')return ['A conferir','checking','Separação concluída · Conferência pendente'];
 if(stage==='expedicao')return ['Em expedição','checking','Conferência concluída · Aguardando registro de envio'];
 if(stage==='enviado')return ['Enviado','complete','Envio físico registrado'];
 if(status==='pendente_estoque')return ['Falta de estoque','shortage','Falta de unidades: aguardar reposição ou resolver a pendência'];
 if(['legado','solicitado'].includes(status))return ['Aguardando preparação','pending','É necessário reservar os produtos'];
 if(['aguardando','reservado','aprovado'].includes(status))return ['A separar','ready','Pronto para iniciar a separação'];
 if(status==='em_separacao')return ['Em separação','picked','Separação em andamento'];
 if(status==='separado'&&!verified)return ['A conferir','checking','Separação concluída · Aguardando conferência final'];
 if(status==='separado'&&verified)return ['Conferido','complete','Conferência concluída · Aguardando confirmação da saída'];
 if(status==='cancelado')return ['Cancelado','closed','Pedido cancelado · reservas liberadas'];
 if(status==='expirado')return ['Reserva expirada','closed','Prazo de reserva expirado'];
 return [...(statuses[status]||[status,'pending']),'Saída/encerramento registrado'];
}
// Ocorrências atuais são diferentes de alterações históricas justificadas.
export function activeOrderIssues(o,{hasIssue=false}={}){
 const terminal=['enviado','despachado','concluido','recebido','recebido_divergente','cancelado','expirado'].includes(o.status);
 if(terminal)return [];
 const issues=[];
 if(o.status==='pendente_estoque'&&o.missing>0){
  issues.push({type:'shortage',text:'Falta '+n(o.missing)+' unidade'+(o.missing===1?'':'s')+' para atender o pedido.'});
 }
 if(o.workflow?.has_difference){
  for(const line of o.lines){
   const row=o.workflow.items?.[line.id]||{};
   const expected=Number(line.quantity||0);
   let detail='';
   if(row.picked!=null&&Number(row.picked)!==expected)
    detail='Separado '+n(row.picked)+' de '+n(expected);
   else if(row.counted!=null&&Number(row.counted)!==expected)
    detail='Conferido '+n(row.counted)+' de '+n(expected);
   else if(row.counted!=null&&row.picked!=null&&Number(row.counted)!==Number(row.picked))
    detail='Conferido '+n(row.counted)+'; separado '+n(row.picked);
   if(detail){
    const reason=row.check_reason||row.pick_reason;
    issues.push({type:'difference',text:(line.modelTitle||line.name)+': '+detail+(reason?' · '+reason:'')});
   }
  }
 }
 if(hasIssue&&!issues.some(i=>i.type==='difference'))
  issues.push({type:'difference',text:'Há diferença registrada na conferência final. Revise os itens antes do envio.'});
 return issues;
}
export function unifiedOrderCard(o,{button=()=>'',canProcess=false,canCancel=false,canDelete=false,canReceive=false,
 canDispatch=false,canDispatchStock=false,canVerify=false,isVerified=false,canAdjust=false,hasIssue=false,portal=false,time=x=>x}={}){
 const info=orderWorkflow(o,isVerified);
 const issues=activeOrderIssues(o,{hasIssue});
 const hasOccurrence=issues.length>0;
 const data='data-id="'+esc(o.id)+'" data-kind="'+esc(o.kind)+'"';
 const process=canProcess&&!portal;
 const event=o.kind==='evento';
 const terminal=['despachado','enviado','concluido','recebido','recebido_divergente','cancelado','expirado'].includes(o.status);
 const ready=['reservado','aprovado','aguardando'].includes(o.status);
 const waiting=o.status==='pendente_estoque',inProgress=o.status==='em_separacao';
 const primary=[],secondary=[],management=[];
 const stage=terminal?(o.workflow?.stage==='enviado'?'enviado':null):o.workflow?.stage;
 const canShip=event?canDispatch:canDispatchStock;
 if(stage==='separacao'&&process)primary.push(button('Continuar separação','order-op-pick',data,'small primary'));
 else if(stage==='conferencia'&&canVerify)primary.push(button('Conferir pedido','order-op-check',data,'small primary'));
 else if(stage==='expedicao'&&canShip)primary.push(button('Registrar envio','order-op-send',data,'small primary'));
 else if(!stage&&process&&(ready||inProgress))primary.push(button(inProgress?'Continuar separação':'Iniciar separação','order-op-pick',data,'small primary'));
 else if(!stage&&o.status==='separado'&&canVerify)primary.push(button('Conferir pedido','order-op-check',data,'small primary'));
 else if(!stage&&process&&canAdjust&&['legado','solicitado'].includes(o.status))
  primary.push(button('Preparar pedido','order-retry',data,'small primary'));
 else if(!stage&&process&&canAdjust&&waiting)
  primary.push(button('Resolver falta','order-shortage-adjust',data,'small primary'));
 else if(canReceive&&o.kind==='loja'&&o.status==='despachado')
  primary.push(button('Conferir recebimento','store-order-receive',data,'small primary'));
 if(event&&canCancel&&!terminal){
  management.push(button('Editar pedido','event-batch-edit',data,'small'));
  management.push(button('Cancelar pedido','event-batch-cancel',data,'small danger'));
 }else if(!event&&canCancel&&['legado','solicitado','pendente_estoque','aprovado','reservado','separado'].includes(o.status)){
  management.push(button('Cancelar pedido',o.kind==='avulso'?'avulso-cancel':'store-order-cancel',data,'small danger'));
 }
 if(canDelete&&!portal)management.push(button('Excluir pedido','admin-order-delete-open',data,'small danger'));
 if(!portal&&o.lines.length&&!waiting&&!['legado','solicitado','cancelado','expirado'].includes(o.status))
  secondary.push(button('Imprimir separação','order-print-thermal',data,'small'));
 const originLabel=event?'Loja temporária':
  o.kind==='avulso'?(o.raw.source==='cliente'?'Cliente catálogo':
   o.raw.source==='compartilhado'?'Cliente link':'Pedido avulso'):
   o.destinationKind==='franquia'?'Franquia':'Loja / filial';
 const unchecked=['legado','solicitado'].includes(o.status);
 const groups=groupedOrderLines(o.lines),locations=groupedOrderByLocation(o.lines);
 const itemMarkup=l=>'<div class="uo-model-variant">'+
   '<div class="uo-variant-identity"><b>'+esc([l.color,l.size].filter(x=>x&&x!=='Única').join(' · ')||'Único')+'</b>'+
   '<small>SKU '+esc(l.sku||'—')+' · EAN '+esc(l.ean||'—')+'</small>'+
   '<small>'+esc(l.gondola?'Gôndola '+l.gondola:'Local não informado')+
    (l.prateleira?' · Prateleira '+l.prateleira:'')+'</small></div>'+
   '<div class="uo-variant-quantities"><b>'+n(l.quantity)+' un.</b>'+
   (portal?'':terminal?'<small>'+(['cancelado','expirado'].includes(o.status)?'Cancelado':'Enviado')+'</small>':
    unchecked?'<small>Para preparar</small>':
    '<small>'+n(l.reserved)+' reservadas</small>'+
    (l.missing?'<small class="is-short">'+n(l.missing)+' faltam</small>':''))+
   '</div></div>';
 const content=groups.map(g=>'<section class="uo-model-group">'+
   '<div class="uo-model-head"><div class="uo-model-identity">'+
    (g.imagePath?'<img class="uo-model-photo" data-photo-path="'+esc(g.imagePath)+'" alt="Foto de '+esc(g.title)+'" loading="lazy">':'<span class="uo-model-photo uo-photo-empty" aria-hidden="true">▧</span>')+
    '<strong>'+esc(g.title)+'</strong></div>'+
    '<span>'+n(g.total)+' un. · '+g.lines.length+' variação(ões)</span></div>'+
   g.lines.map(itemMarkup).join('')+'</section>').join('');
 const gondolaContent=locations.map(group=>
  '<section class="uo-gondola-group"><header><strong>'+esc(group.title)+'</strong><span>'+n(group.total)+' unidades</span></header>'+
  group.lines.map(l=>'<div class="uo-gondola-line"><span><strong>'+esc(l.modelTitle||l.name)+'</strong>'+
   '<small>'+esc([l.color,l.size].filter(Boolean).join(' · ')||'Único')+
   ' · SKU '+esc(l.sku||'—')+(l.prateleira?' · Prat. '+esc(l.prateleira):'')+'</small></span>'+
   '<b>'+n(l.quantity)+' un.</b></div>').join('')+'</section>').join('');
 const preview=o.lines.length===1?(()=>{
  const l=o.lines[0],g=groups[0];
  return '<div class="uo-product-preview">'+
   (g?.imagePath?'<img data-photo-path="'+esc(g.imagePath)+'" alt="Foto de '+esc(g.title)+'" loading="lazy">':
    '<span class="uo-preview-placeholder" aria-hidden="true">▧</span>')+
   '<div><strong>'+esc(l.modelTitle||l.name)+
     (l.size?' · '+esc(l.size):'')+'</strong>'+
    '<small>SKU '+esc(l.sku||'—')+' · EAN '+esc(l.ean||'—')+'</small>'+
    '<span class="uo-location">⌖ '+esc(l.gondola?'Gôndola '+l.gondola:'Sem gôndola')+
     (l.prateleira?' · Prateleira '+esc(l.prateleira):'')+'</span></div>'+
   '<b class="uo-preview-quantity">'+n(l.quantity)+' <small>un.</small></b></div>';
 })():'<div class="uo-product-summary"><strong>'+n(o.lines.length)+' SKUs</strong>'+
 '<span>'+n(groups.length)+' modelos · '+n(locations.length)+' locais de separação</span>'+
 '<small>Abra a lista abaixo para separar por gôndola ou por modelo.</small></div>';
 const waitingText=event?
  'Aguardando reposição. As unidades disponíveis continuam reservadas; assim que chegar mercadoria, o sistema completa a reserva.':
  'Faltam unidades. Aguarde a reposição ou solicite ao responsável um ajuste justificado.';
 const separationLabel=stage==='separacao'||inProgress?'Em andamento':
  stage==='conferencia'||o.status==='separado'?'Concluída':
  stage==='expedicao'||stage==='enviado'||terminal?'Finalizada':
  waiting?'Com falta':'A iniciar';
 const priority=waiting?0:issues.some(i=>i.type==='difference')?1:
  stage==='conferencia'||o.status==='separado'?2:stage==='expedicao'?3:
  stage==='separacao'||inProgress?4:ready?5:6;
 const managementMenu=management.length?
  '<details class="uo-admin-actions"><summary aria-label="Administração do pedido" title="Administração do pedido">'+
   '<span aria-hidden="true">⋮</span><span class="uo-visually-hidden">Administração do pedido</span></summary>'+
   '<div class="uo-admin-popover"><p>Alterações administrativas podem modificar reservas ou a separação.</p>'+
   '<div class="uo-actions">'+management.join('')+'</div></div></details>':'';
 const issueBanner=issues.length?'<div class="uo-exception-badge" role="status"><span aria-hidden="true">⚠</span>'+
  '<span>'+esc(issues[0].text)+(issues.length>1?' · +'+n(issues.length-1)+' ocorrência(s)':'')+'</span></div>':'';
 return '<article class="uo-card uo-operational uo-compact-card" data-order-card data-search="'+esc([
  o.id,o.code,o.target,o.origin,originLabel,...o.adjustments.map(a=>a.reason||''),...o.lines.flatMap(l=>[l.name,l.modelTitle,l.size,l.sku,l.ean,l.gondola])].join(' ').toLocaleLowerCase('pt-BR'))+
  '" data-order-id="'+esc(o.id)+'" data-order-kind="'+esc(o.kind)+'" data-order-status="'+esc(o.status)+'" data-order-destination="'+
   esc(o.destinationKind|| (event?'evento':o.kind==='avulso'?'avulso':'loja'))+
   '" data-order-created="'+esc(o.created_at||'')+'" data-order-priority="'+priority+
   '" data-order-verified="'+(o.workflow?.stage==='expedicao'?'true':'false')+'" data-order-stage="'+esc(o.workflow?.stage||'')+'" data-order-issue="'+hasOccurrence+'">'+
  '<header class="uo-compact-header"><div class="uo-head">'+
   '<div class="uo-compact-title"><h3>Pedido #'+esc(o.code||'—')+'</h3>'+
   '<span class="uo-pill '+info[1]+'">'+esc(info[0])+'</span>'+
   (hasOccurrence?'<span class="uo-issue-chip">'+(issues.some(i=>i.type==='difference')?'Divergência':'Falta')+'</span>':'')+'</div>'+
   '<strong>'+esc(o.target)+'</strong>'+
   '<small>'+esc(originLabel)+' · '+esc(time(o.created_at))+'</small></div>'+managementMenu+'</header>'+
  '<div class="uo-compact-main">'+
   '<div class="uo-compact-metrics" aria-label="Resumo do pedido">'+
    '<div><small>Produtos</small><strong>'+n(groups.length)+'</strong></div>'+
    '<div><small>Unidades</small><strong>'+n(o.total)+' unidades</strong></div>'+
    '<div><small>Separação</small><strong class="uo-stage-text">'+esc(separationLabel)+'</strong></div>'+
   '</div>'+
   '<div class="uo-compact-operation">'+
    '<p class="uo-next-step '+(waiting?'is-shortage':'')+'">'+esc(info[2])+'</p>'+
    (primary.length?'<div class="uo-primary-action">'+primary.join('')+'</div>':'')+
   '</div></div>'+
  issueBanner+
  '<details class="uo-order-open"><summary>Abrir pedido · Ver detalhes · '+n(o.lines.length)+' SKU(s)</summary>'+
    preview+
    (issues.length?'<section class="uo-difference-list"><strong>Ocorrências atuais</strong>'+
      issues.map(i=>'<p>'+esc(i.text)+'</p>').join('')+'</section>':'')+
    (waiting&&!portal?'<p class="uo-shortage">'+esc(waitingText)+'</p>':'')+
    (o.status==='legado'?'<p class="uo-shortage">Pedido anterior ao novo sistema de reservas. Prepare o pedido para entrar na fila.</p>':'')+
    (o.status==='expirado'?'<p class="uo-shortage">Prazo de confirmação expirado. Histórico preservado.</p>':'')+
    (secondary.length?'<div class="uo-operational-actions"><div class="uo-secondary-actions">'+secondary.join('')+'</div></div>':'')+
    '<details class="uo-details"><summary>Produtos e localizações ('+n(o.lines.length)+' SKUs)</summary>'+
     '<div class="uo-list-view" data-group-view="location">'+
      '<div class="uo-group-switch" role="group" aria-label="Organização dos produtos">'+
       '<button type="button" class="is-current" data-action="order-group-location" aria-pressed="true">Por gôndola</button>'+
       '<button type="button" data-action="order-group-model" aria-pressed="false">Por modelo</button></div>'+
      '<div class="uo-location-list">'+gondolaContent+'</div>'+
      '<div class="uo-model-list">'+content+'</div></div>'+
     (o.adjustments.length?'<div class="uo-audit"><strong>Alterações justificadas (histórico)</strong>'+
       o.adjustments.slice(-8).map(a=>'<p>'+esc(a.original_quantity)+' → '+esc(a.revised_quantity)+' un. · '+esc(a.reason)+'</p>').join('')+'</div>':'')+
    '</details>'+
    (o.externalReference?'<small>Referência externa: '+esc(o.externalReference)+'</small>':'')+
  '</details></article>';
}
export function unifiedOrdersPage(orders,{
 button=()=>'',time=x=>x,portal=false,separationOnly=false,
 canProcess=()=>false,canCancel=()=>false,canDelete=()=>false,canReceive=()=>false,canDispatch=()=>false,canDispatchStock=()=>false,canVerify=()=>false,isVerified=()=>false,canAdjust=()=>false,hasIssue=()=>false,
 canAvulso=false,canStore=false,canEventBatch=false,eventId='',canLink=false,linksMarkup='',summaryLink=''
}={}){
 const active=['legado','solicitado','reservado','aprovado','aguardando','em_separacao','separado'];
 const visible=separationOnly?orders.filter(o=>active.includes(o.status)||o.status==='pendente_estoque'):orders;
 const toPick=orders.filter(o=>!o.workflow&&['reservado','aprovado','aguardando'].includes(o.status)).length;
 const separating=orders.filter(o=>o.workflow?.stage==='separacao'||(!o.workflow&&o.status==='em_separacao')).length;
 const toVerify=orders.filter(o=>o.workflow?.stage==='conferencia'||(!o.workflow&&o.status==='separado')).length;
 const readyToDispatch=orders.filter(o=>o.workflow?.stage==='expedicao').length;
 const waiting=orders.filter(o=>o.status==='pendente_estoque').length;
 const destinationTypes=new Set(visible.map(o=>o.destinationKind||o.kind));
 const cards=visible.map(o=>unifiedOrderCard(o,{button,time,portal,
  canProcess:canProcess(o),canCancel:canCancel(o),canDelete:canDelete(o),canReceive:canReceive(o),
  canDispatch:canDispatch(o),canDispatchStock:canDispatchStock(o),
  canVerify:canVerify(o),isVerified:isVerified(o),canAdjust:canAdjust(o),hasIssue:hasIssue(o)})).join('');
 const actions=!separationOnly?
   ((canStore||canEventBatch)?button('+ Novo pedido','unified-order-new','','primary'):''):'';
 return '<section class="uo-page">'+
  '<div class="pagehead"><div><h1>'+(separationOnly?'Separação':'Pedidos')+'</h1>'+
   '<p>'+(eventId?'Pedidos desta loja temporária seguem diretamente para separação no CD.':
   separationOnly?'Fila de separação de todos os pedidos.':
    'Pedidos de lojas próprias, franquias e lojas temporárias em uma fila única.')+'</p></div>'+
   '<div class="actions">'+actions+'</div></div>'+
  '<div class="uo-summary" aria-label="Andamento dos pedidos">'+
   '<button type="button" class="uo-summary-item" data-action="uo-summary-filter" data-status="a_separar" aria-pressed="false"><small>A separar</small><strong>'+toPick+'</strong></button>'+
   '<button type="button" class="uo-summary-item" data-action="uo-summary-filter" data-status="em_separacao" aria-pressed="false"><small>Em separação</small><strong>'+separating+'</strong></button>'+
   '<button type="button" class="uo-summary-item" data-action="uo-summary-filter" data-status="a_conferir" aria-pressed="false"><small>A conferir</small><strong>'+toVerify+'</strong></button>'+
   '<button type="button" class="uo-summary-item" data-action="uo-summary-filter" data-status="pronto_saida" aria-pressed="false"><small>Em expedição</small><strong>'+readyToDispatch+'</strong></button>'+
   '<button type="button" class="uo-summary-item" data-action="uo-summary-filter" data-status="pendente_estoque" aria-pressed="false"><small>Com falta</small><strong>'+waiting+'</strong></button></div>'+
  '<div class="uo-tools"><label class="uo-search">Buscar'+
   '<input type="search" data-unified-search placeholder="Pedido, destino, modelo, gôndola, SKU ou EAN…" autocomplete="off"></label>'+
   '<label class="uo-filter">Etapa<select data-unified-status>'+
   '<option value="todos">Todas</option>'+
   '<option value="a_separar">A separar</option>'+ 
   '<option value="a_preparar">A preparar</option>'+ 
   '<option value="em_separacao">Em separação</option>'+
   '<option value="a_conferir">A conferir</option>'+
   '<option value="pronto_saida">Em expedição</option>'+
   '<option value="pendente_estoque">Com falta</option>'+ 
   '<option value="com_ocorrencia">Com ocorrência</option>'+ 
   '<option value="concluidos">Concluídos</option>'+
   '<option value="encerrados">Cancelados / expirados</option></select></label>'+
   '<label class="uo-filter">Destino<select data-unified-destination>'+
   '<option value="todos">Todos</option>'+
   (destinationTypes.has('evento')?'<option value="evento">Loja temporária</option>':'')+
   (destinationTypes.has('franquia')?'<option value="franquia">Franquia</option>':'')+
   (destinationTypes.has('loja')?'<option value="loja">Loja própria</option>':'')+
   (destinationTypes.has('avulso')?'<option value="avulso">Pedido avulso</option>':'')+
   '</select></label>'+ 
   '<label class="uo-filter">Ordenar<select data-unified-sort>'+ 
   '<option value="recentes">Mais recentes</option>'+ 
   '<option value="antigos">Mais antigos</option>'+ 
   '<option value="prioridade">Prioridade operacional</option></select></label></div>'+ 
  '<div class="uo-list">'+(visible.length?cards:
    '<div class="uo-no-work"><strong>Nenhum pedido ativo no momento.</strong><p>Quando uma unidade solicitar mercadorias, o pedido aparecerá aqui para separação e conferência. Use Novo pedido para começar.</p></div>')+'</div>'+
  '<p class="uo-empty-filter" data-unified-empty hidden>Nenhum item encontrado com estes filtros.</p>'+

  '<p class="help">'+(eventId?'Faça pedidos para esta loja. Cada pedido segue para separação e depois para conferência e expedição.':
     'A reserva não reduz o estoque físico. A saída é registrada somente após a conferência completa.')+'</p>'+
 '</section>';
}
export function filterUnifiedOrders(container,query,status,destination='todos',sort='recentes'){
 const q=String(query||'').trim().toLocaleLowerCase('pt-BR');
 let visible=0;
 for(const card of container.querySelectorAll('[data-order-card]')){
  const s=card.dataset.orderStatus,verified=card.dataset.orderVerified==='true';
  const match=status==='todos'||!status||
   (status==='a_separar'&&!card.dataset.orderStage&&['reservado','aprovado','aguardando'].includes(s))||
   (status==='a_preparar'&&['legado','solicitado'].includes(s))||
   (status==='em_separacao'&&(card.dataset.orderStage==='separacao'||(!card.dataset.orderStage&&s==='em_separacao')))||
   (status==='a_conferir'&&(card.dataset.orderStage==='conferencia'||(!card.dataset.orderStage&&s==='separado')))||
   (status==='pronto_saida'&&card.dataset.orderStage==='expedicao')||
   (status==='com_ocorrencia'&&card.dataset.orderIssue==='true')||
   (status==='pendentes'&&['legado','solicitado','reservado','aprovado','aguardando','em_separacao','separado'].includes(s))||
   (status==='concluidos'&&['enviado','despachado','concluido','recebido','recebido_divergente'].includes(s))||
   (status==='encerrados'&&['cancelado','expirado'].includes(s))||
   status===s;
  const matchDestination=!destination||destination==='todos'||card.dataset.orderDestination===destination;
  card.hidden=!match||!matchDestination||!card.dataset.search.includes(q);
  if(!card.hidden)visible++;
 }
 const list=container.querySelector('.uo-list');
 if(list?.appendChild){
  const cards=[...container.querySelectorAll('[data-order-card]')];
  const timeOf=card=>Date.parse(card.dataset.orderCreated||'')||0;
  cards.sort((a,b)=>{
   if(sort==='prioridade'){
    const byPriority=Number(a.dataset.orderPriority??6)-Number(b.dataset.orderPriority??6);
    if(byPriority)return byPriority;
   }
   return sort==='antigos'?timeOf(a)-timeOf(b):timeOf(b)-timeOf(a);
  }).forEach(card=>list.appendChild(card));
 }
 for(const chip of container.querySelectorAll('[data-action="uo-summary-filter"]')){
  const active=chip.dataset.status===status;
  chip.classList?.toggle('is-current',active);
  chip.setAttribute?.('aria-pressed',String(active));
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
 const cards=groups.map(g=>
  '<section class="print-model-card">'+
  '<div class="print-model-photo">'+
   (g.imagePath&&photoUrls[g.imagePath]?
    '<img class="lot-photo" src="'+esc(photoUrls[g.imagePath])+'" alt="Foto do modelo '+esc(g.title)+'">':
    '<span class="print-model-no-photo">Sem foto</span>')+
  '</div><div class="print-model-details">'+
  '<div class="print-model-title">'+esc(g.title)+' · '+g.lines.length+
    ' variação(ões) · '+n(g.total)+' unidades</div>'+
  '<table><thead><tr>'+
   '<th style="width:14%">Variação</th><th style="width:22%">Gôndola / local</th>'+
   '<th style="width:15%">SKU</th><th style="width:21%">EAN</th>'+
   '<th style="width:9%">Qtde</th><th style="width:12%">Separado</th><th style="width:7%">✓</th>'+
  '</tr></thead><tbody>'+
  g.lines.map(l=>'<tr>'+
   '<td>'+esc([l.color,l.size].filter(x=>x&&x!=='Única').join(' · ')||'Único')+'</td>'+
   '<td>'+esc(l.gondola?'Gôndola '+l.gondola:'Não informada')+(l.prateleira?' / '+esc(l.prateleira):'')+'</td>'+
   '<td>'+esc(l.sku||'—')+'</td><td>'+esc(l.ean||'—')+'</td>'+
   '<td class="center"><b>'+n(l.quantity)+'</b></td>'+
   '<td class="write"></td><td class="center check"></td></tr>').join('')+
  '</tbody></table></div></section>').join('');
 const name='PEDIDO';
 const code=order.kind==='evento'?'Pedido '+String(order.sequence||'').padStart(2,'0'):'Pedido';
 const reserve=order.reserved>0?' · Reservado: '+n(order.reserved):'';
 const shortage=order.missing>0?' · Faltando: '+n(order.missing):'';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
  '<title>Separação '+esc(code)+' '+esc(order.code||'—')+'</title>'+
  '<style>@page{size:A4 portrait;margin:10mm 10mm 12mm}*{box-sizing:border-box}'+
  'body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#192f24;margin:0}'+
  'header{display:flex;justify-content:space-between;gap:14px;border-bottom:2px solid #155f42;padding-bottom:7px;margin-bottom:9px}'+
  '.brand{font-size:13pt;color:#176747;font-weight:900;letter-spacing:.2pt}h1{font-size:13pt;margin:2px 0 4px}'+
  '.reference{font-size:8pt;color:#66796d;overflow-wrap:anywhere}.meta{text-align:right;line-height:1.4;font-size:8pt}'+
  '.header-note{font-size:8pt;margin:7px 0 11px;padding:6px;background:#f3f7f3;border:1px solid #dee8e0}'+
  '.print-model-card{display:grid;grid-template-columns:32mm minmax(0,1fr);border:1px solid #b8cfc0;margin:8px 0;break-inside:avoid-page;overflow:hidden}'+
  '.print-model-photo{background:#f3f7f4;border-right:1px solid #b8cfc0;min-height:110px;align-self:stretch;display:flex;align-items:stretch;justify-content:center;overflow:hidden}'+
  '.lot-photo{display:block;width:100%;height:100%;min-height:110px;object-fit:cover}'+
  '.print-model-no-photo{align-self:center;color:#879b89;font-size:8pt}'+
  '.print-model-details{min-width:0}.print-model-title{font-size:8.3pt;font-weight:800;background:#edf5ef;color:#1a5036;padding:7px 6px;line-height:1.3}'+
  'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}'+
  'th,td{border:1px solid #bdcdc1;border-left:0;padding:4px 5px;vertical-align:middle;overflow-wrap:anywhere}'+
  'th:last-child,td:last-child{border-right:0}tbody tr:last-child td{border-bottom:0}'+
  'th{background:#eaf2ec;font-size:7.5pt}td{font-size:7.7pt;line-height:1.2}'+
  'tr{break-inside:avoid}.center{text-align:center;font-variant-numeric:tabular-nums}'+
  '.write{height:22px}.check{height:22px}.totals{font-size:8.5pt;margin-top:10px;padding:6px 0;border-top:1px solid #9cb7a3}'+
  '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:29px}'+
  '.signatures>div{border-top:1px solid #53665a;text-align:center;padding-top:5px;font-size:8pt}'+
  '.instructions{font-size:7.5pt;color:#526658;margin-top:9px}'+
  '</style></head><body>'+
  '<header><div><div class="brand">'+esc(brand)+'</div><h1>SEPARAÇÃO · '+name+'</h1>'+
  '<div class="reference">'+esc(code)+' #'+esc(order.code||'—')+'</div>'+
  '</div>'+
  '<div class="meta"><b>DESTINO: '+esc(order.target)+'</b><div>Origem: '+esc(order.origin)+'</div>'+
  '<div>Emissão: '+esc(printedAt)+'</div></div></header>'+
  '<div class="header-note"><b>'+n(groups.length)+' modelo(s) · '+n(order.lines.length)+' variação(ões) · '+
   n(order.total)+' unidades solicitadas</b>. Marque somente após encontrar cada item.</div>'+
  cards+
  '<div class="totals"><b>Total solicitado: '+n(order.total)+' unidades'+reserve+shortage+
   '</b><div>Observações / divergências: _________________________________________________</div></div>'+
  '<div class="signatures"><div>Separador · assinatura / hora</div><div>Conferente · assinatura / hora</div></div>'+
  '<p class="instructions">Mantenha esta folha junto das mercadorias deste pedido. O envio físico só será registrado após confirmação no sistema.</p>'+
  '<script>window.addEventListener("load",()=>{Promise.all(Array.from(document.images,im=>im.complete?Promise.resolve():new Promise(resolve=>{im.onload=resolve;im.onerror=resolve}))).then(()=>{window.focus();window.print()})});</script></body></html>';
}
