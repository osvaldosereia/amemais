import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { compressPhoto } from './photos.js';
import { scanEAN } from './scan.js?v=20261014w2';
import { openTaxonomyPicker, closeTaxonomyPicker } from './taxonomy-ui.js?v=20261014v3';
import { apparelPage, apparelModal, apparelAddRow, apparelRemoveRow, submitApparel,
  apparelFillSizes, apparelVariantEditModal, saveApparelVariant, apparelPhotoModal, saveApparelPhoto, apparelSyncCategory } from './apparel.js';
import { sizesSection, setSizesMode, setSizeSelected, saveSizedProduct } from './product-variants.js?v=20261014b';
import { groupInventory, groupedCard, addSizesContent, updateExtraSizeButtons, toggleExtraSize, collectExtraSizes,
  eventBatchContent, collectEventBatch, eventReturnPage, filterWorkflowRows } from './stock-workflows.js?v=20261014w2';

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
const actionNames = {entrada:'Entrada',venda_loja:'Venda (loja)',transferencia:'Transferência',venda_evento:'Venda (evento)',devolucao:'Devolução',ajuste_loja:'Ajuste'};
const roles = {admin:'Administrador',gerente:'Gerente',estoquista:'Estoquista',evento:'Equipe de evento',consulta:'Consulta'};
const nav = [
  {id:'inicio',label:'Início',ico:'home'},
  {id:'produtos',label:'Produtos',ico:'package'},
  {id:'balanco',label:'Balanço rápido',ico:'clipboard'},
  {id:'eventos',label:'Eventos',ico:'calendar'},
  {id:'movimentacoes',label:'Movimentações',ico:'arrows'},
  {id:'categorias',label:'Categorias e tags',ico:'layers'},
  {id:'usuarios',label:'Usuários',ico:'users'}
];
const state = {
  user:null,profile:null,view:'inicio',activeEvent:null,items:[],categories:[],tags:[],apparelModels:[],apparelOpen:new Set(),showInactiveProducts:false,eventWorkflow:null,eventReturnQuery:'',events:[],members:[],
  balances:[],movements:[],users:[],audits:[],search:'',page:0,eventFilter:'',movementFilter:'',categoryFilter:'',tagFilter:'',
  imageCache:new Map(),collapsedCategories:new Set(),loading:false,toastTimer:0,passwordRecovery:false,loginMode:'password',loginNotice:'',setupPending:false
};
let db = null;
let notifyTimer;
const isManager = () => ['admin','gerente'].includes(state.profile?.role);
const isStockkeeper = () => state.profile?.role === 'estoquista';
const canRegisterProducts = () => isManager() || isStockkeeper();
const canQuickBalance = () => canRegisterProducts();
const permittedView = v => !isStockkeeper() || ['produtos','balanco'].includes(v);
const isAdmin = () => state.profile?.role === 'admin';
const isReader = () => state.profile?.role === 'consulta';
const product = id => state.items.find(x => x.id === id);
const eventById = id => state.events.find(x => x.id === id);
const username = id => state.users.find(x => x.id === id)?.full_name || (id === state.user?.id ? state.profile?.full_name : id?.slice(0,8) || '—');
const qtyStore = id => state.balances.find(x => x.product_id === id && !x.event_id)?.quantity || 0;
const qtyEvent = (id,eventId) => state.balances.find(x => x.product_id === id && x.event_id === eventId)?.quantity || 0;
const memberRole = eventId => state.members.find(m => m.event_id === eventId && m.user_id === state.user?.id)?.role;
const canSell = id => isManager() || Boolean(memberRole(id));
const canReturn = id => isManager() || memberRole(id) === 'responsavel';
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
  toast(err?.message || 'Não foi possível concluir a operação.',true);
}
async function exec(work,success='Operação registrada.'){
  if(state.loading)return;
  state.loading=true;
  try { await work(); await loadData(); document.querySelector('.modalback')?.remove(); toast(success); }
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
  if(isManager())resources.push(['audits',db.from('audit_log').select('id,entity,entity_id,action,actor_id,created_at').order('created_at',{ascending:false}).limit(100)]);
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
  try {await loadData();}catch(err){fail(err);render();}
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

function tagChipsHTML(selected=[]){
  const values=new Set(selected.map(t=>t.toLocaleLowerCase('pt-BR')));
  return state.tags.length?state.tags.map(t=>
    '<label class="tag-choice"><input type="checkbox" name="chosen_tags" value="'+h(t.name)+'" '+(values.has(t.name.toLocaleLowerCase('pt-BR'))?'checked':'')+
    '><span>'+h(t.name)+'</span></label>').join(''):'<span class="muted">Nenhuma tag cadastrada ainda.</span>';
}
function productTagChooser(item=null){
  return '<section class="form-section wide"><div class="section-head"><strong>Tags</strong>'+
    (isManager()?button('+ Criar tag','quick-tag','','small'):'')+'</div><p class="help">Toque nas características que identificam o produto.</p>'+
    '<div class="tag-choices" data-tag-choices>'+tagChipsHTML(item?.tags||[])+'</div></section>';
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
    checks.innerHTML=tagChipsHTML(selected);
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
  if(isStockkeeper()&&!permittedView(state.view))state.view='balanco';
  if((state.view==='usuarios'&&!isAdmin())||(state.view==='categorias'&&!isManager()))state.view='inicio';
  const mark='<img class="ame-brand-logo" src="./ame-plus-logo.svg" alt="Ame+ Store" width="132" height="70">';
  const menu=nav.filter(x=>permittedView(x.id)&&(x.id!=='usuarios'||isAdmin())&&(x.id!=='categorias'||isManager()))
    .map(x=>'<button type="button" data-action="view" data-view="'+h(x.id)+'" class="'+(state.view===x.id?'active':'')+'">'+
      uiIcon(x.ico,19)+'<span>'+h(x.label)+'</span></button>').join('');
  const desktopIdentity='<div class="brand brand-lockup">'+mark+'<small>CONTROLE DE ESTOQUE</small></div>';
  const bottomItems=isStockkeeper()?
    [{id:'produtos',label:'Produtos',ico:'package'},{id:'scan',label:'Ler EAN',ico:'scan'},{id:'balanco',label:'Balanço',ico:'clipboard'}]:
    [{id:'inicio',label:'Início',ico:'home'},{id:'produtos',label:'Produtos',ico:'package'},
     {id:'scan',label:'Ler EAN',ico:'scan'},{id:'balanco',label:'Balanço',ico:'clipboard'},
     {id:'more',label:'Mais',ico:'menu'}];
  root.innerHTML='<div class="app-shell mobile-c-app"><aside class="sidebar">'+desktopIdentity+
    '<nav class="nav" aria-label="Menu principal">'+menu+'</nav>'+
    '<div class="sidefoot"><strong>'+h(state.profile.full_name)+'</strong><br>'+h(roles[state.profile.role]||state.profile.role)+
    '<br><button class="plain" data-action="my-password">Minha senha</button>'+
    '<br><button class="plain" data-action="logout">Sair da conta</button></div></aside>'+
    '<div class="main"><header class="topbar"><div class="topbar-brand">'+mark+
    '<span class="ame-header-title">ESTOQUE</span></div>'+
    '<div class="topbar-right"><span class="userpill">'+h(state.profile.full_name)+' · '+h(roles[state.profile.role])+'</span>'+
    '<button type="button" class="mobile-top-menu only-mobile" aria-label="Abrir mais opções" data-action="mobile-more">'+uiIcon('menu',23)+'</button></div></header>'+
    '<main class="content">'+pageContent()+'</main></div></div>'+
    '<nav class="bottom-nav '+(isStockkeeper()?'bottom-nav-stockkeeper':'bottom-nav-five')+
    '" aria-label="Navegação do aplicativo">'+bottomItems.map(item=>{
      const primary=item.id==='scan';
      const on=item.id===state.view||item.id==='more'&&['eventos','movimentacoes','categorias','usuarios'].includes(state.view);
      return '<button type="button" class="'+(primary?'bottom-scan ':'')+(on?'active':'')+
        '" data-action="'+(primary?'global-scan':item.id==='more'?'mobile-more':'view')+'"'+
        (primary?'':' data-view="'+item.id+'"')+' aria-label="'+h(item.label)+'"'+(on?' aria-current="page"':'')+'>'+
        '<span class="nav-icon">'+uiIcon(item.ico,primary?27:22)+'</span><small>'+h(item.label)+'</small></button>';
    }).join('')+'</nav>';
  hydrateImages();
}

function pageContent(){
  if(state.view==='balanco')return quickBalancePage();
  if(state.view==='produtos')return productsPage();
  if(state.view==='eventos')return state.activeEvent?(state.eventWorkflow==='return'?returnWorkflowPage():eventDetails()):eventsPage();
  if(state.view==='movimentacoes')return movementsPage();
  if(state.view==='categorias')return categoriesPage();
  if(state.view==='usuarios')return usersPage();
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
function productsPage(){
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  const matched=state.items.filter(p=>(state.showInactiveProducts||p.active)&&
    (!q||[p.name,p.sku,p.ean,p.gondola,p.prateleira,...(p.tags||[])].join(' ').toLocaleLowerCase('pt-BR').includes(q))&&
    (!state.categoryFilter||categoryChain(p.category_id).some(c=>c.id===state.categoryFilter))&&
    (!state.tagFilter||(p.tags||[]).includes(state.tagFilter)));
  const groupKeys=new Set(matched.map(p=>p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  // A busca por um único EAN retorna o modelo completo com todos os seus tamanhos.
  const expanded=state.items.filter(p=>(state.showInactiveProducts||p.active)&&
    groupKeys.has(p.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p.id));
  const groups=groupInventory(expanded,state.apparelModels);
  const pageSize=20,totalPages=Math.max(1,Math.ceil(groups.length/pageSize));
  state.page=Math.min(state.page,totalPages-1);
  const list=groups.slice(state.page*pageSize,(state.page+1)*pageSize);
  const add=canRegisterProducts()?button('+ Novo produto','product-new','','primary'):'';
  return tabHead('Produtos','Um cartão por modelo, com quantidade individual de cada tamanho.',add)+
    '<section class="panel products-panel"><div class="toolbar"><input id="product-search" type="search" class="search" placeholder="Buscar produto, EAN, tamanho ou SKU…" aria-label="Buscar produtos" value="'+h(state.search)+'"/>'+
    '<button type="button" class="taxonomy-filter-button filter" data-action="taxonomy-open" data-mode="filter" aria-haspopup="dialog"><span>'+h(state.categoryFilter?categoryFull(state.categoryFilter):'Todas as categorias')+'</span><span aria-hidden="true">⌄</span></button>'+
    '<button type="button" class="taxonomy-filter-button filter" data-action="taxonomy-open" data-mode="tag" aria-haspopup="dialog"><span>'+h(state.tagFilter||'Todas as tags')+'</span><span aria-hidden="true">⌄</span></button>'+
    button('📷 Ler EAN','search-scan','','small')+
    button(state.showInactiveProducts?'Ocultar inativos':'Mostrar inativos','products-toggle-inactive','','small')+'</div>'+
    '<div class="grouped-inventory-grid">'+(list.length?list.map(g=>groupedCard(g,{
      h,photoButton,qtyStore,qtyEvent,button,isManager,canRegisterProducts
    })).join(''):'<div class="muteblock">Nenhum produto encontrado.</div>')+'</div>'+
    '<div class="panelbody inline" style="justify-content:space-between"><small>'+
    groups.length+' modelo(s)/produto(s) · '+matched.length+' variação(ões) · página '+(state.page+1)+' de '+totalPages+
    '</small><div class="actions">'+
    button('Anterior','product-prev',state.page===0?'disabled':'','small')+
    button('Próxima','product-next',state.page+1>=totalPages?'disabled':'','small')+'</div></div></section>';
}

function quickBalancePage(){
  if(!canQuickBalance())return '<div class="muteblock">Sem acesso.</div>';
  const q=state.search.trim().toLocaleLowerCase('pt-BR');
  const results=state.items.filter(p=>p.active&&(!q||
    [p.name,p.sku,p.ean,p.gondola,p.prateleira,categoryFull(p.category_id)].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
  // Nenhum campo vem previamente preenchido para evitar zerar produtos por engano.
  const rows=results.slice(0,50).map(p=>{
    const balance=qtyStore(p.id);
    return '<form class="quick-count-card" data-form="quick-count" data-count-product="'+h(p.id)+'">'+
      '<div class="quick-count-main">'+photoButton(p)+
      '<div class="quick-count-name"><strong>'+h(p.name)+'</strong><small>'+h(p.ean||p.sku||'Sem código')+'</small>'+(p.gondola||p.prateleira?'<small><strong>Local:</strong> '+h([p.gondola,p.prateleira].filter(Boolean).join(' · '))+'</small>':'')+
      '<span class="quick-count-balance">No sistema: <b>'+balance+'</b></span></div></div>'+
      '<div class="quick-count-fields"><label><span>Quantidade contada</span>'+
      '<input type="number" name="counted" inputmode="numeric" min="0" max="1000000" step="1" required placeholder="Digite a contagem" autocomplete="off"></label>'+
      '<input type="hidden" name="expected" value="'+balance+'">'+
      '<button class="button primary" type="submit">Conferir</button></div></form>';
  }).join('');
  return tabHead('Balanço rápido','Conte o estoque físico da loja. Diferenças serão registradas com seu usuário.')+
    '<section class="quick-balance-intro"><div class="quick-balance-search">'+
    '<input id="quick-search" type="search" class="search" placeholder="Nome, EAN ou código do produto…" aria-label="Buscar para contagem" value="'+h(state.search)+'">'+
    button('📷 Ler EAN','quick-scan','','primary')+'</div>'+
    '<p class="help">Pesquise ou leia o código. Digite a quantidade física e toque em Conferir. Nunca é necessário preencher todos os produtos.</p></section>'+
    '<div class="quick-count-list">'+(rows||'<div class="panel muteblock">Nenhum produto encontrado.</div>')+'</div>'+
    (results.length>50?'<p class="muted">Mostrando 50 resultados. Refine a busca para localizar seu produto.</p>':'');
}
function eventsPage(){
  const add=isManager()?button('+ Criar evento','event-new','','primary'):'';
  return tabHead('Eventos','Controle de produtos enviados, vendidos e devolvidos.',add)+
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
  const mem=state.members.filter(m=>m.event_id===e.id), entries=state.movements.filter(m=>m.event_id===e.id);
  const quantity=eid=>state.balances.filter(b=>b.event_id===eid).reduce((s,b)=>s+b.quantity,0);
  const transferred=entries.filter(m=>m.action==='transferencia').reduce((a,m)=>a+m.quantity,0);
  const sold=entries.filter(m=>m.action==='venda_evento').reduce((a,m)=>a+m.quantity,0);
  const returned=entries.filter(m=>m.action==='devolucao').reduce((a,m)=>a+m.quantity,0);
  const balance=quantity(e.id), canModify=e.status==='ativo';
  const actions=(isManager()&&e.status==='rascunho'?button('Ativar evento','event-activate','data-id="'+h(e.id)+'"','primary'):'')+
    (isManager()&&canModify?button('Separar produtos para o evento','event-transfer','','primary'):'')+
    (canModify&&canSell(e.id)?button('Registrar venda','event-sale'):'')+
    (canModify&&canReturn(e.id)?button('Devolução rápida por EAN','event-return','','primary'):'')+
    (canModify&&canReturn(e.id)?button('Encerrar','event-close','data-id="'+h(e.id)+'"'):'');
  const stored=state.balances.filter(b=>b.event_id===e.id&&b.quantity>0);
  return '<div class="crumb"><button class="plain" data-action="back-events">← Eventos</button></div>'+
    tabHead(e.name,'Data: '+niceDate(e.starts_at)+(e.ends_at?' a '+niceDate(e.ends_at):''),pill(e.status))+
    '<div class="cards">'+[['Transferidos',transferred],['Vendidos',sold],['Devolvidos',returned],['Em evento',balance]].map(([name,val])=>
    '<div class="card"><div class="metric-label">'+name+'</div><div class="metric">'+val+'</div></div>').join('')+'</div>'+
    '<div class="actions" style="margin-bottom:18px">'+actions+'</div>'+
    (e.status==='ativo'&&balance>0?'<div class="note">Para encerrar, registre a venda ou a devolução de todas as '+balance+' unidades ainda no evento.</div>':'')+
    panel('Produtos ainda no evento',
      stored.length?'<div class="grouped-inventory-grid event-stock-grid">'+
        groupInventory(stored.map(b=>product(b.product_id)).filter(Boolean),state.apparelModels).map(g=>groupedCard(g,{
          h,photoButton,qtyStore,qtyEvent,button,isManager,canRegisterProducts,mode:'event',eventId:e.id
        })).join('')+'</div>':
      '<div class="muteblock">Nenhum produto pendente neste evento.</div>')+
    panel('Equipe responsável', '<div class="panelbody">'+(mem.length?mem.map(m=>'<div class="inline" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid #edf1ee"><div><strong>'+h(username(m.user_id))+'</strong> <span class="pill">'+(m.role==='responsavel'?'Responsável':'Operador')+'</span></div>'+
      (isManager()?button('Remover','member-remove','data-user="'+h(m.user_id)+'" data-event="'+h(e.id)+'"','small'):'')+'</div>').join(''):'<p class="muted">Nenhum usuário associado.</p>')+
      (isManager()&&e.status!=='encerrado'?'<div style="margin-top:13px">'+button('+ Adicionar usuário','member-add','data-id="'+h(e.id)+'"','small')+'</div>':'')+'</div>')+
    panel('Histórico deste evento',movementTable(entries));
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
function categoriesPage(){
  const sorted=categoryTree();
  const visible=sorted.filter(c=>!categoryChain(c.id).slice(0,-1).some(parent=>state.collapsedCategories.has(parent.id)));
  const rowData=visible.map(c=>{
    const childCount=state.categories.filter(x=>x.parent_id===c.id).length;
    const used=state.items.filter(p=>p.category_id===c.id).length;
    const folded=state.collapsedCategories.has(c.id);
    const tone=(c.depth-1)%6+1;
    const level=c.depth===1?'Principal':'Nível '+c.depth;
    const indent=Math.min(c.depth-1,5)*17;
    const name='<div class="category-hierarchy-name" style="--category-indent:'+indent+'px">'+
      (childCount?'<button type="button" class="category-fold" data-action="category-toggle" data-id="'+h(c.id)+'"'+
        ' aria-label="'+(folded?'Mostrar':'Ocultar')+' subcategorias de '+h(c.name)+'"'+
        ' aria-expanded="'+(!folded)+'">'+(folded?'▸':'▾')+'</button>':
        '<span class="category-fold-spacer">·</span>')+
      '<span><strong>'+h(c.name)+'</strong>'+
      (c.depth>1?'<small>'+h(categoryFull(c.parent_id))+'</small>':'')+'</span></div>';
    const actions=button('+ Subcategoria','category-child','data-id="'+h(c.id)+'"','small')+
      button('Editar','category-edit','data-id="'+h(c.id)+'"','small')+
      button('Excluir','category-delete','data-id="'+h(c.id)+'"','small danger');
    return {c,tone,level,name,used,actions};
  });
  const rows=rowData.map(v=>'<tr class="category-tone-'+v.tone+(v.c.depth===1?' category-root':'')+'">'+
    '<td>'+v.name+'</td><td><span class="category-level-chip">'+h(v.level)+'</span></td>'+
    '<td class="qty">'+v.used+'</td><td><div class="inline">'+v.actions+'</div></td></tr>').join('');
  const mobile=rowData.map(v=>'<article class="category-mobile-row category-tone-'+v.tone+(v.c.depth===1?' category-root':'')+'">'+
    v.name+'<div class="category-mobile-details"><span class="category-level-chip">'+h(v.level)+'</span>'+
    '<small>'+v.used+' produto(s)</small></div><div class="category-mobile-actions">'+v.actions+'</div></article>').join('');
  const tags=state.tags.map(t=>{
    const used=state.items.filter(p=>(p.tags||[]).includes(t.name)).length;
    return '<div class="tag-row"><span class="tag">'+h(t.name)+'</span><small>'+used+' produto(s)</small>'+
      button('Excluir','tag-delete','data-id="'+h(t.id)+'"','small danger')+'</div>';
  }).join('');
  return tabHead('Categorias e tags','Categorias organizadas em árvore, com quantos níveis forem necessários.',
    button('+ Nova categoria','category-new','','primary'))+
    panel('Árvore de categorias','<div class="panelbody"><p class="muted">Cada nível tem um fundo suave diferente. Toque na seta para recolher ou abrir um grupo, ou use + Subcategoria para acrescentar outro nível.</p></div>'+
    (visible.length?'<div class="category-table-wrap tablewrap"><table class="table category-tree-table">'+
    '<thead><tr><th>Categoria / caminho</th><th>Nível</th><th>Produtos</th><th>Ações</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div><div class="category-mobile-tree">'+mobile+'</div>':
    '<div class="muteblock">Nenhuma categoria cadastrada.</div>'))+
    panel('Tags reutilizáveis','<div class="panelbody"><p class="muted">Exemplos: Nossa Senhora, Primeira Comunhão, Infantil, Presente.</p>'+
    (tags||'<p class="muted">Nenhuma tag cadastrada.</p>')+'</div>',button('+ Nova tag','tag-new','','small'));
}
function usersPage(){
  return tabHead('Usuários','Cada pessoa utiliza sua própria senha e permissões.',button('+ Novo usuário','user-new','','primary'))+
    panel('Equipe','<div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th>Status</th><th></th></tr></thead><tbody>'+
    state.users.map(u=>'<tr><td><strong>'+h(u.full_name)+'</strong></td><td>'+h(u.username)+'</td><td>'+h(roles[u.role]||u.role)+'</td><td><span class="pill '+(u.active?'ativo':'encerrado')+'">'+(u.active?'Ativo':'Bloqueado')+'</span></td><td>'+
      (u.id!==state.user.id?'<div class="inline">'+button('Função','user-role','data-id="'+h(u.id)+'"','small')+
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

function stockModal(id){
  if(!isManager())return;
  const p=product(id);if(!p)return;
  formModal('Movimentar estoque · '+p.name,
    '<div class="note">Saldo atual na loja: <strong>'+qtyStore(id)+' unidade(s)</strong></div>'+
    '<div class="formgrid">'+selectField('Operação','action',[['entrada','Entrada'],['venda_loja','Venda na loja'],['ajuste_loja','Ajuste (+ ou −)']])+
    field('Quantidade','quantity','number','1','required step="1" min="-1000000" max="1000000"')+
    textareaField('Observação / motivo','note')+'</div>',
    'stock','Registrar');
  document.querySelector('.modal form').dataset.id=id;
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

function userRoleModal(id){
  if(!isAdmin() || id===state.user?.id)return;
  const target=state.users.find(x=>x.id===id);
  if(!target)return;
  formModal('Função · '+target.full_name,
    '<div class="formgrid">'+selectField('Permissão de acesso','role',Object.entries(roles),target.role)+'</div>'+
    '<div class="note">Mudanças de função ficam registradas na auditoria.</div>',
    'user-role','Atualizar função');
  document.querySelector('.modal form').dataset.id=id;
}
function userModal(){
  if(!isAdmin())return;
  formModal('Cadastrar usuário','<div class="formgrid">'+
    field('Nome completo','full_name','text','','required minlength="2" maxlength="120" autocomplete="name"')+
    field('Usuário','username','text','','required minlength="3" maxlength="32" autocapitalize="none"')+
    selectField('Função','role',Object.entries(roles),'evento')+
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
  if(action==='view'){document.querySelector('.mobile-more-overlay')?.remove();switchView(view);return;}
  if(action==='global-scan'){
    document.querySelector('.mobile-more-overlay')?.remove();
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
      if(state.view==='balanco'){
        state.search=code;state.page=0;render();return;
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
  if(action==='quick-scan')return scanInto('#quick-search');
  if(action==='mobile-more'){
    document.querySelector('.mobile-more-overlay')?.remove();
    const sheet=document.createElement('div');sheet.className='mobile-more-overlay';
    const opts=[
      ['inicio','Início','home'],['produtos','Produtos','package'],['balanco','Balanço rápido','clipboard'],
      ['eventos','Eventos','calendar'],['movimentacoes','Movimentações','arrows'],
      ['categorias','Categorias e tags','layers'],['usuarios','Usuários','users']
    ];
    sheet.innerHTML='<div class="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Mais opções">'+
      '<div class="c-sheet-handle" aria-hidden="true"></div>'+
      '<div class="section-head"><strong>Menu do sistema</strong><button type="button" data-action="mobile-more-close" class="plain" aria-label="Fechar">✕</button></div>'+
      '<div class="c-more-items">'+opts.filter(([id])=>permittedView(id)&&
        (id!=='categorias'||isManager())&&(id!=='usuarios'||isAdmin()))
        .map(([id,name,ico])=>'<button type="button" class="'+(state.view===id?'active':'')+
          '" data-action="view" data-view="'+id+'">'+uiIcon(ico,21)+'<span>'+h(name)+'</span>'+uiIcon('chevron',17)+'</button>').join('')+
      '</div><div class="c-more-account"><strong>'+h(state.profile.full_name)+'</strong><small>'+
      h(roles[state.profile.role]||state.profile.role)+'</small>'+
      '<button type="button" data-action="my-password">'+uiIcon('users',18)+' Minha senha</button>'+
      '<button type="button" data-action="logout">'+uiIcon('exit',18)+' Sair da conta</button></div></div>';
    document.body.append(sheet);return;
  }
  if(action==='mobile-more-close'){document.querySelector('.mobile-more-overlay')?.remove();return;}
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
  if(action==='logout'){await db.auth.signOut();state.user=null;state.profile=null;state.imageCache.clear();render();return;}
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
          const add=form.querySelector('[data-action="quick-category"]');
          if(add)add.textContent=value?'+ Subcategoria':'+ Categoria';
        }
      }
    });return;
  }
  if(action==='category-toggle'){
    if(state.collapsedCategories.has(id))state.collapsedCategories.delete(id);
    else state.collapsedCategories.add(id);
    render();return;
  }
  if(action==='modal-close'){closeTopModal();return;}
  if(action==='login-mode'){state.loginMode=state.loginMode==='link'?'password':'link';state.loginNotice='';render();return;}
  if(action==='my-password')return myPasswordModal();
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
  if(action==='product-new')return productModal();
  if(action==='products-toggle-inactive'){state.showInactiveProducts=!state.showInactiveProducts;state.page=0;render();return;}
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
  if(action==='product-edit'){
    const item=product(id);
    if(item?.apparel_model_id)return apparelVariantEditModal(item,{h,formModal});
    return productModal(item);
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
  if(action==='event-sale')return eventMove('venda_evento');
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
    if(!isManager()||!cat||!window.confirm('Excluir "'+cat.name+'" e suas subcategorias?\nA exclusão será impedida se houver produtos vinculados a qualquer nível.'))return;
    return exec(async()=>assertOk(await db.rpc('remove_category_branch',{p_category_id:id})),'Categoria e subcategorias excluídas.');
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
    if(!window.confirm('Encerrar o evento? Saldo atual: '+remaining+' unidade(s). A operação será definitiva.'))return;
    await exec(async()=>assertOk(await db.rpc('close_event',{p_event_id:id})),'Evento encerrado.');
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
    await exec(async()=>{
      let productId=id;
      if(editing)assertOk(await db.from('products').update(payload).eq('id',id));
      else {
        const created=assertOk(await db.from('products').insert(payload).select('id').single());
        productId=created.id;
      }
      if(form.__photoBlob){
        const compressed=form.__photoBlob;
        const path=productId+'/'+crypto.randomUUID()+'.'+(compressed.type==='image/webp'?'webp':'jpg');
        assertOk(await db.storage.from('ame-produtos').upload(path,compressed,{contentType:compressed.type,upsert:false}));
        assertOk(await db.from('products').update({image_path:path}).eq('id',productId));
      }
      const initial=Number(values.initial_quantity||0);
      if(!editing&&initial>0){
        if(!Number.isInteger(initial)||initial>1000000)throw new Error('Quantidade inicial inválida');
        if(isStockkeeper())assertOk(await db.rpc('quick_stock_count',{p_product_id:productId,p_expected:0,p_counted:initial,p_note:'Cadastro inicial'}));
        else assertOk(await db.rpc('move_stock',{p_product_id:productId,p_action:'entrada',p_quantity:initial}));
      }
    },editing?'Produto atualizado.':'Produto cadastrado.');
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
  if(type==='stock'){
    if(!isManager())return;
    const quantity=Number(values.quantity);
    if(!Number.isInteger(quantity)||!quantity||Math.abs(quantity)>1000000){toast('Quantidade inválida.',true);return;}
    await exec(async()=>assertOk(await db.rpc('move_stock',{
      p_product_id:form.dataset.id,p_action:values.action,p_quantity:quantity,p_note:values.note||null
    })),'Estoque atualizado.');
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
      await invokeUserAdmin('create',{
        full_name:String(values.full_name||'').trim(),
        username:String(values.username||'').trim(),
        role:values.role,password
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
function updateFiltered(id,value){
  const active=document.activeElement;
  const selection=active?.selectionStart??null;
  state.search=value;state.page=0;render();
  const field=document.getElementById(id);
  if(field&&selection!==null){field.focus();field.setSelectionRange(selection,selection);}
}
document.addEventListener('click',event=>{
  if(event.target.classList?.contains('photo-lightbox')){document.querySelector('.photo-lightbox')?.remove();return;}
  if(event.target.classList?.contains('mobile-more-overlay')){event.target.remove();return;}
  handleClick(event).catch(fail);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(document.querySelector('.tax-backdrop'))closeTaxonomyPicker();
    else if(document.querySelector('.photo-lightbox'))document.querySelector('.photo-lightbox').remove();
    else if(document.querySelector('.mobile-more-overlay'))document.querySelector('.mobile-more-overlay').remove();
    else if(document.querySelector('.modalback'))closeTopModal();
  }
});
document.addEventListener('submit',event=>{handleSubmit(event).catch(fail);});
document.addEventListener('input',event=>{
  if(['product-search','movement-search','quick-search'].includes(event.target.id))updateFiltered(event.target.id,event.target.value);
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
document.addEventListener('change',event=>{
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
