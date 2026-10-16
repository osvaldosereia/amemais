import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const buy=await read('src/cdsb-purchases.js'),db=await read('supabase/migrations/20261016_purchase_eta_tv.sql');
const app=await read('src/app.js'),tv=await read('src/tv-dashboard.js');
const pdf=await read('src/purchase-pdf.js');
const importPurchase=()=>import('data:text/javascript;base64,'+Buffer.from(buy).toString('base64'));
test('apenas encomendas confirmadas aparecem a caminho (rascunhos não contam)',async()=>{
 const {purchasePendingByProduct}=await importPurchase();
 const orders=[{id:'a',number:1,status:'rascunho',expected_arrival_date:'2026-11-02'},
 {id:'b',number:2,status:'enviado',expected_arrival_date:'2026-11-03'},
 {id:'c',number:3,status:'finalizado',expected_arrival_date:'2026-11-01'}];
 const items=orders.map(o=>({purchase_order_id:o.id,product_id:'p',quantity:3}));
 assert.deepEqual(purchasePendingByProduct(orders,items).get('p').quantity,3);
});
test('compras agrupadas por modelo e variações com fotos e controle explícito de seleção',async()=>{
 const {purchasesPage,purchaseOrderRows}=await importPurchase();
 const products=[{id:'p1',active:true,name:'CAMISETA',apparel_model_id:'m',apparel_size:'P',supplier_id:'s',min_stock:5},
 {id:'p2',active:true,name:'CAMISETA',apparel_model_id:'m',apparel_size:'G',supplier_id:'s',min_stock:5}];
 const suppliers=[{id:'s',name:'Fornecedor',active:true}];
 const models=[{id:'m',name:'CAMISETA',image_path:'apparel/m/1.jpg'}];
 const page=purchasesPage({products,models,suppliers,button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>'});
 assert.equal((page.match(/class="buy-group-card"/g)||[]).length,1);
 assert.match(page,/data-photo-path="apparel\/m\/1.jpg"/);
 assert.match(page,/Relatório de saídas/);
 const form=purchaseOrderRows(products,suppliers,[],[],[],[],models);
 assert.equal((form.match(/class="buy-cart-group"/g)||[]).length,1);
 assert.equal((form.match(/data-buy-select/g)||[]).length,2);
});
test('compra confirma dias corridos e permite ajustar previsão sem alterar estoque',()=>{
 assert.match(db,/ADD COLUMN IF NOT EXISTS estimated_days/);
 assert.match(db,/ADD COLUMN IF NOT EXISTS expected_arrival_date/);
 assert.match(db,/CREATE OR REPLACE FUNCTION public\.save_purchase_order_with_eta/);
 assert.match(db,/CREATE OR REPLACE FUNCTION public\.update_purchase_order_eta/);
 assert.match(db,/AT TIME ZONE 'America\/Cuiaba'/);
 assert.match(db,/PURCHASE_ETA_UPDATED/);
 assert.match(app,/save_purchase_order_with_eta/);
 assert.match(app,/update_purchase_order_eta/);
 assert.match(app,/name="estimated_days"/);
});
test('PDF é download direto com fotos, itens e datas (sem window.print)',()=>{
 assert.match(pdf,/jsPDF/);
 assert.match(pdf,/addImage\(photo,'JPEG'/);
 assert.match(pdf,/createObjectURL/);
 assert.match(pdf,/\.download=filename/);
 assert.match(pdf,/estimated_days/);
 assert.match(pdf,/expected_arrival_date/);
 assert.doesNotMatch(pdf,/window\.print\(\)/);
 assert.match(app,/createPurchasePDF/);
 assert.match(app,/downloadPurchasePDF/);
});
test('TV mostra compras recentes via consulta autorizada e sem edição por fornecedores',()=>{
 assert.match(db,/CREATE OR REPLACE FUNCTION public\.tv_recent_purchase_orders/);
 assert.match(db,/sp\.role IN \('admin','gerente'\)/);
 assert.match(db,/LIMIT 8/);
 assert.match(tv,/tv_recent_purchase_orders/);
 assert.match(tv,/Compras recentes/);
});
test('cards de produtos sinalizam unidades encomendadas e ETA sem somar ao estoque livre',async()=>{
 const workflow=await read('src/stock-workflows.js');
 assert.match(workflow,/Encomendado/);
 assert.match(workflow,/expected_arrival_date|pendingDate/);
 assert.match(app,/purchasePendingByProduct/);
});
