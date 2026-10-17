import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const source=await read('src/cdsb-purchases.js');
const app=await read('src/app.js');
const css=await read('cdsb-purchases.css');
const html=await read('index.html');
const {purchasingGroups,filterPurchaseGroups,purchasesPage}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
);
const categories=[
 {id:'camisetas',name:'Camisetas',parent_id:null},
 {id:'infantil',name:'Infantil',parent_id:'camisetas'},
 {id:'bebes',name:'Bebês',parent_id:'infantil'},
 {id:'acessorios',name:'Acessórios',parent_id:null}
];
const models=[
 {id:'model-1',name:'CAMISETA AVIVAMENTO 2026',image_path:'model-1.webp'},
 {id:'model-2',name:'CAMISETA ADULTO',image_path:'model-2.webp'}
];
const products=[
 {id:'p',name:'Camisa Avivamento',sku:'ABC100',ean:'7891234001',category_id:'bebes',apparel_model_id:'model-1',apparel_size:'P',gondola:'Gôndola 01',tags:['Infantil','Azul'],supplier_id:'sup1',active:true,min_stock:5,created_at:'2026-09-15',image_path:'p.webp'},
 {id:'g',name:'Camisa Avivamento',sku:'ABC200',ean:'7891234002',category_id:'bebes',apparel_model_id:'model-1',apparel_size:'G',gondola:'Gôndola 02',tags:['Infantil'],supplier_id:'sup1',active:true,min_stock:3,created_at:'2026-10-15'},
 {id:'m',name:'Camisa Adulto',sku:'XYZ300',ean:'7899876001',category_id:'camisetas',apparel_model_id:'model-2',apparel_size:'M',gondola:'Gôndola 03',tags:['Adulto'],supplier_id:'sup2',active:true,min_stock:5,created_at:'2026-08-15'},
 {id:'solo',name:'Pulseira',sku:'ACC400',ean:'7894411222',category_id:'acessorios',gondola:'Gôndola 04',tags:['Brinde'],supplier_id:null,active:true,min_stock:3,created_at:'2026-09-01'},
];
const balances=[{product_id:'p',quantity:1},{product_id:'g',quantity:8},{product_id:'m',quantity:4},{product_id:'solo',quantity:0}];
const groups=purchasingGroups(products,models,balances,[],[],[]);
const suppliers=[{id:'sup1',active:true,name:'Clube Marca'},{id:'sup2',active:true,name:'Malharia'}];
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';

test('pesquisa SKU ou EAN encontra o modelo completo sem separar tamanhos',()=>{
 const bySku=filterPurchaseGroups(groups,{search:'ABC100'},categories);
 assert.equal(bySku.length,1);
 assert.equal(bySku[0].title,'CAMISETA AVIVAMENTO 2026');
 assert.equal(bySku[0].variants.length,2);
 assert.equal(filterPurchaseGroups(groups,{search:'7891234002'},categories)[0].variants.length,2);
 assert.deepEqual(filterPurchaseGroups(groups,{search:'avivamento 2026'},categories).map(x=>x.key),
  ['model:model-1']);
 assert.equal(filterPurchaseGroups(groups,{search:'xyz300 ABC100'},categories).length,0,
  'não combina termos de SKUs diferentes');
});

test('segmentação por categoria, subcategoria e subsubcategoria mantém descendentes',()=>{
 const children=filterPurchaseGroups(groups,{category:'camisetas'},categories);
 assert.equal(children.length,2);
 assert.equal(filterPurchaseGroups(groups,{category:'infantil'},categories).length,1);
 assert.equal(filterPurchaseGroups(groups,{category:'bebes'},categories)[0].key,'model:model-1');
 assert.equal(filterPurchaseGroups(groups,{category:'acessorios'},categories)[0].key,'product:solo');
});
test('filtros de fornecedor, tags e gôndola funcionam juntos',()=>{
 assert.deepEqual(filterPurchaseGroups(groups,{supplier:'sup1',tag:'azul',gondola:'1'},categories).map(x=>x.key),['model:model-1']);
 assert.equal(filterPurchaseGroups(groups,{supplier:'sup2',tag:'azul'},categories).length,0);
 assert.equal(filterPurchaseGroups(groups,{gondola:'Gôndola 02'},categories).length,1);
});

