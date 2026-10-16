import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/event-simple.js',import.meta.url),'utf8');
const {eventCompactDetail}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const event={id:'ev',name:'Retiro Encheivos',status:'rascunho',starts_at:'2026-10-17'};
const inventory=()=>[];
test('temporária em preparação lista pedidos reais sem bloco legado de lista',()=>{
 const html=eventCompactDetail({event,ordersMarkup:'<div data-real-orders>Pedido #AA003</div>',
  tab:'pedidos',planItems:[],balances:[],products:[],groupInventory:inventory,button,canCreateOrder:true});
 assert.match(html,/data-real-orders/);
 assert.doesNotMatch(html,/Lista de separação|imprima em A4|0 unidades previstas/);
 assert.match(html,/data-action="event-unit-tab"/);
});
test('resumo não presume vendas nem confunde unidade e pedido',()=>{
 const html=eventCompactDetail({event,ordersMarkup:'<div>Pedido #AA003</div>',tab:'resumo',
  balances:[],products:[],groupInventory:inventory,button});
 assert.match(html,/Preparação/);
 assert.doesNotMatch(html,/vendas realizadas|vendas presumidas|1\. Separação/);
});
test('fechamento exibe devolução e bloqueia encerramento com saldo',()=>{
 const active={...event,status:'ativo'};
 const html=eventCompactDetail({event:active,balances:[{event_id:'ev',product_id:'sku',quantity:5}],
  products:[{id:'sku',name:'Produto'}],groupInventory:()=>[],tab:'fechamento',
  button,canClose:true,canSettle:true});
 assert.match(html,/data-action="event-settle"/);
 assert.doesNotMatch(html,/data-action="event-close"/);
 assert.match(html,/5 un/);
 assert.doesNotMatch(html,/data-action="event-sale"/);
});
