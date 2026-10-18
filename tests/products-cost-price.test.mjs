import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [app,editor,transfer,sql,entry]=await Promise.all([
 readFile(new URL('../src/app.js',import.meta.url),'utf8'),
 readFile(new URL('../src/product-card-workspace.js',import.meta.url),'utf8'),
 readFile(new URL('../src/catalog-transfer.js',import.meta.url),'utf8'),
 readFile(new URL('../supabase/migrations/20261018010000_products_unit_cost.sql',import.meta.url),'utf8'),
 readFile(new URL('../src/secure-entry.js',import.meta.url),'utf8')
]);
test('custo unitário novo é opcional, numérico, não negativo, sem valor padrão fictício',()=>{
 assert.match(sql,/add column if not exists cost_price numeric\(12,2\)/);
 assert.match(sql,/cost_price is null or \(cost_price >= 0/);
 assert.doesNotMatch(sql,/cost_price numeric\(12,2\) not null/);
 assert.doesNotMatch(sql,/cost_price numeric\(12,2\) default 0/);
 assert.match(app,/if\(raw===' '\)return null|if\(raw===' '\.trim\(\)\)return null|if\(raw===''\)return null/);
 assert.match(app,/function optionalCostPrice\(form\)/);
});
test('formulários de cadastro e editor de compras permitem deixar preço de custo em branco',()=>{
 assert.match(app,/field\('Preço de custo \(R\$\)','cost_price','number',item\?\.cost_price\?\?''/);
 assert.match(editor,/input\('Preço de custo \(R\$\)','cost_price',p\.cost_price\?\?''/);
 assert.match(app,/cost_price:optionalCostPrice\(form\)/);
 assert.match(app,/cost_price:payload\.cost_price/);
 assert.match(app,/cost_price:v\.cost_price/);
 assert.match(editor,/Custo não informado fica vazio/);
});
test('importação e exportação incluem o custo, sem preencher preços desconhecidos',()=>{
 assert.match(transfer,/'Preco venda','Preco custo','Ativo'/);
 assert.match(transfer,/'Preco custo':p\.cost_price\?\?''/);
 assert.match(transfer,/\['Preco venda','Preco custo'\]/);
 assert.match(sql,/v_cost := nullif\(/);
 assert.match(sql,/cost_price=coalesce\(v_cost,cost_price\)/);
 assert.match(sql,/v_model,v_size,v_color,v_price,v_cost,v_unit/);
 assert.match(entry,/catalog-transfer\.js\?v=20261018cost1/);
});
test('importador não altera estoque quando apenas o custo é atualizado',()=>{
 assert.match(sql,/cost_price=coalesce\(v_cost,cost_price\)/);
 assert.match(sql,/p_import_initial_stock boolean default false/);
 assert.match(sql,/if v_initial is not null and v_initial>0 and not p_import_initial_stock then/);
 assert.match(sql,/v_cost <> round\(v_cost,2\)/);
});
