import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { compressPhoto } from './photos.js';
import {galleryMarkup,galleryState,galleryRemove,galleryMain,galleryAddFiles,galleryReplaceFile,savePhotoGallery,galleryHasChanges} from './photo-gallery.js?v=20261016sixphotos1';
import {uploadEventCover,generateEventCover} from './event-cover.js?v=20261015covergrant1';
import {renderStoreHub,locationOrders,matchesStoreOrder,filterStoreHub} from './store-hub.js?v=20261016stores1';
import {renderStoreUnit} from './store-unit.js?v=20261016stores1';
import { scanEAN } from './scan.js?v=20261014w2';
import {preventScannerSubmit} from './product-form-scanner.js?v=20261016scanner1';
import {gondolaSelectHTML,gondolasPageHTML} from './gondolas.js?v=20261016gondolas1';
import { openTaxonomyPicker, closeTaxonomyPicker } from './taxonomy-ui.js?v=20261014v3';
import { rankTagsForCategory, catalogCategoryRows, catalogTagCards } from './catalog-ui.js?v=20261015variants1';
import { apparelPage, apparelModal, apparelAddRow, apparelRemoveRow, submitApparel,
  apparelFillSizes, apparelVariantEditModal, saveApparelVariant, apparelPhotoModal, saveApparelPhoto, apparelSyncCategory } from './apparel.js?v=20261016gondolas1';
import { sizesSection, setSizesMode, setSizeSelected, saveSizedProduct } from './product-variants.js?v=20261016gondolas1';
import {resolveCategoryVariations,refreshCategorySizeOptions,renderCategoryVariationFields,variationOptionsToSave} from './category-variations.js?v=20261016gondolas1';
import { groupInventory, recentInventoryGroups, groupedCard, addSizesContent, updateExtraSizeButtons, toggleExtraSize, collectExtraSizes,
  eventBatchContent, collectEventBatch, eventReturnPage, filterWorkflowRows } from './stock-workflows.js?v=20261017mobile-card1';
import {catalogSortOptions,availableGondolas,gondolaKey,catalogMatchesQuery,orderCatalogGroups,filterCatalogGondola} from './catalog-order.js?v=20261016sort1';
import {skuPanelModes,renderSkuPanel,validateSkuAction} from './sku-panel.js?v=20261016damage-direct1';
import { eventHistoryCards, ordersPageMarkup, createInternalOrderForm, collectInternalOrder } from './orders-events.js?v=20261014unified1';
import { stockOperationPage, stockOperationResults, stockOperationSearchHTML, stockCartHTML, stockOperationHistoryHTML, operationCartLines } from './stock-inout.js?v=20261015stockcards1';
import { eventPickingRows,eventPlanForm,eventSettlementForm,eventCompactDetail,damageListHTML,a4PickingHTML } from './event-simple.js?v=20261016stores2';
import {makeUnifiedOrders,unifiedOrdersPage,filterUnifiedOrders,pickingOrderRows,shortageEditRows,pickingA4HTML} from './unified-orders.js?v=20261016compact1';
import {operationalFormMarkup,operationalDifferenceRows} from './order-operations.js?v=20261016partial1';
import {finalVerificationMarkup,verificationProgress,verificationCanDispatch,findVerificationProduct} from './final-verification.js?v=20261016orderflow1';
import {pickingThermalHTML} from './thermal-picking.js?v=20261016thermal57';
import {eventLotsOverview,eventLotForm,selectedEventModels} from './event-lots.js?v=20261016stores1';
import {lotCatalogMarkup,mountLotCatalog,filterLotCatalog,onLotQuantityInput,lotCatalogAction,collectLotItems,selectedLotCount} from './event-lot-catalog.js?v=20261016dest1';
import {makeOrderCatalog,orderCartMarkup,mountOrderCart,renderOrderCart,orderCartAction,
 setOrderCartQuantity,orderCartSearchKey,collectOrderCartItems,confirmOrderCartReview,
 confirmEventOrderReview,editOrderReview} from './order-cart.js?v=20261016cart1';
