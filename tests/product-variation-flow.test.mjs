import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const categorySource=await readFile(new URL('../src/category-variations.js',import.meta.url),'utf8');
const {inferApparelMetadata,syncApparelCategoryMetadata}=await import(
 'data:text/javascript;base64,'+Buffer.from(categorySource).toString('base64')
);
const variantsSource=await readFile(new URL('../src/product-variants.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const executableVariants=variantsSource.replace(
 /from '\.\/category-variations\.js\?v=[^']+';/,
 "from 'data:text/javascript;base64,"+Buffer.from(categorySource).toString('base64')+"';"
);
const {collectSizeVariants}=await import('data:text/javascript;base64,'+Buffer.from(executableVariants).toString('base64'));

const categories=[
 {id:'root',name:'Roupas e Acessórios',parent_id:null},
 {id:'male',name:'Masculina',parent_id:'root'},
 {id:'female',name:'Feminina',parent_id:'root'},
 {id:'kids',name:'Infantil',parent_id:'root'},
 {id:'unisex',name:'Unisex',parent_id:'root'},
 {id:'tshirt',name:'Camiseta',parent_id:'male'},
 {id:'short',name:'Manga Curta',parent_id:'tshirt'},
 {id:'babylook',name:'Baby Look',parent_id:'female'},
 {id:'kidshirt',name:'Camiseta',parent_id:'kids'},
 {id:'hat',name:'Chapéu',parent_id:'unisex'}
];
test('categoria masculina define tipo, público e faixa etária sem novo formulário',()=>{
 assert.deepEqual(inferApparelMetadata(categories,'short'),
  {type:'Camiseta',audience:'Masculino',ageGroup:'Adulto'});
});
test('Baby Look é camiseta feminina adulta, não produto de bebê',()=>{
 assert.deepEqual(inferApparelMetadata(categories,'babylook'),
  {type:'Camiseta',audience:'Feminino',ageGroup:'Adulto'});
});
test('categoria infantil é reconhecida e outras categorias usam fallback aceito pelo backend',()=>{
 assert.deepEqual(inferApparelMetadata(categories,'kidshirt'),
  {type:'Camiseta',audience:'Unissex',ageGroup:'Infantil'});
 assert.deepEqual(inferApparelMetadata(categories,'hat'),
  {type:'Outro',audience:'Unissex',ageGroup:'Adulto'});
});
test('classificação é sincronizada quando a categoria muda',()=>{
 const fields={
  'input[name="category_id"]':{value:'short'},
  '[name="apparel_type"]':{value:''},'[name="apparel_audience"]':{value:''},
  '[name="apparel_age"]':{value:''},
  '[data-apparel-category-summary]':{textContent:''}
 };
 const panel={querySelector:s=>fields[s]};
 const form={querySelector:s=>s==='[data-variant-panel]'?panel:fields[s]};
 syncApparelCategoryMetadata(form,categories);
 assert.deepEqual([fields['[name="apparel_type"]'].value,
  fields['[name="apparel_audience"]'].value,fields['[name="apparel_age"]'].value],
  ['Camiseta','Masculino','Adulto']);
 fields['input[name="category_id"]'].value='babylook';
 syncApparelCategoryMetadata(form,categories);
 assert.equal(fields['[name="apparel_audience"]'].value,'Feminino');
 assert.equal(fields['[name="apparel_age"]'].value,'Adulto');
});
test('no cadastro unificado, categoria antecede variações e campos redundantes ficam ocultos',()=>{
 assert.ok(appSource.includes('categorySelector(item)+\n    (!item?sizesSection()'));
 assert.doesNotMatch(variantsSource,/<select name="apparel_(type|audience|age)"/);
 for(const key of ['apparel_type','apparel_audience','apparel_age']){
  assert.match(variantsSource,new RegExp('type="hidden" name="'+key+'"'));
 }
 assert.match(variantsSource,/name="size_sku"/);
 assert.match(variantsSource,/name="size_ean"/);
 assert.match(variantsSource,/name="size_qty"/);
 assert.match(variantsSource,/Preencha SKU, EAN ou estoque para cadastrar uma variação/);
 assert.match(categorySource,/Em branco = não cadastrar/);
 assert.match(variantsSource,/filter\(row=>\{/);
 assert.match(categorySource,/data-size-variant="'\+h\(label\)\+'">/);
 assert.match(categorySource,/toggle\.checked=Boolean\(options\.length\)/);
 assert.match(categorySource,/placeholder="Em branco = não cadastrar"/);
});
test('variação em branco é ignorada, mas estoque explicitamente zerado é cadastrado',()=>{
 const row=(size,values)=>({dataset:{sizeVariant:size},querySelector:name=>({value:values[name.match(/name="([^"]+)/)?.[1]]??''})});
 const form={querySelectorAll:()=>[
  row('P',{size_qty:''}),
  row('M',{size_qty:'0'}),
  row('G',{size_qty:'4',size_sku:'SKU-G'})
 ]};
 assert.deepEqual(collectSizeVariants(form).map(({size,quantity})=>[size,quantity]),[['M',0],['G',4]]);
});
