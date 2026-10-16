import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const {makeUnifiedOrders,unifiedOrderCard,unifiedOrdersPage,filterUnifiedOrders}
 =await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const fixture={
 eventBatches:[{id:'pedido1',event_id:'evento1',status:'separado',created_at:'2026-10-15T16:18:00Z'}],
 eventBatchItems:[{batch_id:'pedido1',product_id:'sku1',quantity:2}],
 events:[{id:'evento1',name:'RETIRO ENCHEIOS - NOBRES'}],
 products:[{id:'sku1',name:'Produto',gondola:'03',sku:'S100',ean:'789'}],
 codes:[{kind:'evento',order_id:'pedido1',code:'AA003'}],
 reservations:[{event_batch_id:'pedido1',product_id:'sku1',quantity:2,status:'ativa'}]
};
const order=makeUnifiedOrders(fixture)[0];

test('card compacto mantém ação operacional fora do detalhamento',()=>{
 const html=unifiedOrderCard(order,{button,canVerify:true,canCancel:true,canDelete:true});
 assert.match(html,/uo-compact-metrics/);
 assert.match(html,/data-action="order-op-check"/);
 assert.ok(html.indexOf('data-action="order-op-check"')<html.indexOf('uo-order-open'));
 assert.match(html,/Abrir pedido/);
 assert.match(html,/Administração do pedido/);
 assert.match(html,/data-action="admin-order-delete-open"/);
 assert.match(html,/2 unidades/);
});

test('alteração justificada antiga não cria alerta operacional falso',()=>{
 const html=unifiedOrderCard({...order,adjustments:[{
  original_quantity:4,revised_quantity:2,reason:'Cliente reduziu o pedido'
 }]},{button,canVerify:true});
 assert.doesNotMatch(html,/uo-exception-badge/);
 assert.match(html,/Alterações justificadas/);
});

test('falta ativa mostra causa concreta sem confundir com conferência',()=>{
 const html=unifiedOrderCard({...order,status:'pendente_estoque',missing:1,workflow:null},
  {button,canAdjust:true,canProcess:true});
 assert.match(html,/Falta 1 unidade/);
 assert.match(html,/uo-exception-badge/);
 assert.match(html,/data-order-issue="true"/);
});

test('diferença de separação identifica item, esperado e contado',()=>{
 const html=unifiedOrderCard({...order,workflow:{stage:'conferencia',has_difference:true,
  items:{sku1:{picked:1,counted:null,pick_reason:'Caixa danificada'}}}},
  {button,canVerify:true});
 assert.match(html,/Separado 1 de 2/);
 assert.match(html,/Caixa danificada/);
 assert.match(html,/uo-exception-badge/);
});

test('indicadores filtram, e ordenação está disponível na fila',()=>{
 const html=unifiedOrdersPage([order],{button});
 assert.match(html,/data-action="uo-summary-filter"/);
 assert.match(html,/data-unified-sort/);
 assert.match(html,/data-status="a_conferir"/);
 assert.match(html,/data-unified-destination/);
});

test('filtro de etapa e destino persiste com ordenação',()=>{
 const cards=[
  {dataset:{orderStatus:'separado',orderStage:'conferencia',orderDestination:'evento',orderIssue:'false',orderCreated:'2026-10-15T15:00:00Z',search:'pedido um'},hidden:false},
  {dataset:{orderStatus:'pendente_estoque',orderStage:'',orderDestination:'loja',orderIssue:'true',orderCreated:'2026-10-15T16:00:00Z',search:'pedido dois'},hidden:false}
 ];
 const reordered=[];
 const container={querySelectorAll:()=>cards,querySelector:selector=>
  selector==='.uo-list'?{appendChild:node=>reordered.push(node)}:{hidden:true}};
 assert.equal(filterUnifiedOrders(container,'','a_conferir','evento','prioridade'),1);
 assert.equal(cards[0].hidden,false);
 assert.equal(cards[1].hidden,true);
 assert.equal(filterUnifiedOrders(container,'','todos','todos','antigos'),2);
 assert.equal(reordered.at(-2),cards[0]);
 assert.equal(reordered.at(-1),cards[1]);
});
