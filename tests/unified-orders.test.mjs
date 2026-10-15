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
 assert.match(html,/10 unidades/);
 assert.match(html,/6 reservadas/);
 assert.match(html,/4 faltam/);
 assert.doesNotMatch(html,/order-retry/);
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
 assert.match(html,/Montar pedido/);
 assert.doesNotMatch(html,/Pedido avulso/);
 assert.doesNotMatch(html,/6 reservadas/);
 assert.doesNotMatch(html,/Confirmar saída/);
});
test('concluídos, cancelados e expirados não exibem falsas faltas após consumir reserva',()=>{
 for(const status of ['concluido','cancelado','expirado','despachado']){
  const result=makeUnifiedOrders({...props,avulsoOrders:[{...props.avulsoOrders[0],
   fulfillment_status:status}],reservations:[]});
  const order=result.find(x=>x.kind==='avulso');
  assert.equal(order.missing,0);
  const html=unifiedOrderCard(order,{button});
  assert.doesNotMatch(html,/\d+ faltam/);
  assert.match(html,/Saída\/encerramento registrado/);
 }
});
test('pedidos legados ficam sem avaliação, em vez de falta confirmada',()=>{
 const order=makeUnifiedOrders({...props,avulsoOrders:[{...props.avulsoOrders[0],
  fulfillment_status:'legado'}],reservations:[]}).find(x=>x.kind==='avulso');
 assert.equal(order.missing,0);
 const html=unifiedOrderCard(order,{button,canProcess:true});
 assert.match(html,/Pedido anterior ao novo sistema/);
 assert.match(html,/Pendente de preparação/);
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
 assert.match(html,/Gôndola 01/);
 assert.match(html,/Separado/);
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

test('uma foto do modelo atende todos os tamanhos no card, na conferência e no A4',()=>{
 const modelId='model-x';
 const products=['P','M','G'].map((size,i)=>({
  id:'p-'+i,name:'Camiseta',apparel_model_id:modelId,apparel_size:size,
  apparel_color:'Branco',sku:'SKU'+i,gondola:'01',
  image_path:i===0?'foto/modelo.jpg':null
 }));
 const id='pedido-fotos';
 const order=makeUnifiedOrders({
  avulsoOrders:[{id,source:'interno',customer_name:'Teste',fulfillment_status:'reservado'}],
  avulsoItems:products.map(p=>({order_id:id,product_id:p.id,quantity:1})),
  products,models:[{id:modelId,name:'Camiseta',image_path:'foto/modelo.jpg'}]
 })[0];
 const card=unifiedOrderCard(order);
 const picking=pickingOrderRows(order);
 const html=pickingA4HTML(order,{photoUrls:{'foto/modelo.jpg':'https://example.com/modelo.jpg'}});
 assert.equal((card.match(/class="uo-model-photo"/g)||[]).length,1);
 assert.equal((picking.match(/class="uo-model-photo"/g)||[]).length,1);
 assert.equal((html.match(/class="lot-photo"/g)||[]).length,1);
 for(const size of ['P','M','G'])assert.match(picking,new RegExp('Branco · '+size));
 assert.match(html,/Gôndola 01/);
 assert.match(html,/document.images/);
});
