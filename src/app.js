import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { compressPhoto } from './photos.js';
import {galleryMarkup,galleryState,galleryRemove,galleryMain,galleryAddFiles,galleryReplaceFile,savePhotoGallery,galleryHasChanges} from './photo-gallery.js?v=20261015gallery2';
import {uploadEventCover,generateEventCover} from './event-cover.js?v=20261015cover2';
import {renderStoreHub,locationOrders,matchesStoreOrder} from './store-hub.js?v=20261015storehub4';
import { scanEAN } from './scan.js?v=20261014w2';
import { openTaxonomyPicker, closeTaxonomyPicker } from './taxonomy-ui.js?v=20261014v3';
import { rankTagsForCategory, catalogCategoryRows, catalogTagCards } from './catalog-ui.js?v=20261015variants1';
import { apparelPage, apparelModal, apparelAddRow, apparelRemoveRow, submitApparel,
  apparelFillSizes, apparelVariantEditModal, saveApparelVariant, apparelPhotoModal, saveApparelPhoto, apparelSyncCategory } from './apparel.js?v=20261015gallery3';
import { sizesSection, setSizesMode, setSizeSelected, saveSizedProduct } from './product-variants.js?v=20261015gallery3';
import {resolveCategoryVariations,refreshCategorySizeOptions,renderCategoryVariationFields,variationOptionsToSave} from './category-variations.js?v=20261015variants1';
import { groupInventory, recentInventoryGroups, groupedCard, addSizesContent, updateExtraSizeButtons, toggleExtraSize, collectExtraSizes,
  eventBatchContent, collectEventBatch, eventReturnPage, filterWorkflowRows } from './stock-workflows.js?v=20261015variants1';
import {skuPanelModes,renderSkuPanel,validateSkuAction} from './sku-panel.js?v=20261015sku1';
import { quickBalanceCard, collectQuickCounts, updateQuickCountButtons, filterQuickCountCards } from './quick-balance.js?v=20261014stock1';
import { eventHistoryCards, ordersPageMarkup, createInternalOrderForm, collectInternalOrder } from './orders-events.js?v=20261014unified1';
import { stockOperationPage, stockOperationResults, stockOperationSearchHTML, stockCartHTML, stockOperationHistoryHTML, operationCartLines } from './stock-inout.js?v=20261015stockcards1';
import { eventPickingRows,eventPlanForm,eventSettlementForm,eventCompactDetail,damageListHTML,a4PickingHTML } from './event-simple.js?v=20261015eventphoto3';
import {makeUnifiedOrders,unifiedOrdersPage,filterUnifiedOrders,pickingOrderRows,shortageEditRows,pickingA4HTML} from './unified-orders.js?v=20261015printphoto5';
import {eventLotsOverview,eventLotForm,selectedEventModels} from './event-lots.js?v=20261015lotqueue1';
import {pickerHome,permanentHome,temporaryHome} from './cdsb-portals.js?v=20261015access1';

// Ícones vetoriais locais: carregam mesmo sem bibliotecas externas.
const iconPaths = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  package:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
  scan:'<path d="M5 3H3v5M19 3h2v5M3 16v5h5M21 16v5h-5M7 10v4M10 9v6M14 9v6M17 10v4"/>',
  clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5M9 13l2 2 4-4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  arrows:'<path d="M4 7h16l-4-4M20 7l-4 4M20 17H4l4-4M4 17l4 4"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.2"/>',
  trend:'<path d="m3 17 6-6 4 4 8-9M15 6h6v6"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-down-to-line':'<path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2"/>',
  'arrow-up-from-line':'<path d="M12 17V5m-5 5 5-5 5 5M4 19v2h16v-2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  cross:'<path d="M12 2v20M6 8h12"/>',
  exit:'<path d="M10 17l5-5-5-5m5 5H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>'
};
const uiIcon=(name,size=21)=>'<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">'+
  (iconPaths[name]||iconPaths.package)+'</svg>';

const cfg = window.AME_CONFIG || {};
const root = document.querySelector('#app');
const h = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const niceDate = value => value ? new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Cuiaba' }).format(new Date(value.length === 10 ? value + 'T12:00:00' : value)) : '—';
const niceTime = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short', timeZone:'America/Cuiaba' }).format(new Date(value)) : '—';
const actionNames = {entrada:'Entrada',venda_loja:'Baixa (loja)',saida_loja:'Saída para filial / franquia',saida_pedido:'Saída de pedido avulso',transferencia:'Enviado ao evento',venda_evento:'Baixa antiga (evento)',devolucao:'Retornou à loja',baixa_evento:'Não retornou ao estoque',ajuste_loja:'Ajuste'};
const roles = {admin:'Administrador CDSB',gerente:'Gerente CDSB',estoquista:'Separador CDSB',evento:'Responsável por loja temporária',consulta:'Consulta',franquia:'Loja permanente'};
const profileLabel = u => u?.role==='admin'?'Administrador CDSB':u?.role==='franquia'?'Loja permanente':u?.role==='estoquista'?'Separador CDSB':u?.role==='evento'?'Loja temporária':(roles[u?.role]||u?.role||'—');
const nav = [
  {id:'inicio',label:'Início',ico:'home'},
  {id:'produtos',label:'Produtos',ico:'package'},
  {id:'lojas',label:'Lojas',ico:'home'},
  {id:'pedidos',label:'Pedidos',ico:'clipboard'},
  {id:'movimentacoes',label:'Atividades',ico:'arrows'},
  {id:'categorias',label:'Categorias',ico:'layers'},
  {id:'tags',label:'Tags',ico:'more'},
  {id:'usuarios',label:'Usuários',ico:'users'}
];
const state = {
  user:null,profile:null,view:'inicio',activeEvent:null,items:[],categories:[],tags:[],apparelModels:[],apparelOpen:new Set(),expandedProductGroups:new Set(),showInactiveProducts:false,eventWorkflow:null,eventReturnQuery:'',events:[],members:[],
  balances:[],movements:[],users:[],audits:[],orders:[],orderItems:[],customerAccess:[],unifiedOrderAdjustments:[],
  eventPickPlans:[],eventPickItems:[],eventPickBatches:[],eventBatchItems:[],eventShipments:[],eventSettlements:[],damages:[],damageActions:[],
  stores:[],userPermissions:[],staffStores:[],ownPermissions:[],storeBalances:[],branchMovements:[],branchReturns:[],storeOrders:[],storeOrderItems:[],storeOrderAdjustments:[],storeOrderReceipts:[],stockReservations:[],inventorySessions:[],inventoryItems:[],consignationClosures:[],stockDestinations:[],stockBatches:[],stockBatchLines:[],stockQuery:{entrada:'',saida:''},
  stockCarts:{entrada:new Map(),saida:new Map()},stockRequestIds:{entrada:null,saida:null},stockSelectedDestination:'',
  search:'',page:0,eventFilter:'',movementFilter:'',movementUser:'',movementPeriod:30,categoryFilter:'',tagFilter:'',ordersContext:null,
  imageCache:new Map(),collapsedCategories:new Set(),catalogExpanded:new Set(),catalogSearch:'',catalogTagsSearch:'',loading:false,toastTimer:0,passwordRecovery:false,loginMode:'password',loginNotice:'',setupPending:false
};
let db = null;
let notifyTimer;
const permissionDefaults = {
 gerente:['products.read','products.create','products.edit','products.delete','stock.entry','stock.exit','stock.balance','stock.destinations','events.read','events.manage','events.separate','events.return','events.sell','events.close','orders.read','orders.internal','orders.assign','orders.central','orders.franchise','orders.separate','orders.receive','orders.cancel','movements.read','movements.export','categories.manage','tags.manage','catalog.manage','products.share','stores.read','stores.manage'],
 estoquista:['products.read','orders.read','orders.separate'],
 evento:['products.read','events.read','events.request'],
 consulta:['products.read','events.read','orders.read','movements.read','stores.read'],
 franquia:['products.read','orders.franchise']
};
const permissionCatalog=[
 ['products.read','Consultar produtos'],['products.create','Cadastrar produtos'],['products.edit','Editar produtos'],['products.delete','Excluir produtos'],
 ['stock.entry','Registrar entrada'],['stock.exit','Registrar saída'],['stock.balance','Realizar balanço'],['stock.destinations','Gerenciar destinos'],
 ['events.read','Consultar lojas temporárias'],['events.request','Solicitar produtos para evento'],['events.manage','Administrar eventos'],['events.separate','Separar para eventos'],['events.return','Conferir devoluções'],['events.close','Aprovar encerramento'],
 ['orders.read','Consultar todos os pedidos'],['orders.internal','Criar pedidos avulsos'],['orders.assign','Vincular pedidos a eventos'],
 ['orders.central','Pedido para loja própria'],['orders.franchise','Solicitar produtos para loja permanente'],['orders.separate','Separar e conferir'],['orders.dispatch','Confirmar saída física do CDSB'],['orders.receive','Conferir entrega'],['orders.cancel','Cancelar pedidos'],
 ['movements.read','Consultar movimentações'],['movements.export','Exportar relatórios'],
 ['categories.manage','Gerenciar categorias'],['tags.manage','Gerenciar tags'],
 ['catalog.manage','Gerenciar catálogos de clientes'],['products.share','Compartilhar produtos'],
 ['stores.read','Consultar lojas'],['stores.manage','Administrar lojas'],['users.manage','Administrar usuários']
];
const hasPermission = p => Boolean(state.profile?.active) && (state.profile?.role==='admin'||state.ownPermissions.includes(p));
const canUseStoreOrders=()=>['orders.central','orders.franchise','orders.separate','orders.receive','orders.cancel'].some(hasPermission);
const isManager = () => hasPermission('events.manage');
const isStockkeeper = () => state.profile?.role === 'estoquista';
const canRegisterProducts = () => hasPermission('products.create') || hasPermission('products.edit');
const canQuickBalance = () => hasPermission('stock.balance');
const viewPermission = {produtos:'products.read',entrada:'stock.entry',saida:'stock.exit',balanco:'stock.balance',eventos:'events.read',pedidos:'orders.read',movimentacoes:'movements.read',categorias:'categories.manage',tags:'tags.manage',usuarios:'users.manage',lojas:'stores.read'};
const permittedView = v => {
 if(isFranchisePortal())return v==='minha-loja'||v==='pedidos';
 if(state.profile?.role==='evento'&&hasPermission('events.request'))return v==='meu-evento'||v==='eventos';
 if(state.profile?.role==='estoquista'&&hasPermission('orders.separate'))return v==='separador'||v==='pedidos';
 if(v==='minha-loja')return isFranchisePortal();
 if(v==='meu-evento')return state.profile?.role==='evento';
 if(v==='separador')return hasPermission('orders.separate');
 if(v==='inicio')return true;
 if(v==='saida'||v==='balanco')return false; // Operações e conferência ficam em Produtos.
 if(v==='pedidos-lojas')return false;
 if(v==='pedidos')return canUseStoreOrders()||hasPermission('orders.read')||hasPermission('orders.internal')||hasPermission('orders.assign')||hasPermission('orders.separate')||hasPermission('events.separate');
 if(v==='separacao')return permittedView('pedidos');
 if(v==='usuarios')return isAdmin();
 if(v==='lojas')return hasPermission('stores.read')||hasPermission('stores.manage')||hasPermission('events.read')||hasPermission('events.manage')||hasPermission('events.separate')||canUseStoreOrders()||hasPermission('orders.read');
 if(v==='lojas-admin')return hasPermission('stores.manage');
 if(v==='avarias')return !isFranchisePortal()&&(hasPermission('stock.balance')||hasPermission('stock.entry'));

 if(v==='inventario')return isAdmin()&&hasPermission('stock.balance');
 if(v==='eventos')return hasPermission('events.read')||hasPermission('events.manage')||hasPermission('events.separate');
 return Boolean(viewPermission[v]&&hasPermission(viewPermission[v]));
};
const isAdmin = () => state.profile?.role === 'admin';
const isFranchisePortal = () => state.profile?.role === 'franquia';
const qtyReserved = id => state.stockReservations.filter(x=>x.product_id===id&&x.status==='ativa')
  .reduce((sum,x)=>sum+Number(x.quantity||0),0);
const qtyAvailable = id => Math.max(0,qtyStore(id)-qtyReserved(id));
const isReader = () => state.profile?.role === 'consulta';
const product = id => state.items.find(x => x.id === id);
const eventById = id => state.events.find(x => x.id === id);
const username = id => state.users.find(x => x.id === id)?.full_name || (id === state.user?.id ? state.profile?.full_name : id?.slice(0,8) || '—');
const qtyStore = id => state.balances.find(x => x.product_id === id && !x.event_id)?.quantity || 0;
const qtyEvent = (id,eventId) => state.balances.find(x => x.product_id === id && x.event_id === eventId)?.quantity || 0;
const memberRole = eventId => state.members.find(m => m.event_id === eventId && m.user_id === state.user?.id)?.role;
const canSell = id => hasPermission('events.sell') && (hasPermission('events.manage') || Boolean(memberRole(id)));
const canReturn = id => hasPermission('events.return') && (hasPermission('events.manage') || memberRole(id) === 'responsavel');
const eventStatus = id => eventById(id)?.status;
function dateToday() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function toast(message,error=false){
  clearTimeout(notifyTimer);
  document.querySelector('.toast')?.remove();
  const el=document.createElement('div');el.className='toast'+(error?' error':'');el.role='status';el.textContent=String(message);
  document.body.append(el);notifyTimer=setTimeout(()=>el.remove(),5500);
}
function assertOk(response){
  if(response?.error) throw response.error;
  return response?.data;
}
function fail(err){
  console.error(err);
  let message=err?.message || 'Não foi possível concluir a operação.';
  if(err?.code==='23505'){
    const detail=String(err.message||'')+' '+String(err.details||'');
    if(/products_(active_sku_unique|sku_key)/i.test(detail))
      message='Este código interno já pertence a um produto ativo. Escolha outro SKU. Códigos de produtos excluídos podem ser reutilizados.';
    else if(/products_(active_ean_unique|ean_key)/i.test(detail))
      message='Este EAN já pertence a um produto ativo. Confira o código de barras. EANs de produtos excluídos podem ser reutilizados.';
    else if(/apparel_variant_unique/i.test(detail))
      message='Esta cor e este tamanho já estão cadastrados como variação ativa deste produto.';
  }
  toast(message,true);
}
async function exec(work,success='Operação registrada.'){
  if(state.loading)return;
  state.loading=true;
  try { await work(); await loadData(); document.querySelector('.modalback')?.remove(); toast(typeof success==='function'?success():success); }
  catch(error){fail(error);}
  finally {state.loading=false;}
}
async function fetchAllCategories(){
  const limit=1000, all=[];
  for(let offset=0;;offset+=limit){
    const response=await db.from('categories').select('*').order('id').range(offset,offset+limit-1);
    const batch=assertOk(response)||[];
    all.push(...batch);
    if(batch.length<limit)break;
  }
  return {data:all,error:null};
}
async function loadData(){
  if(!state.user)return;
  const resources=[
    ['items',db.from('products').select('*').order('name').limit(2500)],
    ['apparelModels',db.from('apparel_models').select('*').order('created_at',{ascending:false}).limit(1000)],
    ['categories',fetchAllCategories()],
    ['tags',db.from('tags').select('*').order('name').limit(1000)],
    ['events',db.from('events').select('*').order('starts_at',{ascending:false}).limit(1000)],
    ['members',db.from('event_members').select('*').limit(2000)],
    ['balances',db.from('stock_balances').select('*').limit(10000)],
    ['movements',db.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(1000)],
    ['users',db.from('staff_profiles').select('id,full_name,username,role,active,permissions_customized,created_at').order('full_name').limit(1000)]
  ];
  resources.push(['stores',db.from('stores').select('*').order('name')]);
  if(hasPermission('stock.balance')||hasPermission('stores.manage')||hasPermission('events.manage')){
   resources.push(['inventorySessions',db.from('inventory_sessions').select('*').order('created_at',{ascending:false}).limit(100)]);
   resources.push(['inventoryItems',db.from('inventory_session_items').select('*').limit(10000)]);
  }
  if(!isFranchisePortal()&&(hasPermission('orders.separate')||hasPermission('events.separate')||hasPermission('events.read')||hasPermission('events.manage'))){
    resources.push(['eventPickBatches',db.from('event_pick_batches').select('*').order('created_at',{ascending:false}).limit(2000)]);
    resources.push(['eventBatchItems',db.from('event_pick_batch_items').select('*').limit(10000)]);
  }
  if(hasPermission('events.read')||hasPermission('events.manage')||hasPermission('events.close')){
    resources.push(['eventPickPlans',db.from('event_pick_plans').select('*').limit(1000)]);
    resources.push(['eventPickItems',db.from('event_pick_plan_items').select('*').limit(10000)]);
    resources.push(['eventShipments',db.from('event_shipments').select('*').order('created_at',{ascending:false}).limit(1000)]);
    resources.push(['eventSettlements',db.from('event_settlement_drafts').select('*').limit(1000)]);
  }
  if(hasPermission('stock.balance')||hasPermission('events.manage')||hasPermission('events.close')){
    resources.push(['damages',db.from('stock_damages').select('*').order('created_at',{ascending:false}).limit(1000)]);
    resources.push(['damageActions',db.from('stock_damage_actions').select('*').order('created_at',{ascending:false}).limit(2000)]);
  }
  if(hasPermission('events.manage')||hasPermission('events.close'))resources.push(['consignationClosures',db.from('consignation_closures').select('*').limit(500)]);
  resources.push(['storeBalances',db.from('store_stock').select('store_id,product_id,quantity').limit(10000)]);
  if(hasPermission('stores.read')){
    resources.push(['branchMovements',db.from('store_stock_movements').select('*').order('created_at',{ascending:false}).limit(500)]);
    resources.push(['branchReturns',db.from('branch_returns').select('*').order('created_at',{ascending:false}).limit(500)]);
  }
  if(hasPermission('orders.separate')||hasPermission('stock.entry')||hasPermission('stock.exit')||hasPermission('stock.balance')||hasPermission('products.read')){
    resources.push(['stockReservations',db.from('stock_reservations')
      .select('order_id,avulso_order_id,event_batch_id,product_id,quantity,status').eq('status','ativa').limit(10000)]);
  }
  if(canUseStoreOrders() || hasPermission('orders.read')){
    resources.push(['storeOrders',db.from('store_orders').select('*').order('created_at',{ascending:false}).limit(500)]);
    resources.push(['storeOrderItems',db.from('store_order_items').select('*').limit(5000)]);
    if(hasPermission('orders.read')){
      resources.push(['storeOrderAdjustments',db.from('store_order_adjustments').select('*').order('created_at',{ascending:false}).limit(2000)]);
      resources.push(['storeOrderReceipts',db.from('store_order_receipts').select('*').limit(5000)]);
    }
  }
  resources.push(['ownPermissions',db.rpc('my_permissions').then(r=>({data:(r.data||[]).map(x=>x.permission),error:r.error}))]);
  resources.push(['staffStores',db.from('staff_stores').select('*').limit(5000)]);
  if(isAdmin()){
    resources.push(['userPermissions',db.from('staff_permissions').select('*').limit(5000)]);
  }
  if(hasPermission('movements.read') || hasPermission('users.manage')){
    resources.push(['audits',db.from('audit_log').select('id,entity,entity_id,action,actor_id,created_at').order('created_at',{ascending:false}).limit(100)]);
  }
  if(hasPermission('orders.read')||hasPermission('orders.internal')||hasPermission('catalog.manage')){
    resources.push(['orders',db.from('avulso_orders').select('id,customer_name,customer_phone,created_at,source,event_id,created_by,fulfillment_status,expires_at').order('created_at',{ascending:false}).limit(1000)]);
    resources.push(['orderItems',db.from('avulso_order_items').select('order_id,product_id,product_name,color,size,sku,ean,quantity').limit(3000)]);
  }
  if(hasPermission('orders.read'))resources.push(['unifiedOrderAdjustments',db.from('unified_order_adjustments').select('*').order('created_at',{ascending:false}).limit(3000)]);
  if(hasPermission('catalog.manage')){
    resources.push(['customerAccess',db.from('customer_catalog_access').select('id,label,created_at,expires_at,revoked_at').order('created_at',{ascending:false}).limit(250)]);
  }
  if(hasPermission('stock.entry')||hasPermission('stock.exit')||hasPermission('stock.destinations')){
    resources.push(['stockDestinations',db.from('stock_destinations').select('id,name,description,active,created_at').order('name').limit(1000)]);
    resources.push(['stockBatches',db.from('stock_operation_batches').select('id,operation,destination_id,note,created_at').order('created_at',{ascending:false}).limit(100)]);
    resources.push(['stockBatchLines',db.from('stock_movements').select('product_id,operation_batch_id,quantity').not('operation_batch_id','is',null).order('created_at',{ascending:false}).limit(2500)]);
  }
  const results=await Promise.all(resources.map(async ([key,request])=>[key,await request]));
  for(const [key,result] of results) state[key]=assertOk(result)||[];
  const updated=state.users.find(x=>x.id===state.user.id);
  if(updated)state.profile=updated;
  if(!state.profile?.active)throw new Error('Seu usuário está desativado.');
  render();
}
async function loadProfile(){
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user){state.user=null;state.profile=null;render();return;}
  state.user=user;
  const response=await db.from('staff_profiles').select('id,full_name,email,role,active,permissions_customized').eq('id',user.id).maybeSingle();
  if(response.error){fail(response.error);return;}
  state.profile=response.data;
  if(!state.profile){const r=await db.rpc('is_initial_admin_pending');state.setupPending=Boolean(r.data)&&!r.error;}
  if(!state.profile?.active){render();return;}
  try {
    const p=assertOk(await db.rpc('my_permissions'))||[];
    state.ownPermissions=p.map(x=>x.permission);
    await loadData();
  }catch(err){fail(err);render();}
}
function loginScreen(message=''){
  const legacy=false;
  root.innerHTML='<div class="login-wrap"><section class="login">'+
  '<div class="brand-login"><img src="./ame-plus-logo.svg" alt="Ame+ Store" width="225" height="120"><small>CONTROLE DE ESTOQUE</small></div>'+
  '<h1>Entrar no sistema</h1><p class="muted">'+
  (legacy?'Acesso por email para contas antigas que ainda não definiram senha.':
    'Entre com seu usuário e senha.')+'</p>'+
  (message?'<div class="alert">'+h(message)+'</div>':'')+
  (state.loginNotice?'<div class="note" role="status">'+h(state.loginNotice)+'</div>':'')+
  '<form data-form="'+(legacy?'login-link':'login-password')+'">'+
  field('Usuário','username','text','','required autocomplete="username" autocapitalize="none" spellcheck="false"')+
  (legacy?'':field('Senha','password','password','','required autocomplete="current-password"'))+
  '<button class="button primary" type="submit">'+(legacy?'Enviar link para meu email':'Entrar')+'</button></form>'+
  '<button type="button" class="plain" style="margin-top:12px" data-action="login-mode">'+
  (legacy?'Voltar ao login por senha':'Ainda não tenho senha (acesso antigo)')+'</button>'+
  '<p class="help" style="margin-top:12px">Novas contas são criadas pelo administrador. Não existe cadastro público.</p>'+
  '</section></div>';
}

