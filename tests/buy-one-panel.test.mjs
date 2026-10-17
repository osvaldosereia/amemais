import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('src/cdsb-purchases.js');
const app=await read('src/app.js');
const css=await read('buy-one-panel.css');
const index=await read('index.html');
const {purchasesPage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const products=['P','M','G'].map((name,i)=>({id:'p'+i,name:'CAMISETA',
 apparel_model_id:'model1',apparel_size:name,sku:'SKU-'+name,min_stock:5,
 category_id:'cat',supplier_id:'s1',active:true}));
const args={
 products,models:[{id:'model1',name:'CAMISETA AVIVA',image_path:'foto.webp'}],
 suppliers:[{id:'s1',name:'Fornecedor',active:true}],categories:[{id:'cat',name:'Camisetas'}],
 balances:[{product_id:'p0',quantity:0},{product_id:'p1',quantity:9},{product_id:'p2',quantity:1}],
 catalog:{onlyReplenishment:true,sort:'priority'},
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>'
};
test('card compacto tem uma única barra de 3 ações padronizadas, sem antigo resumo de variações',()=>{
 const page=purchasesPage(args);
 assert.match(page,/class="buy-group-card buy-quick-card"/);
 assert.match(page,/class="buy-card-toolbar"/);
 assert.equal((page.match(/data-action="buy-open-group"/g)||[]).length,1);
 assert.equal((page.match(/data-action="buy-suggest-group"/g)||[]).length,1);
 assert.equal((page.match(/data-action="buy-product-report"/g)||[]).length,1);
 assert.doesNotMatch(page,/class="buy-group-actions"/);
 assert.match(page,/aria-label="Abrir compra"/);
 assert.match(page,/aria-label="Usar sugestões · 9 un\."/);
 assert.match(page,/aria-label="Ver saídas 30\/90 dias"/);
 assert.match(page,/Categoria<\/small><strong>Camisetas/);
 assert.match(page,/data-buy-picked="model:model1"/);
});
test('abrir compra exibe no mesmo card todas as variações, quantidades, histórico e revisão',()=>{
 const page=purchasesPage({...args,expanded:new Set(['model:model1']),cart:new Map([['p0',5],['p2',4]])});
 assert.match(page,/<details class="buy-variation-disclosure buy-one-panel"[^>]* open>/);
 assert.match(page,/class="buy-panel-history"/);
 assert.match(page,/data-buy-outflow="model:model1"/);
 assert.equal((page.match(/data-buy-inline-select/g)||[]).length,3);
 assert.equal((page.match(/data-buy-inline-qty/g)||[]).length,3);
 assert.match(page,/data-buy-panel-review="model:model1"/);
 assert.match(page,/2 tamanho\(s\) · 9 un\./);
 assert.match(page,/data-buy-panel-total="model:model1">2 tamanho\(s\) · 9 unidades/);
});
test('compra sem seleção só mostra revisão quando existir seleção; SKU sem fornecedor não pode ser pedido',()=>{
 const empty=purchasesPage(args);
 assert.match(empty,/data-buy-panel-review="model:model1" hidden/);
 const noSupplier=purchasesPage({...args,products:products.map(p=>({...p,supplier_id:null}))});
 assert.match(noSupplier,/data-action="buy-suggest-group"[^>]*disabled/);
 assert.match(noSupplier,/data-buy-inline-select[^>]*disabled/);
});
test('histórico de saídas é carregado no painel, com limite e ressalva física; não abre modal',()=>{
 const handler=app.split("if(action==='buy-product-report')")[1].split("if(action==='buy-status')")[0];
 assert.match(handler,/setPurchasePanelOpen\(groupKey,true\)/);
 assert.match(handler,/loadPurchaseOutflow\(groupKey\)/);
 assert.doesNotMatch(handler,/formModal/);
 assert.match(app,/async function loadPurchaseOutflow/);
 assert.match(app,/delta_store.*0/);
 assert.match(app,/\.limit\(3000\)/);
 assert.match(app,/Saídas físicas não são necessariamente vendas/);
 assert.match(app,/function updatePurchaseCartDisplay/);
 assert.match(app,/data-buy-panel-total/);
 assert.match(app,/data-buy-panel-review/);
 assert.match(app,/data-buy-inline-qty/);
});
test('desktop mantém 3 botões com a mesma altura, mobile em uma linha com ícones',()=>{
 assert.match(css,/grid-template-columns:minmax\(146px,1\.14fr\)/);
 assert.match(css,/min-height:43px!important;height:43px!important/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 46px 46px!important/);
 assert.match(css,/\.buy-card-action:not\(\.is-primary\) \.buy-action-label\{display:none!important/);
 assert.match(css,/\.buy-one-panel/);
 const stylesheet=index.match(/<link rel="stylesheet"[^>]+>/g).at(-1);
 assert.match(stylesheet,/buy-one-panel\.css\?v=20261017compras-single1/);
});
