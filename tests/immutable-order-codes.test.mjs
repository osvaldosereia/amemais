import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function moduleAt(file){
 const content=await readFile(new URL(file,import.meta.url),'utf8');
 return import('data:text/javascript;base64,'+Buffer.from(content).toString('base64'));
}
const {makeUnifiedOrders,unifiedOrderCard}=await moduleAt('../src/unified-orders.js');
const {pickingThermalHTML}=await moduleAt('../src/thermal-picking.js');
const {renderStoreHub}=await moduleAt('../src/store-hub.js');
const sql=await readFile(new URL('../supabase/migrations/20261015212500_immutable_five_character_order_codes.sql',import.meta.url),'utf8');
const client=await readFile(new URL('../pedido.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const uuid='3ce6a4d5-2d70-4d8c-8729-e6522991634a';
const fixed='AA003';
const testCode={kind:'evento',order_id:uuid,code:fixed};
const button=(label,action,extra='',type='')=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>';
const event={id:'event-1',name:'Retiro Encheivos'};
const batch={id:uuid,event_id:'event-1',status:'aguardando',created_at:'2026-10-15T18:00:00Z',sequence:1};
const order=makeUnifiedOrders({eventBatches:[batch],events:[event],codes:[testCode]})[0];

test('o código é um registro único criado no INSERT, sem mudança por recarregar',()=>{
 assert.match(sql,/CREATE SEQUENCE IF NOT EXISTS public\.order_public_code_sequence/);
 assert.match(sql,/MAXVALUE 675324 NO CYCLE/);
 assert.match(sql,/PRIMARY KEY\(kind,order_id\)/);
 assert.match(sql,/code varchar\(5\) NOT NULL UNIQUE/);
 assert.match(sql,/AFTER INSERT ON public\.avulso_orders/);
 assert.match(sql,/AFTER INSERT ON public\.store_orders/);
 assert.match(sql,/AFTER INSERT ON public\.event_pick_batches/);
 assert.match(sql,/WHERE NOT EXISTS/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/GRANT SELECT ON public\.order_public_codes TO authenticated/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|INSERT|DELETE) ON public\.order_public_codes TO authenticated/);
});
test('mesmo identificador na fila e no recibo térmico de 80 mm',()=>{
 assert.equal(order.id,uuid);
 assert.equal(order.code,fixed);
 const html=unifiedOrderCard(order,{button});
 assert.match(html,/Lote #AA003/);
 assert.doesNotMatch(html,/#3CE6A4D5/);
 assert.match(html,/data-search="[^"]*aa003/);
 const print=pickingThermalHTML({...order,lines:[{modelTitle:'Camiseta',quantity:2,sku:'ABC',ean:'0123',gondola:'3'}]});
 assert.match(print,/<title>Separação térmica LOTE #AA003<\/title>/);
 assert.match(print,/LOTE #AA003/);
 assert.match(print,/Pedido: AA003/);
 assert.doesNotMatch(print,/3ce6a4d5-2d70-4d8c-8729-e6522991634a/i);
});
test('continua igual em impressões sucessivas e ao reconstruir a lista de pedidos',()=>{
 const args={eventBatches:[batch],events:[event],codes:[testCode]};
 const again=makeUnifiedOrders(args)[0];
 assert.equal(again.code,fixed);
 const a=pickingThermalHTML({...order,lines:[]},{printedAt:'09:15'});
 const b=pickingThermalHTML({...again,lines:[]},{printedAt:'10:30'});
 assert.match(a,/LOTE #AA003/);
 assert.match(b,/LOTE #AA003/);
});
test('referência é mantida até no comprovante recebido por token',()=>{
 assert.match(sql,/'code',v_code/);
 assert.match(client,/data\.code/);
 assert.match(app,/orderCode\('loja',orderId\)/);
 assert.match(app,/orderCodes.*order_public_codes|order_public_codes.*orderCodes/);
 assert.match(app,/codes:state\.orderCodes/);
});
