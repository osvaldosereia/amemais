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
  if(!groups.has(key))groups.set(key,{key,title:line.modelTitle||line.name,lines:[]});
  groups.get(key).lines.push(line);
 }
 return [...groups.values()].map(g=>({
  ...g,total:g.lines.reduce((n,l)=>n+l.quantity,0),
  reserved:g.lines.reduce((n,l)=>n+l.reserved,0),
  missing:g.lines.reduce((n,l)=>n+l.missing,0)
 }));
}
export function unifiedOrderCard(o,{button=()=>'',canProcess=false,canCancel=false,canReceive=false,portal=false,time=x=>x}={}){
 const info=statuses[o.status]||[o.status,'pending'];
 const data='data-id="'+esc(o.id)+'" data-kind="'+o.kind+'"';
 const process=canProcess&&!portal;
 const actions=[];
 if(process&&['legado','solicitado','pendente_estoque'].includes(o.status)){
  actions.push(button('Rever reservas','order-retry',data,'small primary'));
 }
 if(process&&['pendente_estoque','reservado','aprovado'].includes(o.status)){
  actions.push(button('Ajustar quantidades','order-shortage-adjust',data,'small'));
 }
 if(process&&(o.status==='reservado'||o.status==='aprovado'))
  actions.push(button('Conferir separação',o.kind==='avulso'?'avulso-pick':'store-order-separate',data,'small primary'));
 if(process&&o.status==='separado')
  actions.push(button('Confirmar saída',o.kind==='avulso'?'avulso-dispatch':'store-order-dispatch',data,'small primary'));
 if(canReceive&&o.kind==='loja'&&o.status==='despachado')
  actions.push(button('Conferir recebimento','store-order-receive',data,'small primary'));
 if(!portal&&!['cancelado','expirado'].includes(o.status)&&o.lines.length)
  actions.push(button('Imprimir A4','order-print-a4',data,'small'));
 if(canCancel&&['legado','solicitado','pendente_estoque','aprovado','reservado','separado'].includes(o.status))
  actions.push(button('Cancelar',o.kind==='avulso'?'avulso-cancel':'store-order-cancel',data,'small danger'));
 const badges=o.kind==='avulso'?(o.raw.source==='cliente'?'Cliente catálogo':
  o.raw.source==='compartilhado'?'Cliente link':'Pedido avulso'):
  o.raw.request_type==='franquia'?'Franquia':'Filial';
 const terminal=['despachado','concluido','recebido','recebido_divergente','cancelado','expirado'].includes(o.status);
 const unchecked=['legado','solicitado'].includes(o.status);
 const lineRows=o.lines.map(l=>'<div class="uo-sku"><div class="uo-sku-name"><strong>'+
  esc(l.name)+'</strong><small>'+esc([l.color,l.size].filter(Boolean).join(' · '))+
  ' · SKU '+esc(l.sku||'—')+' · EAN '+esc(l.ean||'—')+'</small>'+
  (l.gondola?'<small>Gôndola '+esc(l.gondola)+'</small>':'')+'</div>'+
  '<div class="uo-sku-stats"><span>'+n(l.quantity)+' solicit.</span>'+
    (portal?'':terminal?'<span>'+(['cancelado','expirado'].includes(o.status)?'Liberado':'Saída registrada')+'</span>':
     unchecked?'<span>Reserva não avaliada</span>':
     ('<span>'+n(l.reserved)+' reserv.</span><span class="'+(l.missing?'is-short':'')+'">'+
      n(l.missing)+' faltam</span>'))+'</div></div>').join('');
 return '<article class="uo-card" data-order-card data-search="'+esc([
    o.id,o.target,o.origin,badges,...o.lines.flatMap(l=>[l.name,l.sku,l.ean])].join(' ').toLocaleLowerCase('pt-BR'))+
   '" data-order-status="'+esc(o.status)+'">'+
   '<header><div class="uo-head"><small>'+esc(badges)+' · '+esc(time(o.created_at))+'</small>'+
    '<h3>Pedido #'+esc(o.id.slice(0,8).toUpperCase())+'</h3>'+
    '<strong>'+esc(o.target)+'</strong></div><span class="uo-pill '+info[1]+'">'+esc(info[0])+'</span></header>'+
   '<div class="uo-metrics"><span>'+n(o.total)+' solicitadas</span>'+
    (portal?'':terminal?'<span>Reserva encerrada</span>':unchecked?'<span>Reserva não avaliada</span>':
     ('<span>'+n(o.reserved)+' reservadas</span>'+
      (o.missing?'<span class="uo-alert">'+n(o.missing)+' em falta</span>':'<span class="uo-ok">Sem faltas</span>')))+
   '</div>'+
   (o.missing&&!portal?'<p class="uo-shortage">Há itens não disponíveis. As unidades livres já foram reservadas; confira os SKUs pendentes abaixo.</p>':'')+
   (o.status==='legado'?'<p class="uo-shortage">Pedido antigo preservado. Clique em Rever reservas para iniciar sua separação.</p>':'')+
   (o.status==='expirado'?'<p class="uo-shortage">Reserva externa expirada. O pedido permanece no histórico.</p>':'')+
   '<details class="uo-details"><summary>Ver itens e quantidades ('+o.lines.length+')</summary>'+
     '<div>'+lineRows+'</div>'+
     (o.adjustments.length?'<div class="uo-audit"><strong>Ajustes justificados</strong>'+
      o.adjustments.slice(-8).map(a=>'<p>'+esc(a.original_quantity)+' → '+
       esc(a.revised_quantity)+' un. · '+esc(a.reason)+'</p>').join('')+'</div>':'')+
    '</details>'+
   (o.externalReference?'<small>Referência externa: '+esc(o.externalReference)+'</small>':'')+
   '<div class="uo-actions">'+actions.join('')+'</div></article>';
}
export function unifiedOrdersPage(orders,{
 button=()=>'',time=x=>x,portal=false,
 canProcess=()=>false,canCancel=()=>false,canReceive=()=>false,
 canAvulso=false,canStore=false,canLink=false,linksMarkup='',summaryLink=''
}={}){
 const backlog=orders.filter(o=>['legado','solicitado','reservado','aprovado','separado'].includes(o.status)).length;
 const missing=orders.filter(o=>o.status==='pendente_estoque').length;
 const done=orders.filter(o=>['concluido','recebido','recebido_divergente'].includes(o.status)).length;
 const cards=orders.map(o=>unifiedOrderCard(o,{button,time,portal,canProcess:canProcess(o),canCancel:canCancel(o),canReceive:canReceive(o)})).join('');
 const actions=((canAvulso||canStore)?button(portal?'+ Montar pedido':'+ Novo pedido','unified-order-new','','primary'):'')+
  (canLink?button('+ Link para cliente','customer-link-new','','small'):'');
 return '<section class="uo-page">'+
  '<div class="pagehead"><div><h1>Pedidos</h1><p>Recebimento, reserva, separação e saída em uma única fila.</p></div>'+
  '<div class="actions">'+actions+'</div></div>'+
  '<div class="uo-summary"><div><small>A separar</small><strong>'+backlog+'</strong></div>'+
   '<div><small>Com falta</small><strong>'+missing+'</strong></div>'+
   '<div><small>Concluídos</small><strong>'+done+'</strong></div></div>'+
  '<div class="uo-tools"><label class="uo-search">Buscar<input type="search" data-unified-search placeholder="Pedido, cliente, SKU ou EAN…" autocomplete="off"></label>'+
   '<label class="uo-filter">Situação<select data-unified-status><option value="todos">Todos</option>'+
   '<option value="pendentes">A separar</option><option value="pendente_estoque">Com falta</option>'+
   '<option value="concluidos">Concluídos</option><option value="encerrados">Cancelados / expirados</option></select></label></div>'+
  '<div class="uo-list">'+(orders.length?cards:'<p class="muted">Nenhum pedido registrado.</p>')+'</div>'+
  '<p class="uo-empty-filter" data-unified-empty hidden>Nenhum pedido para este filtro.</p>'+
  (!portal&&canLink?'<details class="uo-customer-links"><summary>Links de acesso para clientes'+
   (summaryLink?' · '+esc(summaryLink):'')+'</summary>'+linksMarkup+'</details>':'')+
  '<p class="help">Reservar não altera o estoque físico. A baixa acontece apenas após conferir a separação e confirmar a saída. Pedidos de filiais preservam a etapa adicional de recebimento.</p>'+
 '</section>';
}
export function filterUnifiedOrders(container,query,status){
 const q=String(query||'').trim().toLocaleLowerCase('pt-BR');
 let visible=0;
 for(const card of container.querySelectorAll('[data-order-card]')){
  const s=card.dataset.orderStatus;
  const match=status==='todos'||!status||
    (status==='pendentes'&&['legado','solicitado','reservado','aprovado','separado','despachado'].includes(s))||
    (status==='concluidos'&&['concluido','recebido','recebido_divergente'].includes(s))||
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
 return '<p class="help">Confira cada tamanho por leitura EAN ou quantidade manual. A separação não reduz o físico.</p>'+
 '<div class="uo-pick-toolbar"><button type="button" class="button" data-action="order-scan-ean">📷 Ler EAN</button>'+
 '<span>Conferido: <b data-picked-total>0</b> de '+n(order.total)+' unidades</span></div>'+
 '<div class="uo-picking">'+order.lines.map(l=>
 '<div class="store-picking-line" data-picking-row="'+h(l.id)+'">'+
 '<div><strong>'+h(l.name)+'</strong><small>'+h([l.color,l.size,l.sku,l.ean].filter(Boolean).join(' · '))+
 '</small><small>Reservadas: '+l.reserved+' un. · Gôndola '+h(l.gondola||'—')+'</small></div>'+
 '<label>Conferido<input type="number" data-pick-qty data-id="'+h(l.id)+'" data-expected="'+l.quantity+
 '" min="0" max="'+l.quantity+'" step="1" inputmode="numeric" value="0"></label></div>').join('')+'</div>';
}
export function shortageEditRows(order,{h=esc}={}){
 return '<p class="help">Se o estoque não atender ao pedido, você pode reduzir quantidades justificadamente ou aguardar reposição. A quantidade original fica no histórico. Zero retira o SKU deste atendimento.</p>'+
 '<div class="uo-picking">'+order.lines.map(l=>'<div class="store-picking-line">'+
 '<div><strong>'+h(l.name)+'</strong><small>'+h([l.color,l.size,l.sku,l.ean].filter(Boolean).join(' · '))+
 '</small><small>Solicitado '+l.quantity+' · Reservado '+l.reserved+' · Falta '+l.missing+'</small></div>'+
 '<label>Atender<input type="number" data-shortage-qty data-id="'+h(l.id)+'" data-original="'+l.quantity+
 '" min="0" max="'+l.quantity+'" step="1" inputmode="numeric" value="'+l.quantity+'"></label></div>').join('')+'</div>'+
 '<label class="field">Justificativa obrigatória<textarea name="reason" minlength="5" maxlength="250" required placeholder="Ex.: furo identificado na separação"></textarea></label>';
}
export function pickingA4HTML(order,{printedAt='',brand='AME+ STORE'}={}){
 const rows=order.lines.map(l=>'<tr><td>'+esc(l.name)+'</td><td>'+esc([l.color,l.size].filter(Boolean).join(' · '))+
 '</td><td>'+esc(l.sku||'—')+'</td><td>'+esc(l.ean||'—')+'</td>'+
 '<td class="center"><b>'+l.quantity+'</b></td><td class="center">'+l.reserved+'</td>'+
 '<td class="hand"></td><td class="center">□</td></tr>').join('');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Separação '+esc(order.id)+'</title>'+
 '<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#192d22}'+
 'header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #176747;padding-bottom:12px;margin-bottom:16px}'+
 'h1{font-size:19px;margin:4px 0}.brand{font-size:22px;color:#176747;font-weight:900}'+
 'table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #afc5b7;padding:7px 5px;word-break:break-word}'+
 'th{background:#ecf5ed}th,td{font-size:9px}.center{text-align:center}.hand{height:28px}'+
 '.summary{margin-top:15px;border:1px solid #bad2bf;padding:12px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px}'+
 '.signatures>div{border-top:1px solid #476453;padding:7px;text-align:center}'+
 '@media print{tr{break-inside:avoid}}</style></head><body>'+
 '<header><div><div class="brand">'+esc(brand)+'</div><h1>LISTA DE SEPARAÇÃO</h1>'+
 '<span>Pedido #'+esc(order.id.slice(0,8).toUpperCase())+'</span></div>'+
 '<div><b>'+esc(order.target)+'</b><p>Origem: '+esc(order.origin)+'</p><p>Impresso em: '+esc(printedAt)+'</p></div></header>'+
 '<table><thead><tr><th>Produto</th><th>Cor / tam.</th><th>SKU</th><th>EAN</th>'+
 '<th>Pedido</th><th>Reserv.</th><th>Separado</th><th>Conf.</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<div class="summary"><b>Total solicitado: '+n(order.total)+' unidades · Reservado: '+n(order.reserved)+
 ' · Faltando: '+n(order.missing)+'</b><p>Observações e divergências: _______________________________________________</p></div>'+
 '<div class="signatures"><div>Separado por / Data</div><div>Conferido por / Data</div></div>'+
 '<script>window.addEventListener("load",()=>{window.focus();window.print()});<\/script></body></html>';
}
