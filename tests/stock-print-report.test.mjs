import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../src/stock-print-report.js',import.meta.url),'utf8');
const {stockPrintGroups,stockPrintHTML}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const items=[
 {id:'P',name:'Camiseta HDH',apparel_model_id:'m1',active:true,apparel_color:'Branco',apparel_size:'P',sku:'1001',ean:'7891',gondola:'01',min_stock:5,image_path:'wrong-variant-photo'},
 {id:'M',name:'Camiseta HDH',apparel_model_id:'m1',active:true,apparel_color:'Branco',apparel_size:'M',sku:'1002',ean:'7892',gondola:'02',min_stock:5},
 {id:'solo',name:'Produto Único',active:true,sku:'1003',gondola:'03',image_path:'solo.jpg'},
 {id:'old',name:'Produto Arquivado',active:false}
];
const models=[{id:'m1',name:'Camiseta HDH',image_path:'only-model.jpg'}];
const balances=[
 {product_id:'P',event_id:null,quantity:9},{product_id:'M',event_id:null,quantity:10},
 {product_id:'P',event_id:'temporary-store',quantity:25},{product_id:'solo',event_id:null,quantity:2}
];
const reservations=[{product_id:'P',status:'ativa',quantity:3},{product_id:'M',status:'liberada',quantity:5}];
const groups=stockPrintGroups(items,models,balances,reservations);
test('uma ficha por modelo com somente uma foto para todos os tamanhos',()=>{
 assert.equal(groups.length,2);
 const model=groups.find(g=>g.key==='model:m1');
 assert.equal(model.rows.length,2);
 assert.equal(model.photoPath,'only-model.jpg');
 assert.equal(model.rows[0].size,'P');
 assert.equal(model.rows[1].size,'M');
});
test('físico central não inclui temporária e reservado não baixa saldo físico',()=>{
 const model=groups.find(g=>g.key==='model:m1');
 assert.equal(model.total.physical,19);
 assert.equal(model.total.reserved,3);
 assert.equal(model.total.available,16);
 assert.equal(model.rows[0].location,'Gôndola 01');
 assert.equal(model.rows[1].location,'Gôndola 02');
});
test('A4 retrato inclui foto, gôndola e cada SKU sem ultrapassar o papel',()=>{
 const doc=stockPrintHTML(groups,{'only-model.jpg':'https://cdn.example/model.jpg','solo.jpg':'https://cdn.example/single.jpg'},'15/10/2026 14:15');
 assert.equal((doc.match(/<img /g)||[]).length,2);
 assert.equal((doc.match(/class="stock-card"/g)||[]).length,2);
 assert.equal((doc.match(/class="variant"/g)||[]).length,3);
 for(const v of ['Gôndola 01','Gôndola 02','1001','7891','Físico','Reservado','Mín.','A4 portrait','break-inside:avoid','window.print()'])
   assert.ok(doc.includes(v),v);
});
test('imagem não vaza HTML e arquivo não expõe URLs internas',()=>{
 const doc=stockPrintHTML(groups,{'only-model.jpg':'https://cdn.example/test?x="><script>x</script>','solo.jpg':'https://cdn.example/single.jpg'});
 assert.ok(!doc.includes('src="https://cdn.example/test?x=">'));
 assert.match(doc,/&quot;&gt;&lt;script&gt;/);
});


test('aplica filtro antes da impressão sem recuperar produtos fora da seleção',()=>{
 const onlySolo=stockPrintGroups(items.filter(p=>p.id==='solo'),models,balances,reservations);
 assert.equal(onlySolo.length,1);
 assert.equal(onlySolo[0].title,'Produto Único');
 const html=stockPrintHTML(onlySolo,{},'22/10/2026','Busca: Produto Único · Gôndola 03');
 assert.match(html,/Busca: Produto Único · Gôndola 03/);
 assert.match(html,/1 produtos · 1 variações/);
 assert.equal((html.match(/class="stock-card"/g)||[]).length,1);
 assert.doesNotMatch(html,/Camiseta HDH/);
 assert.match(html,/@page\{size:A4 portrait;margin:9mm\}/);
 assert.doesNotMatch(html,/A4 landscape/);
 assert.match(html,/grid-template-columns:33mm minmax\(0,1fr\)/);
});
test('respeita ordenação aplicada ao catálogo, independentemente do nome',()=>{
 const ordered=stockPrintGroups(items,models,balances,reservations,{
   groupOrder:['product:solo','model:m1']
 });
 assert.deepEqual(ordered.map(g=>g.key),['single:solo','model:m1']);
});
test('inativos aparecem somente quando a visualização de inativos está habilitada',()=>{
 const normal=stockPrintGroups(items,models,balances,reservations);
 assert.equal(normal.length,2);
 const includingInactive=stockPrintGroups(items,models,balances,reservations,{includeInactive:true});
 assert.equal(includingInactive.length,3);
 const html=stockPrintHTML(includingInactive);
 assert.match(html,/Produto Arquivado/);
 assert.match(html,/is-inactive/);
});
test('filtros impressos são escapados e o arquivo mantém orientação vertical',()=>{
 const html=stockPrintHTML(groups,{},'22/10/2026','Busca: <script>alert(1)</script>');
 assert.match(html,/Busca: &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/page-break-inside:avoid/);
 assert.match(html,/<style>[\s\S]*<\/style><\/head><body>/);
});
test('app reutiliza os filtros da lista para imprimir todos os resultados, não apenas a página atual',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/function selectedProductCatalogGroups\(\)/);
 assert.equal((app.match(/selectedProductCatalogGroups\(\)/g)||[]).length,3);
 assert.match(app,/const \{groups,matched,gondolas,codeResult\}=selectedProductCatalogGroups\(\)/);
 assert.match(app,/const \{groups:selectedGroups\}=selectedProductCatalogGroups\(\)/);
 assert.match(app,/const selection=selectedGroups\.flatMap\(group=>group\.products\)/);
 assert.match(app,/groupOrder:selectedGroups\.map\(group=>group\.key\)/);
 assert.match(app,/includeInactive:state\.showInactiveProducts/);
 assert.match(app,/if\(!selectedGroups\.length\)return toast/);
 const print=app.slice(app.indexOf('async function printStockReport(){'),app.indexOf('function printCommercialOrder('));
 assert.doesNotMatch(print,/stockPrintGroups\(state\.items/);
 assert.doesNotMatch(print,/\.slice\(0,/);
});
