import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categoryVariationCoverage,categoryVariationCoverageHTML,variationKey} from '../src/product-variation-coverage.js';
import {addSizesContent,collectExtraSizes} from '../src/stock-workflows.js';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../products-grid-drawer.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/secure-entry.js',import.meta.url),'utf8');
const configured=['Tamanho PP','Tamanho P','Tamanho M','Tamanho G','Tamanho GG','Tamanho XGG','Tamanho XXGG','Tamanho EXGG'];
const sku={id:'original',active:true,name:'CAMISETA / BABY SANTA TERESINHA AGAPE',sku:'1000209',ean:'100002096',apparel_size:null};
test('Categoria Baby Look mostra os oito tamanhos mesmo quando o SKU histórico é Único',()=>{
 const result=categoryVariationCoverage(configured,[sku],{isModel:false});
 assert.equal(result.rows.length,8);
 assert.equal(result.missing,8);
 assert.equal(result.registered,0);
 assert.equal(result.unassigned,true);
 const content=categoryVariationCoverageHTML(result,{isModel:false,canEdit:true});
 for(const label of configured)assert.ok(content.includes(label),label+' não aparece');
 assert.match(content,/O SKU atual ainda está como Único/);
 assert.match(content,/data-action="product-drawer-pick-size"/);
 assert.doesNotMatch(content,/data-action="product-drawer-reactivate-variation"/);
});
test('M e Tamanho M são equivalentes; nunca cadastrar duplicado no seletor',()=>{
 assert.equal(variationKey(' TAMANHO M '),variationKey('M'));
 const p={id:'m',apparel_size:'M',active:true,apparel_color:'Única'};
 const res=categoryVariationCoverage(['Tamanho P','Tamanho M','Tamanho G'],[p],{isModel:true});
 assert.deepEqual(res.rows.map(v=>v.kind),['missing','registered','missing']);
 const selection=addSizesContent(null,[p],['Tamanho P','Tamanho M','Tamanho G']);
 assert.match(selection,/Tamanho M ✓/);
 assert.doesNotMatch(selection,/data-extra-size="Tamanho M"/);
});
test('Categorias com aliases P e Tamanho P não duplicam chips',()=>{
 const result=categoryVariationCoverage(['P','Tamanho P','Tamanho M'],[],{isModel:true});
 assert.equal(result.rows.length,2);
 assert.equal(result.missing,2);
});
test('A área de inclusão é limpa ao cancelar e ao trocar de seção',()=>{
 assert.match(app,/function resetProductDrawerVariationDraft\(area\)/);
 assert.match(app,/row\.hidden=true/);
 assert.match(app,/input\.disabled=true/);
 assert.match(app,/button\.classList\.remove\('selected'\)/);
 assert.match(app,/resetProductDrawerVariationDraft\(addition\)/);
 assert.match(app,/resetProductDrawerVariationDraft\(area\)/);
});
test('Inativo é diferente de ausente e dados históricos não são apagados',()=>{
 const input=[{id:'inativo',apparel_size:'GG',active:false,apparel_color:'Única'},
 {id:'legado',apparel_size:'G3',active:true,apparel_color:'Única'}];
 const x=categoryVariationCoverage(['Tamanho GG','Tamanho P'],input,{isModel:true});
 assert.equal(x.inactive,1);
 assert.equal(x.missing,1);
 assert.equal(x.legacy.length,1);
 assert.match(categoryVariationCoverageHTML(x,{canEdit:true,isModel:true}),/product-drawer-reactivate-variation/);
 const add=addSizesContent(null,input,['Tamanho GG','Tamanho P']);
 assert.doesNotMatch(add,/data-extra-size="Tamanho GG"/);
});
test('Cobertura é indicação, não gera SKU, movimentação ou estoque',()=>{
 const marked=categoryVariationCoverage(['P','G'],[],{isModel:true});
 assert.equal(marked.registered,0);
 assert.match(categoryVariationCoverageHTML(marked,{canEdit:false,isModel:true}),/Tamanhos configurados/);
 assert.doesNotMatch(categoryVariationCoverageHTML(marked,{canEdit:false,isModel:true}),/data-action=/);
});
test('Drawer mostra categorias e cadastro no mesmo painel, sem edições paralelas',()=>{
 assert.match(app,/categoryVariationCoverage\(allowed,allVariations,\{isModel:models\}\)/);
 assert.match(app,/categoryVariationCoverageHTML\(coverage,\{isModel:models,canEdit:canEdit&&canRegisterProducts\(\)\}\)/);
 assert.match(app,/if\(action==='product-drawer-pick-size'\)/);
 assert.match(app,/if\(action==='product-drawer-reactivate-variation'\)/);
 assert.match(app,/querySelectorAll\('\[data-editor-panel="variacoes"\],\[data-editor-panel="codigos"\]'\)/);
 assert.match(app,/stock\.querySelector\(':scope > summary'\)\?\.remove\(\)/);
 assert.match(css,/\.product-variation-coverage-grid/);
 assert.match(html,/products-grid-drawer\.css\?v=20261022variationcoverage1/);
 assert.match(entry,/app\.js\?v=20261022variationcoverage1/);
});
