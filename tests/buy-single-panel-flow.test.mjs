import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [app,css,entry,index]=await Promise.all([
 read('src/app.js'),read('buy-purchase-drawer.css'),
 read('src/secure-entry.js'),read('index.html')
]);
test('botão Adicionar ao pedido não abre outra janela/modal',()=>{
 assert.match(app,/if\(action==='buy-add-to-draft'\)return purchaseDraftTargetModal\(target\.dataset\.group\)/);
 assert.match(app,/function purchaseDraftTargetModal\(groupKey\)/);
 assert.match(app,/data-buy-draft-target/);
 assert.match(app,/data-form="buy-add-draft"/);
 assert.match(app,/data-action="buy-draft-target-back"/);
 assert.match(app,/selectField\('Em qual pedido adicionar\?'/);
 assert.doesNotMatch(app,/formModal\('Adicionar ao pedido/);
 assert.doesNotMatch(app,/closePurchaseDrawer\(false\);\s*return purchaseDraftTargetModal/);
});
test('resumo de variações, fornecedor e mínimo aparecem no mesmo painel',()=>{
 assert.match(app,/const chosen=group\.variants\.filter\(p=>state\.purchaseCart\.has\(p\.id\)\)/);
 assert.match(app,/const lines=chosen\.map\(p=>\{/);
 assert.match(app,/buy-draft-inline-row/);
 assert.match(app,/minimum_order_quantity/);
 assert.match(app,/drafts\.length===1\?drafts\[0\]\.id:'novo'/);
 assert.match(app,/function updatePurchaseCartDisplay\(/);
});
test('salvamento preserva painel e retorna confirmação nele próprio',()=>{
 assert.match(app,/assertOk\(await db\.rpc\('create_supplier_purchase_draft'/);
 assert.match(app,/assertOk\(await db\.rpc\('add_purchase_draft_items'/);
 assert.match(app,/buy-draft-inline-success/);
 assert.match(app,/Continuar comprando/);
 assert.match(app,/updatePurchaseCartDisplay\(\)/);
 const relevant=app.slice(app.indexOf("if(type==='buy-add-draft'){"),app.indexOf("if(type==='buy-draft-readonly')"));
 assert.doesNotMatch(relevant,/closeTopModal\(\)/);
 assert.doesNotMatch(relevant,/await loadData\(\)/);
});
test('painel reutiliza padrão visual direito e folha inferior do CDSB',()=>{
 assert.match(app,/overlay\.className='modalback buy-drawer-backdrop'/);
 assert.match(css,/\.buy-drawer-backdrop\.modalback\{display:flex!important;flex-direction:row!important/);
 assert.match(css,/width:min\(580px,100vw\)/);
 assert.match(css,/height:min\(91dvh,960px\)/);
 assert.match(app,/className='buy-drawer-product-info'/);
 assert.doesNotMatch(app,/const head=card\.querySelector\('\.buy-group-head'\)\?\.cloneNode\(true\)/);
 assert.match(css,/\.buy-drawer-backdrop \.buy-drawer \.buy-drawer-product-info\{/);
});
test('CSS e JS novos têm cache atualizado',()=>{
 assert.match(index,/buy-purchase-drawer\.css\?v=20261018sheetformat1/);
 assert.match(index,/secure-entry\.js\?v=20261022variationcoverage1/);
 assert.match(entry,/app\.js\?v=20261022variationcoverage1/);
});
