import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const root=document.querySelector('#tv-app');
const cfg=window.AME_CONFIG||{};
const fmt=new Intl.NumberFormat('pt-BR');
const timezone='America/Cuiaba';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const dt=(time,opts)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,...opts}).format(new Date(time));
const niceTime=v=>v?dt(v,{hour:'2-digit',minute:'2-digit'}):'—';
const niceDate=v=>v?dt(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v+'T12:00:00Z':v,{day:'2-digit',month:'short',year:'numeric'}):'—';
const n=v=>fmt.format(Number(v)||0);
const state={snapshot:null,management:null,managementError:null,error:null,loading:false,lastSuccess:0,lastManagement:0,accessDenied:false,pageIndex:0,paused:false,nextSwap:0,subpages:{},settingsOpen:false,rankings:null,rankingsError:null,detailReport:null};
let db=null;
let timer=null,clockTimer=null,rotationTimer=null;
const path={
 cart:'<circle cx="8.5" cy="20" r="1.5"/><circle cx="19" cy="20" r="1.5"/><path d="M2 3h2l2.2 12H20l2-9H5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5M9 13l2 2 4-4"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3.5 3.5L17 9"/>',
 truck:'<path d="M2 6h12v12H2zM14 10h4l4 4v4h-8z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
 alert:'<path d="M12 3 22 21H2z"/><path d="M12 9v5m0 3h.01"/>',
 box:'<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
 chart:'<path d="M4 20V12M10 20V7M16 20V11M22 20V3"/>',
 shop:'<path d="M3 9 5 3h14l2 6v12H3zM3 9h18M9 21v-8h6v8"/>',
 document:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9m0-5v5h5M4 13a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
 full:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>'
};
function icon(name,cls=''){return '<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(path[name]||path.box)+'</svg>';}
const stages={
 separar:{label:'A separar',class:'waiting',icon:'clock'},
 separacao:{label:'Em separação',class:'waiting',icon:'clipboard'},
 conferencia:{label:'A conferir',class:'checking',icon:'clipboard'},
 conferido:{label:'Pronto para saída',class:'done',icon:'check'},
 falta:{label:'Falta estoque',class:'alert',icon:'alert'},
 outro:{label:'Situação a revisar',class:'checking',icon:'alert'}
};
const metricCards=[
 {label:'A separar',key:'to_pick',icon:'cart',tone:'orange',subtitle:'Fila e separação'},
 {label:'A conferir',key:'checking',icon:'clipboard',tone:'blue',subtitle:'Após a separação'},
 {label:'Conferidos',key:'checked',icon:'check',tone:'green',subtitle:'Aguardando saída'},
 {label:'Enviados hoje',key:'finished_today',icon:'truck',tone:'mint',subtitle:'Expedidos no dia'}
];
const alertCards=[
 {key:'shortage',label:'Pedidos com falta',hint:'Estoque insuficiente',tone:'red',icon:'alert'},
 {key:'divergence',label:'Divergências na conferência',hint:'Precisam de revisão',tone:'amber',icon:'alert'},
 {key:'late',label:'Pedidos acima de 60 min',hint:'Aguardando avanço de etapa',tone:'orange',icon:'clock'},
 {key:'awaiting_dispatch',label:'Aguardando saída',hint:'Já conferidos',tone:'gray',icon:'box'}
];
function placeholder(text){return '<p class="tv-empty">'+esc(text)+'</p>';}
function kpis(data){
 return metricCards.map(c=>'<article class="tv-kpi tone-'+c.tone+'">'+
  '<div class="tv-kpi-icon">'+icon(c.icon)+'</div>'+
  '<div class="tv-kpi-copy"><span>'+c.label+'</span><strong>'+n(data?.[c.key])+'</strong>'+
   '<small>'+c.subtitle+'</small></div></article>').join('');
}
function priority(items){
 if(!items?.length)return placeholder('Nenhum pedido pendente neste momento.');
 return items.slice(0,6).map(x=>{
  const stage=stages[x.stage]||stages.outro;
  const minutes=Number(x.minutes)||0;
  const elapsed=minutes>=60?Math.floor(minutes/60)+'h '+(minutes%60)+'min':minutes+' min';
  return '<div class="tv-priority-row">'+
    '<strong class="tv-order-code">'+esc(x.code||'—')+'</strong>'+
    '<div class="tv-order-target"><span>'+esc(x.destination||'—')+'</span>'+
      '<small>'+n(x.units)+' un. · '+n(x.sku_count)+' SKU(s)</small></div>'+
    '<span class="tv-status stage-'+stage.class+'">'+icon(stage.icon)+esc(stage.label)+'</span>'+
    '<strong class="tv-elapsed'+(minutes>=60?' over':'')+'">'+esc(elapsed)+'</strong>'+
   '</div>';
 }).join('');
}
function alerts(data){
 return alertCards.map(c=>'<div class="tv-alert-row tone-'+c.tone+'">'+
  '<div class="tv-alert-icon">'+icon(c.icon)+'</div>'+
  '<strong class="tv-alert-count">'+n(data?.[c.key])+'</strong>'+
  '<div class="tv-alert-copy"><strong>'+c.label+'</strong><small>'+c.hint+'</small></div>'+
  '</div>').join('');
}
function activity(d){
 const specs=[
 ['shipments','Envios concluídos','truck'],
 ['shipped_units','Unidades expedidas','box'],
 ['event_lots','Pedidos de lojas temporárias','shop'],
 ['customer_orders','Pedidos avulsos','document']
 ];
 return specs.map(([key,title,visual])=>'<div class="tv-activity-item">'+icon(visual)+
  '<strong>'+n(d?.[key])+'</strong><span>'+title+'</span></div>').join('');
}
function recent(items){
 if(!items?.length)return placeholder('Nenhuma movimentação recente de pedidos.');
 return items.slice(0,4).map(x=>'<div class="tv-recent-row">'+
  '<span class="tv-recent-symbol">'+icon(x.text==='Conferência concluída'?'check':
   x.text==='Enviado para expedição'?'truck':'box')+'</span>'+
  '<strong>'+esc(x.code||'—')+'</strong><span>'+esc(x.text||'Movimentação')+'</span>'+
  '<time>'+niceTime(x.at)+'</time></div>').join('');
}
function statusMarkup(){
 const age=Date.now()-state.lastSuccess;
 const isLive=state.snapshot&&age<90000&&!state.error;
 return '<span class="tv-live'+(isLive?'':' stalled')+'"><i></i>'+
   (isLive?'Ao vivo':'Sem atualização')+'</span>';
}

const screens=[
 {label:'Operação ao vivo',seconds:20},
 {label:'Inteligência de estoque',seconds:25},
 {label:'Franquias · 30 dias',seconds:30},
 {label:'Próximos eventos',seconds:25},
 {label:'Eventos encerrados',seconds:30},
 {label:'Avarias e categorias',seconds:30},
 {label:'Compras e produtividade',seconds:25}
];
const num=x=>Number.isFinite(Number(x))?Number(x):0;
function percent(x,total){return total>0?Math.min(100,Math.max(0,Math.round(num(x)*100/num(total)))):0;}
function panel(title,body,extra=''){
 return '<article class="tv-panel tv-compact-panel '+extra+'"><h2>'+esc(title)+'</h2>'+body+'</article>';
}
function metric(label,value,hint=''){
 return '<div class="tv-metric-mini"><small>'+esc(label)+'</small><strong>'+n(value)+'</strong>'+
  (hint?'<span>'+esc(hint)+'</span>':'')+'</div>';
}
function emptyReport(txt){return '<p class="tv-empty">'+esc(txt)+'</p>';}
function issueList(items,limit=7){
 if(!items?.length)return emptyReport('Nenhuma ocorrência específica registrada nas últimas 72 horas.');
 const offset=((state.subpages[0]||0)%Math.ceil(items.length/limit))*limit;
 return items.slice(offset,offset+limit).map(item=>
  '<div class="tv-issue-row"><div class="tv-issue-order"><strong>'+esc(item.code||'—')+'</strong>'+
  '<span>'+esc(item.destination_type||'Destino')+' · '+esc(item.destination||'Não identificado')+'</span></div>'+
  '<div class="tv-issue-reason"><strong>'+esc(item.issue||'Ocorrência')+'</strong>'+
  '<small>'+esc(item.product||'Produto')+(item.sku?' · SKU '+esc(item.sku):'')+
  ' · Solicitado '+n(item.expected)+' / Identificado '+n(item.found)+'</small></div></div>'
 ).join('');
}
function lowStockRows(items){
 if(!items?.length)return emptyReport('Nenhum produto ativo para avaliar.');
 return '<div class="tv-report-head"><span>Produto / SKU</span><span>Gôndola</span><span>Disponível</span><span>Mínimo</span></div>'+
 items.slice(0,10).map(x=>
 '<div class="tv-report-row"><span><strong>'+esc(x.name||'Produto')+'</strong>'+
 '<small>'+esc(x.sku||'Sem SKU')+(x.apparel_size?' · '+esc(x.apparel_size):'')+'</small></span>'+
 '<span>'+esc(x.gondola||'—')+'</span>'+
 '<strong class="'+(num(x.available)===0?'tv-critical':'')+'">'+n(x.available)+'</strong>'+
 '<span>'+n(x.min_stock)+'</span></div>').join('');
}
function bars(items,labelA='Atual',labelB='Anterior'){
 if(!items?.length)return emptyReport('Sem solicitações no período.');
 const max=Math.max(1,...items.map(x=>Math.max(num(x.current_units),num(x.previous_units))));
 return '<div class="tv-chart-legend"><span>■ '+esc(labelA)+'</span><span>■ '+esc(labelB)+'</span></div>'+
 items.slice(0,8).map(x=>'<div class="tv-category-bars">'+
 '<div class="tv-category-title"><span>'+esc(x.category||'Sem categoria')+'</span><strong>'+n(x.current_units)+' / '+n(x.previous_units)+'</strong></div>'+
 '<div class="tv-compare-bars"><i style="width:'+percent(x.current_units,max)+'%"></i>'+
 '<b style="width:'+percent(x.previous_units,max)+'%"></b></div></div>').join('');
}
function sparkline(data){
 if(!data?.length)return emptyReport('Sem dados para o gráfico.');
 const values=data.map(x=>num(x.units)),max=Math.max(1,...values);
 const pts=values.map((v,i)=>Math.round(i*640/Math.max(1,values.length-1))+','+Math.round(115-v/max*99)).join(' ');
 return '<div class="tv-trend"><svg viewBox="0 0 640 135" role="img" aria-label="Unidades solicitadas nos últimos 14 dias">'+
 '<path d="M0 115H640" stroke="#d5e4dc" stroke-width="1"/>'+
 '<polyline fill="none" stroke="#138a5d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" points="'+pts+'"/>'+
 '</svg><div><span>'+esc(String(data[0].day||'').slice(5))+'</span><span>Últimos 14 dias</span><span>'+esc(String(data.at(-1).day||'').slice(5))+'</span></div></div>';
}
function groupBy(items,key){
 const groups=new Map();
 for(const item of items||[]){
  const k=String(item[key]||'Sem identificação');
  if(!groups.has(k))groups.set(k,[]);
  groups.get(k).push(item);
 }
 return [...groups.entries()];
}
function visibleGroups(items,key,screen,perPage=4){
 const groups=groupBy(items,key);
 if(!groups.length)return [];
 const pages=Math.ceil(groups.length/perPage);
 const part=(state.subpages[screen]||0)%pages;
 return groups.slice(part*perPage,(part+1)*perPage);
}
function franchiseCards(items){
 const entries=visibleGroups(items,'franchise',2,4);
 if(!entries.length)return emptyReport('Ainda não há franquias ativas ou dados para este relatório.');
 return '<div class="tv-four-grid">'+entries.map(([name,rows])=>
  '<article class="tv-inner-card"><h3>'+esc(name)+'</h3>'+
  '<div class="tv-inline-totals">'+metric('Solicitadas',rows.reduce((s,x)=>s+num(x.requested),0))+
     metric('Expedidas',rows.reduce((s,x)=>s+num(x.shipped),0))+'</div>'+
  '<div class="tv-mini-table">'+rows.filter(x=>num(x.requested)>0).slice(0,5).map(x=>
    '<div><span>'+esc(x.category)+'</span><strong>'+n(x.requested)+' / '+n(x.shipped)+'</strong></div>').join('')+
    (!rows.some(x=>num(x.requested)>0)?'<p>Sem pedidos nos últimos 30 dias</p>':'')+
  '</div></article>').join('')+'</div>';
}
function futureCards(items){
 const entries=visibleGroups(items,'event_name',3,4);
 if(!entries.length)return emptyReport('Nenhum evento futuro ou ativo com preparação cadastrada.');
 return '<div class="tv-four-grid">'+entries.map(([name,rows])=>{
 const needed=rows.reduce((s,x)=>s+num(x.requested),0);
 const prepared=rows.reduce((s,x)=>s+num(x.prepared),0);
 const shipped=rows.reduce((s,x)=>s+num(x.sent),0);
 return '<article class="tv-inner-card"><div class="tv-title-line"><h3>'+esc(name)+'</h3>'+
   '<time>'+esc(rows[0].starts_at?niceDate(rows[0].starts_at):'Sem data')+'</time></div>'+
   '<div class="tv-inline-totals">'+metric('Solicitadas',needed)+metric('Separadas',prepared)+metric('Enviadas',shipped)+'</div>'+
   '<div class="tv-progress"><i style="width:'+percent(prepared,needed)+'%"></i></div>'+
   '<div class="tv-mini-table">'+rows.slice(0,5).map(x=>'<div><span>'+esc(x.category)+'</span>'+
      '<strong>'+n(x.prepared)+' / '+n(x.requested)+'</strong></div>').join('')+'</div></article>';
 }).join('')+'</div>';
}
function closedCards(items){
 const entries=visibleGroups(items,'event_name',4,4);
 if(!entries.length)return emptyReport('Ainda não há encerramentos consolidados no período.');
 return '<div class="tv-four-grid">'+entries.map(([name,rows])=>{
 const total=k=>rows.reduce((s,x)=>s+num(x[k]),0);
 return '<article class="tv-inner-card"><div class="tv-title-line"><h3>'+esc(name)+'</h3>'+
    '<time>'+niceDate(rows[0].closed_at)+'</time></div>'+
  '<div class="tv-inline-totals">'+metric('Enviadas',total('sent'))+metric('Devolvidas',total('returned'))+
     metric('Não devolvidas',total('nonreturned'))+metric('Avariadas',total('damaged'))+'</div>'+
  '<div class="tv-mini-table">'+rows.slice(0,5).map(x=>'<div><span>'+esc(x.category)+'</span>'+
    '<strong>'+n(x.returned)+' dev. / '+n(x.nonreturned)+' não dev.</strong></div>').join('')+'</div>'+
  '<p class="tv-disclaimer">Não devolvido não equivale a venda confirmada.</p></article>';
 }).join('')+'</div>';
}
function damageCards(items){
 if(!items?.length)return emptyReport('Nenhuma avaria registrada nos últimos 30 dias.');
 return items.slice(0,8).map(x=>'<div class="tv-damage-line"><strong>'+esc(x.category)+'</strong>'+
  '<span>'+n(x.occurrences)+' ocorrência(s)</span><b>'+n(x.units)+' un.</b></div>').join('');
}
function currentScreen(operational,manage){
 const s=state.pageIndex;
 if(s===0)return '<div class="tv-screen-grid tv-overview">'+
  panel('Fila prioritária',priority(operational?.priority),'tv-screen-wide')+
  panel('Atenção do gerente',manage?.issues?.length?issueList(manage.issues,5):alerts(operational?.alerts),'tv-screen-alerts')+
  panel('Atividade do dia',activity(operational?.today))+
  panel('Últimas movimentações',recent(operational?.recent))+'</div>';
 if(!manage)return panel('Relatórios indisponíveis',emptyReport('Aguardando atualização da consulta gerencial.'),'tv-screen-wide');
 if(s===1)return '<div class="tv-screen-grid tv-stock-screen">'+
  panel('10 produtos com menor estoque disponível',lowStockRows(manage.low_stock),'tv-screen-wide')+
  panel('Panorama do estoque','<div class="tv-summary-grid">'+
    metric('SKUs ativos',manage.stock_summary?.products)+
    metric('Estoque zerado',manage.stock_summary?.zero)+
    metric('Abaixo do mínimo',manage.stock_summary?.below_min)+
    metric('Unidades reservadas',manage.stock_summary?.reserved)+'</div>')+
  panel('Reposição','<p class="tv-screen-tip">Produtos com saldo abaixo do mínimo merecem revisão de compras e reservas.</p>'+
    metric('Compras abertas',manage.purchases?.open))+'</div>';
 if(s===2)return panel('Solicitações de cada franquia por categoria · últimos 30 dias',
  franchiseCards(manage.franchises),'tv-screen-wide tv-section-full');
 if(s===3)return panel('Próximos eventos · separação por categoria',
  futureCards(manage.upcoming),'tv-screen-wide tv-section-full');
 if(s===4)return panel('Eventos encerrados · distribuição e retorno por categoria',
  closedCards(manage.closed_events),'tv-screen-wide tv-section-full');
 if(s===5)return '<div class="tv-screen-grid tv-analytical-screen">'+
   panel('Avarias por categoria · últimos 30 dias',damageCards(manage.damages))+
   panel('Categorias: demanda atual × período anterior',bars(manage.categories,'30 dias','30 dias anteriores'),'tv-screen-wide')+
   panel('Evolução de pedidos · 14 dias',sparkline(manage.trend))+'</div>';
 return '<div class="tv-screen-grid tv-analytical-screen">'+
  panel('Compras e abastecimento','<div class="tv-summary-grid">'+
   metric('Compras abertas',manage.purchases?.open)+
   metric('Já enviadas ao fornecedor',manage.purchases?.sent)+
   metric('Abaixo do mínimo',manage.stock_summary?.below_min)+
   metric('Sem estoque',manage.stock_summary?.zero)+'</div>')+
  panel('Produtividade da conferência','<div class="tv-summary-grid">'+
   metric('Pedidos conferidos hoje',manage.quality?.checks_today)+
   metric('Expedidos hoje',operational?.metrics?.finished_today)+
   metric('Aguardando conferência',operational?.metrics?.checking)+
   metric('Prontos para expedir',operational?.metrics?.checked)+'</div>')+
  panel('Tendência de demanda das categorias',
   bars(manage.categories,'30 dias','30 dias anteriores'),'tv-screen-wide')+'</div>';
}
function headerAlert(data,management){
 const issue=management?.issues?.[0];
 if(issue)return '<span class="tv-critical-banner">'+icon('alert')+
  '<strong>'+esc(issue.code)+' · '+esc(issue.destination_type)+': '+esc(issue.destination)+'</strong>'+
  '<span>'+esc(issue.issue)+' — '+esc(issue.product)+
   (num(issue.missing)>0?' (faltam '+n(issue.missing)+' un.)':' (diferença na contagem)')+'</span></span>';
 const shortage=num(data?.alerts?.shortage),divergence=num(data?.alerts?.divergence);
 if(shortage||divergence)return '<span class="tv-critical-banner">'+icon('alert')+
  '<strong>'+n(shortage)+' pedido(s) com falta · '+n(divergence)+' divergência(s)</strong>'+
  '<span>Consulte a tela Operação ao vivo para identificar os pedidos.</span></span>';
 return '<span class="tv-calm-banner">Sem ocorrências críticas identificadas</span>';
}
function loadRotationSettings(){
 try{
  const saved=JSON.parse(window.localStorage?.getItem('ame-tv-360-seconds')||'null');
  if(!Array.isArray(saved)||saved.length!==screens.length)return;
  for(let i=0;i<screens.length;i++)
   if(Number.isInteger(saved[i])&&saved[i]>=10&&saved[i]<=120)screens[i].seconds=saved[i];
 }catch(error){console.warn('Preferências do painel não disponíveis');}
}
function settingsMarkup(){
 if(!state.settingsOpen)return '';
 return '<div class="tv-settings-cover"><section class="tv-settings-dialog" role="dialog" aria-modal="true" aria-label="Duração das telas">'+
  '<h2>Tempo de leitura por tela</h2><p>Escolha entre 10 e 120 segundos para cada relatório. As durações ficam salvas apenas neste navegador.</p>'+
  '<div class="tv-settings-list">'+screens.map((x,i)=>
   '<label><span>'+esc(x.label)+'</span><input type="number" inputmode="numeric" min="10" max="120" step="1" value="'+x.seconds+
   '" data-tv-duration="'+i+'" aria-label="Segundos para '+esc(x.label)+'"></label>').join('')+'</div>'+
  '<div class="tv-settings-actions"><button type="button" data-action="close-tv-settings">Cancelar</button>'+
   '<button type="button" data-action="save-tv-settings">Salvar tempos</button></div></section></div>';
}

const oneCard=(title,key,content)=>'<article class="tv-one-card tv-card-'+key+'"><h2><span>'+esc(title)+'</span>'+
 '<button type="button" data-action="open-detail" data-report="'+key+'" aria-label="Abrir '+esc(title)+'">Abrir ↗</button></h2>'+content+'</article>';
const oneEmpty=label=>'<p class="tv-one-empty">'+esc(label||'Nenhum registro no período.')+'</p>';
const oneRows=(items,mode,limit=10)=>{
 if(!items?.length)return oneEmpty('Nenhum produto encontrado.');
 const col=mode==='popular'?'Un. pedidas':mode==='dormant'?'Dias':'Disponível';
 return '<div class="tv-one-product-head"><span>Produto · SKU</span><span>'+esc(col)+'</span></div>'+
 items.slice(0,limit).map(p=>'<div class="tv-one-product-row"><span title="'+esc(p.name)+'">'+esc(p.name||'Produto')+
 (p.apparel_size?' · '+esc(p.apparel_size):'')+'<small>'+esc(p.sku||'Sem SKU')+
 (p.gondola?' · Gônd. '+esc(p.gondola):'')+'</small></span><strong class="'+(mode==='low'&&!num(p.available)?'tv-one-zero':'')+'">'+
 n(mode==='popular'?p.requested_30d:mode==='dormant'?p.days_without_order:p.available)+'</strong></div>').join('');
};
function oneQueue(items){
 if(!items?.length)return oneEmpty('Nenhum pedido pendente.');
 return items.slice(0,6).map(x=>{
  const stage=stages[x.stage]||stages.outro;
  return '<div class="tv-one-queue"><b>'+esc(x.code||'—')+'</b><span>'+esc(x.destination||'Destino')+'</span>'+
   '<em class="stage-'+stage.class+'">'+esc(stage.label)+'</em><small>'+n(x.minutes)+' min</small></div>';
 }).join('');
}
function oneIssues(items,limit=4){
 if(!items?.length)return oneEmpty('Sem ocorrências identificadas.');
 return items.slice(0,limit).map(x=>'<div class="tv-one-issue"><b>'+esc(x.code||'—')+' · '+esc(x.destination_type||'')+
 ' · '+esc(x.destination||'')+'</b><span>'+esc(x.issue||'Ocorrência')+' · '+esc(x.product||'Produto')+'</span>'+
 '<small>Solicitado '+n(x.expected)+' · Identificado '+n(x.found)+'</small></div>').join('');
}
function oneDamages(items){
 if(!items?.length)return oneEmpty('Nenhuma avaria nos últimos 30 dias.');
 return items.slice(0,5).map(x=>'<div class="tv-one-simple-row"><span>'+esc(x.category)+' · '+n(x.occurrences)+
 ' ocorrência(s)</span><b>'+n(x.units)+' un.</b></div>').join('');
}
function oneFranchises(items){
 const groups=groupBy(items,'franchise');
 if(!groups.length)return oneEmpty('Nenhuma franquia cadastrada.');
 return '<div class="tv-one-franchises">'+groups.slice(0,4).map(([name,rows])=>{
 const sum=k=>rows.reduce((a,r)=>a+num(r[k]),0);
 return '<div><b>'+esc(name)+'</b><small>Solicitadas '+n(sum('requested'))+'</small><small>Expedidas '+n(sum('shipped'))+'</small></div>';
 }).join('')+'</div>';
}
function oneEvents(items,closed=false){
 const groups=groupBy(items,'event_name');
 if(!groups.length)return oneEmpty(closed?'Sem encerramentos recentes.':'Sem eventos em preparação.');
 return groups.slice(0,3).map(([name,rows])=>{
  const sum=k=>rows.reduce((a,r)=>a+num(r[k]),0);
  const q=sum(closed?'sent':'requested'),done=sum(closed?'returned':'prepared');
  return '<div class="tv-one-event"><b>'+esc(name)+'</b><small>'+
   (closed?'Enviadas '+n(q)+' · Devolvidas '+n(done)+' · Não devolvidas '+n(sum('nonreturned')):
    'Solicitadas '+n(q)+' · Separadas '+n(done)+' · Enviadas '+n(sum('sent')))+'</small>'+
   (closed?'':'<div class="tv-one-progress"><i style="width:'+percent(done,q)+'%"></i></div>')+'</div>';
 }).join('')+(closed?'<small class="tv-one-disclaimer">Não devolvido não equivale a venda confirmada.</small>':'');
}
function oneCategories(items){
 if(!items?.length)return oneEmpty('Nenhuma categoria com demanda.');
 const max=Math.max(1,...items.map(x=>Math.max(num(x.current_units),num(x.previous_units))));
 return items.slice(0,5).map(x=>'<div class="tv-one-category"><div><span>'+esc(x.category)+'</span><b>'+
 n(x.current_units)+' / '+n(x.previous_units)+'</b></div><i style="width:'+percent(x.current_units,max)+
 '%"></i><em style="width:'+percent(x.previous_units,max)+'%"></em></div>').join('');
}
function onePurchases(operational,manage){
 return '<div class="tv-one-mini-metrics">'+[
 ['Compras abertas',manage?.purchases?.open],['Enviadas ao fornecedor',manage?.purchases?.sent],
 ['Conferidos hoje',manage?.quality?.checks_today],['Expedidos hoje',operational?.metrics?.finished_today]
 ].map(([label,value])=>'<div><small>'+esc(label)+'</small><strong>'+n(value)+'</strong></div>').join('')+'</div>';
}
function oneKpis(operational,manage){
 const m=operational?.metrics||{};
 return [['A separar',m.to_pick,'list'],['A conferir',m.checking,'clipboard'],
 ['Prontos para saída',m.checked,'check'],['Enviados hoje',m.finished_today,'truck'],
 ['Sem estoque',manage?.stock_summary?.zero,'alert'],
 ['Abaixo do mínimo',manage?.stock_summary?.below_min,'chart']]
 .map(([name,value,ico],i)=>'<div class="tv-one-kpi '+(i>3?'warn':'')+'">'+icon(ico)+
 '<div><small>'+esc(name)+'</small><strong>'+n(value)+'</strong></div></div>').join('');
}
const oneTitles={
 queue:'Fila prioritária',issues:'Ocorrências identificadas',damages:'Avarias · últimos 30 dias',
 low:'10 produtos com menor estoque',high:'10 produtos com maior estoque',dormant:'Sem pedidos há +90 dias',
 popular:'Produtos mais pedidos · 30 dias',franchises:'Franquias · últimos 30 dias',
 categories:'Categorias · comparação 30 dias',upcoming:'Próximos eventos',
 closed:'Eventos encerrados',purchases:'Compras e produtividade'
};
function oneGrid(operational,manage,rankings){
 return '<div class="tv-one-grid">'+
 oneCard(oneTitles.queue,'queue',oneQueue(operational?.priority))+
 oneCard(oneTitles.issues,'issues',oneIssues(manage?.issues))+
 oneCard(oneTitles.damages,'damages',oneDamages(manage?.damages))+
 oneCard(oneTitles.low,'low',oneRows(manage?.low_stock,'low'))+
 oneCard(oneTitles.high,'high',oneRows(rankings?.top_stock,'high'))+
 oneCard(oneTitles.dormant,'dormant',oneRows(rankings?.dormant,'dormant',5))+
 oneCard(oneTitles.popular,'popular',oneRows(rankings?.most_ordered,'popular'))+
 oneCard(oneTitles.franchises,'franchises',oneFranchises(manage?.franchises))+
 oneCard(oneTitles.categories,'categories',oneCategories(manage?.categories))+
 oneCard(oneTitles.upcoming,'upcoming',oneEvents(manage?.upcoming))+
 oneCard(oneTitles.closed,'closed',oneEvents(manage?.closed_events,true))+
 oneCard(oneTitles.purchases,'purchases',onePurchases(operational,manage))+'</div>';
}
function oneDetailData(key,operational,manage,rankings){
 if(['low','high','popular','dormant'].includes(key)){
  const rows=key==='low'?manage?.low_stock||[]:key==='high'?rankings?.top_stock||[]:
   key==='popular'?rankings?.most_ordered||[]:rankings?.dormant||[];
  return rows.map(p=>[p.name+(p.apparel_size?' · '+p.apparel_size:''),p.sku||'—',p.gondola||'—',
   n(p.available),key==='popular'?n(p.requested_30d)+' un. solicitadas':
   key==='dormant'?n(p.days_without_order)+' dias':
   key==='low'?'Mínimo '+n(p.min_stock):'Físico '+n(p.physical)]);
 }
 if(key==='issues')return (manage?.issues||[]).map(x=>[x.code,x.destination_type+' · '+x.destination,x.issue,x.product+' · '+x.sku,n(x.expected)+' / '+n(x.found)]);
 if(key==='queue')return (operational?.priority||[]).map(x=>[x.code,x.destination,(stages[x.stage]||stages.outro).label,n(x.units),n(x.minutes)+' min']);
 if(key==='damages')return (manage?.damages||[]).map(x=>[x.category,n(x.occurrences),n(x.units)]);
 if(key==='franchises')return (manage?.franchises||[]).map(x=>[x.franchise,x.category,n(x.requested),n(x.shipped)]);
 if(key==='upcoming')return (manage?.upcoming||[]).map(x=>[x.event_name,x.category,n(x.requested),n(x.prepared),n(x.sent)]);
 if(key==='closed')return (manage?.closed_events||[]).map(x=>[x.event_name,x.category,n(x.sent),n(x.returned),n(x.nonreturned)]);
 if(key==='categories')return (manage?.categories||[]).map(x=>[x.category,n(x.current_units),n(x.previous_units),n(num(x.current_units)-num(x.previous_units))]);
 return [
 ['Compras abertas',n(manage?.purchases?.open)],['Enviadas ao fornecedor',n(manage?.purchases?.sent)],
 ['Pedidos conferidos hoje',n(manage?.quality?.checks_today)],
 ['Expedidos hoje',n(operational?.metrics?.finished_today)]
 ];
}
function oneDetail(operational,manage,rankings){
 const key=state.detailReport;
 if(!oneTitles[key])return '';
 const headers=['low','high','popular','dormant'].includes(key)?['Produto','SKU','Gôndola','Disponível','Referência']:
 key==='issues'?['Pedido','Destino','Ocorrência','Produto','Quantidade']:
 key==='queue'?['Pedido','Destino','Etapa','Unidades','Espera']:
 key==='damages'?['Categoria','Ocorrências','Unidades']:
 key==='franchises'?['Franquia','Categoria','Solicitadas','Expedidas']:
 key==='upcoming'?['Evento','Categoria','Solicitadas','Separadas','Enviadas']:
 key==='closed'?['Evento','Categoria','Enviadas','Devolvidas','Não devolvidas']:
 key==='categories'?['Categoria','30 dias','30 dias anteriores','Diferença']:['Indicador','Total'];
 const rows=oneDetailData(key,operational,manage,rankings);
 return '<div class="tv-one-overlay" data-action="close-detail"><aside class="tv-one-sheet" role="dialog" aria-modal="true" aria-label="'+esc(oneTitles[key])+'">'+
 '<header><div><small>CDSB · relatório</small><h2>'+esc(oneTitles[key])+'</h2></div>'+
 '<button type="button" data-action="close-detail" aria-label="Fechar">×</button></header>'+
 '<div class="tv-one-sheet-body"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead>'+
 '<tbody>'+rows.map(row=>'<tr>'+row.map(value=>'<td>'+esc(value??'—')+'</td>').join('')+'</tr>').join('')+
 (rows.length?'':'<tr><td colspan="'+headers.length+'">Nenhum registro neste relatório.</td></tr>')+
 '</tbody></table></div><footer><a href="./index.html" target="_blank" rel="noopener">Abrir sistema ↗</a>'+
 '<button type="button" data-action="close-detail">Fechar</button></footer></aside></div>';
}

function shell(data){
 const scrollBefore=document.querySelector('.tv-one-sheet-body')?.scrollTop||0;
 const generated=data?.generated_at||null;
 const live=!!data&&!state.error&&Date.now()-state.lastSuccess<90000;
 const warning=state.error||state.managementError||state.rankingsError;
 root.innerHTML='<main class="tv-shell tv-one-shell">'+
  '<header class="tv-one-header"><div class="tv-one-logo"><img src="./cdsb-brand.svg?v=20261016logo2" alt="CDSB — Centro de Distribuição São Bento"></div>'+
  '<div class="tv-one-title"><h1>Painel Gerencial 360°</h1><small>CDSB · operação, estoque e resultados em uma única tela</small></div>'+
  '<div class="tv-one-header-right">'+statusMarkup()+
  '<span>Atualizado '+niceTime(generated)+'</span>'+
  '<button type="button" data-action="refresh" aria-label="Atualizar">'+icon('refresh')+'</button>'+
  '<button type="button" data-action="fullscreen" aria-label="Tela cheia">'+icon('full')+'</button></div></header>'+
 (warning?'<div class="tv-one-warning" role="status">'+esc(warning)+'</div>':'')+
 '<section class="tv-one-ticker">'+headerAlert(data,state.management)+'</section>'+
 '<section class="tv-one-kpis">'+oneKpis(data,state.management)+'</section>'+
 '<section class="tv-one-main">'+oneGrid(data,state.management,state.rankings)+'</section>'+
 '<footer class="tv-one-footer"><span>CDSB · Atualização a cada 30 segundos · tela única, sem rotação</span>'+
 '<span>'+esc(live?'Dados atualizados':'Última atualização não confirmada')+'</span></footer>'+
 oneDetail(data,state.management,state.rankings)+'</main>';
 const detailBody=document.querySelector('.tv-one-sheet-body');
 if(detailBody)detailBody.scrollTop=scrollBefore;
}
function updateProgress(){
 const node=document.querySelector('[data-rotation-progress]');
 if(!node)return;
 const duration=screens[state.pageIndex].seconds*1000;
 const remaining=Math.max(0,state.nextSwap-Date.now());
 node.style.width=(state.paused?100:percent(duration-remaining,duration))+'%';
}
function nextScreen(delta=1){
 state.pageIndex=(state.pageIndex+delta+screens.length)%screens.length;
 if(delta>0&&[0,2,3,4].includes(state.pageIndex)){
   state.subpages[state.pageIndex]=state.subpages[state.pageIndex]===undefined?0:state.subpages[state.pageIndex]+1;
 }
 state.nextSwap=Date.now()+screens[state.pageIndex].seconds*1000;
 shell(state.snapshot);
}
function advanceRotation(){
 if(!state.snapshot||state.paused||state.accessDenied)return;
 if(Date.now()>=state.nextSwap)nextScreen();
 else updateProgress();
}

function message(title,detail){
 root.innerHTML='<div class="tv-entry"><img src="./cdsb-brand.svg?v=20261016logo2" alt="Centro de Distribuição São Bento">'+
 '<h1>'+esc(title)+'</h1><p>'+esc(detail)+'</p>'+
 '<a href="./index.html">Voltar ao AME MAIS Estoque</a></div>';
}
async function refresh(){
 if(!db||state.loading||state.accessDenied)return;
 state.loading=true;
 try{
  const [operational,management,rankings]=await Promise.all([
   db.rpc('tv_operations_snapshot'),db.rpc('tv_management_snapshot'),db.rpc('tv_product_rankings')
  ]);
  const {data,error}=operational;
  if(error)throw error;
  if(management.error){
    state.managementError='Não foi possível consultar. Últimos dados preservados.';
  }else if(management.data&&typeof management.data==='object'){
    state.management=management.data;state.lastManagement=Date.now();
    state.managementError=null;
  }else{
    state.managementError='Acesso indisponível para os relatórios.';
  }
  if(rankings.error){state.rankingsError='Ranking de produtos indisponível; última consulta mantida.';}
  else if(rankings.data&&typeof rankings.data==='object'){state.rankings=rankings.data;state.rankingsError=null;}
  else state.rankingsError='Ranking de produtos indisponível.';
  if(!data){
   state.accessDenied=true;
   state.snapshot=null;
   message('Acesso restrito','O Painel TV está disponível somente para administradores e gerentes ativos.');
   return;
  }
  if(typeof data!=='object'||!data.metrics||!Array.isArray(data.priority)||!Array.isArray(data.recent)){
   throw new Error('Resposta inválida do painel.');
  }
  state.snapshot=data;
  state.lastSuccess=Date.now();
  state.error=null;
  shell(data);
 }catch(error){
  console.error('TV dashboard refresh failed',error);
  const msg=String(error?.message||'Falha ao atualizar.');
  state.error=/JWT|session|auth|token|401/i.test(msg)?
    'Sessão expirada. Abra novamente o sistema e faça login.':
    'Não foi possível atualizar os dados. O último retrato disponível está sinalizado como desatualizado.';
  shell(state.snapshot);
 }finally{state.loading=false;}
}
async function boot(){
 if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){
  message('Configuração indisponível','Supabase não está configurado para esta instalação.');return;
 }
 db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
 });
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user){
  message('Entre no sistema','Faça login no CDSB como gerente ou administrador e reabra o Painel TV.');
  return;
 }
 db.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){state.accessDenied=true;state.snapshot=null;
   message('Sessão encerrada','Faça login novamente para acompanhar as operações.');}
 });
 await refresh();
 if(!state.accessDenied){
  timer=setInterval(refresh,30000);
  clockTimer=setInterval(()=>{
   const live=document.querySelector('.tv-live');
   if(!live||!state.snapshot)return;
   const isLive=Date.now()-state.lastSuccess<90000&&!state.error;
   live.classList.toggle('stalled',!isLive);
   live.innerHTML='<i></i>'+(isLive?'Ao vivo':'Sem atualização');
  },10000);
 }
}
document.addEventListener('click',async event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='open-detail'){const key=event.target.closest('[data-report]')?.dataset.report;
  if(oneTitles[key]){state.detailReport=key;shell(state.snapshot);}return;}
 if(action==='close-detail'){if(event.target.closest('.tv-one-sheet')&&event.target.dataset.action!=='close-detail')return;
  state.detailReport=null;shell(state.snapshot);return;}
 if(action==='refresh')await refresh();
 if(action==='open-tv-settings'){
   state.settingsOpen=true;state.paused=true;shell(state.snapshot);
 }
 if(action==='close-tv-settings'){
   state.settingsOpen=false;state.paused=false;
   state.nextSwap=Date.now()+screens[state.pageIndex].seconds*1000;shell(state.snapshot);
 }
 if(action==='save-tv-settings'){
   const inputs=[...document.querySelectorAll('[data-tv-duration]')];
   const values=inputs.map(el=>Number(el.value));
   if(values.length!==screens.length||values.some(v=>!Number.isInteger(v)||v<10||v>120)){
     window.alert('Use números entre 10 e 120 segundos.');return;
   }
   values.forEach((v,i)=>screens[i].seconds=v);
   try{window.localStorage?.setItem('ame-tv-360-seconds',JSON.stringify(values));}catch(e){}
   state.settingsOpen=false;state.paused=false;
   state.nextSwap=Date.now()+screens[state.pageIndex].seconds*1000;shell(state.snapshot);
 }
 if(action==='next-screen')nextScreen();
 if(action==='previous-screen')nextScreen(-1);
 if(action==='toggle-rotation'){
   state.paused=!state.paused;
   state.nextSwap=Date.now()+screens[state.pageIndex].seconds*1000;
   shell(state.snapshot);
 }
 if(action==='fullscreen'){
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await document.documentElement.requestFullscreen();
  }catch(e){console.warn('Tela cheia indisponível:',e.message);}
 }
});
window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(clockTimer);clearInterval(rotationTimer)});
boot().catch(e=>{console.error(e);message('Painel indisponível','Não foi possível iniciar o painel.');});
