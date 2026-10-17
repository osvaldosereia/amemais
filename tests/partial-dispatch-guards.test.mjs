import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Contract checks for the migration proposed in PR #31.
// These do not replace real PostgreSQL transactions with authenticated users.
const sql = await readFile(
  new URL('../supabase/migrations/202610170002_fix_partial_dispatch_unique_reservations.sql',import.meta.url),
  'utf8',
);
const functionSql=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.send_operational_order'));

test('expedição parcial não tenta duplicar a reserva única por pedido e SKU',()=>{
  assert.doesNotMatch(functionSql,/insert\s+into\s+public\.stock_reservations\s*\(/i);
  assert.match(functionSql,/update\s+public\.stock_reservations/i);
  assert.match(functionSql,/quantity=case\s+when\s+v_qty>0\s+then\s+v_qty\s+else\s+quantity\s+end/i);
  assert.match(functionSql,/status=case\s+when\s+v_qty>0\s+then\s+'consumida'\s+else\s+'liberada'\s+end/i);
});

test('não envia pedido com total zero e não movimenta estoque para SKU zero',()=>{
  assert.match(functionSql,/if\s+v_total=0\s+then\s+raise exception/i);
  const zeroGuard=functionSql.indexOf('if v_total=0 then');
  const dispatchStatus=functionSql.indexOf("update public.store_orders set status='despachado'");
  assert.ok(zeroGuard>0&&dispatchStatus>zeroGuard);
  assert.match(functionSql,/if\s+v_qty>0\s+then[\s\S]*?update public\.stock_balances set quantity=quantity-v_qty/i);
});

test('status e locks impedem confirmação duplicada no mesmo pedido',()=>{
  assert.match(functionSql,/where id=p_order for update/i);
  assert.match(functionSql,/where kind=p_kind and order_id=p_order for update/i);
  assert.match(functionSql,/v_status is distinct from 'separado'/i);
  assert.match(functionSql,/v_row\.stage<>'expedicao'/);
  assert.match(functionSql,/select quantity into v_reserved[\s\S]*?for update;/i);
  assert.match(functionSql,/select quantity into v_physical[\s\S]*?for update;/i);
});

test('os três tipos usam o mesmo fluxo e enviam só o contado',()=>{
  for(const kind of ["p_kind='loja'","p_kind='evento'","p_kind='avulso'"])
    assert.ok(functionSql.includes(kind),kind);
  assert.match(functionSql,/v_qty:=\(v_doc->>'counted'\)::integer/);
  assert.match(functionSql,/v_qty>v_item\.quantity/);
  assert.match(functionSql,/v_reserved is distinct from v_item\.quantity/);
  assert.match(functionSql,/v_total:=v_total\+v_qty/);
  assert.match(functionSql,/SHIPMENT_COMPLETED/);
});

test('reserva e saldo físico permanecem transacionais; operação exige permissão',()=>{
  assert.match(functionSql,/app_private\.is_active\(\)/);
  assert.match(functionSql,/app_private\.has_permission\('orders\.dispatch'\)/);
  assert.match(functionSql,/app_private\.can_access_store\(v_source\)/);
  assert.match(functionSql,/REVOKE ALL ON FUNCTION public\.send_operational_order\(text,uuid\) FROM PUBLIC,anon/i);
  assert.match(functionSql,/GRANT EXECUTE ON FUNCTION public\.send_operational_order\(text,uuid\) TO authenticated/i);
});
