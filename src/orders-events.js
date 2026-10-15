// Cards do histórico logístico por modelo e gestão de pedidos avulsos.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>Number(n||0).toLocaleString('pt-BR');
const labelVariant=(product,isModel)=>isModel?[product.apparel_color,product.apparel_size].filter(Boolean).join(' · ')||product.name:product.name;
export function eventHistoryCards({movements,products,models,balances,photoButton,groupInventory}){
  const relevant=movements.filter(m=>['transferencia','devolucao','baixa_evento','venda_evento'].includes(m.action));
  const productIds=new Set(relevant.map(m=>m.product_id));
  for(const balance of balances)if(balance.quantity>0)productIds.add(balance.product_id);
  const byId=new Map(products.map(p=>[p.id,p]));
  const groups=groupInventory([...productIds].map(id=>byId.get(id)).filter(Boolean),models);
  if(!groups.length)return '<div class="muteblock">Nenhum produto movimentado neste evento.</div>';
  return '<div class="event-logistics-cards">'+groups.map(group=>{
    const summary={sent:0,returned:0,unreturned:0,pending:0};
    const rows=group.products.map(p=>{
      const pm=relevant.filter(m=>m.product_id===p.id);
      const sent=pm.filter(m=>m.action==='transferencia').reduce((a,m)=>a+m.quantity,0);
      const returned=pm.filter(m=>m.action==='devolucao').reduce((a,m)=>a+m.quantity,0);
      const unreturned=pm.filter(m=>['baixa_evento','venda_evento'].includes(m.action)).reduce((a,m)=>a+m.quantity,0);
      const pending=balances.filter(b=>b.product_id===p.id).reduce((a,b)=>a+b.quantity,0);
      summary.sent+=sent;summary.returned+=returned;summary.unreturned+=unreturned;summary.pending+=pending;
      return '<div class="event-logistics-row">'+
        '<div class="event-logistics-variant"><strong>'+esc(labelVariant(p,!!group.modelId))+'</strong>'+
          '<small>SKU: '+esc(p.sku||'—')+'</small><small>EAN: '+esc(p.ean||'—')+'</small></div>'+
        '<div class="event-logistics-quantities">'+
          '<div><span>Separado</span><strong>'+format(sent)+'</strong></div>'+
          '<div><span>Voltou</span><strong class="qty-green">'+format(returned)+'</strong></div>'+
          '<div><span>Pendente</span><strong class="qty-orange">'+format(pending)+'</strong></div>'+
          '<div><span>Não voltou</span><strong>'+format(unreturned)+'</strong></div>'+
        '</div></div>';
    }).join('');
    return '<article class="event-logistics-card"><div class="event-logistics-head">'+
      '<div class="event-logistics-photo">'+photoButton(group.main)+'</div>'+
      '<div class="event-logistics-info"><strong>'+esc(group.title)+'</strong>'+
      '<small>'+group.products.length+' variação(ões) movimentada(s)</small>'+
      '<div class="event-logistics-summary"><span>Enviado <b>'+format(summary.sent)+'</b></span>'+
      '<span>Retornou <b>'+format(summary.returned)+'</b></span>'+
      '<span>Não voltou <b>'+format(summary.unreturned)+'</b></span>'+
      '<span>Pendente <b>'+format(summary.pending)+'</b></span></div></div></div>'+
      '<div class="event-logistics-row-heading">Histórico por tamanho</div>'+
      '<div class="event-logistics-rows">'+rows+'</div></article>';
  }).join('')+'</div>';
}
export function ordersPageMarkup({orders,items,events,photoButton,button,niceTime}){
 const eventMap=new Map(events.map(e=>[e.id,e]));
 if(!orders.length)return '<div class="orders-empty">Ainda não há pedidos cadastrados. Crie um pedido no sistema ou compartilhe um produto pelo WhatsApp.</div>';
 return '<div class="avulso-order-list">'+orders.map(order=>{
   const variants=items.filter(x=>x.order_id===order.id);
   const total=variants.reduce((n,x)=>n+Number(x.quantity),0);
   return '<article class="avulso-order-card"><div class="avulso-order-head">'+
     '<div><small>Pedido #'+esc(order.code||'—')+'</small>'+
     '<h3>'+esc(order.customer_name)+'</h3>'+
     '<a href="tel:'+esc(order.customer_phone)+'">'+esc(order.customer_phone)+'</a></div>'+
     '<div class="avulso-order-meta"><span>'+esc(niceTime(order.created_at))+'</span>'+
       '<span class="pill">'+(order.source==='compartilhado'?'Link de produto':order.source==='cliente'?'Acesso de cliente':'Cadastro interno')+'</span></div></div>'+
     '<div class="avulso-order-lines">'+variants.map(item=>
       '<div class="avulso-order-line"><div><strong>'+esc(item.product_name)+'</strong>'+
       '<small>'+esc([item.color,item.size].filter(Boolean).join(' · '))+'</small>'+
       '<small>SKU '+esc(item.sku||'—')+' · EAN '+esc(item.ean||'—')+'</small></div>'+
       '<b>'+format(item.quantity)+' un.</b></div>').join('')+'</div>'+
     '<div class="avulso-order-foot"><div><strong>'+total+' un. solicitada(s)</strong>'+
       '<small>Evento: '+esc(eventMap.get(order.event_id)?.name||'Não vinculado')+'</small></div>'+
       button(order.event_id?'Alterar evento':'Vincular a evento','order-assign-event','data-id="'+esc(order.id)+'"','small')+
     '</div></article>';
 }).join('')+'</div>';
}
export function createInternalOrderForm({products,models,events,groupInventory}){
 const groups=groupInventory(products.filter(p=>p.active),models);
 const groupCards=groups.map(group=>
   '<section class="avulso-create-group" data-order-group data-search="'+esc([group.title,...group.products.flatMap(p=>[p.name,p.sku,p.ean,p.apparel_size,p.apparel_color])].join(' ').toLocaleLowerCase('pt-BR'))+'">'+
   '<strong>'+esc(group.title)+'</strong>'+
   group.products.map(p=>
     '<label class="avulso-create-row"><span>'+esc(labelVariant(p,!!group.modelId))+
       '<small>SKU '+esc(p.sku||'—')+' · EAN '+esc(p.ean||'—')+'</small></span>'+
       '<input data-order-q data-product-id="'+esc(p.id)+'" type="number" min="0" max="1000" step="1" inputmode="numeric" value="0" aria-label="Unidades de '+esc(p.name)+'"></label>'
   ).join('')+'</section>'
 ).join('');
 return '<div class="formgrid">'+
   '<label class="field"><span>Nome completo *</span><input name="customer_name" required minlength="2" maxlength="120"></label>'+
   '<label class="field"><span>Telefone com DDD *</span><input name="customer_phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="(65) 99999-9999"></label>'+
   '<label class="field wide"><span>Vincular a evento (opcional)</span><select name="event_id"><option value="">Sem evento</option>'+
     events.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+' ('+esc(e.status)+')</option>').join('')+'</select></label>'+
   '</div><p class="help">Pedido reserva automaticamente as unidades livres na central, sem baixa física. Faltas ficam pendentes para conferência; o vínculo com evento é apenas informativo.</p>'+
   '<label class="field"><span>Buscar produto</span><input type="search" data-order-search autocomplete="off" placeholder="Nome, tamanho, SKU ou EAN"></label>'+
   '<div class="avulso-create-list">'+groupCards+'</div>'+
   '<div class="avulso-order-selected" data-order-selected>Informe a quantidade de cada variação desejada.</div>';
}
export function collectInternalOrder(form){
 const rows=[...form.querySelectorAll('[data-order-q]')],items=[];
 for(const input of rows){
  const raw=input.value.trim();
  if(!/^[0-9]{1,4}$/.test(raw))throw new Error('Quantidade inválida no pedido.');
  const quantity=Number(raw);
  if(quantity>1000)throw new Error('Máximo 1.000 por variação.');
  if(quantity>0)items.push({product_id:input.dataset.productId,quantity});
 }
 if(!items.length)throw new Error('Informe pelo menos uma quantidade.');
 if(items.length>40||items.reduce((a,b)=>a+b.quantity,0)>2000)throw new Error('Pedido muito grande. Divida em dois pedidos.');
 return items;
}
