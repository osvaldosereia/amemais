import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/cdsb-purchases.js');
const css=read('buy-purchase-drawer.css');
const app=read('src/app.js');
const {purchaseCardVariantStock,purchasesPage,purchasingGroups}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
);
const sizes=['Tamanho GG','Tamanho M','Tamanho P','Tamanho G','Tamanho PP'];
const products=sizes.map((size,i)=>({
 id:'sku'+i,name:'CAMISETA DEMONSTRAÇÃO',sku:'SKU'+i,apparel_model_id:'mod1',
 apparel_size:size,active:true,category_id:'cat1',supplier_id:'supplier1',min_stock:3
}));
const balances=[
 {product_id:'sku0',quantity:0,event_id:null},
 {product_id:'sku1',quantity:10,event_id:null},
 {product_id:'sku1',quantity:99,event_id:'event1'},
 {product_id:'sku2',quantity:3,event_id:null},
 {product_id:'sku3',quantity:7,event_id:null},
 {product_id:'sku4',quantity:2,event_id:null}
];
const reservations=[{product_id:'sku1',quantity:4,status:'ativa'},{product_id:'sku3',quantity:1,status:'ativa'}];
const base={products,models:[{id:'mod1',name:'CAMISETA DEMONSTRAÇÃO'}],balances,reservations,
 suppliers:[{id:'supplier1',name:'Clube Marca',active:true}],
 categories:[{id:'cat1',name:'Normal'}],
 button:(text,action,attrs='')=>'<button type="button" data-action="'+action+'" '+attrs+'>'+text+'</button>'};
test('mostrar todos os cinco tamanhos no card fechado, inclusive sem estoque',()=>{
 const html=purchasesPage(base);
 const card=html.split('<article class="buy-group-card buy-quick-card"')[1].split('</article>')[0];
 const summary=card.match(/<section class="buy-card-stock"[\s\S]*?<\/section>/)?.[0];
 assert.ok(summary,'a seção precisa estar visível antes de abrir compra');
 assert.match(summary,/Estoque por variação/);
 assert.match(summary,/Disponível/);
 assert.equal((summary.match(/class="buy-card-stock-item/g)||[]).length,5);
 const labels=[...summary.matchAll(/class="buy-card-stock-size">([^<]*)<\/span>/g)].map(m=>m[1]);
 assert.deepEqual(labels,['PP','P','M','G','GG']);
 const amounts=[...summary.matchAll(/class="buy-card-stock-qty"[^>]*>([^<]+)<\/b>/g)].map(m=>m[1]);
 assert.deepEqual(amounts,['2','3','6','6','0']); // reservado descontado; evento fora do CD ignorado
 assert.match(summary,/buy-card-stock-item is-zero/);
 assert.doesNotMatch(summary,/data-action=|<button|<input/);
 assert.ok(card.indexOf('class="buy-card-stock"')<card.indexOf('class="buy-card-toolbar"'));
 assert.match(card,/data-action="buy-open-group"/);
 assert.match(card,/Nenhuma variação selecionada/);
 assert.match(card,/class="buy-variation-disclosure buy-one-panel"/);
});
test('somente os SKUs efetivos do fornecedor correto aparecem no card',()=>{
 const split=products.map((p,i)=>({...p,supplier_id:i===0?'supplier2':'supplier1'}));
 const groups=purchasingGroups(split,base.models,balances,reservations,[],[]);
 assert.equal(groups.length,2);
 const html=purchasesPage({...base,products:split,suppliers:[...base.suppliers,{id:'supplier2',name:'Outro',active:true}]});
 const summaries=[...html.matchAll(/<section class="buy-card-stock"[\s\S]*?<\/section>/g)].map(x=>x[0]);
 assert.equal(summaries.length,2);
 assert.deepEqual(summaries.map(x=>(x.match(/class="buy-card-stock-item/g)||[]).length).sort(),[1,4]);
});
test('produto único e tamanhos de mesma sigla com cores são identificáveis',()=>{
 const markup=purchaseCardVariantStock([
  {apparel_size:null,free:0},
  {apparel_size:'M',apparel_color:'Azul',free:11},
  {apparel_size:'M',apparel_color:'Vermelho',free:4}
 ]);
 assert.match(markup,/Único/);
 assert.match(markup,/M · Azul/);
 assert.match(markup,/M · Vermelho/);
 assert.equal((markup.match(/class="buy-card-stock-item/g)||[]).length,3);
});
test('rótulos escapam HTML, saldos não geram controles e CSS mantém grade de três colunas',()=>{
 const html=purchaseCardVariantStock([{apparel_size:'<img src=x>',free:4}]);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<img src=x>/);
 assert.doesNotMatch(html,/data-buy-inline-select|data-buy-inline-qty/);
 assert.match(css,/\.buy-page \.buy-quick-card \.buy-card-stock-grid\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.buy-card-stock-item\.is-zero/);
 assert.match(app,/cdsb-purchases\.js\?v=20261022stockcards1/);
 assert.match(read('index.html'),/buy-purchase-drawer\.css\?v=20261022stockcards1/);
});
