import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const buySrc=await read('src/cdsb-purchases.js'),cartSrc=await read('src/purchase-cart.js');
const app=await read('src/app.js'),pdf=await read('src/purchase-pdf.js');
const tv=await read('src/tv-dashboard.js'),tvCss=await read('cdsb-tv-theme.css');
const pcss=await read('cdsb-purchases.css');
const {purchasesPage}=await import('data:text/javascript;base64,'+Buffer.from(buySrc).toString('base64'));
const cart=await import('data:text/javascript;base64,'+Buffer.from(cartSrc).toString('base64'));
const products=[
 {id:'A-P',name:'CAMISETA',sku:'100',ean:'7891',apparel_size:'P',apparel_model_id:'modelA',supplier_id:'supA',active:true,min_stock:4,image_path:'a.jpg'},
 {id:'A-M',name:'CAMISETA',sku:'101',ean:'7892',apparel_size:'M',apparel_model_id:'modelA',supplier_id:'supA',active:true,min_stock:4},
 {id:'B-G',name:'BLUSA',sku:'102',ean:'7893',apparel_size:'G',apparel_model_id:'modelB',supplier_id:'supB',active:true,min_stock:4}
];
const models=[{id:'modelA',name:'CAMISETA',image_path:'a.jpg'},{id:'modelB',name:'BLUSA',image_path:'b.jpg'}];
const suppliers=[{id:'supA',name:'Clube Marca',active:true},{id:'supB',name:'Malharia',active:true}];
const btn=(label,action,props='')=>'<button data-action="'+action+'" '+props+'>'+label+'</button>';
test('seleção de SKUs com valores inteiros é independente de filtro e paginação',()=>{
 let basket=new Map();
 basket=cart.setPurchaseCartItem(basket,'A-P',9);
 basket=cart.setPurchaseCartItem(basket,'A-M',12);
 basket=cart.setPurchaseCartItem(basket,'B-G',5);
 assert.deepEqual(cart.purchaseCartSummary(basket,products),{skus:3,units:26,suppliers:2});
 const page=purchasesPage({products,models,suppliers,button:btn,cart:basket,catalog:{search:'7892'},expanded:new Set(['model:modelA'])});
 assert.equal((page.match(/class="buy-group-card buy-quick-card"/g)||[]).length,1);
 assert.match(page,/data-buy-inline-select data-product="A-P" checked/);
 assert.match(page,/data-buy-inline-select data-product="A-M" checked/);
 assert.match(page,/data-buy-inline-qty data-product="A-P" value="9"/);
 assert.match(page,/data-buy-inline-qty data-product="A-M" value="12"/);
 assert.match(page,/data-buy-expand="model:modelA" open/);
 assert.match(page,/3 SKU\(s\) · 26 unidades · 2 fornecedor\(es\)/);
 assert.ok(!page.includes('Selecionar para compra'));
 assert.match(page,/data-action="buy-add-to-draft"/);
});
test('revisão agrupa por modelo e mantém total e foto por fornecedor',()=>{
 const basket=new Map([['A-P',10],['A-M',8],['B-G',4]]);
 const grouped=cart.purchaseCartReviewGroups(basket,products,models,'supA');
 assert.equal(grouped.length,1);
 assert.equal(grouped[0].photo,'a.jpg');
 assert.deepEqual(grouped[0].rows.map(x=>[x.apparel_size,x.quantity]),[['P',10],['M',8]]);
 assert.equal(grouped[0].total,18);
 const bySupplier=cart.purchaseCartBySupplier(basket,products);
 assert.equal(bySupplier.size,2);
 assert.equal(bySupplier.get('supB')[0].quantity,4);
 assert.match(app,/function purchaseReviewModal/);
 assert.match(app,/buy-review-card/);
 assert.match(app,/data-buy-review-qty/);
 assert.match(app,/data-buy-review-model-total/);
 assert.match(app,/buy-cart-remove-model/);
});
test('carrinho inválido nunca é salvo e sessão serializada reconstitui quantidade por SKU',()=>{
 assert.equal(cart.validPurchaseQty(0),false);
 assert.equal(cart.validPurchaseQty('1.2'),false);
 assert.equal(cart.validPurchaseQty('abc'),false);
 assert.equal(cart.validPurchaseQty(1000001),false);
 assert.equal(cart.validPurchaseQty(1),true);
 const saved=cart.serializePurchaseCart(new Map([['A-P',7],['B-G',5]]));
 assert.deepEqual([...cart.parsePurchaseCart(saved)], [['A-P',7],['B-G',5]]);
 assert.equal(cart.cleanPurchaseCart(new Map([['missing',2],['A-P',1]]),products).size,1);
 assert.match(app,/sessionStorage\.setItem/);
 assert.match(app,/state\.purchaseCart=cleanPurchaseCart/);
});
test('finalização grava itens do fornecedor atual e não refaz RPC quando PDF falha',()=>{
 assert.match(app,/purchaseCartBySupplier\(state.purchaseCart,state.items\)\.get\(supplier\)/);
 assert.match(app,/await db\.rpc\('save_purchase_order_with_eta'/);
 assert.match(app,/if\(savedId\)/);
 assert.match(app,/Não foi possível|Pedido salvo, porém o download/);
 assert.match(app,/state\.purchaseCart\.delete\(line.product_id\)/);
 assert.match(app,/downloadBuyOrder\(order,saved\)/);
});
test('PDF agrupa variações com foto e mostra totais por modelo',async()=>{
 const {groupPurchaseItems}=await import('data:text/javascript;base64,'+Buffer.from(pdf).toString('base64'));
 const groups=groupPurchaseItems([{product_id:'A-P',quantity:7,sku:'100',ean:'7891'},
 {product_id:'A-M',quantity:9,sku:'101',ean:'7892'}],products,models);
 assert.equal(groups.length,1);
 assert.equal(groups[0].imagePath,'a.jpg');
 assert.equal(groups[0].rows.length,2);
 assert.match(pdf,/pdf\.addImage\(photo,'JPEG'/);
 assert.match(pdf,/TOTAL DO MODELO/);
 assert.match(pdf,/row\.ean/);
 assert.match(pdf,/row\.quantity/);
 assert.match(pdf,/blob\.type!=='application\/pdf'/);
});
test('TV mostra 5 produtos por bloco sem empilhar linhas; Abrir mantém linhas completas',()=>{
 assert.match(tv,/low:'Produtos com menor estoque',high:'Produtos com maior estoque'/);
 assert.match(tv,/oneRows\(manage\?\.low_stock,'low',5\)/);
 assert.match(tv,/oneRows\(rankings\?\.top_stock,'high',5\)/);
 assert.match(tv,/function oneDetailData/);
 assert.match(tv,/return rows\.map\(p=>/);
 assert.doesNotMatch(tv,/oneDetailData[\s\S]*?rows\.slice\(0,5\)/);
 assert.match(tvCss,/tv-card-low \.tv-one-product-row/);
 assert.match(tvCss,/min-height: 33px/);
});
test('mobile e desktop têm controles de entrada e revisão focáveis e carrinho visível',()=>{
 assert.match(pcss,/\.buy-inline-order input/);
 assert.match(pcss,/\.buy-cart-dock/);
 assert.match(pcss,/\.buy-review-photo img/);
 assert.match(pcss,/@media\(max-width:760px\)/);
});
