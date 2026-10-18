import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [buy,cartSource,app,css]=await Promise.all([
 read('src/cdsb-purchases.js'),read('src/purchase-cart.js'),read('src/app.js'),read('buy-purchase-drawer.css')
]);
const {purchasesPage}=await import('data:text/javascript;base64,'+Buffer.from(buy).toString('base64'));
const cart=await import('data:text/javascript;base64,'+Buffer.from(cartSource).toString('base64'));
const products=Array.from({length:75},(_,i)=>({
 id:'sku'+i,name:'PRODUTO '+String(i).padStart(3,'0'),sku:'SKU'+i,
 category_id:'cat',active:true,minimum_order_quantity:2,min_stock:3,
 supplier_id:i===0?null:'s1'
}));
const args={products,suppliers:[{id:'s1',name:'Fornecedor A',active:true}],categories:[{id:'cat',name:'Acessórios'}],
 catalog:{sort:'name-asc'},button:(label,action,attrs='')=>'<button type="button" data-action="'+action+'" '+attrs+'>'+label+'</button>'};
test('catálogo apresenta apenas trinta cards por lote',()=>{
 const p0=purchasesPage({...args,catalog:{page:0}});
 const p1=purchasesPage({...args,catalog:{page:1}});
 const p2=purchasesPage({...args,catalog:{page:2}});
 const count=html=>(html.match(/class="buy-group-card buy-quick-card"/g)||[]).length;
 assert.equal(count(p0),30);assert.equal(count(p1),60);assert.equal(count(p2),75);
 assert.match(p0,/data-buy-scroll-sentinel/);
 assert.doesNotMatch(p2,/data-buy-scroll-sentinel/);
});
test('produto sem fornecedor pode ser selecionado; só criação de pedido exige fornecedor',()=>{
 const html=purchasesPage({...args,catalog:{search:'PRODUTO 000'}});
 assert.match(html,/data-buy-inline-select data-product="sku0"/);
 assert.doesNotMatch(html,/data-buy-inline-select data-product="sku0"[^>]*disabled/);
 assert.match(html,/data-buy-inline-qty data-product="sku0" value="2" disabled/);
 const selection=cart.cleanPurchaseCart(new Map([['sku0',2]]),products);
 assert.equal(selection.get('sku0'),2);
 assert.equal(cart.purchaseCartBySupplier(selection,products).size,0);
 assert.match(app,/if\(action==='buy-assign-supplier'\)/);
 assert.match(app,/Vincule um fornecedor cadastrado/);
});
test('painel lateral conserva grupos SKU e exige confirmação para vínculo do fornecedor',()=>{
 assert.match(app,/function openPurchaseDrawer\(groupKey\)/);
 assert.match(app,/class="modal buy-drawer"/);
 assert.match(app,/findPurchasePanel\(groupKey\)/);
 assert.match(app,/function closePurchaseDrawer\(restoreFocus=true\)/);
 assert.match(app,/if\(action==='buy-drawer-close'\)/);
 assert.match(app,/buy-assign-supplier/);
 assert.match(app,/window\.confirm\('Vincular '/);
 assert.match(app,/function prefillPurchaseMinimums/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.buy-drawer-backdrop>.buy-drawer\.modal/);
});
test('saídas exibidas são agregadas exclusivamente nos últimos 90 dias',()=>{
 const html=purchasesPage(args);
 assert.match(html,/Saídas do CD · últimos 90 dias/);
 assert.doesNotMatch(html,/Saídas do CD · 30\/90 dias/);
 assert.match(app,/new Date\(Date\.now\(\)-90\*86400000\)/);
 assert.match(app,/90 dias: <b>/);
 assert.doesNotMatch(app,/30 dias: <b>/);
});
test('paginação infinita anexa novos cards sem reabrir a página inteira',()=>{
 assert.match(app,/new IntersectionObserver\(/);
 assert.match(app,/state\.purchaseCatalog\.page\+\+/);
 assert.match(app,/for\(const el of \[\.\.\.template\.content\.querySelectorAll\('\[data-buy-card\]'\)\]\.slice\(count\)\)grid\.append\(el\)/);
 assert.match(app,/mountPurchaseInfinite\(\)/);
 assert.match(app,/if\(action==='buy-load-more'\)\{await appendNextPurchaseBatch\(\)/);
});
