import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { compressPhoto } from './photos.js';
import { scanEAN } from './scan.js?v=20261014w2';
import { openTaxonomyPicker, closeTaxonomyPicker } from './taxonomy-ui.js?v=20261014v3';
import { rankTagsForCategory, catalogCategoryRows, catalogTagCards } from './catalog-ui.js?v=20261014cat2';
import { apparelPage, apparelModal, apparelAddRow, apparelRemoveRow, submitApparel,
  apparelFillSizes, apparelVariantEditModal, saveApparelVariant, apparelPhotoModal, saveApparelPhoto, apparelSyncCategory } from './apparel.js';
import { sizesSection, setSizesMode, setSizeSelected, saveSizedProduct } from './product-variants.js?v=20261014codes1';
import { groupInventory, groupedCard, addSizesContent, updateExtraSizeButtons, toggleExtraSize, collectExtraSizes,
  eventBatchContent, collectEventBatch, eventReturnPage, filterWorkflowRows } from './stock-workflows.js?v=20261014cards3';
import { quickBalanceCard, collectQuickCounts, updateQuickCountButtons, filterQuickCountCards } from './quick-balance.js?v=20261014q2';
import { eventHistoryCards, ordersPageMarkup, createInternalOrderForm, collectInternalOrder } from './orders-events.js?v=20261014orders2';
import { stockOperationPage, stockOperationResults, stockOperationSearchHTML, stockCartHTML, stockOperationHistoryHTML, operationCartLines } from './stock-inout.js?v=20261014inout3';

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
const actionNames = {entrada:'Entrada',venda_loja:'Baixa (loja)',transferencia:'Enviado ao evento',venda_evento:'Baixa antiga (evento)',devolucao:'Retornou à loja',baixa_evento:'Não retornou ao estoque',ajuste_loja:'Ajuste'};
const roles = {admin:'Administrador',gerente:'Gerente',estoquista:'Estoquista',evento:'Equipe de evento',consulta:'Consulta'};
const nav = [
  {id:'inicio',label:'Início',ico:'home'},
  {id:'produtos',label:'Produtos',ico:'package'},
  {id:'entrada',label:'Entrada',ico:'arrow-down-to-line'},
  {id:'saida',label:'Saída',ico:'arrow-up-from-line'},
  {id:'balanco',label:'Balanço rápido',ico:'clipboard'},
  {id:'eventos',label:'Eventos',ico:'calendar'},
  {id:'pedidos',label:'Pedidos Avulsos',ico:'clipboard'},
  {id:'pedidos-lojas',label:'Pedidos entre lojas',ico:'arrows'},
  {id:'movimentacoes',label:'Movimentações',ico:'arrows'},
  {id:'categorias',label:'Categorias',ico:'layers'},
  {id:'tags',label:'Tags',ico:'more'},
  {id:'usuarios',label:'Usuários',ico:'users'},
  {id:'lojas',label:'Lojas',ico:'home'}
];
const state = {
  user:null,profile:null,view:'inicio',activeEvent:null,items:[],categories:[],tags:[],apparelModels:[],apparelOpen:new Set(),showInactiveProducts:false,eventWorkflow:null,eventReturnQuery:'',events:[],members:[],
  balances:[],movements:[],users:[],audits:[],orders:[],orderItems:[],customerAccess:[],
  stores:[],userPermissions:[],staffStores:[],ownPermissions:[],storeBalances:[],storeOrders:[],storeOrderItems:[],stockDestinations:[],stockBatches:[],stockBatchLines:[],stockQuery:{entrada:'',saida:''},
  stockCarts:{entrada:new Map(),saida:new Map()},stockRequestIds:{entrada:null,saida:null},stockSelectedDestination:'',
  search:'',page:0,eventFilter:'',movementFilter:'',categoryFilter:'',tagFilter:'',
  imageCache:new Map(),collapsedCategories:new Set(),catalogExpanded:new Set(),catalogSearch:'',catalogTagsSearch:'',loading:false,toastTimer:0,passwordRecovery:false,loginMode:'password',loginNotice:'',setupPending:false
};
let db = null;
let notifyTimer;
const permissionDefaults = {
 gerente:['products.read','products.create','products.edit','products.delete','stock.entry','stock.exit','stock.balance','stock.destinations','events.read','events.manage','events.separate','events.return','events.sell','events.close','orders.read','orders.internal','orders.assign','orders.central','orders.franchise','orders.separate','orders.receive','orders.cancel','movements.read','movements.export','categories.manage','tags.manage','catalog.manage','products.share','stores.read','stores.manage'],
 estoquista:['products.read','products.create','products.edit','stock.balance','products.share','stores.read'],
 evento:['products.read','events.read','events.return','events.sell'],
 consulta:['products.read','events.read','orders.read','movements.read','stores.read']
};
const permissionCatalog=[
 ['products.read','Consultar produtos'],['products.create','Cadastrar produtos'],['products.edit','Editar produtos'],['products.delete','Excluir produtos'],
 ['stock.entry','Registrar entrada'],['stock.exit','Registrar saída'],['stock.balance','Realizar balanço'],['stock.destinations','Gerenciar destinos'],
 ['events.read','Consultar eventos'],['events.manage','Administrar eventos'],['events.separate','Separar para eventos'],['events.return','Devolver de eventos'],['events.sell','Baixar no evento'],['events.close','Encerrar eventos'],
 ['orders.read','Consultar pedidos avulsos'],['orders.internal','Criar pedidos avulsos'],['orders.assign','Vincular pedidos a eventos'],
 ['orders.central','Pedir para loja central'],['orders.franchise','Pedir para franquia'],['orders.separate','Separar pedidos de lojas'],['orders.receive','Receber pedidos'],['orders.cancel','Cancelar pedidos'],
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
const permittedView = v => v==='inicio'||(v==='pedidos-lojas'&&canUseStoreOrders())||hasPermission(viewPermission[v]||'products.read')||(v==='lojas'&&hasPermission('stores.manage'))||(v==='eventos'&&(hasPermission('events.manage')||hasPermission('events.separate')));
const isAdmin = () => state.profile?.role === 'admin';
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
    ['users',db.from('staff_profiles').select('id,full_name,username,role,active,created_at').order('full_name').limit(1000)]
  ];
  resources.push(['stores',db.from('stores').select('*').order('name')]);
  resources.push(['storeBalances',db.from('store_stock').select('store_id,product_id,quantity').limit(10000)]);
  if(canUseStoreOrders() || hasPermission('orders.read')){
    resources.push(['storeOrders',db.from('store_orders').select('*').order('created_at',{ascending:false}).limit(500)]);
    resources.push(['storeOrderItems',db.from('store_order_items').select('*').limit(5000)]);
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
    resources.push(['orders',db.from('avulso_orders').select('id,customer_name,customer_phone,created_at,source,event_id').order('created_at',{ascending:false}).limit(1000)]);
    resources.push(['orderItems',db.from('avulso_order_items').select('order_id,product_name,color,size,sku,ean,quantity').limit(3000)]);
  }
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
  const response=await db.from('staff_profiles').select('id,full_name,email,role,active').eq('id',user.id).maybeSingle();
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
    (isManager()?button(id?'+ Subcategoria':'+ Categoria','quick-category','','small'):'')+'</div>'+
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
    (isManager()?button('+ Criar tag','quick-tag','','small'):'')+
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
  if(!permittedView(state.view))state.view='inicio';
  const mark='<img class="ame-brand-logo" src="./ame-plus-logo.svg" alt="Ame+ Store" width="132" height="70">';
  const menu=nav.filter(x=>permittedView(x.id))
    .map(x=>'<button type="button" data-action="view" data-view="'+h(x.id)+'" class="'+(state.view===x.id?'active':'')+'">'+
      uiIcon(x.ico,19)+'<span>'+h(x.label)+'</span></button>').join('');
  const desktopIdentity='<div class="brand brand-lockup">'+mark+'<small>CONTROLE DE ESTOQUE</small></div>';
  root.innerHTML='<div class="app-shell mobile-c-app"><aside class="sidebar">'+desktopIdentity+
    '<nav class="nav" aria-label="Menu principal">'+menu+'</nav>'+
    '<div class="sidefoot"><strong>'+h(state.profile.full_name)+'</strong><br>'+h(roles[state.profile.role]||state.profile.role)+
    '<br><button class="plain" data-action="my-password">Minha senha</button>'+
    '<br><button class="plain" data-action="logout">Sair da conta</button></div></aside>'+
    '<div class="main"><header class="topbar"><div class="topbar-brand">'+mark+
    '<span class="ame-header-title">ESTOQUE</span></div>'+
    '<div class="topbar-right"><span class="userpill">'+h(state.profile.full_name)+' · '+h(roles[state.profile.role])+'</span>'+
    '<button type="button" class="mobile-top-menu only-mobile" aria-label="Abrir menu de navegação" aria-haspopup="dialog" aria-expanded="false" data-action="mobile-more">'+uiIcon('menu',23)+'</button></div></header>'+
    '<main class="content">'+pageContent()+'</main></div></div>';
  hydrateImages();
}

