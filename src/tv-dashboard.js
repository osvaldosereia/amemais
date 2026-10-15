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
const niceDate=v=>v?dt(v,{day:'2-digit',month:'short',year:'numeric'}):'—';
const n=v=>fmt.format(Number(v)||0);
const state={snapshot:null,error:null,loading:false,lastSuccess:0,accessDenied:false};
let db=null;
let timer=null,clockTimer=null;
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
function shell(data){
 const generated=data?.generated_at||null;
 const noData=state.error&&!data;
 const at=data?.generated_at||new Date().toISOString();
 root.innerHTML='<main class="tv-shell">'+
  '<header class="tv-header">'+
   '<div class="tv-brand"><span class="tv-wordmark">AME<b>+</b></span>'+
    '<div class="tv-brand-sub">STORE</div></div>'+
   '<span class="tv-header-separator"></span>'+
   '<div class="tv-branch"><strong>CDSB</strong><small>CENTRO DE<br>DISTRIBUIÇÃO</small></div>'+
   '<span class="tv-header-separator"></span>'+
   '<div class="tv-title"><h1>Central de Operações</h1>'+
    '<p>Estoque · Separação · Conferência · Expedição</p></div>'+
   '<div class="tv-header-tools">'+statusMarkup()+
     '<button type="button" data-action="refresh" title="Atualizar agora" aria-label="Atualizar">'+icon('refresh')+'</button>'+
     '<button type="button" data-action="fullscreen" title="Tela cheia" aria-label="Tela cheia">'+icon('full')+'</button>'+
   '</div><div class="tv-time-box"><span>Última atualização</span><strong>'+niceTime(generated)+'</strong>'+
     '<small>'+niceDate(at)+'</small></div>'+
  '</header>'+
  (state.error?'<div class="tv-error" role="status">'+esc(state.error)+
    ' <button data-action="refresh" type="button">Tentar novamente</button></div>':'')+
  (noData?'<section class="tv-unavailable"><h2>Dados indisponíveis</h2><p>Confira a conexão e tente novamente.</p>'+
  '<a href="./index.html">Voltar ao sistema</a></section>':
  '<section class="tv-stats" aria-label="Indicadores principais">'+kpis(data?.metrics)+'</section>'+
  '<section class="tv-middle">'+
   '<article class="tv-panel tv-priority"><div class="tv-panel-heading">'+
    icon('list')+'<h2>Fila prioritária</h2><span>Pedidos em andamento</span></div>'+
    '<div class="tv-priority-list">'+priority(data?.priority)+'</div></article>'+
   '<article class="tv-panel tv-alerts"><div class="tv-panel-heading">'+icon('bell')+
    '<h2>Atenção do gerente</h2></div>'+
    '<div class="tv-alert-list">'+alerts(data?.alerts)+'</div></article>'+
  '</section>'+
  '<section class="tv-bottom">'+
   '<article class="tv-panel tv-activity"><div class="tv-panel-heading">'+icon('chart')+
     '<h2>Atividade do dia</h2><span>'+niceDate(at)+'</span></div>'+
    '<div class="tv-activity-list">'+activity(data?.today)+'</div></article>'+
   '<article class="tv-panel tv-recent"><div class="tv-panel-heading">'+icon('clock')+
    '<h2>Últimas movimentações</h2></div><div class="tv-recent-list">'+recent(data?.recent)+'</div></article>'+
  '</section>')+
  '<div class="tv-footer">AME MAIS ESTOQUE · Atualização automática a cada 30 segundos'+
    ' <span>Para sair do modo TV, pressione Esc ou F11</span></div>'+
  '</main>';
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
  const {data,error}=await db.rpc('tv_operations_snapshot');
  if(error)throw error;
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
 if(action==='fullscreen'){
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await document.documentElement.requestFullscreen();
  }catch(e){console.warn('Tela cheia indisponível:',e.message);}
 }
});
window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(clockTimer)});
boot().catch(e=>{console.error(e);message('Painel indisponível','Não foi possível iniciar o painel.');});
