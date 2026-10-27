// Painéis internos das lojas permanentes. Não executa alterações de estoque.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('pt-BR');
const done=new Set(['enviado','concluido','recebido','recebido_divergente','cancelado','expirado']);
export function displayOrderStage(order){
 const stage=order.workflow?.stage;
 if(stage==='conferencia'||order.status==='separado')return 'A conferir';
 if(stage==='expedicao')return 'Em expedição';
 if(stage==='separacao'||order.status==='em_separacao')return 'Em separação';
 const map={solicitado:'Aguardando reserva',pendente_estoque:'Aguardando estoque',aprovado:'A separar',
  aguardando:'A separar',despachado:'Em trânsito',enviado:'Enviado',recebido:'Recebido',
  recebido_divergente:'Recebido com divergência',concluido:'Concluído',cancelado:'Cancelado'};
 return map[order.status]||order.status||'Em andamento';
}
export function renderStoreUnit({store,orders=[],storeBalances=[],products=[],branchMovements=[],
 branchReturns=[],storeOrderReceipts=[],tab='resumo',balanceProduct=null,balanceCandidates=[],
 balanceError='',balanceCode='',context={}}){
 const ctx={button:()=>'',time:x=>x,canBrowseOrders:false,canManageStores:false,
   canMove:false,canReturn:false,canRequest:false,...context};
 if(!store||store.is_primary||store.kind==='central')return '<p class="su-empty">Unidade indisponível.</p>';
 const franchise=store.kind==='franquia';
 const validTabs=franchise?['resumo','pedidos','recebimentos','cadastro']:
  ['resumo','pedidos','estoque',...(ctx.canMove?['balanco']:[]),'movimentacoes','configuracoes'];
 const activeTab=validTabs.includes(tab)?tab:'resumo';
 const scopedBalances=franchise?[]:storeBalances.filter(x=>x.store_id===store.id&&Number(x.quantity)>0);
 const stock=scopedBalances.reduce((s,b)=>s+Number(b.quantity||0),0);
 const ownReturns=branchReturns.filter(r=>r.from_store_id===store.id);
 const ownMovements=branchMovements.filter(m=>m.store_id===store.id).slice(0,60);
 const pending=orders.filter(o=>!done.has(o.status)),inTransit=orders.filter(o=>o.status==='despachado').length;
 const canMakeOrder=Boolean(ctx.canRequest&&store.active);
 const orderAction=(o,label='Abrir pedido')=>ctx.canBrowseOrders?
  ctx.button(label,'store-hub-open-order','data-location-type="store" data-location-id="'+esc(store.id)+'" data-order-id="'+esc(o.id)+'" data-order-kind="'+esc(o.kind)+'"','small'):'';
 const rows=rowsToShow=>rowsToShow.length?'<div class="su-orders">'+rowsToShow.map(o=>
  '<article class="su-order"><div><strong>Pedido #'+esc(o.code||'—')+'</strong><small>'+esc(displayOrderStage(o))+
  ' · '+fmt(o.total)+' unidades · '+esc(ctx.time(o.created_at))+'</small></div>'+
  orderAction(o)+'</article>').join('')+'</div>':'<p class="su-empty">Nenhum pedido para exibir.</p>';
 const tabs=validTabs.map(t=>'<button type="button" data-action="store-unit-tab" data-tab="'+t+
  '" class="'+(t===activeTab?'is-current':'')+'" aria-selected="'+(t===activeTab)+'" role="tab">'+
  ({resumo:'Visão geral',pedidos:'Pedidos',estoque:'Estoque',balanco:'Balanço rápido',
   movimentacoes:'Movimentações',configuracoes:'Configurações',
   recebimentos:'Recebimentos',cadastro:'Cadastro'}[t])+'</button>').join('');
 const changeStock=ctx.canMove&&!franchise&&store.active?
  '<div class="actions">'+ctx.button('Movimentar estoque','branch-stock-new','data-id="'+esc(store.id)+'"','small primary')+
  (ctx.canReturn&&stock>0?ctx.button('Devolver à central','branch-return-new','data-id="'+esc(store.id)+'"','small'):'')+'</div>':'';
 const balanceQuantity=balanceProduct?Number(storeBalances.find(x=>
  x.store_id===store.id&&x.product_id===balanceProduct.id)?.quantity||0):0;
 const balanceChoices=balanceCandidates.map(p=>
  '<button class="quick-balance-choice" type="button" data-action="store-balance-choose" data-id="'+esc(p.id)+'">'+
  '<strong>'+esc(p.name)+'</strong><small>SKU '+esc(p.sku||'—')+' · EAN '+esc(p.ean||'—')+
  (p.apparel_size?' · '+esc(p.apparel_size):'')+'</small></button>').join('');
 const balanceCard=balanceProduct?
  '<section class="quick-balance-product" data-store-balance-product="'+esc(balanceProduct.id)+'">'+
   '<header class="quick-balance-product-head">'+
    ((balanceProduct.image_path||balanceProduct.image_paths?.[0])?
     '<img class="quick-balance-photo" data-photo-path="'+esc(balanceProduct.image_path||balanceProduct.image_paths?.[0])+
     '" alt="Foto de '+esc(balanceProduct.name)+'">':
     '<div class="quick-balance-photo is-empty" aria-hidden="true">▧</div>')+
    '<div><strong>'+esc(balanceProduct.name)+'</strong><small>'+
     (balanceProduct.apparel_size?esc(balanceProduct.apparel_size)+' · ':'')+'SKU '+esc(balanceProduct.sku||'—')+
     ' · EAN '+esc(balanceProduct.ean||'—')+(balanceProduct.active?'':' · Inativo')+'</small></div></header>'+
   '<div class="quick-balance-stock"><div><small>Saldo nesta loja</small><strong>'+fmt(balanceQuantity)+'</strong></div></div>'+
   '<form data-form="store-balance-count" data-id="'+esc(balanceProduct.id)+'" data-store="'+esc(store.id)+
    '" data-expected="'+balanceQuantity+'">'+
    '<label class="quick-balance-quantity"><span>Quantidade física contada</span>'+
    '<input name="quantity" type="number" min="0" max="1000000" step="1" inputmode="numeric" value="'+
    balanceQuantity+'" required data-store-balance-quantity></label>'+
    '<p class="quick-balance-preview" data-store-balance-preview aria-live="polite">'+
    'A contagem altera somente o saldo desta loja. O saldo do CD fica separado.</p>'+
    '<button class="button primary quick-balance-submit" type="submit">Salvar contagem</button></form>'+
   (ctx.canEditProducts?
    '<div class="quick-balance-photo-action"><button type="button" class="button quick-balance-photo-button" '+
    'data-action="store-balance-photo" data-id="'+esc(balanceProduct.id)+'">📷 Tirar foto e salvar no cadastro</button>'+
    '<small>A foto é compartilhada na galeria do produto no sistema.</small></div>':'')+'</section>':
  '<div class="quick-balance-placeholder"><strong>Aguardando leitura</strong>'+
   '<p>Leia o EAN com o leitor USB, digite o código ou utilize a câmera.</p></div>';
 const balancePanel='<div class="su-panel"><div class="su-section-header"><h2>Balanço rápido desta loja</h2></div>'+
  '<div class="quick-balance-find"><label for="store-balance-barcode">Código de barras ou SKU</label>'+
  '<div class="quick-balance-search-row"><input id="store-balance-barcode" data-store-balance-barcode type="search" '+
  'enterkeyhint="search" inputmode="search" aria-label="Buscar EAN ou SKU" placeholder="Bipe ou digite o EAN/SKU" '+
  'value="'+esc(balanceCode)+'" autocomplete="off">'+
  '<button class="button primary" type="button" data-action="store-balance-search">Buscar</button>'+
  '<button class="button" type="button" data-action="store-balance-camera">Ler pela câmera</button></div>'+
  '<small>O produto será contado no estoque de '+esc(store.name)+'. A contagem é salva sem alterar o CD.</small></div>'+
  (balanceError?'<p class="quick-balance-error" role="status">'+esc(balanceError)+'</p>':'')+
  (balanceChoices?'<div class="quick-balance-choices">'+balanceChoices+'</div>':'')+balanceCard+'</div>';
 let panel='';
 if(activeTab==='resumo'){
  panel='<div class="su-panel"><div class="su-section-header"><h2>Resumo da unidade</h2></div>'+
   (pending.length?'<p class="su-next">'+pending.length+' pedido(s) em andamento. Acompanhe em Pedidos.</p>':
    '<p class="su-empty">Nenhum pedido em andamento nesta unidade.</p>')+
   '<div class="su-section-header"><h2>Últimos pedidos</h2>'+
    ctx.button('Ver pedidos','store-unit-tab','data-tab="pedidos"','small')+'</div>'+
   rows(orders.slice(0,4))+'</div>';
 }else if(activeTab==='pedidos'){
  panel='<div class="su-panel"><div class="su-section-header"><h2>Pedidos da unidade</h2>'+
   (canMakeOrder?ctx.button('+ Novo pedido','store-order-new','data-store="'+esc(store.id)+'"','primary'):'')+
   '</div>'+rows(orders)+'</div>';
 }else if(activeTab==='balanco'){
  panel=balancePanel;
 }else if(activeTab==='estoque'){
  panel='<div class="su-panel"><div class="su-section-header"><h2>Estoque desta loja</h2>'+changeStock+'</div>'+
   (scopedBalances.length?'<div class="su-data-list">'+scopedBalances.filter(x=>Number(x.quantity)>0).map(b=>
     '<div><span>'+esc(products.find(p=>p.id===b.product_id)?.name||'Produto')+'</span><strong>'+fmt(b.quantity)+' un.</strong></div>').join('')+'</div>':
    '<p class="su-empty">Não há saldo físico registrado nesta loja.</p>')+'</div>';
 }else if(activeTab==='movimentacoes'){
  panel='<div class="su-panel"><div class="su-section-header"><h2>Movimentações e devoluções</h2>'+changeStock+'</div>'+
   '<h3>Devoluções à central</h3>'+(ownReturns.length?'<div class="su-data-list">'+ownReturns.map(r=>
    '<div><span>'+esc(products.find(p=>p.id===r.product_id)?.name||'Produto')+
    '</span><strong>'+fmt(r.quantity)+' un. · '+esc(r.status==='em_transito'?'Em trânsito':'Recebido')+'</strong></div>').join('')+'</div>':
    '<p class="su-empty">Nenhuma devolução registrada.</p>')+
   '<h3>Histórico de movimentos</h3>'+(ownMovements.length?'<div class="su-data-list">'+ownMovements.map(m=>
    '<div><span>'+esc(products.find(p=>p.id===m.product_id)?.name||'Produto')+
    ' · '+esc(m.reason||m.operation||'Movimento')+'</span><strong>'+fmt(m.quantity_delta)+' un.</strong></div>').join('')+'</div>':
    '<p class="su-empty">Nenhum movimento registrado.</p>')+'</div>';
 }else if(activeTab==='recebimentos'){
  const received=orders.filter(o=>['despachado','recebido','recebido_divergente'].includes(o.status));
  const receiptMap=new Map();
  for(const record of storeOrderReceipts){
   if(!receiptMap.has(record.order_id))receiptMap.set(record.order_id,[]);
   receiptMap.get(record.order_id).push(record);
  }
  panel='<div class="su-panel"><div class="su-section-header"><h2>Recebimentos da franquia</h2></div>'+
   (received.length?'<div class="su-orders">'+received.map(o=>{
    const receipts=receiptMap.get(o.id)||[];
    return '<article class="su-receipt"><div class="su-section-header"><div><strong>Pedido #'+esc(o.code||'—')+'</strong>'+
     '<small>'+esc(displayOrderStage(o))+' · '+fmt(o.total)+' unidades</small></div>'+
     orderAction(o)+'</div>'+
     (receipts.length?'<div class="su-data-list">'+receipts.map(r=>{
      const product=products.find(p=>p.id===r.product_id);
      const expected=Number(r.expected_quantity)||0,checked=Number(r.received_quantity)||0;
      const missing=Math.max(0,Number(r.missing_quantity)||0);
      return '<div><span><strong>'+esc(product?.name||'Produto')+'</strong>'+
       (product?.sku?'<small>SKU '+esc(product.sku)+'</small>':'')+
       (r.reason?'<small>'+esc(r.reason)+'</small>':'')+
       '</span><span class="su-receipt-qty">'+fmt(checked)+' de '+fmt(expected)+' recebidas'+
       (missing?' · '+fmt(missing)+' un. falta'+(missing===1?'':'m'):'')+'</span></div>';
     }).join('')+'</div>':
     '<p class="su-empty">'+(o.status==='despachado'?
       'Entrega ainda em trânsito. A conferência ocorrerá no recebimento.':
       'Conferência por SKU não disponível neste acesso.')+'</p>')+'</article>';
   }).join('')+'</div>':'<p class="su-empty">Nenhum pedido enviado ou recebido para apresentar.</p>')+
  '</div>';
 }else{
  panel='<div class="su-panel"><div class="su-section-header"><h2>Cadastro da unidade</h2>'+
   (ctx.canManageStores?ctx.button('Editar cadastro','store-edit','data-id="'+esc(store.id)+'"','small')+
    ctx.button(store.active?'Desativar loja':'Ativar loja','store-toggle','data-id="'+esc(store.id)+'"','small'):'')+'</div>'+
   '<div class="su-data-list">'+[
    ['Código',store.code],['Responsável',store.manager_name],['Telefone',store.phone],['Documento',store.document],['Endereço',store.address]
   ].map(([name,value])=>'<div><small>'+name+'</small><strong>'+esc(value||'Não informado')+'</strong></div>').join('')+'</div></div>';
 }
 return '<div class="su-page" data-store-unit-id="'+esc(store.id)+'">'+
  '<nav class="su-breadcrumb" aria-label="Caminho"><button type="button" class="button small" data-action="store-unit-back">← Lojas</button>'+
  '<span>'+esc(franchise?'Franquias':'Próprias')+'</span></nav>'+
  '<header class="su-header"><div><h1>'+esc(store.name)+'</h1><p>'+
   (franchise?'Franquia · estoque interno não controlado no CDSB':'Loja própria · estoque físico controlado')+
   ' · '+esc(store.active?'Ativa':'Inativa')+'</p></div></header>'+
  '<div class="su-overview"><div><small>Pedidos em andamento</small><strong>'+fmt(pending.length)+'</strong></div>'+
   (franchise?'<div><small>Aguardando envio</small><strong>'+
     fmt(pending.filter(o=>['solicitado','aprovado','separado'].includes(o.status)).length)+'</strong></div>':
    '<div><small>Estoque físico</small><strong>'+fmt(stock)+' un.</strong></div>')+
   '<div><small>Em trânsito</small><strong>'+fmt(inTransit)+'</strong></div></div>'+
  '<div class="su-tabs" role="tablist" aria-label="Gerenciar unidade">'+tabs+'</div>'+panel+'</div>';
}
