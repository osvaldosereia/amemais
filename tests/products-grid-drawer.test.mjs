import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {productCatalogCard} from '../src/products-grid.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,css,index,secure,workspace,stock]=await Promise.all([
 read('src/app.js'),read('products-grid-drawer.css'),read('index.html'),
 read('src/secure-entry.js'),read('src/product-card-workspace.js'),read('src/stock-workflows.js')
]);
const h=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const group={key:'model:m1',title:'CAMISETA CORAGEM BRANCA - UNISSEX',
 modelId:'m1',model:{id:'m1',name:'CAMISETA CORAGEM BRANCA - UNISSEX',category_id:'c'},
 main:{id:'p1',sku:'0001',ean:'12345678',image_path:'photo.jpg'},
 products:[{id:'p1',sku:'0001',ean:'12345678',image_path:'photo.jpg',active:true,gondola:'01'},
 {id:'p2',sku:'0002',ean:'12345679',active:true,gondola:'01'}]};
const helpers={h,qtyStore:id=>id==='p1'?7:5,qtyReserved:id=>id==='p1'?2:1,
 qtyAvailable:id=>id==='p1'?5:4,categories:[{id:'c',name:'Manga Curta'}]};
test('um único botão abre o card compacto; foto, categoria e estoque continuam visíveis',()=>{
 const html=productCatalogCard(group,helpers);
 assert.match(html,/class="product-grid-card/);
 assert.match(html,/data-action="product-drawer-open"/);
 assert.equal((html.match(/<button /g)||[]).length,1);
 assert.match(html,/data-photo-path="photo.jpg"/);
 assert.match(html,/CAMISETA CORAGEM BRANCA/);
 assert.match(html,/Manga Curta/);
 assert.match(html,/Gôndola 01/);
 assert.match(html,/>12<\/strong>/);
 assert.match(html,/>3<\/strong>/);
 assert.match(html,/>9<\/strong>/);
});
test('produto único e produto sem foto mantêm uma só ação',()=>{
 const lone={key:'product:p3',title:'BÍBLIA DE BOLSO',model:null,modelId:null,
 main:{id:'p3',sku:'348',ean:'10003298',active:true},products:[{id:'p3',sku:'348',ean:'10003298',active:true}]};
 const html=productCatalogCard(lone,helpers);
 assert.match(html,/SKU 348/);
 assert.match(html,/product-grid-placeholder/);
 assert.equal((html.match(/<button /g)||[]).length,1);
});
test('desktop usa três colunas e mobile mantém a folha inferior',()=>{
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/width:min\(580px,100vw\)/);
 assert.match(css,/flex-direction:row!important/);
 assert.match(css,/height:min\(92dvh,950px\)/);
 assert.match(index,/products-grid-drawer.css\?v=20261022prodvariants1/);
 assert.match(secure,/app.js\?v=20261026foto100k1/);
});
test('catálogo carrega 30 por vez, preservando filtros e scroll durante expansão',()=>{
 assert.match(app,/const pageSize=30,totalPages/);
 assert.match(app,/class="grouped-inventory-grid products-card-grid"/);
 assert.match(app,/data-products-scroll-sentinel/);
 assert.match(app,/new IntersectionObserver\(/);
 assert.match(app,/function appendMoreProducts\(/);
 assert.match(app,/\.slice\(count\)\)grid\.append\(card\)/);
 assert.match(app,/data-action="product-load-more"/);
});
test('ficha simplifica as abas e reúne variações, códigos e estoque no mesmo lugar',()=>{
 for(const tab of ["cadastro","variacoes","compras","midia","admin"])
  assert.match(app,new RegExp("'"+tab+"'"));
 assert.match(app,/\['cadastro','Produto'\],\['variacoes','Variações'\]/);
 assert.match(app,/\['compras','Compras'\],\['midia','Fotos'\],\['admin','Mais'\]/);
 assert.match(app,/section\.hidden=tab==='admin'\|\|section\.dataset\.editorPanel!==tab/);
 assert.match(app,/stock\.hidden=tab!=='variacoes'/);
 assert.match(app,/role="dialog" aria-modal="true" aria-labelledby="cdsb-product-drawer-title"/);
 assert.match(app,/overlay\.className='modalback cdsb-product-backdrop'/);
 assert.match(app,/productGroupCard\(group\)/);
 assert.match(app,/data-product-drawer-overview/);
 assert.match(app,/data-product-drawer-photo/);
 assert.match(app,/photoChooser\(group\.model\|\|main\)/);
 assert.match(app,/data-product-drawer-editor-slot/);
 assert.match(workspace,/data-product-category-search/);
 assert.match(workspace,/subpanel\(group,p,'purchase'/);
 assert.match(workspace,/subpanel\(group,p,'codes'/);
 assert.match(stock,/data-product-details/);
});
test('salvamentos mantêm painel e alterações não salvas exigem confirmação',()=>{
 assert.match(app,/function refreshOpenProductDrawer\(/);
 assert.match(app,/render\(\);\s*refreshOpenProductDrawer\(\)/);
 assert.match(app,/function productDrawerChanged\(\)/);
 assert.match(app,/if\(type==='product-drawer-photo'\)/);
 assert.match(app,/if\(inDrawer\)\{\s*return saveProductCard/);
 assert.match(app,/data-product-drawer-save-footer/);
 assert.match(app,/if\(productDrawer\)\{closeProductDrawer\(\);return;\}/);
});
