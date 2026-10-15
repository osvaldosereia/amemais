import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/store-hub.js',import.meta.url),'utf8');
const hub=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sample=[
 {id:'avulso-1',kind:'avulso',status:'reservado',created_at:'2026-10-15',origin:'Central',target:'Cliente',raw:{},total:4},
 {id:'store-1',kind:'loja',status:'separado',created_at:'2026-10-14',origin:'Central',target:'Franquia A',raw:{from_store_id:'central',to_store_id:'fran-a'},total:6},
 {id:'store-2',kind:'loja',status:'recebido',created_at:'2026-10-13',origin:'Central',target:'Franquia A',raw:{from_store_id:'central',to_store_id:'fran-a'},total:6},
 {id:'store-3',kind:'loja',status:'solicitado',created_at:'2026-10-12',origin:'Central',target:'Franquia B',raw:{from_store_id:'central',to_store_id:'fran-b'},total:5},
 {id:'event-1',kind:'evento',eventId:'event-a',status:'aguardando',created_at:'2026-10-11',origin:'Central',target:'Evento A',raw:{event_id:'event-a'},total:3,sequence:1},
 {id:'event-2',kind:'evento',eventId:'event-a',status:'enviado',created_at:'2026-10-10',origin:'Central',target:'Evento A',raw:{event_id:'event-a'},total:2,sequence:2},
 {id:'event-3',kind:'evento',eventId:'event-b',status:'cancelado',created_at:'2026-10-09',origin:'Central',target:'Evento B',raw:{event_id:'event-b'},total:2,sequence:1}
];
const ctx={
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 time:x=>x,canBrowseOrders:true,canManageStores:true,canManageEvent:true,canOpenEvent:true,
 showCentral:true,showFranchises:true,showEvents:true,showBranches:false,canSeeStore:()=>true
};
test('central tem fila completa; franquia e evento somente seus próprios pedidos',()=>{
 assert.equal(hub.locationOrders(sample,{type:'central',id:'central'}).length,7);
 assert.equal(hub.locationOrders(sample,{type:'store',id:'fran-a'}).length,2);
 assert.equal(hub.locationOrders(sample,{type:'event',id:'event-a'}).length,2);
 assert.equal(hub.locationOrders(sample,{type:'store',id:'fran-b'}).length,1);
 assert.equal(hub.locationOrders(sample,{type:'event',id:'event-b'}).length,1);
 assert.equal(hub.locationOrders(sample,{type:'store',id:'unknown'}).length,0);
});
test('separa pendentes de histórico incluindo cancelados',()=>{
 assert.deepEqual(hub.locationOrders(sample,{type:'event',id:'event-a'},'pending').map(x=>x.id),['event-1']);
 assert.deepEqual(hub.locationOrders(sample,{type:'event',id:'event-a'},'history').map(x=>x.id),['event-2']);
 assert.deepEqual(hub.locationOrders(sample,{type:'store',id:'fran-a'},'history').map(x=>x.id),['store-2']);
 assert.equal(hub.isHistoricalOrder(sample.at(-1)),true);
});
test('navegação principal mostra central, franquias e temporárias nesta ordem',()=>{
 const html=hub.renderStoreHub({
  stores:[{id:'central',name:'Loja Central',is_primary:true,kind:'central'},
    {id:'fran-a',name:'Franquia A',kind:'franquia',active:true},
    {id:'fran-b',name:'Franquia B',kind:'franquia',active:true}],
  events:[{id:'event-a',name:'Evento A',status:'ativo'},{id:'event-b',name:'Evento B',status:'encerrado'}],
  orders:sample,context:ctx
 });
 const a=html.indexOf('>Loja Central</h2>'),b=html.indexOf('>Franquias</h2>'),c=html.indexOf('>Lojas Temporárias</h2>');
 assert.ok(a>=0&&b>a&&c>b);
 assert.match(html,/data-action="store-hub-open-order"/);
 assert.match(html,/data-action="store-hub-orders"/);
 assert.match(html,/<details class="sh-history">/);
});
test('franqueado vê somente franquias disponíveis e não a central nem temporárias',()=>{
 const html=hub.renderStoreHub({
  stores:[{id:'central',name:'Loja Central',is_primary:true,kind:'central'},
    {id:'fran-a',name:'Franquia A',kind:'franquia'},
    {id:'fran-b',name:'Franquia B',kind:'franquia'}],
  orders:sample,context:{...ctx,portal:true,showCentral:false,showEvents:false,
   canManageStores:false,canManageEvent:false,canSeeStore:s=>s.id==='fran-a'}
 });
 assert.match(html,/Franquia A/);
 assert.doesNotMatch(html,/Franquia B/);
 assert.doesNotMatch(html,/>Loja Central</h2>/);
 assert.doesNotMatch(html,/>Lojas Temporárias</h2>/);
});
test('capa, nomes e informações de unidades são escapados',()=>{
 const html=hub.renderStoreHub({stores:[{id:'x',name:'<script>',kind:'franquia'}],
  events:[{id:'y',name:'Evento',status:'ativo',cover_path:'" onerror="alert(1)'}],
  context:{...ctx,showCentral:false}});
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/src="[^"]*onerror=/);
});
