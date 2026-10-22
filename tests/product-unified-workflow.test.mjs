import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {addSizesContent,collectExtraSizes} from '../src/stock-workflows.js';
import {inferApparelMetadata,resolveCategoryVariations} from '../src/category-variations.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,styles,migration,index]=await Promise.all([
 read('src/app.js'),read('products-grid-drawer.css'),
 read('supabase/migrations/20261022093000_convert_single_product_to_apparel.sql'),
 read('index.html')
]);
test('Ficha do produto tem somente uma edição de SKU por variação',()=>{
 assert.match(app,/const show=\['cadastro','compras','admin'\]\.includes\(tab\)/);
 assert.match(app,/section\.hidden=tab==='admin'\|\|section\.dataset\.editorPanel!==tab/);
 assert.match(app,/stock\.querySelectorAll\('\.card-balance-edit-variant,\.product-variant-add'\)/);
 assert.match(app,/advanced\.open=false/);
 assert.match(app,/data-product-drawer-add/);
 assert.match(styles,/\.product-drawer-variation-heading/);
});
test('Adicionar variação aparece dentro do drawer e não usa modal externo',()=>{
 assert.match(app,/addSizesContent\(group\.model,group\.products,allowed,state\.gondolas\)/);
 assert.match(app,/form data-form="extra-sizes"/);
 assert.match(app,/data-form="product-drawer-convert"/);
 assert.match(app,/db\.rpc\('convert_single_product_to_apparel'/);
 assert.match(app,/openProductDrawer\('model:'\+modelId,\{tab:'variacoes'\}\)/);
 assert.match(app,/!window\.confirm\('Descartar a inclusão de variações não salva\?'\)/);
});
test('Tamanho legado M não apresenta Tamanho M como variação inédita',()=>{
 const html=addSizesContent({name:'Camiseta'},[{id:'1',active:true,apparel_color:'Única',apparel_size:'M'}],
  ['Tamanho P','Tamanho M','Tamanho G']);
 assert.match(html,/Tamanho M ✓/);
 assert.doesNotMatch(html,/data-extra-size="Tamanho M"/);
 assert.match(html,/data-extra-size="Tamanho G"/);
});
test('Categorias recém-reorganizadas identificam Baby Look feminino e Infantil',()=>{
 const cats=[{id:'root',name:'CAMISETAS',parent_id:null,variation_options:null},
 {id:'adulto',name:'ADULTO',parent_id:'root',variation_options:null},
 {id:'baby',name:'BABY LOOK',parent_id:'adulto',variation_options:['P','M']},
 {id:'infantil',name:'INFANTIL',parent_id:'root',variation_options:['Tamanho 2']}];
 assert.deepEqual(inferApparelMetadata(cats,'baby'),{type:'Camiseta',audience:'Feminino',ageGroup:'Adulto'});
 assert.deepEqual(inferApparelMetadata(cats,'infantil'),{type:'Camiseta',audience:'Unissex',ageGroup:'Infantil'});
 assert.equal(resolveCategoryVariations(cats,'baby').options.length,2);
});
test('Conversão mantém o produto original e checa permissão, categoria e idempotência',()=>{
 assert.match(migration,/select \* into v_product from public\.products where id=p_product_id for update/i);
 assert.match(migration,/v_product\.apparel_model_id is not null/i);
 assert.match(migration,/app_private\.category_variant_options/);
 assert.match(migration,/set apparel_model_id=v_model_id/i);
 assert.doesNotMatch(migration,/delete from public\.products/i);
 assert.match(migration,/revoke all on function public\.convert_single_product_to_apparel/i);
 assert.match(migration,/grant execute on function public\.convert_single_product_to_apparel/i);
 assert.match(index,/secure-entry\.js\?v=20261022productux2/);
});
