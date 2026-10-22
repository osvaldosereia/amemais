import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {variantInlineEditor,variantInlinePayload} from '../src/product-variant-inline.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../products-grid-drawer.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const item={id:'sku-1',name:'A Bíblia do Bebê',sku:'1003192',ean:'100026900',gondola:'A',prateleira:'1',active:true,apparel_model_id:null,apparel_size:'Único'};
const model={...item,apparel_model_id:'model',apparel_size:'M'};
const gondolas=[{name:'A',active:true},{name:'B',active:true}];
test('Editar mostra um formulário completo dentro do painel atual',()=>{
 const html=variantInlineEditor(model,{allowedSizes:['P','M','G'],gondolas});
 for(const name of ['sku','ean','gondola','prateleira','active','size'])assert.match(html,new RegExp('name="'+name+'"'));
 assert.match(html,/class="button primary" type="submit">Salvar alterações/);
 assert.doesNotMatch(html,/modalback/);
 assert.match(css,/\.cdsb-product-drawer \.product-variant-edit/);
 assert.match(css,/product-variant-inline-host/);
});
test('Produto único não apresenta seleção indevida de tamanho',()=>{
 const html=variantInlineEditor(item,{gondolas});
 assert.doesNotMatch(html,/name="size"/);
 assert.match(html,/value="1003192"/);
});
test('validação é restrita aos campos cadastrais e não muda saldo',()=>{
 const v=variantInlinePayload({size:'G',sku:' X ',ean:'1234567890123',gondola:'B',prateleira:'2',active:'false'},
 {item:model,allowedSizes:['P','M','G'],gondolas});
 assert.deepEqual(v,{size:'G',sku:'X',ean:'1234567890123',gondola:'B',prateleira:'2',active:false});
 assert.ok(!Object.hasOwn(v,'quantity'));
 assert.throws(()=>variantInlinePayload({size:'GG',active:'true'},{item:model,allowedSizes:['P','M','G'],gondolas}),/não pertence/);
 assert.throws(()=>variantInlinePayload({active:'true',ean:'123'},{item,gondolas}),/EAN/);
});
test('Ações do estoque no drawer desviam da modal legada e possuem versão de cache nova',()=>{
 assert.match(source,/target\.closest\('\.cdsb-product-drawer \[data-product-details\]'\)/);
 assert.match(source,/openProductVariantInline\(id\)/);
 assert.match(source,/if\(type==='product-drawer-variant'\)/);
 assert.match(index,/products-grid-drawer\.css\?v=20261022variationcoverage1/);
 assert.match(index,/secure-entry\.js\?v=20261022variationcoverage1/);
});
