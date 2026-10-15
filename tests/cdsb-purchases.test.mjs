import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/cdsb-purchases.js',import.meta.url),'utf8');
const {purchaseSuggestions,purchasesPage,purchaseOrderDocument,replenishmentDocument,purchaseOrderRows}=
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const products=[
 {id:'cam-p',active:true,name:'Camiseta',apparel_size:'P',sku:'P1',min_stock:12,supplier_id:'s1'},
 {id:'cam-m',active:true,name:'Camiseta',apparel_size:'M',sku:'M1',min_stock:8,supplier_id:'s1'},
 {id:'cam-g',active:true,name:'Camiseta',apparel_size:'G',sku:'G1',min_stock:4,supplier_id:null},
 {id:'cam-gg',active:true,name:'Camiseta',apparel_size:'GG',sku:'GG1',min_stock:0,supplier_id:'s1'}
];
const balances=[
 {event_id:null,product_id:'cam-p',quantity:14},
 {event_id:null,product_id:'cam-m',quantity:3},
 {event_id:'evento',product_id:'cam-g',quantity:10}
];
const reservations=[{product_id:'cam-p',quantity:7,status:'ativa'},{product_id:'cam-m',quantity:1,status:'ativa'}];
const supplier={id:'s1',name:'Fábrica São Bento',active:true,phone:'6599999'};
const orders=[{id:'o1',number:1,supplier_id:'s1',status:'enviado',created_at:'2026-10-15T12:00:00Z'}];
const orderItems=[{id:'i1',purchase_order_id:'o1',product_id:'cam-p',quantity:2,product_name:'Camiseta',sku:'P1'}];
test('sugestões usam livre físico menos reservas e menos compras abertas',()=>{
 const suggested=purchaseSuggestions(products,balances,reservations,orders,orderItems);
 assert.deepEqual(suggested.map(x=>[x.id,x.suggested]),[['cam-m',6],['cam-g',4],['cam-p',3]]);
 assert.equal(suggested.find(x=>x.id==='cam-p').available,7);
 assert.equal(suggested.find(x=>x.id==='cam-p').ordered,2);
 assert.equal(suggested.find(x=>x.id==='cam-g').physical,0);
});
test('compra finalizada ou cancelada não suprime sugestão de reposição',()=>{
 const finalized=[{...orders[0],status:'finalizado'}];
 assert.equal(purchaseSuggestions(products,balances,reservations,finalized,orderItems)
   .find(x=>x.id==='cam-p').suggested,5);
});
test('compras em aberto não geram estoque nem reservam mercadoria',()=>{
 const original=JSON.stringify(balances);
 purchaseSuggestions(products,balances,reservations,orders,orderItems);
 assert.equal(JSON.stringify(balances),original);
});
test('tela do comprador possui seletores, fornecedor e impressão de relatório',()=>{
 const html=purchasesPage({products,suppliers:[supplier],balances,reservations,
  orders,items:orderItems,button:(label,action,attrs='')=>
   '<button data-action="'+action+'" '+attrs+'>'+label+'</button>'});
 assert.match(html,/data-action="buy-new"/);
 assert.match(html,/data-action="buy-suppliers"/);
 assert.match(html,/data-action="buy-print-alerts"/);
 assert.match(html,/Fábrica São Bento/);
 const rows=purchaseOrderRows(products,[supplier],balances,reservations,orders,orderItems);
 assert.match(rows,/data-product="cam-p"/);
 assert.doesNotMatch(rows,/data-product="cam-g"/); // sem fornecedor padrão
});
test('pedido de compra A4 e relatório de reposição prontos para impressão',()=>{
 const purchase=purchaseOrderDocument(orders[0],supplier,orderItems);
 assert.match(purchase,/CENTRO DE DISTRIBUIÇÃO SÃO BENTO/);
 assert.match(purchase,/Fábrica São Bento/);
 assert.match(purchase,/Camiseta/);
 assert.match(purchase,/window.print/);
 assert.match(purchase,/Não comprova entrada no estoque/);
 const report=replenishmentDocument(purchaseSuggestions(products,balances,reservations,orders,orderItems),[supplier]);
 assert.match(report,/Relatório de reposição/);
 assert.match(report,/SEM FORNECEDOR/);
 assert.match(report,/window.print/);
});
