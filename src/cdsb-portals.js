// Interfaces operacionais do CDSB (somente apresentação; acesso é validado pelo servidor).
const h=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const labels={solicitado:'Recebido',pendente_estoque:'Aguardando estoque',aprovado:'A separar',reservado:'A separar',
 aguardando:'A separar',em_separacao:'Em separação',separado:'Separado',despachado:'Enviado',
 concluido:'Concluído',recebido:'Entregue',cancelado:'Cancelado',enviado:'Enviado',
 recebido_divergente:'Entregue com divergência',expirado:'Expirado',legado:'Aguardando análise'};
const finished=new Set(['recebido','concluido','cancelado','expirado','recebido_divergente']);
export function pickerHome(orders,{button,time}){
 const work=orders.filter(o=>!finished.has(o.status));
 const ready=work.filter(o=>['aprovado','reservado','aguardando'].includes(o.status));
 const started=work.filter(o=>o.status==='em_separacao');
 const separated=work.filter(o=>o.status==='separado');
 const totals=[['A separar',ready.length],['Em andamento',started.length],['Separados',separated.length]];
 return '<div class="cdsb-portal"><header class="cdsb-portal-head"><div><small>CDSB · Operação</small>'+
  '<h1>Separação de pedidos</h1><p>Confira os produtos e salve a separação. A saída física é confirmada por um responsável autorizado.</p></div>'+
  button('Ver todos os pedidos','view','data-view="pedidos"','primary')+'</header>'+
  '<div class="cdsb-stats">'+totals.map(([name,qty])=>
   '<div><strong>'+qty+'</strong><span>'+name+'</span></div>').join('')+'</div>'+
  '<section class="panel cdsb-queue"><div class="panelhead"><h2>Próximos pedidos</h2></div>'+
  (work.length?work.slice(0,30).map(o=>{
   const action=o.kind==='evento'?'event-batch-pick':o.kind==='loja'?'store-order-separate':'avulso-pick';
   const eligible=['aprovado','aguardando','reservado','em_separacao'].includes(o.status);
   const status=h(labels[o.status]||o.status);
   return '<article class="cdsb-queue-item"><div><strong>'+h(o.target)+'</strong>'+
    '<small>Pedido #'+h(o.code||'—')+' · '+Number(o.total||0)+' unidades · '+h(time(o.created_at))+'</small></div>'+
    '<span class="cdsb-status">'+status+'</span><div class="cdsb-queue-actions">'+
     (o.lines?.length?button('Imprimir 80 mm','order-print-thermal','data-kind="'+h(o.kind)+'" data-id="'+h(o.id)+'"','small'):'')+
     (eligible?button('Separar',''+action,'data-kind="'+h(o.kind)+'" data-id="'+h(o.id)+'"','primary'):'')+
    '</div></article>';
  }).join(''):'<p class="cdsb-empty">Nenhum pedido pendente.</p>')+'</section></div>';
}
export function permanentHome({stores=[],orders=[],button,time,userId}){
 const active=orders.filter(o=>!finished.has(o.status));
 const history=orders.filter(o=>finished.has(o.status));
 const display=stores.length===1?stores[0]?.name:'Minhas Lojas';
 const list=rows=>rows.slice(0,16).map(o=>
   '<article class="cdsb-order-row"><div><strong>Pedido #'+h(o.code||'—')+'</strong>'+
   '<small>'+h(time(o.created_at))+' · '+h((stores.find(s=>s.id===o.to_store_id)?.name)||'Minha loja')+'</small></div>'+
   '<span class="cdsb-status">'+h(labels[o.status]||o.status)+'</span>'+ 
   button('Imprimir pedido','commercial-order-print','data-id="'+h(o.id)+'"','small')+
   (o.status==='despachado'?button('Confirmar entrega','commercial-confirm-delivery','data-id="'+h(o.id)+'"','small primary'):'')+
   '</article>').join('');
 return '<div class="cdsb-portal"><header class="cdsb-portal-head"><div><small>CDSB · Área da loja</small>'+
   '<h1>'+h(display)+'</h1><p>Solicite mercadorias ao CDSB e acompanhe seus pedidos. Seu estoque interno não é controlado aqui.</p></div>'+
  button('+ Novo pedido','store-order-new','','primary')+'</header>'+
  '<div class="cdsb-stats"><div><strong>'+active.length+'</strong><span>Em andamento</span></div>'+
   '<div><strong>'+history.length+'</strong><span>No histórico</span></div></div>'+
  '<section class="panel"><div class="panelhead"><h2>Meus pedidos</h2></div>'+
   (active.length?list(active):'<p class="cdsb-empty">Não há pedidos em andamento.</p>')+'</section>'+
  '<section class="panel"><div class="panelhead"><h2>Histórico de pedidos</h2></div>'+
   (history.length?list(history):'<p class="cdsb-empty">Nenhum pedido concluído.</p>')+'</section></div>';
}
export function temporaryHome({events=[],balances=[],batches=[],button,time}){
 return '<div class="cdsb-portal"><header class="cdsb-portal-head"><div><small>CDSB · Lojas temporárias</small>'+
  '<h1>Meus eventos</h1><p>Controle dos produtos enviados, devolvidos e avariados. O CDSB não registra vendas do evento.</p></div></header>'+
  (events.length?events.map(e=>{
   const received=balances.filter(b=>b.event_id===e.id).reduce((n,b)=>n+Number(b.quantity||0),0);
   const requests=batches.filter(b=>b.event_id===e.id);
   return '<section class="panel cdsb-event-unit"><div><h2>'+h(e.name)+'</h2><small>'+h(e.status)+
    ' · '+requests.length+' pedido(s) · '+received+' unidades pendentes de conferência</small></div>'+
    '<div class="cdsb-queue-actions">'+
    (e.status!=='encerrado'?button('Solicitar produtos','event-batch-new','data-event="'+h(e.id)+'"','primary'):'')+
    button('Pedidos e conferência','event-detail','data-id="'+h(e.id)+'"','small')+
    button('Imprimir conferência','event-print-summary','data-id="'+h(e.id)+'"','small')+
    '</div></section>';
  }).join(''):'<section class="panel"><p class="cdsb-empty">Ainda não existe uma loja temporária vinculada à sua conta.</p></section>')+
  '<p class="cdsb-hint">Ao encerrar, informe apenas produtos bons devolvidos, avariados e quantidades não devolvidas. O CDSB não acompanha vendas.</p></div>';
}
