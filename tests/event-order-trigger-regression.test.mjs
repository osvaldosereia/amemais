import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20261016_fix_event_verification_trigger.sql',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
test('trigger de invalidação reconhece lote temporário pelo batch_id, pedidos regulares por order_id',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION app_private\.invalidate_order_final_verification\(\)/i);
 assert.match(sql,/v_kind\s*:=\s*CASE\s+TG_TABLE_NAME/i);
 assert.match(sql,/WHEN\s+'event_pick_batch_items'\s+THEN\s+'evento'/i);
 assert.match(sql,/IF v_kind='evento' THEN\s*v_parent := OLD\.batch_id;/i);
 assert.match(sql,/IF v_kind='evento' THEN\s*v_parent := NEW\.batch_id;/i);
 assert.match(sql,/ELSE\s*v_parent := OLD\.order_id;/i);
 assert.match(sql,/ELSE\s*v_parent := NEW\.order_id;/i);
 assert.doesNotMatch(sql,/v_parent\s*:=\s*CASE\s+WHEN\s+TG_OP=/i);
});
test('trigger trata INSERT, UPDATE e DELETE sem depender de campos inexistentes',()=>{
 assert.match(sql,/IF TG_OP='DELETE' THEN/);
 assert.match(sql,/RETURN OLD;/);
 assert.match(sql,/RETURN NEW;/);
 assert.match(sql,/DELETE FROM public\.order_final_verifications\s+WHERE kind=v_kind AND order_id=v_parent;/i);
 assert.match(sql,/SECURITY DEFINER\s+SET search_path TO ''/i);
 assert.doesNotMatch(sql,/DROP TRIGGER|DISABLE TRIGGER|DELETE FROM public\.event_pick_batch_items/i);
});
test('criação de pedido temporário continua chamando RPC existente, sem lotes dentro do pedido',()=>{
 assert.match(app,/db\.rpc\('create_event_pick_batch'/);
 assert.match(app,/confirmEventOrderReview\(form/);
});
