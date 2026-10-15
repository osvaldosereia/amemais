import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const {makeUnifiedOrders,unifiedOrderCard,unifiedOrdersPage,pickingOrderRows,
 shortageEditRows,pickingA4HTML,filterUnifiedOrders}=await import('data:text/javascript;base64,'+
 Buffer.from(source).toString('base64'));
const customer='00000000-0000-0000-0000-000000000011';
const store='00000000-0000-0000-0000-000000000012';
const productId='00000000-0000-0000-0000-000000000099';
const prod=[{id:productId,name:'Camiseta HDH',apparel_color:'Preta',apparel_size:'M',
 sku:'SKU123',ean:'000100001129',gondola:'01'}];
const stores=[{id:'central',name:'Estoque central'},{id:'filial',name:'Filial Centro'}];
const r=[
 {avulso_order_id:customer,order_id:null,product_id:productId,quantity:6,status:'ativa'},
 {avulso_order_id:null,order_id:store,product_id:productId,quantity:2,status:'ativa'}
];
const props={
 avulsoOrders:[{id:customer,customer_name:'Cliente de teste',created_at:'2026-10-14T10:00:00Z',
  source:'interno',fulfillment_status:'pendente_estoque'}],
 avulsoItems:[{order_id:customer,product_id:productId,quantity:10}],
 storeOrders:[{id:store,from_store_id:'central',to_store_id:'filial',
  request_type:'central',status:'aprovado',created_by:'operator',created_at:'2026-10-14T11:00:00Z'}],
 storeItems:[{order_id:store,product_id:productId,quantity:2}],
 reservations:r,products:prod,stores
};
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
test('unifica dois bancos de pedidos sem duplicar reservas',()=>{
 const list=makeUnifiedOrders(props);
 assert.equal(list.length,2);
 assert.equal(list[0].kind,'loja');
 assert.equal(list[0].missing,0);
 assert.equal(list[1].kind,'avulso');
 assert.equal(list[1].total,10);
 assert.equal(list[1].reserved,6);
 assert.equal(list[1].missing,4);
 assert.equal(list.reduce((total,o)=>total+o.reserved,0),8);
});
test('pedidos com falta mostram quantidade original, reservada e diferença',()=>{
 const order=makeUnifiedOrders(props).find(x=>x.kind==='avulso');
 const html=unifiedOrderCard(order,{button,canProcess:true,canCancel:true});
 assert.match(html,/10 solicitadas/);
 assert.match(html,/6 reservadas/);
 assert.match(html,/4 em falta/);
 assert.match(html,/order-retry/);
 assert.match(html,/order-shortage-adjust/);
 assert.doesNotMatch(html,/avulso-dispatch/);
});
test('pedido reservado mostra conferência; separado mostra saída',()=>{
 const base=makeUnifiedOrders(props).find(x=>x.kind==='avulso');
 const reserved=unifiedOrderCard({...base,status:'reservado',missing:0},{button,canProcess:true});
 const separated=unifiedOrderCard({...base,status:'separado',missing:0},{button,canProcess:true});
 assert.match(reserved,/avulso-pick/);
 assert.doesNotMatch(reserved,/avulso-dispatch/);
 assert.match(separated,/avulso-dispatch/);
 assert.doesNotMatch(separated,/avulso-pick/);
});
test('portal da franquia lista somente os seus pedidos sem exibir saldo central',()=>{
 const out=makeUnifiedOrders({...props,portal:true,userId:'operator'});
 assert.equal(out.length,1);
 const html=unifiedOrdersPage(out,{button,portal:true,canStore:true,canProcess:()=>false});
 assert.match(html,/Pedidos/);
 assert.match(html,/Pedido de loja/);
 assert.doesNotMatch(html,/Pedido avulso/);
 assert.doesNotMatch(html,/6 reservadas/);
 assert.doesNotMatch(html,/Confirmar saída/);
});
test('conferência EAN apresenta campos e não baixa estoque ao separar',()=>{
 const order=makeUnifiedOrders(props)[0];
 const html=pickingOrderRows(order);
 assert.match(html,/order-scan-ean/);
 assert.match(html,/data-pick-qty/);
 assert.match(html,/data-expected="2"/);
 assert.match(html,/000100001129/);
});
test('ajuste de faltas mantém quantidades atuais e exige justificativa',()=>{
 const order=makeUnifiedOrders(props)[1];
 const html=shortageEditRows(order);
 assert.match(html,/data-shortage-qty/);
 assert.match(html,/data-original="10"/);
 assert.match(html,/Justificativa obrigatória/);
});
test('A4 gera tabela para separação com código e espaço de conferência',()=>{
 const order=makeUnifiedOrders(props)[1];
 const html=pickingA4HTML(order,{printedAt:'14/10/2026 15h'});
 assert.match(html,/@page\{size:A4 portrait/);
 assert.match(html,/Camiseta HDH/);
 assert.match(html,/SKU123/);
 assert.match(html,/000100001129/);
 assert.match(html,/Total solicitado: 10/);
 assert.match(html,/Faltando: 4/);
 assert.match(html,/window\.print/);
});
test('dados de cliente não são injetados no HTML',()=>{
 const order={...makeUnifiedOrders(props)[1],target:'<script>alert(1)</script>'};
 const html=unifiedOrderCard(order,{button});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
test('filtro mostra somente os cartões visíveis e mensagem de lista vazia',()=>{
 const cards=[
  {dataset:{orderStatus:'reservado',search:'cliente a'},hidden:false},
  {dataset:{orderStatus:'pendente_estoque',search:'filial b'},hidden:false},
  {dataset:{orderStatus:'concluido',search:'cliente c'},hidden:false}
 ];
 const empty={hidden:true};
 const container={querySelectorAll:()=>cards,querySelector:()=>empty};
 assert.equal(filterUnifiedOrders(container,'','pendente_estoque'),1);
 assert.deepEqual(cards.map(x=>x.hidden),[true,false,true]);
 assert.equal(filterUnifiedOrders(container,'não existe','todos'),0);
 assert.equal(empty.hidden,false);
});
