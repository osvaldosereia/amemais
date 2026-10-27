import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findQuickStockProduct,quickBalancePage} from '../src/quick-balance.js';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../quick-balance.css',import.meta.url),'utf8');
const sample=[
 {id:'p25',name:'Adorno Cruz',sku:'1003160',ean:'100026580',active:true},
 {id:'p1050',name:'Imagem Nossa Senhora',sku:'1003666',ean:'100031645',active:true},
 {id:'p1500',name:'Infantil Mulher',sku:'1001007',ean:'100010077',active:true},
 {id:'p2200',name:'Pulseira Santa Teresinha',sku:'1003885',ean:'100033823',active:true},
 {id:'zero',name:'Variação com zero inicial',sku:'1000955',ean:'000100009552',active:true},
 {id:'nine',name:'Código de nove dígitos',sku:'100955',ean:'100009552',active:true}
];
test('busca por SKU e EAN exatos de itens de posições diferentes no catálogo',()=>{
 for(const product of sample){
  assert.equal(findQuickStockProduct(sample,product.sku).item?.id,product.id,'SKU '+product.sku);
  assert.equal(findQuickStockProduct(sample,product.ean).item?.id,product.id,'EAN '+product.ean);
 }
});
test('mantém zeros iniciais e aceita códigos de barras com espaços ou hífens',()=>{
 assert.equal(findQuickStockProduct(sample,'000100009552').item?.id,'zero');
 assert.equal(findQuickStockProduct(sample,'100 031 645').item?.id,'p1050');
 assert.equal(findQuickStockProduct(sample,'100-031-645').item?.id,'p1050');
 assert.equal(findQuickStockProduct(sample,' 1003885 ').item?.id,'p2200');
});
test('EAN parcial com nove últimos dígitos em colisão nunca seleciona automaticamente',()=>{
 const result=findQuickStockProduct(sample,'99100009552');
 assert.equal(result.item,null);
 assert.equal(result.status,'ambiguous');
 assert.deepEqual(result.matches.map(x=>x.id),['zero','nine']);
 assert.match(result.error,/Selecione o SKU correto/);
});
test('não localiza produto excluído ou inativo',()=>{
 assert.equal(findQuickStockProduct(sample.map(p=>({...p,active:false})),'1003160').item,null);
 assert.equal(findQuickStockProduct([{...sample[0],force_archived_at:'2026-10-22'}],'1003160').item,null);
});
test('busca funciona pelo botão, Enter, leitor e seleção explícita de ambíguos',()=>{
 const html=quickBalancePage();
 assert.match(html,/data-action="quick-balance-search"/);
 assert.match(html,/data-action="quick-balance-camera"/);
 assert.match(html,/data-quick-balance-barcode/);
 assert.match(app,/if\(action==='quick-balance-search'\)/);
 assert.match(app,/if\(action==='quick-balance-choose'\)/);
 assert.match(app,/if\(event\.key==='Enter'&&event\.target\.matches\('\[data-quick-balance-barcode\]'\)\)/);
 assert.match(app,/function showQuickBalanceProduct\(p\)/);
 assert.match(app,/quick-balance-choices/);
 assert.match(css,/quick-balance-choice/);
});
test('catálogo inteiro continua carregado em páginas de 750, não somente os primeiros mil',()=>{
 assert.match(app,/async function fetchAllProducts\(\)/);
 assert.match(app,/const limit=750,all=\[\]/);
 assert.match(app,/\.range\(offset,offset\+limit-1\)/);
 assert.match(app,/state\.items=assertOk\(await fetchAllProducts\(\)\)\|\|\[\]/);
});
