import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/store-hub.js',import.meta.url),'utf8');
const hub=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sample=[
{id:'avulso-1',kind:'avulso',status:'reservado',created_at:'2026-10-15',raw:{},total:4},
{id:'store-1',kind:'loja',status:'separado',created_at:'2026-10-14',raw:{from_store_id:'central',to_store_id:'fran-a'},total:6},
{id:'store-2',kind:'loja',status:'recebido',created_at:'2026-10-13',raw:{from_store_id:'central',to_store_id:'fran-a'},total:6},
{id:'event-1',kind:'evento',eventId:'event-a',status:'aguardando',created_at:'2026-10-11',raw:{event_id:'event-a'},total:3},
{id:'event-2',kind:'evento',eventId:'event-a',status:'enviado',created_at:'2026-10-10',raw:{event_id:'event-a'},total:2}
];
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const ctx={button,time:x=>x,canManageStores:true,canManageEvent:true,canBrowseOrders:true,canOpenEvent:true,
 showCentral:true,showFranchises:true,showEvents:true,showBranches:true,canSeeStore:()=>true,canSeeEvent:()=>true};
test('somente pedidos da unidade são incluídos no escopo',()=>{
 assert.equal(hub.locationOrders(sample,{type:'central',id:'central'}).length,5);
 assert.equal(hub.locationOrders(sample,{type:'store',id:'fran-a'}).length,2);
 assert.equal(hub.locationOrders(sample,{type:'event',id:'event-a'}).length,2);
 assert.equal(hub.locationOrders(sample,{type:'store',id:'inexistente'}).length,0);
 assert.equal(hub.locationOrders(sample,{type:'event',id:'event-a'},'pending').length,1);
 assert.equal(hub.locationOrders(sample,{type:'event',id:'event-a'},'history').length,1);
});
test('não exibe o centro de distribuição como loja e exibe Cristo Rei uma vez',()=>{
 const html=hub.renderStoreHub({stores:[{id:'cdsb',kind:'central',name:'CDSB',is_primary:true},
 {id:'cristo',kind:'filial',ownership_type:'propria',code:'CRISTOREICBA',name:'Loja Cristo Rei',active:true},
 {id:'fran-a',kind:'franquia',name:'Franquia A',active:true}],events:[{id:'event-a',name:'Evento A',status:'rascunho'}],orders:sample,context:ctx});
 assert.match(html,/Loja Cristo Rei/);
 assert.doesNotMatch(html,/CDSB<\/h3>/);
 assert.equal((html.match(/Loja Cristo Rei<\/h3>/g)||[]).length,1);
 assert.match(html,/data-location="store-cristo"/);
 assert.match(html,/data-location="event-event-a"/);
 assert.doesNotMatch(html,/Pedidos para acompanhar e separar/);
});
test('franqueado só vê sua unidade vinculada',()=>{
 const html=hub.renderStoreHub({stores:[{id:'fran-a',kind:'franquia',name:'Franquia A',active:true},
 {id:'fran-b',kind:'franquia',name:'Franquia B',active:true}],orders:sample,
 context:{...ctx,portal:true,showCentral:false,showEvents:false,canManageStores:false,canSeeStore:s=>s.id==='fran-a'}});
 assert.match(html,/Franquia A/);
 assert.doesNotMatch(html,/Franquia B/);
 assert.equal((html.match(/data-action="store-unit-open"/g)||[]).length,1);
});
test('nomes e capa escapados não injetam HTML ativo',()=>{
 const html=hub.renderStoreHub({stores:[{id:'x',name:'<script>alert(1)</script>',kind:'franquia'}],
 events:[{id:'e',name:'Evento',status:'ativo',cover_path:'" onerror="alert(1)'}],context:ctx});
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/src="[^"]*onerror=/);
});
test('filtro de tipos não modifica lista de pedidos nem estado de outros cards',()=>{
 const cards=[{dataset:{storeHubName:'cristo rei',storeHubType:'propria',storeHubStatus:'active'},hidden:false},
 {dataset:{storeHubName:'franquia azul',storeHubType:'franquia',storeHubStatus:'active'},hidden:false}];
 const b={dataset:{type:'propria'},classList:{toggle:()=>{}},setAttribute:()=>{}};
 const area={querySelectorAll:s=>s.includes('item')?cards:[b],querySelector:()=>({hidden:true})};
 assert.equal(hub.filterStoreHub(area,'cristo','propria','active'),1);
 assert.equal(cards[0].hidden,false);assert.equal(cards[1].hidden,true);
 assert.equal(hub.filterStoreHub(area,'','todas','all'),2);
});
