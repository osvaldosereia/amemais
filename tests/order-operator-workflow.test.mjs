import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const {makeUnifiedOrders,unifiedOrderCard,unifiedOrdersPage,groupedOrderByLocation,filterUnifiedOrders}
 =await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const fv=await readFile(new URL('../src/final-verification.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../unified-orders.css',import.meta.url),'utf8');
const btn=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const sku={id:'sku1',name:'Camiseta HDH',apparel_size:'P',sku:'1000507',
 ean:'000100005073',gondola:'03',image_path:'foto.jpg'};
const args={eventBatches:[{id:'ev1',event_id:'e1',status:'separado',sequence:1}],
 eventBatchItems:[{batch_id:'ev1',product_id:'sku1',quantity:2}],
 events:[{id:'e1',name:'RETIRO ENCHEIVOS - NOBRES'}],
 products:[sku],reservations:[{event_batch_id:'ev1',product_id:'sku1',quantity:2,status:'ativa'}],
 codes:[{kind:'evento',order_id:'ev1',code:'AA003'}]};
test('AA003 mostra a etapa correta, localização e uma ação principal',()=>{
 const order=makeUnifiedOrders(args)[0];
 const html=unifiedOrderCard(order,{button:btn,canProcess:true,canVerify:true,canCancel:true,canDelete:true});
 for(const part of ['Pedido #AA003','RETIRO ENCHEIVOS','A conferir',
  'Separação concluída','Gôndola 03','000100005073','Conferir pedido',
  'Imprimir separação','Administração do pedido','Abrir pedido'])
  assert.ok(html.includes(part),part);
 assert.doesNotMatch(html,/Pronto para separar/);
 assert.doesNotMatch(html,/Confirmar saída/);
 assert.ok(html.indexOf('uo-product-preview')<html.indexOf('uo-details'));
 assert.ok(html.indexOf('uo-admin-actions')<html.indexOf('Excluir pedido'));
});
test('saída só aparece após conferência e permissão',()=>{
 const order=makeUnifiedOrders(args)[0];
 const unverified=unifiedOrderCard(order,{button:btn,canProcess:true,canVerify:true,canDispatch:true});
 const denied=unifiedOrderCard(order,{button:btn,canProcess:true,isVerified:true});
 const verified=unifiedOrderCard(order,{button:btn,canVerify:true,canDispatch:true,isVerified:true});
 assert.doesNotMatch(unverified,/event-batch-dispatch/);
 assert.doesNotMatch(denied,/event-batch-dispatch/);
 const ready=unifiedOrderCard({...order,workflow:{stage:'expedicao',items:{sku1:{requested:2,picked:2,counted:2}},has_difference:false}},{button:btn,canDispatch:true});
 assert.match(ready,/order-op-send/);
 assert.doesNotMatch(verified,/event-batch-dispatch/);
});
test('gôndola 03 e gôndola 3 agrupam e ordenam naturalmente',()=>{
 const groups=groupedOrderByLocation([
 {id:'a',gondola:'Gôndola 10',quantity:3},
 {id:'b',gondola:'03',quantity:2,prateleira:'B'},
 {id:'c',gondola:'Gôndola 3',quantity:4,prateleira:'A'},
 {id:'d',gondola:'',quantity:1}]);
 assert.deepEqual(groups.map(x=>x.title),['Gôndola 3','Gôndola 10','Sem gôndola cadastrada']);
 assert.deepEqual(groups[0].lines.map(x=>x.id),['c','b']);
 assert.equal(groups[0].total,6);
});
test('filtro de fila combina etapa, destino e texto',()=>{
 const order=makeUnifiedOrders(args)[0];
 const page=unifiedOrdersPage([order],{button:btn,canVerify:()=>true,isVerified:()=>false});
 for(const label of ['A separar','Em separação','A conferir','Em expedição','Com falta','Destino'])
  assert.ok(page.includes(label),label);
 const cards=[{dataset:{orderStatus:'separado',orderDestination:'evento',
  orderVerified:'false',orderIssue:'true',search:'aa003 retiro'},hidden:false}];
 const root={querySelectorAll:()=>cards,querySelector:()=>({hidden:true})};
 assert.equal(filterUnifiedOrders(root,'aa003','a_conferir','evento'),1);
 assert.equal(filterUnifiedOrders(root,'','pronto_saida','evento'),0);
 assert.equal(filterUnifiedOrders(root,'','a_conferir','franquia'),0);
 assert.equal(filterUnifiedOrders(root,'aa003','com_ocorrencia','evento'),1);
});
test('câmera está visível na conferência e usa handler preexistente',()=>{
 assert.match(fv,/data-action="verify-open-camera"/);
 assert.match(app,/if\(action==='verify-open-camera'\)/);
 assert.match(css,/uo-product-preview/);
 assert.match(css,/uo-list-view\[data-group-view="model"\]/);
});
