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
 const {shell,state,screens,nextScreen,niceDate}=new Function('document','window',source+
  '\nreturn {shell,state,screens,nextScreen,niceDate};')(fakeDocument,fakeWindow);
 return {shell,state,screens,nextScreen,niceDate,root};
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
 assert.match(page,/tv-dashboard\.js\?v=\d{8}[a-z0-9]+/);
 assert.match(page,/tv-dashboard\.css\?v=20261016tvone2/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-rows:minmax/);
 assert.match(script,/timer=setInterval\(refresh,30000\)/);
 assert.match(script,/requestFullscreen\(\)/);
 assert.match(script,/getUser\(\)/);
 assert.match(script,/db\.rpc\('tv_operations_snapshot'\)/);
});
test('os 12 cards ficam visíveis na mesma tela, com mini botões abrir',()=>{
 const {shell,state,root}=makeDashboard();
 state.lastSuccess=Date.now();state.snapshot=mock;state.management=management;
 shell(mock);
 const titles=['Fila prioritária','Ocorrências identificadas','Avarias',
  '10 produtos com menor estoque','10 produtos com maior estoque','Sem pedidos há +90 dias',
  'Produtos mais pedidos','Franquias','Categorias','Próximos eventos','Eventos encerrados',
  'Compras e produtividade'];
 for(const name of titles)assert.ok(root.innerHTML.includes(name),name);
 assert.equal((root.innerHTML.match(/data-action="open-detail"/g)||[]).length,12);
 assert.match(root.innerHTML,/AA003/);
 assert.match(root.innerHTML,/Sem estoque/);
 assert.doesNotMatch(root.innerHTML,/telefone|customer_phone/i);
});
test('informações em HTML são escapadas e relatório vazio é identificado',()=>{
 const {shell,state,root}=makeDashboard();
 state.lastSuccess=Date.now();state.snapshot=mock;state.management=management;
 shell({...mock,priority:[{...mock.priority[0],destination:'<script>alert(1)</script>'}]});
 assert.doesNotMatch(root.innerHTML,/<script>alert\(1\)<\/script>/);
 assert.match(root.innerHTML,/&lt;script&gt;/);
 assert.match(root.innerHTML,/Nenhum produto encontrado/);
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
test('tela única substitui a rotação automática e preserva atualização a cada 30 segundos',()=>{
 assert.match(css,/tv-one-grid/);
 assert.match(css,/tv-one-header/);
 assert.match(script,/timer=setInterval\(refresh,30000\)/);
 assert.doesNotMatch(script,/rotationTimer=setInterval/);
 assert.match(script,/db\.rpc\('tv_product_rankings'\)/);
 assert.match(script,/data-action="open-detail"/);
 assert.match(script,/data-action="close-detail"/);
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
 assert.match(root.innerHTML,/Solicitado 10 · Identificado 8/);
});
test('qualquer texto da ocorrência é escapado para não injetar código na TV',()=>{
 const {shell,state,root}=makeDashboard();
 state.management={...management,issues:[{...management.issues[0],destination:'<script>alert(99)</script>'}]};
 state.snapshot=mock;state.lastSuccess=Date.now();shell(mock);
 assert.doesNotMatch(root.innerHTML,/<script>alert\(99\)<\/script>/);
 assert.match(root.innerHTML,/&lt;script&gt;alert/);
});
test('os relatórios detalhados usam o padrão de gaveta do sistema',()=>{
 const {shell,state,root}=makeDashboard();
 state.management=management;state.snapshot=mock;state.lastSuccess=Date.now();
 state.detailReport='franchises';shell(mock);
 assert.match(root.innerHTML,/role="dialog"/);
 assert.match(root.innerHTML,/Franquia Centro/);
 assert.match(root.innerHTML,/data-action="close-detail"/);
 assert.match(root.innerHTML,/Abrir sistema/);
 state.detailReport='categories';shell(mock);
 assert.match(root.innerHTML,/Camisetas/);
 assert.match(root.innerHTML,/140/);
});
test('rankings apresentam maiores, mais solicitados e parados sem confundir com vendas',()=>{
 const {shell,state,root}=makeDashboard();
 state.snapshot=mock;state.management=management;state.lastSuccess=Date.now();
 state.rankings={top_stock:[{name:'Camiseta HDH',sku:'SKU-5',available:100,physical:102}],
  most_ordered:[{name:'Boné HDH',sku:'SKU-6',requested_30d:60,available:10}],
  dormant:[{name:'Calça social',sku:'SKU-7',days_without_order:130,available:9}]};
 shell(mock);
 for(const x of ['100','Boné HDH','60','Calça social','130'])assert.match(root.innerHTML,new RegExp(x));
 assert.doesNotMatch(root.innerHTML,/Tendência de demanda · 14 dias/);
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

test('datas do calendário de eventos respeitam Cuiabá sem recuar um dia',()=>{
 const {niceDate}=makeDashboard();
 assert.match(niceDate('2026-10-20'),/20/);
 assert.match(managementSQL,/America\/Cuiaba/);
});

test('ranking de 90 dias filtra estoques não disponíveis e produtos novos',async()=>{
 const rankingSQL=await readFile(new URL('../supabase/migrations/202610160005_tv_product_rankings.sql',import.meta.url),'utf8');
 assert.match(rankingSQL,/created_at<now\(\)-interval '90 days'/);
 assert.match(rankingSQL,/last_order_at<now\(\)-interval '90 days'/);
 assert.match(rankingSQL,/available>0/);
 assert.match(rankingSQL,/tv_product_rankings/);
 assert.match(rankingSQL,/p\.role in \('admin','gerente'\)/);
 assert.match(rankingSQL,/revoke all on function public\.tv_product_rankings/);
 assert.doesNotMatch(rankingSQL,/customer_name|customer_phone/);
});
