import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/event-lot-catalog.js',import.meta.url),'utf8');
const lot=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const cats=[{id:'clothing',name:'Roupas',parent_id:null},
 {id:'shirts',name:'Camisetas',parent_id:'clothing'},
 {id:'gifts',name:'Presentes',parent_id:null}];
const sample=Array.from({length:102},(_,index)=>{
 const id='variant-'+index,modelId='model-'+index;
 return {
  group:{key:'model:'+modelId,title:'Modelo '+index,products:[{
   id,name:'Produto '+index,apparel_model_id:modelId,active:true,
   apparel_size:'M',apparel_color:'Verde',sku:'SKU-'+index,ean:'EAN-'+index,
   category_id:index%2?'gifts':'shirts',tags:[index%2?'lembrança':'religioso'],
   available:index%2?0:8,planned:0
  }]},
  model:{id:modelId,name:'Modelo '+index,category_id:index%2?'gifts':'shirts',
   image_paths:['model/'+index+'.webp']}
 };
});
const groups=sample.map(x=>x.group),models=sample.map(x=>x.model);
const catalog=lot.makeLotModels(groups,models,cats);

function makeForm(){
 const nodes={
  '[data-lot-search]':{value:''},
  '[data-lot-category]':{value:''},
  '[data-lot-tag]':{value:''},
  '[data-lot-stock]':{value:'all'},
  '[data-lot-sort]':{value:'name'},
  '[data-lot-results-list]':{innerHTML:''},
  '[data-action="lot-more"]':{hidden:false,textContent:''},
  '[data-lot-results]':{textContent:''},
  '[data-lot-tab-count]':{textContent:''}
 };
 const form={__lotPicker:{
  catalogue:catalog,selected:new Map(),productKeys:new Map(
   catalog.flatMap(g=>g.variants.map(p=>[p.id,g.key]))),
  opened:new Set(),view:'catalog',page:1,invalid:false,showAvailable:true,onRender:()=>{}
 },querySelector:selector=>selector==='[data-lot-catalog]'?scope:null};
 const scope={
  querySelector:selector=>nodes[selector]||null,
  querySelectorAll:()=>[]
 };
 return {form,nodes,scope};
}

test('modelos exibem a foto principal e a categoria hierárquica',()=>{
 assert.equal(catalog.length,102);
 assert.equal(catalog[0].photo,'model/0.webp');
 assert.deepEqual(catalog[0].ancestors,['clothing','shirts']);
 const html=lot.lotCatalogMarkup(groups,cats,models);
 assert.match(html,/Minha seleção/);
 assert.match(html,/Todas as tags/);
 assert.match(html,/Todas as categorias/);
});
test('catálogo de centenas usa carregamento incremental e filtra categorias descendentes',()=>{
 const {form,nodes}=makeForm();
 lot.filterLotCatalog(form);
 assert.equal((nodes['[data-lot-results-list]'].innerHTML.match(/<article class="lot-card(?: selected)?"/g)||[]).length,18);
 assert.equal(nodes['[data-action="lot-more"]'].hidden,false);
 nodes['[data-lot-category]'].value='clothing';
 lot.filterLotCatalog(form,{resetPage:true});
 assert.match(nodes['[data-lot-results]'].textContent,/51 de 102/);
 nodes['[data-lot-search]'].value='SKU-20';
 lot.filterLotCatalog(form,{resetPage:true});
 assert.match(nodes['[data-lot-results-list]'].innerHTML,/Modelo 20/);
 assert.doesNotMatch(nodes['[data-lot-results-list]'].innerHTML,/Modelo 22/);
});
test('escolha sobrevive à filtragem e impõe 10 modelos sem limitar variações do mesmo modelo',()=>{
 const {form,nodes}=makeForm();
 for(let i=0;i<10;i++){
  const input={value:'3',dataset:{id:'variant-'+i},closest:()=>null,setCustomValidity(){}};
  assert.equal(lot.onLotQuantityInput(form,input).ok,true);
 }
 assert.deepEqual(lot.selectedLotCount(form),{models:10,units:30});
 const extra={value:'1',dataset:{id:'variant-12'},closest:()=>null,setCustomValidity(){}};
 assert.equal(lot.onLotQuantityInput(form,extra).ok,false);
 assert.equal(extra.value,'0');
 nodes['[data-lot-search]'].value='SKU-80';
 lot.filterLotCatalog(form,{resetPage:true});
 assert.equal(lot.collectLotItems(form).length,10);
 form.__lotPicker.view='selected';
 lot.filterLotCatalog(form);
 assert.match(nodes['[data-lot-results]'].textContent,/10 modelo/);
});
test('nomes são escapados no HTML do catálogo',()=>{
 const html=lot.lotCatalogMarkup([{
  key:'product:p',title:'<script>alert(1)</script>',
  products:[{id:'p',name:'<script>alert(1)</script>',active:true,available:1}]
 }],[],[]);
 assert.doesNotMatch(html,/<script>/);
});
