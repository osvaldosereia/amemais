import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {variationFormHTML,uniqueCategoryVariations,variationKey} from '../src/product-variation-coverage.js';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../products-grid-drawer.css',import.meta.url),'utf8');
const sizes=['Tamanho PP','Tamanho P','Tamanho M','Tamanho G','Tamanho GG','Tamanho XGG','Tamanho XXGG','Tamanho EXGG'];
test('Baby Look mostra oito cartões compactos, sem adicionar ou ativar em outras telas',()=>{
 const html=variationFormHTML(sizes,[],{canEdit:true,isModel:true});
 assert.equal((html.match(/class="variation-compact-row"/g)||[]).length,8);
 for(const size of sizes)assert.ok(html.includes(size));
 assert.equal((html.match(/name="quantity"/g)||[]).length,8);
 assert.equal((html.match(/name="ean"/g)||[]).length,8);
 assert.equal((html.match(/name="sku"/g)||[]).length,8);
 assert.doesNotMatch(html,/product-drawer-show-add|extra-sizes|product-drawer-convert|size-chip/);
});
test('variações equivalentes não aparecem duplicadas',()=>{
 assert.equal(variationKey('TAMANHO M'),variationKey('M'));
 assert.deepEqual(uniqueCategoryVariations(['M','Tamanho M','Tamanho G']),['M','Tamanho G']);
});
test('SKU antigo exige apenas identificação do tamanho na própria lista',()=>{
 const html=variationFormHTML(sizes,[{id:'old',sku:'1000209',ean:'100002096',active:true}],{
   canEdit:true,main:{id:'old',sku:'1000209',ean:'100002096'},isModel:false,physicalFor:()=>3
 });
 assert.equal((html.match(/data-original-size/g)||[]).length,8);
 assert.match(html,/data-original-id="old"/);
 assert.match(html,/data-original-sku="1000209"/);
 assert.match(html,/data-original-quantity="3"/);
});
test('sem telas intermediárias e com salvamento fixo',()=>{
 assert.match(app,/overview\.innerHTML=variationFormHTML/);
 assert.match(app,/data-product-drawer-save-footer/);
 assert.match(app,/saveProductDrawerChanges\(\)/);
 assert.match(app,/db\.rpc\('save_product_workspace'/);
 assert.doesNotMatch(app,/if\(action==='product-drawer-pick-size'\)/);
 assert.doesNotMatch(app,/if\(type==='product-drawer-convert'\)/);
 assert.match(css,/\.variation-compact-fields/);
});
