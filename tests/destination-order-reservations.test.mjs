import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const paths=['../src/app.js','../src/unified-orders.js','../src/event-lots.js',
 '../src/event-lot-catalog.js','../src/thermal-picking.js',
 '../supabase/migrations/20261016_strict_destination_orders_reserve_stock.sql',
 '../supabase/migrations/20261016_disable_customer_orders_use_destination.sql',
 '../supabase/migrations/20261016_strict_temporary_order_revision_stock.sql'];
const [app,orders,lots,catalog,thermal,db,disable,revise]=await Promise.all(paths.map(p=>
 readFile(new URL(p,import.meta.url),'utf8')));
const moduleSource=await import('data:text/javascript;base64,'+
 Buffer.from(orders).toString('base64'));
const {unifiedOrdersPage}=moduleSource;
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
test('novo pedido seleciona destino real sem criar pedido de cliente',()=>{
 assert.match(app,/function orderDestinationPicker\(\)/);
 assert.match(app,/selectField\('Unidade de destino','destination'/);
 assert.match(app,/storeDestinations\.map/);
 assert.match(app,/eventDestinations\.map/);
 assert.match(app,/if\(type==='unified-order-destination'\)/);
 assert.match(app,/storeOrderModal\(destination\.slice\(6\)\)/);
 assert.match(app,/eventBatchModal\(destination\.slice\(6\)\)/);
 const markup=unifiedOrdersPage([],{button,canStore:true,canEventBatch:true,canLink:true});
 assert.match(markup,/data-action="unified-order-new"/);
 assert.doesNotMatch(markup,/customer-link-new|Links de acesso para clientes|Montar lote/);
 assert.match(disable,/Pedidos para clientes avulsos foram desativados/);
});
test('pedido temporário aceita mais de dez modelos e usa código pedido',()=>{
 assert.match(catalog,/if\(items.length>5000\)/);
 assert.doesNotMatch(catalog,/models>10/);
 assert.doesNotMatch(lots,/de 10 modelos/);
 assert.match(lots,/Pedidos da loja temporária/);
 assert.match(lots,/Pedido #/);
 assert.match(thermal,/const title='PEDIDO'/);
});
test('criações transacionais exigem reserva integral sem divulgar saldo',()=>{
 assert.match(db,/app_private\.reserve_unified_order\('loja',v_order\)/);
 assert.match(db,/status from public\.store_orders where id=v_order\)<>'aprovado'/);
 assert.match(db,/status from public\.event_pick_batches where id=v_batch\)<>'aguardando'/);
 assert.match(db,/Reduza e tente novamente/);
 assert.match(revise,/status from public\.event_pick_batches where id=p_batch\)<>'aguardando'/);
 assert.match(db,/not app_private\.role_in\('franquia'\)/);
 assert.match(app,/portal\?'':' · Livre na central:/);
});
test('limites arbitrários do formulário antigo foram retirados',()=>{
 assert.doesNotMatch(app,/items\.length>100\)return toast\('Limite de 100 produtos por pedido/);
 assert.doesNotMatch(app,/models>10\|\|Boolean\(form\.__lotPicker/);
 assert.doesNotMatch(app,/\.slice\(0,1500\)\.map\(p=>/);
});
