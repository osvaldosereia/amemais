import {findProductByCode} from './product-code-search.js?v=20261027lookup1';
// Montagem de pedidos de lojas e franquias: estado local, sem criar reservas
// até que o usuário revise e confirme o pedido.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
export function makeOrderCatalog(products=[],models=[],availability=()=>0,minimum=()=>0){
 const modelMap=new Map(models.map(m=>[m.id,m]));
 const groups=new Map();
 for(const p of products){
  if(p.active===false)continue;
  const model=modelMap.get(p.apparel_model_id);
  const key=p.apparel_model_id||p.id;
  const title=model?.name||p.name||'Produto';
  if(!groups.has(key))groups.set(key,{key,title,photo:model?.image_path||p.image_path||'',variants:[]});
  const g=groups.get(key);
  g.photo ||=p.image_path||'';
  g.variants.push({id:p.id,name:p.name||title,color:p.apparel_color||'',size:p.apparel_size||'',
    sku:p.sku||'',ean:p.ean||'',gondola:p.gondola||'',
    available:Math.max(0,Number(availability(p))||0),min:Math.max(0,Number(minimum(p))||0)});
 }
 for(const g of groups.values()){
  g.variants.sort((a,b)=>collator.compare(a.size,b.size)||collator.compare(a.color,b.color)||collator.compare(a.sku,b.sku));
  g.search=norm([g.title,...g.variants.flatMap(v=>[v.name,v.color,v.size,v.sku,v.ean,v.gondola])].join(' '));
 }
 return [...groups.values()].sort((a,b)=>collator.compare(a.title,b.title));
}
export function searchOrderCatalog(groups=[],text=''){
 const q=norm(text);return !q?groups:groups.filter(g=>g.search.includes(q));
}
export function orderCartSummary(groups=[],selection=new Map()){
 let models=0,skus=0,units=0,available=0;
 for(const g of groups){
  let groupHasQty=false;
  for(const v of g.variants){
   const qty=Number(selection.get(v.id)||0);
   if(qty>0){
    groupHasQty=true;skus++;units+=qty;available+=Math.min(qty,v.available);
   }
  }
  if(groupHasQty)models++;
 }
 return {models,skus,units,available,missing:units-available};
}
export function selectedOrderCartItems(groups=[],selection=new Map()){
 const result=[];
 for(const g of groups)for(const v of g.variants){
  const qty=Number(selection.get(v.id)||0);
  if(qty>0)result.push({product_id:v.id,quantity:qty});
 }
 return result;
}
export function orderCartMarkup(groups=[],{destination='',showAvailable=true}={}){
 return '<div class="order-cart-workspace" data-order-cart>'+
  '<div class="order-cart-destination"><small>Destino do pedido</small><strong>'+esc(destination)+'</strong>'+
   '<span>Um pedido independente · A reserva será feita após a confirmação</span></div>'+
  '<div class="order-cart-layout"><section class="order-cart-catalog">'+
   '<label class="order-cart-search-label">Pesquisar produto, variação, SKU ou EAN'+
    '<input type="search" autocomplete="off" data-order-cart-search placeholder="Pesquisar ou ler o código de barras" aria-label="Pesquisar produtos"></label>'+
   '<div class="order-cart-tabs" role="group" aria-label="Visualização do carrinho">'+
    '<button type="button" data-action="order-cart-view" data-view="catalog" aria-pressed="true" class="is-current">Explorar produtos</button>'+
    '<button type="button" data-action="order-cart-view" data-view="selected" aria-pressed="false">Minha seleção <b data-order-cart-count>0</b></button></div>'+
   '<p class="order-cart-results-caption" data-order-cart-results-label aria-live="polite"></p>'+
   '<div data-order-cart-results class="order-cart-results"></div>'+
   '<button type="button" class="button order-cart-more" data-action="order-cart-more" hidden>Mostrar mais modelos</button>'+
   '</section><aside class="order-cart-summary" data-order-cart-summary aria-live="polite">'+
    '<h3>Resumo do pedido</h3><p>Selecione produtos para começar.</p></aside></div></div>';
}
function quantityHtml(v,qty,showAvailable=true){
 const text=[v.color,v.size].filter(Boolean).join(' · ')||'Variação única';
 return '<div class="order-cart-variant"><div class="order-cart-var-label"><strong>'+esc(text)+'</strong>'+
  '<small>'+esc([v.sku&&'SKU '+v.sku,v.ean&&'EAN '+v.ean].filter(Boolean).join(' · '))+'</small>'+
  '<small>'+(showAvailable?fmt(v.available)+' disponíveis na central':'Disponibilidade confirmada pela central')+
   (v.min?' · Mín. '+fmt(v.min)+' un.':'')+'</small></div>'+
  '<div class="order-cart-quantity"><button type="button" data-action="order-cart-minus" data-id="'+esc(v.id)+'" aria-label="Reduzir quantidade de '+esc(text)+'">−</button>'+
  '<input type="number" data-order-cart-qty data-id="'+esc(v.id)+'" min="0" max="1000000" step="1" inputmode="numeric" value="'+qty+'" aria-label="Quantidade de '+esc(text)+'">'+
  '<button type="button" data-action="order-cart-plus" data-id="'+esc(v.id)+'" aria-label="Aumentar quantidade de '+esc(text)+'">+</button></div></div>';
}
function cardHtml(g,state){
 const count=g.variants.reduce((s,v)=>s+Number(state.selection.get(v.id)||0),0);
 const expanded=state.expanded.has(g.key);
 return '<article class="order-cart-card'+(count?' is-selected':'')+'">'+
  '<div class="order-cart-card-top">'+
   '<div class="order-cart-photo">'+(g.photo?'<img data-photo-path="'+esc(g.photo)+'" alt="" loading="lazy">':'<span aria-hidden="true">▣</span>')+'</div>'+
   '<div class="order-cart-card-heading"><strong>'+esc(g.title)+'</strong>'+
    '<small>'+g.variants.length+' variação'+(g.variants.length===1?'':'ões')+'</small>'+
    (count?'<span class="order-cart-picked">'+fmt(count)+' un. selecionadas</span>':'')+'</div>'+
   '<button type="button" class="button order-cart-expand" data-action="order-cart-expand" data-key="'+esc(g.key)+'" aria-expanded="'+expanded+'">'+
    (expanded?'Ocultar':'Selecionar')+'</button></div>'+
  (expanded?'<div class="order-cart-variants">'+g.variants.map(v=>quantityHtml(v,Number(state.selection.get(v.id)||0),state.showAvailable)).join('')+'</div>':'')+
  '</article>';
}
function summaryHtml(groups,selection,showAvailable=true){
 const s=orderCartSummary(groups,selection);
 return '<h3>Resumo do pedido</h3>'+
  '<div class="order-cart-metrics"><div><small>Modelos</small><strong>'+fmt(s.models)+'</strong></div>'+
   '<div><small>SKUs</small><strong>'+fmt(s.skus)+'</strong></div>'+
   '<div><small>Unidades</small><strong>'+fmt(s.units)+'</strong></div></div>'+
  (s.units&&!showAvailable?'<p class="order-cart-muted">Disponibilidade será confirmada pela central após o envio.</p>':
   s.units?'<div class="order-cart-stock-count"><span>Disponíveis agora</span><strong>'+fmt(s.available)+' un.</strong></div>'+
    (s.missing?'<p class="order-cart-shortage">⚠ '+fmt(s.missing)+' unidade'+(s.missing===1?'':'s')+
     ' faltante'+(s.missing===1?'':'s')+'. A reserva integral poderá ser recusada; revise o pedido.</p>':
     '<p class="order-cart-sufficient">✓ Todas as unidades estão disponíveis neste momento.</p>'):
   '<p class="order-cart-muted">Os produtos e as quantidades escolhidos aparecerão aqui.</p>')+
  '<p class="order-cart-footnote">A disponibilidade pode mudar até a confirmação. A separação e a expedição são posteriores.</p>';
}
export function renderOrderCart(form,{resetPage=false}={}){
 const state=form?.__orderCart;
 if(!state)return;
 if(resetPage)state.page=1;
 const search=form.querySelector('[data-order-cart-search]')?.value||'';
 const matches=searchOrderCatalog(state.groups,search);
 const list=state.view==='selected'?matches.filter(g=>g.variants.some(v=>Number(state.selection.get(v.id)||0)>0)):matches;
 const count=state.page*12;
 const area=form.querySelector('[data-order-cart-results]');
 if(area)area.innerHTML=list.length?list.slice(0,count).map(g=>cardHtml(g,state)).join(''):
  '<p class="order-cart-empty">'+(state.view==='selected'?'Nenhum produto selecionado ainda.':'Nenhum produto encontrado. Tente outro nome, SKU ou EAN.')+'</p>';
 const more=form.querySelector('[data-action="order-cart-more"]');if(more)more.hidden=count>=list.length;
 const caption=form.querySelector('[data-order-cart-results-label]');if(caption)caption.textContent=
  fmt(list.length)+' modelo(s) encontrado(s)';
 const summary=orderCartSummary(state.groups,state.selection);
 const container=form.querySelector('[data-order-cart-summary]');if(container)container.innerHTML=summaryHtml(state.groups,state.selection,state.showAvailable);
 const counter=form.querySelector('[data-order-cart-count]');if(counter)counter.textContent=String(summary.skus);
 for(const b of form.querySelectorAll('[data-action="order-cart-view"]')){
  const selected=b.dataset.view===state.view;b.classList.toggle('is-current',selected);b.setAttribute('aria-pressed',String(selected));
 }
 state.onRender?.();
}
export function mountOrderCart(form,{groups=[],destination='',showAvailable=true,onRender=()=>{}}={}){
 if(!form)return;
 form.__orderCart={groups,destination,showAvailable,selection:new Map(),expanded:new Set(),page:1,view:'catalog',onRender,invalid:false};
 form.closest('.modal')?.classList.add('order-cart-modal');
 form.classList.add('order-cart-form');
 renderOrderCart(form);
 form.querySelector('[data-order-cart-search]')?.focus({preventScroll:true});
}
export function setOrderCartQuantity(form,id,value){
 const state=form?.__orderCart;if(!state)return false;
 const num=Number(value);
 if(String(value)===''||!Number.isInteger(num)||num<0||num>1000000){state.invalid=true;return false;}
 if(!state.groups.some(g=>g.variants.some(v=>v.id===id)))return false;
 if(num)state.selection.set(id,num);else state.selection.delete(id);
 state.invalid=false;
 const summary=form.querySelector('[data-order-cart-summary]');if(summary)summary.innerHTML=summaryHtml(state.groups,state.selection,state.showAvailable);
 const counter=form.querySelector('[data-order-cart-count]');if(counter)counter.textContent=String(orderCartSummary(state.groups,state.selection).skus);
 return true;
}
export function orderCartAction(form,target){
 const s=form?.__orderCart;if(!s||!target)return false;
 const action=target.dataset.action;
 if(action==='order-cart-view'){s.view=target.dataset.view==='selected'?'selected':'catalog';if(s.view==='selected'){const input=form.querySelector('[data-order-cart-search]');if(input)input.value='';}renderOrderCart(form,{resetPage:true});return true;}
 if(action==='order-cart-more'){s.page++;renderOrderCart(form);return true;}
 if(action==='order-cart-expand'){
  const key=target.dataset.key;
  if(s.expanded.has(key))s.expanded.delete(key);else s.expanded.add(key);
  renderOrderCart(form);return true;
 }
 if(action==='order-cart-plus'||action==='order-cart-minus'){
  const id=target.dataset.id,old=Number(s.selection.get(id)||0);
  const next=Math.min(1000000,Math.max(0,old+(action==='order-cart-plus'?1:-1)));
  if(setOrderCartQuantity(form,id,next))renderOrderCart(form);
  form.querySelector('[data-order-cart-qty][data-id="'+(typeof CSS!=='undefined'&&CSS.escape?CSS.escape(id):id)+'"]')?.focus({preventScroll:true});
  return true;
 }
 return false;
}
export function orderCartSearchKey(form,query){
 const s=form?.__orderCart;if(!s)return false;
 const q=norm(query).replace(/[\s-]/g,'');
 if(!q)return false;
 const resolved=findProductByCode(s.groups.flatMap(g=>g.variants),query,{activeOnly:false});
 if(!resolved.item)return false;
 const v=resolved.item;
 const now=Number(s.selection.get(v.id)||0);
 if(now>=1000000)return false;
 setOrderCartQuantity(form,v.id,now+1);
 const group=s.groups.find(g=>g.variants.some(x=>x.id===v.id));
 s.expanded.add(group.key);s.view='selected';
 form.querySelector('[data-order-cart-search]').value='';
 renderOrderCart(form,{resetPage:true});
 return true;
}
export function collectOrderCartItems(form){
 const s=form?.__orderCart;
 if(!s||s.invalid||form.querySelector('[data-order-cart-qty]:invalid'))
  throw Error('Revise as quantidades informadas. Utilize números inteiros de 0 a 1.000.000.');
 const items=selectedOrderCartItems(s.groups,s.selection);
 if(!items.length)throw Error('Selecione pelo menos um produto.');
 if(items.length>5000)throw Error('O pedido excede o limite de 5.000 SKUs.');
 for(const g of s.groups)for(const v of g.variants){
  const qty=Number(s.selection.get(v.id)||0);
  if(qty>0&&v.min>0&&qty<v.min)
   throw Error('Mínimo para '+g.title+' · '+(v.size||'Único')+': '+fmt(v.min)+' unidades por SKU.');
 }
 return items;
}
export function orderCartReview(groups=[],selection=new Map(),destination='',{showAvailable=true}={}){
 const sum=orderCartSummary(groups,selection);
 const selected=groups.flatMap(g=>g.variants.filter(v=>Number(selection.get(v.id)||0)>0).map(v=>({
  title:g.title,v,qty:Number(selection.get(v.id))
 })));
 return '<div class="order-cart-review-body"><h3>Revise seu pedido antes de confirmar</h3>'+
  '<p class="order-cart-review-dest"><small>Destino</small><strong>'+esc(destination)+'</strong></p>'+
  '<div class="order-cart-metrics"><div><small>Modelos</small><strong>'+fmt(sum.models)+'</strong></div>'+
   '<div><small>SKUs</small><strong>'+fmt(sum.skus)+'</strong></div>'+
   '<div><small>Unidades</small><strong>'+fmt(sum.units)+'</strong></div></div>'+
  '<p class="order-cart-review-units">'+fmt(sum.units)+' unidades solicitadas</p>'+
  '<div class="order-cart-review-lines">'+selected.map(({title,v,qty})=>
   '<div><span><strong>'+esc(title)+'</strong><small>'+esc([v.color,v.size,v.sku].filter(Boolean).join(' · '))+
    '</small></span><b>'+fmt(qty)+' un.</b></div>').join('')+'</div>'+
  (!showAvailable?'<p class="order-cart-muted">Disponibilidade será confirmada pela central após o envio.</p>':
   sum.missing?'<p class="order-cart-shortage">⚠ '+fmt(sum.missing)+' unidade'+(sum.missing===1?'':'s')+
   ' faltante'+(sum.missing===1?'':'s')+'. A reserva integral poderá ser recusada. Revise as quantidades ou aguarde reposição.</p>':
   '<p class="order-cart-sufficient">'+fmt(sum.available)+' unidades disponíveis atualmente na central.</p>')+
  '<p class="order-cart-footnote">Confirmar o pedido cria a solicitação e efetua a reserva pelo fluxo existente. Não representa expedição física.</p>'+
  '<button type="button" class="button" data-action="order-cart-edit">← Editar seleção</button></div>';
}
export function reviewItemsMarkup(items=[],products=[],destination='',{showAvailable=false,available=()=>0,models=[]}={}){
 const s=new Map(items.map(x=>[x.product_id,Number(x.quantity||0)]));
 const groups=makeOrderCatalog(products,models,available);
 // Dados de pedidos temporários também podem conter itens históricos não ativos.
 for(const x of items)if(!groups.some(g=>g.variants.some(v=>v.id===x.product_id))){
  const p=products.find(p=>p.id===x.product_id);
  groups.push({key:x.product_id,title:p?.name||'Produto',variants:[{id:x.product_id,sku:p?.sku||'',color:p?.apparel_color||'',
   size:p?.apparel_size||'',available:showAvailable?Math.max(0,Number(available(p))||0):Number(x.quantity)||0}]});
 }
 return orderCartReview(groups,s,destination,{showAvailable});
}
export function editOrderReview(form){
 form.classList.remove('is-reviewing-order');
 form.querySelector('[data-order-review]')?.remove();
 delete form.dataset.reviewSignature;
 const submit=form.querySelector('.modalfooter button[type="submit"]');
 if(submit){submit.textContent=form.dataset.orderReviewOriginal||'Revisar pedido';submit.disabled=false;submit.title='';}
 form.querySelector('[data-order-cart-search], [data-lot-search]')?.focus({preventScroll:true});
}
function stageReview(form,signature,markup,{blockConfirmation=false}={}){
 form.querySelector('[data-order-review]')?.remove();
 const div=document.createElement('section');div.dataset.orderReview='';
 div.className='order-cart-review';div.innerHTML=markup;
 form.querySelector('.modalfooter')?.before(div);
 form.classList.add('is-reviewing-order');
 form.dataset.reviewSignature=signature;
 const submit=form.querySelector('.modalfooter button[type="submit"]');
 if(submit){form.dataset.orderReviewOriginal ||=submit.textContent;submit.textContent='Confirmar pedido';submit.disabled=blockConfirmation;
   submit.title=blockConfirmation?'Corrija as quantidades com falta antes de confirmar.':'';}
 form.scrollTop=0;
}
export function confirmOrderCartReview(form,{items,note='',destination=''}={}){
 const state=form?.__orderCart;if(!state)throw Error('Carrinho de pedido indisponível.');
 const signature=JSON.stringify([destination,note,items]);
 if(form.classList.contains('is-reviewing-order')&&form.dataset.reviewSignature===signature)return true;
 stageReview(form,signature,orderCartReview(state.groups,state.selection,destination,{showAvailable:state.showAvailable}),
  {blockConfirmation:state.showAvailable&&orderCartSummary(state.groups,state.selection).missing>0});
 return false;
}
export function confirmEventOrderReview(form,{items,note='',destination='',products=[],models=[]}={}){
 const signature=JSON.stringify([destination,note,items]);
 if(form.classList.contains('is-reviewing-order')&&form.dataset.reviewSignature===signature)return true;
 stageReview(form,signature,reviewItemsMarkup(items,products,destination,{models}));
 return false;
}
