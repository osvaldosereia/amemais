import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('src/cdsb-purchases.js');
const app=await read('src/app.js');
const css=await read('buy-one-panel.css');
const migration=await read('supabase/migrations/20261017175111_purchase_drafts_supplier_minimum_20261017.sql');
const {purchasesPage,purchasingGroups}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const products=['P','M','G'].map((name,i)=>({id:'p'+i,name:'CAMISETA',
 apparel_model_id:'model1',apparel_size:name,sku:'SKU-'+name,min_stock:5,
 minimum_order_quantity:[12,3,6][i],category_id:'cat',supplier_id:'s1',active:true}));
const args={products,models:[{id:'model1',name:'CAMISETA AVIVA',image_path:'foto.webp'}],
 suppliers:[{id:'s1',name:'Fornecedor',active:true}],categories:[{id:'cat',name:'Camisetas'}],
 balances:[{product_id:'p0',quantity:0},{product_id:'p1',quantity:9},{product_id:'p2',quantity:1}],
 catalog:{onlyReplenishment:true,sort:'priority'},
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>'};
test('card só tem Abrir compra, sem Usar sugestões ou Conferir/Revisar pedido',()=>{
 const page=purchasesPage(args);
 assert.equal((page.match(/data-action="buy-open-group"/g)||[]).length,1);
 assert.doesNotMatch(page,/data-action="buy-suggest-group"/);
 assert.doesNotMatch(page,/data-action="buy-product-report"/);
 assert.doesNotMatch(page,/Revisar seleção|Revisar pedido/);
 assert.match(page,/data-action="buy-add-to-draft"/);
 assert.match(page,/Adicionar ao pedido/);
 assert.match(page,/data-buy-outflow=/);
});
test('quantidades iniciais vêm do pedido mínimo do fornecedor, não do estoque mínimo',()=>{
 const page=purchasesPage({...args,expanded:new Set(['model:model1'])});
 assert.match(page,/data-buy-inline-qty data-product="p0" value="12"/);
 assert.match(page,/data-buy-inline-qty data-product="p1" value="3"/);
 assert.match(page,/data-buy-inline-qty data-product="p2" value="6"/);
 assert.match(page,/Pedido mínimo <b>12/);
 assert.match(page,/Pedido mínimo <b>3/);
 assert.match(page,/Pedido mínimo <b>6/);
 assert.match(app,/function prefillPurchaseMinimums/);
 assert.match(app,/if\(!shortage\|\|!variant.supplier_id\|\|state.purchaseCart.has\(variant.id\)\)continue/);
 assert.match(app,/minimum_order_quantity/);
});
test('pedido recebe itens selecionados em rascunho do mesmo fornecedor, com autorização',()=>{
 assert.match(app,/function purchaseDraftTargetModal/);
 assert.match(app,/formModal\('Adicionar ao pedido/);
 assert.match(app,/supplierIds.length!==1/);
 assert.match(app,/create_supplier_purchase_draft/);
 assert.match(app,/add_purchase_draft_items/);
 assert.match(migration,/status<>'rascunho'/);
 assert.match(migration,/p\.supplier_id|v_product\.supplier_id/);
 assert.match(migration,/ON CONFLICT \(purchase_order_id,product_id\) DO UPDATE/);
 assert.doesNotMatch(migration,/UPDATE public.store_orders|UPDATE public.stock_balances/);
});
test('revisão e PDF são feitos dentro do pedido, sem nova etapa e sem envio fictício',()=>{
 assert.match(app,/function purchaseDraftDetails/);
 assert.match(app,/data-draft-qty/);
 assert.match(app,/buy-draft-confirm/);
 assert.match(app,/confirm_supplier_purchase_draft/);
 assert.match(app,/p_items:edited/);
 assert.match(app,/downloadBuyOrder\(fresh,items\)/);
 assert.match(app,/buy-draft-mark-sent/);
 assert.match(app,/não transmite mensagens|não envia mensagens automaticamente/);
 assert.match(migration,/PUBLIC,anon/);
});
test('mesmo modelo com fornecedores diferentes não mistura pedidos',()=>{
 const split=purchasingGroups(products.map((p,i)=>({...p,supplier_id:i===2?'s2':'s1'})),args.models,args.balances,[],[],[]);
 assert.equal(split.length,2);
 assert.equal(split.find(g=>g.supplier_id==='s1').variants.length,2);
 assert.equal(split.find(g=>g.supplier_id==='s2').variants.length,1);
});
test('MOQ possui constraint própria diferente de min_stock',()=>{
 assert.match(migration,/ADD COLUMN IF NOT EXISTS minimum_order_quantity integer NOT NULL DEFAULT 1/);
 assert.match(migration,/minimum_order_quantity BETWEEN 1 AND 1000000/);
 assert.match(migration,/PURCHASE_DRAFT_ITEMS_ADDED/);
 assert.match(migration,/PURCHASE_DRAFT_READY_TO_SEND/);
 assert.match(app,/Pedido mínimo do fornecedor por variação/);
 assert.match(app,/minimum_order_quantity:minimumOrderQuantity/);
});
test('botão único mantém altura uniforme no desktop e mobile',()=>{
 assert.match(css,/buy-quick-card \.buy-card-toolbar/);
 assert.match(css,/grid-template-columns:minmax\(142px,212px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});
