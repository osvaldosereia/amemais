import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../painel-tv.html',import.meta.url),'utf8');
const css=await readFile(new URL('../tv-dashboard.css',import.meta.url),'utf8');
const script=await readFile(new URL('../src/tv-dashboard.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/20261015_manager_tv_dashboard.sql',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../index.html',import.meta.url),'utf8');

function makeDashboard(){
 const root={innerHTML:''};
 const fakeDocument={querySelector:s=>s==='#tv-app'?root:null,addEventListener:()=>{}};
 const fakeWindow={AME_CONFIG:{},addEventListener:()=>{}};
 const source=script.replace(/^import [^\n]+\n/,'')
  .replace(/boot\(\)\.catch\([\s\S]*$/,'');
 const {shell,state}=new Function('document','window',source+
  '\nreturn {shell,state};')(fakeDocument,fakeWindow);
 return {shell,state,root};
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
 assert.match(page,/tv-dashboard\.js\?v=20261015tv1/);
 assert.match(page,/tv-dashboard\.css\?v=20261015tv1/);
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
 assert.match(entry,/src\/app\.js\?v=20261015tv1/);
});
