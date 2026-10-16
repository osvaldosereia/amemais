import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=new URL('../src/store-hub.js',import.meta.url);
const moduleSource=await readFile(path,'utf8');
const {renderStoreHub,locationOrders}=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
const btn=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const ctx={button:btn,canBrowseOrders:true,canOpenEvent:true,canManageStores:true,canManageEvent:true,showCentral:true,showFranchises:true,showBranches:true,showEvents:true,canSeeStore:()=>true,canSeeEvent:()=>true,time:x=>x,
 storeBalances:[{store_id:'cristo',product_id:'sku',quantity:8}],eventBalances:[{event_id:'ev1',product_id:'sku',quantity:4}]};
const stores=[{id:'cd',is_primary:true,kind:'central',name:'CDSB'},{id:'cristo',code:'CRISTOREICBA',ownership_type:'propria',kind:'filial',name:'Cristo Rei',active:true},{id:'fr1',kind:'franquia',name:'Franquia A',active:true}];
const events=[{id:'ev1',name:'Evento A',status:'rascunho',starts_at:'2026-10-17',cover_path:'capa.png'}];
const orders=[{id:'req1',kind:'evento',eventId:'ev1',status:'separado',total:2,created_at:'2026-10-16',code:'AA003',raw:{}}];
test('lista compacta abre unidade sem fila interna redundante',()=>{
 const html=renderStoreHub({stores,events,orders,context:ctx});
 assert.equal((html.match(/data-action="store-unit-open"/g)||[]).length,3);
 assert.doesNotMatch(html,/Pedidos para acompanhar e separar|Fila de separação/);
 assert.doesNotMatch(html,/CDSB<\/h3>/);
 assert.match(html,/data-store-hub-search/);
 assert.match(html,/data-store-hub-type/);
});
test('indicadores mostram saldo apenas para unidades com estoque controlado',()=>{
 const html=renderStoreHub({stores,events,orders,context:ctx});
 assert.match(html,/8 un/);
 assert.match(html,/4 un/);
 const franchise=html.match(/<article[^>]+data-location="store-fr1"[^>]*>([\s\S]*?)<\/article>/)?.[1];
 assert.ok(franchise);
 assert.doesNotMatch(franchise,/Estoque físico/);
});
test('pesquisa e filtros usam atributos estruturados e sem HTML de nomes',()=>{
 const html=renderStoreHub({stores:[...stores,{id:'inject',name:'<script>alert(1)</script>',kind:'franquia',active:false}],events,orders,context:ctx});
 assert.match(html,/data-store-hub-status="inactive"/);
 assert.doesNotMatch(html,/<script>/);
});
test('eventos não transformam separados em conferidos',()=>{
 const html=renderStoreHub({stores,events,orders,context:ctx});
 assert.doesNotMatch(html,/2 un. conferidas/);
 assert.match(html,/A conferir|Em andamento|Pedido/);
});
test('pedidos filtrados incluem pedidos da própria unidade, inclusive históricos',()=>{
 assert.equal(locationOrders(orders,{type:'event',id:'ev1'}).length,1);
 assert.equal(locationOrders(orders,{type:'store',id:'fr1'}).length,0);
});
