import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/20261015195200_admin_remove_orders.sql',import.meta.url),'utf8');
const {unifiedOrderCard,unifiedOrdersPage}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const button=(label,action,extra='',kind='')=>'<button data-action="'+action+'" '+extra+' class="'+kind+'">'+label+'</button>';
const order=(kind,status)=>({
 id:'12345678-abcd-1234-abcd-123456789def',kind,status,
 created_at:'2026-10-15T19:00:00Z',origin:'CDSB',target:'Teste',
 source:'cliente',raw:{source:'cliente'},lines:[],adjustments:[],
 total:4,reserved:0,missing:0,isOwner:true
});

for(const kind of ['avulso','loja','evento']){
 test('somente admin vê Excluir pedido: '+kind,()=>{
  const o=order(kind,'cancelado');
  assert.match(unifiedOrderCard(o,{button,canDelete:true}),/data-action="admin-order-delete-open"/);
  assert.doesNotMatch(unifiedOrderCard(o,{button,canDelete:false}),/admin-order-delete-open/);
 });
}

test('franquia nunca pode excluir pedido, mesmo com flag recebida incorretamente',()=>{
 assert.doesNotMatch(unifiedOrderCard(order('loja','cancelado'),{button,portal:true,canDelete:true}),/admin-order-delete-open/);
});
test('página transmite a autorização somente quando habilitada',()=>{
 assert.match(unifiedOrdersPage([order('avulso','cancelado')],{button,canDelete:()=>true}),/admin-order-delete-open/);
 assert.doesNotMatch(unifiedOrdersPage([order('avulso','cancelado')],{button}),/admin-order-delete-open/);
});
test('o sistema pede o código e chama a RPC restrita a administrador',()=>{
 assert.match(app,/if\(action==='admin-order-delete-open'\)/);
 assert.match(app,/if\(type==='admin-order-delete'\)/);
 assert.match(app,/isAdmin\(\)/);
 assert.match(app,/db\.rpc\('admin_remove_order'/);
 assert.match(app,/p_confirmation:confirmation/);
 assert.match(app,/hiddenOrders=new Set\(state\.removedOrders\.map/);
 assert.match(page,/src\/secure-entry\.js\?v=\d{8}[a-z0-9]+/);
});
test('o banco preserva o histórico e só disponibiliza a exclusão por RPC',()=>{
 assert.match(migration,/app_private\.role_in\('admin'\)/);
 assert.match(migration,/RAISE EXCEPTION 'Código de confirmação incorreto'/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.admin_remove_order\(text,uuid,text\) FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/ADMIN_ORDER_REMOVED/);
 assert.match(migration,/status='liberada'/);
 assert.doesNotMatch(migration,/DELETE FROM public\.(avulso_orders|store_orders|event_pick_batches)/i);
});
