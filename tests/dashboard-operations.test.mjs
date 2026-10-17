import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../src/dashboard-operations.js',import.meta.url),'utf8');
const {dashboardOrderSummary,dashboardOrderStage}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const order=(status,stage=null)=>({id:status+(stage||''),status,created_at:'2026-10-16T12:00:00Z',workflow:stage?{stage}:null});
test('contagem corresponde exatamente aos filtros operacionais da fila',()=>{
 const orders=[order('reservado'),order('aprovado'),order('em_separacao'),order('separado'),
  order('aprovado','conferencia'),order('aprovado','expedicao'),order('pendente_estoque'),
  order('solicitado'),order('enviado'),order('cancelado')];
 const result=dashboardOrderSummary(orders);
 assert.deepEqual(result.counts,{a_separar:2,em_separacao:1,a_conferir:2,pronto_saida:1,pendente_estoque:1,a_preparar:1});
 assert.equal(result.pending,8);
 assert.equal(result.attention[0].stage,'pendente_estoque');
 assert.equal(result.attention.some(x=>x.order.status==='cancelado'),false);
});
test('um estágio operacional não é contado novamente após encerramento',()=>{
 assert.equal(dashboardOrderStage(order('recebido','conferencia')),null);
 assert.equal(dashboardOrderStage(order('enviado','expedicao')),null);
});
test('reserva de estoque é independente da contagem de pendências',()=>{
 assert.equal(dashboardOrderSummary([]).pending,0);
 assert.equal(dashboardOrderSummary([order('pendente_estoque')]).counts.pendente_estoque,1);
});
test('início fornece busca, atalhos e acesso à fila unificada sem catálogo repetido',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/dashboardOrderSummary\(unifiedOrderRecords\(\)\)/);
 assert.match(app,/data-action="dashboard-orders"/);
 assert.match(app,/data-action="dashboard-product-search"/);
 assert.match(app,/data-action="dashboard-order-open"/);
 assert.doesNotMatch(app,/<h2>Produtos recentes<\/h2>/);
});
