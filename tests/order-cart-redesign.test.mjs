import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/order-cart.js',import.meta.url),'utf8');
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const variants=[
 {id:'p1',name:'Camiseta HDH preta',apparel_model_id:'m1',apparel_size:'P',apparel_color:'Preta',sku:'SKU-P',ean:'789001',active:true},
 {id:'p2',name:'Camiseta HDH preta',apparel_model_id:'m1',apparel_size:'M',apparel_color:'Preta',sku:'SKU-M',ean:'789002',active:true},
 {id:'p3',name:'Terço',sku:'TER',active:true},
 {id:'inactive',name:'Inativo',active:false}
];
const models=[{id:'m1',name:'Camiseta HDH preta'}];
test('catálogo agrupa variações por modelo e ignora inativos',()=>{
 const groups=api.makeOrderCatalog(variants,models,()=>15,()=>2);
 assert.equal(groups.length,2);
 const m=groups.find(g=>g.key==='m1');
 assert.deepEqual(m.variants.map(v=>v.id),['p2','p1'].sort((a,b)=>['p2','p1'].indexOf(a)-['p2','p1'].indexOf(b))); // ids independem da ordem
 assert.equal(m.variants.length,2);
 assert.equal(groups.some(g=>g.variants.some(v=>v.id==='inactive')),false);
});
test('totais preservam quantidades solicitadas mesmo quando superiores à disponibilidade',()=>{
 const groups=api.makeOrderCatalog(variants,models,p=>p.id==='p1'?3:10,()=>2);
 const summary=api.orderCartSummary(groups,new Map([['p1',8],['p2',2]]));
 assert.equal(summary.models,1);
 assert.equal(summary.skus,2);
 assert.equal(summary.units,10);
 assert.equal(summary.available,5);
 assert.equal(summary.missing,5);
});
test('busca identifica nome de modelo, SKU, EAN e tamanho sem truncar catálogo',()=>{
 const groups=api.makeOrderCatalog(variants,models,()=>10,()=>1);
 assert.equal(api.searchOrderCatalog(groups,'789002').length,1);
 assert.equal(api.searchOrderCatalog(groups,'sku-p').length,1);
 assert.equal(api.searchOrderCatalog(groups,'terço').length,1);
 assert.equal(api.searchOrderCatalog(groups,'modelo inexistente').length,0);
});
test('montagem apresenta quantidades e resumo sem selecionar loja novamente',()=>{
 const groups=api.makeOrderCatalog(variants,models,()=>10,()=>1);
 const html=api.orderCartMarkup(groups,{destination:'Franquia Teste'});
 assert.match(html,/Franquia Teste/);
 assert.match(html,/data-order-cart-search/);
 assert.match(html,/data-order-cart-results/);
 assert.match(html,/data-order-cart-summary/);
 assert.doesNotMatch(html,/name="to_store_id"/);
});
test('revisão destaca destino, SKUs, unidades e falta sem confundir reserva com expedição',()=>{
 const groups=api.makeOrderCatalog(variants,models,p=>p.id==='p1'?1:8,()=>1);
 const markup=api.orderCartReview(groups,new Map([['p1',4]]),'Franquia Teste');
 assert.match(markup,/Franquia Teste/);
 assert.match(markup,/4 unidades/);
 assert.match(markup,/3 unidades faltantes/);
 assert.match(markup,/SKU-P/);
 assert.doesNotMatch(markup,/estoque transferido|pedido em lotes/i);
});
test('código de integração exige revisão confirmada antes de gravar com RPC existente',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/if\(type==='store-order-create'\)[\s\S]*?confirmOrderCartReview/);
 assert.match(app,/if\(type==='event-batch-write'\)[\s\S]*?confirmEventOrderReview/);
 assert.match(app,/create_store_order/);
 assert.match(app,/create_event_pick_batch/);
});
