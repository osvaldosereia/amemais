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
test('A4 paisagem inclui foto grande, gôndola e cada SKU',()=>{
 const doc=stockPrintHTML(groups,{'only-model.jpg':'https://cdn.example/model.jpg','solo.jpg':'https://cdn.example/single.jpg'},'15/10/2026 14:15');
 assert.equal((doc.match(/<img /g)||[]).length,2);
 assert.equal((doc.match(/class="stock-card"/g)||[]).length,2);
 assert.equal((doc.match(/class="variant"/g)||[]).length,3);
 for(const v of ['Gôndola 01','Gôndola 02','1001','7891','Físico','Reservado','Mín.','A4 landscape','break-inside:avoid','window.print()'])
   assert.ok(doc.includes(v),v);
});
test('imagem não vaza HTML e arquivo não expõe URLs internas',()=>{
 const doc=stockPrintHTML(groups,{'only-model.jpg':'https://cdn.example/test?x="><script>x</script>','solo.jpg':'https://cdn.example/single.jpg'});
 assert.ok(!doc.includes('src="https://cdn.example/test?x=">'));
 assert.match(doc,/&quot;&gt;&lt;script&gt;/);
});