function pendingAccessScreen(){
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand-login"><img src="./ame-plus-logo.svg" alt="Ame+ Store" width="225" height="120"><small>CONTROLE DE ESTOQUE</small></div>'+
  '<h1>Acesso pendente</h1><p>O email <strong>'+h(state.user?.email)+'</strong> já foi identificado, mas precisa ser liberado por um administrador.</p>'+
  '<button class="button" data-action="logout">Sair</button></section></div>';
}
function initialAdminScreen(){
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand-login"><img src="./ame-plus-logo.svg" alt="Ame+ Store" width="225" height="120"><small>CONTROLE DE ESTOQUE</small></div>'+
  '<h1>Ativar administrador</h1><p>Email confirmado: <strong>'+h(state.user?.email)+'</strong>. Informe o código de ativação de uso único.</p>'+
  '<form data-form="admin-bootstrap">'+
  field('Nome do administrador','full_name','text','','required minlength="2" maxlength="120"')+
  field('Código de ativação','activation_code','password','','required autocomplete="off"')+
  '<button class="button primary" type="submit">Ativar acesso</button></form>'+
  '<button class="plain" data-action="logout" style="margin-top:12px">Trocar de email</button></section></div>';
}
function field(label,name,type='text',value='',attr='',help=''){
  return '<label class="field"><span>'+h(label)+'</span><input name="'+h(name)+'" type="'+h(type)+'" value="'+h(value)+'" '+attr+' />'+(help?'<span class="help">'+h(help)+'</span>':'')+'</label>';
}
function selectField(label,name,options,value='',attr=''){
  return '<label class="field"><span>'+h(label)+'</span><select name="'+h(name)+'" '+attr+'>'+options.map(([id,name])=>'<option value="'+h(id)+'" '+(String(id)===String(value)?'selected':'')+'>'+h(name)+'</option>').join('')+'</select></label>';
}
function textareaField(label,name,value='',required=false){
  return '<label class="field wide"><span>'+h(label)+'</span><textarea name="'+h(name)+'" '+(required?'required':'')+'>'+h(value)+'</textarea></label>';
}
// Uma hierarquia pode ter qualquer número de níveis. A lista usa DFS iterativo
// para não esgotar a pilha do navegador com categorias muito profundas.
function categoryTree(){
  const byParent=new Map(),visited=new Set(),ordered=[];
  for(const cat of state.categories){
    const key=cat.parent_id||null;
    if(!byParent.has(key))byParent.set(key,[]);
    byParent.get(key).push(cat);
  }
  for(const items of byParent.values())items.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const stack=[...(byParent.get(null)||[])].reverse();
  while(stack.length){
    const cat=stack.pop();
    if(visited.has(cat.id))continue;
    visited.add(cat.id);ordered.push({...cat,visualDepth:cat.depth});
    const children=byParent.get(cat.id)||[];
    for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
  }
  for(const cat of state.categories)if(!visited.has(cat.id))ordered.push({...cat,visualDepth:cat.depth});
  return ordered;
}
function categoryChain(id){
  const chain=[],seen=new Set();
  const byId=new Map(state.categories.map(c=>[c.id,c]));
  let item=byId.get(id);
  while(item&&!seen.has(item.id)){
    seen.add(item.id);chain.unshift(item);item=byId.get(item.parent_id);
  }
  return chain;
}
function categoriesOptions(blank=true){
  return (blank?[['','Sem categoria']]:[]).concat(categoryTree().map(c=>[
    c.id, '— '.repeat(Math.min(3,Math.max(0,c.visualDepth-1)))+c.name+
      (c.visualDepth>4?' · nível '+c.visualDepth:'')
  ]));
}
function categoryChildren(parentId){
  return state.categories.filter(c=>c.parent_id===parentId)
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function categorySelector(item=null){
  const id=item?.category_id||'';
  return '<section class="form-section wide"><div class="section-head"><strong>Categoria do produto</strong>'+
    '<small>Qualquer nível</small></div>'+
    '<div class="taxonomy-control"><input name="category_id" type="hidden" value="'+h(id)+'">'+
    '<button type="button" class="taxonomy-trigger" data-action="taxonomy-open" data-mode="product" aria-haspopup="dialog">'+
    '<span class="taxonomy-icon">▤</span><span class="taxonomy-text"><small>Categoria selecionada</small><strong data-category-label>'+h(id?categoryFull(id):'Escolher categoria')+'</strong></span>'+
    '<span aria-hidden="true" class="taxonomy-arrow">⌄</span></button>'+
    (hasPermission('categories.manage')?button(id?'+ Subcategoria':'+ Categoria','quick-category','','small'):'')+'</div>'+
    '<p class="help">Busque ou navegue pela hierarquia. Criar categoria abre um cadastro separado.</p></section>';
}
function chosenCategory(form){return form?.querySelector('input[name="category_id"]')?.value||null;}

function tagChipsHTML(selected=[],categoryId=null){
  const chosen=new Set(selected.map(t=>t.toLocaleLowerCase('pt-BR')));
  if(!state.tags.length)return '<span class="muted">Nenhuma tag cadastrada ainda.</span>';
  const {recommended,other}=rankTagsForCategory({
    categoryId,categories:state.categories,products:state.items,tags:state.tags,selected
  });
  const renderTags=list=>list.map(t=>
    '<label class="tag-choice"><input type="checkbox" name="chosen_tags" value="'+h(t.name)+'" '+
    (chosen.has(t.name.toLocaleLowerCase('pt-BR'))?'checked':'')+
    '><span>'+h(t.name)+'</span></label>').join('');
  if(!categoryId)return '<div class="catalog-tag-pills">'+renderTags([...recommended,...other])+'</div>';
  return '<div class="catalog-tag-guide"><strong>'+
      (recommended.length?'Recomendadas para esta categoria':'Nenhuma tag utilizada nesta categoria ainda')+
      '</strong><small>'+(recommended.length?'Ordenadas pelas tags dos produtos ativos desta categoria e subcategorias.':
       'Você pode usar qualquer tag já cadastrada.')+'</small></div>'+
    (recommended.length?'<div class="catalog-tag-pills">'+renderTags(recommended)+'</div>':'')+
    (other.length?'<button type="button" class="catalog-show-tags" data-action="tag-show-all" aria-expanded="false">'+
      'Ver outras '+other.length+' tags ▾</button>'+
      '<div class="catalog-tag-pills catalog-more-tags" data-other-tags hidden>'+renderTags(other)+'</div>':'');
}
function refreshProductTagChoices(form){
  if(!form)return;
  const el=form.querySelector('[data-tag-choices]');
  if(!el)return;
  const selected=[...el.querySelectorAll('input[name="chosen_tags"]:checked')].map(input=>input.value);
  const opened=!el.querySelector('[data-other-tags]')?.hidden;
  el.innerHTML=tagChipsHTML(selected,chosenCategory(form));
  if(opened){
    const others=el.querySelector('[data-other-tags]'),control=el.querySelector('[data-action="tag-show-all"]');
    if(others){others.hidden=false;if(control){control.setAttribute('aria-expanded','true');control.textContent='Ocultar outras tags ▴';}}
  }
}
function productTagChooser(item=null){
  return '<section class="form-section wide"><div class="section-head"><strong>Tags</strong>'+
    (hasPermission('tags.manage')?button('+ Criar tag','quick-tag','','small'):'')+
    '</div><p class="help">Primeiro, as tags já utilizadas em produtos da mesma categoria. As demais continuam disponíveis.</p>'+
    '<div class="tag-choices" data-tag-choices>'+tagChipsHTML(item?.tags||[],item?.category_id||null)+'</div></section>';
}

function refreshTaxonomyForm(selectedCategory=null,selectedTag=null){
  const form=document.querySelector('form[data-form="product-new"],form[data-form="product-edit"],form[data-form="apparel-create"]');
  if(!form)return;
  if(selectedCategory){
    const input=form.querySelector('input[name="category_id"]');
    if(input)input.value=selectedCategory;
    const label=form.querySelector('[data-category-label]');
    if(label)label.textContent=categoryFull(selectedCategory);
    const add=form.querySelector('[data-action="quick-category"]');
    if(add)add.textContent='+ Subcategoria';
    refreshCategorySizeOptions(form,state.categories);
  }
  const checks=form.querySelector('[data-tag-choices]');
  if(checks){
    const selected=[...form.querySelectorAll('input[name="chosen_tags"]:checked')].map(el=>el.value);
    if(selectedTag)selected.push(selectedTag);
    checks.innerHTML=tagChipsHTML(selected,chosenCategory(form));
  }
}

function productTagValues(form){
  return [...form.querySelectorAll('input[name="chosen_tags"]:checked')].map(x=>x.value);
}

function productOptions(includeEmpty=false, eventId=null) {
  const arr=state.items.filter(p=>eventId ? qtyEvent(p.id,eventId)>0 : p.active);
  return (includeEmpty?[['','Escolha um produto']]:[]).concat(arr.map(x=>[x.id,x.name+(x.sku?' ('+x.sku+')':'')]));
}
function eventOptions(){return [['','Todos os eventos']].concat(state.events.map(e=>[e.id,e.name]));}
function tabHead(title,desc='',buttons=''){
  return '<header class="pagehead"><div><h1>'+h(title)+'</h1>'+(desc?'<p>'+h(desc)+'</p>':'')+'</div><div class="actions">'+buttons+'</div></header>';
}
function button(label,action,extra='',kind=''){
  return '<button type="button" class="button '+kind+'" data-action="'+h(action)+'" '+extra+'>'+h(label)+'</button>';
}
function pill(status){return '<span class="pill '+h(status)+'">'+h({ativo:'Ativo',encerrado:'Encerrado',rascunho:'Rascunho'}[status]||status)+'</span>';}
function render(){
  if(!db){root.innerHTML='<div class="login-wrap"><div class="login"><div class="brand-login"><img src="./ame-plus-logo.svg" alt="Ame+ Store" width="225" height="120"><small>CONTROLE DE ESTOQUE</small></div><h2>Configuração necessária</h2><p>Verifique o Supabase exclusivo deste sistema em <code>config.js</code>.</p></div></div>';return;}
  if(!state.user){loginScreen();return;}
  if(!state.profile){state.setupPending?initialAdminScreen():pendingAccessScreen();return;}
  if(!state.profile.active){pendingAccessScreen();return;}
  if(state.view==='inicio'){
  if(isFranchisePortal())state.view='minha-loja';
  else if(state.profile?.role==='estoquista'&&hasPermission('orders.separate'))state.view='separador';
  else if(state.profile?.role==='evento'&&hasPermission('events.request'))state.view='meu-evento';
 }
 if(!permittedView(state.view))state.view=isFranchisePortal()?'minha-loja':state.profile?.role==='estoquista'?'separador':state.profile?.role==='evento'?'meu-evento':'inicio';
  const mark='<img class="ame-brand-logo" src="./ame-plus-logo.svg" alt="Ame+ Store" width="132" height="70">';
  const sectionNav=isFranchisePortal()?[{id:'minha-loja',label:'Minha Loja',ico:'home'},{id:'pedidos',label:'Meus pedidos',ico:'clipboard'}]:
  state.profile?.role==='evento'&&hasPermission('events.request')?[{id:'meu-evento',label:'Meu Evento',ico:'calendar'},{id:'eventos',label:'Detalhes',ico:'clipboard'}]:
  state.profile?.role==='estoquista'&&hasPermission('orders.separate')?[{id:'separador',label:'Separação',ico:'clipboard'},{id:'pedidos',label:'Todos os pedidos',ico:'package'}]:nav;
 const menu=sectionNav.filter(x=>permittedView(x.id))
    .map(x=>'<button type="button" data-action="view" data-view="'+h(x.id)+'" class="'+((state.view===x.id||(state.view==='entrada'&&x.id==='produtos')||(['eventos','lojas-admin'].includes(state.view)&&x.id==='lojas'))?'active':'')+'">'+
      uiIcon(x.ico,19)+'<span>'+h(x.label)+'</span></button>').join('');
  const desktopIdentity='<div class="brand brand-lockup">'+mark+'<small>CONTROLE DE ESTOQUE</small></div>';
  root.innerHTML='<div class="app-shell mobile-c-app"><aside class="sidebar">'+desktopIdentity+
    '<nav class="nav" aria-label="Menu principal">'+menu+'</nav>'+
    '<div class="sidefoot"><strong>'+h(state.profile.full_name)+'</strong><br>'+h(profileLabel(state.profile))+
    '<br><button class="plain" data-action="my-password">Minha senha</button>'+
    '<br><button class="plain" data-action="logout">Sair da conta</button></div></aside>'+
    '<div class="main"><header class="topbar"><div class="topbar-brand">'+mark+
    '<span class="ame-header-title">CDSB</span></div>'+
    '<div class="topbar-right"><span class="userpill">'+h(state.profile.full_name)+' · '+h(profileLabel(state.profile))+'</span>'+
    '<button type="button" class="mobile-top-menu only-mobile" aria-label="Abrir menu de navegação" aria-haspopup="dialog" aria-expanded="false" data-action="mobile-more">'+uiIcon('menu',23)+'</button></div></header>'+
    '<main class="content">'+pageContent()+'</main></div></div>';
  hydrateImages();
}

function pageContent(){
  if(state.view==='minha-loja')return permanentPage();
 if(state.view==='meu-evento')return temporaryPage();
 if(state.view==='separador')return separationHomePage();
 if(state.view==='entrada'||state.view==='saida')return renderStockOperationPage();
  if(state.view==='balanco')return quickBalancePage();
  if(state.view==='inventario')return inventoryPage();
  if(state.view==='avarias')return damageStockPage();
  if(state.view==='produtos')return productsPage();
  if(state.view==='eventos')return state.activeEvent?(state.eventWorkflow==='return'?returnWorkflowPage():eventDetails()):storesPage();
  if(state.view==='movimentacoes')return movementsPage();
  if(state.view==='pedidos')return ordersPage();
  if(state.view==='separacao')return ordersPage();
  if(state.view==='categorias')return categoriesPage();
  if(state.view==='tags')return tagsPage();
  if(state.view==='usuarios')return usersPage();
  if(state.view==='lojas')return storesPage();
  if(state.view==='lojas-admin')return storesAdminPage();
  if(state.view==='pedidos-lojas')return ordersPage();
  return dashboard();
}
function permanentPage(){
 const units=state.stores.filter(s=>!s.is_primary&&assignedStore(s.id)&&s.kind==='franquia'&&s.active);
 const ids=new Set(units.map(s=>s.id));
 const orders=state.storeOrders.filter(o=>ids.has(o.to_store_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 return permanentHome({stores:units,orders,button,time:niceTime,userId:state.user?.id});
}
function temporaryPage(){
 const events=state.events.filter(e=>!e.deleted_at&&memberRole(e.id)).sort((a,b)=>
   String(b.starts_at||'').localeCompare(String(a.starts_at||'')));
 return temporaryHome({events,balances:state.balances,batches:state.eventPickBatches,button,time:niceTime});
}
function separationHomePage(){
 return pickerHome(unifiedOrderRecords(),{button,time:niceTime});
}
function panel(title,content,buttonMarkup=''){
  return '<section class="panel"><div class="panelhead"><h2>'+h(title)+'</h2>'+buttonMarkup+'</div>'+content+'</section>';
}
// Reutilizado na lista completa e na home: mesmas informações, botões e retrátil.
function productGroupCard(group){
  return groupedCard(group,{
    h,photoButton,qtyStore,qtyEvent,qtyReserved,qtyAvailable,button,isManager,canRegisterProducts,
    canMoveStock:()=>!isFranchisePortal()&&(hasPermission('stock.entry')||hasPermission('stock.exit')),
    canManageSku:()=>!isFranchisePortal()&&['stock.entry','stock.exit','stock.balance','products.edit'].some(hasPermission),
    canQuickCount:()=>!isFranchisePortal()&&hasPermission('stock.balance')&&['admin','gerente','estoquista'].includes(state.profile?.role),
    expanded:state.expandedProductGroups.has(group.key),canShare:canRegisterProducts()
  });
}
function dashboard(){
  const all=state.items.filter(p=>p.active);
  const total=state.balances.filter(b=>!b.event_id).reduce((sum,b)=>sum+b.quantity,0);
  const eventTotal=state.balances.filter(b=>b.event_id).reduce((sum,b)=>sum+b.quantity,0);
  const zero=all.filter(p=>qtyAvailable(p.id)===0).length;
  const reserved=state.stockReservations.reduce((sum,x)=>sum+Number(x.quantity||0),0);
  const available=Math.max(0,total-reserved);
  const activeEvents=state.events.filter(e=>e.status==='ativo').length;
  const movementsToday=state.movements.filter(m=>m.created_at&&new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(m.created_at))===dateToday()).length;
  const firstName=(state.profile.full_name||'').trim().split(/\s+/)[0]||'Olá';
  const recentGroups=recentInventoryGroups(all,state.apparelModels,6);
  const roots=state.categories.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const categoryCards=roots.slice(0,8).map(c=>{
    const count=all.filter(p=>categoryChain(p.category_id).some(path=>path.id===c.id)).length;
    return '<button type="button" class="c-category-card" data-action="home-category" data-id="'+h(c.id)+'">'+
      '<span class="c-category-icon">'+uiIcon('layers',21)+'</span>'+
      '<strong>'+h(c.name)+'</strong><small>'+count+' produto(s)</small></button>';
  }).join('');
  const productCards=recentGroups.map(productGroupCard).join('');
  const cards=[
    {label:'Produtos ativos',value:all.length,icon:'package',tone:'green',hint:'Cadastrados'},
    {label:'Sem disponibilidade',value:zero,icon:'alert',tone:'red',hint:'Livre na central'},
    {label:'Movimentações',value:movementsToday,icon:'arrows',tone:'blue',hint:'Hoje'},
    {label:'Eventos ativos',value:activeEvents,icon:'calendar',tone:'orange',hint:'Em andamento'}
  ];
  return '<div class="c-dashboard">'+
    '<div class="c-welcome"><span class="c-eyebrow">PAINEL DO ESTOQUE</span>'+
    '<h1>Olá, '+h(firstName)+'!</h1><p>Acompanhe seu estoque em um só lugar.</p></div>'+
    '<section class="c-hero" aria-label="Resumo das unidades na loja"><div class="c-hero-main">'+
    '<span class="c-hero-label">'+uiIcon('package',19)+' Físico na central</span>'+
    '<strong class="c-hero-number">'+total.toLocaleString('pt-BR')+'</strong>'+
    '<span class="c-hero-sub">'+available.toLocaleString('pt-BR')+' disponíveis · '+reserved.toLocaleString('pt-BR')+' reservadas · '+eventTotal.toLocaleString('pt-BR')+' em lojas temporárias</span></div>'+
    '<div class="c-hero-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div></section>'+
    '<div class="c-metric-grid">'+cards.map(c=>'<div class="c-metric c-metric-'+c.tone+'">'+
      '<div class="c-metric-icon">'+uiIcon(c.icon,21)+'</div>'+
      '<div class="c-metric-data"><span>'+h(c.label)+'</span><strong>'+c.value.toLocaleString('pt-BR')+'</strong>'+
      '<small>'+h(c.hint)+'</small></div></div>').join('')+'</div>'+
    '<div class="c-dashboard-actions">'+
      (canRegisterProducts()?'<button type="button" class="c-action-primary" data-action="product-new">'+
        uiIcon('plus',20)+' Novo produto</button>':'')+
      (hasPermission('stock.entry')?'<button type="button" class="c-action-outline" data-action="stock-receive-shipment">'+
        uiIcon('arrow-down-to-line',20)+' Receber remessa</button>':'')+
      '<button type="button" class="c-action-outline" data-action="global-scan">'+uiIcon('scan',20)+' Ler EAN</button></div>'+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Categorias</h2>'+
    '<button type="button" data-action="view" data-view="produtos">Ver produtos '+uiIcon('chevron',17)+'</button></div>'+
    (categoryCards?'<div class="c-category-grid">'+categoryCards+'</div>':
      '<p class="c-dash-empty">Cadastre categorias para organizar os produtos.</p>')+'</section>'+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Produtos recentes</h2>'+
    '<button type="button" data-action="view" data-view="produtos">Ver todos '+uiIcon('chevron',17)+'</button></div>'+
    (productCards?'<div class="products-panel c-dashboard-recent-products"><div class="grouped-inventory-grid">'+productCards+'</div></div>':
      '<div class="c-dash-empty">'+uiIcon('package',28)+'<span>Nenhum produto cadastrado ainda.</span>'+
      (canRegisterProducts()?button('Cadastrar primeiro produto','product-new','','primary'):'')+'</div>')+'</section>'+
    (activeEvents?'<section class="c-dashboard-section c-event-shortcut"><div>'+
      uiIcon('calendar',21)+' <strong>'+activeEvents+' evento(s) em andamento</strong></div>'+
      '<button type="button" data-action="view" data-view="eventos">Ver eventos '+uiIcon('arrow',16)+'</button></section>':'')+
    '</div>';
}

function imgMarkup(p){
  return p.image_path?'<img class="thumb" data-photo-id="'+h(p.id)+'" alt="Foto: '+h(p.name)+'" loading="lazy" />':
    '<div class="thumb placeholder" aria-hidden="true">▧</div>';
}
function photoButton(p){
  return '<button type="button" class="product-photo" data-action="photo-view" data-id="'+h(p.id)+'" aria-label="Ampliar a foto de '+h(p.name)+'">'+imgMarkup(p)+'</button>';
}
function productCell(p){
  return '<div class="cell-product">'+photoButton(p)+'<div><strong>'+h(p.name)+'</strong><small>'+h(p.sku||p.ean||'Sem código')+'</small></div></div>';
}
function mobileProductCard(p){
  return '<article class="mobile-product-card">'+photoButton(p)+
    '<div class="mobile-product-info"><strong>'+h(p.name)+'</strong><small>'+h(categoryFull(p.category_id))+'</small>'+
    '<small>'+h(p.sku||p.ean||'Sem código')+'</small>'+ 
    '<small>'+h([p.gondola,p.prateleira].filter(Boolean).join(' · '))+'</small>'+
    '<div class="product-tags">'+(p.tags||[]).slice(0,3).map(t=>'<span class="tag">'+h(t)+'</span>').join('')+'</div>'+
    '<div class="mobile-product-actions"><span class="qty">Livre: '+qtyAvailable(p.id)+' · Físico: '+qtyStore(p.id)+'</span>'+
    (hasPermission('products.read')?button('Detalhar estoque','stock-overview','data-id="'+h(p.id)+'"','small'):'')+
    ((hasPermission('stock.entry')||hasPermission('stock.exit'))?button('Movimentar','stock-modal','data-id="'+h(p.id)+'"','small'):'')+
    (hasPermission('products.edit')?button('Editar','product-edit','data-id="'+h(p.id)+'"','small primary'):'')+
    (hasPermission('products.delete')?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+'</div></div></article>';
}

function categoryFull(id){
  const bits=[],seen=new Set();let cat=state.categories.find(c=>c.id===id);
  while(cat&&!seen.has(cat.id)){seen.add(cat.id);bits.unshift(cat.name);cat=state.categories.find(c=>c.id===cat.parent_id);}
  return bits.join(' / ') || '—';
}
function productModelManager(modelId){
  if(!canRegisterProducts())return;
  const model=state.apparelModels.find(m=>m.id===modelId);
  if(!model)return toast('Modelo não encontrado.',true);
  const variants=state.items.filter(p=>p.apparel_model_id===modelId);
  if(!variants.length)return toast('Não há variações neste modelo.',true);
  while(document.querySelector('.modalback'))closeTopModal();
  const overlay=document.createElement('div');
  overlay.className='modalback';
  const rows=variants.map(p=>'<div class="product-model-manage-item">'+
    '<div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
      '<small>SKU: '+h(p.sku||'—')+' · EAN: '+h(p.ean||'—')+'</small>'+
      (!p.active?'<small>Variação inativa</small>':'')+'</div>'+
    '<div class="actions">'+button('Editar','product-edit','data-id="'+h(p.id)+'"','small')+
      (hasPermission('products.delete')?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+
    '</div></div>').join('');
  overlay.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="Editar '+h(model.name)+'">'+
    '<div class="modalhead"><h2>Editar · '+h(model.name)+'</h2>'+
      '<button type="button" class="plain" data-action="modal-close" aria-label="Fechar">✕</button></div>'+
    '<div class="product-model-manage">'+
      '<p>Escolha o tamanho que deseja editar. Cada variação tem EAN, SKU e estoque independentes.</p>'+
      '<div class="product-model-manage-actions">'+
        button('Alterar foto','apparel-photo','data-id="'+h(modelId)+'"','small')+
        button('+ Adicionar tamanhos','add-variants','data-id="'+h(modelId)+'"','small primary')+
      '</div>'+
      rows+
    '</div></section>';
  document.body.append(overlay);
  overlay.querySelector('[data-action="modal-close"]')?.focus({preventScroll:true});
}

function productsPage(){
  if(isFranchisePortal())return franchiseCatalogPage();
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  const matched=state.items.filter(p=>(state.showInactiveProducts||p.active)&&
    (!q||[p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira,...(p.tags||[])].join(' ').toLocaleLowerCase('pt-BR').includes(q))&&
    (!state.categoryFilter||categoryChain(p.category_id).some(c=>c.id===state.categoryFilter))&&
    (!state.tagFilter||(p.tags||[]).includes(state.tagFilter)));
  const groupKeys=new Set(matched.map(p=>p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  // A busca por um único EAN retorna o modelo completo com todos os seus tamanhos.
  const expanded=state.items.filter(p=>(state.showInactiveProducts||p.active)&&
    groupKeys.has(p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  const groups=groupInventory(expanded,state.apparelModels);
  const filtersApplied=Boolean(q||state.categoryFilter||state.tagFilter||state.showInactiveProducts);
  const available=state.items.filter(p=>p.active).length;
  const pageSize=5,totalPages=Math.max(1,Math.ceil(groups.length/pageSize));
  state.page=Math.max(0,Math.min(state.page,totalPages-1));
  const list=groups.slice(0,(state.page+1)*pageSize);
  const add=(isAdmin()&&hasPermission('stock.balance')?button('Conferência formal','view','data-view="inventario"','small'):'')+
    ((hasPermission('stock.balance')||hasPermission('stock.entry'))?button('Avarias em análise','view','data-view="avarias"','small'):'')+
    (hasPermission('stock.entry')?button('↓ Receber remessa','stock-receive-shipment','',''):'')+
    (hasPermission('products.create')?button('+ Novo produto','product-new','','primary'):'');
  return '<header class="pagehead products-pagehead"><div><h1>Produtos</h1>'+
    '<p>Catálogo e estoque</p></div><div class="actions">'+add+'</div></header>'+
    '<section class="panel products-panel"><div class="product-toolbar-v3">'+
      '<div class="product-search-row">'+
        '<input id="product-search" type="search" class="search" autocomplete="off"'+
        ' placeholder="Nome, EAN, tamanho ou SKU…" aria-label="Buscar produtos" value="'+h(state.search)+'">'+
        '<button type="button" class="product-scan-btn" data-action="search-scan" aria-label="Ler EAN pela câmera" title="Ler EAN">'+
          uiIcon('scan',23)+'</button></div>'+
      '<div class="product-filter-row">'+
        '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="filter" aria-haspopup="dialog">'+
          '<span>'+h(state.categoryFilter?categoryFull(state.categoryFilter):'Todas as categorias')+'</span><span aria-hidden="true">⌄</span></button>'+
        '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="tag" aria-haspopup="dialog">'+
          '<span>'+h(state.tagFilter||'Tags')+'</span><span aria-hidden="true">⌄</span></button>'+
      '</div>'+
      '<div class="product-filter-tools">'+
        '<details class="product-extra-filters"><summary>☷ '+(state.showInactiveProducts?'Inativos visíveis':'Mais filtros')+
          ' <span aria-hidden="true">⌄</span></summary><div>'+
          button(state.showInactiveProducts?'Ocultar inativos':'Mostrar inativos','products-toggle-inactive','','small')+
          '</div></details>'+
        (filtersApplied?button('Limpar filtros','products-clear-filters','','small'):'')+
      '</div>'+
    '</div>'+
    '<div class="grouped-inventory-grid">'+(list.length?list.map(productGroupCard).join(''):'<div class="muteblock"><strong>Nenhum produto corresponde aos filtros.</strong>'+
      (filtersApplied?'<p>Existem '+available+' variação(ões) ativa(s) cadastrada(s). Limpe a busca e os filtros para encontrá-las.</p>'+
      (hasPermission('products.create')&&/^\\d{8,14}$/.test(state.search.trim())?button('Cadastrar produto com este EAN','product-new-ean','','primary'):'')+
      button('Mostrar todos os produtos','products-clear-filters','','primary'):
      '<p>Cadastre um novo produto ou verifique a opção Mostrar inativos.</p>')+'</div>')+'</div>'+
    '<div class="panelbody inline" style="justify-content:space-between"><small>'+
    'Exibindo '+list.length+' de '+groups.length+' modelo(s) · '+matched.length+' variação(ões)'+
    '</small><div class="actions">'+
    (state.page+1<totalPages?button('Ver mais 5 produtos','product-load-more','','primary'):'')+
    (state.page>0?button('Mostrar menos','product-show-less','','small'):'')+'</div></div></section>';
}

function franchiseCatalogPage(){
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  const matches=state.items.filter(p=>p.active&&(!q||
    [p.name,p.sku,p.ean,p.apparel_size,p.apparel_color].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
  const keys=new Set(matches.map(p=>p.apparel_model_id?'m:'+p.apparel_model_id:'p:'+p.id));
  const products=state.items.filter(p=>p.active&&keys.has(p.apparel_model_id?'m:'+p.apparel_model_id:'p:'+p.id));
  const groups=groupInventory(products,state.apparelModels);
  const pages=Math.max(1,Math.ceil(groups.length/24));state.page=Math.min(state.page,pages-1);
  const cards=groups.slice(state.page*24,(state.page+1)*24).map(g=>
    '<article class="franchise-catalog-card">'+
    '<div class="franchise-catalog-photo">'+photoButton(g.main)+'</div>'+
    '<div><strong>'+h(g.title)+'</strong><small>'+g.products.length+' variação(ões)</small>'+
    '<ul>'+g.products.map(p=>'<li>'+h([p.apparel_color,p.apparel_size,p.sku].filter(Boolean).join(' · ')||p.name)+'</li>').join('')+
    '</ul></div></article>').join('');
  return tabHead('Catálogo da franquia','Consulte o catálogo e monte sua solicitação.',
    button('+ Montar pedido','store-order-new','','primary'))+
    '<section class="panel"><div class="panelbody">'+
    '<input id="product-search" class="search" type="search" placeholder="Buscar por nome, EAN ou tamanho" value="'+h(state.search)+'" aria-label="Buscar catálogo">'+
    '<p class="help">Saldos internos não são compartilhados. A central confirma o atendimento após receber o pedido.</p>'+
    '<div class="franchise-catalog-grid">'+(cards||'<p>Nenhum produto encontrado.</p>')+'</div>'+
    '<div class="actions">'+button('Anterior','product-prev',state.page===0?'disabled':'','small')+
    button('Próxima','product-next',state.page>=pages-1?'disabled':'','small')+'</div></div></section>';
}
function inventoryPage(){
 const sessions=state.inventorySessions;
 const types={central:'Central',filial:'Filial própria',temporaria:'Loja temporária'};
 const rows=sessions.map(x=>{
  const items=state.inventoryItems.filter(i=>i.session_id===x.id);
  const counted=items.filter(i=>i.counted_quantity!==null).length;
  const divergent=items.filter(i=>i.counted_quantity!==null&&i.counted_quantity!==i.expected_quantity).length;
  const local=x.location_type==='central'?'Estoque central':x.location_type==='filial'?
    state.stores.find(y=>y.id===x.location_id)?.name:state.events.find(y=>y.id===x.location_id)?.name;
  const active=x.status==='aberta'||x.status==='revisao';
  return '<article class="panel"><div class="panelbody"><strong>'+h(x.title)+'</strong><p class="muted">'+
   h(types[x.location_type]||x.location_type)+' · '+h(local||'Local')+' · '+h(x.status)+
   '</p><p>Contados: '+counted+'/'+items.length+' SKUs · Divergências: '+divergent+'</p>'+
   (active?button(x.status==='aberta'?'Continuar contagem':'Revisar divergências','inventory-open','data-id="'+h(x.id)+'"','primary')+
    (x.status==='aberta'&&counted===items.length?button('Enviar para revisão','inventory-submit','data-id="'+h(x.id)+'"','small'):'')+
    (x.status==='revisao'?button('Rejeitar sessão','inventory-reject','data-id="'+h(x.id)+'"','small'):''):'')+
   '</div></article>';
 }).join('');
 return tabHead('Inventário formal','Contagem completa por local, revisão de divergências e aprovação auditada.',
 button('+ Nova sessão','inventory-new','','primary'))+
 panel('Sessões',rows||'<p class="muted">Nenhuma sessão de inventário.</p>');
}
function inventoryStartModal(){
 const opts=[];
 if(hasPermission('stock.balance'))opts.push(['central|','Central']);
 if(hasPermission('stores.manage'))state.stores.filter(x=>x.kind==='filial'&&x.active&&assignedStore(x.id)).forEach(x=>opts.push(['filial|'+x.id,'Filial · '+x.name]));
 if(hasPermission('events.manage'))state.events.filter(x=>x.status==='ativo').forEach(x=>opts.push(['temporaria|'+x.id,'Temporária · '+x.name]));
 if(!opts.length)return toast('Sem local habilitado para inventário.',true);
 formModal('Abrir inventário','<div class="formgrid">'+selectField('Local','location',opts)+
 field('Identificação da sessão','title','text','Inventário físico','required maxlength="120"')+
 '</div><p class="help">Será registrada uma fotografia dos saldos por SKU. A aprovação só ocorrerá após todos os itens serem contados.</p>',
 'inventory-start','Abrir sessão');
}
function inventorySessionModal(id){
 const session=state.inventorySessions.find(x=>x.id===id);if(!session)return;
 const items=state.inventoryItems.filter(x=>x.session_id===id);
 const pending=items.filter(x=>x.counted_quantity===null).length;
 const divergent=items.filter(x=>x.counted_quantity!==null&&x.counted_quantity!==x.expected_quantity);
 const rows=items.map(x=>{
  const p=product(x.product_id);
  return '<div class="store-picking-line"><div><strong>'+h(p?.name||'Produto')+'</strong><small>'+h([p?.sku,p?.ean,p?.apparel_size].filter(Boolean).join(' · '))+
  '</small><small>Esperado: '+x.expected_quantity+' · Diferença: '+(x.counted_quantity===null?'não contado':x.counted_quantity-x.expected_quantity)+'</small></div>'+
  (session.status==='aberta'?'<label>Físico <input type="number" min="0" max="1000000" step="1" data-inventory-qty data-id="'+h(x.product_id)+'" value="'+(x.counted_quantity===null?'':x.counted_quantity)+'" placeholder="Contar"></label>':
  '<strong>Contado: '+x.counted_quantity+'</strong>')+'</div>';
 }).join('');
 formModal('Inventário · '+session.title,(session.status==='aberta'?'<div class="actions">'+button('📷 Ler EAN para localizar SKU','inventory-scan','','small primary')+'</div>':'')+'<p class="help">Todos os '+items.length+' SKUs precisam ser contados. Pendentes: '+pending+
 ' · Divergentes: '+divergent.length+'</p><div class="store-picking-list">'+rows+'</div>'+
 (session.status==='revisao'?textareaField('Justificativa das divergências','note'):'')+
 '<p class="help">O saldo físico será alterado apenas após aprovação. Reservas na central continuam protegidas.</p>',
 session.status==='aberta'?'inventory-save':'inventory-approve',session.status==='aberta'?'Salvar contagens':'Aprovar e aplicar');
 document.querySelector('.modal form[data-form^="inventory-"]').dataset.session=id;
}
function quickBalancePage(){
  if(!canQuickBalance())return '<div class="muteblock">Sem acesso.</div>';
  const groups=groupInventory(state.items.filter(p=>p.active),state.apparelModels);
  const query=state.search.trim().toLocaleLowerCase('pt-BR');
  const filtered=groups.filter(g=>!query||[g.title,...g.products.flatMap(p=>
    [p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira])].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  const cards=filtered.slice(0,50).map(g=>quickBalanceCard(g,{photoButton,qtyStore,qtyReserved,h})).join('');
  return tabHead('Balanço rápido','Um produto por card; conte os tamanhos sem sair da tela.',
    isAdmin()?button('Conferência formal','view','data-view="inventario"','small'):'')+
    '<section class="quick-balance-intro"><div class="quick-balance-search">'+
    '<input id="quick-search" type="search" class="search" placeholder="Produto, tamanho, SKU ou EAN…" aria-label="Buscar para contagem" value="'+h(state.search)+'">'+
    button('📷 Ler EAN','quick-scan','','primary')+'</div>'+
    '<p class="help">Digite a quantidade física apenas dos tamanhos conferidos. <strong>Zero</strong> significa estoque zerado; campo vazio não altera nada. '+
    'A contagem é do físico, inclusive unidades reservadas na central. O sistema bloqueará qualquer ajuste abaixo do reservado. Use Salvar por tamanho ou por card.</p></section>'+
    '<div class="quick-group-list">'+(cards||'<div class="panel muteblock">Nenhum produto encontrado.</div>')+
    (cards?'<div class="quick-group-empty panel muteblock" data-quick-empty hidden>Nenhum produto corresponde à busca.</div>':'')+'</div>'+
    (filtered.length>50?'<p class="muted">Exibindo 50 modelos. Refine a busca para localizar os demais.</p>':'');
}

function eventsPage(){
  const add=hasPermission('events.manage')?button('+ Nova loja temporária','event-new','','primary'):'';
  return tabHead('Lojas temporárias','Consignação: envio, venda, devolução e conciliação.',add)+
    '<div class="eventgrid">'+state.events.filter(e=>!e.deleted_at).map(e=>{
      const remaining=state.balances.filter(b=>b.event_id===e.id).reduce((s,b)=>s+b.quantity,0);
      return '<article class="panel event-card">'+eventCoverCard(e,true)+pill(e.status)+'<h3>'+h(e.name)+'</h3><p class="muted">'+niceDate(e.starts_at)+(e.ends_at?' até '+niceDate(e.ends_at):'')+'</p>'+
        '<div class="statsline"><div class="statline">Na loja temporária <b>'+remaining+'</b> un.</div></div>'+
        button('Gerenciar local','event-detail','data-id="'+h(e.id)+'"','primary')+
        (isManager()&&hasPermission('events.close')&&hasPermission('events.return')&&(isAdmin()||state.profile?.role==='gerente')?
         button('Excluir','event-delete','data-id="'+h(e.id)+'"','small danger'):'')+'</article>';
    }).join('')+'</div>'+(state.events.some(e=>!e.deleted_at)?'':'<div class="panel muteblock">Nenhum evento cadastrado.</div>');
}
function returnWorkflowPage(){
  const e=eventById(state.activeEvent);
  if(!e){state.eventWorkflow=null;state.activeEvent=null;state.view='lojas';return storesPage();}
  if(!canReturn(e.id)||e.status!=='ativo'){
    state.eventWorkflow=null;return eventDetails();
  }
  return eventReturnPage(e,state.items,state.apparelModels,state.balances,photoButton);
}
function eventDetails(){
 const e=eventById(state.activeEvent);
 if(!e||e.deleted_at){state.activeEvent=null;state.view='lojas';return storesPage();}
 const members=state.members.filter(m=>m.event_id===e.id);
 const summary=eventCompactDetail({
  event:e,members,plan:state.eventPickPlans.find(x=>x.event_id===e.id),
  planItems:state.eventPickItems,shipments:state.eventShipments,
  balances:state.balances,movements:state.movements,
  damageItems:state.damages,closure:state.consignationClosures.find(x=>x.event_id===e.id),
  products:state.items,models:state.apparelModels,groupInventory,photoButton,
  h,button,niceDate,username,
  canPlan:false,
  canClose:hasPermission('events.close')&&(hasPermission('events.manage')||memberRole(e.id)==='responsavel'),
  canManage:hasPermission('events.manage'),
  canDelete:hasPermission('events.manage')&&hasPermission('events.close')&&hasPermission('events.return')&&(isAdmin()||state.profile?.role==='gerente')
 });
 const lots=eventLotsOverview({event:e,batches:state.eventPickBatches,items:state.eventBatchItems,
  products:state.items,button,canCreate:e.status!=='encerrado'&&isManager()&&hasPermission('events.separate'),time:niceTime});
 return summary.replace('<header class="event-simple-head">',eventCoverCard(e)+'<header class="event-simple-head">')
  .replace('<div class="event-simple-actions">',lots+
    (e.status==='ativo'&&memberRole(e.id)==='responsavel'&&hasPermission('events.request')?
      '<div class="event-cover-tools">'+button('Informar devolução e diferenças','event-settle','','small')+'</div>':'')+
    (isManager()?'<div class="event-cover-tools">'+button(e.cover_path?'Trocar / excluir capa':'Adicionar capa','event-cover-edit','data-id="'+h(e.id)+'"','small')+'</div>':'')+
    '<div class="event-simple-actions">');
}
function damageStockPage(){
 if(!permittedView('avarias'))return '<div class="muteblock">Sem autorização.</div>';
 return damageListHTML(state.damages,state.items,state.events,state.damageActions,{h,button});
}
function eventBatchModal(eventId=state.activeEvent,batchId=null){
 const e=eventById(eventId),batch=batchId?state.eventPickBatches.find(x=>x.id===batchId):null;
 if(!e||!['rascunho','ativo'].includes(e.status)||!((isManager()&&hasPermission('events.separate'))||
  (!batch&&hasPermission('events.request')&&Boolean(memberRole(e.id)))))return;
 if(batch&&!['aguardando','pendente_estoque','em_separacao','separado'].includes(batch.status))
  return toast('Este lote já saiu ou foi cancelado.',true);
 const saved=batch?state.eventBatchItems.filter(x=>x.batch_id===batch.id):[];
 const groups=eventPickingRows(state.items,state.apparelModels,saved,qtyAvailable);
 formModal((batch?'Editar lote '+String(batch.sequence).padStart(2,'0'):'Novo lote')+' · '+e.name,
  eventLotForm(eventPlanForm(groups,{h}),{edit:Boolean(batch),number:batch?.sequence,note:batch?.note||''}),
  'event-batch-write',batch?'Salvar nova revisão':'Enviar à separação');
 const form=document.querySelector('.modalback form[data-form="event-batch-write"]');
 if(form){form.dataset.event=e.id;form.dataset.batch=batch?.id||'';
  refreshEventLotCounter(form);}
}
function refreshEventLotCounter(form){
 const items=[...form.querySelectorAll('[data-plan-qty]')].map(el=>({
  product_id:el.dataset.id,quantity:Math.max(0,Number(el.value)||0)
 }));
 const models=selectedEventModels(items,state.items);
 const total=items.reduce((n,x)=>n+x.quantity,0);
 const target=form.querySelector('[data-event-lot-counter]');
 if(target){
  target.textContent=models+' de 10 modelos · '+total+' unidades selecionadas';
  target.classList.toggle('is-over-limit',models>10);
 }
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.disabled=models<1||models>10;
}
function eventBatchPickModal(id){
 const o=unifiedOrderById('evento',id);
 if(!o||!['aguardando','em_separacao','separado'].includes(o.status)||
 isFranchisePortal()||!(hasPermission('orders.separate')||hasPermission('events.separate')))return;
 formModal('Separação · Lote '+String(o.sequence).padStart(2,'0')+' · '+o.target,
  pickingOrderRows(o,{h}),'event-batch-picking','Salvar progresso');
 const form=document.querySelector('.modalback form[data-form="event-batch-picking"]');
 if(form){
  form.dataset.batch=id;
  form.querySelector('.modalfooter')?.insertAdjacentHTML('beforeend',
   '<button type="button" class="button primary" data-action="event-batch-finish-pick">Concluir separação</button>');
  updateUnifiedPickingTotal(form);
 }
 hydrateImages();
}
function collectEventBatchPicking(form){
 const order=unifiedOrderById('evento',form.dataset.batch);
 if(!order)throw Error('Lote não encontrado');
 const inputs=[...form.querySelectorAll('[data-pick-qty]')];
 if(inputs.length!==order.lines.length)throw Error('Nem todos os SKUs foram conferidos');
 return inputs.map(el=>{
  const raw=el.value.trim(),quantity=raw===''?0:Number(raw);
  if(!Number.isInteger(quantity)||quantity<0||quantity>Number(el.dataset.expected))
    throw Error('Quantidade de separação inválida ou acima do solicitado');
  return {product_id:el.dataset.id,picked:quantity};
 });
}
async function saveEventBatchPicking(form,finish=false){
 if(!form||state.loading)return;
 let items;try{items=collectEventBatchPicking(form);}catch(error){return toast(error.message,true);}
 const order=unifiedOrderById('evento',form.dataset.batch);
 if(!order)return;
 const complete=items.every((x,i)=>x.picked===order.lines.find(l=>l.id===x.product_id)?.quantity);
 if(finish&&!complete)return toast('Confira todas as unidades. Se faltarem peças, peça ao gerente para revisar o lote.',true);
 return exec(async()=>{
  const status=assertOk(await db.rpc('save_event_batch_picking',{
    p_batch:form.dataset.batch,p_items:items
  }));
  return status;
 },finish?'Lote totalmente separado. Aguardando confirmação da saída.':
    'Progresso salvo. Pode continuar a separação mais tarde.');
}
function eventBatchCancelModal(id){
 if(!isManager()||!hasPermission('events.separate'))return;
 const batch=state.eventPickBatches.find(b=>b.id===id);
 if(!batch||['enviado','cancelado'].includes(batch.status))return;
 formModal('Cancelar lote '+String(batch.sequence).padStart(2,'0'),
  '<p class="help">O lote será cancelado, suas reservas liberadas e o histórico preservado.</p>'+
  '<label class="field"><span>Justificativa obrigatória</span>'+
  '<textarea name="reason" required minlength="5" maxlength="250" placeholder="Motivo do cancelamento"></textarea></label>',
  'event-batch-cancel','Cancelar lote');
 const form=document.querySelector('.modalback form[data-form="event-batch-cancel"]');
 if(form)form.dataset.batch=id;
}
function eventPlanModal(additional=false){
 const e=eventById(state.activeEvent);
 if(!e||!(additional?e.status==='ativo':e.status==='rascunho')||
    !hasPermission('events.separate')||!isManager())return;
 const planned=additional?[]:state.eventPickItems.filter(x=>x.event_id===e.id);
 const groups=eventPickingRows(state.items,state.apparelModels,planned,qtyAvailable);
 formModal((additional?'Envio adicional':'Lista de separação')+' · '+e.name,
   eventPlanForm(groups,{h,additional}),
   additional?'event-supplement-send':'event-plan-save',
   additional?'Confirmar envio adicional':'Salvar lista de separação');
 const form=document.querySelector('.modalback form');
 if(form){form.dataset.event=e.id;form.dataset.mode=additional?'additional':'initial';}
}
function collectEventPlan(form){
 const rows=[...form.querySelectorAll('[data-plan-qty]')],items=[];
 for(const input of rows){
  if(input.value.trim()==='')continue;
  const qty=Number(input.value);
  if(!Number.isInteger(qty)||qty<0||qty>1000000)throw Error('Quantidade inválida. Use números inteiros de 0 a 1.000.000.');
  if(qty>0)items.push({product_id:input.dataset.id,quantity:qty});
 }
 if(items.length>150)throw Error('O limite é 150 variações por remessa.');
 return items;
}
function eventSettlementModal(){
 const e=eventById(state.activeEvent);
 if(!e||e.status!=='ativo'||!((hasPermission('events.close')&&hasPermission('events.manage'))||
   (hasPermission('events.request')&&memberRole(e.id)==='responsavel')))return;
 const balances=state.balances.filter(b=>b.event_id===e.id&&Number(b.quantity)>0);
 if(!balances.length)return toast('Nenhuma unidade pendente. Encerre a loja diretamente.',true);
 const groups=groupInventory(state.items.filter(p=>balances.some(b=>b.product_id===p.id)),state.apparelModels);
 const draft=state.eventSettlements.find(x=>x.event_id===e.id);
 formModal('Conferir fechamento · '+e.name,
   eventSettlementForm(groups,balances,draft,{h}),
   'event-settlement-save','Salvar conferência');
 const form=document.querySelector('.modalback form[data-form="event-settlement-save"]');
 if(form){
  form.dataset.event=e.id;
  const footer=form.querySelector('.modalfooter');
  if(hasPermission('events.manage')&&hasPermission('events.close'))footer?.insertAdjacentHTML('beforeend',
   '<button class="button primary" type="button" data-action="event-settlement-save-finish">Aprovar e encerrar evento</button>');
  updateEventSettlementPreview(form);
 }
}
function collectEventSettlement(form){
 const rows=[...form.querySelectorAll('[data-settle-row]')],items=[];
 let missing=0,hasIssue=false;
 for(const row of rows){
  const expected=Number(row.dataset.expected),line={product_id:row.dataset.id,expected};
  let count=0;
  for(const key of ['good','damaged','lost']){
   const el=row.querySelector('[data-settle-field="'+key+'"]');
   const value=String(el?.value??'').trim(),quantity=Number(value);
   if(value===''||!Number.isInteger(quantity)||quantity<0||quantity>1000000)
    throw Error('Informe uma quantidade válida em todos os campos, inclusive zero.');
   line[key]=quantity;count+=quantity;
  }
  if(count>expected)throw Error('Quantidades acima das enviadas para '+(product(row.dataset.id)?.name||'o produto')+'.');
  if(count<expected)missing+=expected-count;
  if(line.damaged||line.lost)hasIssue=true;
  line.sold=0; // Compatibilidade com RPC legado; o CDSB não registra vendas.
  items.push(line);
 }
 const note=String(form.querySelector('[name="note"]')?.value||'').trim();
 if(hasIssue&&(note.length<5||note.length>250))
  throw Error('Justifique as avarias ou diferenças não devolvidas com 5 a 250 caracteres.');
 return {items,note,missing};
}
function updateEventSettlementPreview(form){
 let checked=0,expectedTotal=0,invalid=false;
 for(const row of form.querySelectorAll('[data-settle-row]')){
  const expected=Number(row.dataset.expected),qty=[...row.querySelectorAll('[data-settle-field]')]
   .map(el=>Number(el.value||0));
  expectedTotal+=expected;checked+=qty.reduce((a,b)=>a+b,0);
  const missing=expected-qty.reduce((a,b)=>a+b,0);
  invalid=invalid||missing<0||qty.some(v=>!Number.isInteger(v)||v<0);
  const target=row.querySelector('[data-settle-remaining]');
  if(target){
   target.textContent=missing<0?'Excedeu '+Math.abs(missing)+' un.':
    missing===0?'Conferido ✓':'Pendente: '+missing;
   target.classList.toggle('event-settle-error',missing<0);
  }
 }
 const summary=form.querySelector('[data-settle-summary]');
 if(summary)summary.textContent='Conferido: '+checked+' / '+expectedTotal+
   ' · '+(invalid?'Corrija quantidades excedidas.':expectedTotal-checked+' unidade(s) pendente(s).');
 const finish=form.querySelector('[data-action="event-settlement-save-finish"]');
 if(finish)finish.disabled=invalid||checked!==expectedTotal;
}
async function submitEventSettlement(form,finish=false){
 const e=eventById(form.dataset.event);
 if(!e||e.status!=='ativo'||state.loading)return;
 let payload;
 try{payload=collectEventSettlement(form);}catch(error){return toast(error.message,true);}
 if(finish&&payload.missing) return toast('Confira o destino de todas as unidades antes de concluir.',true);
 if(finish&&!window.confirm('Produtos bons voltarão ao CDSB. Avarias ficarão suspensas e quantidades não devolvidas serão registradas como diferença, sem contabilizar vendas. Confirmar?'))return;
 return exec(async()=>{
  assertOk(await db.rpc('save_event_settlement',{
   p_event:e.id,p_items:payload.items,p_note:payload.note||null
  }));
  if(finish)assertOk(await db.rpc('finalize_event_settlement',{p_event:e.id}));
 },finish?'Loja temporária encerrada com estoque conciliado.':'Conferência salva. Continue depois ou conclua a loja.');
}
async function printEventA4(id){
 const e=eventById(id);if(!e)return;
 const win=window.open('','_blank');
 if(!win)return toast('O navegador bloqueou a janela. Habilite pop-ups para imprimir.',true);
 try{
  let items=[],status='Planejado',version='';
  if(e.status==='rascunho'){
   const plan=state.eventPickPlans.find(x=>x.event_id===id);
   items=state.eventPickItems.filter(x=>x.event_id===id);
   version='Revisão '+(plan?.revision||0);
  }else{
   status='Enviado';
   const rows=assertOk(await db.from('stock_movements')
    .select('product_id,quantity').eq('event_id',id).eq('action','transferencia').limit(10000))||[];
   const map=new Map();
   for(const row of rows)map.set(row.product_id,(map.get(row.product_id)||0)+Number(row.quantity||0));
   items=[...map].map(([product_id,quantity])=>({product_id,quantity}));
   version='Separação confirmada';
  }
  if(!items.length){
   win.close();toast('Não há quantidades para imprimir.',true);return;
  }
  const responsible=state.members.filter(m=>m.event_id===id&&m.role==='responsavel')
    .map(m=>username(m.user_id)).join(', ');
  const paths=items.map(x=>{
   const p=product(x.product_id);
   return state.apparelModels.find(m=>m.id===p?.apparel_model_id)?.image_path||p?.image_path;
  });
  const photoUrls=await signedPhotoUrls(paths);
  const html=a4PickingHTML({
   event:e,items,products:state.items,models:state.apparelModels,responsible,
   version,status,photoUrls,printedAt:new Date().toLocaleString('pt-BR')
  });
  win.document.open();win.document.write(html);win.document.close();
 }catch(error){win.close();fail(error);}
}
function resolveDamageModal(id){
 if(!permittedView('avarias')||!isManager())return;
 const d=state.damages.find(x=>x.id===id);
 if(!d||d.remaining<=0)return;
 const p=product(d.product_id);
 formModal('Resolver avaria · '+(p?.name||'Produto'),
  '<p class="help">'+d.remaining+' unidade(s) fora do estoque livre. Apenas as recuperadas voltarão à central.</p>'+
  '<div class="formgrid">'+
  selectField('Decisão','resolution',[['recuperado','Recuperado · voltar ao estoque'],['descartado','Descartado · baixa definitiva']])+
  field('Quantidade','quantity','number',String(d.remaining),'required min="1" max="'+d.remaining+'" step="1"')+
  textareaField('Justificativa obrigatória','note')+'</div>',
  'damage-resolution','Confirmar decisão');
 const form=document.querySelector('.modalback form[data-form="damage-resolution"]');
 if(form){form.dataset.damage=id;form.dataset.request=crypto.randomUUID();}
}
function movementTable(rows){
  if(!rows.length)return '<div class="muteblock">Nenhuma movimentação registrada.</div>';
  return '<div class="tablewrap"><table class="table"><thead><tr><th>Data e hora</th><th>Produto</th><th>Operação</th><th>Quantidade</th><th>Responsável</th><th>Observação</th></tr></thead><tbody>'+
    rows.map(m=>'<tr><td>'+niceTime(m.created_at)+'</td><td>'+h(product(m.product_id)?.name||m.product_id.slice(0,8))+'</td>'+
    '<td>'+h(actionNames[m.action]||m.action)+(m.event_id?' <small>· '+h(eventById(m.event_id)?.name||'Evento')+'</small>':'')+'</td><td class="qty">'+m.quantity+'</td>'+
    '<td>'+h(username(m.actor_id))+'</td><td>'+h(m.note||'—')+'</td></tr>').join('')+'</tbody></table></div>';
}
function movementsPage(){
 // Histórico humano para conferência administrativa; a trilha original permanece intacta.
 const now=Date.now(),days=Number(state.movementPeriod||30);
 const within=date=>days===0||now-new Date(date).getTime()<=days*86400000;
 const labelAction={
  entrada:'Registrou entrada',venda_loja:'Registrou saída',saida_loja:'Enviou mercadoria',
  transferencia:'Enviou para evento',devolucao:'Devolveu ao estoque',
  ajuste_loja:'Ajustou estoque',baixa_evento:'Registrou baixa',
  venda_evento:'Registrou venda'
 };
 const auditLabel={
  GALLERY_UPDATED:'Alterou fotos',TEMPORARY_STORE_DELETED:'Excluiu evento',
  EVENT_BATCH_CREATED:'Criou lote de evento',EVENT_BATCH_REVISED:'Revisou lote',
  EVENT_BATCH_CANCELED:'Cancelou lote',CLOSED_RECONCILED:'Encerrou evento',
  REQUESTED:'Criou pedido',CREATED:'Cadastrou',UPDATED:'Alterou cadastro',
  DELETED:'Excluiu cadastro'
 };
 const entityNames={products:'produto',apparel_models:'modelo',categories:'categoria',
  tags:'tag',events:'evento',store_orders:'pedido',staff_profiles:'usuário',
  inventory_sessions:'inventário'};
 const entries=[
  ...state.movements.map(m=>{
   const p=product(m.product_id);
   const title=labelAction[m.action]||'Movimentou estoque';
   const detail=[p?.name||'Produto',p?.apparel_color,p?.apparel_size,
     m.event_id?eventById(m.event_id)?.name:''].filter(Boolean).join(' · ');
   const qty=m.action==='ajuste_loja'?Number(m.quantity):Number(m.quantity);
   return {time:m.created_at,user:m.actor_id,title,detail,
    note:String(m.note||'').slice(0,130),qty,action:m.action};
  }),
  ...state.audits.map(a=>({
   time:a.created_at,user:a.actor_id,
   title:auditLabel[a.action]||(a.action?.includes('DELETE')?'Excluiu registro':'Alterou '+(entityNames[a.entity]||'registro')),
   detail:entityNames[a.entity]||'Sistema',note:'',qty:null,action:'audit'
  }))
 ].filter(x=>within(x.time)&&(!state.movementUser||x.user===state.movementUser));
 const query=state.search.trim().toLocaleLowerCase('pt-BR');
 const filtered=entries.filter(x=>!query||
   [x.title,x.detail,x.note,username(x.user)].join(' ').toLocaleLowerCase('pt-BR').includes(query))
   .sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,120);
 const filterUsers=[...new Set([...state.users.map(u=>u.id),...entries.map(e=>e.user)].filter(Boolean))];
 return tabHead('Atividades','Quem fez o quê no sistema, em ordem de data.',
  button('Exportar estoque CSV','export-csv','','small'))+
  '<section class="panel activity-panel">'+
  '<div class="activity-filters">'+
   '<input class="search" id="movement-search" type="search" value="'+h(state.search)+'" placeholder="Buscar usuário, produto ou ação…">'+
   '<select id="movement-user" class="filter" aria-label="Filtrar usuário"><option value="">Todos os usuários</option>'+
    filterUsers.map(id=>'<option value="'+h(id)+'" '+(state.movementUser===id?'selected':'')+'>'+h(username(id))+'</option>').join('')+'</select>'+
   '<select id="movement-period" class="filter" aria-label="Filtrar período">'+
    [[7,'Últimos 7 dias'],[30,'Últimos 30 dias'],[90,'Últimos 90 dias'],[0,'Todo o histórico carregado']].map(([v,t])=>
     '<option value="'+v+'" '+(days===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
  '<div class="activity-list">'+(filtered.length?filtered.map(x=>
   '<article class="activity-item"><span class="activity-dot" aria-hidden="true">•</span>'+
   '<div class="activity-content"><strong>'+h(username(x.user))+'</strong>'+
    '<span>'+h(x.title)+'</span><small>'+h(x.detail)+'</small>'+
    (x.note?'<small>'+h(x.note)+'</small>':'')+'</div>'+
   (x.qty!==null?'<b class="activity-qty">'+(x.action==='entrada'?'+':'')+x.qty+' un.</b>':'')+
   '<time>'+h(niceTime(x.time))+'</time></article>').join(''):
    '<p class="muted activity-empty">Nenhuma atividade encontrada neste período.</p>')+'</div>'+
  '<div class="activity-footer">Exibindo até 120 registros recentes. O histórico original não foi alterado.</div></section>';
}
function renderCatalogTree(){
  return catalogCategoryRows({
    categories:state.categories,items:state.items,expanded:state.catalogExpanded,
    query:state.catalogSearch,h,button,categoryChain,categoryFull
  });
}
function categoriesPage(){
  const active=state.items.filter(p=>p.active).length;
  const retained=state.items.length-active;
  return tabHead('Categorias','Organize por departamentos e subcategorias; expanda apenas o ramo que deseja editar.',
    button('+ Nova categoria','category-new','','primary')+
    button('Gerenciar tags','view','data-view="tags"',''))+
    '<section class="panel catalog-panel"><div class="catalog-toolbar">'+
    '<label class="catalog-search-label"><span>Buscar categoria ou caminho</span>'+
    '<input id="catalog-category-search" type="search" class="search" placeholder="Ex.: Roupas / Camisetas" autocomplete="off" value="'+h(state.catalogSearch)+'"></label>'+
    '<div class="catalog-toolbar-actions">'+
    button('Expandir tudo','category-expand-all','','small')+
    button('Recolher tudo','category-collapse-all','','small')+'</div></div>'+
    '<div class="catalog-guidance"><strong>Produtos ativos: '+active+'</strong>'+
    (retained?' · '+retained+' registro(s) inativo(s) preservado(s) para o histórico.':'')+
    '<p>As quantidades por categoria mostram apenas produtos ativos. Abra um grupo para ver seus subníveis. Produtos inativos não entram na contagem.</p></div>'+
    '<div class="catalog-tree-list">'+renderCatalogTree()+'</div></section>';
}
function renderTagsCatalog(){
  return catalogTagCards({tags:state.tags,items:state.items,
    query:state.catalogTagsSearch,h,button});
}
function tagsPage(){
  return tabHead('Tags','Características para identificação e filtros dos produtos.',
    button('+ Nova tag','tag-new','','primary')+
    button('Gerenciar categorias','view','data-view="categorias"',''))+
    '<section class="panel catalog-panel"><div class="catalog-toolbar">'+
    '<label class="catalog-search-label"><span>Buscar tag</span>'+
    '<input id="catalog-tags-search" type="search" class="search" placeholder="Ex.: Nossa Senhora, Branco…" autocomplete="off" value="'+h(state.catalogTagsSearch)+'"></label></div>'+
    '<div class="catalog-guidance"><strong>'+state.tags.length+' tags cadastradas</strong>'+
    '<p>As mais utilizadas aparecem primeiro. A contagem considera produtos ativos e não duplica o mesmo modelo por tamanho. Excluir uma tag retira sua associação dos produtos, sem mexer no estoque.</p></div>'+
    '<div class="catalog-tags-list">'+renderTagsCatalog()+'</div></section>';
}

function unifiedOrderRecords(){
 return makeUnifiedOrders({
  avulsoOrders:state.orders,avulsoItems:state.orderItems,
  storeOrders:state.storeOrders,storeItems:state.storeOrderItems,
  eventBatches:state.eventPickBatches,eventBatchItems:state.eventBatchItems,events:state.events,models:state.apparelModels,
  reservations:state.stockReservations,stores:state.stores,
  products:state.items,adjustments:state.unifiedOrderAdjustments,
  portal:false,userId:state.user?.id
 });
}
function ordersPage(separationOnly=false){
 if(!permittedView(separationOnly?'separacao':'pedidos'))return '<div class="muteblock">Sem permissão.</div>';
 const portal=isFranchisePortal();
 const activeAccess=state.customerAccess.filter(a=>!a.revoked_at&&new Date(a.expires_at)>new Date()).length;
 const links='<div class="avulso-access-list">'+(state.customerAccess.length?
  state.customerAccess.map(access=>{
   const valid=!access.revoked_at&&new Date(access.expires_at)>new Date();
   return '<div class="avulso-access-row"><div><strong>'+h(access.label)+'</strong>'+
    '<small>Válido até '+h(niceTime(access.expires_at))+'</small></div>'+
    '<span class="pill '+(valid?'ativo':'encerrado')+'">'+(valid?'Ativo':'Encerrado')+'</span>'+
    (valid&&hasPermission('catalog.manage')?button('Revogar link','customer-link-revoke','data-id="'+h(access.id)+'"','small danger'):'')+
   '</div>';
  }).join(''):'<p class="muted">Nenhum acesso de cliente criado.</p>')+'</div>';
 const scope=state.ordersContext;
 const allRecords=unifiedOrderRecords();
 const records=scope?locationOrders(allRecords,scope,scope.mode||'all'):allRecords;
 const contextTitle=scope?.type==='central'?'Centro de Distribuição São Bento':
   scope?.type==='store'?(state.stores.find(s=>s.id===scope.id)?.name||'Loja'):
   scope?.type==='event'?(eventById(scope.id)?.name||'Loja temporária'):'';
 const contextHeader=scope?
  '<div class="sh-context"><div>'+button('← Lojas','store-hub-back','','small')+
  '<strong>'+h(contextTitle)+'</strong><span>'+(scope.mode==='pending'?'Pedidos em andamento':
    scope.mode==='history'?'Histórico de pedidos':'Todos os pedidos')+'</span></div>'+
  button('Mostrar todos os pedidos','store-hub-reset','','small')+'</div>':'';
 return contextHeader+unifiedOrdersPage(records,{
  button,time:niceTime,portal,separationOnly,linksMarkup:links,summaryLink:activeAccess+' ativo(s)',
  canProcess:o=>!portal&&(
    o.kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
    hasPermission('orders.separate')&&(o.kind==='avulso'||assignedStore(o.raw.from_store_id))),
  canDispatch:o=>o.kind==='evento'&&!portal&&isManager()&&hasPermission('orders.dispatch'),
  canCancel:o=>o.kind==='evento'?(!portal&&isManager()&&hasPermission('events.separate')):
    (portal&&o.kind==='loja'&&o.isOwner&&
     ['solicitado','pendente_estoque','aprovado'].includes(o.status))||
     (!portal&&hasPermission('orders.cancel')&&
      (o.kind==='avulso'||assignedStore(o.raw.to_store_id))),
  canReceive:o=>!portal&&o.kind==='loja'&&hasPermission('orders.receive')&&assignedStore(o.raw.to_store_id),
  canAvulso:!portal&&hasPermission('orders.internal'),
  canStore:hasPermission('orders.central')||hasPermission('orders.franchise'),
  canLink:!portal&&hasPermission('catalog.manage')
 });
}
function customerAccessLinkModal(label,url){
  document.querySelector('.share-product-modal')?.remove();
  const layer=document.createElement('div');layer.className='share-product-modal';
  layer.dataset.link=url;layer.dataset.title=label;
  layer.innerHTML='<section class="share-product-sheet" role="dialog" aria-modal="true" aria-label="Acesso de cliente">'+
   '<header><h2>Acesso de cliente criado</h2><button type="button" data-action="customer-link-close" aria-label="Fechar">✕</button></header>'+
   '<p><strong>'+h(label)+'</strong></p>'+
   '<p>Este link permite montar pedidos sem visualizar nenhum estoque real. Válido por 30 dias. Guarde o link agora: por segurança, ele não pode ser recuperado depois.</p>'+
   '<div class="share-link" id="customer-link-preview"></div>'+
   '<div class="share-actions">'+
    '<button type="button" class="share-whatsapp-send" data-action="customer-link-whatsapp">Enviar acesso pelo WhatsApp</button>'+
    '<button type="button" class="share-copy" data-action="customer-link-copy">Copiar link</button>'+
   '</div></section>';
  layer.querySelector('#customer-link-preview').textContent=url;
  layer.addEventListener('click',event=>{if(event.target===layer)layer.remove();});
  document.body.append(layer);
}
function orderEventModal(orderId){
  const order=state.orders.find(o=>o.id===orderId);if(!order)return;
  formModal('Vincular pedido a evento','<p class="help">Vincular o pedido organiza a consulta por evento. Não transfere nem baixa mercadorias.</p>'+
    '<div class="formgrid">'+selectField('Evento','event_id',[['','Sem evento'],...state.events.map(e=>[e.id,e.name+' · '+e.status])],order.event_id||'')+'</div>',
    'order-associate','Salvar vínculo');
  document.querySelector('form[data-form="order-associate"]').dataset.id=orderId;
}
function usersPage(){
  return tabHead('Usuários','Cada pessoa utiliza sua própria senha e permissões.',button('+ Novo usuário','user-new','','primary'))+
    panel('Equipe','<div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th>Status</th><th></th></tr></thead><tbody>'+
    state.users.map(u=>'<tr><td><strong>'+h(u.full_name)+'</strong></td><td>'+h(u.username)+'</td><td>'+h(profileLabel(u))+'</td><td><span class="pill '+(u.active?'ativo':'encerrado')+'">'+(u.active?'Ativo':'Bloqueado')+'</span></td><td>'+
      (u.id!==state.user.id?'<div class="inline">'+button('Funções e lojas','user-role','data-id="'+h(u.id)+'"','small')+
      button('Definir senha','set-user-password','data-id="'+h(u.id)+'"','small')+
      button(u.active?'Bloquear':'Reativar','user-toggle','data-id="'+h(u.id)+'"','small')+'</div>':
      button('Minha senha','my-password','','small'))+'</td></tr>').join('')+'</tbody></table></div>')+
    '<div class="note">Os acessos são individuais. Bloquear um usuário não apaga seu histórico de operações. Senhas não são armazenadas pela aplicação.</div>';
}

function closeTopModal(){
  const backdrops=[...document.querySelectorAll('.modalback')];
  const current=backdrops[backdrops.length-1];if(!current)return;
  const form=current.querySelector('form');
  if(form?.__previewUrl)URL.revokeObjectURL(form.__previewUrl);
  current.remove();
  const previous=backdrops[backdrops.length-2];if(previous)previous.inert=false;
  const focus=current.__returnFocus;
  if(focus?.isConnected)focus.focus({preventScroll:true});
}
function formModal(title,contents,formName,submitLabel='Salvar',stack=false){
  if(!stack){
    while(document.querySelector('.modalback'))closeTopModal();
  }else{
    const previous=[...document.querySelectorAll('.modalback')].at(-1);
    if(previous)previous.inert=true;
  }
  const backdrop=document.createElement('div');
  backdrop.__returnFocus=document.activeElement;
  backdrop.className='modalback';backdrop.style.zIndex=String(50+document.querySelectorAll('.modalback').length*5);
  backdrop.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="'+h(title)+'">'+
    '<div class="modalhead"><h2>'+h(title)+'</h2><button class="plain" type="button" data-action="modal-close" aria-label="Fechar">✕</button></div>'+
    '<form data-form="'+h(formName)+'">'+contents+'<div class="modalfooter"><button class="button" type="button" data-action="modal-close">Cancelar</button>'+
    '<button class="button primary" type="submit">'+h(submitLabel)+'</button></div></form></section>';
  document.body.append(backdrop);
  if(formName==='sku-manage')backdrop.querySelector('.modalhead [data-action="modal-close"]')?.focus({preventScroll:true});
  else backdrop.querySelector('[name]:not([type="file"])')?.focus();
}
function photoLightbox(url,caption){
  document.querySelector('.photo-lightbox')?.remove();
  const layer=document.createElement('div');layer.className='photo-lightbox';
  layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');
  const btn=document.createElement('button');btn.className='lightbox-close';btn.type='button';
  btn.textContent='Fechar ✕';btn.setAttribute('data-action','photo-close');
  const img=document.createElement('img');img.src=url;img.alt=caption;
  const title=document.createElement('div');title.className='lightbox-title';title.textContent=caption;
  layer.append(btn,img,title);document.body.append(layer);btn.focus();
}
function bindPhotoPreview(form,photoBlob){
  const previous=form.__previewUrl;
  if(previous)URL.revokeObjectURL(previous);
  form.__photoBlob=photoBlob;
  const url=URL.createObjectURL(photoBlob);form.__previewUrl=url;
  const target=form.querySelector('.photo-preview');
  target.replaceChildren();
  const img=document.createElement('img');img.alt='Prévia da nova foto';img.src=url;
  target.append(img);
  form.querySelector('[data-photo-status]').textContent='Pronta para salvar · '+Math.ceil(photoBlob.size/1024)+' KB';
}
async function handlePhotoInput(input){
 const form=input.closest('form'),files=input.files;
 if(!form||!files?.length)return;
 try{await galleryAddFiles(form,files,compressPhoto);hydrateImages();}
 catch(error){fail(error);}
 finally{input.value='';}
}
function photoChooser(item){return galleryMarkup(item);}

function productModal(item=null){
  if(!canRegisterProducts())return;
  const single='<div data-single-fields class="single-fields wide">'+
    field('Código interno (SKU)','sku','text',item?.sku||'','maxlength="80" autocomplete="off"')+
    '<div class="field"><span>EAN / código de barras</span><div class="inline">'+
    '<input style="flex:1;min-width:145px" name="ean" type="text" inputmode="numeric" placeholder="8 a 14 dígitos" value="'+h(item?.ean||'')+'">'+
    button('📷 Ler','form-scan','data-target="ean"','small')+'</div></div></div>';
  const locations='<section class="form-section wide location-section">'+
    '<div class="section-head"><strong>Localização na loja</strong><small>Opcional</small></div>'+
    '<div class="location-fields">'+
    field('Gôndola','gondola','text',item?.gondola||'','maxlength="40" placeholder="Ex.: Gôndola 02"')+
    field('Prateleira','prateleira','text',item?.prateleira||'','maxlength="40" placeholder="Ex.: Prateleira B"')+
    '</div></section>';
  const markup='<div class="formgrid">'+
    '<div class="wide">'+field('Nome do produto *','name','text',item?.name||'','required maxlength="180"')+'</div>'+
    (!item?'<p class="help wide">SKU e EAN de produtos excluídos podem ser reutilizados. O sistema impede duplicações somente com produtos ativos.</p>':'')+
    (!item?sizesSection():'')+
    single+photoChooser(item)+categorySelector(item)+productTagChooser(item)+locations+
    (!item?'<div class="wide" data-single-stock>'+
      (state.view==='entrada'?'<p class="help">Ao cadastrar um produto para esta remessa, deixe o estoque inicial em zero e adicione-o à lista abaixo para não contabilizar duas vezes.</p>':'')+
      field('Quantidade inicial na loja','initial_quantity','number','0','min="0" max="1000000" step="1"','Entrada registrada no histórico.')+'</div>':'')+
    (item?selectField('Situação','active',[['true','Ativo'],['false','Inativo']],String(item.active)):'')+'</div>';
  formModal(item?'Editar produto':'Novo produto',markup,item?'product-edit':'product-new',
    item?'Salvar alterações':'Cadastrar produto');
  const form=document.querySelector('.modalback form');
  if(item)form.dataset.id=item.id;
  else refreshCategorySizeOptions(form,state.categories);
  if(item?.image_path||item?.image_paths?.length)hydrateImages();
}

function shareProductModal(title,shareUrl){
  document.querySelector('.share-product-modal')?.remove();
  const layer=document.createElement('div');
  layer.className='share-product-modal';
  layer.setAttribute('role','presentation');
  layer.innerHTML='<section class="share-product-sheet" role="dialog" aria-modal="true" aria-label="Compartilhar produto">'+
    '<header><h2>Compartilhar pelo WhatsApp</h2><button type="button" data-action="share-close" aria-label="Fechar">✕</button></header>'+
    '<p><strong>'+h(title)+'</strong></p>'+
    '<p>O link mostra a foto, o estoque da loja por tamanho, o EAN e o código interno. '+
    'As quantidades são atualizadas quando a pessoa abre o visualizador.</p>'+
    '<p class="share-expiry">O link vale por 7 dias. Qualquer pessoa que tiver o link poderá consultar este produto enquanto ele estiver ativo.</p>'+
    '<div class="share-link" id="share-url-preview"></div>'+
    '<div class="share-actions">'+
      '<button type="button" class="share-whatsapp-send" data-action="share-send-whatsapp">Enviar pelo WhatsApp</button>'+
      '<button type="button" class="share-copy" data-action="share-copy-link">Copiar link</button>'+
    '</div></section>';
  layer.dataset.shareUrl=shareUrl;
  layer.dataset.shareTitle=title;
  layer.querySelector('#share-url-preview').textContent=shareUrl;
  layer.addEventListener('click',e=>{if(e.target===layer)layer.remove();});
  document.body.append(layer);
  layer.querySelector('[data-action="share-send-whatsapp"]')?.focus({preventScroll:true});
}

function renderStockOperationPage(){
  if(!hasPermission(state.view==='entrada'?'stock.entry':'stock.exit'))return '<div class="muteblock">Sem permissão.</div>';
  const kind=state.view;
  return stockOperationPage({
    kind,query:state.stockQuery[kind],cart:state.stockCarts[kind],
    items:state.items,models:state.apparelModels,destinations:state.stockDestinations,
    batches:state.stockBatches.filter(b=>b.operation===kind),
    batchLines:state.stockBatchLines,
    selectedDestination:state.stockSelectedDestination,
    qtyStore,qtyAvailable,groupInventory,photoButton,h,button,embeddedReceipt:kind==='entrada'
  });
}
function stockOperationDOM(){return document.querySelector('.stock-operation-layout');}
function refreshStockOperationSearch(){
  const kind=state.view;
  if(!['entrada','saida'].includes(kind))return;
  const target=document.querySelector('[data-stock-search-results]');
  if(!target)return;
  const q=state.stockQuery[kind];
  target.innerHTML=q.trim()?stockOperationSearchHTML({
    groups:stockOperationResults(state.items,state.apparelModels,q,groupInventory),
    h,qtyStore,qtyAvailable,kind
  }):'<p class="stock-search-welcome">Digite o nome, SKU ou EAN de um produto.</p>';
}
function updateStockOperationBasket(redraw=true,clearError=true){
  if(!['entrada','saida'].includes(state.view))return;
  const kind=state.view,cart=state.stockCarts[kind];
  if(redraw){
    const list=document.querySelector('[data-stock-cart]');
    if(list){list.innerHTML=stockCartHTML({
      cart,items:state.items,models:state.apparelModels,qtyStore,qtyAvailable,groupInventory,
      kind,photoButton,h
    });hydrateImages();}
  }
  const total=[...cart.values()].reduce((sum,line)=>sum+(Number(line.quantity)||0),0);
  const counter=document.querySelector('[data-stock-basket-count]');
  if(counter)counter.textContent=cart.size+' tipo(s) · '+total+' un.';
  const summary=document.querySelector('[data-stock-summary]');
  if(summary)summary.textContent=cart.size+' tipo(s) de produto · '+total+' unidade(s)';
  const submit=document.querySelector('.stock-confirm-dock button[type="submit"]');
  const dest=state.stockSelectedDestination;
  const allowed=kind==='entrada'||state.stockDestinations.some(d=>d.active&&d.id===dest);
  if(submit)submit.disabled=!cart.size||state.loading||!allowed;
  const preview=document.querySelector('[data-stock-destination-preview]');
  if(preview)preview.textContent=state.stockDestinations.find(d=>d.id===dest)?.name||'Escolha um destino';
  const error=document.querySelector('[data-stock-error]');
  if(error&&clearError)error.hidden=true;
}
function addStockOperationItem(id){
  if(!hasPermission(state.view==='entrada'?'stock.entry':'stock.exit')||!['entrada','saida'].includes(state.view))return;
  const p=product(id);if(!p?.active)return toast('Produto não encontrado ou inativo.',true);
  const cart=state.stockCarts[state.view],previous=cart.get(id);
  if(previous){
    if(previous.quantity>=1000000)return toast('Quantidade máxima por variação: 1.000.000.',true);
    previous.quantity++;
  }else{
    if(cart.size>=100)return toast('Máximo de 100 variações por operação.',true);
    cart.set(id,{quantity:1,expected:qtyStore(id)});
  }
  updateStockOperationBasket();
  toast('Incluído: '+p.name);
}
function handleOperationScanCode(code){
  const kind=state.view;
  if(!['entrada','saida'].includes(kind))return;
  const match=state.items.filter(p=>p.active&&(p.ean===code||p.sku===code));
  const input=document.getElementById('stock-op-search');
  if(match.length===1){
    addStockOperationItem(match[0].id);
    state.stockQuery[kind]=code;
    if(input)input.value=code;
    refreshStockOperationSearch();
    input?.focus({preventScroll:true});
  }else{
    state.stockQuery[kind]=code;
    if(input){input.value=code;input.focus({preventScroll:true});}
    refreshStockOperationSearch();
    toast(match.length?'Selecione a variação correta na lista.':
      (kind==='entrada'?'EAN não cadastrado. Use + Cadastrar produto.':'EAN não encontrado nos produtos ativos.'),true);
  }
}
async function saveStockOperation(form){
  if(!hasPermission(state.view==='entrada'?'stock.entry':'stock.exit')||state.loading)return;
  const kind=state.view,cart=state.stockCarts[kind],data=new FormData(form);
  const dest=String(data.get('destination_id')||'').trim();
  if(kind==='saida'&&!state.stockDestinations.some(d=>d.active&&d.id===dest))
    return toast('Selecione um destino válido para esta saída.',true);
  let lines;
  try{lines=operationCartLines(cart,state.items,qtyStore,kind,qtyAvailable);}
  catch(error){toast(error.message,true);return;}
  const requestId=state.stockRequestIds[kind]||crypto.randomUUID();
  state.stockRequestIds[kind]=requestId;
  state.loading=true;
  const submit=document.querySelector('.stock-confirm-dock button[type="submit"]');
  if(submit){submit.disabled=true;submit.textContent='Registrando operação…';}
  try{
    const response=assertOk(await db.rpc('stock_operation_batch',{
      p_operation:kind,p_items:lines,p_destination_id:kind==='saida'?dest:null,
      p_note:String(data.get('note')||'').trim()||null,p_request_id:requestId
    }));
    for(const row of response.items||[]){
      const balance=state.balances.find(b=>b.product_id===row.product_id&&!b.event_id);
      if(balance)balance.quantity=Number(row.new_stock);
      else state.balances.push({product_id:row.product_id,event_id:null,quantity:Number(row.new_stock)});
    }
    cart.clear();state.stockRequestIds[kind]=null;
    const note=form.querySelector('[name="note"]');
    if(note)note.value='';
    try{
      state.stockBatches=assertOk(await db.from('stock_operation_batches')
        .select('id,operation,destination_id,note,created_at')
        .order('created_at',{ascending:false}).limit(100))||state.stockBatches;
      state.stockBatchLines=assertOk(await db.from('stock_movements')
        .select('product_id,operation_batch_id,quantity')
        .not('operation_batch_id','is',null)
        .order('created_at',{ascending:false}).limit(2500))||state.stockBatchLines;
    }catch(historyError){console.warn('Operação salva; histórico disponível depois',historyError);}
    const recent=document.querySelector('[data-stock-operation-history]');
    if(recent)recent.innerHTML=stockOperationHistoryHTML({
      batches:state.stockBatches.filter(b=>b.operation===kind),
      destinations:state.stockDestinations,lines:state.stockBatchLines,items:state.items
    });
    refreshStockOperationSearch();
    updateStockOperationBasket();
    toast((kind==='entrada'?'Entrada':'Saída')+' registrada: '+lines.length+
      ' tipo(s) e '+lines.reduce((sum,line)=>sum+line.quantity,0)+' unidade(s).');
  }catch(error){
    const message=error?.message||'Falha ao registrar a operação. Não tente cadastrar os produtos de novo.';
    const banner=document.querySelector('[data-stock-error]');
    if(banner){banner.textContent=message;banner.hidden=false;}
    fail(error);
    // Recarregar apenas os saldos, mantendo todas as quantidades digitadas.
    try{
      const ids=lines.map(l=>l.product_id);
      const balances=assertOk(await db.from('stock_balances')
        .select('product_id,quantity').in('product_id',ids).is('event_id',null))||[];
      for(const b of balances){
        const cached=state.balances.find(x=>x.product_id===b.product_id&&!x.event_id);
        if(cached)cached.quantity=b.quantity;
        if(/Saldo atualizado por outro operador|Estoque insuficiente|quantidade inválida/i.test(message)){
          const row=cart.get(b.product_id);if(row)row.expected=b.quantity;
          state.stockRequestIds[kind]=null;
        }
      }
    }catch(refreshError){console.warn('Não foi possível sincronizar saldos',refreshError);}
  }finally{
    state.loading=false;
    if(submit){submit.textContent=kind==='entrada'?'Confirmar entrada':'Confirmar saída';}
    updateStockOperationBasket(false,false);
  }
}

function stockOverviewModal(id){
 if(isFranchisePortal()||!hasPermission('products.read'))return;
 const p=product(id);if(!p)return;
 const physical=qtyStore(id),reserved=qtyReserved(id),available=qtyAvailable(id);
 const linked=state.stockReservations.filter(r=>r.product_id===id&&r.status==='ativa');
 const central=state.stores.find(s=>s.is_primary);
 const others=state.stores.filter(s=>s.active&&!s.is_primary&&s.kind!=='franquia')
   .map(x=>({label:x.name,qty:state.storeBalances.find(b=>b.store_id===x.id&&b.product_id===id)?.quantity||0}));
 const events=state.events.filter(e=>e.status!=='encerrado').map(e=>({
   label:'Temporária · '+e.name,qty:qtyEvent(id,e.id)
 })).filter(x=>x.qty>0);
 const overlay=document.createElement('div');
 overlay.className='modalback stock-overview-overlay';
 overlay.innerHTML='<section class="modal stock-overview-modal" role="dialog" aria-modal="true" aria-label="Estoque de '+h(p.name)+'">'+
   '<div class="modalhead"><h2>'+h(p.name)+'</h2>'+
   '<button type="button" class="plain" data-action="stock-overview-close" aria-label="Fechar">✕</button></div>'+
   '<div class="stock-overview-body"><p class="muted">SKU '+h(p.sku||'—')+' · EAN '+h(p.ean||'—')+'</p>'+
   '<div class="stock-overview-metrics">'+
    '<div><small>Físico central</small><strong>'+physical+'</strong></div>'+
    '<div><small>Reservado / separado</small><strong>'+reserved+'</strong></div>'+
    '<div><small>Disponível central</small><strong>'+available+'</strong></div></div>'+
   '<h3>Compromissos da central</h3>'+
   (linked.length?'<ul>'+linked.map(r=>'<li>Pedido #'+h(r.order_id.slice(0,8).toUpperCase())+' · '+r.quantity+' un.</li>').join('')+'</ul>':'<p class="muted">Nenhum pedido reservado.</p>')+
   '<h3>Locais controlados</h3><table class="table"><tbody>'+
   '<tr><td>'+h(central?.name||'Estoque central')+'</td><td>'+physical+' físico</td></tr>'+
   [...others,...events].map(x=>'<tr><td>'+h(x.label)+'</td><td>'+x.qty+' físico</td></tr>').join('')+
   '</tbody></table><p class="help">Franquias não possuem saldo controlado pela AME MAIS. Separar não altera o físico; somente a saída confirmada o reduz.</p>'+
   '</div></section>';
 document.body.append(overlay);
 overlay.querySelector('[data-action="stock-overview-close"]')?.focus({preventScroll:true});
}
// Ações de uma variação no painel inferior (celular) ou lateral (desktop).
function canOpenSkuManager(){
 return !isFranchisePortal()&&['stock.entry','stock.exit','stock.balance','products.edit'].some(hasPermission);
}
function manageSku(id,requestedMode=''){
 const p=product(id);
 if(!p||!canOpenSkuManager())return;
 const model=state.apparelModels.find(m=>m.id===p.apparel_model_id);
 const availableModes=skuPanelModes.filter(m=>hasPermission(m.permission));
 if(!availableModes.length)return;
 const mode=availableModes.some(m=>m.key===requestedMode)?requestedMode:availableModes[0].key;
 const physical=qtyStore(id),reserved=qtyReserved(id);
 const history=state.movements.filter(m=>m.product_id===id&&!m.event_id)
  .slice(0,15);
 const reservations=state.stockReservations.filter(r=>r.product_id===id&&r.status==='ativa');
 formModal('Gerenciar SKU · '+(p.apparel_size||'Único'),
   renderSkuPanel({item:p,model,physical,reserved,can:hasPermission,history,reservations}),
   'sku-manage','Confirmar operação');
 const form=document.querySelector('.modalback form[data-form="sku-manage"]');
 if(!form)return;
 form.dataset.id=id;
 form.dataset.expected=String(physical);
 form.dataset.reserved=String(reserved);
 form.dataset.request=crypto.randomUUID();
 form.closest('.modalback').classList.add('sku-panel-backdrop');
 setSkuMode(form,mode);
 // A lista global contém até 1000 movimentos; esta consulta traz os últimos
 // movimentos do SKU mesmo que estejam fora dos carregados na página.
 if(hasPermission('movements.read')){
   db.from('stock_movements').select('action,quantity,note,created_at')
    .eq('product_id',id).is('event_id',null)
    .order('created_at',{ascending:false}).limit(20).then(({data,error})=>{
      if(error||!Array.isArray(data)||!form.isConnected)return;
      const details=form.querySelector('[data-sku-history]');
      const list=details?.querySelector('.sku-history-list');
      if(!list)return;
      if(data.length)details.querySelector('[data-sku-history-empty]')?.remove();
      list.innerHTML=data.map(m=>'<li><span>'+h(m.action||'Movimento')+
        '<small>'+h(m.note||'Sem observação')+'</small></span><span><b>'+
        Number(m.quantity||0).toLocaleString('pt-BR')+' un.</b><small>'+
        (m.created_at?new Date(m.created_at).toLocaleDateString('pt-BR'):'')+
        '</small></span></li>').join('');
    }).catch(()=>{});
 }
}
function setSkuMode(form,mode){
 const p=product(form.dataset.id);
 if(!p||!skuPanelModes.some(m=>m.key===mode&&hasPermission(m.permission)))return;
 form.dataset.mode=mode;
 form.dataset.request=crypto.randomUUID();
 for(const tab of form.querySelectorAll('[data-action="sku-mode"]')){
   const selected=tab.dataset.mode===mode;
   tab.setAttribute('aria-selected',String(selected));
   tab.classList.toggle('is-active',selected);
 }
 for(const section of form.querySelectorAll('[data-sku-section]'))
  section.hidden=section.dataset.skuSection!==mode;
 const label={entrada:'Confirmar entrada',saida:'Confirmar saída',
  contagem:'Salvar conferência',edicao:'Salvar cadastro'}[mode];
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.textContent=label||'Salvar';
 syncSkuManagerPreview(form);
}
function syncSkuManagerPreview(form){
 const id=form?.dataset.id,p=product(id);
 if(!p)return;
 const physical=Number(form.dataset.expected),reserved=Number(form.dataset.reserved),
  mode=form.dataset.mode,values=Object.fromEntries(new FormData(form).entries());
 const recipient=form.querySelector('[data-sku-recipient]');
 if(recipient)recipient.hidden=!['diretoria','doacao'].includes(values.exit_reason);
 const box=form.querySelector('[data-sku-preview]');
 const submit=form.querySelector('button[type="submit"]');
 if(!box)return;
 if(!p.active){box.textContent='SKU inativo: nenhuma operação permitida.';box.dataset.valid='false';if(submit)submit.disabled=true;return;}
 try{
  const result=validateSkuAction({mode,values,physical,reserved});
  if(mode==='edicao')box.textContent='Os dados de cadastro serão atualizados. O saldo não será alterado.';
  else{
   const future=mode==='entrada'?physical+result.quantity:
    mode==='saida'?physical-result.quantity:result.quantity;
   const delta=future-physical;
   box.textContent='Físico: '+physical+' → '+future+' un. · Reservado: '+reserved+
     ' · Livre após: '+(future-reserved)+' un.'+
     (mode==='contagem'?' · Ajuste: '+(delta>0?'+':'')+delta:'');
  }
  box.dataset.valid='true';
  if(submit)submit.disabled=false;
 }catch(error){
  box.textContent=error.message;box.dataset.valid='false';
  if(submit)submit.disabled=true;
 }
}
async function saveSkuManager(form){
 const p=product(form.dataset.id);if(!p||!p.active||isFranchisePortal())return;
 const mode=form.dataset.mode;
 const permission={entrada:'stock.entry',saida:'stock.exit',contagem:'stock.balance',
  edicao:'products.edit'}[mode];
 if(!permission||!hasPermission(permission))return;
 const physical=Number(form.dataset.expected),reserved=Number(form.dataset.reserved),
  values=Object.fromEntries(new FormData(form).entries());
 let op;
 try{op=validateSkuAction({mode,values,physical,reserved});}
 catch(error){toast(error.message,true);return;}
 const confirmation=mode==='edicao'?'Confirmar a atualização do cadastro deste SKU?':
   mode==='contagem'?'Confirmar contagem de '+op.quantity+' unidade(s) de '+p.name+
    '? A diferença será registrada no histórico.':
   'Confirmar '+(mode==='entrada'?'entrada':'saída')+' de '+op.quantity+' unidade(s) de '+p.name+'?';
 if(!window.confirm(confirmation))return;
 return exec(async()=>{
   if(mode==='edicao'){
     const changed=assertOk(await db.from('products').update(op).eq('id',p.id).select('id').maybeSingle());
     if(!changed)throw new Error('Cadastro não atualizado. Verifique sua permissão.');
   }else if(mode==='contagem'){
     assertOk(await db.rpc('quick_stock_count',{
       p_product_id:p.id,p_expected:physical,p_counted:op.quantity,
       p_note:op.note||null
     }));
   }else if(mode==='entrada'){
     assertOk(await db.rpc('stock_operation_batch',{
       p_operation:'entrada',p_items:[{product_id:p.id,quantity:op.quantity,expected:physical}],
       p_destination_id:null,p_note:op.note||null,p_request_id:form.dataset.request
     }));
   }else if(op.reason==='avaria'){
     assertOk(await db.rpc('quarantine_central_stock',{
       p_product:p.id,p_quantity:op.quantity,p_expected:physical,
       p_note:op.note,p_request:form.dataset.request
     }));
   }else{
     assertOk(await db.rpc('record_stock_exception',{
       p_product_id:p.id,p_quantity:op.quantity,p_expected:physical,
       p_reason:op.reason,p_details:op.note,p_recipient:op.recipient,
       p_request_id:form.dataset.request
     }));
   }
 },mode==='edicao'?'Cadastro do SKU atualizado.':
   mode==='contagem'?'Contagem registrada com histórico e reservas protegidas.':
   mode==='entrada'?'Entrada de fornecedor registrada.':
   op.reason==='avaria'?'Avaria suspensa do estoque disponível.':'Saída excepcional registrada.');
}
// Operação pontual diretamente no card, sempre em SKU real e sem simular pedidos.
function stockModal(id=null,groupKey=null){
  if(isFranchisePortal()||!(hasPermission('stock.entry')||hasPermission('stock.exit')))return;
  const selected=id?product(id):null;
  const key=groupKey||(selected?.apparel_model_id?'model:'+selected.apparel_model_id:
    selected?'product:'+selected.id:null);
  if(!key)return;
  const members=state.items.filter(p=>p.active&&
    (p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id)===key);
  if(!members.length)return toast('Produto não encontrado ou inativo.',true);
  const group=groupInventory(members,state.apparelModels)[0];
  const initial=id&&members.some(p=>p.id===id)?id:members.length===1?members[0].id:'';
  const variants=members.length>1?[['','Escolha a variação / tamanho'],...group.products.map(p=>
    [p.id,[p.apparel_color,p.apparel_size,p.sku].filter(Boolean).join(' · ')||p.name])]:
    [[members[0].id,members[0].name]];
  const types=[
    ...(hasPermission('stock.entry')?[['entrada','Entrada · chegou do fornecedor']]:[]),
    ...(hasPermission('stock.exit')?[['saida','Saída · baixa excepcional']]:[])
  ];
  formModal('Movimentar · '+group.title,
    '<div class="stock-single-form">'+
      '<p class="help">Escolha o tamanho correto e registre a quantidade física. O histórico guarda operador, data e justificativa.</p>'+
      selectField('Produto / variação','product_id',variants,initial,'required')+
      '<div class="stock-single-balance" data-single-stock aria-live="polite">Selecione a variação para ver o saldo.</div>'+
      selectField('Operação','operation_kind',types,types[0][0],'required')+
      field('Quantidade de unidades','quantity','number','1','required min="1" max="1000000" step="1" inputmode="numeric"')+
      '<div data-single-entry>'+textareaField('Fornecedor / número da remessa (opcional)','note')+'</div>'+
      '<div data-single-exit hidden>'+
        selectField('Motivo da saída','reason',[
          ['avaria','Produto avariado / inutilizado'],['extravio','Perda / extravio'],
          ['diretoria','Uso da diretoria'],['doacao','Doação'],['outro','Outro motivo']
        ])+
        '<div data-single-recipient hidden>'+field('Quem recebeu?','recipient','text','','maxlength="120" placeholder="Nome ou identificação"')+'</div>'+
        textareaField('Justificativa obrigatória','details')+
        '<p class="help">Avarias ficam em análise, fora do estoque disponível; podem ser recuperadas ou descartadas. Demais motivos geram baixa definitiva. Unidades reservadas não podem sair.</p>'+
      '</div>'+
    '</div>','stock-single-movement','Confirmar movimentação');
  const form=document.querySelector('.modalback form[data-form="stock-single-movement"]');
  if(!form)return;
  form.dataset.requestId=crypto.randomUUID();
  const sync=()=>{
    const pid=form.querySelector('[name="product_id"]')?.value;
    const op=form.querySelector('[name="operation_kind"]')?.value;
    const reason=form.querySelector('[name="reason"]')?.value;
    const current=pid?qtyStore(pid):null,reserved=pid?qtyReserved(pid):0,free=pid?qtyAvailable(pid):0;
    form.dataset.expected=pid?String(current):'';
    form.querySelector('[data-single-stock]').textContent=pid?
      'Físico: '+current+' un.  ·  Reservado: '+reserved+' un.  ·  Livre: '+free+' un.':
      'Selecione a variação antes de informar a quantidade.';
    const exiting=op==='saida';
    form.querySelector('[data-single-entry]').hidden=exiting;
    form.querySelector('[data-single-exit]').hidden=!exiting;
    form.querySelector('[data-single-recipient]').hidden=!exiting||!['diretoria','doacao'].includes(reason);
    form.querySelector('[name="recipient"]').required=exiting&&['diretoria','doacao'].includes(reason);
    form.querySelector('[name="details"]').required=exiting;
    const qty=form.querySelector('[name="quantity"]');
    qty.max=String(exiting?free:1000000);
    form.querySelector('button[type="submit"]').textContent=exiting?'Confirmar baixa':'Confirmar entrada';
  };
  ['product_id','operation_kind','reason'].forEach(name=>
    form.querySelector('[name="'+name+'"]')?.addEventListener('change',sync));
  sync();
}
function eventCoverCard(e,compact=false){
 if(!e?.cover_path)return compact?'':'<div class="event-cover-placeholder">▧ <span>Sem capa</span></div>';
 return '<div class="event-cover'+(compact?' compact':'')+'"><img data-event-cover="'+h(e.cover_path)+'" alt="Capa do evento '+h(e.name)+'" loading="lazy"></div>';
}
function syncCoverFileField(form){
 const label=form?.querySelector('[data-cover-file]');
 if(label)label.hidden=form.elements.namedItem('cover_mode')?.value!=='upload';
}
function eventCoverModal(id){
 if(!hasPermission('events.manage'))return;
 const e=eventById(id);if(!e||e.deleted_at)return;
 formModal('Capa · '+e.name,
  eventCoverCard(e)+'<p class="help">Capa horizontal de 1600 × 900 pixels. Envie uma foto, gere com IA ou remova a atual.</p>'+
  selectField('O que deseja fazer','cover_mode',[['upload','Enviar nova imagem'],['generate','Gerar com OpenAI (econômico)'],['remove','Remover capa']])+
  '<label class="field" data-cover-file><span>Selecionar imagem (caso escolha envio)</span><input type="file" name="event_cover_file" accept="image/*"></label>',
  'event-cover-update','Aplicar');
 const f=document.querySelector('.modalback form[data-form="event-cover-update"]');if(f){f.dataset.eventId=id;syncCoverFileField(f);}
 hydrateImages();
}
function eventModal(){
 if(!hasPermission('events.manage'))return;
 const people=state.users.filter(u=>u.active&&u.role!=='franquia');
 if(!people.length)return toast('Cadastre um responsável ativo antes de criar a loja.',true);
 formModal('Criar loja temporária',
  '<div class="formgrid">'+
  field('Nome da loja / evento','name','text','','required maxlength="150"')+
  field('Data de início','starts_at','date',dateToday(),'required')+
  field('Data de término (opcional)','ends_at','date')+
  selectField('Responsável','responsible_id',people.map(u=>[u.id,u.full_name]),state.user.id,'required')+
  textareaField('Local, observações e informações básicas','notes')+
  selectField('Imagem de capa','cover_mode',[['none','Criar sem capa'],['upload','Enviar imagem'],['generate','Gerar imagem com OpenAI (low)']])+
  '<label class="field" data-cover-file><span>Arquivo de imagem (caso escolha Enviar)</span><input type="file" name="event_cover_file" accept="image/*"></label>'+
  '</div><p class="help">Após criar, monte a lista de separação, imprima em A4 e confirme o envio físico.</p>',
  'event-create','Criar e preparar');
 syncCoverFileField(document.querySelector('.modalback form[data-form="event-create"]'));
}
function eventMove(action){
  const eid=state.activeEvent;
  if(eventStatus(eid)!=='ativo')return;
  const labels={transferencia:'Transferir produtos',venda_evento:'Registrar venda',devolucao:'Devolver produtos'};
  if(action==='transferencia'&&!hasPermission('events.separate') || action==='venda_evento'&&!canSell(eid) ||
    action==='devolucao'&&!canReturn(eid))return;
  const opts=action==='transferencia'?[['','Escolha um produto'],...state.items.filter(p=>p.active&&qtyAvailable(p.id)>0).map(p=>[p.id,p.name])]:productOptions(true,eid);
  if(opts.length===1){toast('Não há produtos disponíveis para essa operação.',true);return;}
  formModal(labels[action],'<div class="formgrid">'+selectField('Produto','product_id',opts,'','required')+
    field('Quantidade','quantity','number','1','required min="1" max="1000000" step="1"')+
    textareaField('Observação (opcional)','note')+'</div>'+
    '<div class="note">'+(action==='transferencia'?'A transferência reduz a loja e aumenta o estoque do evento.':
      action==='devolucao'?'A devolução retorna os produtos à loja.':'A venda reduz apenas o estoque deste evento.')+'</div>',
    'event-move','Confirmar');
  const form=document.querySelector('.modal form');form.dataset.event=eid;form.dataset.movement=action;
}
function eventLossModal(){
 const eid=state.activeEvent;
 if(eventStatus(eid)!=='ativo'||!hasPermission('events.close'))return;
 const opts=productOptions(true,eid);
 if(opts.length<=1)return toast('Não há mercadorias no local para baixar.',true);
 formModal('Registrar perda ou avaria','<div class="formgrid">'+
  selectField('Produto','product_id',opts,'','required')+
  field('Quantidade','quantity','number','1','required min="1" max="1000000" step="1"')+
  selectField('Motivo','reason',[['perda','Perda / extravio'],['avaria','Produto avariado'],['consumo','Consumo interno'],['outro','Outro motivo']])+
  textareaField('Justificativa obrigatória','note')+'</div>'+
  '<div class="note">Esta baixa reduz apenas o saldo da loja temporária e fica registrada como perda justificada. Não é uma devolução.</div>',
  'event-loss','Confirmar baixa');
 document.querySelector('.modal form[data-form="event-loss"]').dataset.event=eid;
}
function memberModal(eid){
  if(!hasPermission('events.manage'))return;
  const occupied=new Set(state.members.filter(m=>m.event_id===eid).map(m=>m.user_id));
  const users=state.users.filter(u=>u.active&&u.role!=='franquia'&&!occupied.has(u.id));
  if(!users.length){toast('Nenhum usuário ativo disponível. Cadastre usuários primeiro.',true);return;}
  formModal('Adicionar responsável / operador','<div class="formgrid">'+selectField('Usuário','user_id',users.map(u=>[u.id,u.full_name+' · '+u.email]))+
    selectField('Papel neste evento','role',[['responsavel','Responsável'],['operador','Operador']])+'</div>'+
    '<div class="note">Responsáveis informam devoluções; somente o gestor do CDSB aprova o encerramento.</div>',
    'member-add','Adicionar');
  document.querySelector('.modal form').dataset.event=eid;
}

function categoryModal(parentId=null,fromProduct=false,item=null){
  if(!hasPermission('categories.manage'))return;
  const editing=Boolean(item),hasChildren=editing&&state.categories.some(c=>c.parent_id===item.id);
  const parent=editing?(item.parent_id||''):(parentId||'');
  const parentCat=parent?state.categories.find(c=>c.id===parent):null;
  if(parent&&!parentCat){toast('Categoria superior não encontrada.',true);return;}
  const depth=parentCat?parentCat.depth+1:1;
  const label=editing?'Editar categoria':depth===1?'Nova categoria':'Nova subcategoria · nível '+depth;
  const parentField=fromProduct||hasChildren?
    '<div class="field"><span>Categoria superior</span><div class="readonly-field">'+h(parentCat?categoryFull(parent):'Categoria principal')+'</div>'+
    '<input type="hidden" name="parent_id" value="'+h(parent)+'"></div>':
    '<div class="field"><span>Categoria superior</span><input type="hidden" name="parent_id" value="'+h(parent)+'">'+
    '<button type="button" class="taxonomy-trigger" data-action="taxonomy-open" data-mode="parent" aria-haspopup="dialog">'+
    '<span class="taxonomy-icon">▤</span><span class="taxonomy-text"><small>Organização da categoria</small>'+
    '<strong data-category-label>'+h(parentCat?categoryFull(parent):'Nenhuma (principal)')+'</strong></span><span class="taxonomy-arrow">⌄</span></button></div>';
  formModal(label,'<div class="formgrid">'+field('Nome','name','text',item?.name||'','required minlength="2" maxlength="90"')+
    parentField+field('Mínimo por SKU para franquia (opcional)','franchise_min_qty','number',item?.franchise_min_qty??'','min="1" max="1000000" step="1" placeholder="Herdar da categoria superior"')+'</div>'+renderCategoryVariationFields(item||{parent_id:parent,variation_options:null},state.categories)+
    '<p class="help" style="margin-top:12px">As variações configuradas aqui aparecerão no cadastro de produtos.</p>',
    editing?'category-edit':'category-new',editing?'Salvar':'Criar categoria',fromProduct);
  const form=[...document.querySelectorAll('.modalback form')].at(-1);
  form.dataset.parent=parent;
  form.dataset.fromProduct=fromProduct?'1':'0';
  form.dataset.lockParent=hasChildren||fromProduct?'1':'0';
  if(editing)form.dataset.id=item.id;
}

function tagModal(fromProduct=false){
  if(!hasPermission('tags.manage'))return;
  formModal('Criar tag',
    '<div class="formgrid">'+field('Nome da tag','name','text','','required minlength="2" maxlength="40"')+'</div>'+
    '<p class="help" style="margin-top:12px">A tag ficará disponível para todos os produtos.</p>',
    'tag-new','Criar tag',fromProduct);
  const form=[...document.querySelectorAll('.modalback form')].at(-1);
  form.dataset.fromProduct=fromProduct?'1':'0';
}
async function saveTaxonomyFromProduct(form,table,data,success){
  if(state.loading)return;
  state.loading=true;
  try{
    const record=assertOk(await db.from(table).insert(data).select('*').single());
    if(table==='tags'){state.tags.push(record);state.tags.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
    else state.categories.push(record);
    closeTopModal();
    refreshTaxonomyForm(table==='categories'?record.id:null,table==='tags'?record.name:null);
    toast(success);
  }catch(e){fail(e);}finally{state.loading=false;}
}

function permissionFields(userId){
 const user=state.users.find(x=>x.id===userId);
 const explicit=state.userPermissions.filter(x=>x.user_id===userId).map(x=>x.permission);
 const chosen=explicit.length?explicit:(user?.role==='admin'?permissionCatalog.map(([key])=>key):
   (permissionDefaults[user?.role||'evento']||[]));
 return '<section class="form-section wide"><strong>Vinculação às unidades</strong>'+
 '<p class="help">Loja permanente: selecione somente uma unidade. Separador: CDSB. Temporária: vínculo pelo evento.</p>'+
 state.stores.filter(x=>x.active).map(x=>'<label class="field"><span>'+
  '<input type="checkbox" name="store" value="'+h(x.id)+'" data-store-kind="'+h(x.kind)+'" '+
  ((state.staffStores.some(ss=>ss.user_id===userId&&ss.store_id===x.id)||(!userId&&x.is_primary))?'checked':'')+
  '> '+h(x.name)+'</span></label>').join('')+'</section>'+
 '<details class="access-advanced wide"><summary>Permissões avançadas · somente administradores</summary>'+
 '<p class="help">O perfil escolhido define as permissões automáticas. Personalize somente quando necessário; o backend valida o acesso.</p>'+
 permissionCatalog.map(([key,label])=>'<label class="field"><span><input type="checkbox" name="perm" value="'+h(key)+'" '+
  (chosen.includes(key)?'checked':'')+'> '+h(label)+'</span></label>').join('')+'</details>';
}
function setupFranchiseProfile(form){
 const role=form?.querySelector('[name="role"]');if(!role)return;
 const choose=(current)=>{
  const profiles={
   franquia:['products.read','orders.franchise'],
   estoquista:['products.read','orders.read','orders.separate'],
   evento:['products.read','events.read','events.request'],
   admin:permissionCatalog.map(([p])=>p)
  };
  const selected=profiles[current]||permissionDefaults[current]||[];
  for(const input of form.querySelectorAll('input[name="perm"]'))input.checked=selected.includes(input.value);
  const choices=[...form.querySelectorAll('input[name="store"]')];
  for(const input of choices){
   input.checked=current==='estoquista'&&state.stores.some(s=>s.id===input.value&&s.is_primary);
   const store=state.stores.find(s=>s.id===input.value);
   const shown=current==='franquia'?store?.kind==='franquia':
     current==='estoquista'?store?.is_primary:
     current==='evento'?false:true;
   const label=input.closest('label');if(label)label.hidden=!shown;
  }
  if(current==='franquia'){
   const active=choices.filter(x=>!x.closest('label')?.hidden);
   if(active.length===1)active[0].checked=true;
  }
 };
 role.addEventListener('change',()=>choose(role.value));
 form.addEventListener('change',event=>{
  if(event.target.matches('input[name="store"]')&&role.value==='franquia'&&event.target.checked)
   for(const other of form.querySelectorAll('input[name="store"]'))
    if(other!==event.target)other.checked=false;
 });
 if(!form.dataset.id&&!form.dataset.existingUser)choose(role.value);
}
function assertFranchiseProfile(form,role,perms,storeIds){
 if(role!=='franquia')return;
 const expected=permissionDefaults.franquia;
 if(perms.length!==expected.length||!expected.every(x=>perms.includes(x))||
   storeIds.length!==1||!state.stores.some(x=>x.id===storeIds[0]&&x.active&&x.kind==='franquia'))
   throw new Error('O perfil Franquia exige apenas Consultar produtos e Solicitar para franquia, vinculado a uma única franquia ativa.');
}
function userRoleModal(id){
 if(!isAdmin()||id===state.user?.id)return;
 const target=state.users.find(x=>x.id===id);if(!target)return;
 formModal('Autorizações · '+target.full_name,
 '<div class="formgrid">'+selectField('Perfil de referência','role',Object.entries(roles),target.role)+permissionFields(id)+'</div>',
 'user-permissions','Salvar autorizações');
 const form=document.querySelector('.modal form');form.dataset.id=id;
 setupFranchiseProfile(form);
}
function branchReturnModal(storeId){
 const store=state.stores.find(x=>x.id===storeId);
 if(!store||store.kind!=='filial'||!store.active||!assignedStore(storeId)||
    !(hasPermission('stores.manage')||hasPermission('orders.receive')))return;
 const lines=state.storeBalances.filter(b=>b.store_id===storeId&&Number(b.quantity)>0);
 if(!lines.length)return toast('Esta filial não possui saldo para devolver.',true);
 formModal('Devolver mercadorias · '+store.name,'<div class="formgrid">'+
 selectField('Produto','product_id',lines.map(x=>[x.product_id,(product(x.product_id)?.name||'Produto')+' · '+x.quantity+' un.']))+
 field('Quantidade','quantity','number','1','required min="1" max="1000000" step="1"')+
 textareaField('Motivo obrigatório','reason')+'</div>'+
 '<div class="note">A mercadoria sai da filial e fica em trânsito. Só entra na central depois da conferência física.</div>',
 'branch-return-dispatch','Registrar devolução');
 document.querySelector('.modal form[data-form="branch-return-dispatch"]').dataset.store=storeId;
}
function branchStockModal(storeId){
 const store=state.stores.find(x=>x.id===storeId);
 if(!store||!store.active||store.kind!=='filial'||!assignedStore(storeId)||
    !(hasPermission('stores.manage')||hasPermission('orders.receive')))return;
 const opts=state.items.filter(p=>p.active).map(p=>[p.id,[p.name,p.apparel_size,p.apparel_color,p.sku].filter(Boolean).join(' · ')]);
 if(!opts.length)return toast('Nenhum produto ativo cadastrado.',true);
 formModal('Movimentar estoque · '+store.name,
  '<div class="formgrid">'+
  selectField('Produto','product_id',opts)+
  selectField('Operação','operation',[['saida','Saída avulsa da filial'],['ajuste','Contagem / ajuste físico']])+
  field('Quantidade (saída ou contagem)','quantity','number','1','required min="0" max="1000000" step="1"')+
  '<p class="wide help" data-branch-available>Saldo atual: selecione um produto.</p>'+
  textareaField('Motivo obrigatório','reason')+
  '</div><div class="note">A saída reduz apenas o estoque desta filial. A contagem define o novo saldo físico e registra a diferença. Nenhuma operação afeta a central.</div>',
  'branch-stock-movement','Registrar movimento');
 const form=document.querySelector('.modal form[data-form="branch-stock-movement"]');
 form.dataset.store=storeId;
 const update=()=>{
  const pid=form.querySelector('[name="product_id"]')?.value;
  const current=Number(state.storeBalances.find(x=>x.store_id===storeId&&x.product_id===pid)?.quantity||0);
  form.dataset.expected=String(current);
  form.querySelector('[data-branch-available]').textContent='Saldo físico atual nesta filial: '+current+' un.';
 };
 form.querySelector('[name="product_id"]')?.addEventListener('change',update);
 update();
}
function storesPage(){
 const portal=isFranchisePortal();
 return renderStoreHub({
  stores:state.stores,events:state.events,orders:unifiedOrderRecords(),
  context:{
   button,time:niceTime,portal,
   canBrowseOrders:permittedView('pedidos'),
   canProcess:o=>permittedView('pedidos')&&!portal&&(
     o.kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
     hasPermission('orders.separate')&&(o.kind==='avulso'||assignedStore(o.raw.from_store_id))),
   canPrint:o=>permittedView('pedidos')&&!portal&&o.lines?.length>0,
   canManageStores:hasPermission('stores.manage')&&!portal,
   canManageEvent:hasPermission('events.manage')&&!portal,
   canOpenEvent:permittedView('eventos'),
   showCentral:!portal&&(hasPermission('stores.read')||hasPermission('stores.manage')||
      hasPermission('orders.read')||hasPermission('orders.separate')||hasPermission('orders.internal')||
      hasPermission('events.separate')),
   showFranchises:portal||hasPermission('stores.read')||hasPermission('stores.manage')||canUseStoreOrders(),
   showEvents:!portal&&permittedView('eventos'),
   showBranches:!portal&&(hasPermission('stores.read')||hasPermission('stores.manage')),
   canSeeStore:store=>hasPermission('stores.manage')||assignedStore(store.id),
   canSeeEvent:event=>hasPermission('events.read')||hasPermission('events.manage')||Boolean(memberRole(event.id))
  }
 });
}
function storesAdminPage(){
 const manage=hasPermission('stores.manage');
 return tabHead('Administração de lojas','Cadastros de unidades, filiais e franquias.',button('← Voltar para Lojas','view','data-view="lojas"','small')+(manage?button('+ Nova loja','store-new','','primary'):''))+
 panel('Unidades',state.stores.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Loja</th><th>Código</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>'+
 state.stores.map(x=>'<tr><td><strong>'+h(x.name)+'</strong></td><td>'+h(x.code)+'</td><td>'+h(x.kind)+(x.is_primary?' · Principal':'')+'</td><td>'+(x.active?'Ativa':'Inativa')+' · '+(x.kind==='franquia'?'Não controlado':(x.is_primary?state.balances.filter(b=>!b.event_id).reduce((n,b)=>n+b.quantity,0):state.storeBalances.filter(b=>b.store_id===x.id).reduce((n,b)=>n+b.quantity,0))+' un.')+'</td><td>'+
 ((x.kind==='filial'&&x.active&&assignedStore(x.id)&&(hasPermission('stores.manage')||hasPermission('orders.receive'))?button('Movimentar','branch-stock-new','data-id="'+h(x.id)+'"','small primary')+button('Devolver à central','branch-return-new','data-id="'+h(x.id)+'"','small'):'')+
 (manage?button('Editar','store-edit','data-id="'+h(x.id)+'"','small')+(x.is_primary?'':button(x.active?'Desativar':'Ativar','store-toggle','data-id="'+h(x.id)+'"','small')+button('Excluir','store-delete','data-id="'+h(x.id)+'"','small')):''))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Nenhuma loja cadastrada.</p>')+
 '<div class="note">A exclusão é bloqueada quando existem vínculos ou saldos. Franquias somente solicitam mercadorias; não têm estoque físico controlado.</div>'+ 
 panel('Devoluções de filiais',state.branchReturns.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Filial</th><th>Produto</th><th>Quantidade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+state.branchReturns.map(r=>'<tr><td>'+h(state.stores.find(x=>x.id===r.from_store_id)?.name||'—')+'</td><td>'+h(product(r.product_id)?.name||'—')+'</td><td>'+r.quantity+'</td><td>'+h(r.status==='em_transito'?'Em trânsito':'Recebido')+'</td><td>'+(r.status==='em_transito'&&hasPermission('stock.entry')?button('Conferir na central','branch-return-receive','data-id="'+h(r.id)+'"','small primary'):'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Nenhuma devolução registrada.</p>')+
 panel('Últimos movimentos de filiais',state.branchMovements.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Filial</th><th>Produto</th><th>Operação</th><th>Variação</th><th>Saldo</th><th>Motivo</th></tr></thead><tbody>'+state.branchMovements.slice(0,60).map(m=>'<tr><td>'+h(niceTime(m.created_at))+'</td><td>'+h(state.stores.find(x=>x.id===m.store_id)?.name||'—')+'</td><td>'+h(product(m.product_id)?.name||'—')+'</td><td>'+h(m.operation)+'</td><td>'+h(m.quantity_delta>0?'+'+m.quantity_delta:String(m.quantity_delta))+'</td><td>'+m.new_quantity+'</td><td>'+h(m.reason)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Nenhum movimento de filial registrado.</p>');
}
function assignedStore(storeId){
 return state.profile?.role==='admin'||state.staffStores.some(x=>x.user_id===state.user?.id&&x.store_id===storeId);
}
function storeOrdersPage(){
 const portal=isFranchisePortal();
 const canRequest=hasPermission('orders.central')||hasPermission('orders.franchise');
 const create=canRequest?button('+ Montar pedido','store-order-new','','primary'):'';
 const labels={solicitado:'Solicitado · aguardando análise',aprovado:'Aprovado · reservado',
  separado:'Separado · fisicamente na central',despachado:'Saiu da central · aguardando recebimento',
  concluido:'Saída concluída',recebido:'Recebido',recebido_divergente:'Recebido com divergência',cancelado:'Cancelado'};
 const orders=portal?state.storeOrders.filter(o=>o.created_by===state.user?.id):state.storeOrders;
 const rows=orders.map(o=>{
  const from=state.stores.find(x=>x.id===o.from_store_id);
  const to=state.stores.find(x=>x.id===o.to_store_id);
  const lines=state.storeOrderItems.filter(x=>x.order_id===o.id);
  const count=lines.reduce((sum,x)=>sum+Number(x.quantity),0);
  const products=lines.map(x=>'<li>'+h(product(x.product_id)?.name||'Produto')+' · '+x.quantity+' un.</li>').join('');
  const canProcess=!portal&&hasPermission('orders.separate')&&assignedStore(o.from_store_id);
  const actions=(o.status==='solicitado'&&canProcess?
       button('Aprovar e reservar','store-order-approve','data-id="'+h(o.id)+'"','small primary'):'')+
    (o.status==='aprovado'&&canProcess?
       button('Confirmar separação','store-order-separate','data-id="'+h(o.id)+'"','small primary'):'')+
    (o.status==='separado'&&canProcess?
       button('Registrar saída física','store-order-dispatch','data-id="'+h(o.id)+'"','small primary'):'')+
    (o.status==='despachado'&&!portal&&hasPermission('orders.receive')&&assignedStore(o.to_store_id)?
       button('Conferir recebimento','store-order-receive','data-id="'+h(o.id)+'"','small primary'):'')+
    (['solicitado','aprovado'].includes(o.status)&&canProcess?
       button('Ajustar quantidades','store-order-adjust','data-id="'+h(o.id)+'"','small'):'')+
    (['solicitado','aprovado','separado'].includes(o.status)&&(
      (o.status==='solicitado'&&o.created_by===state.user?.id)||
      (!portal&&hasPermission('orders.cancel')&&assignedStore(o.to_store_id)))?
       button('Cancelar','store-order-cancel','data-id="'+h(o.id)+'"','small'):'');
  return '<article class="store-order-card"><header><strong>Pedido #'+h(o.id.slice(0,8).toUpperCase())+
   ' · '+h(from?.name||'Central')+' → '+h(to?.name||'Loja')+
   '</strong><span class="pill '+(o.status==='concluido'||o.status==='recebido'?'ativo':'')+'">'+h(labels[o.status]||o.status)+'</span></header>'+
   '<small>'+h(niceTime(o.created_at))+' · '+count+' unidade(s)</small>'+
   (o.external_reference?'<small>Referência externa: '+h(o.external_reference)+'</small>':'')+
   '<ul class="store-order-lines">'+products+'</ul>'+ 
   (state.storeOrderAdjustments.some(a=>a.order_id===o.id)?'<small>Atendimento ajustado: '+state.storeOrderAdjustments.filter(a=>a.order_id===o.id).map(a=>h(product(a.product_id)?.name||'SKU')+' '+a.previous_quantity+' → '+a.approved_quantity).join('; ')+'</small>':'')+
   (state.storeOrderReceipts.some(a=>a.order_id===o.id&&a.missing_quantity>0)?'<p class="help">Divergências de recebimento: '+state.storeOrderReceipts.filter(a=>a.order_id===o.id&&a.missing_quantity>0).map(a=>h(product(a.product_id)?.name||'SKU')+': '+a.missing_quantity+' faltante(s)').join('; ')+'</p>':'')+
   (o.note?'<p>'+h(o.note)+'</p>':'')+'<div class="inline">'+actions+'</div></article>';
 });
 return tabHead(portal?'Pedidos da franquia':'Pedidos e solicitações',
   portal?'Monte pedidos; a central fará a conferência e informará o andamento.':
   'Aprovar reserva → separar fisicamente → registrar saída; franquias não possuem estoque controlado.',create)+
   panel('Solicitações',rows.length?'<div class="store-order-list">'+rows.join('')+'</div>':
   '<div class="panelbody"><p class="muted">Nenhum pedido registrado.</p></div>')+
   (!portal?'<p class="help">Separar não retira mercadoria do estoque físico. A baixa ocorre apenas em Registrar saída física.</p>':'');
}
function orderQuantityModal(orderId,phase){
 const order=state.storeOrders.find(o=>o.id===orderId);
 if(!order)return;
 const picking=phase==='picking',receiving=phase==='receiving',adjusting=phase==='adjust';
 const allowed=receiving?order.status==='despachado'&&hasPermission('orders.receive')&&assignedStore(order.to_store_id):
  ['solicitado','aprovado'].includes(order.status)&&hasPermission('orders.separate')&&assignedStore(order.from_store_id);
 if(!allowed)return;
 const items=state.storeOrderItems.filter(x=>x.order_id===orderId);
 const rows=items.map(x=>{
   const p=product(x.product_id);
   const initial=adjusting?x.quantity:0;
   return '<div class="store-picking-line"><div><strong>'+h(p?.name||'Produto')+'</strong>'+
    '<small>'+h([p?.sku,p?.ean,p?.apparel_size,p?.apparel_color].filter(Boolean).join(' · '))+'</small>'+
    '<small>'+x.quantity+' un. '+(receiving?'enviadas':'solicitadas / reservadas')+'</small></div>'+
    '<label>Quantidade <input type="number" data-phase-qty data-id="'+h(x.product_id)+'" data-expected="'+x.quantity+
    '" min="0" max="'+x.quantity+'" step="1" inputmode="numeric" value="'+initial+'" required></label></div>';
 }).join('');
 formModal(receiving?'Conferir recebimento':picking?'Conferir separação':'Ajustar atendimento',
   '<p class="help">'+(receiving?'Registre apenas o que chegou fisicamente. Faltas ficam documentadas e não entram no estoque.':
   'Quantidades menores liberam reservas e registram o motivo; quantidades zero retiram o SKU deste atendimento.')+'</p>'+
   '<div class="store-picking-list">'+rows+'</div>'+
   textareaField('Motivo das diferenças (obrigatório se houver)','reason'),
   'store-order-'+phase,receiving?'Confirmar quantidades recebidas':picking?'Concluir conferência':'Salvar ajuste');
 document.querySelector('.modalback form[data-form="store-order-'+phase+'"]').dataset.order=orderId;
}
function openAvulsoOrderModal(){
 if(!hasPermission('orders.internal')||isFranchisePortal())return;
 formModal('Criar Pedido Avulso',createInternalOrderForm({
  products:state.items,models:state.apparelModels,events:state.events,groupInventory
 }),'order-create','Registrar e reservar');
}
function unifiedOrderById(kind,id){
 return unifiedOrderRecords().find(o=>o.kind===kind&&o.id===id);
}
function avulsoPickingModal(id){
 const o=unifiedOrderById('avulso',id);
 if(!o||o.status!=='reservado'||!hasPermission('orders.separate')||isFranchisePortal())return;
 formModal('Conferir separação · #'+id.slice(0,8).toUpperCase(),
   pickingOrderRows(o,{h}),'avulso-picking','Concluir separação');
 const form=document.querySelector('.modalback form[data-form="avulso-picking"]');
 if(form){form.dataset.order=id;updateUnifiedPickingTotal(form);}
 hydrateImages();
}
function unifiedShortageModal(kind,id){
 if(!hasPermission('orders.separate')||isFranchisePortal())return;
 const o=unifiedOrderById(kind,id);
 if(!o||!['legado','solicitado','pendente_estoque','aprovado','reservado'].includes(o.status))return;
 if(o.kind==='loja'&&!assignedStore(o.raw.from_store_id))return;
 formModal('Ajustar pedido · #'+id.slice(0,8).toUpperCase(),
   shortageEditRows(o,{h}),'unified-shortage','Salvar ajuste');
 const form=document.querySelector('.modalback form[data-form="unified-shortage"]');
 if(form){form.dataset.order=id;form.dataset.kind=kind;}
}
function updateUnifiedPickingTotal(form){
 if(!form)return;
 const inputs=[...form.querySelectorAll('[data-pick-qty]')];
 const sum=inputs.reduce((a,el)=>a+Math.max(0,Number(el.value||0)),0);
 const total=form.querySelector('[data-picked-total]');
 if(total)total.textContent=String(sum);
 for(const input of inputs)input.closest('[data-picking-row]')?.classList.toggle('is-picked',
   Number(input.value)===Number(input.dataset.expected));
}
async function printUnifiedOrder(kind,id){
 const order=unifiedOrderById(kind,id);
 if(!order||isFranchisePortal()||!order.lines.length)return;
 const popup=window.open('','_blank');
 if(!popup)return toast('O navegador bloqueou a janela de impressão.',true);
 try{
  const photoUrls=await signedPhotoUrls(order.lines.map(line=>line.imagePath));
  popup.document.open();popup.document.write(pickingA4HTML(order,{
   printedAt:new Date().toLocaleString('pt-BR'),photoUrls
  }));popup.document.close();
 }catch(error){popup.close();fail(error);}
}
function storePickingModal(orderId){
 const order=state.storeOrders.find(o=>o.id===orderId);
 if(!order||order.status!=='aprovado'||!hasPermission('orders.separate')||!assignedStore(order.from_store_id))return;
 const items=state.storeOrderItems.filter(x=>x.order_id===orderId);
 if(!items.length)return toast('Pedido sem itens.',true);
 const rows=items.map(x=>{
   const p=product(x.product_id);
   return '<div class="store-picking-line" data-picking-row="'+h(x.product_id)+'">'+
     '<div><strong>'+h(p?.name||'Produto')+'</strong>'+
     '<small>'+h([p?.apparel_color,p?.apparel_size,p?.sku,p?.ean].filter(Boolean).join(' · '))+'</small>'+
     '<small>Reservado: <b>'+x.quantity+'</b> un.</small></div>'+
     '<label>Conferido <input type="number" data-pick-qty data-id="'+h(x.product_id)+
       '" data-expected="'+x.quantity+'" inputmode="numeric" min="0" max="'+x.quantity+
       '" step="1" value="0" required aria-label="Conferido de '+h(p?.name||'Produto')+'"></label></div>';
 }).join('');
 formModal('Conferir separação · #'+orderId.slice(0,8).toUpperCase(),
   '<p class="help">Leia cada EAN para incrementar a quantidade conferida ou informe o total contado manualmente. Todos os SKUs devem conferir com a reserva.</p>'+
   '<div class="store-picking-head"><button type="button" class="button" data-action="store-pick-scan">📷 Ler EAN</button>'+
   '<span>Separar não reduz o estoque físico.</span></div>'+
   '<div class="store-picking-list">'+rows+'</div>',
   'store-order-picking','Confirmar itens conferidos');
 document.querySelector('.modalback form[data-form="store-order-picking"]').dataset.order=orderId;
}
function categoryFranchiseMin(p){
 const category=state.apparelModels.find(m=>m.id===p?.apparel_model_id)?.category_id||p?.category_id;
 const chain=categoryChain(category).slice().reverse();
 return Number(chain.find(c=>c.franchise_min_qty!=null)?.franchise_min_qty||0);
}
function storeOrderModal(){
 const main=state.stores.find(x=>x.is_primary&&x.active);
 if(!main)return toast('Estoque central não cadastrado.',true);
 const targets=state.stores.filter(x=>x.active&&!x.is_primary&&assignedStore(x.id)&&
  ((x.kind==='franquia'&&hasPermission('orders.franchise'))||
   (x.kind==='filial'&&hasPermission('orders.central'))));
 if(!targets.length)return toast('Não há unidade habilitada para solicitar mercadorias.',true);
 const portal=isFranchisePortal();
 const rows=state.items.filter(p=>p.active).slice(0,1500).map(p=>
  '<div class="store-order-product" data-store-row data-filter="'+h([p.name,p.ean,p.sku,p.apparel_color,p.apparel_size].join(' ').toLocaleLowerCase('pt-BR'))+'">'+
  '<div><strong>'+h(p.name)+'</strong><small>'+h([p.apparel_color,p.apparel_size,p.sku,p.ean].filter(Boolean).join(' · '))+
  (portal?'':' · Livre na central: '+qtyAvailable(p.id)+' un.')+'</small>'+ 
  (categoryFranchiseMin(p)?'<small class="franchise-order-min">Mínimo franquia: '+categoryFranchiseMin(p)+' un. por tamanho/SKU</small>':'')+'</div>'+
  '<input type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" data-store-order-qty data-id="'+h(p.id)+'" aria-label="Quantidade de '+h(p.name)+'"></div>').join('');
 formModal('Montar solicitação de mercadorias','<div class="formgrid">'+
  selectField('Unidade solicitante','to_store_id',targets.map(x=>[x.id,x.name]))+
  '<div class="field wide"><span>Buscar por nome, SKU ou EAN</span><input type="search" data-store-order-search placeholder="Buscar produtos…"></div>'+
  '<section class="wide store-order-products">'+rows+'</section>'+
  textareaField('Observação (opcional)','note')+'</div><div class="note">O pedido reserva imediatamente as unidades livres. Faltas são registradas sem reduzir silenciosamente a quantidade solicitada. A saída física acontece após conferência.</div>',
  'store-order-create','Enviar solicitação');
}
function storeModal(item=null){
 if(!hasPermission('stores.manage'))return;
 formModal(item?'Editar loja':'Nova loja','<div class="formgrid">'+
 field('Código','code','text',item?.code||'','required maxlength="30"')+
 field('Nome','name','text',item?.name||'','required maxlength="120"')+
 selectField('Tipo','kind',[['central','Loja central'],['filial','Filial'],['franquia','Franquia']],item?.kind||'filial')+
 field('CNPJ','document','text',item?.document||'')+
 field('Telefone','phone','text',item?.phone||'')+
 field('Responsável','manager_name','text',item?.manager_name||'')+
 textareaField('Endereço','address',item?.address||'')+'</div>','store-save','Salvar loja');
 document.querySelector('.modal form').dataset.id=item?.id||'';
}
function userModal(){
  if(!isAdmin())return;
  formModal('Cadastrar usuário','<div class="formgrid">'+
    field('Nome completo','full_name','text','','required minlength="2" maxlength="120" autocomplete="name"')+
    field('Usuário','username','text','','required minlength="3" maxlength="32" autocapitalize="none"')+
    selectField('Função','role',Object.entries(roles),'evento')+
    permissionFields('')+
    field('Senha inicial','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"',
      'Mínimo de 12 caracteres. A senha não será enviada por email.')+
    field('Confirmar senha','password_confirm','password','','required minlength="12" maxlength="128" autocomplete="new-password"')+
    '</div><div class="note">O administrador entrega a senha ao funcionário por um canal seguro. O acesso é liberado imediatamente, sem confirmação por email.</div>',
    'user-new','Cadastrar usuário');
  setupFranchiseProfile(document.querySelector('.modal form[data-form="user-new"]'));
}
function adminPasswordModal(id){
  if(!isAdmin()||id===state.user?.id)return;
  const target=state.users.find(x=>x.id===id);if(!target)return;
  formModal('Definir senha · '+target.full_name,'<div class="formgrid">'+
    field('Nova senha','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')+
    field('Confirmar nova senha','password_confirm','password','','required minlength="12" maxlength="128" autocomplete="new-password"')+
    '</div><p class="help">Não será enviado email de confirmação. Informe a nova senha diretamente ao colaborador.</p>',
    'user-password','Salvar senha');
  document.querySelector('.modalback form').dataset.id=id;
}
function myPasswordModal(){
  if(!state.user||!state.profile?.active)return;
  formModal('Minha senha','<div class="formgrid">'+
    field('Nova senha','password','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
    field('Confirmar nova senha','password_confirm','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
    '</div><p class="help">Sua senha é armazenada com segurança no Supabase Auth.</p>',
    'my-password','Atualizar minha senha');
}
function passwordsValid(values){
  const p=String(values.password||''),repeat=String(values.password_confirm||'');
  if(p.length<12||p.length>128)throw new Error('Utilize uma senha de 12 a 128 caracteres.');
  if(p!==repeat)throw new Error('As senhas digitadas são diferentes.');
  return p;
}
async function invokeUserAdmin(action,body){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
  const response=await db.functions.invoke('admin-create-user',{body:{action,...body}});
  if(response.error){
    let message='Não foi possível salvar o usuário.';
    const context=response.error.context;
    if(context&&typeof context.json==='function'){
      try{const json=await context.json();message=json?.error||json?.message||message;}catch{}
    }
    if(message==='Não foi possível salvar o usuário.'){
      if(response.error.name==='FunctionsFetchError')message='Não foi possível conectar ao serviço. Recarregue a página e tente novamente.';
      else if(context?.status===401)message='Sessão expirada. Faça login novamente.';
      else if(context?.status===403)message='Acesso negado. Somente administradores podem alterar usuários.';
      else message=response.error.message||message;
    }
    throw new Error(message);
  }
  if(!response.data?.success)throw new Error(response.data?.error||'Não foi possível salvar o usuário.');
  return response.data;
}

function csvCell(value){
  let text=String(value??'');
  if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function exportCsv(){
  const rows=[['Data/hora','Produto','EAN','Operação','Quantidade','Loja delta','Evento delta','Evento','Responsável','Observação']];
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  state.movements.filter(m=>(!state.eventFilter||m.event_id===state.eventFilter)&&
    (!state.movementFilter||m.action===state.movementFilter)&&
    (!q||[product(m.product_id)?.name,m.note,m.actor_id,username(m.actor_id)].join(' ').toLocaleLowerCase('pt-BR').includes(q)))
    .forEach(m=>rows.push([niceTime(m.created_at),product(m.product_id)?.name||'',product(m.product_id)?.ean||'',actionNames[m.action]||m.action,m.quantity,m.delta_store,m.delta_event,eventById(m.event_id)?.name||'',username(m.actor_id),m.note||'']));
  const data='\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob([data],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ame-mais-movimentacoes-'+dateToday()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function signedPhotoUrl(path){
 if(!path)return '';
 const cached=state.imageCache.get(path);
 if(cached?.url&&cached.expires>Date.now())return cached.url;
 const response=await db.storage.from('ame-produtos').createSignedUrl(path,600);
 if(response.error)throw response.error;
 const url=response.data?.signedUrl||'';
 state.imageCache.set(path,{url,expires:Date.now()+570000});
 return url;
}
async function signedPhotoUrls(paths){
 const urls=Object.create(null);
 await Promise.all([...new Set(paths.filter(Boolean))].map(async path=>{
  try{urls[path]=await signedPhotoUrl(path);}
  catch(error){console.warn('Foto indisponível na impressão',error);}
 }));
 return urls;
}
async function hydrateImages(){
 const eventNodes=[...document.querySelectorAll('img[data-event-cover]')];
 await Promise.all(eventNodes.map(async node=>{
  const path=node.dataset.eventCover;if(!path)return;
  const key='event:'+path;let item=state.imageCache.get(key);
  try{
   if(!item||item.expires<Date.now()){
    const response=await db.storage.from('ame-eventos').createSignedUrl(path,600);
    if(response.error)throw response.error;
    item={url:response.data.signedUrl,expires:Date.now()+570000};state.imageCache.set(key,item);
   }
   if(node.isConnected)node.src=item.url;
  }catch(error){console.warn('Capa indisponível',error);}
 }));
 const nodes=[...document.querySelectorAll('img[data-photo-id],img[data-photo-path]')];
 await Promise.all(nodes.map(async node=>{
  const path=node.dataset.photoPath||product(node.dataset.photoId)?.image_path;
  if(!path)return;
  try{const url=await signedPhotoUrl(path);if(node.isConnected&&url)node.src=url;}
  catch(error){console.warn('Foto indisponível',error);}
 }));
}
function closeMobileNavigation(restoreFocus=true){
  document.querySelector('.mobile-more-overlay')?.remove();
  document.body.classList.remove('mobile-menu-open');
  const appShell=document.querySelector('.app-shell');
  if(appShell)appShell.inert=false;
  const trigger=document.querySelector('[data-action="mobile-more"]');
  trigger?.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger?.focus({preventScroll:true});
}
function searchAndManageSku(code,openPanel=false){
 const value=String(code||'').trim();
 if(!value)return;
 state.view='produtos';state.search=value;state.page=0;
 state.categoryFilter='';state.tagFilter='';
 render();
 const found=state.items.find(p=>p.active&&(String(p.ean||'')===value||
   String(p.sku||'').toLocaleLowerCase('pt-BR')===value.toLocaleLowerCase('pt-BR')));
 if(found&&openPanel&&canOpenSkuManager())manageSku(found.id);
 else if(openPanel&&!found)toast('Código não encontrado no catálogo.',true);
}
function switchView(view) {
  if(view==='pedidos-lojas'||view==='separacao')view='pedidos';
  if(view==='eventos')view='lojas';
  if(view==='roupas'||view==='saida'||view==='balanco')view='produtos';
  if(!permittedView(view))return;
  state.view=view;state.search='';state.page=0;state.ordersContext=null;
  if(view!=='eventos'){state.activeEvent=null;state.eventWorkflow=null;state.eventReturnQuery='';}
  render();window.scrollTo(0,0);
}
async function scanInto(selector, scope=document){
  try {
    await scanEAN(code=>{
      const el=scope?.querySelector(selector);
      if(el && el.isConnected){
        el.value=code;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        if(el.isConnected)el.dispatchEvent(new Event('change',{bubbles:true}));
        if(el.isConnected)el.focus();
        toast('Código EAN lido com sucesso.');
      } else if(selector==='#product-search'){
        state.search=code;state.page=0;render();
      } else toast('O formulário foi fechado. Abra o cadastro novamente.',true);
    });
  }catch(error){fail(error);}
}
async function handleClick(event){
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id,view,user,event:eventId,target:scanTarget}=target.dataset;
  if(action==='view'){closeMobileNavigation(false);switchView(view);return;}
  if(action==='global-scan'){
    closeMobileNavigation(false);
    try {return scanEAN(code=>{
      if(state.view==='eventos'&&state.eventWorkflow==='return'){
        state.eventReturnQuery=code;
        const search=document.querySelector('#event-return-search');
        if(search){
          search.value=code;filterWorkflowRows(search.closest('.main'),code,'return');
          const form=[...document.querySelectorAll('.return-variant')].find(x=>
            !x.hidden&&x.dataset.search?.split(' ').includes(code));
          if(form)form.querySelector('[name="quantity"]')?.focus();
          else toast('EAN não encontrado entre os itens pendentes do evento.',true);
        }
        return;
      }
      if((state.view==='entrada'||state.view==='saida')&&permittedView(state.view)){
        handleOperationScanCode(code);return;
      }
      if(state.view==='balanco'){
        state.search=code;state.page=0;
        const search=document.getElementById('quick-search'),list=document.querySelector('.quick-group-list');
        if(search&&list){
          search.value=code;
          const found=searchQuickCards(code);
          if(found)list.querySelector('[data-quick-group]:not([hidden])')?.scrollIntoView({behavior:'smooth',block:'nearest'});
          else toast('EAN não encontrado nos produtos exibidos.',true);
        }else render();
        return;
      }
      searchAndManageSku(code,true);
    });}catch(error){fail(error);return;}
  }
  if(action==='home-category'){
    state.categoryFilter=id;state.tagFilter='';switchView('produtos');return;
  }
  if(action==='home-product'){
    const item=product(id);if(!item)return;
    state.categoryFilter='';state.tagFilter='';switchView('produtos');state.search=item.sku||item.ean||item.name;
    render();return;
  }
  if(action==='count-focus')return document.querySelector('[data-count-product="'+id+'"] input[name="counted"]')?.focus();
  if(action==='quick-save-one'){
    const card=target.closest('[data-quick-group]');
    if(card)return saveQuickGroupCounts(card,id);
    return;
  }
  if(action==='quick-scan')return scanInto('#quick-search');
  if(action==='mobile-more'){
    closeMobileNavigation(false);
    const overlay=document.createElement('div');
    overlay.className='mobile-more-overlay';
    const options=nav.filter(item=>permittedView(item.id));
    const controls=options.map(item=>'<button type="button" class="'+(state.view===item.id?'active':'')+
      '" data-action="view" data-view="'+h(item.id)+'"'+(state.view===item.id?' aria-current="page"':'')+'>'+
      uiIcon(item.ico,21)+'<span>'+h(item.label)+'</span>'+
      (state.view===item.id?'<span class="mobile-menu-current">Atual</span>':uiIcon('chevron',17))+
      '</button>').join('');
    overlay.innerHTML='<section class="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title">'+
      '<header class="mobile-navigation-head">'+
        '<div><img src="./ame-plus-logo.svg" alt="Ame+ Store" width="84" height="45">'+
          '<strong id="mobile-navigation-title">Menu do sistema</strong></div>'+
        '<button type="button" data-action="mobile-more-close" class="mobile-navigation-close" aria-label="Fechar menu">✕</button>'+
      '</header>'+
      '<div class="mobile-navigation-scroll">'+
        '<div class="mobile-menu-label">NAVEGAÇÃO</div>'+
        '<nav class="c-more-items" aria-label="Seções do AME MAIS">'+controls+'</nav>'+
        '<div class="mobile-menu-label">ACESSO RÁPIDO</div>'+
        '<button type="button" class="mobile-menu-scan" data-action="global-scan">'+
          uiIcon('scan',22)+'<span>Ler EAN pela câmera</span>'+uiIcon('chevron',17)+'</button>'+
        '<div class="c-more-account"><strong>'+h(state.profile.full_name)+'</strong>'+
          '<small>'+h(roles[state.profile.role]||state.profile.role)+'</small>'+
          '<button type="button" data-action="my-password">'+uiIcon('users',18)+' Minha senha</button>'+
          '<button type="button" data-action="logout">'+uiIcon('exit',18)+' Sair da conta</button>'+
        '</div>'+
      '</div></section>';
    document.body.append(overlay);
    document.body.classList.add('mobile-menu-open');
    const appShell=document.querySelector('.app-shell');
    if(appShell)appShell.inert=true;
    target.setAttribute('aria-expanded','true');
    overlay.querySelector('[data-action="mobile-more-close"]')?.focus({preventScroll:true});
    return;
  }
  if(action==='mobile-more-close'){closeMobileNavigation();return;}
  if(action==='photo-close'){document.querySelector('.photo-lightbox')?.remove();return;}
  if(action==='photo-view'){
    const item=product(id);if(!item?.image_path){toast('Este produto ainda não possui foto.',true);return;}
    try{
      const cached=state.imageCache.get(item.image_path);
      let url=cached?.expires>Date.now()?cached.url:null;
      if(!url){
        const r=await db.storage.from('ame-produtos').createSignedUrl(item.image_path,600);
        url=assertOk(r)?.signedUrl;
        state.imageCache.set(item.image_path,{url,expires:Date.now()+570000});
      }
      photoLightbox(url,item.name);
    }catch(e){fail(e);}
    return;
  }
  if(action==='gallery-zoom'){
   const image=target.querySelector('img');
   if(image?.src)return photoLightbox(image.src,'Foto do produto');
   return;
  }
  if(action==='gallery-replace'){
   const form=target.closest('form');if(!form)return;
   form.__replaceIndex=Number(target.dataset.index);
   form.querySelector('input[name="gallery_replace_file"]')?.click();return;
  }
  if(action==='gallery-remove'){galleryRemove(target.closest('form'),Number(target.dataset.index));hydrateImages();return;}
  if(action==='gallery-primary'){galleryMain(target.closest('form'),Number(target.dataset.index));hydrateImages();return;}
  if(action==='preview-zoom'){
    const preview=target.querySelector('img');
    if(!preview?.src){toast('Escolha ou tire uma foto primeiro.');return;}
    photoLightbox(preview.src,'Foto do produto');
    return;
  }
  if(action==='logout'){closeMobileNavigation(false);await db.auth.signOut();state.user=null;state.profile=null;state.imageCache.clear();render();return;}
  if(action==='taxonomy-open'){
    const mode=target.dataset.mode,form=target.closest('form');
    const selected=mode==='product'?chosenCategory(form):
      mode==='parent'?form?.querySelector('input[name="parent_id"]')?.value:
      mode==='tag'?state.tagFilter:state.categoryFilter;
    openTaxonomyPicker({
      trigger:target,categories:mode==='tag'?state.tags:state.categories,selected: selected||'',mode,
      excludeId:mode==='parent'?form?.dataset.id:null,
      onSelect:value=>{
        if(mode==='filter'){state.categoryFilter=value;state.page=0;render();return;}
        if(mode==='tag'){state.tagFilter=value;state.page=0;render();return;}
        const input=form?.querySelector('input[name="'+(mode==='parent'?'parent_id':'category_id')+'"]');
        if(input)input.value=value;
        const label=target.querySelector('[data-category-label]');
        if(label)label.textContent=value?categoryFull(value):(mode==='parent'?'Nenhuma (principal)':'Escolher categoria');
        if(mode==='product'){
          refreshProductTagChoices(form);
          refreshCategorySizeOptions(form,state.categories);
          const add=form.querySelector('[data-action="quick-category"]');
          if(add)add.textContent=value?'+ Subcategoria':'+ Categoria';
        }
      }
    });return;
  }
  if(action==='category-toggle'){
    if(state.catalogExpanded.has(id))state.catalogExpanded.delete(id);
    else state.catalogExpanded.add(id);
    const tree=document.querySelector('.catalog-tree-list');
    if(tree)tree.innerHTML=renderCatalogTree();
    else render();
    return;
  }
  if(action==='category-expand-all'||action==='category-collapse-all'){
    state.catalogExpanded=new Set(action==='category-expand-all'?state.categories.map(c=>c.id):[]);
    const tree=document.querySelector('.catalog-tree-list');if(tree)tree.innerHTML=renderCatalogTree();
    return;
  }
  if(action==='tag-show-all'){
    const wrapper=target.closest('[data-tag-choices]');
    const others=wrapper?.querySelector('[data-other-tags]');
    if(!others)return;
    others.hidden=!others.hidden;
    target.setAttribute('aria-expanded',String(!others.hidden));
    target.textContent=others.hidden?'Ver outras tags ▾':'Ocultar outras tags ▴';
    return;
  }
  if(action==='modal-close'){closeTopModal();return;}
  if(action==='login-mode'){state.loginMode=state.loginMode==='link'?'password':'link';state.loginNotice='';render();return;}
  if(action==='my-password'){closeMobileNavigation(false);return myPasswordModal();}
  if(action==='set-user-password')return adminPasswordModal(id);
  if(action==='forgot'){
    const email=window.prompt('Informe o email da sua conta:');
    if(!email)return;
    const res=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.href.split('#')[0]});
    if(res.error)fail(res.error);else toast('Se o email estiver cadastrado, as instruções serão enviadas.');
    return;
  }
  if(action==='apparel-new'){
    if(!canRegisterProducts())return;
    return productModal();
  }
  if(action==='apparel-add-row'){
    try{return apparelAddRow(target,{h});}catch(error){fail(error);return;}
  }
  if(action==='apparel-fill-sizes'){
    try{return apparelFillSizes(target,{h});}catch(error){fail(error);return;}
  }
  if(action==='apparel-variant-edit'){
    if(!canRegisterProducts())return;
    try{const p=product(id),m=state.apparelModels.find(x=>x.id===p?.apparel_model_id);
      return apparelVariantEditModal(p,{h,formModal,
        variationOptions:resolveCategoryVariations(state.categories,m?.category_id||p?.category_id).options});
    }catch(error){fail(error);return;}
  }
  if(action==='apparel-photo'){
    if(!canRegisterProducts())return;
    try{return apparelPhotoModal(state.apparelModels.find(m=>m.id===id),state,{formModal,photoChooser,hydrateImages});}
    catch(error){fail(error);return;}
  }
  if(action==='apparel-remove-row'){
    try{return apparelRemoveRow(target);}catch(error){fail(error);return;}
  }
  if(action==='apparel-expand'){
    if(state.apparelOpen.has(id))state.apparelOpen.delete(id);
    else state.apparelOpen.add(id);
    render();return;
  }
  if(action==='apparel-product'){
    state.view='produtos';state.search=product(id)?.name||'';state.page=0;render();return;
  }
  if(action==='apparel-scan'){
    return scanInto('input[data-variant-ean]',target.closest('[data-apparel-row]')||target.closest('form'));
  }
  if(action==='add-variants'){
    if(!canRegisterProducts())return;
    const model=state.apparelModels.find(m=>m.id===id);if(!model)return toast('Modelo não encontrado.',true);
    const variants=state.items.filter(p=>p.apparel_model_id===id);
    const options=resolveCategoryVariations(state.categories,model.category_id).options;
    if(!options.length)return toast('Configure primeiro as variações desta categoria em Categorias.',true);
    formModal('Adicionar variações · '+model.name,
      addSizesContent(model,variants,options),'extra-sizes','Cadastrar variações');
    const form=document.querySelector('.modalback form[data-form="extra-sizes"]');
    form.dataset.modelId=id;
    return;
  }
  if(action==='extra-size-toggle')return toggleExtraSize(target.closest('form'),target.dataset.size);
  if(action==='share-product'){
    if(!canRegisterProducts())return;
    const selected=product(id);if(!selected?.active)return toast('Produto indisponível para compartilhamento.',true);
    target.disabled=true;
    try{
      const token=assertOk(await db.rpc('create_product_share',{p_product_id:id}));
      if(!/^[0-9a-f]{64}$/.test(token||''))throw new Error('Não foi possível gerar um link seguro.');
      const url=new URL('./share.html',window.location.href);
      url.search='';url.hash='t='+token;
      const model=state.apparelModels.find(m=>m.id===selected.apparel_model_id);
      shareProductModal(model?.name||selected.name,url.toString());
    }catch(error){fail(error);}
    finally{if(target.isConnected)target.disabled=false;}
    return;
  }
  if(action==='share-close'){document.querySelector('.share-product-modal')?.remove();return;}
  if(action==='share-send-whatsapp'){
    const layer=target.closest('.share-product-modal'),url=layer?.dataset.shareUrl;
    if(!url)return;
    const title=layer.dataset.shareTitle||'Produto Ame+';
    const message='Ame+ Store — '+title+'\nConsulte a foto, os tamanhos, o estoque, SKU e EAN:\n'+url;
    const whatsapp='https://wa.me/?text='+encodeURIComponent(message);
    const windowRef=window.open(whatsapp,'_blank','noopener,noreferrer');
    if(!windowRef)window.location.assign(whatsapp);
    return;
  }
  if(action==='share-copy-link'){
    const url=target.closest('.share-product-modal')?.dataset.shareUrl;if(!url)return;
    try{await navigator.clipboard.writeText(url);toast('Link copiado.');}
    catch{window.prompt('Copie o link do produto:',url);}
    return;
  }
  if(action==='stock-receive-shipment'){
    if(!hasPermission('stock.entry')||isFranchisePortal())return;
    switchView('entrada');return;
  }
  if(action==='product-new-ean'){
    if(!hasPermission('products.create'))return;
    const ean=state.search.trim();
    if(!/^\d{8,14}$/.test(ean))return;
    productModal();
    const input=document.querySelector('.modalback form input[name="ean"]');
    if(input)input.value=ean;
    return;
  }
  if(action==='product-new')return productModal();
  if(action==='products-toggle-inactive'){state.showInactiveProducts=!state.showInactiveProducts;state.page=0;render();return;}
  if(action==='products-clear-filters'){
    state.search='';state.categoryFilter='';state.tagFilter='';state.page=0;
    state.showInactiveProducts=false;render();return;
  }
  if(action==='size-toggle'||action==='size-remove'){
    const form=target.closest('form'),size=target.dataset.size;
    const row=[...form.querySelectorAll('[data-size-variant]')].find(x=>x.dataset.sizeVariant===size);
    setSizeSelected(form,size,action==='size-remove'?false:row?.hidden);return;
  }
  if(action==='size-common'){
    const form=target.closest('form');
    [...form.querySelectorAll('[data-action="size-toggle"]')].slice(0,4).forEach(el=>setSizeSelected(form,el.dataset.size,true));
    return;
  }
  if(action==='size-scan')return scanInto('input[name="size_ean"]',target.closest('[data-size-variant]'));
  if(action==='product-delete'){
    if(!hasPermission('products.delete'))return;
    const item=product(id);if(!item)return;
    if(!window.confirm('Excluir o produto "'+item.name+'"?\nSe existir histórico, ele será desativado para preservar as movimentações. O estoque deve estar zerado.'))return;
    return exec(async()=>{
      const status=assertOk(await db.rpc('remove_product_safely',{p_product_id:id}));
      if(status==='archived')state.showInactiveProducts=false;
    },'Produto excluído ou desativado para preservar o histórico.');
  }
  if(action==='product-card-sizes'){
    const card=target.closest('[data-product-card]');
    const details=card?.querySelector('[data-product-details]');
    if(!details)return;
    details.open=!details.open;
    const key=card.getAttribute('data-product-card');
    if(details.open)state.expandedProductGroups.add(key);
    else state.expandedProductGroups.delete(key);
    target.setAttribute('aria-expanded',String(details.open));
    const sizeCount=details.querySelectorAll('[data-product-id]').length;
    target.innerHTML=(details.open?'Ocultar ': 'Ver ')+sizeCount+' tamanhos <span aria-hidden="true">⌄</span>';
    return;
  }
  if(action==='stock-free-save'){
    if(!hasPermission('stock.balance')||!['admin','gerente','estoquista'].includes(state.profile?.role)
       ||isFranchisePortal())return;
    const row=target.closest('[data-product-id]'),p=product(id);
    const input=row?.querySelector('[data-count-free]');
    if(!p?.active||!row||!input||row.dataset.productId!==id)return;
    const raw=input.value.trim();
    if(!/^(0|[1-9][0-9]{0,6})$/.test(raw)||Number(raw)>1000000)
     return toast('Informe um saldo livre de 0 a 1.000.000 unidades.',true);
    const newFree=Number(raw),physical=Number(row.dataset.expectedPhysical),
      reserved=Number(row.dataset.expectedReserved);
    if(!Number.isInteger(physical)||!Number.isInteger(reserved)||reserved<0||
       qtyStore(id)!==physical||qtyReserved(id)!==reserved)
     return toast('Os saldos foram alterados. Atualize a lista antes de salvar.',true);
    if(newFree+reserved>1000000)return toast('O total físico excederia 1.000.000.',true);
    if(newFree===physical-reserved)return toast('Nenhuma alteração no saldo livre.');
    return exec(async()=>assertOk(await db.rpc('quick_count_available',{
      p_product_id:id,p_expected_physical:physical,p_expected_reserved:reserved,
      p_counted_available:newFree,p_note:'Conferência rápida · Produtos / tamanhos'
    })),'Saldo livre atualizado. Reservas preservadas e divergência auditada.');
  }
  if(action==='product-card-edit'){
    if(!canRegisterProducts())return;
    return productModelManager(id);
  }
  if(action==='product-edit'){
    const item=product(id);
    if(item?.apparel_model_id)return apparelVariantEditModal(item,{h,formModal});
    return productModal(item);
  }
  if(action==='stock-focus-search'){
    const field=document.getElementById('stock-op-search');
    field?.focus({preventScroll:false});return;
  }
  if(action==='stock-scan'){
    try{return scanEAN(code=>handleOperationScanCode(code));}catch(error){fail(error);return;}
  }
  if(action==='stock-pick'){addStockOperationItem(id);return;}
  if(action==='stock-plus'||action==='stock-minus'||action==='stock-remove'){
    const cart=state.stockCarts[state.view],line=cart?.get(id);
    if(!line)return;
    if(action==='stock-remove')cart.delete(id);
    else if(action==='stock-plus')line.quantity=Math.min(1000000,line.quantity+1);
    else line.quantity=Math.max(1,line.quantity-1);
    updateStockOperationBasket();
    return;
  }
  if(action==='stock-create-product'){
    if(state.view!=='entrada'||!hasPermission('products.create'))return;
    const ean=state.stockQuery.entrada.trim();
    productModal();
    if(/^[0-9]{8,14}$/.test(ean)){
      const field=document.querySelector('.modalback form input[name="ean"]');
      if(field)field.value=ean;
    }
    return;
  }
  if(action==='stock-destinations-toggle'){
    const region=document.querySelector('[data-stock-destinations]');
    if(region)region.hidden=!region.hidden;
    return;
  }
  if(action==='stock-destination-new'||action==='stock-destination-edit'){
    if(!hasPermission('stock.destinations'))return;
    const dest=action==='stock-destination-edit'?state.stockDestinations.find(d=>d.id===id):null;
    formModal(dest?'Editar destino':'Novo destino',
      '<div class="formgrid">'+field('Nome do destino *','name','text',dest?.name||'','required minlength="2" maxlength="90"')+
      textareaField('Descrição (opcional)','description',dest?.description||'')+'</div>'+
      '<p class="help">O destino será reutilizável em futuras saídas. Seus registros antigos permanecerão no histórico.</p>',
      'stock-destination-save','Salvar destino');
    const f=document.querySelector('.modalback form[data-form="stock-destination-save"]');
    if(f&&dest)f.dataset.id=dest.id;
    return;
  }
  if(action==='stock-destination-disable'){
    const dest=state.stockDestinations.find(d=>d.id===id);
    if(!hasPermission('stock.destinations')||!dest||!window.confirm('Desativar o destino "'+dest.name+'"? Os históricos de saída serão preservados.'))return;
    if(state.stockSelectedDestination===id)state.stockSelectedDestination='';
    return exec(async()=>assertOk(await db.rpc('deactivate_stock_destination',{p_id:id})),'Destino desativado; histórico preservado.');
  }
  if(action==='sku-manage')return manageSku(id);
  if(action==='sku-mode'){
    const form=target.closest('form[data-form="sku-manage"]');
    if(form)setSkuMode(form,target.dataset.mode);
    return;
  }
  if(action==='sku-edit-advanced'){
    const form=target.closest('form[data-form="sku-manage"]'),item=product(form?.dataset.id);
    if(!item||!hasPermission('products.edit'))return;
    if(item.apparel_model_id){const m=state.apparelModels.find(x=>x.id===item.apparel_model_id);
      return apparelVariantEditModal(item,{h,formModal,
        variationOptions:resolveCategoryVariations(state.categories,m?.category_id||item.category_id).options});}
    return productModal(item);
  }
  if(action==='stock-overview')return stockOverviewModal(id);
  if(action==='stock-overview-close'){target.closest('.stock-overview-overlay')?.remove();return;}
  if(action==='stock-group-modal')return stockModal(null,target.dataset.cardKey);
  if(action==='stock-modal')return stockModal(id);
  if(action==='event-plan-scan')return scanInto('[data-plan-search]',target.closest('form'));
  if(action==='event-batch-new')return eventBatchModal(target.dataset.event||state.activeEvent);
  if(action==='event-batch-edit')return eventBatchModal(
    state.eventPickBatches.find(b=>b.id===id)?.event_id,id);
  if(action==='event-batch-pick')return eventBatchPickModal(id);
  if(action==='event-batch-finish-pick')return saveEventBatchPicking(target.closest('form'),true);
  if(action==='event-batch-cancel')return eventBatchCancelModal(id);
  if(action==='event-batch-go'){
    if(!permittedView('pedidos'))return toast('Sem permissão para acessar os pedidos.',true);
    state.view='pedidos';state.activeEvent=null;render();
    const card=document.querySelector('[data-order-id="'+id+'"]');
    card?.scrollIntoView({block:'center',behavior:'smooth'});
    card?.querySelector('details.uo-details')?.setAttribute('open','');
    return;
  }
  if(action==='event-batch-dispatch'){
    const b=state.eventPickBatches.find(x=>x.id===id);
    if(!b||b.status!=='separado'||!isManager()||!hasPermission('orders.dispatch'))return;
    if(!window.confirm('Confirmar saída física do lote '+b.sequence+'? O estoque central será baixado agora.'))return;
    return exec(async()=>assertOk(await db.rpc('dispatch_event_pick_batch',{p_batch:id})),
      'Lote enviado. Saída física registrada e reservas consumidas.');
  }
  if(action==='event-batch-scan'){
    return scanEAN(code=>{
      const form=document.querySelector('.modalback form[data-form="event-batch-picking"]');
      if(!form)return;
      const matches=state.items.filter(p=>p.active&&(p.ean===code||p.sku===code));
      if(matches.length!==1)return toast('EAN/SKU não encontrado ou ambíguo.',true);
      const input=[...form.querySelectorAll('[data-pick-qty]')].find(el=>el.dataset.id===matches[0].id);
      if(!input)return toast('Produto não consta deste lote.',true);
      const current=Number(input.value||0),maximum=Number(input.dataset.expected);
      if(current>=maximum)return toast('Este tamanho já está totalmente conferido.',true);
      input.value=String(current+1);updateUnifiedPickingTotal(form);
      toast('Conferido '+(current+1)+' de '+maximum+' unidades.');
    });
  }
  if(action==='event-plan')return eventBatchModal(state.activeEvent);
  if(action==='event-supplement')return eventBatchModal(state.activeEvent);
  if(action==='event-settle')return eventSettlementModal();
  if(action==='event-print')return printEventA4(state.activeEvent);
  if(action==='event-dispatch'){
    const e=eventById(state.activeEvent);
    if(!e||e.status!=='rascunho'||!hasPermission('events.separate'))return;
    if(!window.confirm('Confirmar envio físico da lista separada? Após o envio, ajustes serão movimentações adicionais auditadas.'))return;
    return exec(async()=>assertOk(await db.rpc('dispatch_event_pick_plan',{p_event:e.id})),
      'Mercadorias enviadas. A loja temporária está ativa.');
  }
  if(action==='event-settlement-save-finish')return submitEventSettlement(target.closest('form'),true);
  if(action==='damage-resolve')return resolveDamageModal(id);
  if(action==='event-delete'){
   const e=eventById(id);
   if(!e||e.deleted_at||!isManager()||!hasPermission('events.close')||!hasPermission('events.return'))return;
   const remaining=state.balances.filter(b=>b.event_id===id).reduce((sum,b)=>sum+Number(b.quantity||0),0);
   formModal('Excluir loja temporária · '+e.name,
    '<p class="help">Esta operação arquiva a loja e cancela lotes ainda não enviados. As '+remaining+
    ' unidade(s) ainda no local serão devolvidas automaticamente à central. Vendas e baixas anteriores não serão revertidas. O histórico ficará preservado.</p>'+
    '<label class="field"><span>Código de autorização</span><input name="delete_code" type="password" autocomplete="off" required minlength="4" maxlength="80" placeholder="Informe o código de exclusão"></label>',
    'event-delete-confirm','Excluir e devolver estoque');
   const form=document.querySelector('.modalback form[data-form="event-delete-confirm"]');
   if(form)form.dataset.eventId=id;
   return;
  }
  if(action==='store-hub-admin'){
   if(!hasPermission('stores.manage'))return;
   state.view='lojas-admin';state.ordersContext=null;render();window.scrollTo(0,0);return;
  }
  if(action==='store-hub-back'){
   state.ordersContext=null;state.view='lojas';render();window.scrollTo(0,0);return;
  }
  if(action==='store-hub-reset'){
   if(!permittedView('pedidos'))return;
   state.ordersContext=null;state.view='pedidos';render();window.scrollTo(0,0);return;
  }
  if(action==='store-hub-orders'||action==='store-hub-open-order'){
   if(!permittedView('pedidos'))return;
   const type=target.dataset.locationType,location=target.dataset.locationId;
   if(!['central','store','event'].includes(type))return;
   const store=state.stores.find(s=>s.id===location);
   const ev=eventById(location),portal=isFranchisePortal();
   const scopeAllowed=type==='central'?!portal:
    type==='store'?Boolean(store&&(hasPermission('stores.manage')||assignedStore(store.id))):
    Boolean(ev&&!ev.deleted_at&&!portal&&
      (hasPermission('events.read')||hasPermission('events.manage')||Boolean(memberRole(ev.id))));
   if(!scopeAllowed)return toast('Sem autorização para consultar esta unidade.',true);
   const mode=action==='store-hub-open-order'?'all':target.dataset.mode;
   const context={type,id:location,mode:['all','pending','history'].includes(mode)?mode:'all'};
   const focus=action==='store-hub-open-order'?target.dataset.orderId:null;
   if(focus&&!locationOrders(unifiedOrderRecords(),context).some(o=>o.id===focus))return;
   state.ordersContext=context;state.view='pedidos';state.search='';state.page=0;
   render();window.scrollTo(0,0);
   if(focus)requestAnimationFrame(()=>{
    const card=[...document.querySelectorAll('[data-order-card]')].find(el=>el.dataset.orderId===focus);
    if(!card)return;
    const details=card.querySelector('details.uo-details');
    if(details)details.open=true;
    card.scrollIntoView({block:'center',behavior:'smooth'});
   });
   return;
  }
  if(action==='event-cover-edit')return eventCoverModal(id);
  if(action==='event-new')return eventModal();
  if(action==='event-detail'){state.view='eventos';state.activeEvent=id;render();window.scrollTo(0,0);return;}
  if(action==='back-events'){state.activeEvent=null;state.eventWorkflow=null;state.view='lojas';render();return;}
  if(action==='event-sale')return toast('O CDSB não registra vendas dos eventos.',true);
  if(action==='event-loss')return toast('Informe avarias e diferenças somente na conferência.',true);
  if(action==='event-transfer')return eventBatchModal(state.activeEvent);
  // Registro de venda foi retirado do gerenciador: só há separação, devolução e baixa final.
  if(action==='event-return'){
    if(!canReturn(state.activeEvent)||eventStatus(state.activeEvent)!=='ativo')return;
    state.eventWorkflow='return';state.eventReturnQuery='';render();window.scrollTo(0,0);return;
  }
  if(action==='event-return-back'){state.eventWorkflow=null;state.eventReturnQuery='';render();return;}
  if(action==='event-return-scan'){
    try {return scanEAN(code=>{
    state.eventReturnQuery=code;
    const input=document.querySelector('#event-return-search');
    if(input){input.value=code;filterWorkflowRows(input.closest('.main'),code,'return');}
    const form=[...document.querySelectorAll('.return-variant')].find(el=>
      !el.hidden&&el.dataset.search?.split(' ').includes(code));
    if(form)form.querySelector('[name="quantity"]')?.focus();
    else toast('EAN não está entre os produtos pendentes neste evento.',true);
    });}catch(error){fail(error);return;}
  }
  if(action==='return-all'){
    const form=target.closest('form');
    const quantity=form?.querySelector('[name="quantity"]');
    if(quantity){quantity.value=quantity.max;quantity.focus();}
    return;
  }
  if(action==='member-add')return memberModal(id);
  if(action==='category-new')return categoryModal();
  if(action==='category-child')return categoryModal(id);
  if(action==='category-edit')return categoryModal(null,false,state.categories.find(c=>c.id===id));
  if(action==='category-delete'){
    const cat=state.categories.find(c=>c.id===id);
    if(!hasPermission('categories.manage')||!cat)return;
    const categoryIds=new Set(state.categories.filter(c=>
      c.id===id||categoryChain(c.id).some(ancestor=>ancestor.id===id)
    ).map(c=>c.id));
    const linkedModels=new Set(state.apparelModels.filter(m=>categoryIds.has(m.category_id)).map(m=>m.id));
    const affected=state.items.filter(p=>categoryIds.has(p.category_id)||
      (p.apparel_model_id&&linkedModels.has(p.apparel_model_id)));
    const active=affected.filter(p=>p.active).length;
    if(active){
      toast('Há '+active+' produto(s) ativo(s) nesta categoria ou subcategorias. Desative ou reclassifique esses produtos antes de excluir.',true);
      return;
    }
    const archived=affected.filter(p=>!p.active).length;
    const message='Excluir a categoria "'+cat.name+'" e todas as suas subcategorias?'+
      (archived?'\n\nHá '+archived+' produto(s) desativado(s) vinculados. Suas movimentações serão preservadas e a classificação antiga ficará salva no histórico.':'')+
      '\n\nEsta exclusão não poderá ser desfeita.';
    if(!window.confirm(message))return;
    return exec(async()=>{
      assertOk(await db.rpc('remove_category_branch',{p_category_id:id}));
      for(const c of categoryIds)state.catalogExpanded.delete(c);
    },'Categoria e subcategorias excluídas. Histórico preservado.');
  }
  if(action==='tag-new')return tagModal();
  if(action==='tag-delete'){
    const tag=state.tags.find(t=>t.id===id);
    if(!hasPermission('tags.manage')||!tag||!window.confirm('Excluir a tag "'+tag.name+'"?\nEla também será desvinculada de todos os produtos, sem afetar estoques.'))return;
    return exec(async()=>assertOk(await db.rpc('remove_tag_safely',{p_tag_id:id})),'Tag excluída e removida dos produtos.');
  }
  if(action==='quick-category')return categoryModal(chosenCategory(target.closest('form')),true);
  if(action==='quick-tag')return tagModal(true);
  if(action==='take-photo'||action==='choose-photo'){
    const form=target.closest('form');
    form?.querySelector(action==='take-photo'?'input[name="camera_file"]':'input[name="gallery_file"]')?.click();return;
  }
  if(action==='order-retry'){
    const kind=target.dataset.kind,order=unifiedOrderById(kind,id);
    if(!order||!hasPermission('orders.separate')||isFranchisePortal())return;
    if(kind==='loja'&&!assignedStore(order.raw.from_store_id))return;
    return exec(async()=>assertOk(await db.rpc('retry_unified_order_reservation',{
      p_kind:kind,p_order:id
    })),'Disponibilidade reavaliada. Consulte as faltas no pedido.');
  }
  if(action==='order-shortage-adjust')return unifiedShortageModal(target.dataset.kind,id);
  if(action==='order-print-a4')return printUnifiedOrder(target.dataset.kind,id);
  if(action==='avulso-pick')return avulsoPickingModal(id);
  if(action==='avulso-dispatch'){
    const order=unifiedOrderById('avulso',id);
    if(!order||order.status!=='separado'||!hasPermission('orders.separate'))return;
    if(!window.confirm('Confirmar entrega/saída física de '+order.total+' unidade(s)? A reserva será consumida e o estoque físico diminuirá agora.'))return;
    return exec(async()=>assertOk(await db.rpc('dispatch_avulso_order',{p_order:id})),
      'Pedido entregue, reserva consumida e baixa física registrada.');
  }
  if(action==='avulso-cancel'){
    const order=unifiedOrderById('avulso',id);
    if(!order||!hasPermission('orders.cancel')||!window.confirm('Cancelar este pedido e liberar suas reservas?'))return;
    return exec(async()=>assertOk(await db.rpc('cancel_avulso_order',{p_order:id})),
      'Pedido cancelado e estoque liberado.');
  }
  if(action==='order-scan-ean'){
    return scanEAN(code=>{
      const form=document.querySelector('.modalback form[data-form="avulso-picking"]');
      if(!form)return;
      const matches=state.items.filter(p=>p.active&&(p.ean===code||p.sku===code));
      if(matches.length!==1)return toast('EAN/SKU não encontrado ou ambíguo.',true);
      const input=[...form.querySelectorAll('[data-pick-qty]')].find(el=>el.dataset.id===matches[0].id);
      if(!input)return toast('Produto não pertence ao pedido.',true);
      const counted=Number(input.value||0),max=Number(input.dataset.expected);
      if(counted>=max)return toast('Todas as unidades deste SKU já foram conferidas.',true);
      input.value=String(counted+1);
      updateUnifiedPickingTotal(form);
      toast('EAN conferido: '+(counted+1)+' / '+max);
    });
  }
  if(action==='unified-order-new'){
    const canAv=hasPermission('orders.internal')&&!isFranchisePortal();
    const canStore=hasPermission('orders.central')||hasPermission('orders.franchise');
    if(!canAv&&!canStore)return;
    if(canAv&&canStore)return formModal('Criar pedido',
      selectField('Destino / tipo de pedido','kind',[
       ['avulso','Cliente ou pedido avulso'],['loja','Filial ou franquia']
      ])+'<p class="help">Ambos reservam automaticamente o estoque disponível. Você poderá conferir e concluir a separação na fila de Pedidos.</p>',
      'unified-order-type','Continuar');
    if(canAv)return openAvulsoOrderModal();
    return storeOrderModal();
  }
  if(action==='order-new')return openAvulsoOrderModal();
  if(action==='order-assign-event'){
    if(!hasPermission('orders.assign'))return;return orderEventModal(id);
  }
  if(action==='customer-link-new'){
    if(!hasPermission('catalog.manage'))return;
    return formModal('Criar acesso para cliente',
      '<div class="formgrid">'+field('Identificação do acesso','label','text','','required minlength="2" maxlength="100" placeholder="Ex.: Cliente Maria ou Feira de Outubro"')+'</div>'+
      '<p class="help">Gera um link de catálogo, válido por 30 dias, sem acesso ao estoque nem ao sistema administrativo. O cliente informa nome e telefone ao fazer o pedido.</p>',
      'customer-link-create','Gerar acesso');
  }
  if(action==='customer-link-revoke'){
    if(!hasPermission('catalog.manage')||!window.confirm('Revogar este acesso? O cliente não conseguirá abrir o catálogo nem enviar novos pedidos por esse link.'))return;
    return exec(async()=>assertOk(await db.rpc('revoke_customer_catalog_access',{p_id:id})),'Acesso revogado.');
  }
  if(action==='customer-link-close'){
    document.querySelector('.share-product-modal')?.remove();return;
  }
  if(action==='customer-link-copy'){
    const url=target.closest('.share-product-modal')?.dataset.link;if(!url)return;
    try{await navigator.clipboard.writeText(url);toast('Link de cliente copiado.');}
    catch{window.prompt('Copie o link:',url);}return;
  }
  if(action==='customer-link-whatsapp'){
    const box=target.closest('.share-product-modal');if(!box)return;
    const url=box.dataset.link;
    const wa='https://wa.me/?text='+encodeURIComponent('Ame+ Store — acesso ao catálogo para montar pedidos:\n'+url+
      '\nEste catálogo não informa saldos de estoque.');
    const w=window.open(wa,'_blank','noopener,noreferrer');if(!w)window.location.assign(wa);return;
  }
  if(action==='store-order-new')return storeOrderModal();
  if(action==='store-order-separate')return storePickingModal(id);
  if(action==='store-order-adjust')return orderQuantityModal(id,'adjust');
  if(action==='store-order-receive')return orderQuantityModal(id,'receiving');
  if(action==='store-pick-scan'){
    return scanEAN(code=>{
      const form=document.querySelector('.modalback form[data-form="store-order-picking"]');
      if(!form)return;
      const matches=state.items.filter(p=>p.active&&(p.ean===code||p.sku===code));
      if(matches.length!==1)return toast('EAN/SKU não localizado ou ambíguo.',true);
      const input=[...form.querySelectorAll('[data-pick-qty]')].find(x=>x.dataset.id===matches[0].id);
      if(!input)return toast('Produto não pertence ao pedido.',true);
      const qty=Number(input.value||0),max=Number(input.dataset.expected);
      if(qty>=max)return toast('Quantidade do SKU já conferida.',true);
      input.value=String(qty+1);
      input.closest('.store-picking-line')?.classList.toggle('is-picked',qty+1===max);
      toast('Conferido: '+matches[0].name+' ('+(qty+1)+' / '+max+')');
    });
  }
  if(['store-order-approve','store-order-dispatch','store-order-cancel'].includes(action)){
    const order=state.storeOrders.find(x=>x.id===id);if(!order)return;
    const labels={'store-order-approve':['approve_store_order','Aprovado; unidades reservadas.','Aprovar e reservar as quantidades deste pedido?'],
      'store-order-cancel':['cancel_store_order','Pedido cancelado e reservas liberadas.','Cancelar pedido e liberar as reservas?']};
    if(action==='store-order-dispatch'){
      if(!hasPermission('orders.dispatch')||!assignedStore(order.from_store_id))return;
      if(!window.confirm('Confirmar saída física deste pedido da central? A quantidade será baixada agora.'))return;
      const ref=window.prompt('Referência do outro sistema (opcional):','');
      if(ref===null)return;
      return exec(async()=>assertOk(await db.rpc('dispatch_store_order',{
        p_order:id,p_external_reference:ref.trim()||null
      })),'Saída física registrada e reserva consumida.');
    }
    const [rpc,msg,confirmation]=labels[action];
    if(!window.confirm(confirmation))return;
    await exec(async()=>assertOk(await db.rpc(rpc,{p_order:id})),msg);return;
  }
  if(action==='event-inventory'){switchView('inventario');return inventoryStartModal();}
  if(action==='inventory-scan'){
    return scanEAN(code=>{
      const p=state.items.find(x=>String(x.ean||'').trim()===String(code).trim());
      const modal=[...document.querySelectorAll('.modalback')].at(-1);
      const el=p?[...modal?.querySelectorAll('[data-inventory-qty]')||[]].find(x=>x.dataset.id===p.id):null;
      if(!el)return toast('EAN não pertence aos SKUs deste inventário.',true);
      el.scrollIntoView({block:'center',behavior:'smooth'});el.focus();el.select();
      toast('SKU localizado. Informe a quantidade física.');
    });
  }
  if(action==='inventory-new')return inventoryStartModal();
  if(action==='inventory-open')return inventorySessionModal(id);
  if(action==='inventory-submit'){
    if(!window.confirm('Enviar inventário completo para revisão?'))return;
    return exec(async()=>assertOk(await db.rpc('inventory_submit',{p_session:id})),'Inventário enviado para revisão.');
  }
  if(action==='inventory-reject'){
    if(!window.confirm('Rejeitar e cancelar este inventário?'))return;
    return exec(async()=>assertOk(await db.rpc('inventory_finalize',{p_session:id,p_approve:false,p_note:'Rejeitado'})),'Inventário rejeitado.');
  }
  if(action==='branch-return-new')return branchReturnModal(id);
  if(action==='branch-return-receive'){
    if(!hasPermission('stock.entry'))return;
    const item=state.branchReturns.find(x=>x.id===id&&x.status==='em_transito');
    if(!item)return;
    const received=window.prompt('Quantidade física conferida na central (esperado '+item.quantity+'):',String(item.quantity));
    if(received===null)return;
    if(!Number.isInteger(Number(received))||Number(received)<0)return toast('Quantidade inválida.',true);
    if(!window.confirm('Confirmar entrada física na central?'))return;
    return exec(async()=>assertOk(await db.rpc('receive_branch_return',{
      p_return:id,p_quantity:Number(received)
    })),'Devolução recebida e registrada na central.');
  }
  if(action==='branch-stock-new')return branchStockModal(id);
  if(action==='store-new')return storeModal();
  if(action==='store-edit')return storeModal(state.stores.find(x=>x.id===id));
  if(action==='store-toggle'){
    if(!hasPermission('stores.manage'))return;
    const store=state.stores.find(x=>x.id===id);if(!store)return;
    await exec(async()=>assertOk(await db.from('stores').update({active:!store.active}).eq('id',id)),'Loja atualizada.');return;
  }
  if(action==='store-delete'){
    if(!hasPermission('stores.manage')||!window.confirm('Excluir esta loja sem histórico?'))return;
    await exec(async()=>assertOk(await db.from('stores').delete().eq('id',id)),'Loja excluída.');return;
  }
  if(action==='user-new')return userModal();
  if(action==='user-role')return userRoleModal(id);
  if(action==='search-scan'){
    try{return scanEAN(code=>{
      searchAndManageSku(code,true);
      toast(state.items.some(p=>p.active&&p.ean===code)?
        'EAN encontrado.':'EAN não localizado; confira o cadastro.');
    });}catch(error){fail(error);return;}
  }
  if(action==='form-scan')return scanInto('input[name="'+scanTarget+'"]',target.closest('form'));
  if(action==='product-load-more'){state.page++;render();return;}
  if(action==='product-show-less'){state.page=0;render();return;}
  if(action==='export-csv')return exportCsv();
  if(action==='event-activate'){
    if(!window.confirm('Ativar este evento e permitir transferências?'))return;
    await exec(async()=>assertOk(await db.rpc('activate_event',{p_event_id:id})),'Evento ativado.');
  }
  if(action==='event-close'){
    const remaining=state.balances.filter(x=>x.event_id===id).reduce((s,b)=>s+b.quantity,0);
    if(remaining>0)return toast('Há '+remaining+' unidade(s) ainda na loja temporária. Registre venda/baixa justificada ou devolva tudo antes de encerrar.',true);
    if(!window.confirm('Encerrar esta loja temporária? O saldo está conciliado em zero.'))return;
    await exec(async()=>assertOk(await db.rpc('close_event',{p_event_id:id})),'Loja temporária encerrada com saldo conciliado.');
  }
  if(action==='member-remove'){
    if(!window.confirm('Remover o acesso desta pessoa a este evento?'))return;
    await exec(async()=>assertOk(await db.from('event_members').delete().eq('event_id',eventId).eq('user_id',user)),'Acesso removido.');
  }
  if(action==='user-toggle'){
    const u=state.users.find(x=>x.id===id);
    if(!u||!window.confirm((u.active?'Bloquear':'Reativar')+' o usuário '+u.full_name+'?'))return;
    await exec(async()=>assertOk(await db.from('staff_profiles').update({active:!u.active}).eq('id',id)),'Permissão atualizada.');
  }
}
async function handleSubmit(event){
  const form=event.target.closest('form[data-form]');if(!form)return;
  event.preventDefault();if(state.loading)return;
  const values=Object.fromEntries(new FormData(form).entries());
  const type=form.dataset.form;
  if(type==='login-password'){
    state.loading=true;
    try{
      const username=String(values.username||'').trim();
      const response=await db.functions.invoke('username-login',{body:{username,password:String(values.password||'')}});
      if(response.error||!response.data?.access_token)throw new Error('Usuário ou senha inválidos.');
      assertOk(await db.auth.setSession({
        access_token:response.data.access_token,refresh_token:response.data.refresh_token
      }));
      await loadProfile();
    }catch(error){fail(error);}finally{state.loading=false;}
    return;
  }
  if(type==='login-link'){
    state.loading=true;
    try{
      const email=String(values.email||'').trim().toLowerCase();
      assertOk(await db.auth.signInWithOtp({email,options:{
        shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname
      }}));
      state.loginNotice='Confira seu email para acessar sua conta antiga e definir uma senha.';
      render();
    }catch(error){fail(error);}finally{state.loading=false;}
    return;
  }

  if(type==='admin-bootstrap'){
    const code=String(values.activation_code||'').trim(),name=String(values.full_name||'').trim();
    if(!code||name.length<2){toast('Informe nome e código de ativação.',true);return;}
    await exec(async()=>{
      assertOk(await db.rpc('claim_initial_admin',{p_activation_code:code,p_name:name}));
      state.profile={id:state.user.id,full_name:name,email:state.user.email,role:'admin',active:true};
    },'Administrador ativado com sucesso.');
    return;
  }
  if(type==='product-new'||type==='product-edit'){
    if(!canRegisterProducts())return;
    if(type==='product-new'&&form.querySelector('[data-use-sizes]')?.checked){
      state.loading=true;
      try{await saveSizedProduct(form,{
        db,assertOk,state,categoryChain,chosenCategory,productTagValues,closeTopModal,loadData,toast,saveGallery:savePhotoGallery
      });}catch(error){fail(error);}finally{state.loading=false;}
      return;
    }
    const editing=type==='product-edit',id=form.dataset.id;
    const ean=String(values.ean||'').replace(/[\s-]/g,'');
    if(ean && !/^\d{8,14}$/.test(ean)){toast('O EAN deve conter de 8 a 14 dígitos.',true);return;}
    const payload={
      name:String(values.name).trim(),sku:String(values.sku||'').trim()||null,ean:ean||null,
      tags:productTagValues(form),
      category_id:chosenCategory(form),
      gondola:String(values.gondola||'').trim()||null,
      prateleira:String(values.prateleira||'').trim()||null
    };
    if(editing)payload.active=values.active==='true';
    else payload.created_by=state.user.id;
    let photoWarning=false;
    await exec(async()=>{
      let productId=id;
      if(editing)assertOk(await db.from('products').update(payload).eq('id',id));
      else {
        const initial=Number(values.initial_quantity||0);
        if(!Number.isInteger(initial)||initial<0||initial>1000000)
          throw new Error('Estoque inicial inválido. Informe de 0 a 1.000.000 unidades.');
        // O produto e a movimentação inicial são salvos juntos no Supabase.
        // Se falhar alguma etapa, o banco desfaz todo o cadastro.
        productId=assertOk(await db.rpc('create_single_product_with_stock',{
          p_name:payload.name,p_sku:payload.sku,p_ean:payload.ean,
          p_category_id:payload.category_id,p_tags:payload.tags,
          p_gondola:payload.gondola,p_prateleira:payload.prateleira,
          p_initial_quantity:initial
        }));
      }
      if(galleryHasChanges(form)){
        try{
          const existing=editing?product(id):null;
          await savePhotoGallery(form,{db,assertOk,modelId:existing?.apparel_model_id||null,
            productId:existing?.apparel_model_id?null:productId});
        }catch(error){
          // Falha de foto não significa falha de cadastro: evita que o usuário
          // envie o mesmo produto novamente e encontre SKU/EAN duplicado.
          photoWarning=true;
          console.error('Produto salvo; foto pendente',error);
        }
      }
    },()=>photoWarning?
      (editing?'Produto atualizado; foto não enviada.':'Produto cadastrado; foto pendente de envio.'):
      (editing?'Produto atualizado.':'Produto cadastrado.'));
    return;
  }
  if(type==='apparel-create'){
    if(!canRegisterProducts())return;
    state.loading=true;
    try{
      await submitApparel(form,{
        state,db,assertOk,chosenCategory,productTagValues,loadData,closeTopModal,toast,saveGallery:savePhotoGallery
      });
    }catch(error){fail(error);}
    finally{state.loading=false;}
    return;
  }
  if(type==='apparel-edit-variant'){
    if(!canRegisterProducts())return;
    state.loading=true;
    try{await saveApparelVariant(form,{db,assertOk,loadData,closeTopModal,toast});}
    catch(error){fail(error);}finally{state.loading=false;}
    return;
  }
  if(type==='apparel-photo'){
    if(!canRegisterProducts())return;
    state.loading=true;
    try{await saveApparelPhoto(form,{db,assertOk,loadData,closeTopModal,toast,saveGallery:savePhotoGallery});}
    catch(error){fail(error);}finally{state.loading=false;}
    return;
  }
  if(type==='extra-sizes'){
    if(!canRegisterProducts())return;
    const modelId=form.dataset.modelId;
    const existing=state.items.filter(p=>p.apparel_model_id===modelId);
    let payload;
    try{payload=collectExtraSizes(form,existing);}catch(error){fail(error);return;}
    await exec(async()=>assertOk(await db.rpc('add_apparel_variants',{
      p_model_id:modelId,p_variants:payload
    })),'Novos tamanhos adicionados ao mesmo produto.');
    return;
  }
  if(type==='event-batch'){
    if(!hasPermission('events.separate')||eventStatus(form.dataset.event)!=='ativo')return;
    let items;
    try{items=collectEventBatch(form);}catch(error){fail(error);return;}
    const sum=items.reduce((acc,item)=>acc+item.quantity,0);
    if(!window.confirm('Separar '+sum+' unidade(s) em '+items.length+
      ' variação(ões) para o evento?\nOs saldos sairão da loja e ficarão no evento.'))return;
    await exec(async()=>assertOk(await db.rpc('transfer_event_batch',{
      p_event_id:form.dataset.event,p_items:items,p_note:form.elements.namedItem('note')?.value||null
    })),'Separação concluída. Os produtos foram transferidos para o evento.');
    return;
  }
  if(type==='event-return-quick'){
    const eid=state.activeEvent;
    if(!canReturn(eid)||eventStatus(eid)!=='ativo')return;
    const id=form.dataset.id,p=product(id);
    const qty=Number(values.quantity),maximum=Number(form.querySelector('[name="quantity"]')?.max);
    if(!p||!Number.isInteger(qty)||qty<1||qty>maximum){
      toast('Quantidade inválida ou maior que o disponível no evento.',true);return;
    }
    if(!window.confirm('Devolver '+qty+' unidade(s) de '+p.name+' à loja?'))return;
    state.loading=true;
    try{
      assertOk(await db.rpc('move_stock',{
        p_product_id:id,p_event_id:eid,p_action:'devolucao',p_quantity:qty,p_note:'Devolução rápida por contagem/EAN'
      }));
      await loadData();
      state.eventReturnQuery='';
      toast(qty+' unidade(s) devolvida(s) ao estoque da loja. Pode ler o próximo EAN.');
    }catch(error){fail(error);await loadData().catch(()=>{});}
    finally{state.loading=false;}
    return;
  }
  if(type==='quick-group-count'){
    if(!canQuickBalance())return;
    return saveQuickGroupCounts(form);
  }
  if(type==='quick-count'){
    if(!canQuickBalance())return;
    const counted=Number(values.counted),expected=Number(values.expected);
    if(values.counted===''||!Number.isInteger(counted)||counted<0||counted>1000000||
       !Number.isInteger(expected)||expected<0){toast('Informe a quantidade contada.',true);return;}
    const id=form.dataset.countProduct,p=product(id);
    if(!p)return;
    const delta=counted-expected;
    if(delta!==0&&!window.confirm('Confirmar balanço de '+p.name+'?\nSistema: '+expected+
      ' · Contado: '+counted+'\nDiferença: '+(delta>0?'+':'')+delta+' unidade(s).'))return;
    state.loading=true;
    try{
      assertOk(await db.rpc('quick_stock_count',{
        p_product_id:id,p_expected:expected,p_counted:counted,p_note:'Contagem física'
      }));
      await loadData();
      toast(delta===0?'Contagem conferida, sem diferença.':'Balanço registrado e estoque atualizado.');
    }catch(error){fail(error);await loadData().catch(()=>{});}
    finally{state.loading=false;}
    return;
  }
  if(type==='sku-manage')return saveSkuManager(form);
  if(type==='stock-single-movement'){
    const id=String(values.product_id||''),p=product(id);
    const kind=String(values.operation_kind||'');
    const qty=Number(values.quantity),expected=Number(form.dataset.expected);
    const requestId=form.dataset.requestId;
    const note=String(values.note||'').trim();
    const details=String(values.details||'').trim();
    const recipient=String(values.recipient||'').trim();
    const reason=String(values.reason||'');
    if(!p?.active||!id||!requestId||!['entrada','saida'].includes(kind))
      return toast('Escolha uma variação ativa e uma operação.',true);
    if(!hasPermission(kind==='entrada'?'stock.entry':'stock.exit')||isFranchisePortal())return;
    if(!Number.isInteger(qty)||qty<1||qty>1000000||
       !Number.isInteger(expected)||expected<0)
      return toast('Informe uma quantidade válida e atualize o saldo.',true);
    if(kind==='entrada'&&note.length>400)
      return toast('Identificação da remessa muito longa.',true);
    if(kind==='saida'){
      if(qty>qtyAvailable(id))return toast('Estoque livre insuficiente. Unidades reservadas não podem sair.',true);
      if(!['avaria','extravio','diretoria','doacao','outro'].includes(reason))
        return toast('Escolha o motivo da baixa.',true);
      if(details.length<5||details.length>250)
        return toast('Descreva a saída em 5 a 250 caracteres.',true);
      if(['diretoria','doacao'].includes(reason)&&(recipient.length<2||recipient.length>120))
        return toast('Identifique quem recebeu o produto.',true);
    }
    const action=kind==='entrada'?'entrada':reason==='avaria'?'envio para análise':'baixa definitiva';
    if(!window.confirm('Confirmar '+action+' de '+qty+' unidade(s) de '+p.name+'?'))return;
    return exec(async()=>{
      if(kind==='entrada'){
        assertOk(await db.rpc('stock_operation_batch',{
          p_operation:'entrada',p_items:[{product_id:id,quantity:qty,expected}],
          p_destination_id:null,p_note:note||null,p_request_id:requestId
        }));
      }else if(reason==='avaria'){
        assertOk(await db.rpc('quarantine_central_stock',{
          p_product:id,p_quantity:qty,p_expected:expected,p_note:details,p_request:requestId
        }));
      }else{
        assertOk(await db.rpc('record_stock_exception',{
          p_product_id:id,p_quantity:qty,p_expected:expected,
          p_reason:reason,p_details:details,
          p_recipient:['diretoria','doacao'].includes(reason)?recipient||null:null,
          p_request_id:requestId
        }));
      }
    },kind==='entrada'?'Entrada de fornecedor registrada.':
      reason==='avaria'?'Avaria em análise: unidade fora do estoque disponível.':'Baixa excepcional registrada com motivo e justificativa.');
  }
  if(type==='stock-operation'){
    return saveStockOperation(form);
  }
  if(type==='stock-destination-save'){
    if(!hasPermission('stock.destinations'))return;
    const name=String(values.name||'').trim();
    if(name.length<2)return toast('Informe o nome do destino.',true);
    return exec(async()=>{
      const saved=assertOk(await db.rpc('save_stock_destination',{
        p_name:name,p_description:String(values.description||'').trim()||null,p_id:form.dataset.id||null
      }));
      state.stockSelectedDestination=saved;
    },'Destino salvo e disponível nas próximas saídas.');
  }
  if(type==='stock-choose-direction'){
    if(!hasPermission(values.operation_kind==='entrada'?'stock.entry':'stock.exit'))return;
    const kind=values.operation_kind;
    if(!['entrada','saida'].includes(kind))return toast('Escolha Entrada ou Saída.',true);
    const id=form.dataset.id;
    closeTopModal();stockModal(id);
    return;
  }
  if(type==='unified-order-type'){
    if(values.kind==='avulso')return openAvulsoOrderModal();
    if(values.kind==='loja')return storeOrderModal();
    return toast('Escolha um tipo de pedido.',true);
  }
  if(type==='order-create'){
    if(!hasPermission('orders.internal'))return;
    let items;
    try{items=collectInternalOrder(form);}catch(error){toast(error.message,true);return;}
    const name=String(values.customer_name||'').trim(),phone=String(values.customer_phone||'').trim();
    if(name.length<2||phone.replace(/\D/g,'').length<10){toast('Informe nome e telefone com DDD.',true);return;}
    await exec(async()=>assertOk(await db.rpc('create_internal_avulso_order',{
      p_name:name,p_phone:phone,p_items:items,
      p_event_id:values.event_id||null,p_request_id:crypto.randomUUID()
    })),'Pedido registrado e reserva automática realizada. O físico não foi alterado.');
    return;
  }
  if(type==='order-associate'){
    if(!hasPermission('orders.assign'))return;
    await exec(async()=>assertOk(await db.rpc('assign_avulso_order_event',{
      p_order_id:form.dataset.id,p_event_id:values.event_id||null
    })),'Vínculo de evento atualizado; estoque inalterado.');
    return;
  }
  if(type==='customer-link-create'){
    if(!hasPermission('catalog.manage'))return;
    const label=String(values.label||'').trim();if(label.length<2||label.length>100)return toast('Informe um nome para o acesso.',true);
    state.loading=true;
    try{
      const token=assertOk(await db.rpc('create_customer_catalog_access',{p_label:label}));
      if(!/^[0-9a-f]{64}$/.test(token))throw Error('Token de acesso não foi criado corretamente.');
      const url=new URL('./cliente.html',location.href);url.search='';url.hash='t='+token;
      closeTopModal();
      await loadData();
      customerAccessLinkModal(label,url.toString());
    }catch(error){fail(error);}
    finally{state.loading=false;}
    return;
  }
  if(type==='event-batch-write'){
    const eid=form.dataset.event,batchId=form.dataset.batch;
    if(!((isManager()&&hasPermission('events.separate'))||
      (!batchId&&hasPermission('events.request')&&Boolean(memberRole(eid)))))return;
    let items;try{items=collectEventPlan(form);}catch(error){return toast(error.message,true);}
    const models=selectedEventModels(items,state.items);
    if(!items.length||models>10)return toast('Selecione entre 1 e 10 modelos diferentes por lote. Variações não contam como modelos adicionais.',true);
    const note=String(values.note||'').trim();
    if(note.length>180)return toast('Observação longa demais.',true);
    if(batchId){
      if(!window.confirm('Revisar lote? Quantidades já conferidas serão zeradas para uma nova separação.'))return;
      return exec(async()=>assertOk(await db.rpc('revise_event_pick_batch',{
        p_batch:batchId,p_items:items,p_note:note||null
      })),'Lote revisado e reservas recalculadas. A separação precisará ser conferida novamente.');
    }
    return exec(async()=>assertOk(await db.rpc('create_event_pick_batch',{
      p_event:eid,p_items:items,p_note:note||null
    })),'Lote criado! Aparecerá em Pedidos, com reserva automática.');
  }
  if(type==='event-batch-picking')return saveEventBatchPicking(form,false);
  if(type==='event-batch-cancel'){
    if(!isManager()||!hasPermission('events.separate'))return;
    const reason=String(values.reason||'').trim();
    if(reason.length<5||reason.length>250)return toast('Justificativa de 5 a 250 caracteres obrigatória.',true);
    if(!window.confirm('Cancelar este lote, liberando as reservas ainda ativas?'))return;
    return exec(async()=>assertOk(await db.rpc('cancel_event_pick_batch',{
      p_batch:form.dataset.batch,p_reason:reason
    })),'Lote cancelado e estoque reservado liberado.');
  }
  if(type==='event-plan-save'||type==='event-supplement-send'){
    const eid=form.dataset.event,e=eventById(eid);
    if(!e)return;
    let items;
    try{items=collectEventPlan(form);}catch(error){return toast(error.message,true);}
    if(type==='event-plan-save'){
      if(!items.length)return toast('Inclua ao menos um SKU na separação.',true);
      return exec(async()=>assertOk(await db.rpc('save_event_pick_plan',{
       p_event:eid,p_items:items
      })),'Lista de separação salva. Imprima A4 e confirme quando o material estiver pronto.');
    }
    if(!items.length)return toast('Escolha ao menos um SKU para complemento.',true);
    const note=String(values.reason||'').trim();
    if(note.length<5)return toast('Justifique o envio adicional.',true);
    if(!window.confirm('Enviar fisicamente '+items.reduce((n,x)=>n+x.quantity,0)+' unidades adicionais?'))return;
    return exec(async()=>assertOk(await db.rpc('event_send_additional',{
      p_event:eid,p_items:items,p_note:note
    })),'Envio adicional registrado e auditado.');
  }
  if(type==='event-settlement-save')return submitEventSettlement(form,false);
  if(type==='damage-resolution'){
    if(!permittedView('avarias')||!isManager())return;
    const damage=state.damages.find(x=>x.id===form.dataset.damage);
    const quantity=Number(values.quantity),reason=String(values.note||'').trim();
    if(!damage||!Number.isInteger(quantity)||quantity<1||quantity>damage.remaining||
      reason.length<5)return toast('Quantidade e justificativa obrigatórias.',true);
    if(!window.confirm((values.resolution==='recuperado'?'Devolver ao estoque':'Descartar definitivamente')+
      ' '+quantity+' unidade(s)?'))return;
    return exec(async()=>assertOk(await db.rpc('resolve_stock_damage',{
      p_damage:damage.id,p_action:values.resolution,p_quantity:quantity,
      p_note:reason,p_request:form.dataset.request
    })),values.resolution==='recuperado'?'Produto recuperado e disponível.':'Descarte registrado no histórico.');
  }
  if(type==='event-delete-confirm'){
   const id=form.dataset.eventId,e=eventById(id);
   if(!e||e.deleted_at||!isManager()||!hasPermission('events.close')||!hasPermission('events.return'))return;
   const code=String(values.delete_code||'');
   if(!code)return toast('Informe o código de exclusão.',true);
   if(!window.confirm('Excluir a loja temporária '+e.name+' e devolver todo o saldo físico restante à central? Esta ação não pode ser desfeita pela interface.'))return;
   let returned=0;
   return exec(async()=>{
    returned=Number(assertOk(await db.rpc('delete_temporary_store',{
      p_event_id:id,p_code:code
    }))||0);
    state.activeEvent=null;state.eventWorkflow=null;state.view='lojas';
   },()=> 'Loja excluída. '+returned+' unidade(s) devolvida(s) à central. Histórico preservado.');
  }
  if(type==='event-cover-update'){
   const e=eventById(form.dataset.eventId);
   if(!e||e.deleted_at||!hasPermission('events.manage'))return;
   const mode=values.cover_mode,file=values.event_cover_file;
   return exec(async()=>{
    if(mode==='upload'){
     if(!(file instanceof File)||!file.size)throw Error('Selecione uma imagem para enviar.');
     await uploadEventCover(db,e.id,file);
    }else if(mode==='generate')await generateEventCover(db,e.id);
    else if(mode==='remove')assertOk(await db.from('events').update({cover_path:null}).eq('id',e.id));
   },'Capa do evento atualizada.');
  }
  if(type==='event-create'){
    if(!hasPermission('events.manage'))return;
    if(values.ends_at&&values.ends_at<values.starts_at){toast('A data final não pode ser anterior ao início.',true);return;}
    let coverWarning='';
    return exec(async()=>{
      const eventId=assertOk(await db.rpc('create_temporary_store',{
       p_name:String(values.name||'').trim(),p_start:values.starts_at,
       p_end:values.ends_at||null,p_notes:String(values.notes||'').trim()||null,
       p_responsible:values.responsible_id
      }));
      state.activeEvent=eventId;state.view='eventos';
      try{
       if(values.cover_mode==='upload'){
        if(!(values.event_cover_file instanceof File)||!values.event_cover_file.size)
         throw Error('Nenhum arquivo foi enviado.');
        await uploadEventCover(db,eventId,values.event_cover_file);
       }else if(values.cover_mode==='generate')await generateEventCover(db,eventId);
      }catch(error){coverWarning=error.message||'Capa não salva';console.warn('Evento criado sem capa',error);}
    },()=>coverWarning?'Loja criada. Capa pendente: '+coverWarning:'Loja criada com sucesso. Prepare os produtos em Pedidos.');
  }
  if(type==='event-loss'){
    const quantity=Number(values.quantity),note=String(values.note||'').trim();
    if(!Number.isInteger(quantity)||quantity<1||!values.product_id||note.length<5)
      return toast('Informe produto, quantidade e justificativa com pelo menos 5 caracteres.',true);
    if(!window.confirm('Confirmar baixa justificada de '+quantity+' unidade(s) nesta loja temporária?'))return;
    return exec(async()=>assertOk(await db.rpc('record_event_loss',{
      p_event_id:form.dataset.event,p_product_id:values.product_id,
      p_quantity:quantity,p_reason:values.reason,p_note:note
    })),'Baixa justificada registrada.');
  }
  if(type==='event-move'){
    const quantity=Number(values.quantity);
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000000||!values.product_id){toast('Selecione produto e quantidade válida.',true);return;}
    await exec(async()=>assertOk(await db.rpc('move_stock',{
      p_product_id:values.product_id,p_event_id:form.dataset.event,p_action:form.dataset.movement,
      p_quantity:quantity,p_note:values.note||null
    })),'Movimentação registrada no histórico.');
    return;
  }
  if(type==='member-add'){
    if(!hasPermission('events.manage'))return;
    await exec(async()=>assertOk(await db.from('event_members').insert({
      event_id:form.dataset.event,user_id:values.user_id,role:values.role
    })),'Equipe atualizada.');
    return;
  }

  if(type==='category-new'||type==='category-edit'){
    if(!hasPermission('categories.manage'))return;
    const name=String(values.name||'').trim(), parent=form.dataset.fromProduct==='1'?(form.dataset.parent||null):(values.parent_id||null);
    if(name.length<2||name.length>90){toast('Nome entre 2 e 90 caracteres.',true);return;}
    const min=values.franchise_min_qty===''?null:Number(values.franchise_min_qty);
    if(min!==null&&(!Number.isInteger(min)||min<1||min>1000000))return toast('Mínimo de franquia inválido.',true);
    let variation_options;
    try{variation_options=variationOptionsToSave(form);}catch(error){return toast(error.message,true);}
    if(form.dataset.fromProduct==='1'){
      await saveTaxonomyFromProduct(form,'categories',{name,parent_id:parent,variation_options,franchise_min_qty:min},'Categoria e variações criadas.');
    }else if(type==='category-edit'){
      const data={name,variation_options,franchise_min_qty:min};if(form.dataset.lockParent!=='1')data.parent_id=parent;
      await exec(async()=>assertOk(await db.from('categories').update(data).eq('id',form.dataset.id)),'Categoria e variações atualizadas.');
    }else{
      await exec(async()=>assertOk(await db.from('categories').insert({name,parent_id:parent,variation_options,franchise_min_qty:min})),'Categoria criada com variações.');
    }
    return;
  }
  if(type==='tag-new'){
    if(!hasPermission('tags.manage'))return;
    const name=String(values.name||'').trim();
    if(name.length<2||name.length>40||name.includes(',')){toast('Nome de tag inválido.',true);return;}
    if(form.dataset.fromProduct==='1'){
      await saveTaxonomyFromProduct(form,'tags',{name},'Tag criada e selecionada.');
    }else{
      await exec(async()=>assertOk(await db.from('tags').insert({name})),'Tag criada.');
    }
    return;
  }

  if(type==='store-order-adjust'||type==='store-order-receiving'){
    const orderId=form.dataset.order,order=state.storeOrders.find(x=>x.id===orderId);
    if(!order)return;
    const lines=[...form.querySelectorAll('[data-phase-qty]')];
    const items=lines.map(el=>({product_id:el.dataset.id,quantity:Number(el.value)}));
    if(!items.length||items.some((x,i)=>!Number.isInteger(x.quantity)||x.quantity<0||x.quantity>Number(lines[i].dataset.expected)))
      return toast('Quantidades inválidas ou superiores ao pedido.',true);
    const diff=items.some((x,i)=>x.quantity!==Number(lines[i].dataset.expected));
    const reason=String(values.reason||'').trim();
    if(diff&&reason.length<5)return toast('Informe uma justificativa para a divergência.',true);
    if(type==='store-order-adjust'&&!items.some(x=>x.quantity>0))
      return toast('Mantenha ao menos um SKU ou cancele o pedido.',true);
    if(!window.confirm('Registrar conferência e quantidades informadas?'))return;
    const rpc=type==='store-order-adjust'?'adjust_store_order_items':'receive_store_order_checked';
    const args=type==='store-order-adjust'?{p_order:orderId,p_items:items,p_reason:reason||'Atendimento integral'}:
      {p_order:orderId,p_items:items,p_reason:reason||null};
    return exec(async()=>assertOk(await db.rpc(rpc,args)),
      type==='store-order-adjust'?'Quantidades ajustadas.':'Recebimento conferido; divergências registradas.');
  }
  if(type==='avulso-picking'){
    const order=unifiedOrderById('avulso',form.dataset.order);
    if(!order||order.status!=='reservado'||!hasPermission('orders.separate'))return;
    const inputs=[...form.querySelectorAll('[data-pick-qty]')];
    if(inputs.length!==order.lines.length)return toast('Itens do pedido incompletos.',true);
    const items=inputs.map(el=>({product_id:el.dataset.id,quantity:Number(el.value)}));
    if(items.some((x,i)=>!Number.isInteger(x.quantity)||x.quantity!==Number(inputs[i].dataset.expected)))
      return toast('Conferência incompleta ou divergente. Confira todos os SKUs.',true);
    if(!window.confirm('Marcar todos os SKUs como separados? O estoque físico permanece na central até confirmar a saída.'))return;
    return exec(async()=>assertOk(await db.rpc('confirm_avulso_order_picking',{
      p_order:order.id,p_items:items
    })),'Separação conferida. Agora confirme a saída física.');
  }
  if(type==='unified-shortage'){
    const kind=form.dataset.kind,order=unifiedOrderById(kind,form.dataset.order);
    if(!order||!hasPermission('orders.separate'))return;
    const inputs=[...form.querySelectorAll('[data-shortage-qty]')];
    const items=inputs.map(el=>({product_id:el.dataset.id,quantity:Number(el.value)}));
    if(items.length!==order.lines.length||items.some((x,i)=>!Number.isInteger(x.quantity)||
      x.quantity<0||x.quantity>Number(inputs[i].dataset.original)))
      return toast('Quantidades inválidas. Não é possível aumentar o pedido neste ajuste.',true);
    if(!items.some(x=>x.quantity>0))return toast('Para retirar todos os itens use Cancelar pedido.',true);
    if(!items.some((x,i)=>x.quantity<Number(inputs[i].dataset.original)))return toast('Nenhuma quantidade foi reduzida.',true);
    const reason=String(values.reason||'').trim();
    if(reason.length<5||reason.length>250)return toast('Explique o motivo da diferença.',true);
    if(!window.confirm('Registrar redução justificada de quantidades e atualizar reservas?'))return;
    return exec(async()=>assertOk(await db.rpc('adjust_unified_order_shortage',{
      p_kind:kind,p_order:order.id,p_items:items,p_reason:reason
    })),'Quantidades ajustadas com justificativa e reservas recalculadas.');
  }
  if(type==='store-order-picking'){
    const orderId=form.dataset.order;
    const order=state.storeOrders.find(x=>x.id===orderId);
    if(!order||order.status!=='aprovado'||!hasPermission('orders.separate')||
       !assignedStore(order.from_store_id))return;
    const inputs=[...form.querySelectorAll('[data-pick-qty]')];
    if(!inputs.length)return toast('Pedido sem itens para conferência.',true);
    const items=inputs.map(input=>({product_id:input.dataset.id,quantity:Number(input.value)}));
    if(items.some((item,i)=>!Number.isInteger(item.quantity)||item.quantity!==Number(inputs[i].dataset.expected)))
      return toast('Conferência incompleta ou divergente. Confira cada SKU.',true);
    if(!window.confirm('Finalizar conferência deste pedido? O físico permanece até a saída.'))return;
    return exec(async()=>assertOk(await db.rpc('confirm_store_order_picking',{
      p_order:orderId,p_items:items
    })),'Itens conferidos; pedido separado e aguardando saída física.');
  }
  if(type==='store-order-create'){
    if(!canUseStoreOrders())return;
    const lines=[...form.querySelectorAll('[data-store-order-qty]')].map(el=>({
      product_id:el.dataset.id,quantity:Number(el.value||0)}));
    if(lines.some(x=>!Number.isInteger(x.quantity)||x.quantity<0||x.quantity>1000000))
      return toast('Informe quantidades válidas.',true);
    const items=lines.filter(x=>x.quantity>0);
    if(!items.length)return toast('Selecione ao menos um produto.',true);
    if(items.length>100)return toast('Limite de 100 produtos por pedido.',true);
    const target=state.stores.find(x=>x.id===values.to_store_id);
    if(!target||!target.active||!assignedStore(target.id)||
      (target.kind==='franquia'&&!hasPermission('orders.franchise'))||
      (target.kind!=='franquia'&&!hasPermission('orders.central')))return toast('Unidade não autorizada.',true);
    if(target.kind==='franquia'){
     const invalid=items.find(line=>line.quantity<categoryFranchiseMin(product(line.product_id)));
     if(invalid){const prod=product(invalid.product_id);
      return toast('Mínimo para '+(prod?.name||'produto')+' · '+(prod?.apparel_size||'Único')+': '+categoryFranchiseMin(prod)+' unidades por SKU.',true);}
    }
    const main=state.stores.find(x=>x.is_primary);
    await exec(async()=>assertOk(await db.rpc('create_store_order',{
      p_from_store:main.id,p_to_store:values.to_store_id,
      p_type:state.stores.find(x=>x.id===values.to_store_id)?.kind==='franquia'?'franquia':'central',
      p_items:items,p_note:values.note||null
    })),'Pedido criado com reserva automática. A saída física ocorrerá após a conferência.');return;
  }
  if(type==='inventory-start'){
    const [locationType,locationId]=String(values.location||'').split('|');
    if(!window.confirm('Abrir sessão de inventário?'))return;
    return exec(async()=>assertOk(await db.rpc('inventory_start',{p_type:locationType,p_location:locationId||null,p_title:String(values.title||'').trim()})),'Sessão aberta.');
  }
  if(type==='inventory-save'){
    const id=form.dataset.session;
    const inputs=[...form.querySelectorAll('[data-inventory-qty]')].filter(el=>el.value!=='');
    if(!inputs.length)return toast('Preencha ao menos uma contagem.',true);
    if(inputs.some(el=>!Number.isInteger(Number(el.value))||Number(el.value)<0||Number(el.value)>1000000))return toast('Contagem inválida.',true);
    return exec(async()=>{
      for(const el of inputs)assertOk(await db.rpc('inventory_count',{p_session:id,p_product:el.dataset.id,p_counted:Number(el.value)}));
    },'Contagens registradas.');
  }
  if(type==='inventory-approve'){
    const id=form.dataset.session;
    const session=state.inventorySessions.find(x=>x.id===id);
    if(!session||session.status!=='revisao')return;
    if(!window.confirm('Aprovar diferenças e aplicar todos os ajustes físicos?'))return;
    return exec(async()=>assertOk(await db.rpc('inventory_finalize',{p_session:id,p_approve:true,p_note:String(values.note||'').trim()})),'Inventário aprovado e aplicado.');
  }
  if(type==='branch-return-dispatch'){
    const storeId=form.dataset.store;
    const quantity=Number(values.quantity);
    const expected=Number(state.storeBalances.find(x=>x.store_id===storeId&&x.product_id===values.product_id)?.quantity||0);
    if(!Number.isInteger(quantity)||quantity<1||quantity>expected)return toast('Quantidade maior que o saldo da filial.',true);
    if(String(values.reason||'').trim().length<5)return toast('Informe motivo da devolução.',true);
    if(!window.confirm('Enviar '+quantity+' unidade(s) da filial para a central?'))return;
    return exec(async()=>assertOk(await db.rpc('dispatch_branch_return',{
      p_store:storeId,p_product:values.product_id,p_quantity:quantity,
      p_expected:expected,p_reason:String(values.reason).trim()
    })),'Devolução expedida. Aguardando conferência na central.');
  }
  if(type==='branch-stock-movement'){
    const storeId=form.dataset.store,store=state.stores.find(x=>x.id===storeId);
    if(!store||store.kind!=='filial'||!assignedStore(storeId)||
       !(hasPermission('stores.manage')||hasPermission('orders.receive')))return;
    const quantity=Number(values.quantity),expected=Number(form.dataset.expected);
    if(!Number.isInteger(quantity)||quantity<0||quantity>1000000||!Number.isInteger(expected))
      return toast('Quantidade ou saldo esperado inválido.',true);
    if(String(values.reason||'').trim().length<5)return toast('Justifique a movimentação com pelo menos 5 caracteres.',true);
    if(!window.confirm('Registrar '+(values.operation==='saida'?'saída':'contagem')+' de '+quantity+' unidade(s) na filial '+store.name+'?'))return;
    return exec(async()=>assertOk(await db.rpc('record_branch_stock_movement',{
      p_store:storeId,p_product:values.product_id,p_operation:values.operation,
      p_quantity:quantity,p_expected:expected,p_reason:String(values.reason).trim()
    })),'Movimentação da filial registrada.');
  }
  if(type==='store-save'){
    if(!hasPermission('stores.manage'))return;
    const payload={code:String(values.code||'').trim(),name:String(values.name||'').trim(),kind:values.kind,
      document:String(values.document||'').trim()||null,phone:String(values.phone||'').trim()||null,
      manager_name:String(values.manager_name||'').trim()||null,address:String(values.address||'').trim()||null};
    await exec(async()=>{
      const req=form.dataset.id?db.from('stores').update(payload).eq('id',form.dataset.id):db.from('stores').insert(payload);
      assertOk(await req);
    },'Loja salva.');return;
  }
  if(type==='user-permissions'){
    if(!isAdmin()||form.dataset.id===state.user?.id)return;
    const uid=form.dataset.id,perms=[...form.querySelectorAll('[name="perm"]:checked')].map(x=>x.value);
    const stores=[...form.querySelectorAll('[name="store"]:checked')].map(x=>x.value);
    if(!perms.every(p=>permissionCatalog.some(([key])=>p===key)))throw Error('Permissão inválida.');
    if(!perms.length)throw Error('Selecione ao menos uma autorização.');
    assertFranchiseProfile(form,values.role,perms,stores);
    await exec(async()=>{
      assertOk(await db.rpc('set_staff_access',{
        p_user_id:uid,p_role:values.role,p_permissions:perms,p_store_ids:stores
      }));
    },'Autorizações atualizadas.');return;
  }
  if(type==='user-role'){
    if(!isAdmin() || form.dataset.id===state.user.id)return;
    if(!Object.hasOwn(roles,values.role))throw new Error('Função inválida.');
    await exec(async()=>assertOk(await db.from('staff_profiles').update({role:values.role}).eq('id',form.dataset.id)),'Função atualizada.');
    return;
  }
  if(type==='user-new'){
    if(!isAdmin())return;
    let password;
    try{password=passwordsValid(values);}catch(e){fail(e);return;}
    await exec(async()=>{
      const permissions=[...form.querySelectorAll('[name="perm"]:checked')].map(x=>x.value);
      const store_ids=[...form.querySelectorAll('[name="store"]:checked')].map(x=>x.value);
      if(!permissions.length)throw new Error('Selecione ao menos uma permissão.');
      assertFranchiseProfile(form,values.role,permissions,store_ids);
      await invokeUserAdmin('create',{
        full_name:String(values.full_name||'').trim(),
        username:String(values.username||'').trim(),
        role:values.role,password,permissions,store_ids
      });
    },'Usuário cadastrado. Entregue a senha ao colaborador por um canal seguro.');
    return;
  }
  if(type==='user-password'){
    if(!isAdmin()||form.dataset.id===state.user?.id)return;
    let password;
    try{password=passwordsValid(values);}catch(e){fail(e);return;}
    await exec(async()=>{
      await invokeUserAdmin('set-password',{user_id:form.dataset.id,password});
    },'Senha atualizada. Informe a nova senha ao colaborador.');
    return;
  }
  if(type==='my-password'){
    let password;
    try{password=passwordsValid(values);}catch(e){fail(e);return;}
    await exec(async()=>assertOk(await db.auth.updateUser({password})),'Sua senha foi atualizada.');
    return;
  }

}
async function saveQuickGroupCounts(card,onlyId=null){
  if(!canQuickBalance()||state.loading||!card?.isConnected)return;
  let selected;
  try{selected=collectQuickCounts(card,onlyId);}catch(error){toast(error.message,true);return;}
  state.loading=true;
  const buttons=[...card.querySelectorAll('button')].map(button=>({button,disabled:button.disabled}));
  const selectedInputs=selected.map(item=>[...card.querySelectorAll('[data-quick-row]')]
    .find(row=>row.dataset.quickRow===item.product_id)?.querySelector('[data-quick-count]')).filter(Boolean);
  buttons.forEach(({button})=>button.disabled=true);
  selectedInputs.forEach(input=>input.disabled=true);
  let resultMessage='';
  const status=card.querySelector('[data-quick-status]');
  if(status)status.textContent='Salvando contagens…';
  try{
    const saved=assertOk(await db.rpc('quick_stock_count_batch',{p_items:selected}));
    if(!saved||saved.saved!==selected.length)throw new Error('O balanço não retornou a confirmação esperada.');
    // Atualização de dados e elementos locais: NÃO chama render nem loadData.
    for(const item of selected){
      let balance=state.balances.find(b=>b.product_id===item.product_id&&!b.event_id);
      if(balance)balance.quantity=item.counted;
      else state.balances.push({product_id:item.product_id,event_id:null,quantity:item.counted});
      const row=[...card.querySelectorAll('[data-quick-row]')].find(r=>r.dataset.quickRow===item.product_id);
      if(!row)continue;
      row.querySelector('[data-quick-expected]').value=String(item.counted);
      row.querySelector('[data-quick-current]').textContent=String(item.counted);
      row.querySelector('[data-quick-count]').value='';
      row.classList.add('quick-just-saved');
      // A mensagem confirma o salvamento sem deslocar o card.
    }
    const qty=[...card.querySelectorAll('[data-quick-expected]')].reduce((sum,input)=>sum+Number(input.value||0),0);
    const total=card.querySelector('[data-quick-total]');
    if(total)total.textContent=String(qty);
    const adjusted=Number(saved.adjusted)||0;
    resultMessage=selected.length+' tamanho(s) salvo(s) · '+adjusted+' ajuste(s) de estoque';
    toast(selected.length===1?'Contagem salva sem recarregar a tela.':selected.length+' contagens salvas sem recarregar a tela.');
  }catch(error){
    fail(error);
    resultMessage='Não foi salvo. Revise as contagens antes de tentar novamente.';
    // Se outro operador alterou o saldo, atualiza apenas a referência das linhas,
    // preservando os campos digitados e a posição da rolagem.
    try{
      const ids=selected.map(x=>x.product_id);
      const current=assertOk(await db.from('stock_balances').select('product_id,quantity')
        .in('product_id',ids).is('event_id',null))||[];
      for(const bal of current){
        const row=[...card.querySelectorAll('[data-quick-row]')].find(r=>r.dataset.quickRow===bal.product_id);
        if(!row)continue;
        row.querySelector('[data-quick-expected]').value=String(bal.quantity);
        row.querySelector('[data-quick-current]').textContent=String(bal.quantity);
        const cached=state.balances.find(b=>b.product_id===bal.product_id&&!b.event_id);
        if(cached)cached.quantity=bal.quantity;
      }
    }catch(syncError){console.warn('Não foi possível sincronizar saldo após falha',syncError);}
  }finally{
    state.loading=false;
    selectedInputs.forEach(input=>input.disabled=false);
    buttons.forEach(({button,disabled})=>{if(button.isConnected)button.disabled=disabled;});
    updateQuickCountButtons(card);
    if(status&&resultMessage)status.textContent=resultMessage;
  }
}

function searchQuickCards(query){
  const container=document.querySelector('.quick-group-list');
  if(!container)return 0;
  let found=filterQuickCountCards(container,query);
  const q=String(query||'').trim().toLocaleLowerCase('pt-BR');
  if(found>0||q.length<3)return found;
  // Pesquisa sob demanda fora dos 50 cards iniciais, sem destruir
  // contagens já digitadas em outros produtos.
  const existing=new Set([...container.querySelectorAll('[data-quick-group]')].map(el=>el.dataset.quickGroup));
  const more=groupInventory(state.items.filter(p=>p.active),state.apparelModels).filter(group=>{
    if(existing.has(group.key))return false;
    return [group.title,...group.products.flatMap(p=>[
      p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira
    ])].join(' ').toLocaleLowerCase('pt-BR').includes(q);
  }).slice(0,25);
  if(more.length){
    const empty=container.querySelector('[data-quick-empty]');
    const html=more.map(group=>quickBalanceCard(group,{photoButton,qtyStore,qtyReserved,h})).join('');
    if(empty)empty.insertAdjacentHTML('beforebegin',html);
    else container.insertAdjacentHTML('beforeend',html);
    hydrateImages();
    found=filterQuickCountCards(container,query);
  }
  return found;
}

function updateFiltered(id,value){
  const active=document.activeElement;
  const selection=active?.selectionStart??null;
  state.search=value;state.page=0;
  if(id==='quick-search'){
    const area=document.querySelector('.quick-group-list');
    if(area)searchQuickCards(value);
    return;
  }
  render();
  const field=document.getElementById(id);
  if(field&&selection!==null){field.focus();field.setSelectionRange(selection,selection);}
}
document.addEventListener('click',event=>{
  if(event.target.classList?.contains('photo-lightbox')){document.querySelector('.photo-lightbox')?.remove();return;}
  if(event.target.classList?.contains('mobile-more-overlay')){closeMobileNavigation();return;}
  handleClick(event).catch(fail);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&event.target.id==='product-search'&&canOpenSkuManager()){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
    const matched=state.items.find(p=>p.active&&(
      String(p.ean||'').toLocaleLowerCase('pt-BR')===q||
      String(p.sku||'').toLocaleLowerCase('pt-BR')===q));
    if(matched){event.preventDefault();manageSku(matched.id);return;}
  }
  if(event.key==='Escape'){
    if(document.querySelector('.share-product-modal'))document.querySelector('.share-product-modal').remove();
    else if(document.querySelector('.tax-backdrop'))closeTaxonomyPicker();
    else if(document.querySelector('.photo-lightbox'))document.querySelector('.photo-lightbox').remove();
    else if(document.querySelector('.mobile-more-overlay'))closeMobileNavigation();
    else if(document.querySelector('.stock-overview-overlay'))document.querySelector('.stock-overview-overlay').remove();
    else if(document.querySelector('.modalback'))closeTopModal();
  }
});
document.addEventListener('submit',event=>{handleSubmit(event).catch(fail);});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-count-free]')){
    const input=event.target,row=input.closest('[data-product-id]');
    const save=row?.querySelector('[data-action="stock-free-save"]');
    const current=Number(input.dataset.initial);
    const changed=input.value!==''&&Number(input.value)!==current;
    if(save)save.hidden=!changed;
    row?.classList.toggle('is-count-dirty',changed);
  }
  if(event.target.matches('[data-variation-mode]')){
    const form=event.target.closest('form');
    const field=form?.querySelector('[data-variation-custom]');
    if(field)field.hidden=event.target.value!=='custom';
  }
  if(event.target.matches('[data-unified-search]')){
    const container=event.target.closest('.uo-page');
    filterUnifiedOrders(container,event.target.value,
      container?.querySelector('[data-unified-status]')?.value||'todos');
  }
  if(event.target.matches('form[data-form="avulso-picking"] [data-pick-qty],form[data-form="event-batch-picking"] [data-pick-qty]'))
    updateUnifiedPickingTotal(event.target.closest('form'));
  if(event.target.matches('form[data-form="event-batch-write"] [data-plan-qty]'))
    refreshEventLotCounter(event.target.closest('form'));
  if(event.target.closest('form[data-form="sku-manage"]')){
    syncSkuManagerPreview(event.target.closest('form[data-form="sku-manage"]'));
  }
  if(event.target.matches('[data-plan-search]')){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR'),form=event.target.closest('form');
    for(const group of form.querySelectorAll('[data-plan-group]')){
      const rows=[...group.querySelectorAll('[data-plan-row]')];
      const matchGroup=group.dataset.search.includes(q);
      for(const row of rows)row.hidden=Boolean(q)&&!matchGroup&&!row.dataset.search.includes(q);
      group.hidden=rows.every(row=>row.hidden);
    }
  }
  if(event.target.matches('[data-settle-field]')){
    const form=event.target.closest('form');
    if(form)updateEventSettlementPreview(form);
  }
  if(event.target.matches('[data-store-order-search]')){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
    event.target.closest('form')?.querySelectorAll('[data-store-row]').forEach(el=>{
      el.hidden=Boolean(q)&&!el.dataset.filter.includes(q);
    });
  }
  if(event.target.id==='stock-op-search'){
    const kind=state.view;
    if(['entrada','saida'].includes(kind)){
      state.stockQuery[kind]=event.target.value;
      refreshStockOperationSearch();
    }
  }
  if(event.target.matches('[data-stock-qty]')){
    const kind=state.view,record=state.stockCarts[kind]?.get(event.target.dataset.id);
    if(record){
      const val=event.target.value.trim();
      record.quantity=val===''?0:Number(val);
      const line=event.target.closest('[data-stock-line]');
      const after=qtyStore(event.target.dataset.id)+(kind==='entrada'?record.quantity:-record.quantity);
      const projected=line?.querySelector('[data-stock-projected]');
      if(projected)projected.textContent=String(after);
      updateStockOperationBasket(false);
    }
  }
  if(['product-search','movement-search','quick-search'].includes(event.target.id))updateFiltered(event.target.id,event.target.value);
  if(event.target.matches('[data-quick-count]')){
    const card=event.target.closest('[data-quick-group]');
    if(card)updateQuickCountButtons(card);
  }
  if(event.target.id==='catalog-category-search'){
    state.catalogSearch=event.target.value;
    const list=document.querySelector('.catalog-tree-list');if(list)list.innerHTML=renderCatalogTree();
  }
  if(event.target.id==='catalog-tags-search'){
    state.catalogTagsSearch=event.target.value;
    const list=document.querySelector('.catalog-tags-list');if(list)list.innerHTML=renderTagsCatalog();
  }
  if(event.target.matches('[data-order-search]')){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
    event.target.closest('form')?.querySelectorAll('[data-order-group]').forEach(group=>{
      group.hidden=!!q&&!group.dataset.search.includes(q);
    });
  }
  if(event.target.matches('[data-order-q]')){
    const form=event.target.closest('form'),fields=[...form.querySelectorAll('[data-order-q]')];
    const selected=fields.filter(x=>Number(x.value)>0);
    const total=selected.reduce((sum,x)=>sum+(Number(x.value)||0),0);
    const note=form.querySelector('[data-order-selected]');
    if(note)note.textContent=selected.length+' variação(ões) · '+total+' unidade(s) selecionada(s)';
  }
  if(event.target.matches('[data-event-batch-search]')){
    filterWorkflowRows(event.target.closest('form'),event.target.value,'batch');
  }
  if(event.target.id==='event-return-search'){
    state.eventReturnQuery=event.target.value;
    filterWorkflowRows(event.target.closest('.main'),event.target.value,'return');
  }
  if(event.target.matches('[data-batch-id]')){
    const form=event.target.closest('form');const total=[...form.querySelectorAll('[data-batch-id]')]
      .reduce((sum,i)=>sum+(Number(i.value)||0),0);
    const badge=form.querySelector('[data-batch-summary]');
    if(badge)badge.textContent=total+' unidade(s) selecionada(s)';
  }
  if(event.target.matches('[data-tag-search]')){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
    event.target.closest('.form-section')?.querySelectorAll('.tag-choice').forEach(el=>{
      el.hidden=!!q&&!el.textContent.toLocaleLowerCase('pt-BR').includes(q);
    });
  }
});
document.addEventListener('keydown',event=>{
  if(event.target.id==='stock-op-search'&&event.key==='Enter'){
    event.preventDefault();
    const q=event.target.value.trim();
    const candidates=state.items.filter(p=>p.active&&(p.ean===q||p.sku===q));
    if(candidates.length===1)handleOperationScanCode(q);
    else if(candidates.length>1)toast('Há mais de uma variação para esse código. Selecione na lista.',true);
    else if(q)toast(state.view==='entrada'?'Produto não localizado. Use + Cadastrar produto.':'Produto não localizado entre os produtos ativos.',true);
  }
});
document.addEventListener('change',event=>{
  if(event.target.matches('[data-unified-status]')){
    const container=event.target.closest('.uo-page');
    filterUnifiedOrders(container,container?.querySelector('[data-unified-search]')?.value||'',
      event.target.value);
  }
  if(event.target.closest('form[data-form="sku-manage"]')){
    syncSkuManagerPreview(event.target.closest('form[data-form="sku-manage"]'));
  }
  if(event.target.matches('form[data-form="user-new"] select[name="role"]')){
    const defaults=permissionDefaults[event.target.value]||[];
    event.target.closest('form').querySelectorAll('[name="perm"]').forEach(el=>el.checked=defaults.includes(el.value));
  }
  if(event.target.matches('.stock-destination-field select')){
    state.stockSelectedDestination=event.target.value;
    updateStockOperationBasket(false);
  }
  if(event.target.matches('[data-stock-qty]')){
    const kind=state.view,record=state.stockCarts[kind]?.get(event.target.dataset.id);
    if(record&&(!Number.isInteger(record.quantity)||record.quantity<1||record.quantity>1000000)){
      event.target.setCustomValidity('Quantidade de 1 a 1.000.000');
      event.target.reportValidity();
    }else event.target.setCustomValidity('');
  }

  if(event.target.matches('[data-use-sizes]')){
    const form=event.target.closest('form');const checked=event.target.checked;
    setSizesMode(form,checked);
    if(checked){
      const current=chosenCategory(form),ancestors=categoryChain(current);
      const rootCat=state.categories.find(c=>!c.parent_id&&c.name.toLocaleLowerCase('pt-BR')==='roupas');
      if(rootCat&&!ancestors.some(x=>x.id===rootCat.id)){
        const standard=state.categories.find(c=>c.parent_id===rootCat.id&&c.name.toLocaleLowerCase('pt-BR')==='camisetas');
        const choice=standard||rootCat;
        form.querySelector('[name="category_id"]').value=choice.id;
        form.querySelector('[data-category-label]').textContent=categoryFull(choice.id);
        refreshProductTagChoices(form);
      }
    }
  }
  if(event.target.matches('select[name="apparel_type"]'))apparelSyncCategory(event.target,state,{categoryFull});
  if(event.target.matches('select[name="cover_mode"]'))syncCoverFileField(event.target.closest('form'));
  if(event.target.matches('input[name="camera_file"],input[name="gallery_file"]'))handlePhotoInput(event.target).catch(fail);
  if(event.target.matches('input[name="gallery_replace_file"]')){
   const input=event.target,form=input.closest('form'),file=input.files?.[0];
   if(form&&file)galleryReplaceFile(form,form.__replaceIndex,file,compressPhoto)
     .then(()=>hydrateImages()).catch(fail).finally(()=>{input.value='';});
  }
  if(event.target.id==='event-filter'){state.eventFilter=event.target.value;render();}
  if(event.target.id==='movement-filter'){state.movementFilter=event.target.value;render();}
  if(event.target.id==='movement-user'){state.movementUser=event.target.value;render();}
  if(event.target.id==='movement-period'){state.movementPeriod=Number(event.target.value);render();}
});
async function start(){
  if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){render();return;}
  db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
  });
  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_IN'){state.loginNotice='';setTimeout(()=>loadProfile().catch(fail),0);}
    if(event==='SIGNED_OUT'){state.user=null;state.profile=null;state.setupPending=false;render();}
  });
  await loadProfile();
}
start().catch(fail);