function pageContent(){
  if(state.view==='entrada'||state.view==='saida')return renderStockOperationPage();
  if(state.view==='balanco')return quickBalancePage();
  if(state.view==='produtos')return productsPage();
  if(state.view==='eventos')return state.activeEvent?(state.eventWorkflow==='return'?returnWorkflowPage():eventDetails()):eventsPage();
  if(state.view==='movimentacoes')return movementsPage();
  if(state.view==='pedidos')return ordersPage();
  if(state.view==='categorias')return categoriesPage();
  if(state.view==='tags')return tagsPage();
  if(state.view==='usuarios')return usersPage();
  if(state.view==='lojas')return storesPage();
  if(state.view==='pedidos-lojas')return storeOrdersPage();
  return dashboard();
}
function panel(title,content,buttonMarkup=''){
  return '<section class="panel"><div class="panelhead"><h2>'+h(title)+'</h2>'+buttonMarkup+'</div>'+content+'</section>';
}
function dashboard(){
  const all=state.items.filter(p=>p.active);
  const total=state.balances.filter(b=>!b.event_id).reduce((sum,b)=>sum+b.quantity,0);
  const eventTotal=state.balances.filter(b=>b.event_id).reduce((sum,b)=>sum+b.quantity,0);
  const zero=all.filter(p=>qtyStore(p.id)===0).length;
  const activeEvents=state.events.filter(e=>e.status==='ativo').length;
  const movementsToday=state.movements.filter(m=>m.created_at&&new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(m.created_at))===dateToday()).length;
  const firstName=(state.profile.full_name||'').trim().split(/\s+/)[0]||'Olá';
  const recent=[...all].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6);
  const roots=state.categories.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const categoryCards=roots.slice(0,8).map(c=>{
    const count=all.filter(p=>categoryChain(p.category_id).some(path=>path.id===c.id)).length;
    return '<button type="button" class="c-category-card" data-action="home-category" data-id="'+h(c.id)+'">'+
      '<span class="c-category-icon">'+uiIcon('layers',21)+'</span>'+
      '<strong>'+h(c.name)+'</strong><small>'+count+' produto(s)</small></button>';
  }).join('');
  const productCards=recent.map(p=>'<article class="c-feature-product">'+
    '<div class="c-feature-image">'+photoButton(p)+'</div>'+
    '<div class="c-feature-body"><strong>'+h(p.name)+'</strong><small>'+h(categoryFull(p.category_id))+'</small>'+
    '<span class="c-feature-qty">Loja: <b>'+qtyStore(p.id)+'</b> un.</span>'+
    '<button type="button" class="c-feature-open" data-action="home-product" data-id="'+h(p.id)+'">Ver produto '+uiIcon('arrow',14)+'</button></div></article>').join('');
  const cards=[
    {label:'Produtos ativos',value:all.length,icon:'package',tone:'green',hint:'Cadastrados'},
    {label:'Sem estoque',value:zero,icon:'alert',tone:'red',hint:'Na loja'},
    {label:'Movimentações',value:movementsToday,icon:'arrows',tone:'blue',hint:'Hoje'},
    {label:'Eventos ativos',value:activeEvents,icon:'calendar',tone:'orange',hint:'Em andamento'}
  ];
  return '<div class="c-dashboard">'+
    '<div class="c-welcome"><span class="c-eyebrow">PAINEL DO ESTOQUE</span>'+
    '<h1>Olá, '+h(firstName)+'!</h1><p>Acompanhe seu estoque em um só lugar.</p></div>'+
    '<section class="c-hero" aria-label="Resumo das unidades na loja"><div class="c-hero-main">'+
    '<span class="c-hero-label">'+uiIcon('package',19)+' Unidades na loja</span>'+
    '<strong class="c-hero-number">'+total.toLocaleString('pt-BR')+'</strong>'+
    '<span class="c-hero-sub">'+eventTotal.toLocaleString('pt-BR')+' unidade(s) em eventos</span></div>'+
    '<div class="c-hero-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div></section>'+
    '<div class="c-metric-grid">'+cards.map(c=>'<div class="c-metric c-metric-'+c.tone+'">'+
      '<div class="c-metric-icon">'+uiIcon(c.icon,21)+'</div>'+
      '<div class="c-metric-data"><span>'+h(c.label)+'</span><strong>'+c.value.toLocaleString('pt-BR')+'</strong>'+
      '<small>'+h(c.hint)+'</small></div></div>').join('')+'</div>'+
    '<div class="c-dashboard-actions">'+
      (canRegisterProducts()?'<button type="button" class="c-action-primary" data-action="product-new">'+
        uiIcon('plus',20)+' Novo produto</button>':'')+
      (isManager()?'<button type="button" class="c-action-outline" data-action="view" data-view="entrada">'+
        uiIcon('arrow-down-to-line',20)+' Entrada</button>'+
        '<button type="button" class="c-action-outline" data-action="view" data-view="saida">'+
        uiIcon('arrow-up-from-line',20)+' Saída</button>':'')+
      '<button type="button" class="c-action-outline" data-action="global-scan">'+uiIcon('scan',20)+' Ler EAN</button></div>'+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Categorias</h2>'+
    '<button type="button" data-action="view" data-view="produtos">Ver produtos '+uiIcon('chevron',17)+'</button></div>'+
    (categoryCards?'<div class="c-category-grid">'+categoryCards+'</div>':
      '<p class="c-dash-empty">Cadastre categorias para organizar os produtos.</p>')+'</section>'+
    '<section class="c-dashboard-section"><div class="c-section-heading"><h2>Produtos recentes</h2>'+
    '<button type="button" data-action="view" data-view="produtos">Ver todos '+uiIcon('chevron',17)+'</button></div>'+
    (productCards?'<div class="c-feature-grid">'+productCards+'</div>':
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
    '<div class="mobile-product-actions"><span class="qty">Loja: '+qtyStore(p.id)+'</span>'+
    (isManager()?button('Estoque','stock-modal','data-id="'+h(p.id)+'"','small'):'')+
    (canRegisterProducts()?button('Editar','product-edit','data-id="'+h(p.id)+'"','small primary'):'')+
    (isManager()?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+'</div></div></article>';
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
      (isManager()?button('Excluir','product-delete','data-id="'+h(p.id)+'"','small danger'):'')+
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
  const pageSize=20,totalPages=Math.max(1,Math.ceil(groups.length/pageSize));
  state.page=Math.min(state.page,totalPages-1);
  const list=groups.slice(state.page*pageSize,(state.page+1)*pageSize);
  const add=canRegisterProducts()?button('+ Novo produto','product-new','','primary'):'';
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
    '<div class="grouped-inventory-grid">'+(list.length?list.map(g=>groupedCard(g,{
      h,photoButton,qtyStore,qtyEvent,button,isManager,canRegisterProducts,
      canShare:canRegisterProducts()
    })).join(''):'<div class="muteblock"><strong>Nenhum produto corresponde aos filtros.</strong>'+
      (filtersApplied?'<p>Existem '+available+' variação(ões) ativa(s) cadastrada(s). Limpe a busca e os filtros para encontrá-las.</p>'+
      button('Mostrar todos os produtos','products-clear-filters','','primary'):
      '<p>Cadastre um novo produto ou verifique a opção Mostrar inativos.</p>')+'</div>')+'</div>'+
    '<div class="panelbody inline" style="justify-content:space-between"><small>'+
    groups.length+' modelo(s)/produto(s) · '+matched.length+' variação(ões) · página '+(state.page+1)+' de '+totalPages+
    '</small><div class="actions">'+
    button('Anterior','product-prev',state.page===0?'disabled':'','small')+
    button('Próxima','product-next',state.page+1>=totalPages?'disabled':'','small')+'</div></div></section>';
}

function quickBalancePage(){
  if(!canQuickBalance())return '<div class="muteblock">Sem acesso.</div>';
  const groups=groupInventory(state.items.filter(p=>p.active),state.apparelModels);
  const query=state.search.trim().toLocaleLowerCase('pt-BR');
  const filtered=groups.filter(g=>!query||[g.title,...g.products.flatMap(p=>
    [p.name,p.sku,p.ean,p.apparel_color,p.apparel_size,p.gondola,p.prateleira])].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  const cards=filtered.slice(0,50).map(g=>quickBalanceCard(g,{photoButton,qtyStore,h})).join('');
  return tabHead('Balanço rápido','Um produto por card; conte os tamanhos sem sair da tela.')+
    '<section class="quick-balance-intro"><div class="quick-balance-search">'+
    '<input id="quick-search" type="search" class="search" placeholder="Produto, tamanho, SKU ou EAN…" aria-label="Buscar para contagem" value="'+h(state.search)+'">'+
    button('📷 Ler EAN','quick-scan','','primary')+'</div>'+
    '<p class="help">Digite a quantidade física apenas dos tamanhos conferidos. <strong>Zero</strong> significa estoque zerado; campo vazio não altera nada. '+
    'Use Salvar em um tamanho ou Salvar contagens do card. O restante da página não será recarregado.</p></section>'+
    '<div class="quick-group-list">'+(cards||'<div class="panel muteblock">Nenhum produto encontrado.</div>')+
    (cards?'<div class="quick-group-empty panel muteblock" data-quick-empty hidden>Nenhum produto corresponde à busca.</div>':'')+'</div>'+
    (filtered.length>50?'<p class="muted">Exibindo 50 modelos. Refine a busca para localizar os demais.</p>':'');
}

function eventsPage(){
  const add=isManager()?button('+ Criar evento','event-new','','primary'):'';
  return tabHead('Eventos','Controle de mercadorias enviadas, devolvidas e não retornadas.',add)+
    '<div class="eventgrid">'+state.events.map(e=>{
      const remaining=state.balances.filter(b=>b.event_id===e.id).reduce((s,b)=>s+b.quantity,0);
      return '<article class="panel event-card">'+pill(e.status)+'<h3>'+h(e.name)+'</h3><p class="muted">'+niceDate(e.starts_at)+(e.ends_at?' até '+niceDate(e.ends_at):'')+'</p>'+
        '<div class="statsline"><div class="statline">No evento <b>'+remaining+'</b> un.</div></div>'+
        button('Gerenciar evento','event-detail','data-id="'+h(e.id)+'"','primary')+'</article>';
    }).join('')+'</div>'+(state.events.length?'':'<div class="panel muteblock">Nenhum evento cadastrado.</div>');
}
function returnWorkflowPage(){
  const e=eventById(state.activeEvent);
  if(!e){state.eventWorkflow=null;state.activeEvent=null;return eventsPage();}
  if(!canReturn(e.id)||e.status!=='ativo'){
    state.eventWorkflow=null;return eventDetails();
  }
  return eventReturnPage(e,state.items,state.apparelModels,state.balances,photoButton);
}
function eventDetails(){
  const e=eventById(state.activeEvent);
  if(!e){state.activeEvent=null;return eventsPage();}
  const mem=state.members.filter(m=>m.event_id===e.id);
  // Todo o histórico é vinculado aos IDs originais; arquivamentos não somem da contagem.
  const entries=state.movements.filter(m=>m.event_id===e.id);
  const transfers=entries.filter(m=>m.action==='transferencia').reduce((n,m)=>n+m.quantity,0);
  const returned=entries.filter(m=>m.action==='devolucao').reduce((n,m)=>n+m.quantity,0);
  const unreturned=entries.filter(m=>['baixa_evento','venda_evento'].includes(m.action)).reduce((n,m)=>n+m.quantity,0);
  const pending=state.balances.filter(b=>b.event_id===e.id).reduce((n,b)=>n+b.quantity,0);
  const canModify=e.status==='ativo';
  const actions=(isManager()&&e.status==='rascunho'?button('Ativar evento','event-activate','data-id="'+h(e.id)+'"','primary'):'')+
    (isManager()&&canModify?button('Separar produtos para o evento','event-transfer','','primary'):'')+
    (canModify&&canReturn(e.id)?button('Devolução rápida por EAN','event-return','','primary'):'')+
    (canModify&&canReturn(e.id)?button('Encerrar evento','event-close','data-id="'+h(e.id)+'"'):'');
  const history=eventHistoryCards({
    movements:entries,products:state.items,models:state.apparelModels,
    balances:state.balances.filter(b=>b.event_id===e.id),
    photoButton,groupInventory
  });
  return '<div class="crumb"><button class="plain" data-action="back-events">← Eventos</button></div>'+
    tabHead(e.name,'Data: '+niceDate(e.starts_at)+(e.ends_at?' a '+niceDate(e.ends_at):''),pill(e.status))+
    '<div class="cards">'+[['Separados',transfers],['Devolvidos',returned],['Não retornaram',unreturned],['Pendentes',pending]].map(([name,value])=>
      '<div class="card"><div class="metric-label">'+name+'</div><div class="metric">'+value+'</div></div>').join('')+'</div>'+
    '<div class="actions" style="margin-bottom:18px">'+actions+'</div>'+
    (e.status==='ativo'&&pending>0?'<div class="note">Ainda há '+pending+
      ' unidade(s) no evento. Você pode devolver as que voltaram e encerrar; as restantes terão baixa neutra, sem registrar venda.</div>':'')+
    panel('Produtos e movimentações do evento',history)+
    panel('Equipe responsável','<div class="panelbody">'+(mem.length?mem.map(m=>
      '<div class="inline" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid #edf1ee">'+
      '<div><strong>'+h(username(m.user_id))+'</strong> <span class="pill">'+
      (m.role==='responsavel'?'Responsável':'Operador')+'</span></div>'+
      (isManager()?button('Remover','member-remove','data-user="'+h(m.user_id)+'" data-event="'+h(e.id)+'"','small'):'')+
      '</div>').join(''):'<p class="muted">Nenhum usuário associado.</p>')+
      (isManager()&&e.status!=='encerrado'?'<div style="margin-top:13px">'+
        button('+ Adicionar usuário','member-add','data-id="'+h(e.id)+'"','small')+'</div>':'')+'</div>');
}
function movementTable(rows){
  if(!rows.length)return '<div class="muteblock">Nenhuma movimentação registrada.</div>';
  return '<div class="tablewrap"><table class="table"><thead><tr><th>Data e hora</th><th>Produto</th><th>Operação</th><th>Quantidade</th><th>Responsável</th><th>Observação</th></tr></thead><tbody>'+
    rows.map(m=>'<tr><td>'+niceTime(m.created_at)+'</td><td>'+h(product(m.product_id)?.name||m.product_id.slice(0,8))+'</td>'+
    '<td>'+h(actionNames[m.action]||m.action)+(m.event_id?' <small>· '+h(eventById(m.event_id)?.name||'Evento')+'</small>':'')+'</td><td class="qty">'+m.quantity+'</td>'+
    '<td>'+h(username(m.actor_id))+'</td><td>'+h(m.note||'—')+'</td></tr>').join('')+'</tbody></table></div>';
}
function movementsPage(){
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  const list=state.movements.filter(m=>(!state.eventFilter||m.event_id===state.eventFilter)&&
    (!state.movementFilter||m.action===state.movementFilter)&&
    (!q||[product(m.product_id)?.name,m.note,m.actor_id,username(m.actor_id)].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
  return tabHead('Movimentações','Histórico imutável, registrado por usuário e horário.',button('Exportar CSV','export-csv','','small'))+
    '<section class="panel"><div class="toolbar"><input class="search" id="movement-search" placeholder="Buscar produto ou responsável…" value="'+h(state.search)+'" type="search"/>'+
    '<select id="event-filter" class="filter" style="max-width:210px" aria-label="Filtrar por evento">'+eventOptions().map(([v,t])=>'<option value="'+h(v)+'" '+(v===state.eventFilter?'selected':'')+'>'+h(t)+'</option>').join('')+'</select>'+
    '<select id="movement-filter" class="filter" style="max-width:185px" aria-label="Filtrar operação">'+[['','Todas as operações'],...Object.entries(actionNames)].map(([v,t])=>'<option value="'+h(v)+'" '+(v===state.movementFilter?'selected':'')+'>'+h(t)+'</option>').join('')+'</select></div>'+
    movementTable(list)+'<div class="panelbody"><small>Mostrando até 1.000 lançamentos recentes. O banco preserva todo o histórico.</small></div></section>'+
    (isManager()?panel('Auditoria de cadastros','<div class="panelbody"><p class="muted">Últimas alterações de produtos, categorias, eventos, acessos e responsáveis.</p>'+
      '<div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Área</th><th>Ação</th><th>Autor</th></tr></thead><tbody>'+
      state.audits.map(a=>'<tr><td>'+niceTime(a.created_at)+'</td><td>'+h(a.entity)+'</td><td>'+h(a.action)+'</td><td>'+h(username(a.actor_id))+'</td></tr>').join('')+'</tbody></table></div></div>'):'');
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

function ordersPage(){
  if(!isManager())return '<div class="muteblock">Sem permissão.</div>';
  const activeAccess=state.customerAccess.filter(a=>!a.revoked_at&&new Date(a.expires_at)>new Date()).length;
  const links='<div class="avulso-access-list">'+(state.customerAccess.length?
    state.customerAccess.map(access=>{
      const valid=!access.revoked_at&&new Date(access.expires_at)>new Date();
      return '<div class="avulso-access-row"><div><strong>'+h(access.label)+'</strong>'+
        '<small>Criado: '+h(niceTime(access.created_at))+' · Válido até '+h(niceTime(access.expires_at))+'</small></div>'+
        '<span class="pill '+(valid?'ativo':'encerrado')+'">'+(valid?'Ativo':'Encerrado')+'</span>'+
        (valid?button('Revogar link','customer-link-revoke','data-id="'+h(access.id)+'"','small danger'):'')+
        '</div>';
    }).join(''):'<p class="muted">Nenhum acesso para clientes criado ainda.</p>')+'</div>';
  const orders=ordersPageMarkup({
    orders:state.orders,items:state.orderItems,events:state.events,
    photoButton,button,niceTime
  });
  return tabHead('Pedidos Avulsos','Pedidos são independentes do estoque e podem ser vinculados a um evento depois.',
    button('+ Criar pedido','order-new','','primary')+
    button('+ Acesso para cliente','customer-link-new','','primary'))+
    '<div class="orders-overview"><div><strong>'+state.orders.length+'</strong><span>Pedidos registrados</span></div>'+
    '<div><strong>'+state.orders.filter(o=>!o.event_id).length+'</strong><span>Sem evento</span></div>'+
    '<div><strong>'+activeAccess+'</strong><span>Acessos ativos de clientes</span></div></div>'+
    panel('Pedidos registrados',orders)+
    panel('Acesso limitado para clientes', '<div class="panelbody">'+
      '<p class="help">Crie um link individual válido por 30 dias. O cliente poderá ver os produtos e montar pedidos, sem consultar estoques, movimentos, custos ou telas administrativas. Você pode revogar o acesso quando desejar.</p>'+
      links+'</div>');
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
    state.users.map(u=>'<tr><td><strong>'+h(u.full_name)+'</strong></td><td>'+h(u.username)+'</td><td>'+h(roles[u.role]||u.role)+'</td><td><span class="pill '+(u.active?'ativo':'encerrado')+'">'+(u.active?'Ativo':'Bloqueado')+'</span></td><td>'+
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
}
function formModal(title,contents,formName,submitLabel='Salvar',stack=false){
  if(!stack){
    while(document.querySelector('.modalback'))closeTopModal();
  }else{
    const previous=[...document.querySelectorAll('.modalback')].at(-1);
    if(previous)previous.inert=true;
  }
  const backdrop=document.createElement('div');
  backdrop.className='modalback';backdrop.style.zIndex=String(50+document.querySelectorAll('.modalback').length*5);
  backdrop.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="'+h(title)+'">'+
    '<div class="modalhead"><h2>'+h(title)+'</h2><button class="plain" type="button" data-action="modal-close" aria-label="Fechar">✕</button></div>'+
    '<form data-form="'+h(formName)+'">'+contents+'<div class="modalfooter"><button class="button" type="button" data-action="modal-close">Cancelar</button>'+
    '<button class="button primary" type="submit">'+h(submitLabel)+'</button></div></form></section>';
  document.body.append(backdrop);
  backdrop.querySelector('[name]:not([type="file"])')?.focus();
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
  const form=input.closest('form');
  const file=input.files?.[0];
  if(!form||!file)return;
  if(file.size>20*1024*1024){toast('Escolha uma foto de até 20 MB.',true);return;}
  const status=form.querySelector('[data-photo-status]');if(status)status.textContent='Compactando a foto…';
  try{
    const compressed=await compressPhoto(file);
    if(!form.isConnected)return;
    bindPhotoPreview(form,compressed);
  }catch(error){
    if(status)status.textContent='Não foi possível processar esta imagem.';
    fail(error);
  }
}
function photoChooser(item){
  return '<section class="form-section wide">'+
    '<div class="section-head"><strong>Foto do produto</strong><small>Imagem compactada automaticamente</small></div>'+
    '<div class="photo-editor"><button type="button" class="photo-preview" data-action="preview-zoom" aria-label="Ampliar foto">'+
    (item?.image_path?'<img data-photo-id="'+h(item.id)+'" alt="Foto de '+h(item.name)+'" />':
      '<span class="photo-empty"><span aria-hidden="true">▧</span> Sem foto</span>')+
    '</button><div class="photo-editor-actions">'+
    button('📷 Tirar foto','take-photo','','')+
    button('▧ Escolher da galeria','choose-photo','','')+
    '<small data-photo-status>JPG/WEBP · até 450 KB após compressão</small>'+
    '</div><input hidden type="file" name="camera_file" accept="image/*" capture="environment">'+
    '<input hidden type="file" name="gallery_file" accept="image/*"></div></section>';
}
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
      field('Quantidade inicial na loja','initial_quantity','number','0','min="0" max="1000000" step="1"','Entrada registrada no histórico.')+'</div>':'')+
    (item?selectField('Situação','active',[['true','Ativo'],['false','Inativo']],String(item.active)):'')+'</div>';
  formModal(item?'Editar produto':'Novo produto',markup,item?'product-edit':'product-new',
    item?'Salvar alterações':'Cadastrar produto');
  const form=document.querySelector('.modalback form');
  if(item)form.dataset.id=item.id;
  if(item?.image_path)hydrateImages();
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
  if(!isManager())return '<div class="muteblock">Sem permissão.</div>';
  const kind=state.view;
  return stockOperationPage({
    kind,query:state.stockQuery[kind],cart:state.stockCarts[kind],
    items:state.items,models:state.apparelModels,destinations:state.stockDestinations,
    batches:state.stockBatches.filter(b=>b.operation===kind),
    batchLines:state.stockBatchLines,
    selectedDestination:state.stockSelectedDestination,
    qtyStore,groupInventory,photoButton,h,button
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
    h,qtyStore
  }):'<p class="stock-search-welcome">Digite o nome, SKU ou EAN de um produto.</p>';
}
function updateStockOperationBasket(redraw=true,clearError=true){
  if(!['entrada','saida'].includes(state.view))return;
  const kind=state.view,cart=state.stockCarts[kind];
  if(redraw){
    const list=document.querySelector('[data-stock-cart]');
    if(list){list.innerHTML=stockCartHTML({
      cart,items:state.items,models:state.apparelModels,qtyStore,groupInventory,
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
  if(!isManager()||!['entrada','saida'].includes(state.view))return;
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
  if(!isManager()||state.loading)return;
  const kind=state.view,cart=state.stockCarts[kind],data=new FormData(form);
  const dest=String(data.get('destination_id')||'').trim();
  if(kind==='saida'&&!state.stockDestinations.some(d=>d.active&&d.id===dest))
    return toast('Selecione um destino válido para esta saída.',true);
  let lines;
  try{lines=operationCartLines(cart,state.items,qtyStore,kind);}
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

function stockModal(id){
  if(!isManager())return;
  const p=product(id);if(!p)return;
  formModal('Movimentar · '+p.name,
    '<div class="note">Saldo atual na loja: <strong>'+qtyStore(id)+' unidade(s)</strong></div>'+
    '<p class="help">Entradas e saídas têm processos independentes, com histórico e destino obrigatório nas saídas.</p>'+
    selectField('O que deseja fazer?','operation_kind',[['entrada','Entrada · receber mercadoria'],['saida','Saída · encaminhar a um destino']]),
    'stock-choose-direction','Continuar');
  document.querySelector('.modalback form[data-form="stock-choose-direction"]').dataset.id=id;
}
function eventModal(){
  if(!isManager())return;
  formModal('Criar evento','<div class="formgrid">'+field('Nome do evento','name','text','','required maxlength="150"')+
    field('Data de início','starts_at','date',dateToday(),'required')+
    field('Data de término (opcional)','ends_at','date')+
    textareaField('Observações','notes')+'</div><div class="note">O evento começa como rascunho. Vincule a equipe, ative e então transfira os produtos.</div>',
    'event-create','Criar evento');
}
function eventMove(action){
  const eid=state.activeEvent;
  if(eventStatus(eid)!=='ativo')return;
  const labels={transferencia:'Transferir produtos',venda_evento:'Registrar venda',devolucao:'Devolver produtos'};
  if(action==='transferencia'&&!isManager() || action==='venda_evento'&&!canSell(eid) ||
    action==='devolucao'&&!canReturn(eid))return;
  const opts=action==='transferencia'?productOptions(true):productOptions(true,eid);
  if(opts.length===1){toast('Não há produtos disponíveis para essa operação.',true);return;}
  formModal(labels[action],'<div class="formgrid">'+selectField('Produto','product_id',opts,'','required')+
    field('Quantidade','quantity','number','1','required min="1" max="1000000" step="1"')+
    textareaField('Observação (opcional)','note')+'</div>'+
    '<div class="note">'+(action==='transferencia'?'A transferência reduz a loja e aumenta o estoque do evento.':
      action==='devolucao'?'A devolução retorna os produtos à loja.':'A venda reduz apenas o estoque deste evento.')+'</div>',
    'event-move','Confirmar');
  const form=document.querySelector('.modal form');form.dataset.event=eid;form.dataset.movement=action;
}
function memberModal(eid){
  if(!isManager())return;
  const occupied=new Set(state.members.filter(m=>m.event_id===eid).map(m=>m.user_id));
  const users=state.users.filter(u=>u.active&&!occupied.has(u.id));
  if(!users.length){toast('Nenhum usuário ativo disponível. Cadastre usuários primeiro.',true);return;}
  formModal('Adicionar responsável / operador','<div class="formgrid">'+selectField('Usuário','user_id',users.map(u=>[u.id,u.full_name+' · '+u.email]))+
    selectField('Papel neste evento','role',[['responsavel','Responsável'],['operador','Operador']])+'</div>'+
    '<div class="note">Responsáveis podem registrar devoluções e encerrar o evento. Operadores registram vendas, apenas neste evento.</div>',
    'member-add','Adicionar');
  document.querySelector('.modal form').dataset.event=eid;
}

function categoryModal(parentId=null,fromProduct=false,item=null){
  if(!isManager())return;
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
    parentField+'</div><p class="help" style="margin-top:12px">A criação fica separada da seleção.</p>',
    editing?'category-edit':'category-new',editing?'Salvar':'Criar categoria',fromProduct);
  const form=[...document.querySelectorAll('.modalback form')].at(-1);
  form.dataset.parent=parent;
  form.dataset.fromProduct=fromProduct?'1':'0';
  form.dataset.lockParent=hasChildren||fromProduct?'1':'0';
  if(editing)form.dataset.id=item.id;
}

function tagModal(fromProduct=false){
  if(!isManager())return;
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
 const explicit=state.userPermissions.filter(x=>x.user_id===userId).map(x=>x.permission);
 const chosen=explicit.length?explicit:(permissionDefaults[state.users.find(x=>x.id===userId)?.role||'evento']||[]);
 return '<section class="form-section wide"><strong>Autorizações individuais</strong><p class="help">Marque cada operação permitida. As permissões são cumulativas.</p>'+
 permissionCatalog.map(([key,label])=>'<label class="field"><span><input type="checkbox" name="perm" value="'+h(key)+'" '+(chosen.includes(key)?'checked':'')+'> '+h(label)+'</span></label>').join('')+
 '</section><section class="form-section wide"><strong>Lojas autorizadas</strong><p class="help">Sem seleção, o acesso a estoques de outras lojas não é liberado.</p>'+
 state.stores.filter(x=>x.active).map(x=>'<label class="field"><span><input type="checkbox" name="store" value="'+h(x.id)+'" '+(state.staffStores.some(ss=>ss.user_id===userId&&ss.store_id===x.id)?'checked':'')+'> '+h(x.name)+'</span></label>').join('')+'</section>';
}
function userRoleModal(id){
 if(!isAdmin()||id===state.user?.id)return;
 const target=state.users.find(x=>x.id===id);if(!target)return;
 formModal('Autorizações · '+target.full_name,
 '<div class="formgrid">'+selectField('Perfil de referência','role',Object.entries(roles),target.role)+permissionFields(id)+'</div>',
 'user-permissions','Salvar autorizações');
 document.querySelector('.modal form').dataset.id=id;
}
function storesPage(){
 const manage=hasPermission('stores.manage');
 return tabHead('Lojas','Unidades cadastradas e seus saldos de estoque.',manage?button('+ Nova loja','store-new','','primary'):'')+
 panel('Unidades',state.stores.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Loja</th><th>Código</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>'+
 state.stores.map(x=>'<tr><td><strong>'+h(x.name)+'</strong></td><td>'+h(x.code)+'</td><td>'+h(x.kind)+(x.is_primary?' · Principal':'')+'</td><td>'+(x.active?'Ativa':'Inativa')+' · '+(x.is_primary?state.balances.filter(b=>!b.event_id).reduce((n,b)=>n+b.quantity,0):state.storeBalances.filter(b=>b.store_id===x.id).reduce((n,b)=>n+b.quantity,0))+' un.</td><td>'+
 (manage?button('Editar','store-edit','data-id="'+h(x.id)+'"','small')+(x.is_primary?'':button(x.active?'Desativar':'Ativar','store-toggle','data-id="'+h(x.id)+'"','small')+button('Excluir','store-delete','data-id="'+h(x.id)+'"','small')):'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Nenhuma loja cadastrada.</p>')+
 '<div class="note">A exclusão é bloqueada quando existem vínculos ou saldos. Estoques individuais serão ativados somente após a migração das operações.</div>';
}
function assignedStore(storeId){
 return state.profile?.role==='admin'||state.staffStores.some(x=>x.user_id===state.user?.id&&x.store_id===storeId);
}
function storeOrdersPage(){
 const canRequest=hasPermission('orders.central')||hasPermission('orders.franchise');
 const create=canRequest?button('+ Solicitar mercadorias','store-order-new','','primary'):'';
 const status={solicitado:'Aguardando separação',separado:'Em transporte · receber',recebido:'Recebido',cancelado:'Cancelado'};
 const rows=state.storeOrders.map(o=>{
  const from=state.stores.find(x=>x.id===o.from_store_id);
  const to=state.stores.find(x=>x.id===o.to_store_id);
  const lines=state.storeOrderItems.filter(x=>x.order_id===o.id);
  const products=lines.map(x=>h(product(x.product_id)?.name||'Produto')+' · '+x.quantity+' un.').join(' | ');
  const actions=(o.status==='solicitado'&&hasPermission('orders.separate')&&assignedStore(o.from_store_id)?
    button('Confirmar separação','store-order-separate','data-id="'+h(o.id)+'"','small primary'):'')+
    (o.status==='separado'&&hasPermission('orders.receive')&&assignedStore(o.to_store_id)?
    button('Confirmar recebimento','store-order-receive','data-id="'+h(o.id)+'"','small primary'):'')+
    (o.status==='solicitado'&&(o.created_by===state.user?.id||(hasPermission('orders.cancel')&&assignedStore(o.to_store_id)))?
    button('Cancelar','store-order-cancel','data-id="'+h(o.id)+'"','small'):'');
  return '<article class="store-order-card"><header><strong>'+h(from?.name||'Origem')+' → '+h(to?.name||'Destino')+
    '</strong><span class="pill '+(o.status==='recebido'?'ativo':'')+'">'+h(status[o.status]||o.status)+'</span></header>'+
    '<small>'+h(niceTime(o.created_at))+'</small><p>'+products+'</p><div class="inline">'+actions+'</div></article>';
 });
 return tabHead('Pedidos entre lojas','Solicite, separe e confirme a chegada das mercadorias.',create)+
  panel('Solicitações',rows.length?'<div class="store-order-list">'+rows.join('')+'</div>':'<div class="panelbody"><p class="muted">Ainda não há pedidos entre lojas.</p></div>')+
  '<div class="note">A quantidade sai da origem quando a separação é confirmada e entra no destino somente após o recebimento.</div>';
}
function storeOrderModal(){
 const main=state.stores.find(x=>x.is_primary&&x.active);
 if(!main)return toast('Cadastre a loja principal antes de solicitar.',true);
 const targets=state.stores.filter(x=>x.active&&!x.is_primary&&assignedStore(x.id));
 const types=[...(hasPermission('orders.central')?[['central','Pedido à loja central']]:[]),
  ...(hasPermission('orders.franchise')?[['franquia','Pedido para franquia']]:[])];
 if(!types.length||!targets.length)return toast('Associe o funcionário à loja de destino para solicitar.',true);
 const list=state.items.filter(x=>x.active).slice(0,1500);
 const rows=list.map(p=>'<div class="store-order-product" data-store-row data-filter="'+h([p.name,p.ean,p.sku,p.apparel_color,p.apparel_size].join(' ').toLocaleLowerCase('pt-BR'))+'">'+
  '<div><strong>'+h(p.name)+'</strong><small>'+h([p.apparel_color,p.apparel_size,p.sku,p.ean].filter(Boolean).join(' · '))+
  ' · Central: '+qtyStore(p.id)+' un.</small></div>'+
  '<input type="number" inputmode="numeric" min="0" max="1000000" step="1" value="0" data-store-order-qty data-id="'+h(p.id)+'" aria-label="Quantidade de '+h(p.name)+'"></div>').join('');
 formModal('Solicitar mercadorias','<div class="formgrid">'+
  selectField('Tipo de pedido','request_type',types)+
  selectField('Loja solicitante','to_store_id',targets.map(x=>[x.id,x.name]))+
  '<div class="field wide"><span>Pesquisar por nome, SKU ou EAN</span><input type="search" data-store-order-search placeholder="Buscar mercadorias…"></div>'+
  '<section class="wide store-order-products">'+rows+'</section>'+
  textareaField('Observação','note')+'</div><div class="note">Somente produtos com quantidade maior que zero serão incluídos.</div>',
  'store-order-create','Criar solicitação');
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
    field('Senha inicial','password','password','','required minlength="6" maxlength="128" autocomplete="new-password"',
      'Mínimo de 6 caracteres. A senha não será enviada por email.')+
    field('Confirmar senha','password_confirm','password','','required minlength="6" maxlength="128" autocomplete="new-password"')+
    '</div><div class="note">O administrador entrega a senha ao funcionário por um canal seguro. O acesso é liberado imediatamente, sem confirmação por email.</div>',
    'user-new','Cadastrar usuário');
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
async function hydrateImages(){
  const nodes=[...document.querySelectorAll('img[data-photo-id]')];
  await Promise.all(nodes.map(async node=>{
    const id=node.dataset.photoId,p=product(id);if(!p?.image_path)return;
    const cached=state.imageCache.get(p.image_path);let url=cached?.url;
    if(!cached||cached.expires<Date.now()){
      try{
        const response=await db.storage.from('ame-produtos').createSignedUrl(p.image_path,600);
        if(response.error)throw response.error;
        url=response.data.signedUrl;state.imageCache.set(p.image_path,{url,expires:Date.now()+570000});
      }catch(error){console.warn('Foto indisponível',error);return;}
    }
    if(node.isConnected)node.src=url;
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
function switchView(view) {
  if(view==='roupas')view='produtos';
  if(!permittedView(view))return;
  state.view=view;state.search='';state.page=0;
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
      if((state.view==='entrada'||state.view==='saida')&&isManager()){
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
      state.view='produtos';state.search=code;state.page=0;state.categoryFilter='';state.tagFilter='';
      render();
      if(!state.items.some(p=>p.ean===code))toast('Leitura concluída. Nenhum produto encontrado para este EAN.',true);
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
    const options=nav.filter(item=>permittedView(item.id)&&
      (item.id!=='usuarios'||isAdmin())&&
      (!['categorias','tags','pedidos','entrada','saida'].includes(item.id)||isManager()));
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
    try{return apparelModal(state,{h,formModal,photoChooser,categorySelector,productTagChooser});}
    catch(error){fail(error);return;}
  }
  if(action==='apparel-add-row'){
    try{return apparelAddRow(target,{h});}catch(error){fail(error);return;}
  }
  if(action==='apparel-fill-sizes'){
    try{return apparelFillSizes(target,{h});}catch(error){fail(error);return;}
  }
  if(action==='apparel-variant-edit'){
    if(!canRegisterProducts())return;
    try{return apparelVariantEditModal(product(id),{h,formModal});}catch(error){fail(error);return;}
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
    formModal('Adicionar tamanhos · '+model.name,addSizesContent(model,variants),'extra-sizes','Cadastrar novos tamanhos');
    const form=document.querySelector('.modalback form[data-form="extra-sizes"]');
    form.dataset.modelId=id;
    form.querySelector('[name="new_color"]')?.addEventListener('input',()=>updateExtraSizeButtons(form,variants));
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
    for(const size of ['P','M','G','GG'])setSizeSelected(form,size,true);
    return;
  }
  if(action==='size-scan')return scanInto('input[name="size_ean"]',target.closest('[data-size-variant]'));
  if(action==='product-delete'){
    if(!isManager())return;
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
    target.setAttribute('aria-expanded',String(details.open));
    return;
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
    if(state.view!=='entrada'||!isManager())return;
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
    if(!isManager())return;
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
    if(!isManager()||!dest||!window.confirm('Desativar o destino "'+dest.name+'"? Os históricos de saída serão preservados.'))return;
    if(state.stockSelectedDestination===id)state.stockSelectedDestination='';
    return exec(async()=>assertOk(await db.rpc('deactivate_stock_destination',{p_id:id})),'Destino desativado; histórico preservado.');
  }
  if(action==='stock-modal')return stockModal(id);
  if(action==='event-new')return eventModal();
  if(action==='event-detail'){state.view='eventos';state.activeEvent=id;render();window.scrollTo(0,0);return;}
  if(action==='back-events'){state.activeEvent=null;state.eventWorkflow=null;render();return;}
  if(action==='event-transfer'){
    if(!isManager()||eventStatus(state.activeEvent)!=='ativo')return;
    const eligible=state.items.filter(p=>p.active&&qtyStore(p.id)>0);
    if(!eligible.length)return toast('Nenhum produto com saldo na loja.',true);
    formModal('Separação para o evento',eventBatchContent(eligible,state.apparelModels,qtyStore,photoButton),
      'event-batch','Confirmar transferência');
    const form=document.querySelector('.modalback form[data-form="event-batch"]');
    form.dataset.event=state.activeEvent;
    document.querySelector('.modalback .modalhead [data-action="modal-close"]')?.focus({preventScroll:true});
    hydrateImages();return;
  }
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
    if(!isManager()||!cat)return;
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
    if(!isManager()||!tag||!window.confirm('Excluir a tag "'+tag.name+'"?\nEla também será desvinculada de todos os produtos, sem afetar estoques.'))return;
    return exec(async()=>assertOk(await db.rpc('remove_tag_safely',{p_tag_id:id})),'Tag excluída e removida dos produtos.');
  }
  if(action==='quick-category')return categoryModal(chosenCategory(target.closest('form')),true);
  if(action==='quick-tag')return tagModal(true);
  if(action==='take-photo'||action==='choose-photo'){
    const form=target.closest('form');
    form?.querySelector(action==='take-photo'?'input[name="camera_file"]':'input[name="gallery_file"]')?.click();return;
  }
  if(action==='order-new'){
    if(!isManager())return;
    formModal('Criar Pedido Avulso',createInternalOrderForm({
      products:state.items,models:state.apparelModels,events:state.events,groupInventory
    }),'order-create','Salvar pedido');
    return;
  }
  if(action==='order-assign-event'){
    if(!isManager())return;return orderEventModal(id);
  }
  if(action==='customer-link-new'){
    if(!isManager())return;
    return formModal('Criar acesso para cliente',
      '<div class="formgrid">'+field('Identificação do acesso','label','text','','required minlength="2" maxlength="100" placeholder="Ex.: Cliente Maria ou Feira de Outubro"')+'</div>'+
      '<p class="help">Gera um link de catálogo, válido por 30 dias, sem acesso ao estoque nem ao sistema administrativo. O cliente informa nome e telefone ao fazer o pedido.</p>',
      'customer-link-create','Gerar acesso');
  }
  if(action==='customer-link-revoke'){
    if(!isManager()||!window.confirm('Revogar este acesso? O cliente não conseguirá abrir o catálogo nem enviar novos pedidos por esse link.'))return;
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
  if(['store-order-separate','store-order-receive','store-order-cancel'].includes(action)){
    const order=state.storeOrders.find(x=>x.id===id);if(!order)return;
    const actionMap={'store-order-separate':['separate_store_order','Separação concluída.'],
      'store-order-receive':['receive_store_order','Recebimento confirmado.'],
      'store-order-cancel':['cancel_store_order','Pedido cancelado.']};
    if(!window.confirm(action==='store-order-separate'?'Confirmar retirada das unidades do estoque de origem?':
      action==='store-order-receive'?'Confirmar que todas as unidades chegaram?':'Cancelar este pedido ainda não separado?'))return;
    const [rpc,msg]=actionMap[action];
    await exec(async()=>assertOk(await db.rpc(rpc,{p_order:id})),msg);return;
  }
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
  if(action==='search-scan')return scanInto('#product-search');
  if(action==='form-scan')return scanInto('input[name="'+scanTarget+'"]',target.closest('form'));
  if(action==='product-prev'){state.page=Math.max(0,state.page-1);render();return;}
  if(action==='product-next'){state.page++;render();return;}
  if(action==='export-csv')return exportCsv();
  if(action==='event-activate'){
    if(!window.confirm('Ativar este evento e permitir transferências?'))return;
    await exec(async()=>assertOk(await db.rpc('activate_event',{p_event_id:id})),'Evento ativado.');
  }
  if(action==='event-close'){
    const remaining=state.balances.filter(x=>x.event_id===id).reduce((s,b)=>s+b.quantity,0);
    if(!window.confirm('Encerrar o evento? '+remaining+' unidade(s) não voltaram ao estoque. Essas unidades terão baixa neutra do evento, sem venda nem devolução. A operação é definitiva.'))return;
    await exec(async()=>assertOk(await db.rpc('close_event',{p_event_id:id})),'Evento encerrado. Unidades não retornadas baixadas, sem alterar o estoque da loja.');
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
        db,assertOk,state,categoryChain,chosenCategory,productTagValues,closeTopModal,loadData,toast
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
      if(form.__photoBlob){
        try{
          const compressed=form.__photoBlob;
          const path=productId+'/'+crypto.randomUUID()+'.'+(compressed.type==='image/webp'?'webp':'jpg');
          assertOk(await db.storage.from('ame-produtos').upload(path,compressed,{contentType:compressed.type,upsert:false}));
          assertOk(await db.from('products').update({image_path:path}).eq('id',productId));
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
        state,db,assertOk,chosenCategory,productTagValues,loadData,closeTopModal,toast
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
    try{await saveApparelPhoto(form,{db,assertOk,loadData,closeTopModal,toast});}
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
    if(!isManager()||eventStatus(form.dataset.event)!=='ativo')return;
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
  if(type==='stock-operation'){
    return saveStockOperation(form);
  }
  if(type==='stock-destination-save'){
    if(!isManager())return;
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
    if(!isManager())return;
    const kind=values.operation_kind;
    if(!['entrada','saida'].includes(kind))return toast('Escolha Entrada ou Saída.',true);
    const id=form.dataset.id;
    closeTopModal();switchView(kind);addStockOperationItem(id);
    return;
  }
  if(type==='order-create'){
    if(!isManager())return;
    let items;
    try{items=collectInternalOrder(form);}catch(error){toast(error.message,true);return;}
    const name=String(values.customer_name||'').trim(),phone=String(values.customer_phone||'').trim();
    if(name.length<2||phone.replace(/\D/g,'').length<10){toast('Informe nome e telefone com DDD.',true);return;}
    await exec(async()=>assertOk(await db.rpc('create_internal_avulso_order',{
      p_name:name,p_phone:phone,p_items:items,
      p_event_id:values.event_id||null,p_request_id:crypto.randomUUID()
    })),'Pedido registrado. Nenhuma quantidade de estoque foi alterada.');
    return;
  }
  if(type==='order-associate'){
    if(!isManager())return;
    await exec(async()=>assertOk(await db.rpc('assign_avulso_order_event',{
      p_order_id:form.dataset.id,p_event_id:values.event_id||null
    })),'Vínculo de evento atualizado; estoque inalterado.');
    return;
  }
  if(type==='customer-link-create'){
    if(!isManager())return;
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
  if(type==='event-create'){
    if(!isManager())return;
    if(values.ends_at&&values.ends_at<values.starts_at){toast('A data final não pode ser anterior ao início.',true);return;}
    await exec(async()=>assertOk(await db.from('events').insert({
      name:String(values.name).trim(),starts_at:values.starts_at,ends_at:values.ends_at||null,
      notes:values.notes||null,created_by:state.user.id
    })),'Evento criado.');
    return;
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
    if(!isManager())return;
    await exec(async()=>assertOk(await db.from('event_members').insert({
      event_id:form.dataset.event,user_id:values.user_id,role:values.role
    })),'Equipe atualizada.');
    return;
  }

  if(type==='category-new'||type==='category-edit'){
    if(!isManager())return;
    const name=String(values.name||'').trim(), parent=form.dataset.fromProduct==='1'?(form.dataset.parent||null):(values.parent_id||null);
    if(name.length<2||name.length>90){toast('Nome entre 2 e 90 caracteres.',true);return;}
    if(form.dataset.fromProduct==='1'){
      await saveTaxonomyFromProduct(form,'categories',{name,parent_id:parent},'Categoria criada e selecionada.');
    }else if(type==='category-edit'){
      const data={name};if(form.dataset.lockParent!=='1')data.parent_id=parent;
      await exec(async()=>assertOk(await db.from('categories').update(data).eq('id',form.dataset.id)),'Categoria atualizada.');
    }else{
      await exec(async()=>assertOk(await db.from('categories').insert({name,parent_id:parent})),'Categoria criada.');
    }
    return;
  }
  if(type==='tag-new'){
    if(!isManager())return;
    const name=String(values.name||'').trim();
    if(name.length<2||name.length>40||name.includes(',')){toast('Nome de tag inválido.',true);return;}
    if(form.dataset.fromProduct==='1'){
      await saveTaxonomyFromProduct(form,'tags',{name},'Tag criada e selecionada.');
    }else{
      await exec(async()=>assertOk(await db.from('tags').insert({name})),'Tag criada.');
    }
    return;
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
    const main=state.stores.find(x=>x.is_primary);
    await exec(async()=>assertOk(await db.rpc('create_store_order',{
      p_from_store:main.id,p_to_store:values.to_store_id,p_type:values.request_type,
      p_items:items,p_note:values.note||null
    })),'Solicitação criada. A separação ainda não movimentou estoque.');return;
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
    const html=more.map(group=>quickBalanceCard(group,{photoButton,qtyStore,h})).join('');
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
  if(event.key==='Escape'){
    if(document.querySelector('.share-product-modal'))document.querySelector('.share-product-modal').remove();
    else if(document.querySelector('.tax-backdrop'))closeTaxonomyPicker();
    else if(document.querySelector('.photo-lightbox'))document.querySelector('.photo-lightbox').remove();
    else if(document.querySelector('.mobile-more-overlay'))closeMobileNavigation();
    else if(document.querySelector('.modalback'))closeTopModal();
  }
});
document.addEventListener('submit',event=>{handleSubmit(event).catch(fail);});
document.addEventListener('input',event=>{
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
  if(event.target.matches('input[name="camera_file"],input[name="gallery_file"]'))handlePhotoInput(event.target).catch(fail);
  if(event.target.id==='event-filter'){state.eventFilter=event.target.value;render();}
  if(event.target.id==='movement-filter'){state.movementFilter=event.target.value;render();}
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
