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

test('na loja temporária o único caminho é montar lote para aquela loja',()=>{
 const html=unifiedOrdersPage([],{button,eventId,canEventBatch:true,
  canAvulso:true,canStore:true,canLink:true});
 assert.match(html,/data-action="event-batch-new"/);
 assert.match(html,/Montar lote para esta loja/);
 assert.match(html,new RegExp('data-event="'+eventId+'"'));
 assert.doesNotMatch(html,/data-action="unified-order-new"/);
 assert.doesNotMatch(html,/data-action="customer-link-new"/);
 assert.match(html,/Abastecimento desta loja temporária/);
});
test('sem permissão de evento não mostra criação genérica por engano',()=>{
 const html=unifiedOrdersPage([],{button,eventId,canEventBatch:false,canAvulso:true,canStore:true});
 assert.doesNotMatch(html,/data-action="event-batch-new"|data-action="unified-order-new"/);
});
test('fora da loja temporária mantém criação de cliente e filial',()=>{
 const html=unifiedOrdersPage([],{button,canAvulso:true,canStore:true,canLink:true});
 assert.match(html,/data-action="unified-order-new"/);
 assert.match(html,/data-action="customer-link-new"/);
 assert.doesNotMatch(html,/data-action="event-batch-new"/);
});
test('o aplicativo usa a loja do contexto para encaminhar o pedido ao lote',()=>{
 assert.match(app,/const contextEvent=scope\?\.type==='event'\?eventById\(scope\.id\):null/);
 assert.match(app,/canEventBatch:canCreateContextLot/);
 assert.match(app,/eventId:contextEvent\?\.id\|\|''/);
 assert.match(app,/if\(contextEvent\)return eventBatchModal\(contextEvent\.id\)/);
 assert.match(app,/type==='event-batch-write'/);
 assert.match(app,/rpc\('create_event_pick_batch'/);
 assert.match(index,/src\/app\.js\?v=20261015eventorders2/);
});
test('a guarda do banco acessa cover_path apenas na tabela events em atualização',()=>{
 const start=migration.indexOf("if tg_table_name='events' and tg_op='UPDATE' then");
 const end=migration.indexOf('end if;',start);
 assert.ok(start>0);
 assert.ok(end>start);
 assert.match(migration.slice(start,end),/new\.cover_path/);
 assert.match(migration,/when 'avulso_orders' then/);
});
