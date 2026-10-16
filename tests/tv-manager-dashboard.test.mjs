import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../painel-tv.html',import.meta.url),'utf8');
const css=await readFile(new URL('../tv-dashboard.css',import.meta.url),'utf8');
const script=await readFile(new URL('../src/tv-dashboard.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/20261015_manager_tv_dashboard.sql',import.meta.url),'utf8');
const managementSQL=await readFile(new URL('../supabase/migrations/202610160004_tv_management_360.sql',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../index.html',import.meta.url),'utf8');

function makeDashboard(){
 const root={innerHTML:''};
 const fakeDocument={querySelector:s=>s==='#tv-app'?root:null,addEventListener:()=>{}};
 const fakeWindow={AME_CONFIG:{},addEventListener:()=>{}};
 const source=script.replace(/^import [^\n]+\n/,'')
  .replace(/boot\(\)\.catch\([\s\S]*$/,'');
 const {shell,state,screens,nextScreen}=new Function('document','window',source+
  '\nreturn {shell,state,screens,nextScreen};')(fakeDocument,fakeWindow);
 return {shell,state,screens,nextScreen,root};
}
const mock={
 generated_at:'2026-10-15T19:33:00Z',
 metrics:{to_pick:8,checking:3,checked:2,finished_today:11},
 alerts:{shortage:1,divergence:2,late:1,awaiting_dispatch:2},
 today:{shipments:11,shipped_units:326,event_lots:4,customer_orders:7},
 priority:[{code:'AA003',kind:'evento',stage:'conferencia',destination:'Retiro Nobres',
 minutes:65,units:2,sku_count:1,divergences:0}],
 recent:[{code:'AA003',kind:'evento',text:'Conferência concluída',at:'2026-10-15T19:33:00Z'}]
};
test('modo TV possui página independente, 16:9, fullscreen e atualização periódica',()=>{
 assert.match(page,/tv-dashboard\.js\?v=20261016tv360v2/);
 assert.match(page,/tv-dashboard\.css\?v=20261016tv360v2/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-rows:minmax/);
 assert.match(script,/timer=setInterval\(refresh,30000\)/);
 assert.match(script,/requestFullscreen\(\)/);
 assert.match(script,/getUser\(\)/);
 assert.match(script,/db\.rpc\('tv_operations_snapshot'\)/);
});
test('os KPIs e a fila mostram apenas números e códigos retornados pelo banco',()=>{
 const {shell,state,root}=makeDashboard();
 state.lastSuccess=Date.now();
 state.snapshot=mock;
 shell(mock);
 for(const title of ['A separar','A conferir','Conferidos','Enviados hoje',
  'Fila prioritária','Atenção do gerente','Atividade do dia','Últimas movimentações']){
  assert.ok(root.innerHTML.includes(title),title);
 }
 assert.match(root.innerHTML,/AA003/);
 assert.match(root.innerHTML,/1h 5min/);
 assert.match(root.innerHTML,/326/);
 assert.match(root.innerHTML,/Ao vivo/);
 assert.doesNotMatch(root.innerHTML,/telefone|customer_phone/i);
});
test('exibe estado vazio e mantém segurança contra nomes HTML maliciosos',()=>{
 const {shell,state,root}=makeDashboard();
 state.lastSuccess=Date.now();state.snapshot=mock;
 shell({...mock,priority:[{...mock.priority[0],destination:'<script>alert(1)</script>'}],
  recent:[]});
 assert.doesNotMatch(root.innerHTML,/<script>alert\(1\)<\/script>/);
 assert.match(root.innerHTML,/&lt;script&gt;/);
 assert.match(root.innerHTML,/Nenhuma movimentação recente/);
});
test('consulta do banco restringe gerente/admin, oculta removidos e não expõe PII',()=>{
 assert.match(sql,/p\.role IN \('admin','gerente'\)/);
 assert.match(sql,/p\.active IS TRUE/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.tv_operations_snapshot\(\) FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/admin_removed_orders/);
 assert.match(sql,/America\/Cuiaba/);
 assert.doesNotMatch(sql,/customer_name|customer_phone|p\.email/);
});
test('somente gerente/admin veem link de acesso na navegação',()=>{
 assert.match(app,/\['admin','gerente'\]\.includes\(state\.profile\?\.role\)/);
 assert.match(app,/data-action="open-tv"/);
 assert.match(app,/window\.open\('\.\/painel-tv\.html'/);
 assert.match(entry,/src\/secure-entry\.js\?v=/);
});


const management={
 generated_at:'2026-10-16T18:00:00Z',
 issues:[{code:'AB123',kind:'loja',destination_type:'Franquia',
   destination:'Franquia Centro',issue:'Produto não encontrado na separação',
   product:'Camiseta HDH',sku:'HDH-P',expected:10,found:8,missing:2,priority:0}],
 low_stock:[{name:'Camiseta HDH',sku:'HDH-P',apparel_size:'P',gondola:'3',category:'Camisetas',
   physical:5,reserved:2,available:3,min_stock:10}],
 stock_summary:{products:21,zero:2,below_min:3,reserved:15,physical:200},
 franchises:[{franchise:'Franquia Centro',category:'Camisetas',requested:120,shipped:90}],
 upcoming:[{event_name:'Feira 2026',starts_at:'2026-10-20',category:'Camisetas',
  requested:100,prepared:70,sent:20}],
 closed_events:[{event_name:'Feira encerrada',closed_at:'2026-10-10',category:'Camisetas',
  sent:100,returned:30,nonreturned:65,damaged:5,historical_sales:0}],
 damages:[{category:'Camisetas',units:5,occurrences:2}],
 categories:[{category:'Camisetas',current_units:140,previous_units:100}],
 trend:[{day:'2026-10-15',units:18},{day:'2026-10-16',units:30}],
 purchases:{open:3,sent:2},quality:{checks_today:7}
};
test('sete telas rotativas mantêm leitura adequada e tempos por relatório',()=>{
 const {screens}=makeDashboard();
 assert.equal(screens.length,7);
 assert.deepEqual(screens.map(s=>s.seconds),[20,25,30,25,30,30,25]);
 assert.match(script,/setInterval\(advanceRotation,1000\)/);
 assert.match(script,/if\(action==='toggle-rotation'\)/);
 assert.match(script,/if\(action==='next-screen'\)/);
 assert.match(script,/if\(action==='previous-screen'\)/);
 assert.match(css,/tv-four-grid/);
});
test('alerta informa código do pedido, tipo de destino, nome, produto e diferença',()=>{
 const {shell,state,root}=makeDashboard();
 state.snapshot=mock;state.management=management;state.lastSuccess=Date.now();
 state.nextSwap=Date.now()+20000;
 shell(mock);
 assert.match(root.innerHTML,/AB123/);
 assert.match(root.innerHTML,/Franquia Centro/);
 assert.match(root.innerHTML,/Produto não encontrado na separação/);
 assert.match(root.innerHTML,/Camiseta HDH/);
 assert.match(root.innerHTML,/10 \/ Identificado 8/);
});
test('qualquer texto da ocorrência é escapado para não injetar código na TV',()=>{
 const {shell,state,root}=makeDashboard();
 state.management={...management,issues:[{...management.issues[0],destination:'<script>alert(99)</script>'}]};
 state.snapshot=mock;state.lastSuccess=Date.now();shell(mock);
 assert.doesNotMatch(root.innerHTML,/<script>alert\(99\)<\/script>/);
 assert.match(root.innerHTML,/&lt;script&gt;alert/);
});
test('painel organiza estoque, franquias, eventos, avarias, categorias e comparativos',()=>{
 const {shell,state,root}=makeDashboard();
 state.management=management;state.snapshot=mock;state.lastSuccess=Date.now();
 const expected=[
  '10 produtos com menor estoque','Franquia Centro','Feira 2026',
  'Feira encerrada','Avarias por categoria','Compras e abastecimento'
 ];
 for(let i=1;i<7;i++){
  state.pageIndex=i;shell(mock);
  assert.match(root.innerHTML,new RegExp(expected[i-1]));
  if(i===5)assert.match(root.innerHTML,/tv-compare-bars/);
 }
});
test('gestão 360 restringe o snapshot, não usa dados pessoais nem confunde venda com não devolução',()=>{
 assert.match(managementSQL,/p\.role in \('admin','gerente'\)/);
 assert.match(managementSQL,/security definer/);
 assert.match(managementSQL,/revoke all on function public\.tv_management_snapshot/);
 assert.doesNotMatch(managementSQL,/customer_name|customer_phone|manager_name|s\.phone/);
 assert.match(managementSQL,/public\.unified_order_adjustments/);
 assert.match(managementSQL,/order_public_codes/);
 assert.match(managementSQL,/event_in_progress/);
 assert.match(managementSQL,/event_closed/);
 assert.match(managementSQL,/damage_agg/);
 assert.match(managementSQL,/demand_agg/);
 assert.match(script,/Não devolvido não equivale a venda confirmada/);
});
