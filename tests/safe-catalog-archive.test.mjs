import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Static migration contracts; final acceptance requires an isolated Supabase branch
// with actual roles, stock transactions, concurrent operators and rollback tests.
const sql=await readFile(
  new URL('../supabase/migrations/202610170003_safe_catalog_archive_without_stock_movements.sql',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const product=sql.slice(sql.indexOf('-- Arquivamento do catálogo'),sql.indexOf('END;$function$;',sql.indexOf('-- Arquivamento do catálogo')));
test('arquivar SKU nunca altera saldo físico, reservas ou pedidos',()=>{
  assert.match(product,/UPDATE public\.products SET active=false,force_archived_at=now\(\)/i);
  assert.doesNotMatch(product,/(INSERT INTO public\.stock_movements|UPDATE public\.stock_balances|UPDATE public\.store_stock|UPDATE public\.stock_reservations|UPDATE public\.store_orders|UPDATE public\.avulso_orders|UPDATE public\.event_pick_batches)/i);
  assert.match(product,/units_removed',0/);
  assert.match(product,/cancelled_orders',0/);
  assert.match(product,/PRODUCT_CATALOG_ARCHIVED/);
});
test('arquivamento exige saldo zerado em CDSB, temporárias e filiais',()=>{
  assert.match(product,/public\.stock_balances WHERE product_id=p_id AND quantity>0/i);
  assert.match(product,/public\.store_stock WHERE product_id=p_id AND quantity>0/i);
  assert.match(product,/ORDER BY event_id NULLS FIRST FOR UPDATE/i);
  assert.match(product,/ORDER BY store_id FOR UPDATE/i);
});
test('não arquiva SKU com reserva ou pedido aberto, em qualquer fluxo',()=>{
  for(const table of ['stock_reservations','store_order_items','avulso_order_items','event_pick_batch_items'])
    assert.match(product,new RegExp('public\\.'+table));
  assert.match(product,/status='ativa'/);
  assert.match(product,/Produto possui reserva ou pedido aberto/);
});
test('bloqueia entrada de estoque em produto arquivado, inclusive filial',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION app_private\.reject_archived_product_stock_growth/);
  assert.match(sql,/force_archived_at IS NULL FOR KEY SHARE/i);
  assert.match(sql,/BEFORE INSERT OR UPDATE ON public\.stock_balances/i);
  assert.match(sql,/BEFORE INSERT OR UPDATE ON public\.store_stock/i);
});
test('prévia mostra saldo de filiais no produto e no modelo completo',()=>{
  assert.match(sql,/SELECT coalesce\(sum\(quantity\),0\) INTO v_branch FROM public\.store_stock/);
  assert.match(sql,/SELECT coalesce\(sum\(ss\.quantity\),0\) INTO v_branches/);
  assert.match(sql,/'stock_units',v_central\+v_events\+v_branches/);
  assert.match(app,/data\.branch_units\|\|0/);
  assert.match(app,/sem dar baixa no estoque nem cancelar pedidos/);
  assert.match(app,/nenhuma unidade física será baixada/);
});
