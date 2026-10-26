import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inferApparelMetadata,resolveCategoryVariations} from '../src/category-variations.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/app.js'),sql=read('supabase/migrations/20261022170000_product_variations_and_basic_save.sql');
const index=read('index.html');
test('uma ação salva nome, categoria, tags e todas as variações atomicamente',()=>{
 assert.match(app,/p_name:name,p_category:category,p_tags:tags/);
 assert.match(app,/p_rows:variation\.rows/);
 assert.match(app,/db\.rpc\('save_product_workspace'/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.save_product_workspace/i);
 assert.match(sql,/PERFORM public\.save_product_basic_with_tags/i);
 assert.match(sql,/PERFORM public\.quick_stock_count/i);
 assert.match(sql,/app_private\.has_permission\('stock\.balance'\)/);
 assert.match(sql,/stock_reservations/);
 assert.doesNotMatch(sql,/v_sku:='AM-'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.save_product_workspace/i);
});
test('SKU antigo não é recriado e a categoria define os tamanhos',()=>{
 assert.match(sql,/public\.convert_single_product_to_apparel/);
 assert.match(sql,/app_private\.category_variant_options/);
 assert.match(app,/useOriginalVariation/);
 assert.match(app,/variationFormHTML\(allowed,all/);
});
test('Babyl ook é feminino; infantil permanece como infantil',()=>{
 const cats=[{id:'root',name:'CAMISETAS',parent_id:null,variation_options:null},
 {id:'adulto',name:'ADULTO',parent_id:'root',variation_options:null},
 {id:'baby',name:'BABY LOOK',parent_id:'adulto',variation_options:['P','M']},
 {id:'infantil',name:'INFANTIL',parent_id:'root',variation_options:['Tamanho 2']}];
 assert.deepEqual(inferApparelMetadata(cats,'baby'),{type:'Camiseta',audience:'Feminino',ageGroup:'Adulto'});
 assert.deepEqual(inferApparelMetadata(cats,'infantil'),{type:'Camiseta',audience:'Unissex',ageGroup:'Infantil'});
 assert.equal(resolveCategoryVariations(cats,'baby').options.length,2);
});
test('cache busting do frontend utiliza a versão publicada',()=>{
 assert.match(index,/secure-entry\.js\?v=20261026foto100k1/);
});
