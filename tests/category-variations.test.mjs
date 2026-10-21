import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const helper=await readFile(new URL('../src/category-variations.js',import.meta.url),'utf8');
const variants=await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
const {parseCategoryVariations,resolveCategoryVariations,variationOptionsToSave,
 renderCategoryVariationFields,makeVariationCards,makeVariationChips}=variants;
const categories=[
 {id:'root',parent_id:null,variation_options:['P','M','G','GG','XGG']},
 {id:'child',parent_id:'root',variation_options:null},
 {id:'hat',parent_id:'root',variation_options:['Tamanho 10','Tamanho 12','Tamanho 14']},
 {id:'empty',parent_id:'root',variation_options:[]}
];
test('categoria herda variações do ancestral mais próximo',()=>{
 assert.deepEqual(resolveCategoryVariations(categories,'child').options,['P','M','G','GG','XGG']);
 assert.equal(resolveCategoryVariations(categories,'child').source,'root');
 assert.equal(resolveCategoryVariations(categories,'child').inherited,true);
 assert.deepEqual(resolveCategoryVariations(categories,'hat').options,['Tamanho 10','Tamanho 12','Tamanho 14']);
 assert.deepEqual(resolveCategoryVariations(categories,'empty').options,[]);
});
test('personalizar aceita vírgulas, ponto-e-vírgula e linhas, sem duplicar rótulos',()=>{
 assert.deepEqual(parseCategoryVariations('P, M; G\nGG\nXGG'),['P','M','G','GG','XGG']);
 assert.deepEqual(parseCategoryVariations('Tamanho 10\nTamanho 12'),['Tamanho 10','Tamanho 12']);
 assert.throws(()=>parseCategoryVariations('P, p'),/repetida/);
 assert.throws(()=>parseCategoryVariations('Variação Extremamente Longa'),/16 caracteres/);
 assert.throws(()=>parseCategoryVariations(Array.from({length:33},(_,i)=>'V'+i).join(',')),/32/);
});
test('modo herdar difere explicitamente de sem variações',()=>{
 const form=mode=>({querySelector:s=>
  s==='[name="variation_mode"]'?{value:mode}:{value:'10, 12, 14'}});
 assert.equal(variationOptionsToSave(form('inherit')),null);
 assert.deepEqual(variationOptionsToSave(form('none')),[]);
 assert.deepEqual(variationOptionsToSave(form('custom')),['10','12','14']);
});
test('formulário mostra opções da categoria e oculta Cor',()=>{
 const html=renderCategoryVariationFields(categories[1],categories);
 assert.match(html,/Herdar da categoria superior/);
 assert.match(html,/P · M · G · GG · XGG/);
 assert.doesNotMatch(html,/name="color"/);
});
test('tamanhos com números, espaços e caracteres especiais são escapados',()=>{
 const chips=makeVariationChips(['Tamanho 10','<script>']);
 const rows=makeVariationCards(['Tamanho 10','<script>']);
 assert.match(chips,/data-size="Tamanho 10"/);
 assert.match(rows,/data-size-variant="Tamanho 10"/);
 assert.doesNotMatch(chips,/<script>/);
 assert.doesNotMatch(rows,/<script>/);
});
test('novo cadastro apresenta seletor herdado e não exige Cor',async()=>{
 const src=await readFile(new URL('../src/product-variants.js',import.meta.url),'utf8');
 const combined=helper.replace(/^export\s+/gm,'')+'\n'+
  src.replace(/^import[^\n]+\n/gm,'').replace(/^export\s+/gm,'')+
  '\nreturn {sizesSection,collectSizeVariants};';
 const {sizesSection}=new Function(combined)();
 const html=sizesSection();
 assert.match(html,/data-use-sizes checked hidden/);
 assert.match(html,/data-variation-selection-caption/);
 assert.match(html,/class="size-variant-list"/); // lista preenchida após escolher a categoria
 assert.doesNotMatch(html,/name="apparel_color"/);
 assert.doesNotMatch(html,/Cor das variações/);
});