import {pickerHome,permanentHome,temporaryHome} from './cdsb-portals.js?v=20261015shortcodes1';
import {purchaseSuggestions,purchasesPage,supplierListHTML,purchaseOrderRows,purchaseOrderDocument,replenishmentDocument,printPage,purchasePendingByProduct,purchasingGroups} from './cdsb-purchases.js?v=20261017comprasv2';
import {validPurchaseQty,setPurchaseCartItem,cleanPurchaseCart,purchaseCartSummary,purchaseCartBySupplier,purchaseCartReviewGroups,serializePurchaseCart,parsePurchaseCart} from './purchase-cart.js?v=20261016buycart1';
import {supplierDirectoryPayload,staffDirectoryPayload,procurementTaskDraft,supplierInsights,procurementTasksHTML} from './directory-automation.js?v=20261017directory1';
import {createPurchasePDF,downloadPurchasePDF} from './purchase-pdf.js?v=20261016buypdf1';
import {renderOperationsDashboard} from './dashboard-home.js?v=20261016home1';
import {stockPrintGroups,stockPrintHTML} from './stock-print-report.js?v=20261015report1';
import {shelfLabelPicker,shelfLabelData,shelfLabelsHTML,collectShelfLabels} from './shelf-labels.js?v=20261016label57';

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
  {id:'compras',label:'Compras',ico:'clipboard'},
  {id:'movimentacoes',label:'Atividades',ico:'arrows'},
  {id:'categorias',label:'Categorias',ico:'layers'},
  {id:'gondolas',label:'Gôndolas',ico:'pin'},
  {id:'tags',label:'Tags',ico:'more'},
  {id:'usuarios',label:'Usuários',ico:'users'}
];
const state = {
  user:null,profile:null,view:'inicio',activeEvent:null,items:[],categories:[],tags:[],gondolas:[],apparelModels:[],apparelOpen:new Set(),expandedProductGroups:new Set(),showInactiveProducts:false,eventWorkflow:null,eventReturnQuery:'',events:[],members:[],
  balances:[],movements:[],users:[],audits:[],orders:[],orderItems:[],customerAccess:[],unifiedOrderAdjustments:[],removedOrders:[],orderCodes:[],orderCodeMap:new Map(),orderVerificationRows:[],orderOperationalRows:[],
  eventPickPlans:[],eventPickItems:[],eventPickBatches:[],eventBatchItems:[],eventShipments:[],eventSettlements:[],damages:[],damageActions:[],
  stores:[],suppliers:[],purchaseOrders:[],purchaseItems:[],purchaseReceipts:[],purchaseReceiptItems:[],procurementTasks:[],staffContactDetails:[],purchaseSupplierFilter:'',purchaseTab:'reposicao',purchaseOrderFilter:'',purchaseCatalog:{search:'',category:'',tag:'',gondola:'',sort:'priority',onlyReplenishment:true,page:0},purchaseCart:new Map(),purchaseExpanded:new Set(),purchaseCartUser:null,userPermissions:[],staffStores:[],ownPermissions:[],storeBalances:[],branchMovements:[],branchReturns:[],storeOrders:[],storeOrderItems:[],storeOrderAdjustments:[],storeOrderReceipts:[],stockReservations:[],consignationClosures:[],stockDestinations:[],stockBatches:[],stockBatchLines:[],stockQuery:{entrada:'',saida:''},
  stockCarts:{entrada:new Map(),saida:new Map()},stockRequestIds:{entrada:null,saida:null},stockSelectedDestination:'',
  search:'',catalogSort:'name-asc',gondolaFilter:'',page:0,eventFilter:'',movementFilter:'',movementUser:'',movementPeriod:30,categoryFilter:'',tagFilter:'',ordersContext:null,pendingOrderFocus:null,activeStore:null,activeStoreTab:'resumo',eventUnitTab:'resumo',storeHubFilter:{type:'todas',status:'all',search:''},
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
 ['stores.read','Consultar lojas'],['stores.manage','Administrar lojas'],['purchases.manage','Fornecedores e pedidos de compra'],['users.manage','Administrar usuários'],['system.force_delete','Autonomia total: exclusões avançadas (com histórico)']
];
const hasPermission = p => Boolean(state.profile?.active) && (state.profile?.role==='admin'||state.ownPermissions.includes(p));
const canUseStoreOrders=()=>['orders.central','orders.franchise','orders.separate','orders.receive','orders.cancel'].some(hasPermission);
const isManager = () => hasPermission('events.manage');
const isStockkeeper = () => state.profile?.role === 'estoquista';
const canRegisterProducts = () => hasPermission('products.create') || hasPermission('products.edit');
const canManageGondolas = () => isAdmin() || (state.profile?.role==='gerente'&&hasPermission('products.edit'));
const canQuickBalance = () => hasPermission('stock.balance');
const viewPermission = {produtos:'products.read',entrada:'stock.entry',saida:'stock.exit',eventos:'events.read',pedidos:'orders.read',movimentacoes:'movements.read',categorias:'categories.manage',tags:'tags.manage',usuarios:'users.manage',lojas:'stores.read'};
const permittedView = v => {
 if(isFranchisePortal())return v==='minha-loja'||v==='pedidos';
 if(state.profile?.role==='evento'&&hasPermission('events.request'))return v==='meu-evento'||v==='eventos';
 if(state.profile?.role==='estoquista'&&hasPermission('orders.separate'))return v==='separador'||v==='pedidos';
 if(v==='minha-loja')return isFranchisePortal();
 if(v==='gondolas')return hasPermission('products.read');
 if(v==='meu-evento')return state.profile?.role==='evento';
 if(v==='separador')return hasPermission('orders.separate');
 if(v==='inicio')return true;
 if(v==='saida'||v==='balanco'||v==='inventario')return false; // Conferência e ajustes acontecem nos cards de Produtos.
 if(v==='pedidos-lojas')return false;
 if(v==='pedidos')return canUseStoreOrders()||hasPermission('orders.read')||hasPermission('orders.internal')||hasPermission('orders.assign')||hasPermission('orders.separate')||hasPermission('events.separate');
 if(v==='separacao')return permittedView('pedidos');
 if(v==='compras')return hasPermission('purchases.manage');
 if(v==='usuarios')return isAdmin();
 if(v==='lojas')return hasPermission('stores.read')||hasPermission('stores.manage')||hasPermission('events.read')||hasPermission('events.manage')||hasPermission('events.separate')||canUseStoreOrders()||hasPermission('orders.read');
 if(v==='lojas-admin')return hasPermission('stores.manage');
 if(v==='avarias')return !isFranchisePortal()&&(hasPermission('stock.balance')||hasPermission('stock.entry'));

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
const orderCode = (kind,id) => state.orderCodeMap.get(kind+':'+id)||'—';
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
     ['gondolas',db.from('gondolas').select('id,name,active').order('name').limit(1000)],
    ['events',db.from('events').select('*').order('starts_at',{ascending:false}).limit(1000)],
    ['members',db.from('event_members').select('*').limit(2000)],
    ['balances',db.from('stock_balances').select('*').limit(10000)],
    ['movements',db.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(1000)],
    ['users',db.from('staff_profiles').select('id,full_name,username,role,active,archived_at,permissions_customized,created_at').order('full_name').limit(1000)]
  ];
  resources.push(['stores',db.from('stores').select('*').order('name')]);
  resources.push(['removedOrders',db.from('admin_removed_orders').select('kind,order_id').limit(10000)]);
  resources.push(['orderCodes',db.from('order_public_codes').select('kind,order_id,code').limit(12000)]);
  if(hasPermission('orders.read')||hasPermission('orders.separate')||hasPermission('events.separate'))
    resources.push(['orderVerificationRows',db.from('order_final_verifications')
      .select('kind,order_id,product_id,expected_quantity,counted_quantity,scanned_code,verified_by,verified_at')
      .limit(15000)]);
  if(hasPermission('orders.read')||hasPermission('orders.separate')||
     hasPermission('events.separate')||hasPermission('orders.dispatch'))
    resources.push(['orderOperationalRows',db.from('order_operational_progress')
       .select('kind,order_id,stage,items,has_difference,updated_at,updated_by').limit(15000)]);
  if(hasPermission('products.edit')||hasPermission('purchases.manage'))
   resources.push(['suppliers',db.from('suppliers').select('*').order('name').limit(1000)]);
  if(hasPermission('purchases.manage')){
   resources.push(['purchaseOrders',db.from('purchase_orders').select('*').order('created_at',{ascending:false}).limit(600)]);
   resources.push(['purchaseItems',db.from('purchase_order_items').select('*').limit(12000)]);
   resources.push(['purchaseReceipts',db.from('purchase_receipts').select('*').order('created_at',{ascending:false}).limit(1000)]);
   resources.push(['purchaseReceiptItems',db.from('purchase_receipt_items').select('*').limit(12000)]);

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
  resources.push(['procurementTasks',db.from('procurement_tasks').select('*').order('due_date',{ascending:true}).limit(1000)]);
  if(isAdmin()){
    resources.push(['userPermissions',db.from('staff_permissions').select('*').limit(5000)]);
    resources.push(['staffContactDetails',db.from('staff_contact_details').select('*').limit(1000)]);
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
  if(state.purchaseCartUser!==state.user.id){
    state.purchaseCartUser=state.user.id;
    try{state.purchaseCart=parsePurchaseCart(sessionStorage.getItem('cdsb-purchase-cart:'+state.user.id));}
    catch{state.purchaseCart=new Map();}
    state.purchaseExpanded=new Set();
  }
  state.purchaseCart=cleanPurchaseCart(state.purchaseCart,state.items);
  state.orderCodeMap=new Map(state.orderCodes.map(r=>[r.kind+':'+r.order_id,r.code]));
  const hiddenOrders=new Set(state.removedOrders.map(x=>x.kind+':'+x.order_id));
  state.orders=state.orders.filter(x=>!hiddenOrders.has('avulso:'+x.id));
  state.storeOrders=state.storeOrders.filter(x=>!hiddenOrders.has('loja:'+x.id));
  state.eventPickBatches=state.eventPickBatches.filter(x=>!hiddenOrders.has('evento:'+x.id));
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
  '<div class="brand-login"><img src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento" width="388" height="127"><small>CONTROLE DE ESTOQUE</small></div>'+
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
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand-login"><img src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento" width="388" height="127"><small>CONTROLE DE ESTOQUE</small></div>'+
  '<h1>Acesso pendente</h1><p>O email <strong>'+h(state.user?.email)+'</strong> já foi identificado, mas precisa ser liberado por um administrador.</p>'+
  '<button class="button" data-action="logout">Sair</button></section></div>';
}
function initialAdminScreen(){
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand-login"><img src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento" width="388" height="127"><small>CONTROLE DE ESTOQUE</small></div>'+
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
    refreshCategorySizeOptions(form,state.categories,state.gondolas);
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
  if(!db){root.innerHTML='<div class="login-wrap"><div class="login"><div class="brand-login"><img src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento" width="388" height="127"><small>CONTROLE DE ESTOQUE</small></div><h2>Configuração necessária</h2><p>Verifique o Supabase exclusivo deste sistema em <code>config.js</code>.</p></div></div>';return;}
  if(!state.user){loginScreen();return;}
  if(!state.profile){state.setupPending?initialAdminScreen():pendingAccessScreen();return;}
  if(!state.profile.active){pendingAccessScreen();return;}
  if(state.view==='inicio'){
  if(isFranchisePortal())state.view='minha-loja';
  else if(state.profile?.role==='estoquista'&&hasPermission('orders.separate'))state.view='separador';
  else if(state.profile?.role==='evento'&&hasPermission('events.request'))state.view='meu-evento';
 }
 if(!permittedView(state.view))state.view=isFranchisePortal()?'minha-loja':state.profile?.role==='estoquista'?'separador':state.profile?.role==='evento'?'meu-evento':'inicio';
  const mark='<img class="cdsb-brand-logo" src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento" width="270" height="89">';
  const sectionNav=isFranchisePortal()?[{id:'minha-loja',label:'Minha Loja',ico:'home'},{id:'pedidos',label:'Meus pedidos',ico:'clipboard'}]:
  state.profile?.role==='evento'&&hasPermission('events.request')?[{id:'meu-evento',label:'Meu Evento',ico:'calendar'},{id:'eventos',label:'Detalhes',ico:'clipboard'}]:
  state.profile?.role==='estoquista'&&hasPermission('orders.separate')?[{id:'separador',label:'Separação',ico:'clipboard'},{id:'pedidos',label:'Todos os pedidos',ico:'package'}]:nav;
 const menu=sectionNav.filter(x=>permittedView(x.id))
    .map(x=>'<button type="button" data-action="view" data-view="'+h(x.id)+'" class="'+((state.view===x.id||(state.view==='entrada'&&x.id==='produtos')||(['eventos','lojas-admin'].includes(state.view)&&x.id==='lojas'))?'active':'')+'">'+
      uiIcon(x.ico,19)+'<span>'+h(x.label)+'</span></button>').join('')+
  (['admin','gerente'].includes(state.profile?.role)?
    '<button type="button" data-action="open-tv" class="tv-nav-link">'+uiIcon('trend',19)+
    '<span>Painel TV</span></button>':'');
  const desktopIdentity='<div class="brand brand-lockup">'+mark+'</div>';
  root.innerHTML='<div class="app-shell mobile-c-app"><aside class="sidebar">'+desktopIdentity+
    '<nav class="nav" aria-label="Menu principal">'+menu+'</nav>'+
    '<div class="sidefoot"><strong>'+h(state.profile.full_name)+'</strong><br>'+h(profileLabel(state.profile))+
    '<br><button class="plain" data-action="my-password">Minha senha</button>'+
    '<br><button class="plain" data-action="logout">Sair da conta</button></div></aside>'+
    '<div class="main"><header class="topbar"><div class="topbar-brand cdsb-mobile-identity"><img src="./cdsb-emblem.jpg" alt="" width="38" height="38"><span>CDSB</span></div>'+
    '<div class="topbar-right"><span class="userpill">'+h(state.profile.full_name)+' · '+h(profileLabel(state.profile))+'</span>'+
    '<button type="button" class="mobile-top-menu only-mobile" aria-label="Abrir menu de navegação" aria-haspopup="dialog" aria-expanded="false" data-action="mobile-more">'+uiIcon('menu',23)+'</button></div></header>'+
    '<main class="content">'+pageContent()+'</main></div></div>';
  hydrateImages();
  const hub=root.querySelector('.sh-hub');
  if(hub)filterStoreHub(hub,state.storeHubFilter.search,state.storeHubFilter.type,state.storeHubFilter.status);
  if(state.pendingOrderFocus&&state.view==='pedidos'){
   const focus=state.pendingOrderFocus;
   const card=[...root.querySelectorAll('[data-order-card]')].find(el=>
    el.dataset.orderKind===focus.kind&&el.dataset.orderId===focus.id);
   if(card){
    card.querySelector('details.uo-order-open')?.setAttribute('open','');
    card.querySelector('details.uo-details')?.setAttribute('open','');
    card.scrollIntoView({block:'center',behavior:'smooth'});
   }
   state.pendingOrderFocus=null;
  }
}

function pageContent(){
  if(state.view==='minha-loja')return permanentPage();
 if(state.view==='meu-evento')return temporaryPage();
 if(state.view==='separador')return separationHomePage();
 if(state.view==='entrada'||state.view==='saida')return renderStockOperationPage();
  if(state.view==='avarias')return damageStockPage();
  if(state.view==='produtos')return productsPage();
  if(state.view==='compras')return purchasesPage({products:state.items,suppliers:state.suppliers,balances:state.balances,
   reservations:state.stockReservations,orders:state.purchaseOrders,items:state.purchaseItems,models:state.apparelModels,categories:state.categories,tags:state.tags,
   button,filter:state.purchaseSupplierFilter,catalog:state.purchaseCatalog,cart:state.purchaseCart,expanded:state.purchaseExpanded,
   orderFilter:state.purchaseOrderFilter,tab:state.purchaseTab,tasks:state.procurementTasks,tasksHTML:procurementTasksHTML(state.procurementTasks,state.suppliers,state.users,button,true)});
  if(state.view==='eventos')return state.activeEvent?(state.eventWorkflow==='return'?returnWorkflowPage():eventDetails()):storesPage();
  if(state.view==='movimentacoes')return movementsPage();
  if(state.view==='pedidos')return ordersPage();
  if(state.view==='separacao')return ordersPage();
  if(state.view==='categorias')return categoriesPage();
  if(state.view==='gondolas')return gondolasPageHTML(state.gondolas,{button,canManage:canManageGondolas()});
  if(state.view==='tags')return tagsPage();
  if(state.view==='usuarios')return usersPage();
  if(state.view==='lojas')return storesPage();
  if(state.view==='lojas-admin')return storesAdminPage();
  if(state.view==='pedidos-lojas')return ordersPage();
  return dashboard()+(state.procurementTasks.some(t=>t.assigned_to===state.user?.id&&['pendente','em_andamento'].includes(t.status))?
   procurementTasksHTML(state.procurementTasks.filter(t=>t.assigned_to===state.user?.id),state.suppliers,state.users,button,false):'');
}
function permanentPage(){
 const units=state.stores.filter(s=>!s.is_primary&&assignedStore(s.id)&&s.kind==='franquia'&&s.active);
 const ids=new Set(units.map(s=>s.id));
 const orders=state.storeOrders.filter(o=>ids.has(o.to_store_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 return permanentHome({stores:units,orders:orders.map(o=>({...o,code:orderCode('loja',o.id)})),
   button,time:niceTime,userId:state.user?.id});
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
    canDeleteWholeModel:()=>isAdmin()&&hasPermission('system.force_delete'),
    canDeleteProduct:()=>hasPermission('products.delete')||hasPermission('system.force_delete'),
    canEditProduct:()=>hasPermission('products.edit'),
    canBalance:()=>!isFranchisePortal()&&hasPermission('stock.balance')&&['admin','gerente','estoquista'].includes(state.profile?.role),
    canStockEntry:()=>hasPermission('stock.entry'),canStockExit:()=>hasPermission('stock.exit'),
    historyForGroup:g=>state.movements.filter(m=>g.products.some(p=>p.id===m.product_id)).slice(0,10),
    purchases:purchasePendingByProduct(state.purchaseOrders,state.purchaseItems),
    categories:state.categories,
    expanded:state.expandedProductGroups.has(group.key),canShare:canRegisterProducts(),
    canLabel:!isFranchisePortal()
  });
}
function dashboard(){
  return renderOperationsDashboard({state,h,uiIcon,qtyAvailable,categoryChain,purchaseSuggestions,
    hasPermission,canRegisterProducts,permittedView,unifiedOrderRecords,dateToday});
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
    (hasPermission('products.delete')||hasPermission('system.force_delete')?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+'</div></div></article>';
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
  const variants=state.items.filter(p=>p.apparel_model_id===modelId&&!p.force_archived_at);
  if(!variants.length)return toast('Não há variações neste modelo.',true);
  while(document.querySelector('.modalback'))closeTopModal();
  const overlay=document.createElement('div');
  overlay.className='modalback';
  const rows=variants.map(p=>'<div class="product-model-manage-item">'+
    '<div><strong>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||p.name)+'</strong>'+
      '<small>SKU: '+h(p.sku||'—')+' · EAN: '+h(p.ean||'—')+'</small>'+
      (!p.active?'<small>Variação inativa</small>':'')+'</div>'+
    '<div class="actions">'+button('Etiqueta','shelf-label-one','data-id="'+h(p.id)+'"','small')+
      button('Editar','product-edit','data-id="'+h(p.id)+'"','small')+
      (hasPermission('products.delete')||hasPermission('system.force_delete')?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+
    '</div></div>').join('');
  overlay.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="Editar '+h(model.name)+'">'+
    '<div class="modalhead"><h2>Editar produto · '+h(model.name)+'</h2>'+
      '<button type="button" class="plain" data-action="modal-close" aria-label="Fechar">✕</button></div>'+
    '<div class="product-model-manage">'+
      '<p>Escolha o tamanho que deseja editar. Cada variação tem EAN, SKU e estoque independentes.</p>'+
      '<div class="product-model-manage-actions">'+
        button('Alterar foto','apparel-photo','data-id="'+h(modelId)+'"','small')+
        button('Etiquetas 80 mm','shelf-label-open','data-id="'+h(variants[0].id)+'"','small')+
        button('+ Adicionar tamanhos','add-variants','data-id="'+h(modelId)+'"','small primary')+
        (isAdmin()&&hasPermission('system.force_delete')?
         button('Excluir produto completo','product-model-delete','data-id="'+h(modelId)+'"','small danger'):'')+
      '</div>'+
      rows+
    '</div></section>';
  document.body.append(overlay);
  overlay.querySelector('[data-action="modal-close"]')?.focus({preventScroll:true});
}

function productsPage(){
  if(isFranchisePortal())return franchiseCatalogPage();
  const q=state.search.trim();
  const modelNames=new Map(state.apparelModels.map(m=>[m.id,m.name]));
  const gondolas=availableGondolas(state.items.filter(p=>!p.force_archived_at&&(state.showInactiveProducts||p.active)));
  const matched=state.items.filter(p=>!p.force_archived_at&&(state.showInactiveProducts||p.active)&&
    catalogMatchesQuery(p,q,modelNames.get(p.apparel_model_id)||'')&&
    (!state.categoryFilter||categoryChain(p.category_id).some(c=>c.id===state.categoryFilter))&&
    (!state.tagFilter||(p.tags||[]).includes(state.tagFilter)));
  const groupKeys=new Set(matched.map(p=>p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  // A busca por um único EAN retorna o modelo completo com todos os seus tamanhos.
  const expanded=state.items.filter(p=>(state.showInactiveProducts||p.active)&&
    groupKeys.has(p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  const groups=orderCatalogGroups(
    filterCatalogGondola(groupInventory(expanded,state.apparelModels),state.gondolaFilter),
    state.catalogSort,qtyAvailable,qtyStore
  );
  const filtersApplied=Boolean(q||state.categoryFilter||state.tagFilter||state.gondolaFilter||state.showInactiveProducts);
  const available=state.items.filter(p=>p.active).length;
  const pageSize=5,totalPages=Math.max(1,Math.ceil(groups.length/pageSize));
  state.page=Math.max(0,Math.min(state.page,totalPages-1));
  const list=groups.slice(0,(state.page+1)*pageSize);
  const add=(hasPermission('stock.entry')?button('↓ Receber remessa','stock-receive-shipment','',''):'')+
    (hasPermission('stock.balance')?button('Imprimir estoque','buy-print-stock','','small'):'')+
    (hasPermission('products.create')?button('+ Novo produto','product-new','','primary'):'');
  return '<header class="pagehead products-pagehead"><div><h1>Produtos</h1>'+
    '<p>Catálogo e estoque</p></div><div class="actions">'+add+'</div></header>'+
    '<section class="panel products-panel"><div class="product-toolbar-v3">'+
      '<div class="product-search-row">'+
        '<input id="product-search" type="search" class="search" autocomplete="off"'+
        ' placeholder="Buscar nome, EAN, SKU, cor ou gôndola…" aria-label="Buscar produtos" value="'+h(state.search)+'">'+
        '<button type="button" class="product-scan-btn" data-action="search-scan" aria-label="Ler EAN pela câmera" title="Ler EAN">'+
          uiIcon('scan',23)+'</button></div>'+
      '<div class="product-filter-row">'+
        '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="filter" aria-haspopup="dialog">'+
          '<span>'+h(state.categoryFilter?categoryFull(state.categoryFilter):'Todas as categorias')+'</span><span aria-hidden="true">⌄</span></button>'+
        '<button type="button" class="taxonomy-filter-button product-filter-chip" data-action="taxonomy-open" data-mode="tag" aria-haspopup="dialog">'+
          '<span>'+h(state.tagFilter||'Tags')+'</span><span aria-hidden="true">⌄</span></button>'+
      '</div>'+
      '<div class="catalog-sorting-row" aria-label="Ordenação e localização dos produtos">'+
        '<label class="catalog-filter-field"><span>Ordenar por</span><select data-product-sort aria-label="Ordenar produtos">'+
          catalogSortOptions.map(([key,label])=>'<option value="'+h(key)+'"'+(state.catalogSort===key?' selected':'')+'>'+h(label)+'</option>').join('')+
        '</select></label>'+
        '<label class="catalog-filter-field"><span>Gôndola</span><select data-product-gondola aria-label="Filtrar por gôndola">'+
          '<option value="">Todas as gôndolas</option>'+
          gondolas.map(g=>'<option value="'+h(g.key)+'"'+(state.gondolaFilter===g.key?' selected':'')+'>'+h(g.label)+'</option>').join('')+
        '</select></label>'+
      '</div>'+
      '<div class="product-filter-tools">'+
        button(state.showInactiveProducts?'✓ Inativos visíveis':'Mostrar inativos',
          'products-toggle-inactive','','small catalog-inactive-toggle'+(state.showInactiveProducts?' active':'') )+
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
function eventsPage(){
  const add=hasPermission('events.manage')?button('+ Nova loja temporária','event-new','','primary'):'';
  return tabHead('Lojas temporárias','Consignação: envio, venda, devolução e conciliação.',add)+
    '<div class="eventgrid">'+state.events.filter(e=>!e.deleted_at).map(e=>{
      const remaining=state.balances.filter(b=>b.event_id===e.id).reduce((s,b)=>s+b.quantity,0);
      return '<article class="panel event-card">'+eventCoverCard(e,true)+pill(e.status)+'<h3>'+h(e.name)+'</h3><p class="muted">'+niceDate(e.starts_at)+(e.ends_at?' até '+niceDate(e.ends_at):'')+'</p>'+
        '<div class="statsline"><div class="statline">Na loja temporária <b>'+remaining+'</b> un.</div></div>'+
        button('Gerenciar local','event-detail','data-id="'+h(e.id)+'"','primary')+
        (hasPermission('system.force_delete')||(isManager()&&hasPermission('events.close')&&hasPermission('events.return')&&(isAdmin()||state.profile?.role==='gerente'))?
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
 const lots=eventLotsOverview({event:e,batches:state.eventPickBatches,items:state.eventBatchItems,
  products:state.items,button,canCreate:e.status!=='encerrado'&&(
   (isManager()&&hasPermission('events.separate'))||
   (hasPermission('events.request')&&Boolean(memberRole(e.id)))),
  time:niceTime,codeForBatch:id=>orderCode('evento',id)});
 const summary=eventCompactDetail({
  event:e,members,balances:state.balances,movements:state.movements,
  damageItems:state.damages,closure:state.consignationClosures.find(x=>x.event_id===e.id),
  products:state.items,models:state.apparelModels,groupInventory,photoButton,
  h,button,niceDate,username,ordersMarkup:lots,tab:state.eventUnitTab,
  openOrders:state.eventPickBatches.filter(b=>b.event_id===e.id&&
    !['enviado','cancelado'].includes(b.status)).length,
  canSettle:e.status==='ativo'&&(
   (hasPermission('events.close')&&hasPermission('events.manage'))||
   (hasPermission('events.request')&&memberRole(e.id)==='responsavel')),
  canClose:hasPermission('events.close')&&(hasPermission('events.manage')||memberRole(e.id)==='responsavel'),
  canManage:hasPermission('events.manage'),
  canDelete:hasPermission('system.force_delete')||(hasPermission('events.manage')&&hasPermission('events.close')&&
   hasPermission('events.return')&&(isAdmin()||state.profile?.role==='gerente'))
 });
 return summary.replace('<header class="event-simple-head su-header">',
  eventCoverCard(e,true)+'<header class="event-simple-head su-header">');
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
  return toast('Este pedido já foi enviado ou cancelado.',true);
 const saved=batch?state.eventBatchItems.filter(x=>x.batch_id===batch.id):[];
 // Pré-calcula o saldo livre em O(produtos + reservas), mesmo com catálogos grandes.
 const free=new Map();
 for(const balance of state.balances)if(!balance.event_id)
  free.set(balance.product_id,Number(balance.quantity)||0);
 for(const hold of state.stockReservations)
  if(hold.status==='ativa'&&(!batch||hold.event_batch_id!==batch.id))
   free.set(hold.product_id,(free.get(hold.product_id)||0)-Number(hold.quantity||0));
 const groups=eventPickingRows(state.items,state.apparelModels,saved,
  id=>Math.max(0,free.get(id)||0));
 const canSeeAvailable=isManager();
 formModal((batch?'Editar pedido #'+orderCode('evento',batch.id):'Novo pedido')+' · '+e.name,
  eventLotForm(lotCatalogMarkup(groups,state.categories,state.apparelModels,{showAvailable:canSeeAvailable}),
   {edit:Boolean(batch),number:batch?.sequence,note:batch?.note||''}),
  'event-batch-write',batch?'Salvar nova revisão':'Enviar à separação');
 const form=document.querySelector('.modalback form[data-form="event-batch-write"]');
 if(form){
  form.dataset.event=e.id;form.dataset.batch=batch?.id||'';
  form.closest('.modal')?.classList.add('lot-catalog-modal');
  form.dataset.orderDestination=e.name;
  if(!batch){const submit=form.querySelector('.modalfooter button[type="submit"]');if(submit)submit.textContent='Revisar pedido';}
  mountLotCatalog(form,{groups,categories:state.categories,models:state.apparelModels,
    showAvailable:canSeeAvailable,onRender:()=>{hydrateImages();}});
  refreshEventLotCounter(form);
  // O formulário padrão focaliza o primeiro campo com "name" (a observação no fim).
  // Neste catálogo, a abertura deve começar pela busca e pela variedade de modelos.
  form.scrollTop=0;
  form.querySelector('[data-lot-search]')?.focus({preventScroll:true});
 }
}
function refreshEventLotCounter(form){
 if(!form)return;
 const {models,units:total}=form.__lotPicker?selectedLotCount(form):(()=>{
  const items=[...form.querySelectorAll('[data-plan-qty]')].map(el=>({
   product_id:el.dataset.id,quantity:Math.max(0,Number(el.value)||0)
  }));
  return {models:selectedEventModels(items,state.items),units:items.reduce((n,x)=>n+x.quantity,0)};
 })();
 const target=form.querySelector('[data-event-lot-counter]');
 if(target){
  target.textContent=models+' modelo(s) · '+total+' unidades selecionadas';
  target.classList.remove('is-over-limit');
 }
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.disabled=models<1||Boolean(form.__lotPicker?.invalid);
}
function operationalLocateSku(form,rawCode){
 const order=unifiedOrderById(form?.dataset.kind,form?.dataset.order);
 if(!order)return;
 const code=String(rawCode||'').trim();
 if(!code)return;
 const matches=order.lines.filter(line=>line.ean===code||line.sku===code);
 if(matches.length!==1)return toast(matches.length?'EAN/SKU ambíguo neste pedido.':'Produto não pertence ao pedido.',true);
 const row=[...form.querySelectorAll('[data-op-line]')].find(el=>el.dataset.product===matches[0].id);
 if(!row)return;
 form.querySelectorAll('.op-line.is-selected').forEach(el=>el.classList.remove('is-selected'));
 row.classList.add('is-selected');
 row.scrollIntoView({behavior:'smooth',block:'center'});
 row.querySelector('[data-op-qty]')?.focus({preventScroll:true});
 toast('SKU localizado: '+(matches[0].modelTitle||matches[0].name)+'. Informe a quantidade encontrada.');
}
function operationalModal(kind,id,mode='separacao'){
 const order=unifiedOrderById(kind,id);
 if(!order||isFranchisePortal())return toast('Pedido indisponível.',true);
 const canPick=kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
   hasPermission('orders.separate')&&(kind==='avulso'||assignedStore(order.raw.from_store_id));
 if(!canPick)return toast('Sem permissão.',true);
 const stage=order.workflow?.stage;
 if(mode==='separacao'&&!(stage==='separacao'||(!stage&&(
   kind==='evento'?['aguardando','em_separacao'].includes(order.status):
   kind==='loja'?order.status==='aprovado':order.status==='reservado'))))
  return toast('O pedido não está disponível para separação.',true);
 if(mode==='conferencia'&&!(stage==='conferencia'||(!stage&&order.status==='separado')))
  return toast('Conclua primeiro a separação.',true);
 formModal((mode==='conferencia'?'Conferência':'Separação')+' · '+order.code,
  operationalFormMarkup(order,mode,state.orderVerificationRows),'order-operational',
  'Salvar progresso');
 const form=document.querySelector('.modalback form[data-form="order-operational"]');
 if(!form)return;
 form.dataset.kind=kind;form.dataset.order=id;form.dataset.mode=mode;
 form.querySelector('.modalfooter')?.insertAdjacentHTML('beforeend',
  '<button type="button" class="button primary" data-action="order-op-finish">'+
    (mode==='conferencia'?'Concluir conferência':'Concluir separação')+'</button>');
 form.closest('.modal')?.classList.add('operational-modal');
 hydrateImages();
}
function readOperationalItems(form){
 const order=unifiedOrderById(form?.dataset.kind,form?.dataset.order);
 if(!order)throw Error('Pedido não encontrado');
 const rows=[...form.querySelectorAll('[data-op-line]')];
 if(rows.length!==order.lines.length)throw Error('Todos os SKUs devem ser conferidos');
 const result={};
 for(const row of rows){
  const input=row.querySelector('[data-op-qty]'),raw=input?.value?.trim()??'';
  const qty=raw===''?NaN:Number(raw),expected=Number(row.dataset.expected);
  const reason=row.querySelector('[data-op-reason]')?.value.trim()||'';
  if(!Number.isInteger(qty)||qty<0||qty>expected)
   throw Error('Informe para cada SKU um número de 0 até a quantidade solicitada');
  if(reason.length>250)throw Error('Motivo deve ter no máximo 250 caracteres');
  result[row.dataset.product]={quantity:qty,reason};
 }
 return result;
}
async function submitOperational(form,finish=false){
 if(!form||state.loading)return;
 let items;try{items=readOperationalItems(form);}catch(e){return toast(e.message,true);}
 const order=unifiedOrderById(form.dataset.kind,form.dataset.order);
 if(!order)return;
 const mismatch=order.lines.some(line=>Number(items[line.id]?.quantity)!==Number(line.quantity));
 if(finish&&mismatch&&order.lines.some(line=>Number(items[line.id]?.quantity)<Number(line.quantity)&&
  String(items[line.id]?.reason||'').length<5&&
  String(order.workflow?.items?.[line.id]?.pick_reason||'').length<5))
  return toast('Explique a falta ou divergência de cada SKU (mínimo de 5 caracteres).',true);
 const msg=finish?(form.dataset.mode==='conferencia'?
   'Conferência concluída. Pedido encaminhado à expedição.':
   'Separação concluída. Pedido encaminhado à conferência.'):'Progresso registrado.';
 return exec(async()=>{
  const out=assertOk(await db.rpc(form.dataset.mode==='conferencia'?
   'save_operational_check':'save_operational_pick',{
     p_kind:order.kind,p_order:order.id,p_items:items,p_finish:finish
   }));
  return out;
 },msg);
}
function finalVerificationModal(kind,id){
 const order=unifiedOrderById(kind,id);
 if(!order||order.status!=='separado'||isFranchisePortal()||!(
  kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
  hasPermission('orders.separate')&&(kind==='avulso'||assignedStore(order.raw.from_store_id))
 ))return toast('Sem acesso ou pedido ainda não separado.',true);
 const p=verificationProgress(order,state.orderVerificationRows);
 formModal('Conferência final · Pedido '+order.code,
   finalVerificationMarkup(order,state.orderVerificationRows),'order-final-verify','Fechar');
 const form=document.querySelector('.modalback form[data-form="order-final-verify"]');
 if(!form)return;
 form.dataset.kind=kind;
 form.dataset.order=id;
 const submit=form.querySelector('button[type="submit"]');
 if(submit){submit.type='button';submit.dataset.action='modal-close';
  if(p.complete)submit.textContent='Voltar ao pedido';}
 form.closest('.modal')?.classList.add('final-verify-modal');
 const reader=form.querySelector('[data-verify-scan]');
 reader?.focus({preventScroll:true});
 hydrateImages();
 if(p.complete)form.querySelector('[data-verify-feedback]').textContent=
   'Conferência final concluída. Todos os SKUs estão corretos. Volte ao pedido para confirmar a saída.';
}
function verificationSelectLine(form,line,code,previousCount=null){
 form.__verification={
  productId:line.id,scannedCode:String(code).trim(),
  isCorrection:previousCount!==null
 };
 const panel=form.querySelector('[data-verify-selected]');
 if(!panel)return;
 panel.hidden=false;
 form.querySelector('[data-verify-selected-name]').textContent=
   (line.modelTitle||line.name)+' · '+(line.color||'')+' '+(line.size||'')+
   ' · Solicitado: '+line.quantity+' un.';
 const input=form.querySelector('[data-verify-quantity]');
 input.value=previousCount===null?'':String(previousCount);
 input.max='1000000';
 const btn=panel.querySelector('[data-verify-submit]');
 if(btn)btn.textContent=previousCount===null?'Confirmar quantidade deste SKU':'Salvar correção';
 const help=panel.querySelector('[data-verify-selected-help]');
 if(help)help.textContent=previousCount===null?
  'Conte as unidades físicas e confirme a quantidade encontrada.':
  'Quantidade registrada: '+previousCount+' un. · Solicitado: '+line.quantity+' un. Corrija a contagem e salve novamente.';
 const feedback=form.querySelector('[data-verify-feedback]');
 if(feedback){
  feedback.textContent=previousCount===null?
   'Produto identificado. Conte as unidades físicas e informe a quantidade encontrada.':
   'Editando conferência anterior. Informe a quantidade correta para este SKU.';
  feedback.classList.remove('is-error');
 }
 panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 input.focus({preventScroll:true});
 if(previousCount!==null)input.select?.();
}
function verificationEditItem(form,productId){
 const order=unifiedOrderById(form?.dataset.kind,form?.dataset.order);
 if(!order||order.status!=='separado')return toast('Pedido indisponível para corrigir a conferência.',true);
 const line=verificationProgress(order,state.orderVerificationRows).lines.find(x=>x.id===productId);
 const stored=line?.verification;
 if(!stored?.scanned_code)return toast('Leia novamente o EAN/SKU para conferir este produto.',true);
 // Revalida o identificador salvo. Não permite corrigir outro SKU ou pular a validação do servidor.
 const verified=findVerificationProduct(order,stored.scanned_code);
 if(verified.error||verified.line.id!==line.id)
  return toast('Código registrado não corresponde ao produto atual. Leia o EAN novamente.',true);
 verificationSelectLine(form,line,stored.scanned_code,line.actual);
}
function verificationReadCode(form,code){
 const order=unifiedOrderById(form?.dataset.kind,form?.dataset.order);
 if(!order)return;
 const result=findVerificationProduct(order,code);
 if(result.error){
  form.__verification=null;
  const selected=form.querySelector('[data-verify-selected]');
  if(selected)selected.hidden=true;
  const feedback=form.querySelector('[data-verify-feedback]');
  if(feedback){feedback.textContent=result.error;feedback.classList.add('is-error');}
  form.querySelector('[data-verify-scan]')?.focus();
  return;
 }
 verificationSelectLine(form,result.line,code);
}
async function saveFinalVerification(form){
 if(state.loading||!form?.__verification)return toast('Selecione um SKU ou leia seu EAN para informar a quantidade.',true);
 const order=unifiedOrderById(form.dataset.kind,form.dataset.order);
 if(!order)return toast('Pedido não encontrado.',true);
 const raw=form.querySelector('[data-verify-quantity]')?.value?.trim()??'';
 const qty=raw===''?NaN:Number(raw);
 if(!Number.isInteger(qty)||qty<0||qty>1000000)
   return toast('Informe a quantidade física encontrada (número inteiro).',true);
 const item=form.__verification;
 state.loading=true;
 try{
  const result=assertOk(await db.rpc('save_order_final_verification',{
    p_kind:order.kind,p_order:order.id,p_product:item.productId,
    p_scanned_code:item.scannedCode,p_counted:qty
  }));
  const saved=assertOk(await db.from('order_final_verifications')
    .select('kind,order_id,product_id,expected_quantity,counted_quantity,scanned_code,verified_by,verified_at')
    .eq('kind',order.kind).eq('order_id',order.id));
  state.orderVerificationRows=state.orderVerificationRows.filter(r=>!(
    r.kind===order.kind&&r.order_id===order.id)).concat(saved);
  // Atualiza os botões por trás do modal: "Confirmar saída" só aparece após 100%.
  render();
  if(result.complete)toast('Conferência final concluída. Volte ao pedido para confirmar a saída.');
  else if(qty!==Number(order.lines.find(x=>x.id===item.productId)?.quantity))
   toast('Divergência salva. Confira a contagem e use Corrigir quantidade.',true);
  else toast(item.isCorrection?'Correção salva. Continue a conferência.':'SKU conferido. Pode ler o próximo.');
  finalVerificationModal(order.kind,order.id);
 }catch(error){fail(error);}
 finally{state.loading=false;}
}
function eventBatchPickModal(id){
 const o=unifiedOrderById('evento',id);
 if(!o||!['aguardando','em_separacao','separado'].includes(o.status)||
 isFranchisePortal()||!(hasPermission('orders.separate')||hasPermission('events.separate')))return;
 formModal('Separação · Pedido #'+o.code+' · '+o.target,
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
 if(!order)throw Error('Pedido não encontrado');
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
 if(finish&&!complete)return toast('Confira todas as unidades. Se faltarem peças, peça ao gerente para revisar o pedido.',true);
 return exec(async()=>{
  const status=assertOk(await db.rpc('save_event_batch_picking',{
    p_batch:form.dataset.batch,p_items:items
  }));
  return status;
 },finish?'Pedido totalmente separado. Aguardando confirmação da saída.':
    'Progresso salvo. Pode continuar a separação mais tarde.');
}
function eventBatchCancelModal(id){
 if(!isManager()||!hasPermission('events.separate'))return;
 const batch=state.eventPickBatches.find(b=>b.id===id);
 if(!batch||['enviado','cancelado'].includes(batch.status))return;
 formModal('Cancelar pedido '+String(batch.sequence).padStart(2,'0'),
  '<p class="help">O pedido será cancelado, suas reservas liberadas e o histórico preservado.</p>'+
  '<label class="field"><span>Justificativa obrigatória</span>'+
  '<textarea name="reason" required minlength="5" maxlength="250" placeholder="Motivo do cancelamento"></textarea></label>',
  'event-batch-cancel','Cancelar pedido');
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
 if(form.__lotPicker)return collectLotItems(form);
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
  EVENT_BATCH_CREATED:'Criou pedido para loja temporária',EVENT_BATCH_REVISED:'Revisou pedido',
  EVENT_BATCH_CANCELED:'Cancelou pedido',CLOSED_RECONCILED:'Encerrou evento',
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
  button('Exportar estoque CSV','export-csv','','small')+button('Imprimir atividades','buy-print-activities','','small'))+
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
  products:state.items,adjustments:state.unifiedOrderAdjustments,codes:state.orderCodes,
  progress:state.orderOperationalRows,
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
 const contextEvent=scope?.type==='event'?eventById(scope.id):null;
 const canCreateContextLot=Boolean(contextEvent&&['rascunho','ativo'].includes(contextEvent.status)&&
   ((isManager()&&hasPermission('events.separate'))||
     (hasPermission('events.request')&&Boolean(memberRole(contextEvent.id)))));
 const allRecords=unifiedOrderRecords();
 const records=scope?locationOrders(allRecords,scope,scope.mode||'all'):allRecords;
 const contextTitle=scope?.type==='central'?'Centro de Distribuição São Bento':
   scope?.type==='store'?(state.stores.find(s=>s.id===scope.id)?.name||'Loja'):
   scope?.type==='event'?(eventById(scope.id)?.name||'Loja temporária'):'';
 const contextHeader=scope?
  '<div class="sh-context"><div>'+button(scope?.type==='store'||scope?.type==='event'?'← Voltar à unidade':'← Lojas','store-hub-back','','small')+
  '<strong>'+h(contextTitle)+'</strong><span>'+(scope.mode==='pending'?'Pedidos em andamento':
    scope.mode==='history'?'Histórico de pedidos':'Todos os pedidos')+'</span></div>'+
  button('Mostrar todos os pedidos','store-hub-reset','','small')+'</div>':'';
 return contextHeader+unifiedOrdersPage(records,{
  button,time:niceTime,portal,separationOnly,linksMarkup:links,summaryLink:activeAccess+' ativo(s)',
  canProcess:o=>!portal&&(
    o.kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
    hasPermission('orders.separate')&&(o.kind==='avulso'||assignedStore(o.raw.from_store_id))),
  canDispatch:o=>o.kind==='evento'&&!portal&&isManager()&&hasPermission('orders.dispatch'),
  canDispatchStock:o=>!portal&&hasPermission('orders.dispatch')&&(o.kind==='avulso'||assignedStore(o.raw.from_store_id)),
  canVerify:o=>!portal&&o.status==='separado'&&(
    o.kind==='evento'?(hasPermission('orders.separate')||hasPermission('events.separate')):
    hasPermission('orders.separate')&&(o.kind==='avulso'||assignedStore(o.raw.from_store_id))),
  isVerified:o=>verificationCanDispatch(o,state.orderVerificationRows),
  hasIssue:o=>state.orderVerificationRows.some(row=>
    row.kind===o.kind&&row.order_id===o.id&&
    (Number(row.counted_quantity)!==Number(row.expected_quantity))),
  canAdjust:o=>!portal&&hasPermission('orders.dispatch'),
  canDelete:o=>!portal&&isAdmin(),
  canCancel:o=>o.kind==='evento'?(!portal&&isManager()&&hasPermission('events.separate')):
    (portal&&o.kind==='loja'&&o.isOwner&&
     ['solicitado','pendente_estoque','aprovado'].includes(o.status))||
     (!portal&&hasPermission('orders.cancel')&&
      (o.kind==='avulso'||assignedStore(o.raw.to_store_id))),
  canReceive:o=>!portal&&o.kind==='loja'&&hasPermission('orders.receive')&&assignedStore(o.raw.to_store_id),
  canEventBatch:canCreateContextLot,
  eventId:contextEvent?.id||'',
  canAvulso:!contextEvent&&!portal&&hasPermission('orders.internal'),
  canStore:hasPermission('orders.central')||hasPermission('orders.franchise'),
  canEventBatch:!portal&&state.events.some(e=>['rascunho','ativo'].includes(e.status)&&
    ((isManager()&&hasPermission('events.separate'))||
     (hasPermission('events.request')&&Boolean(memberRole(e.id))))),
  canLink:false
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
 if(!isAdmin())return '<p class="help">Acesso restrito ao administrador CDSB.</p>';
 const archived=state.usersAdminArchived===true;
 const active=state.users.filter(u=>!u.archived_at),removed=state.users.filter(u=>Boolean(u.archived_at));
 const dataset=archived?removed:active;
 const counters=[['Ativos',active.filter(x=>x.active).length],['Bloqueados',active.filter(x=>!x.active).length],['Arquivados',removed.length]];
 const entry=u=>'<article class="um-user" data-user-row data-user-filter="'+h([u.full_name,u.username,profileLabel(u)].join(' ').toLowerCase())+'" data-user-role="'+h(u.role)+'">'+
  '<div class="um-user-main"><span class="um-avatar" aria-hidden="true">'+h((u.full_name||'?').slice(0,1).toUpperCase())+'</span>'+
   '<div class="um-user-names"><strong>'+h(u.full_name)+'</strong><small>@'+h(u.username)+'</small></div></div>'+
  '<div class="um-user-details"><span class="um-role">'+h(profileLabel(u))+'</span>'+ 
   (state.staffContactDetails.find(d=>d.user_id===u.id)?.job_title?'<small class="um-linked">'+h(state.staffContactDetails.find(d=>d.user_id===u.id).job_title)+'</small>':'')+
   '<span class="pill '+(u.archived_at?'encerrado':u.active?'ativo':'encerrado')+'">'+(u.archived_at?'Excluído':u.active?'Ativo':'Bloqueado')+'</span>'+
   (u.role==='franquia'?'<small class="um-linked">'+h(state.stores.filter(s=>state.staffStores.some(a=>a.user_id===u.id&&a.store_id===s.id)).map(x=>x.name).join(', ')||'Sem loja vinculada')+'</small>':'')+
  '</div><div class="um-user-actions">'+
   (u.archived_at?button('Restaurar','user-restore','data-id="'+h(u.id)+'"','small'):
    button('Editar','user-edit','data-id="'+h(u.id)+'"','small')+
    (u.id===state.user?.id?'':button('Perfil e acessos','user-role','data-id="'+h(u.id)+'"','small')+
     button('Senha','set-user-password','data-id="'+h(u.id)+'"','small')+
     button(u.active?'Bloquear':'Reativar','user-toggle','data-id="'+h(u.id)+'"','small')+
     button('Excluir','user-delete','data-id="'+h(u.id)+'"','small danger'))+
    (u.id===state.user?.id?button('Minha senha','my-password','','small'):''))+
  '</div></article>';
 return tabHead('Usuários','Administre pessoas, perfis, vínculos e acessos em um só lugar.',
   button('Preparar 6 contas CDSB','users-provision','','small')+button('+ Novo usuário','user-new','','primary'))+
  '<div class="um-shell"><div class="um-totals">'+counters.map(([name,val])=>
   '<div><strong>'+val+'</strong><small>'+name+'</small></div>').join('')+'</div>'+
  '<div class="um-filters"><label class="um-search"><span>Buscar usuário</span><input type="search" data-users-search placeholder="Nome, usuário ou função..."></label>'+
   '<label><span>Perfil</span><select data-users-filter-role><option value="">Todos os perfis</option>'+
   Object.entries(roles).map(([role,title])=>'<option value="'+h(role)+'">'+h(title)+'</option>').join('')+'</select></label>'+
   button(archived?'Ver equipe atual':'Ver arquivados','users-archived-toggle','','small')+'</div>'+
  '<section class="um-list" data-users-list>'+ (dataset.length?dataset.map(entry).join(''):
   '<p class="um-empty">'+(archived?'Nenhuma conta arquivada.':'Nenhum usuário cadastrado.')+'</p>')+'</section>'+
  '<p class="um-footnote">Excluir retira a conta da equipe e bloqueia seu login, preservando movimentos, pedidos e auditoria. Contas arquivadas podem ser restauradas.</p></div>';
}
function applyUserListFilter(){
 const root=document.querySelector('.um-shell');if(!root)return;
 const query=(root.querySelector('[data-users-search]')?.value||'').trim().toLowerCase();
 const role=root.querySelector('[data-users-filter-role]')?.value||'';
 for(const el of root.querySelectorAll('[data-user-row]'))
  el.hidden=Boolean((query&&!el.dataset.userFilter.includes(query))||(role&&el.dataset.userRole!==role));
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

function procurementFields(item=null){
 return '<section class="form-section wide"><div class="section-head"><strong>Reposição e compras</strong>'+
  '<small>Controle por SKU/variação; não altera o estoque atual</small></div>'+
  '<div class="formgrid">'+field('Estoque mínimo para reposição','min_stock','number',item?.min_stock??0,
    'min="0" max="1000000" step="1"','Define alerta de reposição, não o mínimo de compra.')+
  field('Pedido mínimo do fornecedor por variação','minimum_order_quantity','number',item?.minimum_order_quantity??1,
    'min="1" max="1000000" step="1" required','Quantidade mínima aceita pelo fornecedor ao comprar este SKU.')+
  selectField('Fornecedor padrão','supplier_id',[['','Sem fornecedor'],...state.suppliers.filter(s=>s.active||s.id===item?.supplier_id).map(s=>[s.id,s.name])],item?.supplier_id||'')+
  '</div><p class="help">Cadastre fornecedores na seção Compras. Para modelos com variações, o mínimo vale por tamanho/SKU.</p></section>';
}
function procurementValues(form){
 const raw=form.elements.namedItem('min_stock')?.value??'0',min=Number(raw);
 if(raw===''||!Number.isInteger(min)||min<0||min>1000000)throw Error('Estoque mínimo deve ser de 0 a 1.000.000 unidades.');
 const supplier=form.elements.namedItem('supplier_id')?.value||null;
 if(supplier&&!state.suppliers.some(s=>s.id===supplier&&s.active))throw Error('Fornecedor inválido ou inativo.');
 const minimumRaw=form.elements.namedItem('minimum_order_quantity')?.value??'1',minimumOrderQuantity=Number(minimumRaw);
 if(minimumRaw===''||!Number.isInteger(minimumOrderQuantity)||minimumOrderQuantity<1||minimumOrderQuantity>1000000)
  throw Error('Pedido mínimo do fornecedor deve ser de 1 a 1.000.000 unidades.');
 return {supplier_id:supplier,min_stock:min,minimum_order_quantity:minimumOrderQuantity};
}
async function saveModelProcurement(modelId,form){
 const v=procurementValues(form);
 assertOk(await db.rpc('set_apparel_procurement',{p_model:modelId,p_supplier:v.supplier_id,p_min_stock:v.min_stock}));
 assertOk(await db.from('products').update({minimum_order_quantity:v.minimum_order_quantity}).eq('apparel_model_id',modelId));
}
function supplierManagerModal(){
 if(!hasPermission('purchases.manage'))return;
 formModal('Fornecedores',supplierListHTML(state.suppliers,button,{products:state.items,orders:state.purchaseOrders,tasks:state.procurementTasks})+
  '<div class="actions">'+button('+ Novo fornecedor','buy-supplier-new','','primary')+'</div>',
  'buy-supplier-list','Fechar');
}
function supplierFormModal(supplier=null){
 if(!hasPermission('purchases.manage'))return;
 formModal(supplier?'Editar fornecedor':'Novo fornecedor','<div class="formgrid">'+
  field('Nome do fornecedor','name','text',supplier?.name||'','required maxlength="150" minlength="2"')+
  field('Contato','contact_name','text',supplier?.contact_name||'','maxlength="140"')+
  field('Telefone / WhatsApp','phone','text',supplier?.phone||'','maxlength="60"')+
  field('Email','email','email',supplier?.email||'','maxlength="180"')+
  field('CNPJ / documento','document','text',supplier?.document||'','maxlength="35"')+
  field('Razão social','legal_name','text',supplier?.legal_name||'','maxlength="180"')+
  field('Função do contato','contact_role','text',supplier?.contact_role||'','maxlength="100"')+
  field('WhatsApp comercial','whatsapp','tel',supplier?.whatsapp||'','maxlength="60"')+
  field('Site','website','url',supplier?.website||'','maxlength="250" placeholder="https://"')+
  field('Endereço','address','text',supplier?.address||'','maxlength="500"')+
  selectField('Canal preferido','preferred_channel',[['','Não informado'],['whatsapp','WhatsApp'],['telefone','Telefone'],['email','E-mail'],['outro','Outro']],supplier?.preferred_channel||'')+
  field('Prazo habitual de entrega (dias)','delivery_days','number',supplier?.delivery_days??'','min="1" max="365" step="1"')+
  field('Pedido mínimo (R$)','minimum_order_amount','text',supplier?.minimum_order_amount??'','inputmode="decimal" placeholder="0,00"')+
  textareaField('Condições de pagamento','payment_terms',supplier?.payment_terms||'')+
  textareaField('Observações','notes',supplier?.notes||'')+
  (supplier?selectField('Situação','active',[['true','Ativo'],['false','Inativo']],String(supplier.active)):'')+
  '</div>','buy-supplier-save','Salvar fornecedor');
 const form=document.querySelector('.modalback form[data-form="buy-supplier-save"]');
 if(form)form.dataset.id=supplier?.id||'';
}

function procurementTaskModal(){
 if(!hasPermission('purchases.manage'))return;
 const assignees=state.users.filter(u=>u.active&&!u.archived_at);
 formModal('Nova tarefa de acompanhamento',
  '<p class="help">A tarefa aparece no painel do responsável e na seção Compras. Nenhuma mensagem externa será enviada.</p>'+
  '<div class="formgrid">'+
   field('Tarefa','title','text','','required minlength="3" maxlength="160"')+
   selectField('Fornecedor','supplier_id',[['','Sem fornecedor'],...state.suppliers.filter(s=>s.active).map(s=>[s.id,s.name])],'')+
   selectField('Responsável','assigned_to',[['','Sem responsável'],...assignees.map(u=>[u.id,u.full_name])],state.user?.id||'')+
   field('Prazo','due_date','date','','')+
   textareaField('Instruções','description','')+
  '</div>','buy-task-create','Criar tarefa');
}
function savePurchaseCart(){
 state.purchaseCart=cleanPurchaseCart(state.purchaseCart,state.items);
 try{sessionStorage.setItem('cdsb-purchase-cart:'+state.user.id,serializePurchaseCart(state.purchaseCart));}
 catch(error){console.warn('Carrinho mantido somente nesta sessão',error);}
}
function updatePurchaseCartDisplay(){
 const summary=purchaseCartSummary(state.purchaseCart,state.items);
 const dock=document.querySelector('[data-buy-cart-dock]');
 if(dock){
  dock.hidden=!summary.skus;
  const label=dock.querySelector('[data-buy-cart-summary]');
  if(label)label.textContent=summary.skus+' SKU(s) · '+summary.units+' unidades · '+summary.suppliers+' fornecedor(es)';
 }
 for(const label of document.querySelectorAll('[data-buy-picked]')){
  const group=purchasingGroups(state.items,state.apparelModels,state.balances,state.stockReservations,
    state.purchaseOrders,state.purchaseItems).find(g=>g.key===label.dataset.buyPicked);
  if(!group)continue;
  const selected=group.variants.filter(p=>state.purchaseCart.has(p.id));
  const units=selected.reduce((n,p)=>n+Number(state.purchaseCart.get(p.id)||0),0);
  label.textContent=selected.length?selected.length+' tamanho(s) · '+units+' un.':'Nenhuma variação selecionada';
  const card=label.closest('[data-buy-card]');
  const total=card?.querySelector('[data-buy-panel-total]');
  if(total)total.textContent=selected.length?selected.length+' tamanho(s) · '+units+' unidades':'Selecione as variações para montar o pedido';
  const review=card?.querySelector('[data-buy-panel-review]');
  if(review)review.hidden=!selected.length;
 }
}
async function loadPurchaseOutflow(groupKey){
 const card=[...document.querySelectorAll('[data-buy-card]')].find(x=>x.dataset.buyCard===groupKey);
 const view=card?.querySelector('[data-buy-outflow]');
 if(!view||view.dataset.loaded==='true'||view.dataset.loaded==='loading')return;
 const group=purchasingGroups(state.items,state.apparelModels,state.balances,state.stockReservations,
  state.purchaseOrders,state.purchaseItems).find(g=>g.key===groupKey);
 if(!group)return;
 view.dataset.loaded='loading';
 const message=view.querySelector('.buy-history-loading');
 if(message)message.textContent='Consultando saídas dos últimos 90 dias…';
 try{
  const result=await db.from('stock_movements').select('product_id,action,quantity,delta_store,created_at')
   .in('product_id',group.variants.map(p=>p.id))
   .gte('created_at',new Date(Date.now()-90*86400000).toISOString())
   .order('created_at',{ascending:false}).limit(3000);
  const moves=assertOk(result)||[],cut=Date.now()-30*86400000;
  const rows=group.variants.map(p=>{
   const out=moves.filter(m=>m.product_id===p.id&&Number(m.delta_store)<0);
   const month=out.filter(m=>new Date(m.created_at).getTime()>=cut);
   const sum=a=>a.reduce((n,m)=>n+Math.abs(Number(m.delta_store)||0),0);
   return '<div class="buy-history-row"><strong>'+h(p.apparel_size||'Único')+
    '<small>SKU '+h(p.sku||'—')+'</small></strong><span>30 dias: <b>'+sum(month)+
    '</b></span><span>90 dias: <b>'+sum(out)+'</b></span></div>';
  }).join('');
  if(!view.isConnected)return;
  view.innerHTML='<div class="buy-panel-history-head"><strong>Saídas do CD · 30/90 dias</strong>'+
   '<small>Saídas físicas não são necessariamente vendas.</small></div>'+
   '<div class="buy-history-rows">'+rows+'</div>'+
   (moves.length===3000?'<p class="buy-history-note">Limite de 3.000 movimentações atingido. Os totais podem estar incompletos.</p>':'')+
   '<p class="buy-history-note">Considere transferências e sazonalidade antes de comprar.</p>';
  view.dataset.loaded='true';
 }catch(error){
  if(view.isConnected){
   view.dataset.loaded='error';
   const loading=view.querySelector('.buy-history-loading');
   if(loading)loading.textContent='Erro ao consultar as saídas. Clique em histórico para tentar novamente.';
  }
  console.warn('Erro ao consultar saídas de compra',error);
 }
}
function setPurchasePanelOpen(groupKey,open){
 const card=[...document.querySelectorAll('[data-buy-card]')].find(x=>x.dataset.buyCard===groupKey);
 const panel=card?.querySelector('[data-buy-expand]');
 if(!panel)return;
 panel.open=open;
 const trigger=card.querySelector('[data-action="buy-open-group"]');
 if(trigger){
  const label=open?'Fechar compra':'Abrir compra';
  trigger.setAttribute('aria-expanded',String(open));
  trigger.setAttribute('aria-label',label);
  trigger.title=label;
  const caption=trigger.querySelector('.buy-action-label');
  if(caption)caption.textContent=label;
 }
 if(open)state.purchaseExpanded.add(groupKey);
 else state.purchaseExpanded.delete(groupKey);
}
function prefillPurchaseMinimums(groupKey){
 const group=purchasingGroups(state.items,state.apparelModels,state.balances,state.stockReservations,
  state.purchaseOrders,state.purchaseItems).find(g=>g.key===groupKey);
 const card=[...document.querySelectorAll('[data-buy-card]')].find(el=>el.dataset.buyCard===groupKey);
 if(!group||!card)return;
 for(const variant of group.variants){
  const shortage=Math.max(0,Number(variant.min_stock||0)-Number(variant.free||0)-Number(variant.pending||0));
  if(!shortage||!variant.supplier_id||state.purchaseCart.has(variant.id))continue;
  const minimum=Math.max(1,Number(variant.minimum_order_quantity||1));
  const line=[...card.querySelectorAll('[data-buy-sku]')].find(el=>el.dataset.buySku===variant.id);
  if(!line)continue;
  const checkbox=line.querySelector('[data-buy-inline-select]');
  const qty=line.querySelector('[data-buy-inline-qty]');
  if(!checkbox||!qty)continue;
  checkbox.checked=true;qty.disabled=false;qty.value=String(minimum);qty.min=String(minimum);
  state.purchaseCart=setPurchaseCartItem(state.purchaseCart,variant.id,minimum);
 }
 savePurchaseCart();updatePurchaseCartDisplay();
}
function purchaseDraftTargetModal(groupKey){
 if(!hasPermission('purchases.manage'))return;
 const group=purchasingGroups(state.items,state.apparelModels,state.balances,state.stockReservations,
   state.purchaseOrders,state.purchaseItems).find(g=>g.key===groupKey);
 if(!group)return toast('Produto não encontrado.',true);
 const selected=group.variants.filter(p=>state.purchaseCart.has(p.id));
 if(!selected.length)return toast('Selecione pelo menos uma variação.',true);
 const supplierIds=[...new Set(selected.map(p=>p.supplier_id))];
 if(supplierIds.length!==1||!supplierIds[0])return toast('Selecione variações de um único fornecedor cadastrado.',true);
 const supplierId=supplierIds[0];
 for(const p of selected){
  const qty=state.purchaseCart.get(p.id),minimum=Number(p.minimum_order_quantity||1);
  if(!validPurchaseQty(qty)||qty<minimum)
   return toast('O tamanho '+(p.apparel_size||p.name)+' exige pedido mínimo de '+minimum+' unidades.',true);
 }
 const supplier=state.suppliers.find(x=>x.id===supplierId);
 if(!supplier?.active)return toast('Fornecedor indisponível.',true);
 const drafts=state.purchaseOrders.filter(o=>o.supplier_id===supplierId&&o.status==='rascunho');
 const options=[['novo','+ Criar novo pedido para '+supplier.name],
  ...drafts.map(o=>[o.id,'PC-'+o.number+' · '+state.purchaseItems.filter(i=>i.purchase_order_id===o.id).length+' SKU(s)'])];
 formModal('Adicionar ao pedido · '+supplier.name,
  '<p class="help">'+selected.length+' variação(ões) · '+selected.reduce((n,p)=>n+Number(state.purchaseCart.get(p.id)),0)+
  ' unidades. Cada pedido pertence exclusivamente a um fornecedor. Escolha um rascunho ou crie um agora.</p>'+
  '<div class="formgrid">'+selectField('Em qual pedido adicionar?','purchase_order_id',options,drafts.length===1?drafts[0].id:'novo')+'</div>',
  'buy-add-draft','Adicionar ao pedido');
 const form=document.querySelector('form[data-form="buy-add-draft"]');
 if(form){form.dataset.group=groupKey;form.dataset.supplier=supplierId;}
}
function purchaseDraftDetails(order){
 if(!order||!hasPermission('purchases.manage'))return;
 const draft=order.status==='rascunho';
 const supplier=state.suppliers.find(s=>s.id===order.supplier_id);
 const items=state.purchaseItems.filter(i=>i.purchase_order_id===order.id);
 const groups=new Map();
 for(const item of items){
  const product=state.items.find(p=>p.id===item.product_id);
  const model=state.apparelModels.find(m=>m.id===product?.apparel_model_id);
  const key=model?.id||item.product_id;
  if(!groups.has(key))groups.set(key,{title:model?.name||item.product_name,photo:model?.image_path||product?.image_path,rows:[]});
  groups.get(key).rows.push({item,product});
 }
 const content=[...groups.values()].map(g=>{
  const photo=g.photo?'<img data-photo-path="'+h(g.photo)+'" alt="Foto: '+h(g.title)+'">':'<span>Sem foto</span>';
  return '<article class="buy-review-card"><header class="buy-review-card-head">'+
   '<div class="buy-review-photo">'+photo+'</div><div class="buy-review-card-title"><strong>'+h(g.title)+'</strong>'+
   '<small>'+g.rows.length+' variação(ões)</small></div></header><div class="buy-review-variants">'+g.rows.map(({item,product})=>{
    const minimum=Math.max(1,Number(product?.minimum_order_quantity||1));
    return '<div class="buy-review-variant"><div><strong>'+h(product?.apparel_size||item.product_name)+'</strong>'+
     '<small>SKU '+h(item.sku||'—')+' · Pedido mínimo: '+minimum+' un.</small></div>'+
     (draft?'<label>Quantidade (0 remove)<input type="number" data-draft-qty="'+h(item.product_id)+
      '" min="0" max="1000000" step="1" value="'+item.quantity+'" inputmode="numeric" aria-label="Quantidade de '+h(item.product_name)+'"></label>':
      '<strong>'+item.quantity+' un.</strong>')+'</div>';
   }).join('')+'</div></article>';
 }).join('');
 const total=items.reduce((sum,i)=>sum+Number(i.quantity||0),0);
 formModal('Pedido PC-'+order.number+' · '+(supplier?.name||'Fornecedor'),
  '<p class="help">'+(draft?'Confira os produtos e quantidades aqui mesmo. Não existe uma etapa separada de revisão.':
   'Pedido já registrado; o histórico e a conferência do recebimento permanecem independentes.')+'</p>'+
  '<div class="buy-review-cards">'+(content||'<p class="buy-empty">Nenhum produto adicionado. Volte à Reposição para incluir itens.</p>')+'</div>'+
  '<div class="buy-review-summary">'+items.length+' SKU(s) · '+total+' unidades</div>'+
  (draft?'<div class="formgrid">'+
    field('Prazo estimado de chegada (dias)','estimated_days','number',order.estimated_days||supplier?.delivery_days||15,'required min="1" max="365"')+
    textareaField('Observações para o fornecedor','note',order.note||'')+'</div>'+
    '<p class="help">Conferir e preparar PDF não envia mensagens automaticamente. Compartilhe o PDF com o fornecedor e então registre o envio.</p>'+
    (items.length?button('Já enviei ao fornecedor','buy-draft-mark-sent','data-id="'+h(order.id)+'"','small'):''):
   '') ,
  draft?'buy-draft-confirm':'buy-draft-readonly',draft?'Conferir e preparar PDF':'Fechar');
 const form=document.querySelector('form[data-form="'+(draft?'buy-draft-confirm':'buy-draft-readonly')+'"]');
 if(form)form.dataset.order=order.id;
 if(draft&&!items.length)form?.querySelector('button[type="submit"]')?.setAttribute('disabled','');
 hydrateImages();
}
function purchaseReviewFormValues(){
 const form=document.querySelector('form[data-form="buy-order-create"]');
 return {days:form?.elements.namedItem('estimated_days')?.value||'15',
  note:form?.elements.namedItem('note')?.value||''};
}
function purchaseReviewModal(supplierId=null,keep={}){
 if(!hasPermission('purchases.manage'))return;
 const batches=purchaseCartBySupplier(state.purchaseCart,state.items);
 if(!batches.size)return toast('Selecione pelo menos uma variação e informe a quantidade no card.',true);
 if(!supplierId&&batches.size>1){
  const rows=[...batches.entries()].map(([id,lines])=>{
   const supplier=state.suppliers.find(s=>s.id===id);
   const units=lines.reduce((n,x)=>n+x.quantity,0);
   return '<article class="buy-review-supplier"><div><strong>'+h(supplier?.name||'Fornecedor')+'</strong>'+
    '<small>'+lines.length+' SKU(s) · '+units+' unidades</small></div>'+
    button('Revisar pedido','buy-review-supplier','data-supplier="'+h(id)+'"','small primary')+'</article>';
  }).join('');
  formModal('Carrinho · Selecione o fornecedor',
   '<p class="help">Cada fornecedor recebe um pedido próprio. As outras seleções permanecem no carrinho.</p>'+rows,
   'buy-choose-supplier','Fechar');
  return;
 }
 const supplier=supplierId||[...batches.keys()][0];
 const lines=batches.get(supplier);
 if(!lines?.length)return purchaseReviewModal();
 const groups=purchaseCartReviewGroups(state.purchaseCart,state.items,state.apparelModels,supplier);
 const supplierName=state.suppliers.find(x=>x.id===supplier)?.name||'Fornecedor';
 const html=groups.map(group=>{
  const photo=group.photo?'<img data-photo-path="'+h(group.photo)+'" alt="Foto de '+h(group.title)+'">':
   '<span class="buy-no-photo">Sem foto</span>';
  return '<article class="buy-review-card" data-buy-review-group="'+h(group.key)+'">'+
   '<header class="buy-review-card-head"><div class="buy-review-photo">'+photo+'</div>'+
   '<div class="buy-review-card-title"><strong>'+h(group.title)+'</strong>'+
   '<small>'+h(supplierName)+' · '+group.rows.length+' variação(ões)</small>'+
   '<span data-buy-review-model-total="'+h(group.key)+'">Total: '+group.total+' un.</span></div>'+
   button('Remover modelo','buy-cart-remove-model','data-group="'+h(group.key)+'" data-supplier="'+h(supplier)+'"','small danger')+
   '</header><div class="buy-review-variants">'+group.rows.map(p=>
    '<div class="buy-review-variant" data-buy-review-item="'+h(p.id)+'">'+
    '<div><strong>'+h(p.apparel_size||'Único')+'</strong>'+
    '<small>SKU '+h(p.sku||'—')+(p.ean?' · EAN '+h(p.ean):'')+'</small></div>'+
    '<label>Quantidade <input type="number" data-buy-review-qty data-product="'+h(p.id)+'"'+
    ' min="1" max="1000000" step="1" inputmode="numeric" required value="'+p.quantity+'"></label>'+
    button('Remover','buy-cart-remove','data-id="'+h(p.id)+'" data-supplier="'+h(supplier)+'"','small danger')+
    '</div>').join('')+'</div></article>';
 }).join('');
 const total=lines.reduce((sum,line)=>sum+line.quantity,0);
 formModal('Revisar pedido · '+supplierName,
  '<p class="help">Confira as quantidades por tamanho antes de gerar o PDF. Não altera o estoque.</p>'+
  '<div class="buy-review-cards">'+html+'</div>'+
  '<div class="buy-review-summary"><strong data-buy-review-total>'+
   groups.length+' modelo(s) · '+lines.length+' SKU(s) · '+total+' unidades</strong></div>'+
  '<div class="formgrid">'+
   '<input type="hidden" name="supplier_id" value="'+h(supplier)+'">'+
   field('Prazo estimado de chegada (dias corridos)','estimated_days','number',keep.days||'15',
    'required min="1" max="365" step="1" inputmode="numeric"')+
   textareaField('Observações para o fornecedor','note',keep.note||'')+'</div>'+
  '<p class="help">O sistema salvará um pedido exclusivo para este fornecedor e baixará um PDF A4 com foto, tamanhos e quantidades.</p>',
  'buy-order-create','Salvar pedido e baixar PDF');
 // O pedido pode conter dezenas de modelos: dê largura e rolagem próprias à revisão.
 document.querySelector('.modalback form[data-form="buy-order-create"]')?.closest('.modal')?.classList.add('buy-review-modal');
 hydrateImages();
}
function updatePurchaseReviewTotals(supplierId){
 const groups=purchaseCartReviewGroups(state.purchaseCart,state.items,state.apparelModels,supplierId);
 for(const group of groups){
  const node=[...document.querySelectorAll('[data-buy-review-model-total]')]
   .find(el=>el.dataset.buyReviewModelTotal===group.key);
  if(node)node.textContent='Total: '+group.total+' un.';
 }
 const total=groups.reduce((n,g)=>n+g.total,0);
 const label=document.querySelector('[data-buy-review-total]');
 if(label)label.textContent=groups.length+' modelo(s) · '+
  groups.reduce((n,g)=>n+g.rows.length,0)+' SKU(s) · '+total+' unidades';
}
async function downloadBuyOrder(order,lines){
 if(!order)return toast('Compra não encontrada.',true);
 const supplier=state.suppliers.find(s=>s.id===order.supplier_id);
 if(!supplier)return toast('Fornecedor não localizado.',true);
 const products=new Map(state.items.map(p=>[p.id,p]));
 const models=new Map(state.apparelModels.map(m=>[m.id,m]));
 const paths=[...new Set(lines.map(line=>{
  const p=products.get(line.product_id);
  return models.get(p?.apparel_model_id)?.image_path||p?.image_path;
 }).filter(Boolean))];
 const photoUrls=await signedPhotoUrls(paths);
 const {blob,filename}=await createPurchasePDF(order,supplier,lines,{
  products:state.items,models:state.apparelModels,photoUrls
 });
 downloadPurchasePDF({blob,filename});
 toast('PDF gerado para download: '+filename);
}
function purchaseReceiptModal(order){
 if(!order||!hasPermission('purchases.manage')||
    !['enviado','recebido_parcial'].includes(order.status))return;
 const lines=state.purchaseItems.filter(item=>item.purchase_order_id===order.id&&
   Number(item.quantity)>Number(item.received_quantity||0));
 if(!lines.length)return toast('Este pedido não tem unidades pendentes de recebimento.',true);
 const supplier=state.suppliers.find(x=>x.id===order.supplier_id);
 const rows=lines.map(item=>{
   const pending=Number(item.quantity)-Number(item.received_quantity||0);
   const product=state.items.find(p=>p.id===item.product_id);
   return '<div class="buy-receipt-item"><div><strong>'+h(item.product_name)+
     (product?.apparel_size?' · '+h(product.apparel_size):'')+'</strong>'+
     '<small>SKU '+h(item.sku||'—')+' · Pedido: '+item.quantity+
     ' · Já recebido: '+Number(item.received_quantity||0)+' · Pendente: '+pending+'</small></div>'+
     '<label>Recebido agora <input type="number" step="1" min="0" max="'+pending+
     '" value="'+pending+'" inputmode="numeric" data-receive-item="'+h(item.id)+'" aria-label="Recebido agora: '+h(item.product_name)+'"></label></div>';
 }).join('');
 formModal('Receber compra PC-'+order.number,
  '<p class="buy-receipt-intro"><strong>'+h(supplier?.name||'Fornecedor')+
  '</strong> · Informe apenas as unidades efetivamente conferidas. Use zero para produtos que ainda não chegaram. Esta ação adicionará ao estoque físico exclusivamente as quantidades registradas.</p>'+
  '<div class="buy-receipt-list">'+rows+'</div>'+
  field('Observações do recebimento','note','text','','maxlength="200" placeholder="Nota fiscal, divergências ou referência"')+
  '<p class="buy-receipt-note">Uma entrega parcial manterá o saldo restante pendente. A operação é auditada e protegida contra envio duplicado.</p>',
  'buy-receive-save','Confirmar entrada física');
 const form=document.querySelector('.modalback form[data-form="buy-receive-save"]');
 if(form){form.dataset.id=order.id;form.dataset.requestId=crypto.randomUUID();}
}
function purchaseEtaModal(order){
 if(!order||!hasPermission('purchases.manage')||!['rascunho','enviado'].includes(order.status))return;
 formModal('Atualizar previsão · Compra PC-'+order.number,
  '<p class="help">O novo prazo é contado em dias corridos a partir de hoje. A previsão anterior ficará registrada no histórico de auditoria.</p>'+
  '<div class="formgrid">'+field('Novo prazo de chegada (dias corridos)','estimated_days','number',String(order.estimated_days||15),
   'required min="1" max="365" step="1" inputmode="numeric"')+'</div>',
  'buy-eta-save','Salvar nova previsão');
 const form=document.querySelector('form[data-form="buy-eta-save"]');
 if(form)form.dataset.id=order.id;
}
function printHTML(html){
 const popup=window.open('','_blank');
 if(!popup)return toast('Seu navegador bloqueou a impressão. Permita janelas para este site.',true);
 popup.document.open();popup.document.write(html);popup.document.close();
}
function printActivityReport(){
 if(!hasPermission('movements.read'))return;
 const rows=[
  ...state.movements.map(m=>({at:m.created_at,who:m.actor_id,
    what:actionNames[m.action]||m.action,
    detail:product(m.product_id)?.name||'Produto',qty:Number(m.quantity||0)})),
  ...state.audits.map(a=>({at:a.created_at,who:a.actor_id,
    what:a.action,detail:a.entity,qty:null}))
 ].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,180);
 printHTML(printPage('Relatório de atividades · CDSB','<p>Registro de ações de usuários para conferência administrativa.</p>'+
  '<table><thead><tr><th>Data / hora</th><th>Usuário</th><th>Ação</th><th>Produto / local</th><th>Qtde</th></tr></thead><tbody>'+
  rows.map(x=>'<tr><td>'+niceTime(x.at)+'</td><td>'+h(username(x.who))+'</td>'+
    '<td>'+h(x.what)+'</td><td>'+h(x.detail)+'</td><td class="num">'+(x.qty??'—')+'</td></tr>').join('')+
  '</tbody></table>'));
}
async function printStockReport(){
 if(!hasPermission('stock.balance'))return;
 // Abra a janela antes do await para evitar bloqueio de pop-ups.
 const popup=window.open('','_blank');
 if(!popup)return toast('Libere as janelas de impressão no navegador.',true);
 popup.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Preparando estoque CDSB</title><body style="font:16px Arial;padding:25px">Preparando fotos e ficha A4 do estoque…</body></html>');
 popup.document.close();
 try{
  const groups=stockPrintGroups(state.items,state.apparelModels,state.balances,state.stockReservations);
  const photos=await signedPhotoUrls(groups.map(group=>group.photoPath));
  if(popup.closed)return;
  const html=stockPrintHTML(groups,photos,new Date().toLocaleString('pt-BR'));
  popup.document.open();popup.document.write(html);popup.document.close();
 }catch(error){if(!popup.closed)popup.close();fail(error);}
}
function printCommercialOrder(orderId){
 if(!isFranchisePortal()&&!hasPermission('orders.read'))return;
 const order=state.storeOrders.find(x=>x.id===orderId);
 if(!order||(!hasPermission('orders.read')&&!assignedStore(order.to_store_id)))return;
 const lines=state.storeOrderItems.filter(x=>x.order_id===orderId);
 const destination=state.stores.find(s=>s.id===order.to_store_id)?.name||'Unidade';
 const rows=lines.map(x=>{
  const p=product(x.product_id);
  return '<tr><td>'+h(p?.name||'Produto')+'</td><td>'+
  h([p?.apparel_color,p?.apparel_size,p?.sku].filter(Boolean).join(' · '))+'</td>'+
  '<td class="num">'+Number(x.quantity||0)+'</td></tr>';
 }).join('');
 printHTML(printPage('Comprovante de pedido #'+h(orderCode('loja',orderId)),
  '<p><b>Loja:</b> '+h(destination)+' · <b>Data:</b> '+niceTime(order.created_at)+
  ' · <b>Situação:</b> '+h(order.status)+'</p>'+
  '<table><thead><tr><th>Produto</th><th>Variação / SKU</th><th>Quantidade</th></tr></thead><tbody>'+
  rows+'</tbody></table><p><strong>Total: '+lines.reduce((n,i)=>n+Number(i.quantity||0),0)+
  ' unidades</strong></p><p>Documento de acompanhamento; não representa controle do estoque interno da loja.</p>'));
}
function printEventSummary(eventId){
 const e=eventById(eventId);
 if(!e||!(hasPermission('events.manage')||Boolean(memberRole(eventId))))return;
 const draft=state.eventSettlements.find(d=>d.event_id===eventId);
 const items=Array.isArray(draft?.items)?draft.items:[];
 const base=(p)=>h([p?.apparel_color,p?.apparel_size,p?.sku].filter(Boolean).join(' · '));
 if(items.length){
  const rows=items.map(row=>{
   const p=product(row.product_id);
   return '<tr><td>'+h(p?.name||'Produto')+'</td><td>'+base(p)+'</td>'+
    '<td class="num">'+Number(row.expected||0)+'</td>'+
    '<td class="num">'+Number(row.good||0)+'</td>'+
    '<td class="num">'+Number(row.damaged||0)+'</td>'+
    '<td class="num">'+Number(row.lost||0)+'</td></tr>';
  }).join('');
  return printHTML(printPage('Conferência de devolução · '+e.name,
   '<p><b>Evento:</b> '+h(e.name)+' · <b>Situação da conferência:</b> '+h(draft.status||'Em análise')+
   '. Este documento não registra nem presume vendas.</p>'+
   '<table><thead><tr><th>Produto</th><th>Variação / SKU</th><th>Enviado / pendente</th>'+
   '<th>Devolvido bom</th><th>Avariado</th><th>Não devolvido</th></tr></thead><tbody>'+
   rows+'</tbody></table>'+(draft.note?'<p><b>Observações:</b> '+h(draft.note)+'</p>':'')+
   '<div class="print-signatures"><span>Responsável pelo evento</span><span>Conferente CDSB</span></div>'));
 }
 const balances=state.balances.filter(b=>b.event_id===eventId&&Number(b.quantity)>0);
 const rows=balances.map(b=>{
  const p=product(b.product_id);
  return '<tr><td>'+h(p?.name||'Produto')+'</td><td>'+base(p)+
   '</td><td class="num">'+Number(b.quantity)+'</td></tr>';
 }).join('');
 printHTML(printPage('Ficha de retorno · '+e.name,'<p>Loja temporária: '+h(e.name)+
  '. Este documento registra mercadorias, nunca vendas.</p>'+
  '<table><thead><tr><th>Produto</th><th>Variação / SKU</th><th>Saldo a conferir</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '<p>Conferir produtos devolvidos, avariados e quantidades não devolvidas. Aprovação final no CDSB.</p>'+
  '<div class="print-signatures"><span>Responsável pelo evento</span><span>Conferente CDSB</span></div>'));
}
function quickProductPhotoModal(item){
 if(!item||item.apparel_model_id||!hasPermission('products.edit'))return;
 formModal('Fotos · '+item.name,photoChooser(item),'product-photo-quick','Salvar fotos');
 const form=document.querySelector('.modalback form[data-form="product-photo-quick"]');
 if(form)form.dataset.id=item.id;
 hydrateImages();
}
function productModal(item=null){
  if(!canRegisterProducts())return;
  const single='<div data-single-fields class="single-fields wide">'+
    field('Código interno (SKU)','sku','text',item?.sku||'','maxlength="80" autocomplete="off"')+
    '<div class="field"><span>EAN / código de barras</span><div class="inline">'+
    '<input style="flex:1;min-width:145px" name="ean" type="text" inputmode="numeric" placeholder="8 a 14 dígitos" value="'+h(item?.ean||'')+'">'+
    button('📷 Ler','form-scan','data-target="ean"','small')+'</div></div></div>';
  const locations='<section class="form-section wide location-section">'+
    '<div class="section-head"><strong>Localização na loja</strong>'+(
      item?button('Imprimir etiqueta 80 mm','shelf-label-one','data-id="'+h(item.id)+'"','small'):
      '<small>Opcional</small>')+'</div>'+
    '<div class="location-fields">'+
    gondolaSelectHTML('gondola',state.gondolas,item?.gondola||'')+
    field('Prateleira','prateleira','text',item?.prateleira||'','maxlength="40" placeholder="Ex.: Prateleira B"')+
    '</div></section>';
  const markup='<div class="formgrid">'+
    '<div class="wide">'+field('Nome do produto *','name','text',item?.name||'','required maxlength="180"')+'</div>'+
    (!item?'<p class="help wide">SKU e EAN de produtos excluídos podem ser reutilizados. O sistema impede duplicações somente com produtos ativos.</p>':'')+
    categorySelector(item)+
    (!item?sizesSection():'')+
    single+photoChooser(item)+productTagChooser(item)+locations+procurementFields(item)+
    (!item?'<div class="wide" data-single-stock>'+
      (state.view==='entrada'?'<p class="help">Ao cadastrar um produto para esta remessa, deixe o estoque inicial em zero e adicione-o à lista abaixo para não contabilizar duas vezes.</p>':'')+
      field('Quantidade inicial na loja','initial_quantity','number','0','min="0" max="1000000" step="1"','Entrada registrada no histórico.')+'</div>':'')+
    (item?selectField('Situação','active',[['true','Ativo'],['false','Inativo']],String(item.active)):'')+'</div>';
  formModal(item?'Editar produto':'Novo produto',markup,item?'product-edit':'product-new',
    item?'Salvar alterações':'Cadastrar produto');
  const form=document.querySelector('.modalback form');
  if(item)form.dataset.id=item.id;
  else refreshCategorySizeOptions(form,state.categories,state.gondolas);
  if(item?.image_path||item?.image_paths?.length)hydrateImages();
}

function shelfLabelsModal(id){
 if(isFranchisePortal())return toast('Etiquetas são exclusivas do estoque central.',true);
 const item=product(id);
 if(!item||item.force_archived_at)return toast('Produto não encontrado.',true);
 const model=item.apparel_model_id?
   state.apparelModels.find(m=>m.id===item.apparel_model_id):null;
 const group=item.apparel_model_id?
   state.items.filter(p=>p.apparel_model_id===item.apparel_model_id&&!p.force_archived_at):[item];
 if(!group.length)return toast('Não há variações para imprimir.',true);
 formModal('Etiquetas de gôndola · 80 mm',shelfLabelPicker(group,model?.name||''),'shelf-label-print',
  'Imprimir etiquetas');
 const form=document.querySelector('.modalback form[data-form="shelf-label-print"]');
 if(form)form.dataset.productId=id;
}
function printShelfLabels(items){
 const win=window.open('','_blank');
 if(!win)return toast('Permita janelas pop-up para imprimir as etiquetas.',true);
 try{
  const html=shelfLabelsHTML(items);
  win.document.open();win.document.write(html);win.document.close();
  return true;
 }catch(error){win.close();fail(error);return false;}
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
   (linked.length?'<ul>'+linked.map(r=>'<li>Pedido #'+h(orderCode('loja',r.order_id))+' · '+r.quantity+' un.</li>').join('')+'</ul>':'<p class="muted">Nenhum pedido reservado.</p>')+
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
 const mode=availableModes.some(m=>m.key===requestedMode)?requestedMode:'consulta';
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
 if(!p)return;
 if(mode!=='consulta'&&!skuPanelModes.some(m=>m.key===mode&&hasPermission(m.permission)))return;
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
  contagem:'Salvar conferência',edicao:'Salvar cadastro',consulta:'Escolha uma operação'}[mode];
 const submit=form.querySelector('button[type="submit"]');
 if(submit){submit.textContent=label||'Salvar';submit.disabled=mode==='consulta';}
 if(mode==='consulta'){const preview=form.querySelector('[data-sku-preview]');if(preview)preview.textContent='Escolha Entrada, Saída, Conferir ou Editar para iniciar.';return;}
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
   'Confirmar '+(mode==='entrada'?'entrada':'saída')+' de '+op.quantity+' unidade(s) de '+p.name+
   (mode==='saida'&&op.reason==='avaria'?' por avaria? A baixa é imediata; se reparar, registre uma nova entrada.':'?');
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
   op.reason==='avaria'?'Avaria baixada imediatamente, com justificativa no histórico.':'Saída excepcional registrada.');
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
        '<p class="help">Avarias geram baixa imediata, com justificativa. Se a peça for recuperada, registre uma entrada manual. Unidades reservadas não podem ser baixadas.</p>'+
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
 const mode=form?.elements.namedItem('cover_mode')?.value;
 const file=form?.querySelector('[data-cover-file]');
 if(file)file.hidden=mode!=='upload';
 const theme=form?.querySelector('[data-cover-theme]');
 if(theme)theme.hidden=mode!=='generate';
}
function eventCoverThemeField(value=''){
 return '<label class="field" data-cover-theme>'+
  '<span>Tema da capa (opcional)</span>'+
  '<input type="text" name="cover_theme" maxlength="220" value="'+h(value)+'" '+
   'placeholder="Ex.: Retiro espiritual com oração, natureza e acolhimento">'+
  '<small>Usaremos o nome da loja e este tema. Se ficar vazio, a IA interpretará o nome e as observações.</small>'+
 '</label>';
}
async function saveEventCoverTheme(db,id,theme){
 const text=String(theme||'').trim();
 if(text.length>220)throw Error('Informe um tema de até 220 caracteres.');
 const result=await db.from('events').update({cover_theme:text||null}).eq('id',id)
  .select('id,cover_theme').maybeSingle();
 if(result.error)throw result.error;
 if(!result.data||String(result.data.cover_theme||'')!==text)
  throw Error('Não foi possível salvar o tema da capa.');
}
function eventCoverModal(id){
 if(!hasPermission('events.manage'))return;
 const e=eventById(id);if(!e||e.deleted_at)return;
 formModal('Capa · '+e.name,
  eventCoverCard(e)+'<p class="help">Capa horizontal de 1600 × 900 pixels. Envie uma foto, gere com IA ou remova a atual.</p>'+
  selectField('O que deseja fazer','cover_mode',[['upload','Enviar nova imagem'],['generate','Gerar com IA usando o nome e tema'],['remove','Remover capa']])+
  eventCoverThemeField(e.cover_theme||'')+
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
  selectField('Imagem de capa','cover_mode',[['none','Criar sem capa'],['upload','Enviar imagem'],['generate','Gerar capa pelo nome e tema (IA)']])+
  eventCoverThemeField()+
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

function gondolaModal(item=null){
 if(!canManageGondolas())return toast('Sem permissão para cadastrar gôndolas.',true);
 formModal(item?'Editar gôndola':'Nova gôndola',
  '<div class="formgrid">'+field('Identificação da gôndola','name','text',item?.name||'',
   'required minlength="1" maxlength="40" placeholder="Ex.: Gôndola 03"')+'</div>'+
   '<p class="help">A gôndola fica disponível como seletor no cadastro de produtos e em cada variação. Alterar o nome não muda silenciosamente os produtos antigos; edite-os para transferir a localização.</p>',
  'gondola-save',item?'Salvar gôndola':'Cadastrar gôndola');
 const form=document.querySelector('.modalback form[data-form="gondola-save"]');
 if(form&&item)form.dataset.id=item.id;
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

const accessPresets={
 admin:permissionCatalog.map(([key])=>key).filter(x=>x!=='events.sell'),
 gerente:['products.read','products.create','products.edit','stock.entry','stock.exit','stock.balance',
  'stores.read','stores.manage','orders.read','orders.internal','orders.franchise','orders.separate',
  'orders.dispatch','orders.receive','orders.cancel','events.read','events.manage','events.separate',
  'events.return','events.close','purchases.manage','movements.read','movements.export',
  'categories.manage','tags.manage'],
 estoquista:['products.read','orders.read','orders.separate'],
 evento:['products.read','events.read','events.request'],
 consulta:['products.read','orders.read','stores.read','movements.read'],
 franquia:['products.read','orders.franchise']
};
const profileDescriptions={
 admin:'Acesso integral ao Centro de Distribuição São Bento.',
 gerente:'Coordena o CDSB. É possível ajustar permissões operacionais avançadas.',
 estoquista:'Somente fila de separação e conferência. Não expede nem ajusta estoque.',
 evento:'Solicita reposições e informa devoluções nos eventos vinculados. Não registra vendas.',
 consulta:'Consulta informações sem permissão para movimentar produtos.',
 franquia:'Loja Cristo Rei ou franquia: somente seus pedidos e comprovantes, sem controle de estoque no destino.'
};
function permissionFields(userId){
 const user=state.users.find(x=>x.id===userId);
 const role=user?.role||'evento';
 const explicit=state.userPermissions.filter(x=>x.user_id===userId).map(x=>x.permission);
 const chosen=explicit.length?explicit:(accessPresets[role]||[]);
 const linkedStores=new Set(state.staffStores.filter(ss=>ss.user_id===userId).map(ss=>ss.store_id));
 const events=new Set(state.members.filter(m=>m.user_id===userId).map(m=>m.event_id));
 const stores=state.stores.filter(x=>x.active);
 const storeGroup='<section class="um-access-group" data-access-stores>'+
  '<h3>2. Unidade vinculada</h3><p class="help" data-access-store-help>Apenas as unidades autorizadas estarão disponíveis para este acesso.</p>'+
  '<div class="um-choice-list">'+stores.map(s=>
   '<label class="um-choice" data-store-role="'+h(s.kind)+'" data-is-primary="'+String(s.is_primary)+'"><input type="checkbox" name="store" value="'+h(s.id)+'" '+
    (linkedStores.has(s.id)||(!userId&&s.is_primary)?'checked':'')+'><span><strong>'+h(s.name)+'</strong>'+
    '<small>'+(s.is_primary?'Centro de distribuição':s.kind==='franquia'?'Loja sem estoque interno':'Unidade gerenciada')+'</small></span></label>').join('')+
  '</div></section>';
 const eventsGroup='<section class="um-access-group" data-access-events hidden>'+
  '<h3>3. Eventos autorizados</h3><p class="help">O responsável verá somente as lojas temporárias assinaladas. Pode alterar depois.</p>'+
  '<div class="um-choice-list">'+state.events.filter(e=>!e.deleted_at&&['rascunho','ativo'].includes(e.status)).map(e=>
   '<label class="um-choice"><input type="checkbox" name="event_member" value="'+h(e.id)+'" '+(events.has(e.id)?'checked':'')+'>'+
   '<span><strong>'+h(e.name)+'</strong><small>'+h(e.status)+'</small></span></label>').join('')+
  '</div></section>';
 const advanced=permissionCatalog.filter(([p])=>!['events.sell'].includes(p)).map(([key,label])=>
   '<label class="um-perm" data-permission="'+h(key)+'"><input type="checkbox" name="perm" value="'+h(key)+'" '+(chosen.includes(key)?'checked':'')+'><span>'+h(label)+'</span></label>').join('');
 return '<section class="um-access-group"><h3>1. Perfil de referência</h3>'+
  '<p class="um-role-description" data-access-profile-help>'+h(profileDescriptions[role]||'')+'</p></section>'+
  storeGroup+eventsGroup+
  '<details class="um-advanced" data-access-advanced><summary><strong>Permissões avançadas</strong><small>Somente para gerentes e consultas. Perfis operacionais usam permissões fixas.</small></summary>'+
  '<p class="help um-force-help">Autonomia total permite excluir cadastros de teste mesmo com histórico; as movimentações antigas permanecem auditadas. Ao marcar para Gerente, autorizações relacionadas são selecionadas.</p>'+
  '<div class="um-perm-grid">'+advanced+'</div></details>';
}
function setupFranchiseProfile(form){
 const role=form?.querySelector('[name="role"]');if(!role)return;
 const existing=Boolean(form.dataset.id);
 const show=(reset)=>{
  const current=role.value;
  const allowed=accessPresets[current]||[];
  if(reset){
   for(const input of form.querySelectorAll('input[name="perm"]'))input.checked=allowed.includes(input.value);
   for(const input of form.querySelectorAll('input[name="store"]'))input.checked=false;
   for(const input of form.querySelectorAll('input[name="event_member"]'))input.checked=false;
  }
  const desc=form.querySelector('[data-access-profile-help]');
  if(desc)desc.textContent=profileDescriptions[current]||'';
  const storeSection=form.querySelector('[data-access-stores]');
  const eventSection=form.querySelector('[data-access-events]');
  if(storeSection)storeSection.hidden=current==='evento'||current==='consulta'||current==='admin';
  if(eventSection)eventSection.hidden=current!=='evento';
  const advanced=form.querySelector('[data-access-advanced]');
  if(advanced){advanced.hidden=!['gerente','consulta'].includes(current);if(advanced.hidden)advanced.open=false;}
  const readerAllowed=new Set(['products.read','orders.read','stores.read','movements.read','movements.export','events.read']);
  for(const input of form.querySelectorAll('input[name="perm"]')){
   const item=input.closest('[data-permission]');
   const showPerm=current==='consulta'?readerAllowed.has(input.value):
     current==='gerente'? !['users.manage','events.sell'].includes(input.value):true;
   if(item)item.hidden=!showPerm;
   if(!showPerm)input.checked=false;
  }
  for(const input of form.querySelectorAll('input[name="store"]')){
   const item=input.closest('.um-choice');
   const store=state.stores.find(s=>s.id===input.value);
   const valid=current==='franquia'?store?.kind==='franquia':
     current==='estoquista'?store?.is_primary:
     current==='gerente'?true:false;
   if(item)item.hidden=!valid;
   if(!valid)input.checked=false;
   if(current==='estoquista'&&store?.is_primary)input.checked=true;
  }
  if(current==='franquia'){
   const allowedStores=[...form.querySelectorAll('input[name="store"]')].filter(x=>!x.closest('.um-choice')?.hidden);
   const checked=allowedStores.filter(x=>x.checked);
   if(checked.length>1)checked.slice(1).forEach(x=>x.checked=false);
   if(!checked.length&&allowedStores.length===1)allowedStores[0].checked=true;
  }
  const help=form.querySelector('[data-access-store-help]');
  if(help)help.textContent=current==='franquia'?'Escolha uma única loja permanente.':
   current==='estoquista'?'O separador fica vinculado apenas ao CDSB.':
   'Selecione as unidades gerenciadas pelo usuário.';
  if(!['gerente','consulta'].includes(current)){
   for(const input of form.querySelectorAll('input[name="perm"]'))input.checked=allowed.includes(input.value);
  }
 };
 role.addEventListener('change',()=>show(true));
 form.addEventListener('change',event=>{
  if(event.target.matches('input[name="store"]')&&role.value==='franquia'&&event.target.checked)
   for(const other of form.querySelectorAll('input[name="store"]'))
    if(other!==event.target)other.checked=false;
  if(event.target.matches('input[name="perm"][value="system.force_delete"]')&&event.target.checked&&role.value==='gerente'){
   const needed=['products.delete','products.edit','stock.balance','events.manage','events.close',
    'events.return','orders.internal','orders.cancel','stores.manage'];
   for(const input of form.querySelectorAll('input[name="perm"]'))
    if(needed.includes(input.value))input.checked=true;
   for(const input of form.querySelectorAll('input[name="store"]'))
    if(state.stores.some(s=>s.id===input.value&&s.is_primary))input.checked=true;
   toast('Autonomia avançada ativada com autorizações operacionais necessárias.');
  }
 });
 show(!existing);
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
 const target=state.users.find(x=>x.id===id);
 if(!target||target.archived_at)return;
 formModal('Perfil e acessos · '+target.full_name,
  '<p class="help">Selecione o perfil. Depois confira a loja ou evento vinculado. O perfil é preservado exatamente como escolhido.</p>'+
  '<div class="um-role-field">'+selectField('Perfil','role',Object.entries(roles),target.role)+'</div>'+
  permissionFields(id),'user-permissions','Salvar perfil e acessos');
 const form=document.querySelector('.modalback form[data-form="user-permissions"]');
 if(!form)return;
 form.dataset.id=id;
 setupFranchiseProfile(form);
}
function userEditModal(id){
 if(!isAdmin())return;
 const target=state.users.find(u=>u.id===id);
 if(!target||target.archived_at)return;
 formModal('Editar dados · '+target.full_name,
  '<p class="help">Altere os dados cadastrais e profissionais. Perfil, lojas e eventos permanecem em “Perfil e acessos”.</p>'+ 
  '<div class="formgrid">'+
  field('Nome completo','full_name','text',target.full_name,'required minlength="2" maxlength="120"')+
  field('Nome de usuário (login)','username','text',target.username,
   'required minlength="3" maxlength="32" autocapitalize="none" autocomplete="off"')+
  field('Telefone / WhatsApp','phone','text',state.staffContactDetails.find(d=>d.user_id===id)?.phone||'','maxlength="60"')+
  field('Cargo','job_title','text',state.staffContactDetails.find(d=>d.user_id===id)?.job_title||'','maxlength="120"')+
  field('Setor','department','text',state.staffContactDetails.find(d=>d.user_id===id)?.department||'','maxlength="120"')+
  textareaField('Observações administrativas','internal_notes',state.staffContactDetails.find(d=>d.user_id===id)?.internal_notes||'')+
  '</div>','user-edit','Salvar alterações');
 const form=document.querySelector('.modalback form[data-form="user-edit"]');
 if(form)form.dataset.id=id;
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
 if(state.activeStore){
  const store=state.stores.find(s=>s.id===state.activeStore&&!s.force_archived_at&&!s.is_primary);
  if(store&&(hasPermission('stores.manage')||assignedStore(store.id))){
   return renderStoreUnit({
    store,orders:locationOrders(unifiedOrderRecords(),{type:'store',id:store.id}),
    storeBalances:state.storeBalances,products:state.items,branchMovements:state.branchMovements,
    branchReturns:state.branchReturns,storeOrderReceipts:state.storeOrderReceipts,
    tab:state.activeStoreTab,context:{button,time:niceTime,
      canBrowseOrders:permittedView('pedidos'),
      canManageStores:hasPermission('stores.manage')&&!portal,
      canRequest:store.active&&(store.kind==='franquia'?hasPermission('orders.franchise'):hasPermission('orders.central')),
      canMove:store.active&&store.kind==='filial'&&assignedStore(store.id)&&
        (hasPermission('stores.manage')||hasPermission('orders.receive')),
      canReturn:store.active&&store.kind==='filial'&&assignedStore(store.id)&&
        (hasPermission('stores.manage')||hasPermission('orders.receive'))
    }
   });
  }
  state.activeStore=null;
 }

 return renderStoreHub({
  stores:state.stores.filter(s=>!s.force_archived_at),events:state.events,orders:unifiedOrderRecords(),
  context:{
   button,time:niceTime,portal,canForceDelete:hasPermission('system.force_delete'),
   storeBalances:state.storeBalances,eventBalances:state.balances,filter:state.storeHubFilter,
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
 // O CDSB é gerenciado como centro de distribuição, não como loja comercial.
 const managedStores=state.stores.filter(x=>!x.force_archived_at&&!x.is_primary&&x.kind!=='central');
 return tabHead('Administração de lojas','Cadastros de lojas próprias e franquias.',button('← Voltar para Lojas','view','data-view="lojas"','small')+(manage?button('+ Nova loja','store-new','','primary'):''))+
 panel('Unidades',managedStores.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Loja</th><th>Código</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>'+
 managedStores.map(x=>'<tr><td><strong>'+h(x.name)+'</strong></td><td>'+h(x.code)+'</td><td>'+h(x.code==='CRISTOREICBA'?'Loja Central':x.kind==='filial'?'Loja própria / filial':'Franquia')+'</td><td>'+(x.active?'Ativa':'Inativa')+' · '+(x.kind==='franquia'?'Não controlado':(x.is_primary?state.balances.filter(b=>!b.event_id).reduce((n,b)=>n+b.quantity,0):state.storeBalances.filter(b=>b.store_id===x.id).reduce((n,b)=>n+b.quantity,0))+' un.')+'</td><td>'+
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
  return '<article class="store-order-card"><header><strong>Pedido #'+h(orderCode('loja',o.id))+
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
 const op=state.orderOperationalRows.find(x=>x.kind==='loja'&&x.order_id===orderId&&x.stage==='enviado');
 const rows=items.map(x=>{
   const p=product(x.product_id);
   const expected=receiving&&op?Number(op.items?.[x.product_id]?.counted??0):Number(x.quantity);
   const initial=adjusting?x.quantity:0;
   return '<div class="store-picking-line"><div><strong>'+h(p?.name||'Produto')+'</strong>'+
    '<small>'+h([p?.sku,p?.ean,p?.apparel_size,p?.apparel_color].filter(Boolean).join(' · '))+'</small>'+
    '<small>'+expected+' un. '+(receiving?'efetivamente enviadas':'solicitadas / reservadas')+'</small></div>'+
    '<label>Quantidade <input type="number" data-phase-qty data-id="'+h(x.product_id)+'" data-expected="'+expected+
    '" min="0" max="'+expected+'" step="1" inputmode="numeric" value="'+initial+'" required></label></div>';
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
 formModal('Conferir separação · #'+orderCode('avulso',id),
   pickingOrderRows(o,{h}),'avulso-picking','Concluir separação');
 const form=document.querySelector('.modalback form[data-form="avulso-picking"]');
 if(form){form.dataset.order=id;updateUnifiedPickingTotal(form);}
 hydrateImages();
}
function unifiedShortageModal(kind,id){
 if(!hasPermission('orders.dispatch')||isFranchisePortal())return;
 const o=unifiedOrderById(kind,id);
 if(!o||!['legado','solicitado','pendente_estoque','aprovado','reservado'].includes(o.status))return;
 if(o.kind==='loja'&&!assignedStore(o.raw.from_store_id))return;
 formModal('Ajustar pedido · #'+orderCode(kind,id),
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
function printUnifiedOrder(kind,id){
 const order=unifiedOrderById(kind,id);
 if(!order||isFranchisePortal()||!order.lines.length)return;
 const popup=window.open('','_blank');
 if(!popup)return toast('O navegador bloqueou a janela de impressão.',true);
 try{
  popup.document.open();popup.document.write(pickingThermalHTML(order,{
   printedAt:new Date().toLocaleString('pt-BR')
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
 formModal('Conferir separação · #'+orderCode('loja',orderId),
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
function orderDestinationPicker(){
 const context=state.ordersContext;
 const storeDestinations=state.stores.filter(x=>x.active&&!x.is_primary&&assignedStore(x.id)&&
   ((x.kind==='franquia'&&hasPermission('orders.franchise'))||
    (x.kind==='filial'&&hasPermission('orders.central'))));
 const eventDestinations=isFranchisePortal()?[]:state.events.filter(x=>
   ['rascunho','ativo'].includes(x.status)&&
   ((isManager()&&hasPermission('events.separate'))||
    (hasPermission('events.request')&&Boolean(memberRole(x.id)))));
 const options=[
   ...storeDestinations.map(x=>['store:'+x.id,
     (x.kind==='franquia'?'Franquia · ':'Loja própria · ')+x.name]),
   ...eventDestinations.map(x=>['event:'+x.id,'Loja temporária · '+x.name])
 ];
 if(!options.length)return toast('Nenhuma unidade cadastrada disponível para pedido.',true);
 const preferred=context?.type==='event'?'event:'+context.id:
  context?.type==='store'?'store:'+context.id:'';
 const selected=options.some(x=>x[0]===preferred)?preferred:options[0][0];
 formModal('Novo pedido',
   '<p class="help">Escolha a unidade que receberá os produtos do CD. Cada solicitação é um pedido independente.</p>'+
   selectField('Unidade de destino','destination',options,selected)+
   '<p class="help">Ao confirmar os itens, o sistema reserva automaticamente a quantidade integral de cada produto.</p>',
   'unified-order-destination','Continuar');
}
function storeOrderModal(preselectId=''){
 const main=state.stores.find(x=>x.is_primary&&x.active);
 if(!main)return toast('Estoque central não cadastrado.',true);
 const targets=state.stores.filter(x=>x.active&&!x.is_primary&&assignedStore(x.id)&&
  ((x.kind==='franquia'&&hasPermission('orders.franchise'))||
   (x.kind==='filial'&&hasPermission('orders.central'))));
 if(!targets.length)return toast('Não há unidade habilitada para solicitar mercadorias.',true);
 if(!preselectId&&!isFranchisePortal())return orderDestinationPicker();
 const target=targets.find(x=>x.id===preselectId)||(!preselectId?targets[0]:null);
 if(!target)return toast('Unidade de destino indisponível ou não autorizada.',true);
 const destination=(target.kind==='franquia'?'Franquia · ':'Loja própria · ')+target.name;
 const portal=isFranchisePortal();
 const groups=makeOrderCatalog(state.items,state.apparelModels,
  portal?()=>0:p=>qtyAvailable(p.id),
  p=>target.kind==='franquia'?categoryFranchiseMin(p):0);
 formModal('Montar pedido · '+target.name,
   '<input type="hidden" name="to_store_id" value="'+h(target.id)+'">'+
   orderCartMarkup(groups,{destination,showAvailable:!portal})+
   '<div class="order-cart-note">'+textareaField('Observação (opcional)','note')+'</div>'+
   '<p class="order-cart-guidance">A reserva só será feita após revisar e confirmar o pedido. A saída física ocorre depois da conferência.</p>',
   'store-order-create','Revisar pedido');
 const form=document.querySelector('.modalback form[data-form="store-order-create"]');
 if(!form)return;
 mountOrderCart(form,{groups,destination,showAvailable:!portal,onRender:hydrateImages});
}

function storeModal(item=null){
 if(!hasPermission('stores.manage'))return;
 formModal(item?'Editar loja':'Nova loja','<div class="formgrid">'+
 field('Código','code','text',item?.code||'','required maxlength="30"')+
 field('Nome','name','text',item?.name||'','required maxlength="120"')+
 selectField('Tipo','kind',[['filial','Loja própria / filial'],['franquia','Franquia']],item?.kind||'filial')+
 field('CNPJ','document','text',item?.document||'')+
 field('Telefone','phone','text',item?.phone||'')+
 field('Responsável','manager_name','text',item?.manager_name||'')+
 textareaField('Endereço','address',item?.address||'')+'</div>','store-save','Salvar loja');
 document.querySelector('.modal form').dataset.id=item?.id||'';
}
async function forceDeletePreview(kind,id){
 if(!hasPermission('system.force_delete')||state.loading)return;
 if(!['product','model','store','event'].includes(kind)||!id)return;
 if(kind==='model'&&!isAdmin())return;
 try{
  const data=kind==='model'
   ?assertOk(await db.rpc('force_archive_model_preview',{p_model:id}))
   :assertOk(await db.rpc('force_archive_preview',{p_kind:kind,p_id:id}));
  if(!data?.name)throw Error('Cadastro não encontrado.');
  const labels={product:'produto/variação',model:'produto completo (todas as variações)',
   store:'loja/franquia',event:'loja temporária'};
  const warnings=[
   ...(kind==='model'?['<strong>'+h(data.variant_count||0)+'</strong> variações/tamanhos']:[]),
   '<strong>'+h(data.stock_units||0)+'</strong> unidade(s) físicas em saldo',
   ...(kind==='model'?[
    '<strong>'+h(data.cd_units||0)+'</strong> no CDSB; <strong>'+h(data.event_units||0)+'</strong> em temporárias; <strong>'+h(data.branch_units||0)+'</strong> em filiais',
    '<strong>'+h(data.reserved_units||0)+'</strong> unidade(s) reservada(s)']:kind==='product'?[
    '<strong>'+h(data.branch_units||0)+'</strong> unidade(s) em filiais']:[]),
   '<strong>'+h(data.pending_records||0)+'</strong> pedido(s) pendente(s)',
   ...((kind==='product'||kind==='model')?['<strong>'+h(data.active_reservations||0)+'</strong> reserva(s) ativa(s)']:[]),
   '<strong>'+h(data.history_records||0)+'</strong> registro(s) históricos'
  ];
  const modelVariants=kind==='model'?
    state.items.filter(p=>p.apparel_model_id===id&&!p.force_archived_at):[];
  const variantsList=modelVariants.length?
    '<div class="force-delete-variants"><strong>Variações que serão excluídas juntas</strong>'+
    '<ul>'+modelVariants.map(p=>'<li><b>'+h([p.apparel_color,p.apparel_size].filter(Boolean).join(' · ')||'Único')+
     '</b> · SKU '+h(p.sku||'—')+' · Físico '+qtyStore(p.id)+
     ' · Reservado '+qtyReserved(p.id)+'</li>').join('')+'</ul></div>':'';
  const explanation=kind==='model'?
   'Todos os tamanhos e cores serão arquivados juntos, sem dar baixa no estoque nem cancelar pedidos. Se houver saldo físico, reserva ou pedido aberto em alguma variação, regularize esses vínculos antes de arquivar. O histórico será preservado.':
   kind==='product'?
   'A variação será arquivada no catálogo, sem movimentar estoque nem cancelar pedidos. Para prosseguir, o saldo deve estar zerado em todos os locais, sem reservas ou pedidos abertos.':
   kind==='store'?
   'A loja sai da relação operacional. Pedidos pendentes são cancelados e reservas liberadas. O histórico permanece. Filiais com mercadorias ainda em estoque devem devolver antes.':
   'A loja temporária deixa de aparecer. Pedidos não enviados são cancelados e o estoque restante retorna ao CDSB. O histórico é preservado.';
  formModal('Exclusão avançada · '+data.name,
   '<p class="help"><b>Atenção: exclusão administrativa de '+labels[kind]+'.</b> Revise os números antes de autorizar.</p>'+
   '<div class="force-delete-summary">'+warnings.map(t=>'<div>'+t+'</div>').join('')+'</div>'+
   variantsList+
   '<p>'+h(explanation)+'</p>'+
   '<p class="help">'+h(kind==='product'||kind==='model'?'Arquivamento de catálogo: nenhuma unidade física será baixada; regularize o estoque na área Estoque antes de confirmar.':'Esta ação altera vínculos e pode devolver saldo ao CDSB, conforme o tipo de unidade. O histórico será preservado.')+'</p>'+
   '<label class="field"><span>Digite exatamente <strong>'+h(data.name)+'</strong> para autorizar</span>'+
   '<input name="confirmation" type="text" required autocomplete="off" placeholder="'+h(data.name)+'"></label>',
   'force-delete-confirm','Confirmar exclusão avançada');
  const form=document.querySelector('.modalback form[data-form="force-delete-confirm"]');
  if(form){form.dataset.kind=kind;form.dataset.id=id;form.dataset.name=data.name;}
 }catch(error){fail(error);}
}
function userModal(){
  if(!isAdmin())return;
  formModal('Cadastrar usuário','<div class="formgrid">'+
    field('Nome completo','full_name','text','','required minlength="2" maxlength="120" autocomplete="name"')+
    field('Usuário','username','text','','required minlength="3" maxlength="32" autocapitalize="none"')+
    field('Telefone / WhatsApp','phone','text','','maxlength="60"')+
    field('Cargo','job_title','text','','maxlength="120"')+
    field('Setor','department','text','','maxlength="120"')+
    selectField('Função','role',Object.entries(roles),'evento')+
    permissionFields('')+
    field('Senha inicial','password','password','','required minlength="6" maxlength="128" autocomplete="new-password"',
      'Mínimo de 6 caracteres. Sem exigência de símbolos ou maiúsculas. A senha não será enviada por email.')+
    field('Confirmar senha','password_confirm','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
    '</div><div class="note">O administrador entrega a senha ao funcionário por um canal seguro. O acesso é liberado imediatamente, sem confirmação por email.</div>',
    'user-new','Cadastrar usuário');
  setupFranchiseProfile(document.querySelector('.modal form[data-form="user-new"]'));
}
function adminPasswordModal(id){
  if(!isAdmin()||id===state.user?.id)return;
  const target=state.users.find(x=>x.id===id);if(!target)return;
  formModal('Definir senha · '+target.full_name,'<div class="formgrid">'+
    field('Nova senha','password','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
    field('Confirmar nova senha','password_confirm','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
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
  if(p.length<6||p.length>128)throw new Error('Utilize uma senha de 6 a 128 caracteres.');
  if(p!==repeat)throw new Error('As senhas digitadas são diferentes.');
  return p;
}
async function invokeManageUser(action,body){
 const {data,error}=await db.functions.invoke('cdsb-manage-users',{body:{action,...body}});
 if(error){
  let message=error.message||'Não foi possível alterar a conta.';
  try{const detail=await error.context?.json?.();if(detail?.error)message=detail.error;}catch{}
  throw Error(message);
 }
 if(!data?.success)throw Error(data?.error||'Não foi possível alterar a conta.');
 return data;
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
  try{const url=await signedPhotoUrl(path);if(node.isConnected&&url&&(node.dataset.photoPath||product(node.dataset.photoId)?.image_path)===path)node.src=url;}
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
function searchAndManageSku(code){
 const value=String(code||'').trim();
 if(!value)return;
 const match=state.items.find(p=>p.active&&!p.force_archived_at&&
  (String(p.ean||'')===value||String(p.sku||'').toLocaleLowerCase('pt-BR')===value.toLocaleLowerCase('pt-BR')));
 state.view='produtos';state.search=value;state.page=0;
 state.categoryFilter='';state.tagFilter='';state.gondolaFilter='';
 if(match)state.expandedProductGroups.add(match.apparel_model_id?
  'model:'+match.apparel_model_id:'product:'+match.id);
 render();
 if(match){
   const key=match.apparel_model_id?'model:'+match.apparel_model_id:'product:'+match.id;
   const card=[...document.querySelectorAll('[data-product-card]')].find(x=>x.dataset.productCard===key);
   card?.scrollIntoView({block:'nearest',behavior:'smooth'});
 }else toast('Código não localizado. Confira o EAN ou SKU.',true);
}
function switchView(view) {
  if(view==='pedidos-lojas'||view==='separacao')view='pedidos';
  if(view==='eventos'&&state.profile?.role!=='evento')view='lojas';
  state.activeStore=null;state.activeStoreTab='resumo';
  if(['roupas','saida','balanco','inventario'].includes(view))view='produtos';
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
  if(action==='order-cart-edit'){
   const form=target.closest('form');if(form)editOrderReview(form);return;
  }
  if(action.startsWith('order-cart-')){
   const form=target.closest('form[data-form="store-order-create"]');
   if(form&&orderCartAction(form,target))return;
  }
  if(action==='view'){closeMobileNavigation(false);switchView(view);return;}
  if(action==='open-tv'){
    if(!state.profile?.active||!['admin','gerente'].includes(state.profile.role))
      return toast('Acesso exclusivo do gerente e administrador.',true);
    closeMobileNavigation(false);
    window.open('./painel-tv.html','_blank','noopener,noreferrer');
    return;
  }
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
      searchAndManageSku(code,true);
    });}catch(error){fail(error);return;}
  }
  if(action==='dashboard-product-search'){
    if(!permittedView('produtos'))return toast('Seu perfil não tem acesso ao catálogo.',true);
    const input=document.querySelector('[data-dashboard-product-query]');
    const query=String(input?.value||'').trim();
    if(!query)return input?.focus();
    state.categoryFilter='';state.tagFilter='';state.gondolaFilter='';
    switchView('produtos');state.search=query;state.page=0;render();return;
  }
  if(action==='dashboard-stock-shortage'){
    if(!permittedView('produtos'))return;
    state.categoryFilter='';state.tagFilter='';switchView('produtos');
    state.catalogSort='available-asc';render();return;
  }
  if(action==='dashboard-orders'){
    if(!permittedView('pedidos'))return;
    const status=target.dataset.status||'todos';
    if(!['todos','a_separar','em_separacao','a_conferir','pronto_saida','pendente_estoque'].includes(status))return;
    switchView('pedidos');
    const page=document.querySelector('.uo-page'),field=page?.querySelector('[data-unified-status]');
    if(!page||!field)return;
    field.value=status;
    const sort=page.querySelector('[data-unified-sort]');
    if(sort)sort.value='prioridade';
    filterUnifiedOrders(page,'',status,'todos','prioridade');
    page.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(action==='dashboard-order-open'){
    if(!permittedView('pedidos'))return;
    const kind=target.dataset.kind;
    if(!unifiedOrderRecords().some(o=>o.kind===kind&&o.id===id))return;
    state.pendingOrderFocus={kind,id};switchView('pedidos');return;
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
        '<div><img src="./cdsb-emblem.jpg" alt="Brasão do CDSB" width="56" height="56">'+
          '<strong id="mobile-navigation-title">Menu do sistema</strong></div>'+
        '<button type="button" data-action="mobile-more-close" class="mobile-navigation-close" aria-label="Fechar menu">✕</button>'+
      '</header>'+
      '<div class="mobile-navigation-scroll">'+
        '<div class="mobile-menu-label">NAVEGAÇÃO</div>'+
        '<nav class="c-more-items" aria-label="Seções do CDSB">'+controls+'</nav>'+
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
  if(action==='product-gallery-prev'||action==='product-gallery-next'){
    const gallery=target.closest('[data-product-gallery]');
    const image=gallery?.querySelector('img[data-photo-path]');
    if(!gallery||!image)return;
    let paths=[];
    try{paths=JSON.parse(gallery.dataset.galleryPaths||'[]');}catch{return;}
    if(!Array.isArray(paths)||paths.length<2)return;
    const oldIndex=Number(gallery.dataset.galleryIndex||0);
    const index=(oldIndex+(action==='product-gallery-next'?1:-1)+paths.length)%paths.length;
    const path=paths[index];if(typeof path!=='string'||!path)return;
    gallery.dataset.galleryIndex=String(index);
    image.dataset.photoPath=path;
    const counter=gallery.querySelector('[data-gallery-count]');
    if(counter)counter.textContent=(index+1)+' / '+paths.length;
    try{
      const url=await signedPhotoUrl(path);
      if(image.isConnected&&image.dataset.photoPath===path)image.src=url;
    }catch(error){
      if(image.isConnected&&image.dataset.photoPath===path){
        gallery.dataset.galleryIndex=String(oldIndex);
        image.dataset.photoPath=paths[oldIndex];
        if(counter)counter.textContent=(oldIndex+1)+' / '+paths.length;
        toast('Não foi possível carregar esta foto.',true);
      }
    }
    return;
  }
  if(action==='product-gallery-zoom'){
    const gallery=target.closest('[data-product-gallery]');
    const image=gallery?.querySelector('img[data-photo-path]');
    const path=image?.dataset.photoPath;
    if(!path)return;
    try{
      const url=await signedPhotoUrl(path);
      if(url)photoLightbox(url,target.closest('[data-product-card]')?.querySelector('.product-card-name')?.textContent||'Foto do produto');
    }catch(error){toast('Foto indisponível no momento.',true);}
    return;
  }
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
    const isBuyCategory=mode==='buy-filter',isBuyTag=mode==='buy-tag';
    const selected=isBuyCategory?state.purchaseCatalog.category:isBuyTag?state.purchaseCatalog.tag:
      mode==='product'?chosenCategory(form):
      mode==='parent'?form?.querySelector('input[name="parent_id"]')?.value:
      mode==='tag'?state.tagFilter:state.categoryFilter;
    openTaxonomyPicker({
      trigger:target,categories:(mode==='tag'||isBuyTag)?state.tags:state.categories,
      selected:selected||'',mode:isBuyTag?'tag':isBuyCategory?'filter':mode,
      excludeId:mode==='parent'?form?.dataset.id:null,
      onSelect:value=>{
        if(isBuyCategory){state.purchaseCatalog.category=value;state.purchaseCatalog.page=0;render();return;}
        if(isBuyTag){state.purchaseCatalog.tag=value;state.purchaseCatalog.page=0;render();return;}
        if(mode==='filter'){state.categoryFilter=value;state.page=0;render();return;}
        if(mode==='tag'){state.tagFilter=value;state.page=0;render();return;}
        const input=form?.querySelector('input[name="'+(mode==='parent'?'parent_id':'category_id')+'"]');
        if(input)input.value=value;
        const label=target.querySelector('[data-category-label]');
        if(label)label.textContent=value?categoryFull(value):(mode==='parent'?'Nenhuma (principal)':'Escolher categoria');
        if(mode==='product'){
          refreshProductTagChoices(form);
          refreshCategorySizeOptions(form,state.categories,state.gondolas);
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
    try{return apparelAddRow(target,{h,gondolas:state.gondolas});}catch(error){fail(error);return;}
  }
  if(action==='apparel-fill-sizes'){
    try{return apparelFillSizes(target,{h,gondolas:state.gondolas});}catch(error){fail(error);return;}
  }
  if(action==='apparel-variant-edit'){
    if(!canRegisterProducts())return;
    try{const p=product(id),m=state.apparelModels.find(x=>x.id===p?.apparel_model_id);
      return apparelVariantEditModal(p,{h,formModal,
        variationOptions:resolveCategoryVariations(state.categories,m?.category_id||p?.category_id).options,procurementFields,gondolas:state.gondolas});
    }catch(error){fail(error);return;}
  }
  if(action==='product-gallery-quick'){
    if(!hasPermission('products.edit'))return;
    try{
      if(target.dataset.isModel==='true'){
        const model=state.apparelModels.find(m=>m.id===id);
        if(!model)return toast('Modelo de produto não encontrado.',true);
        return apparelPhotoModal(model,state,{formModal,photoChooser,hydrateImages});
      }
      const item=product(id);
      if(!item||item.apparel_model_id)return toast('Produto não encontrado.',true);
      return quickProductPhotoModal(item);
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
      addSizesContent(model,variants,options,state.gondolas),'extra-sizes','Cadastrar variações');
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
  if(action==='buy-clear-filters'){
    state.purchaseSupplierFilter='';
    state.purchaseCatalog={search:'',category:'',tag:'',gondola:'',sort:'priority',onlyReplenishment:true,page:0};
    render();return;
  }
  if(action==='buy-orders-all'){state.purchaseOrderFilter='';render();return;}
  if(action==='buy-tab'){
    const tab=target.dataset.tab;
    if(['reposicao','pedidos','acompanhamento','fornecedores'].includes(tab)){
      state.purchaseTab=tab;state.purchaseOrderFilter='';render();
    }
    return;
  }
  if(action==='buy-stat'){
    const stat=target.dataset.stat;
    if(stat==='repor'){state.purchaseTab='reposicao';state.purchaseCatalog.onlyReplenishment=true;state.purchaseCatalog.missingSupplier=false;}
    if(stat==='sem-fornecedor'){state.purchaseTab='reposicao';state.purchaseSupplierFilter='';state.purchaseCatalog.onlyReplenishment=false;state.purchaseCatalog.missingSupplier=true;}
    if(['abertas','atrasadas'].includes(stat)){state.purchaseTab='pedidos';state.purchaseOrderFilter=stat;}
    state.purchaseCatalog.page=0;render();return;
  }
  if(action==='buy-add-to-draft')return purchaseDraftTargetModal(target.dataset.group);
  if(action==='buy-order-open')return purchaseDraftDetails(state.purchaseOrders.find(o=>o.id===id));
  if(action==='buy-draft-mark-sent'){
   const order=state.purchaseOrders.find(o=>o.id===id);
   if(!order||order.status!=='rascunho')return;
   if(!window.confirm('Confirma que este pedido já foi enviado efetivamente ao fornecedor? Esta ação apenas registra o envio, não transmite mensagens.'))return;
   return exec(async()=>{
    assertOk(await db.rpc('set_purchase_order_status',{p_id:id,p_status:'enviado'}));
    closeTopModal();
   },'Encomenda registrada como enviada ao fornecedor.');
  }
  if(action==='buy-open-group'){
    const groupKey=target.dataset.group;
    const panel=target.closest('[data-buy-card]')?.querySelector('[data-buy-expand]');
    if(!panel)return;
    const open=!panel.open;
    setPurchasePanelOpen(groupKey,open);
    if(open){prefillPurchaseMinimums(groupKey);await loadPurchaseOutflow(groupKey);}
    return;
  }
  if(action==='buy-load-more'){
    state.purchaseCatalog.page+=1;render();return;
  }
  if(action==='buy-suppliers')return supplierManagerModal();
  if(action==='buy-supplier-new')return supplierFormModal();
  if(action==='buy-supplier-edit'){
   const supplier=state.suppliers.find(s=>s.id===id);
   if(supplier)return supplierFormModal(supplier);
   return;
  }
  if(action==='buy-new'||action==='buy-review')return purchaseReviewModal(target.dataset.supplier||null);
  if(action==='buy-review-supplier')return purchaseReviewModal(target.dataset.supplier||null);
  if(action==='buy-cart-remove'||action==='buy-cart-remove-model'){
   if(!hasPermission('purchases.manage'))return;
   const supplier=target.dataset.supplier;
   const keep=purchaseReviewFormValues();
   if(action==='buy-cart-remove')state.purchaseCart.delete(id);
   else {
    const groups=purchaseCartReviewGroups(state.purchaseCart,state.items,state.apparelModels,supplier);
    const group=groups.find(g=>g.key===target.dataset.group);
    for(const row of group?.rows||[])state.purchaseCart.delete(row.id);
   }
   savePurchaseCart();
   const remaining=purchaseCartBySupplier(state.purchaseCart,state.items);
   if(remaining.has(supplier))return purchaseReviewModal(supplier,keep);
   if(remaining.size)return purchaseReviewModal();
   closeTopModal();render();return;
  }
  if(action==='buy-print-alerts'){
   if(!hasPermission('purchases.manage'))return;
   const suggestions=purchaseSuggestions(state.items,state.balances,state.stockReservations,
    state.purchaseOrders,state.purchaseItems).filter(p=>!state.purchaseSupplierFilter||p.supplier_id===state.purchaseSupplierFilter);
   return printHTML(replenishmentDocument(suggestions,state.suppliers));
  }
  if(action==='buy-print-order'){
   if(!hasPermission('purchases.manage'))return;
   const order=state.purchaseOrders.find(x=>x.id===id);
   if(!order)return toast('Pedido de compra não encontrado.',true);
   try{return await downloadBuyOrder(order,state.purchaseItems.filter(x=>x.purchase_order_id===id));}
   catch(error){return fail(error);}
  }
  if(action==='buy-receive'){
    if(!hasPermission('purchases.manage'))return;
    return purchaseReceiptModal(state.purchaseOrders.find(o=>o.id===id));
  }
  if(action==='buy-eta-edit'){
   if(!hasPermission('purchases.manage'))return;
   return purchaseEtaModal(state.purchaseOrders.find(x=>x.id===id));
  }
  if(action==='buy-product-report'){
    if(!hasPermission('purchases.manage'))return;
    const groupKey=target.dataset.group;
    setPurchasePanelOpen(groupKey,true);
    const current=[...document.querySelectorAll('[data-buy-card]')].find(x=>x.dataset.buyCard===groupKey);
    const view=current?.querySelector('[data-buy-outflow]');
    if(view?.dataset.loaded==='error')delete view.dataset.loaded;
    await loadPurchaseOutflow(groupKey);
    view?.scrollIntoView({block:'nearest',behavior:'smooth'});
    return;
   }
   if(action==='buy-status'){
   if(!hasPermission('purchases.manage'))return;
   const order=state.purchaseOrders.find(o=>o.id===id),status=target.dataset.status;
   if(!order||!['enviado','cancelado'].includes(status))return;
   if(!window.confirm('Alterar compra #'+order.number+' para '+status+'? Esta ação não movimenta estoque.'))return;
   return exec(async()=>assertOk(await db.rpc('set_purchase_order_status',{p_id:id,p_status:status})),
    'Situação da compra atualizada. O saldo físico não foi alterado.');
  }
  if(action==='buy-print-stock')return printStockReport();
  if(action==='buy-print-activities')return printActivityReport();
  if(action==='commercial-order-print')return printCommercialOrder(id);
  if(action==='event-print-summary')return printEventSummary(id);
  if(action==='product-new')return productModal();
  if(action==='products-toggle-inactive'){state.showInactiveProducts=!state.showInactiveProducts;state.page=0;render();return;}
  if(action==='products-clear-filters'){
    state.search='';state.categoryFilter='';state.tagFilter='';state.gondolaFilter='';state.page=0;
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
  if(action==='product-model-delete'){
    if(!isAdmin()||!hasPermission('system.force_delete'))return;
    return forceDeletePreview('model',id);
  }
  if(action==='product-delete'){
    if(hasPermission('system.force_delete'))return forceDeletePreview('product',id);
    if(!hasPermission('products.delete'))return;
    const item=product(id);if(!item)return;
    if(!window.confirm('Excluir o produto "'+item.name+'"?\nSe existir histórico, ele será desativado para preservar as movimentações. O estoque deve estar zerado.'))return;
    return exec(async()=>{
      const status=assertOk(await db.rpc('remove_product_safely',{p_product_id:id}));
      if(status==='archived')state.showInactiveProducts=false;
    },'Produto excluído ou desativado para preservar o histórico.');
  }
  if(action==='product-card-sizes'||action==='product-card-edit-toggle'){
    const card=target.closest('[data-product-card]');
    if(!card)return;
    const openingStock=action==='product-card-sizes';
    const details=card.querySelector(openingStock?'[data-product-details]':'[data-product-editor]');
    const other=card.querySelector(openingStock?'[data-product-editor]':'[data-product-details]');
    if(!details)return;
    const willOpen=!details.open;
    if(other)other.open=false;
    details.open=willOpen;
    const stockButton=card.querySelector('[data-action="product-card-sizes"]');
    const editButton=card.querySelector('[data-action="product-card-edit-toggle"]');
    if(stockButton){
      const isOpen=Boolean(card.querySelector('[data-product-details]')?.open);
      const count=stockButton.dataset.variationCount||'';
      const label=(isOpen?'Ocultar variações':'Ver variações')+(count?' ('+count+')':'');
      stockButton.setAttribute('aria-expanded',String(isOpen));
      stockButton.setAttribute('aria-label',label);
      stockButton.title=label;
      stockButton.classList.toggle('is-active',isOpen);
    }
    if(editButton){
      const isOpen=Boolean(card.querySelector('[data-product-editor]')?.open);
      const label=isOpen?'Fechar edição':'Editar produto';
      editButton.setAttribute('aria-expanded',String(isOpen));
      editButton.setAttribute('aria-label',label);
      editButton.title=label;
      editButton.classList.toggle('is-active',isOpen);
    }
    const key=card.getAttribute('data-product-card');
    if(openingStock&&willOpen)state.expandedProductGroups.add(key);
    else state.expandedProductGroups.delete(key);
    if(willOpen)details.scrollIntoView({block:'nearest',behavior:'smooth'});
    return;
  }
  if(action==='product-stock-tab'||action==='product-editor-tab'){
    const stock=action==='product-stock-tab';
    const container=target.closest(stock?'[data-product-details]':'[data-product-editor]');
    if(!container)return;
    const selected=target.dataset.tab,attribute=stock?'data-stock-panel':'data-editor-panel';
    for(const tab of container.querySelectorAll('[data-action="'+action+'"]')){
      tab.setAttribute('aria-selected',String(tab.dataset.tab===selected));
    }
    for(const panel of container.querySelectorAll('['+attribute+']')){
      panel.hidden=panel.getAttribute(attribute)!==selected;
    }
    return;
  }
  if(action==='product-stock-mode'){
    const mode=target.dataset.mode;
    if(!['entrada','saida','contagem'].includes(mode))return;
    if(!hasPermission({entrada:'stock.entry',saida:'stock.exit',contagem:'stock.balance'}[mode]))return;
    return manageSku(id,mode);
  }
  if(action==='product-balance-scan'){
    try{
      return scanEAN(code=>{
        const container=target.closest('[data-product-details]');
        const row=[...container.querySelectorAll('[data-balance-item]')].find(r=>{
          const p=product(r.dataset.productId);
          return p&&(p.ean===code||p.sku===code);
        });
        if(!row)return toast('EAN/SKU não pertence a este produto.',true);
        const field=row.querySelector('[data-balance-count]');
        field?.focus();field?.select();
        row.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
    }catch(error){fail(error);return;}
  }
  if(action==='product-balance-save'){
    if(state.loading||isFranchisePortal()||!hasPermission('stock.balance')||
       !['admin','gerente','estoquista'].includes(state.profile?.role))return;
    const panel=target.closest('[data-product-details]');
    if(!panel)return;
    const rows=[...panel.querySelectorAll('[data-balance-item]')];
    if(!rows.length||rows.length>100)return toast('Balanço aceita de 1 a 100 variações.',true);
    const items=[];
    for(const row of rows){
      const value=row.querySelector('[data-balance-count]')?.value?.trim();
      if(!/^(0|[1-9][0-9]{0,6})$/.test(value||'')||Number(value)>1000000)
        return toast('Informe a quantidade física contada de todas as variações.',true);
      const expected=Number(row.dataset.expected),reserved=Number(row.dataset.reserved);
      if(Number(value)<reserved)return toast('Contagem menor que a quantidade reservada.',true);
      items.push({product_id:row.dataset.productId,expected,reserved,counted:Number(value)});
    }
    const differences=items.filter(x=>x.counted!==x.expected);
    const note=panel.querySelector('[data-balance-note]')?.value?.trim()||'';
    if(differences.length&&note.length<5)
      return toast('Explique a divergência em pelo menos 5 caracteres.',true);
    if(differences.length&&!window.confirm('Salvar balanço de '+items.length+
      ' variações, com '+differences.length+' diferença(s)? O estoque físico será ajustado e auditado.'))
      return;
    return exec(async()=>assertOk(await db.rpc('quick_stock_count_batch',{
      p_items:items,p_note:note||null
    })),'Balanço de '+items.length+' variações registrado em uma única operação.');
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
  if(action==='shelf-label-open')return shelfLabelsModal(id);
  if(action==='shelf-label-one'){
    if(isFranchisePortal())return toast('Impressão permitida no estoque central.',true);
    const item=product(id);
    if(!item||item.force_archived_at)return toast('Produto não encontrado.',true);
    const editForm=target.closest('form[data-form="product-edit"]');
    if(editForm&&['name','sku','ean','gondola','prateleira'].some(field=>
       editForm.querySelector('[name="'+field+'"]')?.value?.trim()!==
       String(item[field]||'').trim()))
      return toast('Salve as alterações do produto antes de imprimir a etiqueta.',true);
    const model=state.apparelModels.find(m=>m.id===item.apparel_model_id);
    const label=shelfLabelData(item,model?.name||'');
    if(!label.valid)return toast('Cadastre primeiro a gôndola e um EAN ou SKU válido.',true);
    return printShelfLabels([label]);
  }
  if(action==='product-card-edit'){
    if(!canRegisterProducts())return;
    return productModelManager(id);
  }
  if(action==='product-edit'){
    const item=product(id);
    if(item?.apparel_model_id)return apparelVariantEditModal(item,{h,formModal,gondolas:state.gondolas,procurementFields});
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
  if(action.startsWith('lot-')){
    const form=target.closest('form[data-form="event-batch-write"]');
    if(!form)return;
    if(lotCatalogAction(form,target))refreshEventLotCounter(form);
    return;
  }
  if(action==='event-plan-scan')return scanInto('[data-plan-search]',target.closest('form'));
  if(action==='event-batch-new')return eventBatchModal(target.dataset.event||state.activeEvent);
  if(action==='event-batch-edit')return eventBatchModal(
    state.eventPickBatches.find(b=>b.id===id)?.event_id,id);
  if(action==='event-batch-pick')return eventBatchPickModal(id);
  if(action==='event-batch-finish-pick')return saveEventBatchPicking(target.closest('form'),true);
  if(action==='event-batch-cancel')return eventBatchCancelModal(id);
  if(action==='event-batch-go'){
    if(!permittedView('pedidos'))return toast('Sem permissão para acessar os pedidos.',true);
    const event=state.eventPickBatches.find(x=>x.id===id);
    if(!event||!eventById(event.event_id))return toast('Pedido não encontrado.',true);
    state.ordersContext={type:'event',id:event.event_id,mode:'all'};
    state.view='pedidos';render();
    const card=document.querySelector('[data-order-id="'+id+'"]');
    card?.scrollIntoView({block:'center',behavior:'smooth'});
    card?.querySelector('details.uo-order-open')?.setAttribute('open','');
    card?.querySelector('details.uo-details')?.setAttribute('open','');
    return;
  }
  if(action==='event-batch-dispatch'){
    const b=state.eventPickBatches.find(x=>x.id===id);
    if(!b||b.status!=='separado'||!isManager()||!hasPermission('orders.dispatch'))return;
    if(!window.confirm('Confirmar saída física do pedido '+b.sequence+'? O estoque central será baixado agora.'))return;
    return exec(async()=>assertOk(await db.rpc('dispatch_event_pick_batch',{p_batch:id})),
      'Pedido enviado. Saída física registrada e reservas consumidas.');
  }
  if(action==='event-batch-scan'){
    return scanEAN(code=>{
      const form=document.querySelector('.modalback form[data-form="event-batch-picking"]');
      if(!form)return;
      const matches=state.items.filter(p=>p.active&&(p.ean===code||p.sku===code));
      if(matches.length!==1)return toast('EAN/SKU não encontrado ou ambíguo.',true);
      const input=[...form.querySelectorAll('[data-pick-qty]')].find(el=>el.dataset.id===matches[0].id);
      if(!input)return toast('Produto não consta deste pedido.',true);
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
   if(hasPermission('system.force_delete'))return forceDeletePreview('event',id);
   const e=eventById(id);
   if(!e||e.deleted_at||!isManager()||!hasPermission('events.close')||!hasPermission('events.return'))return;
   const remaining=state.balances.filter(b=>b.event_id===id).reduce((sum,b)=>sum+Number(b.quantity||0),0);
   formModal('Excluir loja temporária · '+e.name,
    '<p class="help">Esta operação arquiva a loja e cancela pedidos ainda não enviados. As '+remaining+
    ' unidade(s) ainda no local serão devolvidas automaticamente à central. Movimentações anteriores não serão revertidas. O histórico ficará preservado.</p>'+
    '<label class="field"><span>Código de autorização</span><input name="delete_code" type="password" autocomplete="off" required minlength="4" maxlength="80" placeholder="Informe o código de exclusão"></label>',
    'event-delete-confirm','Excluir e devolver estoque');
   const form=document.querySelector('.modalback form[data-form="event-delete-confirm"]');
   if(form)form.dataset.eventId=id;
   return;
  }
  if(action==='store-hub-type'){
   const choice=target.dataset.type;
   if(!['todas','propria','franquia','temporaria'].includes(choice))return;
   state.storeHubFilter.type=choice;
   filterStoreHub(target.closest('.sh-hub'),state.storeHubFilter.search,choice,state.storeHubFilter.status);
   return;
  }
  if(action==='store-unit-open'){
   const type=target.dataset.locationType,uid=target.dataset.locationId;
   if(type==='event'){
    const ev=eventById(uid);
    if(!ev||ev.deleted_at||!permittedView('eventos')||
     !(hasPermission('events.read')||hasPermission('events.manage')||memberRole(uid)))return;
    state.activeStore=null;state.activeEvent=uid;state.eventUnitTab='resumo';state.view='eventos';
   }else if(type==='store'){
    const st=state.stores.find(s=>s.id===uid&&!s.is_primary&&!s.force_archived_at);
    if(!st||!(hasPermission('stores.manage')||assignedStore(uid)))return;
    state.activeStore=uid;state.activeStoreTab='resumo';state.view='lojas';
   }else return;
   render();window.scrollTo(0,0);return;
  }
  if(action==='store-unit-back'){
   state.activeStore=null;state.activeStoreTab='resumo';state.view='lojas';
   render();window.scrollTo(0,0);return;
  }
  if(action==='store-unit-tab'){
   if(!state.activeStore)return;
   const chosen=target.dataset.tab;
   if(!['resumo','pedidos','estoque','movimentacoes','configuracoes','recebimentos','cadastro'].includes(chosen))return;
   state.activeStoreTab=chosen;render();return;
  }
  if(action==='store-hub-admin'){
   if(!hasPermission('stores.manage'))return;
   state.view='lojas-admin';state.ordersContext=null;render();window.scrollTo(0,0);return;
  }
  if(action==='store-hub-back'){
   const old=state.ordersContext;state.ordersContext=null;
   if(old?.type==='event'&&eventById(old.id)&&permittedView('eventos')){
    state.activeEvent=old.id;state.view='eventos';
   }else{
    state.view='lojas';
    if(old?.type==='store'&&state.stores.some(s=>s.id===old.id&&!s.force_archived_at))
      state.activeStore=old.id;
   }
   render();window.scrollTo(0,0);return;
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
    card.querySelector('details.uo-order-open')?.setAttribute('open','');
    const details=card.querySelector('details.uo-details');
    if(details)details.open=true;
    card.scrollIntoView({block:'center',behavior:'smooth'});
   });
   return;
  }
  if(action==='event-unit-tab'){
   if(!state.activeEvent||!eventById(state.activeEvent))return;
   const tab=target.dataset.tab;
   if(!['resumo','pedidos','mercadorias','fechamento','equipe','historico'].includes(tab))return;
   state.eventUnitTab=tab;render();return;
  }
  if(action==='event-cover-edit')return eventCoverModal(id);
  if(action==='event-new')return eventModal();
  if(action==='event-detail'){state.view='eventos';state.activeEvent=id;state.eventUnitTab='resumo';render();window.scrollTo(0,0);return;}
  if(action==='back-events'){state.activeEvent=null;state.eventUnitTab='resumo';state.eventWorkflow=null;state.view='lojas';render();return;}
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
  if(action==='gondola-new')return gondolaModal();
  if(action==='gondola-edit'){
   const loc=state.gondolas.find(g=>g.id===id);
   if(loc)return gondolaModal(loc);
   return;
  }
  if(action==='gondola-toggle'){
   if(!canManageGondolas())return;
   const loc=state.gondolas.find(g=>g.id===id);if(!loc)return;
   if(!window.confirm((loc.active?'Desativar':'Ativar')+' a gôndola "'+loc.name+'"? Produtos já cadastrados não serão alterados.'))return;
   return exec(async()=>assertOk(await db.from('gondolas').update({active:!loc.active}).eq('id',loc.id).select('id').single()),
    'Situação da gôndola atualizada.');
  }
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
  if(action==='admin-order-delete-open'){
    if(!isAdmin()||isFranchisePortal())return toast('Somente administradores podem excluir pedidos.',true);
    const kind=target.dataset.kind,order=unifiedOrderById(kind,id);
    if(!order||!['avulso','loja','evento'].includes(kind))return toast('Pedido não encontrado.',true);
    const code=order.code;
    formModal('Excluir pedido #'+code,
      '<div class="note"><strong>Exclusão administrativa</strong><p>Este registro sairá da lista de Pedidos e das filas operacionais. Se ainda estiver em andamento, será cancelado e suas reservas serão liberadas. Movimentações de estoque já realizadas e registros de auditoria serão preservados.</p></div>'+
      '<p class="help">Para confirmar, digite exatamente <strong>'+h(code)+'</strong>.</p>'+
      field('Código de confirmação','confirmation','text','','required autocomplete="off" maxlength="5" autocapitalize="characters"'),
      'admin-order-delete','Excluir pedido');
    const form=document.querySelector('.modalback form[data-form="admin-order-delete"]');
    if(form){form.dataset.order=id;form.dataset.kind=kind;}
    return;
  }
  if(action==='order-retry'){
    const kind=target.dataset.kind,order=unifiedOrderById(kind,id);
    if(!order||!hasPermission('orders.dispatch')||isFranchisePortal())return;
    if(kind==='loja'&&!assignedStore(order.raw.from_store_id))return;
    return exec(async()=>assertOk(await db.rpc('retry_unified_order_reservation',{
      p_kind:kind,p_order:id
    })),'Disponibilidade reavaliada. Consulte as faltas no pedido.');
  }
  if(action==='uo-summary-filter'){
    const page=target.closest('.uo-page');
    const field=page?.querySelector('[data-unified-status]');
    if(field){
      field.value=field.value===target.dataset.status?'todos':target.dataset.status;
      filterUnifiedOrders(page,page.querySelector('[data-unified-search]')?.value||'',
       field.value,page.querySelector('[data-unified-destination]')?.value||'todos',
       page.querySelector('[data-unified-sort]')?.value||'recentes');
    }
    return;
   }
   if(action==='order-group-location'||action==='order-group-model'){
    const container=target.closest('[data-group-view]');
    if(!container)return;
    const mode=action==='order-group-model'?'model':'location';
    container.dataset.groupView=mode;
    container.querySelectorAll('.uo-group-switch button').forEach(el=>{
      const selected=el.dataset.action===action;
      el.classList.toggle('is-current',selected);
      el.setAttribute('aria-pressed',String(selected));
    });
    return;
  }
  if(action==='order-op-camera')return scanEAN(code=>{
    const form=document.querySelector('.modalback form[data-form="order-operational"]');
    if(form)operationalLocateSku(form,code);
  });
  if(action==='order-op-pick')return operationalModal(target.dataset.kind,id,'separacao');
  if(action==='order-op-check')return operationalModal(target.dataset.kind,id,'conferencia');
  if(action==='order-op-finish')return submitOperational(target.closest('form'),true);
  if(action==='order-op-send'){
   const order=unifiedOrderById(target.dataset.kind,id);
   if(!order||order.workflow?.stage!=='expedicao'||!hasPermission('orders.dispatch'))return;
   const shipped=order.lines.reduce((sum,line)=>sum+Number(order.workflow.items?.[line.id]?.counted||0),0);
   if(!window.confirm('Registrar envio físico de '+shipped+' unidade(s) do pedido '+order.code+
     (order.workflow.has_difference?' COM DIVERGÊNCIA? As faltas serão registradas e suas reservas liberadas.':'?')))
     return;
   return exec(async()=>assertOk(await db.rpc('send_operational_order',{
     p_kind:order.kind,p_order:order.id
   })),'Envio registrado e reservas processadas.');
  }
  if(action==='order-final-verify')return finalVerificationModal(target.dataset.kind,id);
  if(action==='verify-open-camera')return scanEAN(code=>{
    const form=document.querySelector('.modalback form[data-form="order-final-verify"]');
    if(form)verificationReadCode(form,code);
  });
  if(action==='verify-edit-item')return verificationEditItem(target.closest('form'),target.dataset.id);
  if(action==='verify-confirm-item')return saveFinalVerification(target.closest('form'));
  if(action==='order-shortage-adjust')return unifiedShortageModal(target.dataset.kind,id);
  if(action==='order-print-thermal'||action==='order-print-a4')return printUnifiedOrder(target.dataset.kind,id);
  if(action==='avulso-pick')return avulsoPickingModal(id);
  if(action==='avulso-dispatch'){
    const order=unifiedOrderById('avulso',id);
    if(!order||order.status!=='separado'||!hasPermission('orders.dispatch'))return;
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
  if(action==='unified-order-new')return orderDestinationPicker();
  if(action==='order-new')return orderDestinationPicker();
  if(action==='order-assign-event'){
    if(!hasPermission('orders.assign'))return;return orderEventModal(id);
  }
  if(action==='customer-link-new')return toast('Links para clientes foram desativados.',true);
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
  if(action==='commercial-confirm-delivery'){
   const order=state.storeOrders.find(o=>o.id===id);
   if(!order||order.status!=='despachado'||!assignedStore(order.to_store_id)||!hasPermission('orders.franchise'))return;
   if(!window.confirm('Confirmar recebimento do pedido? Isso não cria estoque interno na sua loja.'))return;
   return exec(async()=>assertOk(await db.rpc('confirm_commercial_order_delivery',{p_order:id})),
    'Entrega confirmada. Pedido movido para o histórico.');
  }
  if(action==='store-order-new')return storeOrderModal(target.dataset.store||state.activeStore||'');
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
  if(action==='force-delete-preview'){
   return forceDeletePreview(target.dataset.kind,id);
  }
  if(action==='store-delete'){
    if(hasPermission('system.force_delete'))return forceDeletePreview('store',id);
    if(!hasPermission('stores.manage')||!window.confirm('Excluir esta loja sem histórico?'))return;
    await exec(async()=>assertOk(await db.from('stores').delete().eq('id',id)),'Loja excluída.');return;
  }
  if(action==='users-provision'){
   if(!isAdmin()||state.loading)return;
   if(!window.confirm('Criar as 6 contas-padrão do CDSB com senhas temporárias fortes? Usuários atuais não serão bloqueados nem apagados. As senhas serão mostradas uma única vez nesta tela.'))return;
   state.loading=true;
   try{
    const {data,error}=await db.functions.invoke('cdsb-provision-users',{
     body:{action:'provision-defaults',confirm:'CRIAR_CONTAS_CDSB'}
    });
    if(error)throw error;
    if(!data?.success)throw Error(data?.error||'Não foi possível preparar contas.');
    await loadData();
    const list=(data.accounts||[]).map(a=>a.full_name+' | '+a.username+
      (a.password?' | SENHA TEMPORÁRIA: '+a.password:' | '+a.status)).join('\n');
    formModal('Credenciais iniciais do CDSB',
     '<p class="help">Copie agora e entregue as senhas individualmente por canal seguro. O sistema não permite recuperá-las depois. Contas existentes não são redefinidas.</p>'+
     '<textarea readonly data-provision-result rows="11" class="cdsb-secret-list">'+h(list)+'</textarea>'+
     '<div class="actions">'+button('Copiar credenciais','users-copy-access','','small')+'</div>',
     'users-provision-receipt','Fechar');
   }catch(error){fail(error);}finally{state.loading=false;}
   return;
  }
  if(action==='users-copy-access'){
   const field=target.closest('form')?.querySelector('[data-provision-result]');
   if(!field)return;
   try{await navigator.clipboard.writeText(field.value);toast('Credenciais copiadas. Guarde com segurança.');}
   catch{field.focus();field.select();toast('Selecione e copie as credenciais.');}
   return;
  }
  if(action==='users-archived-toggle'){
   if(!isAdmin())return;
   state.usersAdminArchived=!state.usersAdminArchived;render();return;
  }
  if(action==='buy-task-new')return procurementTaskModal();
   if(action==='buy-task-status'){
    const task=state.procurementTasks.find(t=>t.id===id);
    const next=target.dataset.status;
    if(!task||!['pendente','em_andamento','concluida','cancelada'].includes(next))return;
    if(!hasPermission('purchases.manage')&&task.assigned_to!==state.user?.id)return;
    return exec(async()=>assertOk(await db.rpc('set_procurement_task_status',{
      p_id:id,p_status:next
    })),'Tarefa atualizada.');
   }
   if(action==='user-edit')return userEditModal(id);
  if(action==='user-delete'){
   if(!isAdmin()||id===state.user?.id)return;
   const u=state.users.find(x=>x.id===id);
   if(!u||u.archived_at)return;
   const confirmation=window.prompt('EXCLUIR '+u.full_name+' da equipe? O login será bloqueado e os registros históricos preservados. Digite EXCLUIR para confirmar:','');
   if(confirmation===null)return;
   if(confirmation.trim()!=='EXCLUIR')return toast('Exclusão cancelada: confirmação incorreta.',true);
   return exec(async()=>{await invokeManageUser('archive',{user_id:id,confirm:'EXCLUIR'});},
    'Usuário excluído da equipe e acesso bloqueado. Histórico preservado.');
  }
  if(action==='user-restore'){
   if(!isAdmin())return;
   const u=state.users.find(x=>x.id===id&&x.archived_at);
   if(!u||!window.confirm('Restaurar a conta '+u.full_name+' e liberar o login novamente?'))return;
   return exec(async()=>{await invokeManageUser('restore',{user_id:id});},
    'Conta restaurada. As permissões anteriores foram preservadas.');
  }
  if(action==='user-new')return userModal();
  if(action==='user-role')return userRoleModal(id);
  if(action==='search-scan'){
    try{return scanEAN(code=>searchAndManageSku(code));}
    catch(error){fail(error);return;}
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
    const e=eventById(id);
    if(!e||e.deleted_at||e.status!=='ativo'||!hasPermission('events.close')||
      !(hasPermission('events.manage')||memberRole(e.id)==='responsavel'))
      return toast('Sem permissão para encerrar esta loja temporária.',true);
    const openOrders=state.eventPickBatches.filter(b=>b.event_id===e.id&&
      !['enviado','cancelado'].includes(b.status)).length;
    if(openOrders)return toast('Há '+openOrders+' pedido(s) aguardando expedição ou cancelamento. Resolva antes de encerrar.',true);
    const remaining=state.balances.filter(x=>x.event_id===e.id).reduce((s,b)=>s+Number(b.quantity||0),0);
    if(remaining>0)return toast('Há '+remaining+' unidade(s) ainda na loja temporária. Concilie devolvidas, avariadas e não devolvidas antes de encerrar.',true);
    if(!window.confirm('Encerrar esta loja temporária? O saldo está conciliado em zero.'))return;
    await exec(async()=>assertOk(await db.rpc('close_event',{p_event_id:e.id})),'Loja temporária encerrada com saldo conciliado.');
    return;
  }
  if(action==='member-remove'){
    const e=eventById(eventId);
    if(!hasPermission('events.manage')||!e||e.deleted_at||!user||
      !state.members.some(m=>m.event_id===e.id&&m.user_id===user))return;
    if(!window.confirm('Remover o acesso desta pessoa a este evento?'))return;
    await exec(async()=>assertOk(await db.from('event_members').delete().eq('event_id',e.id).eq('user_id',user)),'Acesso removido.');
    return;
  }
  if(action==='user-toggle'){
    const u=state.users.find(x=>x.id===id);
    if(!u||u.archived_at||!window.confirm((u.active?'Bloquear':'Reativar')+' o usuário '+u.full_name+'?'))return;
    await exec(async()=>assertOk(await db.from('staff_profiles').update({active:!u.active}).eq('id',id)),'Permissão atualizada.');
  }
}
async function handleSubmit(event){
  const form=event.target.closest('form[data-form]');if(!form)return;
  event.preventDefault();if(state.loading)return;
  const values=Object.fromEntries(new FormData(form).entries());
  const type=form.dataset.form;
  if(type==='order-operational')return submitOperational(form,false);
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
  if(type==='shelf-label-print'){
    if(isFranchisePortal())return toast('Acesso indisponível.',true);
    const source=product(form.dataset.productId);
    if(!source)return toast('Produto não encontrado.',true);
    const model=state.apparelModels.find(m=>m.id===source.apparel_model_id);
    const group=source.apparel_model_id?
      state.items.filter(p=>p.apparel_model_id===source.apparel_model_id&&!p.force_archived_at):[source];
    try{
      const selected=collectShelfLabels(group,form,model?.name||'');
      if(printShelfLabels(selected))closeTopModal();
    }catch(error){toast(error.message||'Verifique as etiquetas selecionadas.',true);}
    return;
  }
  if(type==='admin-order-delete'){
    if(!isAdmin()||isFranchisePortal())return toast('Somente administradores podem excluir pedidos.',true);
    const kind=form.dataset.kind,id=form.dataset.order,
      code=orderCode(kind,id),
      confirmation=String(values.confirmation||'').trim().toUpperCase();
    if(!['avulso','loja','evento'].includes(kind)||!id||confirmation!==code)
      return toast('Digite o código do pedido para confirmar a exclusão.',true);
    return exec(async()=>assertOk(await db.rpc('admin_remove_order',{
      p_kind:kind,p_order_id:id,p_confirmation:confirmation
    })),'Pedido excluído da operação. Histórico de estoque preservado.');
  }
  if(type==='gondola-save'){
   if(!canManageGondolas())return toast('Sem permissão para alterar gôndolas.',true);
   const name=String(values.name||'').trim();
   if(!name||name.length>40)return toast('Informe a identificação da gôndola com até 40 caracteres.',true);
   const exists=state.gondolas.some(g=>g.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')&&g.id!==form.dataset.id);
   if(exists)return toast('Já existe uma gôndola com essa identificação.',true);
   return exec(async()=>{
    const record=form.dataset.id?
     db.from('gondolas').update({name}).eq('id',form.dataset.id).select('id').single():
     db.from('gondolas').insert({name}).select('id').single();
    assertOk(await record);
   },'Gôndola salva e disponível no cadastro.');
  }
  if(type==='buy-task-create'){
   if(!hasPermission('purchases.manage'))return;
   let draft;
   try{draft=procurementTaskDraft(values);}
   catch(error){return toast(error.message,true);}
   if(draft.supplier_id&&!state.suppliers.some(s=>s.id===draft.supplier_id&&s.active))
    return toast('Fornecedor inativo ou não encontrado.',true);
   if(draft.assigned_to&&!state.users.some(u=>u.id===draft.assigned_to&&u.active&&!u.archived_at))
    return toast('Responsável inválido.',true);
   return exec(async()=>assertOk(await db.from('procurement_tasks').insert({
    ...draft,created_by:state.user?.id
   })),'Tarefa criada e disponibilizada ao responsável.');
  }
  if(type==='buy-suppliers-list'){closeTopModal();return;}
  if(type==='buy-supplier-save'){
   if(!hasPermission('purchases.manage'))return;
   let payload;
   try{payload=supplierDirectoryPayload(values);}catch(error){return toast(error.message,true);}
   if(form.dataset.id)payload.active=values.active==='true';
   return exec(async()=>{
    const response=form.dataset.id?
      db.from('suppliers').update(payload).eq('id',form.dataset.id):
      db.from('suppliers').insert(payload);
    assertOk(await response);
   },'Fornecedor salvo.');
  }
  if(type==='buy-report-close'){closeTopModal();return;}
  if(type==='buy-receive-save'){
   if(!hasPermission('purchases.manage'))return;
   const order=state.purchaseOrders.find(o=>o.id===form.dataset.id);
   if(!order||!['enviado','recebido_parcial'].includes(order.status))return toast('Recarregue a compra para conferir o recebimento.',true);
   const stored=new Map(state.purchaseItems.filter(i=>i.purchase_order_id===order.id).map(i=>[i.id,i]));
   const items=[];
   for(const field of form.querySelectorAll('[data-receive-item]')){
     const item=stored.get(field.dataset.receiveItem),quantity=Number(field.value);
     if(!item||String(field.value).trim()===''||!Number.isInteger(quantity)||quantity<0||quantity>item.quantity-Number(item.received_quantity||0))
       return toast('Quantidades inválidas: confira o saldo pendente de cada variação.',true);
     if(quantity>0)items.push({item_id:item.id,quantity});
   }
   if(!items.length)return toast('Informe pelo menos uma unidade efetivamente recebida.',true);
   if(items.length>100)return toast('Confira até 100 variações por recebimento.',true);
   const units=items.reduce((n,x)=>n+x.quantity,0);
   if(!window.confirm('Confirmar entrada física de '+units+' unidade(s) da compra PC-'+order.number+'? Esta ação atualizará imediatamente o estoque do CD.'))return;
   return exec(async()=>assertOk(await db.rpc('receive_purchase_order',{
     p_order:order.id,p_items:items,p_request_id:form.dataset.requestId,p_note:String(values.note||'').trim()||null
   })),'Recebimento conferido e entrada física registrada no estoque.');
  }
  if(type==='buy-eta-save'){
   if(!hasPermission('purchases.manage'))return;
   const days=Number(values.estimated_days);
   if(!Number.isInteger(days)||days<1||days>365)return toast('Informe de 1 a 365 dias corridos.',true);
   return exec(async()=>assertOk(await db.rpc('update_purchase_order_eta',{
    p_id:form.dataset.id,p_days:days
   })),'Previsão de chegada atualizada. O histórico foi preservado.');
  }
  if(type==='buy-choose-supplier'){closeTopModal();return;}
  if(type==='buy-order-create'){
   if(!hasPermission('purchases.manage'))return;
   const days=Number(values.estimated_days);
   if(!Number.isInteger(days)||days<1||days>365)return toast('Informe o prazo em dias corridos (1 a 365).',true);
   const supplier=String(values.supplier_id||'');
   const supplierRows=purchaseCartBySupplier(state.purchaseCart,state.items).get(supplier)||[];
   if(!supplierRows.length)return toast('Este fornecedor não possui itens selecionados.',true);
   for(const input of form.querySelectorAll('[data-buy-review-qty]')){
    if(!validPurchaseQty(input.value))return toast('Informe de 1 a 1.000.000 unidades para cada tamanho.',true);
    const found=supplierRows.find(line=>line.product.id===input.dataset.product);
    if(!found)return toast('O carrinho mudou. Reabra a revisão antes de salvar.',true);
    found.quantity=Number(input.value);
   }
   const lines=supplierRows.map(line=>({product_id:line.product.id,quantity:line.quantity}));
   if(!lines.length)return toast('Selecione uma ou mais variações para comprar.',true);
   if(!window.confirm('Salvar pedido com '+lines.length+' SKU(s), '+lines.reduce((n,x)=>n+x.quantity,0)+
    ' unidades e previsão de '+days+' dias corridos? O estoque não será alterado.'))return;
   state.loading=true;
   let savedId=null;
   try{
    savedId=assertOk(await db.rpc('save_purchase_order_with_eta',{
     p_supplier:supplier,p_items:lines,p_note:String(values.note||'').slice(0,1500),p_estimated_days:days
    }));
    // A criação é atômica. Falha no PDF NUNCA pode repetir a criação do pedido.
    for(const line of lines)state.purchaseCart.delete(line.product_id);
    savePurchaseCart();
    const order=assertOk(await db.from('purchase_orders').select('*').eq('id',savedId).single());
    const saved=assertOk(await db.from('purchase_order_items').select('*').eq('purchase_order_id',savedId));
    closeTopModal();
    await loadData();
    await downloadBuyOrder(order,saved);
    toast('Pedido salvo e PDF baixado. Confirme a encomenda após enviar o documento ao fornecedor.');
   }catch(error){
    fail(error);
    if(savedId){
     try{closeTopModal();await loadData();}catch(err){console.warn('Lista não atualizada',err);}
     toast('Pedido salvo, porém o download do PDF falhou. Use Baixar PDF na lista, sem criar outro pedido.',true);
    }
   }finally{state.loading=false;}
   return;
  }
  if(type==='product-card-basic'){
    if(!hasPermission('products.edit')||isFranchisePortal())return;
    const name=String(values.name||'').trim();
    const category=String(values.category_id||'').trim();
    const tags=[...new Set(String(values.tags||'').split(',').map(x=>x.trim()).filter(Boolean))];
    if(!name||name.length>180||!state.categories.some(cat=>cat.id===category)||
       tags.length>30||tags.some(t=>t.length>60))
      return toast('Confira o nome, a categoria e as tags do produto.',true);
    const id=form.dataset.id;
    if(form.dataset.isModel==='true'){
      return exec(async()=>assertOk(await db.rpc('update_product_model_basic',{
        p_model:id,p_name:name,p_tags:tags,p_category:category
      })),'Dados gerais do produto atualizados.');
    }
    return exec(async()=>{
      const changed=assertOk(await db.from('products').update({
        name,tags,category_id:category
      }).eq('id',id).select('id').maybeSingle());
      if(!changed)throw new Error('Produto não atualizado. Verifique sua permissão.');
    },'Dados gerais atualizados.');
  }
  if(type==='product-new'||type==='product-edit'){
    if(!canRegisterProducts())return;
    if(type==='product-new'&&form.querySelector('[data-use-sizes]')?.checked){
      state.loading=true;
      try{await saveSizedProduct(form,{
        db,assertOk,state,categoryChain,chosenCategory,productTagValues,closeTopModal,loadData,toast,saveGallery:savePhotoGallery,saveProcurement:saveModelProcurement
      });}catch(error){fail(error);}finally{state.loading=false;}
      return;
    }
    const editing=type==='product-edit',id=form.dataset.id;
    const ean=String(values.ean||'').replace(/[\s-]/g,'');
    if(ean && !/^\d{8,14}$/.test(ean)){toast('O EAN deve conter de 8 a 14 dígitos.',true);return;}
    const payload={
      ...procurementValues(form),
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
      if(!editing){const procurement=procurementValues(form);
       assertOk(await db.rpc('set_product_procurement',{
        p_product:productId,p_supplier:procurement.supplier_id,p_min_stock:procurement.min_stock
       }));
       assertOk(await db.from('products').update({minimum_order_quantity:procurement.minimum_order_quantity}).eq('id',productId));}
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
        state,db,assertOk,chosenCategory,productTagValues,loadData,closeTopModal,toast,saveGallery:savePhotoGallery,saveProcurement:saveModelProcurement
      });
    }catch(error){fail(error);}
    finally{state.loading=false;}
    return;
  }
  if(type==='apparel-edit-variant'){
    if(!canRegisterProducts())return;
    state.loading=true;
    try{await saveApparelVariant(form,{db,assertOk,loadData,closeTopModal,toast,procurementValues});}
    catch(error){fail(error);}finally{state.loading=false;}
    return;
  }
  if(type==='product-photo-quick'){
    if(!hasPermission('products.edit'))return;
    const id=form.dataset.id,item=product(id);
    if(!item||item.apparel_model_id)return toast('Produto não encontrado.',true);
    if(!galleryHasChanges(form)){closeTopModal();return;}
    await exec(async()=>{await savePhotoGallery(form,{db,assertOk,productId:id});},
      'Fotos do produto atualizadas.');
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
    await exec(async()=>assertOk(await db.rpc('add_apparel_variants_with_location',{
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
    const action=kind==='entrada'?'entrada':reason==='avaria'?'baixa imediata por avaria':'baixa definitiva';
    if(!window.confirm('Confirmar '+action+' de '+qty+' unidade(s) de '+p.name+'?'))return;
    return exec(async()=>{
      if(kind==='entrada'){
        assertOk(await db.rpc('stock_operation_batch',{
          p_operation:'entrada',p_items:[{product_id:id,quantity:qty,expected}],
          p_destination_id:null,p_note:note||null,p_request_id:requestId
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
      reason==='avaria'?'Baixa por avaria registrada. Se recuperar, faça uma entrada manual.':'Baixa excepcional registrada com motivo e justificativa.');
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
  if(type==='unified-order-destination'){
    const destination=String(values.destination||'');
    if(destination.startsWith('store:'))return storeOrderModal(destination.slice(6));
    if(destination.startsWith('event:'))return eventBatchModal(destination.slice(6));
    return toast('Escolha uma unidade cadastrada.',true);
  }
  if(type==='order-create')return toast('Novo pedido precisa de destino cadastrado. Use Novo pedido.',true);
  if(type==='order-associate'){
    if(!hasPermission('orders.assign'))return;
    await exec(async()=>assertOk(await db.rpc('assign_avulso_order_event',{
      p_order_id:form.dataset.id,p_event_id:values.event_id||null
    })),'Vínculo de evento atualizado; estoque inalterado.');
    return;
  }
  if(type==='customer-link-create')return toast('Função desativada. Use Novo pedido.',true);

  if(type==='event-batch-write'){
    const eid=form.dataset.event,batchId=form.dataset.batch;
    if(!((isManager()&&hasPermission('events.separate'))||
      (!batchId&&hasPermission('events.request')&&Boolean(memberRole(eid)))))return;
    let items;try{items=collectEventPlan(form);}catch(error){return toast(error.message,true);}
    const models=selectedEventModels(items,state.items);
    if(!items.length)return toast('Selecione ao menos um produto para o pedido.',true);
    const note=String(values.note||'').trim();
    if(note.length>180)return toast('Observação longa demais.',true);
    if(batchId){
      if(!window.confirm('Editar pedido? A separação e a conferência anteriores precisarão ser refeitas.'))return;
      return exec(async()=>assertOk(await db.rpc('revise_event_pick_batch',{
        p_batch:batchId,p_items:items,p_note:note||null
      })),'Pedido alterado. A separação e conferência deverão ser feitas novamente.');
    }
    if(!confirmEventOrderReview(form,{items,note,destination:form.dataset.orderDestination||eventById(eid)?.name||'Loja temporária',
     products:state.items,models:state.apparelModels}))return;
    return exec(async()=>{
      const created=assertOk(await db.rpc('create_event_pick_batch',{
       p_event:eid,p_items:items,p_note:note||null
      }));
      if(created&&permittedView('pedidos')){
       state.ordersContext={type:'event',id:eid,mode:'all'};
       state.pendingOrderFocus={kind:'evento',id:created};
       state.view='pedidos';
      }
    },'Pedido criado e reservado. Acompanhe a separação, conferência e expedição em Pedidos.');
  }
  if(type==='event-batch-picking')return saveEventBatchPicking(form,false);
  if(type==='event-batch-cancel'){
    if(!isManager()||!hasPermission('events.separate'))return;
    const reason=String(values.reason||'').trim();
    if(reason.length<5||reason.length>250)return toast('Justificativa de 5 a 250 caracteres obrigatória.',true);
    if(!window.confirm('Cancelar este pedido, liberando as reservas ainda ativas?'))return;
    return exec(async()=>assertOk(await db.rpc('cancel_event_pick_batch',{
      p_batch:form.dataset.batch,p_reason:reason
    })),'Pedido cancelado e reserva liberada.');
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
  if(type==='force-delete-confirm'){
   if(!hasPermission('system.force_delete'))return;
   if(form.dataset.kind==='model'&&!isAdmin())return;
   const kind=form.dataset.kind,entityId=form.dataset.id,expected=form.dataset.name;
   if(String(values.confirmation||'').trim()!==expected)
    return toast('Digite exatamente o nome exibido para confirmar.',true);
   const catalogOnly=kind==='product'||kind==='model';
   if(!window.confirm(catalogOnly?
     'ARQUIVAR '+expected+' no catálogo? Não haverá baixa física nem cancelamento automático de pedidos. É necessário saldo zerado e ausência de pendências.':
     'CONFIRMAR EXCLUSÃO AVANÇADA de '+expected+'? Pedidos pendentes e saldos poderão ser alterados; o histórico permanecerá.'))return;
   return exec(async()=>{
    if(kind==='model'){
     assertOk(await db.rpc('force_archive_model',{p_model:entityId,p_confirm:expected}));
     state.expandedProductGroups.clear();state.showInactiveProducts=false;
    }else{
     assertOk(await db.rpc('force_archive_entity',{
      p_kind:kind,p_id:entityId,p_confirm:expected
     }));
    }
    if(kind==='event'){state.activeEvent=null;state.eventWorkflow=null;state.view='lojas';}
   },(kind==='product'||kind==='model')?'Cadastro arquivado sem baixar estoque ou cancelar pedidos. Histórico preservado.':'Exclusão avançada concluída. Pedidos e movimentações históricos foram preservados.');
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
    }else if(mode==='generate'){
     await saveEventCoverTheme(db,e.id,values.cover_theme);
     await generateEventCover(db,e.id);
    }else if(mode==='remove')assertOk(await db.from('events').update({cover_path:null}).eq('id',e.id));
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
       }else if(values.cover_mode==='generate'){
        await saveEventCoverTheme(db,eventId,values.cover_theme);
        await generateEventCover(db,eventId);
       }
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
    let items;try{items=collectOrderCartItems(form);}catch(error){return toast(error.message,true);}
    const target=state.stores.find(x=>x.id===values.to_store_id);
    if(!target||!target.active||!assignedStore(target.id)||
      (target.kind==='franquia'&&!hasPermission('orders.franchise'))||
      (target.kind!=='franquia'&&!hasPermission('orders.central')))return toast('Unidade não autorizada.',true);
    if(target.kind==='franquia'){
     const invalid=items.find(line=>line.quantity<categoryFranchiseMin(product(line.product_id)));
     if(invalid){const prod=product(invalid.product_id);
      return toast('Mínimo para '+(prod?.name||'produto')+' · '+(prod?.apparel_size||'Único')+': '+categoryFranchiseMin(prod)+' unidades por SKU.',true);}
    }
    if(!confirmOrderCartReview(form,{items,note:String(values.note||''),
       destination:(target.kind==='franquia'?'Franquia · ':'Loja própria · ')+target.name}))return;
    const main=state.stores.find(x=>x.is_primary);
    await exec(async()=>{
      const created=assertOk(await db.rpc('create_store_order',{
       p_from_store:main.id,p_to_store:values.to_store_id,
       p_type:target.kind==='franquia'?'franquia':'central',
       p_items:items,p_note:values.note||null
      }));
      if(created&&permittedView('pedidos')){
       state.ordersContext={type:'store',id:target.id,mode:'all'};
       state.pendingOrderFocus={kind:'loja',id:created};
       state.view='pedidos';
      }
    },'Pedido criado e reservado. Confira o registro antes de iniciar a separação.');return;
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
    if(!['filial','franquia'].includes(values.kind))return toast('Escolha loja própria ou franquia.',true);
    if(form.dataset.id&&state.stores.some(x=>x.id===form.dataset.id&&x.is_primary))
      return toast('O CDSB deve permanecer como centro de distribuição.',true);
    const payload={code:String(values.code||'').trim(),name:String(values.name||'').trim(),
      kind:values.kind,ownership_type:values.kind==='filial'?'propria':'terceiro',
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
    const eventIds=[...form.querySelectorAll('[name="event_member"]:checked')].map(x=>x.value);
    if(!perms.every(p=>permissionCatalog.some(([key])=>p===key)))return toast('Permissão inválida.',true);
    if(!perms.length)return toast('Selecione ao menos uma autorização.',true);
    assertFranchiseProfile(form,values.role,perms,stores);
    await exec(async()=>{
      assertOk(await db.rpc('set_staff_access_v2',{
        p_user_id:uid,p_role:values.role,p_permissions:perms,p_store_ids:stores,p_event_ids:eventIds
      }));
    },'Autorizações atualizadas.');return;
  }
  if(type==='user-edit'){
    if(!isAdmin())return;
    const name=String(values.full_name||'').trim(),username=String(values.username||'').trim();
    if(name.length<2||name.length>120||!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username))
     return toast('Informe nome e usuário válidos.',true);
    return exec(async()=>{await invokeManageUser('edit',{
     user_id:form.dataset.id,full_name:name,username
    });
    assertOk(await db.from('staff_contact_details').upsert({user_id:form.dataset.id,...staffDirectoryPayload(values)},{onConflict:'user_id'}));
   },'Dados profissionais atualizados.');
  }
  if(type==='user-role'){
    if(!isAdmin() || form.dataset.id===state.user.id)return;
    if(!Object.hasOwn(roles,values.role))throw new Error('Função inválida.');
    await exec(async()=>assertOk(await db.from('staff_profiles').update({role:values.role}).eq('id',form.dataset.id)),'Função atualizada.');
    return;
  }
  if(type==='users-provision-receipt'){closeTopModal();return;}
  if(type==='user-new'){
    if(!isAdmin())return;
    let password;
    try{password=passwordsValid(values);}catch(e){fail(e);return;}
    await exec(async()=>{
      const permissions=[...form.querySelectorAll('[name="perm"]:checked')].map(x=>x.value);
      const store_ids=[...form.querySelectorAll('[name="store"]:checked')].map(x=>x.value);
      if(!permissions.length)throw new Error('Selecione ao menos uma permissão.');
      assertFranchiseProfile(form,values.role,permissions,store_ids);
      const created=await invokeUserAdmin('create',{
        full_name:String(values.full_name||'').trim(),
        username:String(values.username||'').trim(),
        role:values.role,password,permissions,store_ids
      });
      if(created?.user_id)assertOk(await db.from('staff_contact_details').upsert({user_id:created.user_id,...staffDirectoryPayload(values)},{onConflict:'user_id'}));
      const eventIds=[...form.querySelectorAll('[name="event_member"]:checked')].map(x=>x.value);
      if(values.role==='evento'&&eventIds.length&&created?.user_id)
       assertOk(await db.rpc('set_staff_access_v2',{
         p_user_id:created.user_id,p_role:'evento',p_permissions:permissions,p_store_ids:[],p_event_ids:eventIds
       }));
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
function updatePurchaseSearch(value){
 const input=document.getElementById('buy-catalog-search');
 const cursor=input?.selectionStart??null;
 state.purchaseCatalog.search=value;
 state.purchaseCatalog.page=0;
 render();
 const next=document.getElementById('buy-catalog-search');
 if(next){next.focus({preventScroll:true});if(cursor!==null)next.setSelectionRange(cursor,cursor);}
}
function updateFiltered(id,value){
  const active=document.activeElement;
  const selection=active?.selectionStart??null;
  state.search=value;state.page=0;
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
  if(preventScannerSubmit(event))return;
  if(event.key==='Enter'&&event.target.matches('[data-order-cart-search]')){
   event.preventDefault();
   const form=event.target.closest('form[data-form="store-order-create"]');
   const code=event.target.value.trim();
   if(code&&!orderCartSearchKey(form,code)&&/^[0-9]{8,14}$/.test(code))
     toast('Código não corresponde a um SKU/EAN único no catálogo.',true);
   return;
  }
  if(event.key==='Enter'&&event.target.matches('[data-op-barcode]')){
    event.preventDefault();
    const input=event.target,form=input.closest('form[data-form="order-operational"]');
    operationalLocateSku(form,input.value);
    input.value='';
    return;
  }
  if(event.key==='Enter'&&event.target.matches('[data-balance-scan-input]')){
    event.preventDefault();
    const input=event.target,panel=input.closest('[data-product-details]');
    const code=input.value.trim();
    if(!panel||!code)return;
    const row=[...panel.querySelectorAll('[data-balance-item]')].find(r=>{
      const p=product(r.dataset.productId);
      return p&&(String(p.ean||'')===code||String(p.sku||'')===code);
    });
    if(!row)return toast('Código não pertence às variações deste produto.',true);
    input.value='';
    const count=row.querySelector('[data-balance-count]');
    if(count&&!count.disabled){count.focus();count.select();}
    else row.scrollIntoView({block:'nearest',behavior:'smooth'});
    return;
  }
  if(event.key==='Enter'&&event.target.matches('[data-verify-scan]')){
    event.preventDefault();
    verificationReadCode(event.target.closest('form'),event.target.value);
    return;
  }
  if(event.key==='Enter'&&event.target.matches('[data-verify-quantity]')){
    event.preventDefault();
    saveFinalVerification(event.target.closest('form'));
    return;
  }
  if(event.key==='Enter'&&event.target.id==='product-search'){
    event.preventDefault();
    searchAndManageSku(event.target.value);
    return;
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
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(!details.matches?.('[data-buy-expand]')||!details.isConnected)return;
 setPurchasePanelOpen(details.dataset.buyExpand,details.open);
 if(details.open){prefillPurchaseMinimums(details.dataset.buyExpand);void loadPurchaseOutflow(details.dataset.buyExpand);}
},true);
document.addEventListener('submit',event=>{handleSubmit(event).catch(fail);});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-order-cart-search]')){
   const form=event.target.closest('form[data-form="store-order-create"]');
   renderOrderCart(form,{resetPage:true});
   return;
  }
  if(event.target.matches('[data-order-cart-qty]')){
   const form=event.target.closest('form[data-form="store-order-create"]');
   if(!setOrderCartQuantity(form,event.target.dataset.id,event.target.value))
    event.target.setCustomValidity('Quantidade inválida (0 a 1.000.000).');
   else event.target.setCustomValidity('');
   return;
  }
  if(event.target.matches('[data-store-hub-search]')){
   state.storeHubFilter.search=event.target.value;
   filterStoreHub(event.target.closest('.sh-hub'),state.storeHubFilter.search,
     state.storeHubFilter.type,state.storeHubFilter.status);
  }
  if(event.target.matches('[data-users-search]'))applyUserListFilter();
  if(event.target.matches('[data-buy-inline-qty]')){
    const input=event.target,id=input.dataset.product;
    const selected=input.closest('[data-buy-sku]')?.querySelector('[data-buy-inline-select]')?.checked;
    if(!selected)return;
    if(!validPurchaseQty(input.value)){
      input.setCustomValidity('Informe 1 a 1.000.000 unidades inteiras.');
      state.purchaseCart.delete(id);
    }else {
      input.setCustomValidity('');
      state.purchaseCart=setPurchaseCartItem(state.purchaseCart,id,input.value);
    }
    savePurchaseCart();updatePurchaseCartDisplay();return;
  }
  if(event.target.matches('[data-buy-review-qty]')){
    const input=event.target,id=input.dataset.product;
    const form=input.closest('form[data-form="buy-order-create"]');
    if(!form)return;
    if(!validPurchaseQty(input.value)){
      input.setCustomValidity('Quantidade inteira obrigatória (1 a 1.000.000).');
    }else{
      input.setCustomValidity('');
      state.purchaseCart=setPurchaseCartItem(state.purchaseCart,id,input.value);
      savePurchaseCart();
      updatePurchaseReviewTotals(form.querySelector('[name="supplier_id"]')?.value||'');
    }
    return;
  }
  if(event.target.id==='buy-catalog-search'){
   updatePurchaseSearch(event.target.value);
   return;
  }
  if(event.target.matches('[data-balance-count]')){
    const field=event.target,panel=field.closest('[data-product-details]');
    if(!panel)return;
    const changes=[...panel.querySelectorAll('[data-balance-item]')].filter(r=>
      Number(r.querySelector('[data-balance-count]')?.value)!==Number(r.dataset.expected));
    const note=panel.querySelector('[data-balance-note]');
    if(note)note.closest('label').hidden=changes.length===0;
    const status=panel.querySelector('[data-balance-status]');
    if(status)status.textContent=changes.length?changes.length+' variação(ões) com diferença':'Nenhuma diferença identificada';
    field.closest('[data-balance-item]')?.classList.toggle('has-difference',
      Number(field.value)!==Number(field.closest('[data-balance-item]')?.dataset.expected));
  }
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
      container?.querySelector('[data-unified-status]')?.value||'todos',
      container?.querySelector('[data-unified-destination]')?.value||'todos',
      container?.querySelector('[data-unified-sort]')?.value||'recentes');
  }
  if(event.target.matches('form[data-form="avulso-picking"] [data-pick-qty],form[data-form="event-batch-picking"] [data-pick-qty]'))
    updateUnifiedPickingTotal(event.target.closest('form'));
  if(event.target.matches('form[data-form="event-batch-write"] [data-plan-qty]')){
    const form=event.target.closest('form');
    const result=onLotQuantityInput(form,event.target);
    if(!result.ok&&result.error)toast(result.error,true);
    refreshEventLotCounter(form);
  }
  if(event.target.closest('form[data-form="sku-manage"]')){
    syncSkuManagerPreview(event.target.closest('form[data-form="sku-manage"]'));
  }
  if(event.target.matches('[data-plan-search]')){
    const form=event.target.closest('form');
    if(form?.__lotPicker)filterLotCatalog(form,{resetPage:true});
    else {
      const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
      for(const group of form.querySelectorAll('[data-plan-group]')){
        const rows=[...group.querySelectorAll('[data-plan-row]')];
        const matchGroup=group.dataset.search.includes(q);
        for(const row of rows)row.hidden=Boolean(q)&&!matchGroup&&!row.dataset.search.includes(q);
        group.hidden=rows.every(row=>row.hidden);
      }
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
  if(event.target.matches('[data-dashboard-product-query]')&&event.key==='Enter'){
    event.preventDefault();document.querySelector('[data-action="dashboard-product-search"]')?.click();return;
  }
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
  if(event.target.matches('[data-store-hub-status-filter]')){
   state.storeHubFilter.status=event.target.value;
   filterStoreHub(event.target.closest('.sh-hub'),state.storeHubFilter.search,
     state.storeHubFilter.type,state.storeHubFilter.status);
  }
  if(event.target.matches('[data-product-sort]')){
    state.catalogSort=event.target.value;state.page=0;render();return;
  }
  if(event.target.matches('[data-product-gondola]')){
    state.gondolaFilter=event.target.value;state.page=0;render();return;
  }
  if(event.target.matches('[data-lot-category],[data-lot-tag],[data-lot-stock],[data-lot-sort]')){
    const form=event.target.closest('form[data-form="event-batch-write"]');
    if(form?.__lotPicker)filterLotCatalog(form,{resetPage:true});
  }
  if(event.target.matches('[data-users-filter-role]'))applyUserListFilter();
  if(event.target.matches('[data-buy-inline-select]')){
    const input=event.target,id=input.dataset.product,sku=input.closest('[data-buy-sku]');
    const qty=sku?.querySelector('[data-buy-inline-qty]');
    if(!qty)return;
    qty.disabled=!input.checked;
    if(input.checked){
      if(!validPurchaseQty(qty.value))qty.value='1';
      state.purchaseCart=setPurchaseCartItem(state.purchaseCart,id,qty.value);
    }else state.purchaseCart.delete(id);
    savePurchaseCart();updatePurchaseCartDisplay();
    if(input.checked)qty.focus({preventScroll:true});
    return;
  }
  if(event.target.matches('[data-buy-only-replenishment]')){
     state.purchaseCatalog.onlyReplenishment=event.target.checked;
     state.purchaseCatalog.missingSupplier=false;
     state.purchaseCatalog.page=0;render();return;
   }
   if(event.target.matches('[data-buy-catalog]')){
    const field=event.target.dataset.buyCatalog;
    if(!['sort','gondola'].includes(field))return;
    state.purchaseCatalog[field]=event.target.value;state.purchaseCatalog.page=0;render();return;
  }
  if(event.target.matches('[data-buy-filter]')){
    state.purchaseSupplierFilter=event.target.value;state.purchaseCatalog.page=0;render();return;
  }
  if(event.target.matches('[data-unified-status], [data-unified-destination], [data-unified-sort]')){
    const container=event.target.closest('.uo-page');
    filterUnifiedOrders(container,container?.querySelector('[data-unified-search]')?.value||'',
      container?.querySelector('[data-unified-status]')?.value||'todos',
      container?.querySelector('[data-unified-destination]')?.value||'todos',
      container?.querySelector('[data-unified-sort]')?.value||'recentes');
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
