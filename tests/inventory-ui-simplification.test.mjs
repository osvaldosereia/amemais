import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../index.html',import.meta.url),'utf8');
const stock=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');

test('aba Produtos não oferece inventário formal ou balanço independente',()=>{
 assert.doesNotMatch(app,/Conferência formal|Inventário formal|Nova sessão de inventário/);
 assert.doesNotMatch(app,/data-view="inventario"|return inventoryPage\(\)/);
 assert.doesNotMatch(app,/function inventoryPage\(\)|function quickBalancePage\(\)/);
 assert.match(app,/\['roupas','saida','balanco','inventario'\]\.includes\(view\)/);
});
test('sem requisições recorrentes a sessões antigas de inventário',()=>{
 assert.doesNotMatch(app,/from\('inventory_sessions'\)|from\('inventory_session_items'\)/);
 assert.doesNotMatch(app,/rpc\('inventory_start'\)|rpc\('inventory_finalize'\)/);
});
test('balanço via Produtos e permissões continuam preservados',()=>{
 assert.match(app,/if\(action==='stock-free-save'\)/);
 assert.match(app,/canQuickBalance = \(\) => hasPermission\('stock.balance'\)/);
 assert.match(app,/rpc\('quick_stock_count'/);
 assert.match(stock,/data-count-free/);
 assert.match(stock,/stock-free-save/);
});
test('versão do aplicativo foi atualizada após a simplificação',()=>{
 assert.match(entry,/src\/secure-entry\.js\?v=20261016orderflow2/);
});
