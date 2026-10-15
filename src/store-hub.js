// Visão operacional de unidades; nunca duplica pedidos ou saldos.
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const closed=new Set(['enviado','concluido','recebido','recebido_divergente','cancelado','expirado']);
const statuses={legado:'Pendente de preparação',solicitado:'Aguardando reserva',
 pendente_estoque:'Aguardando estoque',aguardando:'A separar',reservado:'A separar',
 aprovado:'A separar',em_separacao:'Em separação',separado:'Separado',
 despachado:'Aguardando recebimento',enviado:'Enviado',concluido:'Concluído',
 recebido:'Recebido',recebido_divergente:'Recebido com divergência',
 cancelado:'Cancelado',expirado:'Expirado'};
const sortRecent=(a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''));
export const isHistoricalOrder=order=>closed.has(order.status);
export function matchesStoreOrder(order,scope){
 if(!scope)return true;
 if(scope.type==='central')return true; // fila geral da central: pedidos e remessas.
 if(scope.type==='store')return order.kind==='loja'&&
  (order.raw?.to_store_id===scope.id||order.raw?.from_store_id===scope.id);
 if(scope.type==='event')return (order.kind==='evento'||order.kind==='avulso')&&order.eventId===scope.id;
 return false;
}
export function locationOrders(all,scope,mode='all'){
 const list=all.filter(order=>matchesStoreOrder(order,scope)).sort(sortRecent);
 return mode==='pending'?list.filter(o=>!isHistoricalOrder(o)):
  mode==='history'?list.filter(isHistoricalOrder):list;
}
function itemRow(o,scope,ctx){
 const label=o.kind==='evento'?'Lote '+String(o.sequence||'?').padStart(2,'0'):'Pedido';
 const attrs='data-location-type="'+esc(scope.type)+'" data-location-id="'+esc(scope.id||'central')+
  '" data-order-kind="'+esc(o.kind)+'" data-order-id="'+esc(o.id)+'"';
 const activeAction=()=>{
  if(!ctx.canProcess?.(o))return '';
  const idData='data-id="'+esc(o.id)+'" data-kind="'+esc(o.kind)+'"';
  if(['reservado','aprovado','aguardando','em_separacao'].includes(o.status)){
   const action=o.kind==='evento'?'event-batch-pick':o.kind==='avulso'?'avulso-pick':'store-order-separate';
   return ctx.button(o.status==='em_separacao'?'Continuar':'Separar',action,idData,'small primary');
  }
  return '';
 };
 const quickPrint=ctx.canPrint?.(o)&&o.lines?.length&&
  !['legado','solicitado','pendente_estoque','cancelado','expirado'].includes(o.status)?
  ctx.button('Imprimir 80 mm','order-print-thermal',
   'data-id="'+esc(o.id)+'" data-kind="'+esc(o.kind)+'"','small'):'';
 return '<div class="sh-order-line">'+
  '<div class="sh-order-identity"><strong>'+label+' #'+esc(o.id.slice(0,8).toUpperCase())+'</strong>'+
   '<small>'+esc(o.kind==='avulso'?o.target:o.kind==='evento'?'Loja temporária':o.origin+' → '+o.target)+
     ' · '+esc(ctx.time(o.created_at))+'</small></div>'+
  '<div class="sh-order-count">'+Number(o.total||0).toLocaleString('pt-BR')+' un.</div>'+
  '<span class="sh-order-status '+(isHistoricalOrder(o)?'done':o.status==='pendente_estoque'?'short':'active')+'">'+
   esc(statuses[o.status]||o.status)+'</span>'+
  '<div class="sh-order-actions">'+activeAction()+quickPrint+
  (ctx.canBrowseOrders?ctx.button('Ver detalhes','store-hub-open-order',attrs,'small'):'')+
  '</div></div>';
}
function locationCard(loc,all,ctx,{primary=false}={}){
 const scope={type:loc.type,id:loc.id};
 const orders=locationOrders(all,scope),pending=orders.filter(o=>!isHistoricalOrder(o)),
  history=orders.filter(isHistoricalOrder);
 const key=loc.type+'-'+loc.id;
 const actions=[];
 if(ctx.canBrowseOrders){
  actions.push(ctx.button('Ver pedidos','store-hub-orders',
   'data-location-type="'+esc(loc.type)+'" data-location-id="'+esc(loc.id)+'" data-mode="all"','small'));
  if(pending.length)actions.push(ctx.button('Fila de separação','store-hub-orders',
   'data-location-type="'+esc(loc.type)+'" data-location-id="'+esc(loc.id)+'" data-mode="pending"','small primary'));
 }
 if(loc.type==='event'&&ctx.canOpenEvent)
  actions.push(ctx.button(ctx.canManageEvent?'Gerenciar local':'Ver local','event-detail','data-id="'+esc(loc.id)+'"','small'));
 if(loc.type==='store'&&ctx.canManageStores&&!primary)
  actions.push(ctx.button('Editar loja','store-edit','data-id="'+esc(loc.id)+'"','small'));
 if(ctx.canForceDelete&&!primary){
  const kind=loc.type==='store'?'store':loc.type==='event'?'event':null;
  if(kind)actions.push(ctx.button('Excluir cadastro','force-delete-preview',
   'data-kind="'+kind+'" data-id="'+esc(loc.id)+'"','small danger'));
 }
 const cover=loc.coverPath?'<div class="sh-event-cover"><img data-event-cover="'+esc(loc.coverPath)+
  '" alt="Capa de '+esc(loc.name)+'" loading="lazy"></div>':'';
 return '<article class="sh-location" data-location="'+esc(key)+'">'+cover+
  '<header class="sh-location-header"><div><span class="sh-kicker">'+esc(loc.kicker||'Unidade')+'</span>'+
    '<h3>'+esc(loc.name)+'</h3><small>'+esc(loc.subtitle||'')+'</small></div>'+
    '<div class="sh-loc-stats"><div><strong>'+pending.length+'</strong><span>Em andamento</span></div>'+
      '<div><strong>'+history.length+'</strong><span>No histórico</span></div></div></header>'+
  '<div class="sh-location-actions">'+actions.join('')+'</div>'+
  '<div class="sh-location-pending"><h4>Pedidos para acompanhar e separar</h4>'+
  (pending.length?'<div class="sh-order-rows">'+pending.slice(0,6).map(x=>itemRow(x,scope,ctx)).join('')+'</div>'+
    (pending.length>6&&ctx.canBrowseOrders?'<div class="sh-more">'+ctx.button('Ver todos os '+pending.length+' pedidos','store-hub-orders',
      'data-location-type="'+esc(loc.type)+'" data-location-id="'+esc(loc.id)+'" data-mode="pending"','small')+'</div>':''):
   '<p class="sh-empty">Nenhum pedido em andamento.</p>')+'</div>'+
  '<details class="sh-history"><summary>Histórico de pedidos <b>'+history.length+'</b> <span aria-hidden="true">⌄</span></summary>'+
   (history.length?'<div class="sh-order-rows">'+history.slice(0,5).map(x=>itemRow(x,scope,ctx)).join('')+'</div>'+
     (history.length>5&&ctx.canBrowseOrders?'<div class="sh-more">'+ctx.button('Consultar todo o histórico','store-hub-orders',
      'data-location-type="'+esc(loc.type)+'" data-location-id="'+esc(loc.id)+'" data-mode="history"','small')+'</div>':''):
    '<p class="sh-empty">O histórico ficará disponível aqui após a conclusão dos pedidos.</p>')+
  '</details></article>';
}
function group(title,description,items,orders,ctx,empty){
 return '<section class="sh-section"><div class="sh-section-heading"><div><h2>'+esc(title)+'</h2>'+
  '<p>'+esc(description)+'</p></div><span>'+items.length+' unidade(s)</span></div>'+
  (items.length?'<div class="sh-location-list">'+items.map(loc=>locationCard(loc,orders,ctx,{primary:loc.primary})).join('')+'</div>':
  '<div class="sh-no-units">'+esc(empty)+'</div>')+'</section>';
}
export function renderStoreHub({stores=[],events=[],orders=[],context={}}){
 const ctx={button:()=>'',time:x=>x,canBrowseOrders:false,canManageEvent:false,canManageStores:false,
  showCentral:true,showFranchises:true,showEvents:true,showBranches:false,portal:false,canOpenEvent:false,...context};
 const eligibleStore=s=>ctx.canSeeStore?ctx.canSeeStore(s):true;
 // CDSB é um centro de distribuição, não uma loja. "is_primary" identifica o CDSB
 // na base de estoque e NUNCA deve ser usado para definir a loja central comercial.
 const christStore=stores.find(s=>s.code==='CRISTOREICBA'&&!s.is_primary&&
  s.ownership_type==='propria'&&!s.force_archived_at)||
  stores.find(s=>s.kind==='filial'&&s.ownership_type==='propria'&&!s.is_primary&&
   !s.force_archived_at)||null;
 const centralItems=ctx.showCentral&&christStore&&eligibleStore(christStore)?[{
  type:'store',id:christStore.id,primary:false,kicker:'Loja própria · central',
  name:christStore.name,subtitle:'Cristo Rei · pedidos e abastecimento da loja'
 }]:[];
 const franchiseItems=ctx.showFranchises?stores.filter(s=>s.kind==='franquia'&&s.id!==christStore?.id&&
  !s.force_archived_at&&eligibleStore(s))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  .map(s=>({type:'store',id:s.id,kicker:s.active?'Franquia ativa':'Franquia inativa',
    name:s.name,subtitle:s.code||''})):[];
 const eventItems=ctx.showEvents?events.filter(e=>!e.deleted_at&&(!ctx.canSeeEvent||ctx.canSeeEvent(e)))
  .sort((a,b)=>String(b.starts_at||'').localeCompare(String(a.starts_at||'')))
  .map(e=>({type:'event',id:e.id,kicker:e.status==='ativo'?'Loja temporária ativa':'Loja temporária encerrada',
   name:e.name,subtitle:[e.starts_at,e.ends_at].filter(Boolean).join(' até '),coverPath:e.cover_path})):[];
 const branchItems=ctx.showBranches?stores.filter(s=>s.kind==='filial'&&s.id!==christStore?.id&&
  !s.force_archived_at&&eligibleStore(s))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  .map(s=>({type:'store',id:s.id,kicker:'Filial própria',name:s.name,subtitle:s.code||''})):[];
 const actions=[
  ctx.canManageStores?ctx.button('+ Nova loja / franquia','store-new','','small'): '',
  ctx.canManageEvent?ctx.button('+ Loja temporária','event-new','','primary'): '',
  ctx.canManageStores?ctx.button('Administrar cadastros','store-hub-admin','','small'):''
 ].filter(Boolean).join('');
 return '<div class="sh-page"><header class="pagehead"><div><h1>Lojas</h1>'+
  '<p>Lojas próprias, franquias e lojas temporárias. Pedidos e histórico de cada unidade.</p></div>'+
  '<div class="actions">'+actions+'</div></header>'+
  (ctx.showCentral?group('Loja Central','Unidade Cristo Rei · pedidos e histórico exclusivos da loja.',centralItems,orders,ctx,
    'Loja Cristo Rei não cadastrada ou sem acesso.'):'')+
  (ctx.showFranchises?group('Franquias','Pedidos enviados à central e histórico de atendimento.',franchiseItems,orders,ctx,'Nenhuma franquia cadastrada ou acessível.'):'')+
  (ctx.showEvents?group('Lojas Temporárias','Lotes de reposição e envios para cada evento.',eventItems,orders,ctx,'Nenhuma loja temporária cadastrada ou acessível.'):'')+
  (branchItems.length?group('Filiais próprias','Movimentações e pedidos das filiais próprias.',branchItems,orders,ctx,''):'')+
  '<p class="sh-footer-help">A separação, a impressão A4 e a baixa física continuam na seção Pedidos. O histórico permanece vinculado à unidade.</p></div>';
}
