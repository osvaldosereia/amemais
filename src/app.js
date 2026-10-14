import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { compressPhoto } from './photos.js';
import { scanEAN } from './scan.js';

const cfg = window.AME_CONFIG || {};
const root = document.querySelector('#app');
const h = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const niceDate = value => value ? new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Cuiaba' }).format(new Date(value.length === 10 ? value + 'T12:00:00' : value)) : '—';
const niceTime = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short', timeZone:'America/Cuiaba' }).format(new Date(value)) : '—';
const actionNames = {entrada:'Entrada',venda_loja:'Venda (loja)',transferencia:'Transferência',venda_evento:'Venda (evento)',devolucao:'Devolução',ajuste_loja:'Ajuste'};
const roles = {admin:'Administrador',gerente:'Gerente',evento:'Equipe de evento',consulta:'Consulta'};
const nav = [
  {id:'inicio',label:'Visão geral',ico:'▦'},
  {id:'produtos',label:'Produtos',ico:'□'},
  {id:'eventos',label:'Eventos',ico:'▣'},
  {id:'movimentacoes',label:'Movimentações',ico:'⇄'},
  {id:'categorias',label:'Categorias e tags',ico:'≡'},
  {id:'usuarios',label:'Usuários',ico:'♙'}
];
const state = {
  user:null,profile:null,view:'inicio',activeEvent:null,items:[],categories:[],tags:[],events:[],members:[],
  balances:[],movements:[],users:[],audits:[],search:'',page:0,eventFilter:'',movementFilter:'',categoryFilter:'',tagFilter:'',
  imageCache:new Map(),loading:false,toastTimer:0,passwordRecovery:false,loginNotice:'',setupPending:false
};
let db = null;
let notifyTimer;
const isManager = () => ['admin','gerente'].includes(state.profile?.role);
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
async function loadData(){
  if(!state.user)return;
  const resources=[
    ['items',db.from('products').select('*').order('name').limit(2500)],
    ['categories',db.from('categories').select('*').order('name').limit(1000)],
    ['tags',db.from('tags').select('*').order('name').limit(1000)],
    ['events',db.from('events').select('*').order('starts_at',{ascending:false}).limit(1000)],
    ['members',db.from('event_members').select('*').limit(2000)],
    ['balances',db.from('stock_balances').select('*').limit(10000)],
    ['movements',db.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(1000)],
    ['users',db.from('staff_profiles').select('id,full_name,email,role,active,created_at').order('full_name').limit(1000)]
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
  root.innerHTML='<div class="login-wrap"><section class="login">'+
  '<div class="brand">AME MAIS <span>Controle de estoque</span></div>'+
  '<h1>Entrar no sistema</h1><p class="muted">Informe seu email para receber um link de acesso. Não é preciso criar outra senha.</p>'+
  (message?'<div class="alert">'+h(message)+'</div>':'')+
  (state.loginNotice?'<div class="note" role="status">'+h(state.loginNotice)+'</div>':'')+
  '<form data-form="login">'+field('Seu email','email','email','','required autocomplete="email"')+
  '<button class="button primary" type="submit">Receber link de acesso</button></form>'+
  '<p class="help" style="margin-top:16px">Somente pessoas autorizadas conseguem acessar o estoque.</p></section></div>';
}
function pendingAccessScreen(){
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand">AME MAIS <span>Controle de estoque</span></div>'+
  '<h1>Acesso pendente</h1><p>O email <strong>'+h(state.user?.email)+'</strong> já foi identificado, mas precisa ser liberado por um administrador.</p>'+
  '<button class="button" data-action="logout">Sair</button></section></div>';
}
function initialAdminScreen(){
  root.innerHTML='<div class="login-wrap"><section class="login"><div class="brand">AME MAIS <span>Controle de estoque</span></div>'+
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
function categoryTree(){
  const ordered=[],visited=new Set();
  function visit(parent,level){
    const children=state.categories.filter(c=>c.parent_id===parent).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    for(const cat of children){
      if(visited.has(cat.id))continue;
      visited.add(cat.id);ordered.push({...cat,visualDepth:level});
      visit(cat.id,level+1);
    }
  }
  visit(null,1);
  for(const cat of state.categories)if(!visited.has(cat.id))ordered.push({...cat,visualDepth:cat.depth});
  return ordered;
}
function categoryChain(id){
  const chain=[],seen=new Set();let item=state.categories.find(c=>c.id===id);
  while(item&&!seen.has(item.id)){
    seen.add(item.id);chain.unshift(item);item=state.categories.find(c=>c.id===item.parent_id);
  }
  return chain;
}
function categoriesOptions(blank=true){
  return (blank?[['','Sem categoria']]:[]).concat(categoryTree().map(c=>[c.id,'— '.repeat(Math.max(0,c.visualDepth-1))+c.name]));
}
function categorySelectItems(form,level,parentId,selected=''){
  const el=form.elements.namedItem('category_'+level);
  if(!el)return;
  const opts=state.categories.filter(c=>c.parent_id===parentId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const label=level==='main'?'Sem categoria':'Nenhuma';
  el.replaceChildren(new Option(label,''),...opts.map(c=>new Option(c.name,c.id)));
  el.value=selected;
  el.disabled=level!=='main'&&(!parentId||!opts.length);
}
function categorySelector(item=null){
  const chain=categoryChain(item?.category_id);
  const id0=chain[0]?.id||'',id1=chain[1]?.id||'',id2=chain[2]?.id||'';
  const options=(parent,selected,label)=>'<option value="">'+label+'</option>'+
    state.categories.filter(c=>c.parent_id===parent).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
    .map(c=>'<option value="'+h(c.id)+'" '+(c.id===selected?'selected':'')+'>'+h(c.name)+'</option>').join('');
  return '<section class="form-section wide"><div class="section-head"><strong>Organização</strong><small>Escolha o nível desejado</small></div>'+
    '<div class="cat-three">'+
    '<div class="cat-field"><label class="field"><span>Categoria</span><select name="category_main">'+options(null,id0,'Selecione')+'</select></label>'+
    button('+','quick-category','data-level="1" aria-label="Criar categoria" title="Criar categoria"','square')+'</div>'+
    '<div class="cat-field"><label class="field"><span>Subcategoria</span><select name="category_child" '+(!id0?'disabled':'')+'>'+options(id0,id1,'Nenhuma')+'</select></label>'+
    button('+','quick-category','data-level="2" aria-label="Criar subcategoria" title="Criar subcategoria"','square')+'</div>'+
    '<div class="cat-field"><label class="field"><span>Subsubcategoria</span><select name="category_leaf" '+(!id1?'disabled':'')+'>'+options(id1,id2,'Nenhuma')+'</select></label>'+
    button('+','quick-category','data-level="3" aria-label="Criar subsubcategoria" title="Criar subsubcategoria"','square')+'</div>'+
    '</div></section>';
}
function categorySelectorChanged(select){
  const form=select.closest('form');if(!form)return;
  const main=form.elements.namedItem('category_main'),child=form.elements.namedItem('category_child');
  if(select===main)categorySelectItems(form,'child',main.value);
  categorySelectItems(form,'leaf',child.value);
}
function tagChipsHTML(selected=[]){
  const values=new Set(selected.map(t=>t.toLocaleLowerCase('pt-BR')));
  return state.tags.length?state.tags.map(t=>
    '<label class="tag-choice"><input type="checkbox" name="chosen_tags" value="'+h(t.name)+'" '+(values.has(t.name.toLocaleLowerCase('pt-BR'))?'checked':'')+
    '><span>'+h(t.name)+'</span></label>').join(''):'<span class="muted">Nenhuma tag cadastrada ainda.</span>';
}
function productTagChooser(item=null){
  return '<section class="form-section wide"><div class="section-head"><strong>Tags</strong>'+
    button('+ Criar tag','quick-tag','','small')+'</div><p class="help">Toque nas características que identificam o produto.</p>'+
    '<div class="tag-choices" data-tag-choices>'+tagChipsHTML(item?.tags||[])+'</div></section>';
}
function refreshTaxonomyForm(selectedCategory=null,selectedTag=null){
  const form=document.querySelector('form[data-form="product-new"],form[data-form="product-edit"]');
  if(!form)return;
  const main=form.elements.namedItem('category_main'),child=form.elements.namedItem('category_child'),leaf=form.elements.namedItem('category_leaf');
  const current=selectedCategory?categoryChain(selectedCategory):[];
  const first=main?.value||current[0]?.id||'';
  const second=selectedCategory?current[1]?.id||'':child?.value||'';
  const third=selectedCategory?current[2]?.id||'':leaf?.value||'';
  categorySelectItems(form,'main',null,first);
  categorySelectItems(form,'child',first,second);
  categorySelectItems(form,'leaf',second,third);
  const checkContainer=form.querySelector('[data-tag-choices]');
  if(checkContainer){
    const chosen=[...form.querySelectorAll('input[name="chosen_tags"]:checked')].map(i=>i.value);
    if(selectedTag)chosen.push(selectedTag);
    checkContainer.innerHTML=tagChipsHTML(chosen);
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
  if(!db){root.innerHTML='<div class="login-wrap"><div class="login"><div class="brand">AME MAIS <span>Estoque</span></div><h2>Configuração necessária</h2><p>Informe URL e chave pública do novo projeto Supabase em <code>config.js</code>. Não utilize o banco de outras empresas.</p><p class="muted">Veja docs/INSTALACAO.md no repositório.</p></div></div>';return;}
  if(!state.user){loginScreen();return;}
  if(!state.profile){state.setupPending?initialAdminScreen():pendingAccessScreen();return;}
  if(!state.profile.active){pendingAccessScreen();return;}
  if(state.view==='usuarios'&&!isAdmin() || state.view==='categorias'&&!isManager())state.view='inicio';
  const menu=nav.filter(x=>(x.id!=='usuarios'||isAdmin())&&(x.id!=='categorias'||isManager())).map(x=>
    '<button data-action="view" data-view="'+h(x.id)+'" class="'+(state.view===x.id?'active':'')+'"><span aria-hidden="true">'+x.ico+'</span> '+h(x.label)+'</button>').join('');
  root.innerHTML='<div class="app-shell"><aside class="sidebar"><div class="brand">AME MAIS <span>Estoque</span></div><nav class="nav" aria-label="Menu principal">'+menu+'</nav><div class="sidefoot"><strong>'+h(state.profile.full_name)+'</strong><br>'+h(roles[state.profile.role]||state.profile.role)+'<br><button class="plain" data-action="logout">Sair da conta</button></div></aside>'+
    '<div class="main"><header class="topbar"><strong>Gestão de estoque</strong><div class="inline"><span class="userpill">'+h(state.profile.full_name)+' · '+h(roles[state.profile.role])+'</span><button class="plain only-mobile" data-action="logout">Sair</button></div></header>'+
    '<main class="content">'+pageContent()+'</main></div></div>'+
    '<nav class="bottom-nav" aria-label="Navegação do aplicativo">'+[
      ['inicio','⌂','Início'],['produtos','▦','Produtos'],['eventos','▣','Eventos'],['movimentacoes','⇄','Histórico']
    ].map(([id,ico,label])=>'<button type="button" data-action="view" data-view="'+id+'" class="'+(state.view===id?'active':'')+'">'+
      '<span aria-hidden="true">'+ico+'</span><small>'+label+'</small></button>').join('')+
    '<button type="button" data-action="mobile-more" class="'+(['categorias','usuarios'].includes(state.view)?'active':'')+'">'+
      '<span aria-hidden="true">≡</span><small>Mais</small></button></nav>';
  hydrateImages();
}
function pageContent(){
  if(state.view==='produtos')return productsPage();
  if(state.view==='eventos')return state.activeEvent?eventDetails():eventsPage();
  if(state.view==='movimentacoes')return movementsPage();
  if(state.view==='categorias')return categoriesPage();
  if(state.view==='usuarios')return usersPage();
  return dashboard();
}
function panel(title,content,buttonMarkup=''){
  return '<section class="panel"><div class="panelhead"><h2>'+h(title)+'</h2>'+buttonMarkup+'</div>'+content+'</section>';
}
function dashboard(){
  const active=state.events.filter(e=>e.status==='ativo'), total=state.balances.filter(b=>!b.event_id).reduce((s,b)=>s+b.quantity,0),
    away=state.balances.filter(b=>b.event_id).reduce((s,b)=>s+b.quantity,0),
    latest=state.movements.slice(0,8);
  return tabHead('Visão geral','Resumo do estoque e dos eventos')+
    '<div class="cards">'+[
      ['Produtos cadastrados',state.items.filter(p=>p.active).length],
      ['Unidades na loja',total],
      ['Unidades em eventos',away],
      ['Eventos ativos',active.length]
    ].map(([label,n])=>'<div class="card"><div class="metric-label">'+h(label)+'</div><div class="metric">'+n.toLocaleString('pt-BR')+'</div></div>').join('')+'</div>'+
    panel('Eventos em andamento',active.length?
      '<div class="tablewrap"><table class="table"><thead><tr><th>Evento</th><th>Data</th><th>Itens restantes</th><th></th></tr></thead><tbody>'+
      active.map(e=>'<tr><td><strong>'+h(e.name)+'</strong></td><td>'+niceDate(e.starts_at)+'</td><td class="qty">'+state.balances.filter(b=>b.event_id===e.id).reduce((s,b)=>s+b.quantity,0)+'</td><td>'+button('Abrir','event-detail','data-id="'+h(e.id)+'"','small')+'</td></tr>').join('')+'</tbody></table></div>'
      :'<div class="muteblock">Nenhum evento em andamento.</div>',
      button('Ver eventos','view','data-view="eventos"','small'))+
    panel('Últimas movimentações',movementTable(latest),button('Ver histórico','view','data-view="movimentacoes"','small'));
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
    '<div class="product-tags">'+(p.tags||[]).slice(0,3).map(t=>'<span class="tag">'+h(t)+'</span>').join('')+'</div>'+
    '<div class="mobile-product-actions"><span class="qty">Loja: '+qtyStore(p.id)+'</span>'+
    (isManager()?button('Estoque','stock-modal','data-id="'+h(p.id)+'"','small')+
      button('Editar','product-edit','data-id="'+h(p.id)+'"','small primary'):'')+'</div></div></article>';
}

function categoryFull(id){
  const bits=[],seen=new Set();let cat=state.categories.find(c=>c.id===id);
  while(cat&&!seen.has(cat.id)){seen.add(cat.id);bits.unshift(cat.name);cat=state.categories.find(c=>c.id===cat.parent_id);}
  return bits.join(' / ') || '—';
}
function productsPage(){
  const q=state.search.toLocaleLowerCase('pt-BR').trim();
  const filtered=state.items.filter(p=>(!q||[p.name,p.sku,p.ean,...(p.tags||[])].join(' ').toLocaleLowerCase('pt-BR').includes(q))
    &&(!state.categoryFilter||categoryChain(p.category_id).some(c=>c.id===state.categoryFilter))
    &&(!state.tagFilter||(p.tags||[]).includes(state.tagFilter)));
  const pageSize=30,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  state.page=Math.min(state.page,totalPages-1);
  const list=filtered.slice(state.page*pageSize,(state.page+1)*pageSize);
  const add=isManager()?button('+ Novo produto','product-new','','primary'):'';
  return tabHead('Produtos','Pesquise por nome, código, EAN ou tags.',add)+
    '<section class="panel"><div class="toolbar"><input id="product-search" type="search" class="search" placeholder="Buscar produto, EAN, SKU ou tag…" aria-label="Buscar produtos" value="'+h(state.search)+'"/>'+
    '<select id="category-filter" class="filter" style="width:auto;max-width:240px" aria-label="Filtrar categoria">'+[['','Todas as categorias'],...categoriesOptions(false)].map(([id,n])=>'<option value="'+h(id)+'" '+(id===state.categoryFilter?'selected':'')+'>'+h(n)+'</option>').join('')+'</select>'+
    '<select id="tag-filter" class="filter" style="width:auto;max-width:190px" aria-label="Filtrar tag">'+
    [['','Todas as tags'],...state.tags.map(t=>[t.name,t.name])].map(([id,name])=>'<option value="'+h(id)+'" '+(id===state.tagFilter?'selected':'')+'>'+h(name)+'</option>').join('')+'</select>'+
    button('Ler EAN','search-scan','','small')+'</div>'+
    (list.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>Categoria</th><th>Tags</th><th>Loja</th><th>Situação</th><th></th></tr></thead><tbody>'+
      list.map(p=>'<tr><td>'+productCell(p)+'</td><td>'+h(categoryFull(p.category_id))+'</td><td>'+(p.tags||[]).slice(0,3).map(t=>'<span class="tag">'+h(t)+'</span>').join('')+'</td><td class="qty">'+qtyStore(p.id)+'</td><td><span class="pill">'+(p.active?'Ativo':'Inativo')+'</span></td><td><div class="inline">'+(isManager()?button('Estoque','stock-modal','data-id="'+h(p.id)+'"','small'):'')+(isManager()?button('Editar','product-edit','data-id="'+h(p.id)+'"','small'):'')+'</div></td></tr>').join('')+'</tbody></table></div>':
      '<div class="muteblock">Nenhum produto encontrado.</div>')+
    '<div class="mobile-products">'+list.map(mobileProductCard).join('')+'</div>'+
    '<div class="panelbody inline" style="justify-content:space-between"><small>'+filtered.length+' produto(s) · página '+(state.page+1)+' de '+totalPages+'</small><div class="actions">'+
    button('Anterior','product-prev',state.page===0?'disabled':'','small')+button('Próxima','product-next',state.page+1>=totalPages?'disabled':'','small')+'</div></div></section>';
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
    (isManager()&&canModify?button('Transferir produtos','event-transfer','','primary'):'')+
    (canModify&&canSell(e.id)?button('Registrar venda','event-sale'):'')+
    (canModify&&canReturn(e.id)?button('Devolver produtos','event-return'):'')+
    (canModify&&canReturn(e.id)?button('Encerrar','event-close','data-id="'+h(e.id)+'"'):'');
  const stored=state.balances.filter(b=>b.event_id===e.id&&b.quantity>0);
  return '<div class="crumb"><button class="plain" data-action="back-events">← Eventos</button></div>'+
    tabHead(e.name,'Data: '+niceDate(e.starts_at)+(e.ends_at?' a '+niceDate(e.ends_at):''),pill(e.status))+
    '<div class="cards">'+[['Transferidos',transferred],['Vendidos',sold],['Devolvidos',returned],['Em evento',balance]].map(([name,val])=>
    '<div class="card"><div class="metric-label">'+name+'</div><div class="metric">'+val+'</div></div>').join('')+'</div>'+
    '<div class="actions" style="margin-bottom:18px">'+actions+'</div>'+
    (e.status==='ativo'&&balance>0?'<div class="note">Para encerrar, registre a venda ou a devolução de todas as '+balance+' unidades ainda no evento.</div>':'')+
    panel('Produtos ainda no evento',
      stored.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>EAN / SKU</th><th>No evento</th></tr></thead><tbody>'+
      stored.map(b=>{const p=product(b.product_id);return '<tr><td>'+h(p?.name||'Produto removido')+'</td><td>'+h(p?.ean||p?.sku||'—')+'</td><td class="qty">'+b.quantity+'</td></tr>';}).join('')+'</tbody></table></div>':
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
  const rows=sorted.map(c=>{
    const children=state.categories.some(x=>x.parent_id===c.id),
      used=state.items.filter(p=>p.category_id===c.id).length;
    const next=c.depth===1?'Subcategoria':'Subsubcategoria';
    return '<tr><td><div class="category-name tier-'+c.depth+'">'+(c.depth>1?'↳ ':'')+'<strong>'+h(c.name)+'</strong></div></td>'+
      '<td><span class="pill">'+h(['','Categoria','Subcategoria','Subsubcategoria'][c.depth])+'</span></td><td>'+used+'</td>'+
      '<td><div class="inline">'+(c.depth<3?button('+ '+next,'category-child','data-id="'+h(c.id)+'"','small'):'')+
      button('Editar','category-edit','data-id="'+h(c.id)+'"','small')+
      (!children&&!used?button('Excluir','category-delete','data-id="'+h(c.id)+'"','small'):'')+'</div></td></tr>';
  }).join('');
  const tags=state.tags.map(t=>{
    const used=state.items.filter(p=>(p.tags||[]).includes(t.name)).length;
    return '<div class="tag-row"><span class="tag">'+h(t.name)+'</span><small>'+used+' produto(s)</small>'+
      (used===0?button('Excluir','tag-delete','data-id="'+h(t.id)+'"','small'):'')+'</div>';
  }).join('');
  return tabHead('Categorias e tags','Crie subcategorias em até três níveis; reutilize tags em vários produtos.',
    button('+ Nova categoria','category-new','','primary'))+
    panel('Categorias organizadas','<div class="panelbody"><p class="muted">Exemplo: Roupas → Camisetas → Adulto. Crie um nível clicando em “+ Subcategoria” ou “+ Subsubcategoria”.</p></div>'+
    (sorted.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Nível</th><th>Produtos</th><th>Ações</th></tr></thead><tbody>'+
    rows+'</tbody></table></div>':'<div class="muteblock">Nenhuma categoria cadastrada.</div>'))+
    panel('Tags reutilizáveis','<div class="panelbody"><p class="muted">Exemplos: Nossa Senhora, Primeira Comunhão, Infantil, Presente.</p>'+
    (tags||'<p class="muted">Nenhuma tag cadastrada.</p>')+'</div>',button('+ Nova tag','tag-new','','small'));
}

function usersPage(){
  return tabHead('Usuários','Cada pessoa utiliza sua própria senha e permissões.',button('+ Novo usuário','user-new','','primary'))+
    panel('Equipe','<div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Email</th><th>Função</th><th>Status</th><th></th></tr></thead><tbody>'+
    state.users.map(u=>'<tr><td><strong>'+h(u.full_name)+'</strong></td><td>'+h(u.email)+'</td><td>'+h(roles[u.role]||u.role)+'</td><td><span class="pill '+(u.active?'ativo':'encerrado')+'">'+(u.active?'Ativo':'Bloqueado')+'</span></td><td>'+
      (u.id!==state.user.id?'<div class="inline">'+button('Função','user-role','data-id="'+h(u.id)+'"','small')+button(u.active?'Bloquear':'Reativar','user-toggle','data-id="'+h(u.id)+'"','small')+'</div>':'Sua conta')+'</td></tr>').join('')+'</tbody></table></div>')+
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
  if(!isManager())return;
  const markup='<div class="formgrid">'+
    field('Nome do produto *','name','text',item?.name||'','required maxlength="180"')+
    field('Código interno (SKU)','sku','text',item?.sku||'','maxlength="80"')+
    '<div class="field wide"><span>EAN / código de barras</span><div class="inline">'+
    '<input style="flex:1;min-width:155px" name="ean" type="text" inputmode="numeric" placeholder="8 a 14 dígitos" value="'+h(item?.ean||'')+'">'+
    button('Ler câmera','form-scan','data-target="ean"','')+'</div></div>'+
    photoChooser(item)+categorySelector(item)+productTagChooser(item)+
    (!item?field('Quantidade inicial na loja','initial_quantity','number','0','min="0" max="1000000" step="1"','Entrada registrada no histórico.'):'')+
    (item?selectField('Situação','active',[['true','Ativo'],['false','Inativo']],String(item.active)):'')+'</div>';
  formModal(item?'Editar produto':'Novo produto',markup,item?'product-edit':'product-new',item?'Salvar alterações':'Cadastrar produto');
  const form=document.querySelector('.modalback form');if(item)form.dataset.id=item.id;
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
  const depth=parent?(state.categories.find(c=>c.id===parent)?.depth||0)+1:1;
  if(depth>3){toast('Limite de três níveis.',true);return;}
  const label=editing?'Editar categoria':['','Nova categoria','Nova subcategoria','Nova subsubcategoria'][depth];
  const choices=categoryTree().filter(c=>c.depth<3&&(!item||c.id!==item.id)).map(c=>[c.id,categoryFull(c.id)]);
  const parentField=fromProduct?
    '<div class="field"><span>Categoria superior</span><div class="readonly-field">'+h(categoryFull(parent)||'—')+'</div></div>':
    selectField('Categoria superior','parent_id',[['','Nenhuma (principal)'],...choices],parent,hasChildren?'disabled':'');
  formModal(label,'<div class="formgrid">'+field('Nome','name','text',item?.name||'','required minlength="2" maxlength="90"')+
    parentField+'</div>'+
    '<p class="help" style="margin-top:12px">Cadastro separado para não misturar seleção e criação de categorias.</p>',
    editing?'category-edit':'category-new',editing?'Salvar':'Criar categoria',fromProduct);
  const form=[...document.querySelectorAll('.modalback form')].at(-1);
  form.dataset.parent=parent;form.dataset.fromProduct=fromProduct?'1':'0';
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
    field('Nome completo','full_name','text','','required minlength="2" maxlength="120"')+
    field('Email','email','email','','required')+
    selectField('Função','role',Object.entries(roles),'evento')+'</div>'+
    '<div class="note">O funcionário receberá um convite por email, sem senha inicial.</div>',
    'user-new','Convidar usuário');
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
  state.view=view;state.search='';state.page=0;
  if(view!=='eventos')state.activeEvent=null;
  render();window.scrollTo(0,0);
}
async function scanInto(selector){
  try {
    await scanEAN(code=>{
      const el=document.querySelector(selector);
      if(el){el.value=code;el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();}
      else {state.search=code;state.page=0;render();}
    });
  } catch(error){fail(error);}
}
async function handleClick(event){
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id,view,user,event:eventId,target:scanTarget}=target.dataset;
  if(action==='view'){document.querySelector('.mobile-more-overlay')?.remove();switchView(view);return;}
  if(action==='mobile-more'){
    document.querySelector('.mobile-more-overlay')?.remove();
    const sheet=document.createElement('div');sheet.className='mobile-more-overlay';
    const opts=[['inicio','Início'],['categorias','Categorias e tags'],['usuarios','Usuários']];
    sheet.innerHTML='<div class="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Mais opções">'+
      '<div class="section-head"><strong>Mais opções</strong><button type="button" data-action="mobile-more-close" class="plain">Fechar ✕</button></div>'+
      opts.filter(([id])=>id==='inicio'||(id==='categorias'&&isManager())||(id==='usuarios'&&isAdmin()))
        .map(([id,name])=>button(name,'view','data-view="'+id+'"','')).join('')+
      button('Sair da conta','logout','','danger')+'</div>';
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
  if(action==='modal-close'){closeTopModal();return;}
  if(action==='forgot'){
    const email=window.prompt('Informe o email da sua conta:');
    if(!email)return;
    const res=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.href.split('#')[0]});
    if(res.error)fail(res.error);else toast('Se o email estiver cadastrado, as instruções serão enviadas.');
    return;
  }
  if(action==='product-new')return productModal();
  if(action==='product-edit')return productModal(product(id));
  if(action==='stock-modal')return stockModal(id);
  if(action==='event-new')return eventModal();
  if(action==='event-detail'){state.view='eventos';state.activeEvent=id;render();window.scrollTo(0,0);return;}
  if(action==='back-events'){state.activeEvent=null;render();return;}
  if(action==='event-transfer')return eventMove('transferencia');
  if(action==='event-sale')return eventMove('venda_evento');
  if(action==='event-return')return eventMove('devolucao');
  if(action==='member-add')return memberModal(id);
  if(action==='category-new')return categoryModal();
  if(action==='category-child')return categoryModal(id);
  if(action==='category-edit')return categoryModal(null,false,state.categories.find(c=>c.id===id));
  if(action==='category-delete'){
    const cat=state.categories.find(c=>c.id===id);
    if(!isManager()||!cat||!window.confirm('Excluir a categoria '+cat.name+'?'))return;
    return exec(async()=>assertOk(await db.from('categories').delete().eq('id',id)),'Categoria excluída.');
  }
  if(action==='tag-new')return tagModal();
  if(action==='tag-delete'){
    const tag=state.tags.find(t=>t.id===id);
    if(!isManager()||!tag||!window.confirm('Excluir a tag '+tag.name+'?'))return;
    return exec(async()=>assertOk(await db.from('tags').delete().eq('id',id)),'Tag excluída.');
  }
  if(action==='quick-category'){
    const form=target.closest('form');
    const level=Number(target.dataset.level);
    const parent=level===2?form?.elements.namedItem('category_main')?.value:
      level===3?form?.elements.namedItem('category_child')?.value:null;
    if(level>1&&!parent){toast('Selecione primeiro o nível acima.',true);return;}
    return categoryModal(parent,true);
  }
  if(action==='quick-tag')return tagModal(true);
  if(action==='take-photo'||action==='choose-photo'){
    const form=target.closest('form');
    form?.querySelector(action==='take-photo'?'input[name="camera_file"]':'input[name="gallery_file"]')?.click();return;
  }
  if(action==='user-new')return userModal();
  if(action==='user-role')return userRoleModal(id);
  if(action==='search-scan')return scanInto('#product-search');
  if(action==='form-scan')return scanInto('input[name="'+scanTarget+'"]');
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
  if(type==='login'){
    state.loading=true;
    try {
      const email=String(values.email).trim().toLowerCase();
      assertOk(await db.auth.signInWithOtp({email,options:{
        emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true
      }}));
      state.loginNotice='Verifique seu email ('+email+') e abra o link recebido para acessar.';
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
    if(!isManager())return;
    const editing=type==='product-edit',id=form.dataset.id;
    const ean=String(values.ean||'').replace(/[\s-]/g,'');
    if(ean && !/^\d{8,14}$/.test(ean)){toast('O EAN deve conter de 8 a 14 dígitos.',true);return;}
    const payload={
      name:String(values.name).trim(),sku:String(values.sku||'').trim()||null,ean:ean||null,
      tags:productTagValues(form),
      category_id:values.category_leaf||values.category_child||values.category_main||null
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
        assertOk(await db.rpc('move_stock',{p_product_id:productId,p_action:'entrada',p_quantity:initial}));
      }
    },editing?'Produto atualizado.':'Produto cadastrado.');
    return;
  }
  if(type==='stock'){
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
      const data={name};if(!form.elements.namedItem('parent_id').disabled)data.parent_id=parent;
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
    await exec(async()=>{
      const {data:{session}}=await db.auth.getSession();
      if(!session)throw new Error('Sessão expirada.');
      const response=await db.functions.invoke('admin-create-user',{
        body:{full_name:String(values.full_name).trim(),email:String(values.email).trim(),role:values.role}
      });
      if(response.error){
        let message='Não foi possível convidar este usuário.';
        const context=response.error.context;
        if(context && typeof context.json==='function'){
          try{
            const detail=await context.json();
            message=detail?.error||detail?.message||message;
          }catch{}
        }
        if(message==='Não foi possível convidar este usuário.'){
          if(response.error.name==='FunctionsFetchError')message='Falha na comunicação com o serviço de convites. Recarregue a página e tente novamente.';
          else if(context?.status===401)message='Sua sessão expirou. Saia do sistema e entre novamente.';
          else if(context?.status===403)message='Seu usuário não possui permissão para cadastrar colaboradores.';
          else message=response.error.message||message;
        }
        throw new Error(message);
      }
      if(!response.data?.success)throw new Error(response.data?.error||'Erro ao criar usuário.');
      if(response.data?.warning)toast(response.data.warning,true);
    },'Colaborador autorizado. Se a conta era nova, o convite foi enviado por email.');
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
    if(document.querySelector('.photo-lightbox'))document.querySelector('.photo-lightbox').remove();
    else if(document.querySelector('.mobile-more-overlay'))document.querySelector('.mobile-more-overlay').remove();
    else if(document.querySelector('.modalback'))closeTopModal();
  }
});
document.addEventListener('submit',event=>{handleSubmit(event).catch(fail);});
document.addEventListener('input',event=>{
  if(event.target.id==='product-search'||event.target.id==='movement-search')updateFiltered(event.target.id,event.target.value);
  if(event.target.matches('[data-tag-search]')){
    const q=event.target.value.trim().toLocaleLowerCase('pt-BR');
    event.target.closest('.form-section')?.querySelectorAll('.tag-choice').forEach(el=>{
      el.hidden=!!q&&!el.textContent.toLocaleLowerCase('pt-BR').includes(q);
    });
  }
});
document.addEventListener('change',event=>{
  if(event.target.matches('input[name="camera_file"],input[name="gallery_file"]'))handlePhotoInput(event.target).catch(fail);
  if(event.target.id==='category-filter'){state.categoryFilter=event.target.value;state.page=0;render();}
  if(event.target.id==='tag-filter'){state.tagFilter=event.target.value;state.page=0;render();}
  if(event.target.matches('select[name="category_main"],select[name="category_child"]'))categorySelectorChanged(event.target);
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
