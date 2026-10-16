import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
async function load(name){
 const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8');
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {makeUnifiedOrders,groupedOrderLines,unifiedOrderCard,unifiedOrdersPage,
 pickingOrderRows,pickingA4HTML}=await load('unified-orders.js');
const {selectedEventModels,eventLotsOverview,eventLotForm}=await load('event-lots.js');
const b='00000000-0000-0000-0000-000000000003',e='00000000-0000-0000-0000-000000000002';
const products=[
 {id:'p1',name:'Camiseta M',apparel_model_id:'model1',apparel_size:'M',
  apparel_color:'Branco',sku:'SM',ean:'000100001129',gondola:'02',prateleira:'A',active:true},
 {id:'p2',name:'Camiseta GG',apparel_model_id:'model1',apparel_size:'GG',
  apparel_color:'Branco',sku:'SG',ean:'000100001990',gondola:'02',active:true},
 {id:'p3',name:'Chapéu 12',apparel_model_id:'model2',apparel_size:'12',
  apparel_color:'Única',sku:'H12',ean:'000100009999',gondola:'05',active:true}
];
const batches=[{id:b,event_id:e,status:'aguardando',sequence:2,
 created_at:'2026-10-15T00:00:00Z',created_by:'admin'}];
const event={id:e,name:'Loja Temporária Outubro',status:'ativo'};
const lines=[
 {batch_id:b,product_id:'p1',quantity:2,picked:0},
 {batch_id:b,product_id:'p2',quantity:3,picked:0},
 {batch_id:b,product_id:'p3',quantity:1,picked:0}
];
const reservations=lines.map(l=>({event_batch_id:b,product_id:l.product_id,status:'ativa',quantity:l.quantity}));
const data={eventBatches:batches,eventBatchItems:lines,events:[event],products,
 models:[{id:'model1',name:'Camiseta Masculina HDH'},{id:'model2',name:'Chapéu'}],reservations};
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';

test('tamanhos da mesma camiseta contam como um único modelo',()=>{
 assert.equal(selectedEventModels(lines.map(x=>x),products),2);
 assert.equal(selectedEventModels(lines.slice(0,2),products),1);
});
test('fila única inclui lote com identificação da loja e unidades reservadas',()=>{
 const records=makeUnifiedOrders(data);
 assert.equal(records.length,1);
 assert.equal(records[0].kind,'evento');
 assert.equal(records[0].sequence,2);
 assert.equal(records[0].target,'Loja Temporária Outubro');
 assert.equal(records[0].reserved,6);
 assert.equal(records[0].missing,0);
 const html=unifiedOrderCard(records[0],{button,canProcess:true,canDispatch:true,canCancel:true});
 assert.match(html,/Pedido/);
 assert.match(html,/order-op-pick/);
 assert.match(html,/Abrir pedido/);
 assert.match(html,/Camiseta Masculina HDH/);
 assert.match(html,/02 variação|2 variaç/);
 assert.match(html,/Gôndola 05/);
});
test('separação incompleta pode ser retomada e possui contagem preexistente',()=>{
 const progressive={...data,eventBatches:[{...batches[0],status:'em_separacao'}],
  eventBatchItems:[{...lines[0],picked:1},{...lines[1],picked:2},lines[2]]};
 const record=makeUnifiedOrders(progressive)[0];
 const html=pickingOrderRows(record);
 assert.match(html,/continuar/i);
 assert.match(html,/data-pick-qty/);
 assert.match(html,/value="1"/);
 assert.match(html,/value="2"/);
 assert.match(html,/event-batch-scan/);
});
test('impressão A4 compacta tem gôndola, identificação, modelo e campos em branco',()=>{
 const order=makeUnifiedOrders(data)[0];
 const html=pickingA4HTML(order,{printedAt:'15/10/2026 08:00'});
 assert.match(html,/@page\{size:A4 portrait/);
 assert.match(html,/DESTINO: Loja Temporária Outubro/);
 assert.match(html,/Pedido/);
 assert.match(html,/Gôndola 02/);
 assert.match(html,/Gôndola 05/);
 assert.match(html,/Camiseta Masculina HDH/);
 assert.match(html,/000100001129/);
 assert.match(html,/class="write"/);
 assert.match(html,/class="center check"/);
 assert.doesNotMatch(html,/>0<\/td>/);
});
test('separação mostra apenas trabalho em aberto, sem lotes enviados',()=>{
 const done={...batches[0],id:'enviado',status:'enviado'};
 const records=makeUnifiedOrders({...data,eventBatches:[batches[0],done]});
 const html=unifiedOrdersPage(records,{button,separationOnly:true,canProcess:()=>true});
 assert.match(html,/Separação/);
 assert.match(html,/Pedido/);
 assert.doesNotMatch(html,/data-order-id="enviado"/);
});
test('gestão do evento permite vários lotes e não altera enviado',()=>{
 const overview=eventLotsOverview({event,batches:[
  {...batches[0],sequence:1,status:'enviado'},
  {...batches[0],id:'outro',sequence:2,status:'aguardando'}],
  items:lines,products,button,canCreate:true});
 assert.match(overview,/Novo pedido/);
 assert.match(overview,/Pedido/);
 assert.match(overview,/Pedido/);
 assert.match(overview,/event-batch-go/);
});
test('formulário de lotes explica limite de dez modelos e destino da fila',()=>{
 const html=eventLotForm('<p>Form</p>',{});
 assert.match(html,/0 modelos/);
 assert.match(html,/Observação do pedido/);
});
