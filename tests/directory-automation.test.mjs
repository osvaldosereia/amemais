import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source=await read('src/directory-automation.js');
const {supplierDirectoryPayload,staffDirectoryPayload,procurementTaskDraft,
 supplierInsights,procurementTasksHTML}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const app=await read('src/app.js');
const sql=await read('supabase/migrations/20261017111000_staff_suppliers_procurement_tasks.sql');
const supplierSource=await read('src/cdsb-purchases.js');
const {supplierListHTML}=await import('data:text/javascript;base64,'+Buffer.from(supplierSource).toString('base64'));
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';

test('cadastro comercial preserva campos e valida prazo, pagamento e contato',()=>{
 const data=supplierDirectoryPayload({name:' Tecidos São Bento ',email:'CONTATO@EXEMPLO.COM',
   delivery_days:'18',minimum_order_amount:'350,50',preferred_channel:'whatsapp',
   legal_name:'Tecidos São Bento LTDA',payment_terms:'30 dias',whatsapp:'65999999999'});
 assert.equal(data.name,'Tecidos São Bento');
 assert.equal(data.delivery_days,18);
 assert.equal(data.minimum_order_amount,350.5);
 assert.equal(data.email,'contato@exemplo.com');
 assert.equal(data.payment_terms,'30 dias');
 assert.throws(()=>supplierDirectoryPayload({name:'A'}),/nome/i);
 assert.throws(()=>supplierDirectoryPayload({name:'Fornecedor',delivery_days:'0'}),/prazo/i);
 assert.throws(()=>supplierDirectoryPayload({name:'Fornecedor',preferred_channel:'webhook'}),/canal/i);
 assert.throws(()=>supplierDirectoryPayload({name:'Fornecedor',email:'inválido'}),/email/i);
});
test('dados profissionais separados de login e informações públicas',()=>{
 assert.deepEqual(staffDirectoryPayload({phone:' 6599999 ',job_title:'Gerente',
 department:'Compras',internal_notes:'Interno'}),{
  phone:'6599999',job_title:'Gerente',department:'Compras',internal_notes:'Interno'
 });
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.staff_contact_details/);
 assert.match(sql,/app_private\.has_permission\('users\.manage'\)/);
 assert.doesNotMatch(sql,/ALTER TABLE public\.staff_profiles\s+ADD COLUMN IF NOT EXISTS phone/);
 assert.match(app,/db\.from\('staff_contact_details'\)\.upsert/);
});
test('tarefas têm prazo, responsável, vínculo com compras e não enviam mensagem externa',()=>{
 const draft=procurementTaskDraft({title:'Cobrar mercadoria',supplier_id:'sup1',
  assigned_to:'user1',due_date:'2026-10-30',description:'Conferir entrega'});
 assert.equal(draft.task_kind,'manual');
 assert.equal(draft.status,'pendente');
 assert.equal(draft.supplier_id,'sup1');
 assert.equal(draft.assigned_to,'user1');
 assert.throws(()=>procurementTaskDraft({title:'X'}),/3 a 160/);
 assert.match(sql,/AFTER INSERT OR UPDATE OF\s+status,expected_arrival_date,estimated_days/);
 assert.match(sql,/purchase_delivery_followup_trigger/);
 assert.match(sql,/task_kind='delivery_followup'/);
 assert.match(sql,/set_procurement_task_status/);
 assert.match(sql,/REVOKE ALL ON public\.procurement_tasks FROM anon/);
 assert.doesNotMatch(sql,/http_|net\.http|pg_net|send_email/);
});
test('gestor visualiza fornecedor, SKU, compras e tarefas pendentes',()=>{
 const supplier={id:'sup1',name:'Fornecedor <script>alert(1)</script>',delivery_days:7,
  payment_terms:'28 dias',active:true};
 assert.deepEqual(supplierInsights(supplier,
  [{supplier_id:'sup1'},{supplier_id:'sup1'}],[{supplier_id:'sup1'}],
  [{supplier_id:'sup1',status:'pendente'}]),{skus:2,purchases:1,pending:1});
 const html=supplierListHTML([supplier],button,{
  products:[{supplier_id:'sup1'},{supplier_id:'sup1'}],
  orders:[{supplier_id:'sup1'}],tasks:[{supplier_id:'sup1',status:'pendente'}]
 });
 assert.match(html,/2 SKU\(s\)/);
 assert.match(html,/1 compra\(s\)/);
 assert.match(html,/1 tarefa\(s\)/);
 assert.match(html,/Entrega: 7 dias/);
 assert.doesNotMatch(html,/<script>/);
});
test('painel de tarefas mostra alertas e mantém botões de conclusão',()=>{
 const html=procurementTasksHTML([{id:'t1',supplier_id:'sup1',
  assigned_to:'u1',title:'Receber lote',status:'pendente',due_date:'2026-10-30'}],
 [{id:'sup1',name:'Tecidos'}],[{id:'u1',full_name:'Operadora'}],button,true);
 assert.match(html,/Receber lote/);
 assert.match(html,/Operadora/);
 assert.match(html,/buy-task-status/);
 assert.match(html,/buy-task-new/);
 assert.match(html,/Nenhuma mensagem/);
 assert.match(app,/state\.procurementTasks/);
 assert.match(app,/if\(type==='buy-task-create'\)/);
 assert.match(app,/if\(action==='buy-task-status'\)/);
});
