import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const catalog=await readFile(new URL('../src/catalog-order.js',import.meta.url),'utf8');
const {catalogMatchesQuery,availableGondolas,gondolaKey,filterCatalogGondola,orderCatalogGroups,catalogSortOptions}
  =await import('data:text/javascript;base64,'+Buffer.from(catalog).toString('base64'));
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const sku=await readFile(new URL('../src/sku-panel.js',import.meta.url),'utf8');
const css=await readFile(new URL('../product-card-actions-direct.css',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/202610160003_direct_stock_damage_exit.sql',import.meta.url),'utf8');
const item=(id,gondola,qty)=>({id,name:'Camisa HDH '+id,sku:'COD-'+id,ean:'000010'+id,
  gondola,quantity:qty,active:true,tags:[],created_at:'2026-10-15T01:00:00Z'});
const a=item('P','03',8),b=item('M','Gôndola 03',5),c=item('G','12',2),d=item('GG','',0);
const groups=[
 {key:'model:2',title:'Zebra',products:[c,d]},
 {key:'model:1',title:'Águia',products:[a,b]}
];
const qty=Object.fromEntries([a,b,c,d].map(p=>[p.id,p.quantity]));
test('busca tolera acentos, palavras separadas e correspondência exata de SKU/EAN',()=>{
 assert.equal(catalogMatchesQuery({...a,name:'Camiseta Básica preta'},'camiseta preta'),true);
 assert.equal(catalogMatchesQuery({...a,name:'Blusa Básica'},'basica'),true);
 assert.equal(catalogMatchesQuery(a,'000010P'),true);
 assert.equal(catalogMatchesQuery(a,'COD-P'),true);
 assert.equal(catalogMatchesQuery(a,'SKU ausente'),false);
 assert.equal(catalogMatchesQuery(a,'camisa zeta','Zeta Premium'),true);
});
test('normaliza gôndolas e não duplica Gôndola 03 e 3',()=>{
 assert.equal(gondolaKey('Gôndola 03'),'3');
 assert.equal(gondolaKey('3'),'3');
 const options=availableGondolas([a,b,c,d]);
 assert.deepEqual(options.map(g=>g.key),['3','12']);
 assert.equal(filterCatalogGondola(groups,'3').length,1);
 assert.equal(filterCatalogGondola(groups,'12')[0].title,'Zebra');
});
test('ordena modelos inteiros por nome, saldos, gôndola e cadastro',()=>{
 const available=id=>qty[id];
 assert.deepEqual(orderCatalogGroups(groups,'name-asc',available).map(g=>g.title),['Águia','Zebra']);
 assert.deepEqual(orderCatalogGroups(groups,'name-desc',available).map(g=>g.title),['Zebra','Águia']);
 assert.deepEqual(orderCatalogGroups(groups,'available-desc',available).map(g=>g.title),['Águia','Zebra']);
 assert.deepEqual(orderCatalogGroups(groups,'available-asc',available).map(g=>g.title),['Zebra','Águia']);
 assert.deepEqual(orderCatalogGroups(groups,'gondola').map(g=>g.title),['Águia','Zebra']);
 assert.ok(catalogSortOptions.some(([k])=>k==='physical-desc'));
 assert.ok(catalogSortOptions.some(([k])=>k==='recent'));
});
test('menu de Produtos usa ordenação e gôndola independentes dos filtros e do grupo de SKU',()=>{
 assert.match(app,/catalogSort:'name-asc'/);
 assert.match(app,/filterCatalogGondola\(groupInventory\(expanded,state\.apparelModels\),state\.gondolaFilter\)/);
 assert.match(app,/orderCatalogGroups\(/);
 assert.match(app,/data-product-sort/);
 assert.match(app,/data-product-gondola/);
 assert.match(app,/submitProductSearch\(event\.target\.value\)/);
 assert.match(app,/scanEAN\(code=>searchAndManageSku\(code\)\)/);
 assert.doesNotMatch(app,/if\(event\.key==='Enter'&&event\.target\.id==='product-search'&&canOpenSkuManager\(\)\)/);
});
test('desktop mantém os cinco botões alinhados e mobile conserva duas faixas',()=>{
 assert.match(css,/@media\(min-width:761px\)/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
 assert.match(css,/display:contents!important/);
 assert.match(css,/@media\(max-width:760px\)/);
});
test('avaria é baixa direta sem quarantena e retorna somente por nova entrada',()=>{
 assert.doesNotMatch(app,/rpc\('quarantine_central_stock'/);
 assert.match(app,/rpc\('record_stock_exception'/);
 assert.match(app,/Se recuperar, faça uma entrada manual/);
 assert.match(sku,/Avaria — baixa imediata/);
 assert.doesNotMatch(sku,/Avarias ficam suspensas/);
 assert.doesNotMatch(migration,/then raise exception 'Avarias devem ser registradas/);
 assert.match(migration,/has_permission\('stock.exit'\)/);
 assert.match(migration,/public\.stock_operation_batch\('saida'/);
 assert.match(migration,/exception_reason=p_reason/);
 assert.match(migration,/revoke all on function public\.record_stock_exception/);
});
