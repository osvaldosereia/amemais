// Lojas: visão gerencial de unidades, distinta da fila operacional de Pedidos.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const historical=new Set(['enviado','concluido','recebido','recebido_divergente','cancelado','expirado']);
const num=x=>Number(x||0).toLocaleString('pt-BR');
export const isHistoricalOrder=o=>historical.has(o.status);
export function matchesStoreOrder(order,scope){
 if(!scope)return true;
 if(scope.type==='central')return true;
 if(scope.type==='store')return order.kind==='loja'&&
  (order.raw?.to_store_id===scope.id||order.raw?.from_store_id===scope.id);
 if(scope.type==='event')return (order.kind==='evento'||order.kind==='avulso')&&order.eventId===scope.id;
 return false;
}
export function locationOrders(all,scope,mode='all'){
 const list=(all||[]).filter(order=>matchesStoreOrder(order,scope)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 return mode==='pending'?list.filter(o=>!isHistoricalOrder(o)):
  mode==='history'?list.filter(isHistoricalOrder):list;
}
export function storeUnitSummaries(loc,orders=[],context={}){
 const scope={type:loc.type,id:loc.id},own=locationOrders(orders,scope);
 const pending=own.filter(o=>!isHistoricalOrder(o)), history=own.length-pending.length;
 const balances=(loc.type==='event'?context.eventBalances:context.storeBalances)||[];
 const stock=balances.filter(b=>(loc.type==='event'?b.event_id:b.store_id)===loc.id).reduce((s,b)=>s+Math.max(0,Number(b.quantity)||0),0);
 const enroute=own.filter(o=>o.status==='despachado').length;
 const checking=pending.filter(o=>o.status==='separado'||o.workflow?.stage==='conferencia').length;
 const metrics=loc.type==='event'?
  [{label:'Pedidos em andamento',value:pending.length},{label:'Mercadorias no local',value:num(stock)+' un.'},{label:'A conferir',value:checking}]:
  loc.category==='franquia'?
   [{label:'Solicitações abertas',value:pending.length},{label:'Aguardando envio',value:pending.filter(o=>['solicitado','aprovado','separado'].includes(o.status)).length},{label:'Em trânsito',value:enroute}]:
   [{label:'Pedidos em andamento',value:pending.length},{label:'Estoque físico',value:num(stock)+' un.'},{label:'A receber',value:enroute}];
 return {metrics,pending:pending.length,history,stock};
}
export function renderStoreUnitCard(loc,orders,ctx){
 const metrics=storeUnitSummaries(loc,orders,ctx).metrics;
 const status=loc.type==='event'?(loc.status==='ativo'?'active':loc.status==='encerrado'?'closed':'draft'):loc.active?'active':'inactive';
 const description=loc.type==='event'?'Loja temporária':loc.category==='franquia'?'Franquia':'Loja própria';
 const admin=loc.type==='event'?ctx.canManageEvent:ctx.canManageStores;
 const controls=admin?[
  loc.type==='store'?ctx.button('Editar cadastro','store-edit','data-id="'+esc(loc.id)+'"','small'):'',
  loc.type==='event'?ctx.button('Editar capa','event-cover-edit','data-id="'+esc(loc.id)+'"','small'):'',
  ctx.canForceDelete?ctx.button('Excluir cadastro','force-delete-preview','data-kind="'+(loc.type==='event'?'event':'store')+'" data-id="'+esc(loc.id)+'"','small danger'):''
 ].filter(Boolean).join(''):'';
 const menu=controls?'<details class="sh-unit-admin"><summary aria-label="Opções de '+esc(loc.name)+'" title="Opções da unidade">⋮</summary><div class="sh-unit-admin-menu">'+controls+'</div></details>':'';
 const cover=loc.coverPath?'<div class="sh-unit-thumb"><img data-event-cover="'+esc(loc.coverPath)+'" alt="" loading="lazy"></div>':'';
 const key=loc.type+'-'+loc.id;
 return '<article class="sh-location sh-unit-card" data-location="'+esc(key)+'" data-store-hub-item'+
  ' data-store-hub-name="'+esc([loc.name,loc.subtitle,description].join(' ').toLocaleLowerCase('pt-BR'))+'"'+
  ' data-store-hub-type="'+esc(loc.category)+'" data-store-hub-status="'+(status==='active'?'active':status==='closed'?'closed':status==='inactive'?'inactive':'draft')+'">'+
  '<div class="sh-unit-header">'+cover+'<div class="sh-unit-title"><span class="sh-unit-type">'+description+'</span>'+
  '<h3>'+esc(loc.name)+'</h3><small>'+esc(loc.subtitle||'')+'</small></div>'+menu+'</div>'+
  '<div class="sh-unit-metrics">'+metrics.map(m=>'<div><small>'+esc(m.label)+'</small><strong>'+esc(m.value)+'</strong></div>').join('')+'</div>'+
  '<div class="sh-unit-footer">'+ctx.button('Abrir unidade →','store-unit-open',
   'data-location-type="'+esc(loc.type)+'" data-location-id="'+esc(loc.id)+'"','primary')+'</div>'+
  '</article>';
}
export function renderStoreHub({stores=[],events=[],orders=[],context={}}){
 const ctx={button:()=>'',time:x=>x,canBrowseOrders:false,canManageEvent:false,canManageStores:false,
  canOpenEvent:false,showCentral:true,showFranchises:true,showEvents:true,showBranches:false,
  portal:false,canForceDelete:false,storeBalances:[],eventBalances:[],filter:{},...context};
 const canSee=s=>ctx.canSeeStore?ctx.canSeeStore(s):true;
 const allowedStores=stores.filter(s=>!s.force_archived_at&&!s.is_primary&&s.kind!=='central'&&canSee(s));
 const owned=allowedStores.filter(s=>s.kind==='filial'&&s.ownership_type==='propria'&&ctx.showCentral);
 const branches=allowedStores.filter(s=>s.kind==='filial'&&s.ownership_type!=='propria'&&ctx.showBranches);
 const franchises=ctx.showFranchises?allowedStores.filter(s=>s.kind==='franquia'):[];
 const temporary=ctx.showEvents?events.filter(e=>!e.deleted_at&&(!ctx.canSeeEvent||ctx.canSeeEvent(e))):[];
 const toStore=s=>({type:'store',id:s.id,category:s.kind==='franquia'?'franquia':'propria',
  name:s.name,subtitle:[s.code,s.manager_name].filter(Boolean).join(' · '),active:Boolean(s.active)});
 const locations=[...owned.map(toStore),...branches.map(toStore),...franchises.map(toStore),...temporary.map(e=>({
  type:'event',id:e.id,category:'temporaria',name:e.name,
  subtitle:[e.starts_at,e.ends_at].filter(Boolean).join(' até '),active:e.status==='ativo',
  status:e.status,coverPath:e.cover_path
 }))].sort((a,b)=>({propria:0,franquia:1,temporaria:2}[a.category]??3)-({propria:0,franquia:1,temporaria:2}[b.category]??3) || a.name.localeCompare(b.name,'pt-BR'));
 const counts={todas:locations.length,propria:locations.filter(x=>x.category==='propria').length,
  franquia:locations.filter(x=>x.category==='franquia').length,temporaria:locations.filter(x=>x.category==='temporaria').length};
 const buttons=[
  ctx.canManageStores?ctx.button('+ Loja / franquia','store-new','','small'):'',
  ctx.canManageEvent?ctx.button('+ Temporária','event-new','','primary'):''
 ].filter(Boolean).join('');
 const filter=ctx.filter||{};
 return '<div class="sh-page sh-hub">'+
  '<header class="pagehead"><div><h1>Lojas</h1><p>Unidades próprias, franquias e lojas temporárias.</p></div>'+
  '<div class="actions">'+buttons+'</div></header>'+
  '<div class="sh-hub-toolbar"><label>Buscar unidade<input type="search" class="search" data-store-hub-search placeholder="Nome, código ou responsável" value="'+esc(filter.search||'')+'"></label>'+
   '<label>Situação<select data-store-hub-status-filter><option value="all">Todas</option><option value="active"'+(filter.status==='active'?' selected':'')+'>Ativas</option>'+
    '<option value="draft"'+(filter.status==='draft'?' selected':'')+'>Em preparação</option>'+
    '<option value="closed"'+(filter.status==='closed'?' selected':'')+'>Encerradas</option>'+
    '<option value="inactive"'+(filter.status==='inactive'?' selected':'')+'>Inativas</option></select></label></div>'+
  '<div class="sh-hub-categories" role="group" aria-label="Filtrar tipo de loja">'+
  [['todas','Todas'],['propria','Próprias'],['franquia','Franquias'],['temporaria','Temporárias']].map(([kind,label])=>
   '<button type="button" data-action="store-hub-type" data-type="'+kind+'" aria-pressed="'+((filter.type||'todas')===kind)+'" class="'+((filter.type||'todas')===kind?'is-current':'')+'"><span>'+label+'</span><strong>'+counts[kind]+'</strong></button>').join('')+'</div>'+
  '<div class="sh-location-list sh-hub-list">'+locations.map(l=>renderStoreUnitCard(l,orders,ctx)).join('')+'</div>'+
  '<p class="sh-hub-empty" data-store-hub-empty hidden>Nenhuma unidade corresponde aos filtros escolhidos.</p>'+
  (!locations.length?'<p class="sh-no-units">Nenhuma unidade cadastrada ou acessível.</p>':'')+
  '<p class="sh-footer-help">A separação, conferência e expedição permanecem na fila central de Pedidos.</p></div>';
}
export function filterStoreHub(container,search='',type='todas',status='all'){
 if(!container)return 0;
 const q=String(search||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 let found=0;
 for(const card of container.querySelectorAll('[data-store-hub-item]')){
  const name=(card.dataset.storeHubName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const show=(!q||name.includes(q))&&(type==='todas'||card.dataset.storeHubType===type)&&
    (status==='all'||card.dataset.storeHubStatus===status);
  card.hidden=!show;if(show)found++;
 }
 const empty=container.querySelector('[data-store-hub-empty]');if(empty)empty.hidden=found!==0;
 for(const btn of container.querySelectorAll('[data-action="store-hub-type"]')){
  const current=btn.dataset.type===type;btn.classList?.toggle('is-current',current);btn.setAttribute?.('aria-pressed',String(current));
 }
 return found;
}
