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
const state={snapshot:null,management:null,managementError:null,error:null,loading:false,lastSuccess:0,lastManagement:0,accessDenied:false,pageIndex:0,paused:false,nextSwap:0,subpages:{},settingsOpen:false};
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
 ['event_lots','Lotes de lojas temporárias','shop'],
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
function shell(data){
 const noData=state.error&&!data;
 const generated=data?.generated_at||null;
 const at=generated||new Date().toISOString();
 const screen=screens[state.pageIndex];
 const hasDetailedData=state.management&&!state.managementError;
 root.innerHTML='<main class="tv-shell tv-360-shell">'+
  '<header class="tv-header">'+
   '<div class="tv-brand"><span class="tv-wordmark">AME<b>+</b></span>'+
    '<div class="tv-brand-sub">STORE</div></div>'+
   '<div class="tv-title"><h1>Gestão 360°</h1>'+
    '<p>CDSB · '+esc(screen.label)+'</p></div>'+
   '<div class="tv-header-tools">'+statusMarkup()+
    '<button type="button" data-action="refresh" aria-label="Atualizar">'+icon('refresh')+'</button>'+
    '<button type="button" data-action="fullscreen" aria-label="Tela cheia">'+icon('full')+'</button>'+
    '<button type="button" data-action="open-tv-settings" aria-label="Configurar tempo das telas" title="Tempo de leitura">'+icon('clock')+'</button>'+
   '</div><div class="tv-time-box"><span>Atualizado</span><strong>'+niceTime(generated)+'</strong>'+
   '<small>'+niceDate(at)+'</small></div></header>'+
  (state.error?'<div class="tv-error" role="status">'+esc(state.error)+
   ' <button data-action="refresh" type="button">Tentar novamente</button></div>':'')+
  (noData?'<section class="tv-unavailable"><h2>Dados indisponíveis</h2><p>Confira a conexão e tente novamente.</p></section>':
  '<section class="tv-alert-ticker">'+headerAlert(data,state.management)+'</section>'+
  '<section class="tv-stats" aria-label="Indicadores principais">'+kpis(data?.metrics)+'</section>'+
  (state.managementError?'<div class="tv-analytics-warning">Relatórios gerenciais: '+esc(state.managementError)+'</div>':'')+
  '<section class="tv-main-screen" aria-label="'+esc(screen.label)+'">'+
   currentScreen(data,state.management)+'</section>')+
  '<footer class="tv-footer tv-360-footer"><span>AME MAIS ESTOQUE · Operação atualizada a cada 30 segundos'+
    (hasDetailedData?' · Relatórios disponíveis':' · Relatórios não atualizados')+'</span>'+
  '<div class="tv-rotation-control">'+
   '<button type="button" data-action="previous-screen" aria-label="Tela anterior">◀</button>'+
   '<span>'+esc(screen.label)+' · '+(state.pageIndex+1)+'/'+screens.length+'</span>'+
   '<button type="button" data-action="toggle-rotation">'+(state.paused?'▶ Retomar':'Ⅱ Pausar')+'</button>'+
   '<button type="button" data-action="next-screen" aria-label="Próxima tela">▶</button>'+
  '</div><div class="tv-progress-track" aria-hidden="true"><i data-rotation-progress></i></div></footer>'+
  settingsMarkup()+'</main>';
 updateProgress();
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
 root.innerHTML='<div class="tv-entry"><img src="./ame-plus-logo.svg" alt="AME+ Store">'+
 '<h1>'+esc(title)+'</h1><p>'+esc(detail)+'</p>'+
 '<a href="./index.html">Voltar ao AME MAIS Estoque</a></div>';
}
async function refresh(){
 if(!db||state.loading||state.accessDenied)return;
 state.loading=true;
 try{
  const [operational,management]=await Promise.all([
   db.rpc('tv_operations_snapshot'),db.rpc('tv_management_snapshot')
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
  if(!state.nextSwap)state.nextSwap=Date.now()+screens[0].seconds*1000;
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
 loadRotationSettings();
 if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){
  message('Configuração indisponível','Supabase não está configurado para esta instalação.');return;
 }
 db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
 });
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user){
  message('Entre no sistema','Faça login no AME MAIS Estoque como gerente ou administrador e reabra o Painel TV.');
  return;
 }
 db.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){state.accessDenied=true;state.snapshot=null;
   message('Sessão encerrada','Faça login novamente para acompanhar as operações.');}
 });
 await refresh();
 if(!state.accessDenied){
  timer=setInterval(refresh,30000);
  rotationTimer=setInterval(advanceRotation,1000);
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
