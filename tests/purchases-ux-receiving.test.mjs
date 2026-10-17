import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source=await read('src/cdsb-purchases.js');
const app=await read('src/app.js');
const migration=await read('supabase/migrations/20261017170000_purchase_receipts_atomic.sql');
const {purchasesPage,purchasePendingByProduct,purchaseSuggestions,filterPurchaseGroups,purchasingGroups}=
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const p=[
 {id:'sku-p',name:'Camiseta P',apparel_model_id:'model',apparel_size:'P',active:true,supplier_id:'s1',min_stock:10},
 {id:'sku-m',name:'Camiseta M',apparel_model_id:'model',apparel_size:'M',active:true,supplier_id:'s1',min_stock:10},
 {id:'sku-x',name:'Outro produto',active:true,supplier_id:null,min_stock:3}
];
const models=[{id:'model',name:'CAMISETA AVIVA'}];
const suppliers=[{id:'s1',name:'Fornecedor A',active:true}];
const balances=[{event_id:null,product_id:'sku-p',quantity:3},
 {event_id:null,product_id:'sku-m',quantity:35}];
const btn=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const view=(tab,catalog={onlyReplenishment:true,sort:'priority'},orders=[],items=[])=>purchasesPage({
 products:p,models,suppliers,balances,catalog,orders,items,tab,button:btn,tasksHTML:'<section>Tarefas internas</section>'
});
test('quatro abas separadas e catálogo só na reposição',()=>{
 const repos=view('reposicao');
 assert.match(repos,/data-action="buy-tab"/);
 assert.equal((repos.match(/class="buy-group-card"/g)||[]).length,2);
 assert.match(repos,/data-action="buy-suggest-group"/);
 assert.match(repos,/7 variação\(ões\)|1 variação\(ões\)/);
 assert.match(repos,/data-buy-only-replenishment/);
 assert.doesNotMatch(repos,/Tarefas internas/);
 assert.match(view('pedidos'),/Pedidos de compra · fornecedores/);
 assert.doesNotMatch(view('pedidos'),/class="buy-group-card"/);
 assert.match(view('acompanhamento'),/Tarefas internas/);
 assert.match(view('fornecedores'),/Novo fornecedor/);
});
test('filtro de reposição respeita necessidade por SKU, não pelo modelo agregado',()=>{
 const groups=purchasingGroups(p,models,balances,[],[],[]);
 assert.equal(filterPurchaseGroups(groups,{onlyReplenishment:true,sort:'priority'}).length,2);
 assert.equal(filterPurchaseGroups(groups,{missingSupplier:true},[]).length,1);
 assert.equal(filterPurchaseGroups(groups,{supplier:'s1'},[]).length,1);
});
test('compra parcialmente recebida mantém somente saldo não entregue a caminho',()=>{
 const orders=[{id:'pc',status:'recebido_parcial',number:7}];
 const items=[{purchase_order_id:'pc',product_id:'sku-p',quantity:9,received_quantity:4}];
 assert.equal(purchasePendingByProduct(orders,items).get('sku-p').quantity,5);
 assert.equal(purchaseSuggestions(p,balances,[],orders,items).find(x=>x.id==='sku-p')?.suggested,2);
});
test('recebimento atômico vincula lote físico, rastreabilidade e anti-duplicidade',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public.purchase_receipts/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public.purchase_receipt_items/);
 assert.match(migration,/received_quantity=received_quantity\+v_qty/);
 assert.match(migration,/public.stock_operation_batch\('entrada'/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/request_digest IS DISTINCT FROM v_digest/);
 assert.match(migration,/status=v_status/);
 assert.match(migration,/NOT IN \('enviado','recebido_parcial'\)/);
 assert.doesNotMatch(migration,/UPDATE public.store_orders/);
 assert.match(app,/function purchaseReceiptModal\(order\)/);
 assert.match(app,/db.rpc\('receive_purchase_order'/);
 assert.match(app,/data-receive-item/);
});
