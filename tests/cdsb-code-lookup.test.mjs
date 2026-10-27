import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findProductByCode} from '../src/product-code-search.js';
import {findQuickStockProduct} from '../src/quick-balance.js';
import {stockOperationResults} from '../src/stock-inout.js';
import {findVerificationProduct} from '../src/final-verification.js';

const catalog=[
 {id:'p1',name:'Adorno Cruz',sku:'1003160',ean:'100026580',active:true},
 {id:'p2',name:'Nossa Senhora 3D',sku:'1003666',ean:'100031645',active:true},
 {id:'p3',name:'Camiseta Infantil A',sku:'100955',ean:'000100009552',active:true},
 {id:'p4',name:'Camiseta Infantil B',sku:'1000955',ean:'100009552',active:true},
 {id:'deleted',name:'Inativo',sku:'999998',ean:'777777777',active:false}
];
const groupInventory=items=>items.map(p=>({key:p.id,products:[p]}));

test('balanço: SKU e EAN de 9 dígitos localizam produtos ativos',()=>{
 for(const p of catalog.filter(x=>x.active)){
  assert.equal(findQuickStockProduct(catalog,p.sku).item?.id,p.id);
  assert.equal(findQuickStockProduct(catalog,p.ean).item?.id,p.id);
 }
 assert.equal(findQuickStockProduct(catalog,'000100026580').item?.id,'p1');
 assert.equal(findQuickStockProduct(catalog,'100 026 580').item?.id,'p1');
});
test('prioridade exata, fallback e detecção de colisão',()=>{
 assert.equal(findProductByCode(catalog,'100009552').item?.id,'p4');
 assert.equal(findProductByCode(catalog,'989100026580').item?.id,'p1');
 const collision=findProductByCode(catalog,'789100009552');
 assert.equal(collision.status,'ambiguous');
 assert.equal(collision.item,null);
 assert.deepEqual(collision.matches.map(p=>p.id),['p3','p4']);
 assert.equal(findProductByCode(catalog,'999998').status,'notfound');
});
test('entrada e saída: busca usando o mesmo resolvedor, inclusive últimos nove dígitos',()=>{
 assert.equal(stockOperationResults(catalog,[],'789100026580',groupInventory)[0].key,'p1');
 assert.equal(stockOperationResults(catalog,[],'1003160',groupInventory)[0].key,'p1');
 assert.deepEqual(stockOperationResults(catalog,[],'789100009552',groupInventory).map(g=>g.key),['p3','p4']);
});
test('conferência: aceita sufixo, e impede seleção ambígua na lista do pedido',()=>{
 const only={lines:[{...catalog[0]}]};
 assert.equal(findVerificationProduct(only,'999100026580').line?.id,'p1');
 const two={lines:[catalog[2],catalog[3]]};
 assert.match(findVerificationProduct(two,'789100009552').error,/mais de uma/);
});
test('busca no frontend usa recuperação autenticada e módulos com cache atualizado',()=>{
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const entry=readFileSync(new URL('../src/secure-entry.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../supabase/migrations/202610270001_final_verification_ean9_lookup.sql',import.meta.url),'utf8');
 assert.match(app,/async function refreshCodeCandidates\(code\)/);
 assert.match(app,/\.like\('ean','%'\+digits\.slice\(-9\)\)/);
 assert.match(app,/await refreshCodeCandidates\(code\)/);
 assert.match(app,/async function handleOperationScanCode\(code\)/);
 assert.match(entry,/app\.js\?v=20261027lookup1/);
 assert.match(html,/secure-entry\.js\?v=20261027lookup1/);
 assert.match(sql,/v_exact_order_count/);
 assert.match(sql,/right\(btrim\(p\.ean\),9\)=right\(v_code,9\)/);
});
