import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../src/order-operations.js',import.meta.url),'utf8');
const {operationalStage,operationalDifferenceRows,operationalFormMarkup}
 =await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const ui=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/202610160030_operational_orders_partial_check_ship.sql',import.meta.url),'utf8');
const order={id:'demo',kind:'evento',status:'aguardando',code:'AA003',
 target:'RETIRO ENCHEIVOS - NOBRES',lines:[{id:'sku1',name:'Camiseta HDH preta',
 modelTitle:'Camiseta HDH preta',sku:'1000507',ean:'000100005073',
 quantity:10,gondola:'03',size:'P'}]};
test('pedido fechado não apresenta produto antes da gaveta de pedido aberta',()=>{
 const start=ui.indexOf("'<details class=\"uo-order-open\""),photo=ui.indexOf('  preview+',start);
 assert.ok(start>0&&photo>start);
 assert.match(ui,/Abrir pedido/);
 assert.match(ui,/uo-order-open/);
});
test('diferença por SKU distingue solicitado, separado, conferido e motivo',()=>{
 const withProgress={...order,status:'separado',workflow:{stage:'expedicao',
 has_difference:true,items:{sku1:{requested:10,picked:7,pick_reason:'3 peças não localizadas',
 counted:6,check_reason:'uma unidade com defeito'}}}};
 const found=operationalDifferenceRows(withProgress);
 assert.equal(found.length,1);
 assert.equal(found[0].requested,10);
 assert.equal(found[0].picked,7);
 assert.equal(found[0].counted,6);
 assert.equal(found[0].missing,4);
 assert.equal(found[0].reason,'uma unidade com defeito');
 assert.equal(operationalStage(withProgress),'expedicao');
});
test('formulário de separação permite zero, parcial e motivo de falta',()=>{
 const html=operationalFormMarkup(order,'separacao');
 assert.match(html,/data-op-qty/);
 assert.match(html,/min="0" max="10"/);
 assert.match(html,/data-op-reason/);
 assert.match(html,/não encontrado|não impede/);
 assert.match(html,/000100005073/);
 const check=operationalFormMarkup({...order,workflow:{items:{sku1:{picked:7}}}},'conferencia');
 assert.match(check,/Quantidade conferida/);
 assert.doesNotMatch(check,/data-op-qty[^>]*value="7"/);
});
test('front chama RPCs autenticadas em cada etapa e não baixa estoque ao separar',()=>{
 for(const key of ['save_operational_pick','save_operational_check','send_operational_order'])
  assert.match(app,new RegExp(key));
 assert.match(app,/p_finish:finish/);
 assert.match(app,/state\.orderOperationalRows/);
 assert.match(app,/order-op-send/);
 assert.match(sql,/stage='enviado'/);
 assert.match(sql,/status='liberada'/);
 assert.match(sql,/v_qty>0/);
 assert.match(sql,/update public\.stock_balances set quantity=quantity-v_qty/);
 assert.match(sql,/app_private\.has_permission\('orders\.dispatch'\)/);
 assert.match(sql,/revoke all on function public\.send_operational_order/);
 assert.doesNotMatch(sql,/update public\.stock_balances set quantity=quantity-v_item\.quantity/);
});
test('sem alterar pedido solicitado, preserva snapshot de diferença na auditoria',()=>{
 assert.match(sql,/jsonb_build_object\('kind',p_kind,'picked',v_total,'divergence',v_difference,'items',v_result\)/);
 assert.match(sql,/jsonb_build_object\('kind',p_kind,'counted',v_total,'divergence',v_diff,'items',v_result\)/);
 assert.match(sql,/SHIPMENT_COMPLETED/);
 assert.match(sql,/v_item\.quantity-v_qty/);
});