test('ordenar por estoque, nome e data funciona sem dividir os modelos',()=>{
 assert.equal(filterPurchaseGroups(groups,{sort:'available-asc'},categories)[0].title,'Pulseira');
 assert.equal(filterPurchaseGroups(groups,{sort:'available-desc'},categories)[0].title,'CAMISETA AVIVAMENTO 2026');
 assert.equal(filterPurchaseGroups(groups,{sort:'recent'},categories)[0].title,'CAMISETA AVIVAMENTO 2026');
 assert.equal(filterPurchaseGroups(groups,{sort:'name-desc'},categories)[0].title,'Pulseira');
});

test('os cards mantêm fotos e variações dentro de details inicialmente fechado',()=>{
 const page=purchasesPage({products,models,suppliers,balances,categories,
  tags:[{name:'Infantil'}],button,filter:'',catalog:{search:'abc100'}});
 assert.equal((page.match(/class="buy-group-card buy-quick-card"/g)||[]).length,1);
 assert.match(page,/data-photo-path="model-1.webp"/);
 assert.match(page,/<details class="buy-variation-disclosure buy-one-panel"[^>]*data-buy-expand=/);
 assert.doesNotMatch(page,/<details class="buy-variation-disclosure buy-one-panel"[^>]* open/);
 assert.match(page,/Abrir compra/);
 assert.match(page,/data-action="buy-open-group"/);
 assert.match(page,/data-mode="buy-filter"/);
 assert.match(page,/data-mode="buy-tag"/);
 assert.match(page,/id="buy-catalog-search"/);
 assert.match(page,/data-buy-catalog="gondola"/);
 assert.match(page,/data-buy-catalog="sort"/);
 assert.match(page,/data-buy-filter/);
});
test('lista oferece carregamento progressivo sem perder filtro aplicado',()=>{
 const many=Array.from({length:19},(_,i)=>({
  ...products[3],id:'u'+i,name:'Produto '+i,sku:'UNI'+i
 }));
 const page0=purchasesPage({products:many,suppliers,categories,button,catalog:{page:0}});
 const page1=purchasesPage({products:many,suppliers,categories,button,catalog:{page:1}});
 assert.equal((page0.match(/class="buy-group-card buy-quick-card"/g)||[]).length,8);
 assert.equal((page1.match(/class="buy-group-card buy-quick-card"/g)||[]).length,16);
 assert.match(page0,/data-action="buy-load-more"/);
 const filtered=purchasesPage({products:many,suppliers,categories,button,catalog:{search:'Produto 17',page:0}});
 assert.equal((filtered.match(/class="buy-group-card buy-quick-card"/g)||[]).length,1);
 assert.doesNotMatch(filtered,/data-action="buy-load-more"/);
});
test('eventos de filtro e busca usam estado independente de Produtos',()=>{
 assert.match(app,/purchaseCatalog:\{search:''/);
 assert.match(app,/function updatePurchaseSearch\(value\)/);
 assert.match(app,/if\(isBuyCategory\)/);
 assert.match(app,/if\(isBuyTag\)/);
 assert.match(app,/if\(action==='buy-clear-filters'\)/);
 assert.match(app,/if\(action==='buy-load-more'\)/);
 assert.match(app,/data-buy-catalog/);
 assert.match(app,/data-buy-filter/);
 assert.match(css,/\.buy-variation-disclosure\[open\]/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(html,/cdsb-purchases\.css\?v=20261017reviewfix1/);
 assert.match(app,/cdsb-purchases\.js\?v=20261017drafts1/);
});
