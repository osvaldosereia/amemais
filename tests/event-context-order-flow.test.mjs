import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/20261015204500_fix_order_trigger_cover_path_table_guard.sql',import.meta.url),'utf8');
const {unifiedOrdersPage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const eventId='756e4f3f-7dc9-428e-909f-0ed8f89b7a82';
const button=(label,action,attrs='',style='')=>
  '<button data-action="'+action+'" '+attrs+' class="'+style+'">'+label+'</button>';

test('loja temporária oferece novo pedido sem lotes nem link externo',()=>{
 const html=unifiedOrdersPage([],{button,eventId,canEventBatch:true,canStore:false});
 assert.match(html,/data-action="unified-order-new"/);
 assert.match(html,/Novo pedido/);
 assert.doesNotMatch(html,/data-action="customer-link-new"|data-action="event-batch-new"/);
 assert.match(html,/Pedidos desta loja temporária/);
});
test('sem permissão de pedidos ou eventos não mostra criação',()=>{
 const html=unifiedOrdersPage([],{button,eventId,canEventBatch:false,canAvulso:false,canStore:false});
 assert.doesNotMatch(html,/data-action="unified-order-new"/);
});
test('fila central cria pedidos por unidade, nunca por cliente avulso',()=>{
 const html=unifiedOrdersPage([],{button,canAvulso:false,canStore:true,canLink:true});
 assert.match(html,/data-action="unified-order-new"/);
 assert.doesNotMatch(html,/customer-link-new|Links de acesso para clientes/);
});
test('seleção de destinos abre a unidade correta, preservando o evento no banco',()=>{
 assert.match(app,/function orderDestinationPicker\(/);
 assert.match(app,/if\(type==='unified-order-destination'\)/);
 assert.match(app,/return eventBatchModal\(destination\.slice\(6\)\)/);
 assert.match(app,/return storeOrderModal\(destination\.slice\(6\)\)/);
 assert.match(app,/rpc\('create_event_pick_batch'/);
});
test('a guarda do banco acessa cover_path apenas na tabela events em atualização',()=>{
 const start=migration.indexOf("if tg_table_name='events' and tg_op='UPDATE' then");
 const end=migration.indexOf('end if;',start);
 assert.ok(start>0);
 assert.ok(end>start);
 assert.match(migration.slice(start,end),/new\.cover_path/);
 assert.match(migration,/when 'avulso_orders' then/);
});
