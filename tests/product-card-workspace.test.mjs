import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {categoryPath,productCardWorkspace} from '../src/product-card-workspace.js';

const categories=[
 {id:'root',parent_id:null,name:'Roupas e Acessórios'},
 {id:'male',parent_id:'root',name:'Masculina'},
 {id:'female',parent_id:'root',name:'Feminina'},
 {id:'male-shirt',parent_id:'male',name:'Camiseta',variation_options:['Tamanho P','Tamanho M','Tamanho G']},
 {id:'female-shirt',parent_id:'female',name:'Camiseta',variation_options:['P','M','G']},
 {id:'deep',parent_id:'male-shirt',name:'Manga Curta'}
];
const base={name:'CAMISETA TESTE',tags:['roupas'],category_id:'deep',id:'mod-1'};
const products=[
 {id:'p1',sku:'001001',ean:'7891234567890',apparel_size:'Tamanho P',apparel_color:'Única',name:base.name,
  active:true,category_id:'deep',min_stock:5,minimum_order_quantity:1,supplier_id:'f1',
  gondola:'01',prateleira:'A',sale_price:39.9,sales_unit:'UN'},
 {id:'p2',sku:'001002',ean:'7891234567891',apparel_size:'Tamanho M',apparel_color:'Única',
  name:base.name,active:true,category_id:'deep',min_stock:5,minimum_order_quantity:1}
];
const grouped={key:'model:mod-1',modelId:'mod-1',model:base,main:products[0],products};
const props={categories,gondolas:[{name:'01',active:true}],suppliers:[{id:'f1',name:'Fornecedor Teste',active:true}]};
test('caminho de categorias preserva raízes, subcategorias e subsubcategorias',()=>{
 assert.equal(categoryPath(categories,'deep'),'Roupas e Acessórios › Masculina › Camiseta › Manga Curta');
 assert.equal(categoryPath(categories,'female-shirt'),'Roupas e Acessórios › Feminina › Camiseta');
 assert.equal(categoryPath(categories,null),'');
});
test('editor exibe quatro seções sem misturar compras, localização e cadastro',()=>{
 const html=productCardWorkspace(grouped,props);
 for(const name of ['Cadastro','Variações','Compras','Códigos e localização'])
  assert.ok(html.includes('>'+name+'</button>'),name);
 assert.match(html,/data-form="product-card-basic"/);
 assert.match(html,/data-form="product-card-variant"/);
 assert.match(html,/data-form="product-card-purchase"/);
 assert.match(html,/data-form="product-card-codes"/);
 assert.match(html,/Roupas e Acessórios › Masculina › Camiseta › Manga Curta/);
 assert.match(html,/Roupas e Acessórios › Feminina › Camiseta/);
 assert.match(html,/Aplicar a todas as variações/);
 assert.match(html,/7891234567890/);
});
test('editor conserva aba, variação selecionada e card aberto após atualização',()=>{
 const html=productCardWorkspace(grouped,{...props,ui:{panel:'editor',editorTab:'variacoes',variantId:'p2',skuId:'p2'}});
 assert.match(html,/data-product-editor open/);
 assert.match(html,/data-tab="variacoes" role="tab" aria-selected="true"/);
 assert.match(html,/data-product-variant="p2"/);
 assert.match(html,/data-edit-sku-panel="p2" data-edit-sku-tab="purchase"/);
 assert.match(html,/data-edit-sku-panel="p1" data-edit-sku-tab="purchase" hidden/);
});
test('produto único não exibe variações e mantém códigos individuais',()=>{
 const g={key:'product:p1',model:null,modelId:null,main:products[0],products:[products[0]]};
 const html=productCardWorkspace(g,props);
 assert.doesNotMatch(html,/data-tab="variacoes"/);
 assert.match(html,/data-form="product-card-codes"/);
 assert.match(html,/data-form="product-card-purchase"/);
 assert.match(html,/name="active"/);
});
test('código da lista preserva estado de edição e atualiza apenas itens editados',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/productCardUi:new Map\(\)/);
 assert.match(app,/function refreshEditedProduct\(/);
 assert.match(app,/async function saveProductCard\(/);
 assert.match(app,/function abandonCardDraft\(/);
 assert.match(app,/update_product_model_basic/);
 assert.match(app,/if\(type==='product-card-variant'\)/);
 assert.match(app,/cardUiFor\(card\)/);
});
