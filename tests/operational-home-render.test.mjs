import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const op=await read('src/dashboard-operations.js');
const home=(await read('src/dashboard-home.js')).replace(/^import[^\n]+\n/,'');
const {renderOperationsDashboard}=await import('data:text/javascript;base64,'+
 Buffer.from(op+'\n'+home).toString('base64'));
const context={
 state:{
  profile:{role:'admin',full_name:'Administrador'},
  items:[{id:'p1',name:'Camiseta Azul',active:true,category_id:'cat',min_stock:4}],
  balances:[{product_id:'p1',event_id:null,quantity:12}],
  stockReservations:[{product_id:'p1',status:'ativa',quantity:3}],
  events:[],movements:[],categories:[{id:'cat',name:'Roupas',parent_id:null}],
  purchaseOrders:[],purchaseItems:[]
 },
 h:x=>String(x),uiIcon:x=>'<i>'+x+'</i>',
 qtyAvailable:()=>9,categoryChain:()=>[{id:'cat'}],
 purchaseSuggestions:()=>[],hasPermission:()=>true,canRegisterProducts:()=>true,
 permittedView:()=>true,unifiedOrderRecords:()=>[{
  id:'order1',kind:'loja',status:'separado',created_at:'2026-10-16T12:00:00Z',
  code:'001',target:'Loja Centro',total:4,workflow:null
 }],dateToday:()=> '2026-10-16'
};
test('indicadores reais usam o mesmo estoque físico e reservas já carregados',()=>{
 const html=renderOperationsDashboard(context);
 assert.match(html,/Físico na central/);
 assert.match(html,/>12<\/strong>/);
 assert.match(html,/9 disponíveis · 3 reservadas/);
 assert.match(html,/data-status="a_conferir"[\s\S]*?<strong>1<\/strong>/);
 assert.match(html,/Pedido #001 · Loja Centro/);
});
test('cards completos de produtos não poluem a home, mantendo catálogo separado',()=>{
 const html=renderOperationsDashboard(context);
 assert.doesNotMatch(html,/product-card-v3|grouped-inventory-grid/);
 assert.match(html,/data-dashboard-product-query/);
 assert.match(html,/data-action="home-category"/);
 assert.match(html,/data-action="dashboard-stock-shortage"/);
 assert.match(html,/data-action="open-tv"/);
});
test('permissões ocultam informações e atalhos administrativos sem acesso',()=>{
 const html=renderOperationsDashboard({...context,
  state:{...context.state,profile:{role:'consulta'}},
  permittedView:v=>v==='inicio',hasPermission:()=>false,canRegisterProducts:()=>false});
 assert.doesNotMatch(html,/data-action="dashboard-orders"|data-action="dashboard-order-open"/);
 assert.doesNotMatch(html,/data-action="product-new"|data-dashboard-product-query/);
 assert.doesNotMatch(html,/data-action="open-tv"/);
});
test('menu de produtos concentra utilitários sem esconder os saldos',async()=>{
 const workflow=await read('src/stock-workflows.js'),css=await read('operational-clean-ui.css');
 assert.match(workflow,/product-card-utilities/);
 assert.match(workflow,/<summary>Mais opções/);
 assert.match(workflow,/product-card-action-secondary-row/);
 assert.match(workflow,/product-card-action-danger-row/);
 assert.match(workflow,/stock-total-breakdown/);
 assert.match(workflow,/product-card-location/);
 assert.match(css,/\.product-card-utilities\[open\]/);
 assert.match(css,/\.c-work-grid/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
