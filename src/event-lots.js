// Pedidos independentes das lojas temporárias, compartilhando a fila operacional.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('pt-BR');
export function selectedEventModels(items,products){
 const byId=new Map(products.map(p=>[p.id,p])),keys=new Set();
 for(const item of items){
  if(Number(item.quantity||0)<1)continue;
  const p=byId.get(item.product_id);
  if(p)keys.add(p.apparel_model_id||p.id);
 }
 return keys.size;
}
export function eventLotForm(formHTML,{edit=false,number=null,note=''}={}){
 return '<div class="event-lot-counter" data-event-lot-counter aria-live="polite">0 modelos · 0 unidades</div>'+
  formHTML+
  '<label class="field lot-note"><span>Observação do pedido (opcional)</span>'+
  '<input type="text" name="note" maxlength="180" value="'+esc(note)+'" placeholder="Ex.: reposição de sábado"></label>';
}
export function eventLotsOverview({event,batches,items,products,button,canCreate=false,time=x=>x,codeForBatch=()=> '—'}){
 const scoped=batches.filter(b=>b.event_id===event.id).sort((a,b)=>a.sequence-b.sequence);
 const states={pendente_estoque:['Aguardando estoque','warning'],aguardando:['A separar','ready'],
  em_separacao:['Em separação','ready'],separado:['Separado','ready'],
  enviado:['Enviado','complete'],cancelado:['Cancelado','closed']};
 return '<section class="event-lots-section"><div class="event-lots-title"><div><h2>Pedidos da loja temporária</h2>'+
  '<p>Faça novos pedidos sempre que precisar. Cada pedido é independente, sem subdivisões, e segue para a fila de separação do CD.</p></div>'+
  (canCreate&&event.status!=='encerrado'?button('+ Novo pedido','event-batch-new','data-event="'+esc(event.id)+'"','primary'):'')+
 '</div><div class="event-lots-list">'+(scoped.length?scoped.map(b=>{
  const info=states[b.status]||[b.status,'pending'];
  const rows=items.filter(i=>i.batch_id===b.id);
  const units=rows.reduce((n,l)=>n+Number(l.quantity),0);
  const count=selectedEventModels(rows,products);
  const picked=rows.reduce((n,l)=>n+Number(l.picked),0);
  return '<div class="event-lot-row"><div><strong>Pedido #'+esc(codeForBatch(b.id))+
   '</strong><small>Solicitação '+String(b.sequence).padStart(2,'0')+' · '+fmt(count)+' modelos · '+fmt(rows.length)+' variações · '+fmt(units)+' un.</small>'+
   '<small>'+fmt(picked)+' un. conferidas · '+esc(time(b.created_at))+'</small></div>'+
   '<span class="uo-pill '+info[1]+'">'+esc(info[0])+'</span>'+
   button('Ver na separação','event-batch-go','data-id="'+esc(b.id)+'"','small')+
  '</div>';
 }).join(''):'<p class="muted">Nenhum pedido criado ainda. Faça o primeiro pedido para essa loja.</p>')+
 '</div></section>';
}
