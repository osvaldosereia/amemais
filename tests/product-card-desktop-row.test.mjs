import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../product-card-cdsb-square.css',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const cards=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const changed=css.split('/* Desktop: cinco ações e quatro indicadores na mesma linha. */')[1];
test('regra nova opera somente no desktop e CSS recebe cache atualizado',()=>{
 assert.ok(changed,'Faltou bloco de layout desktop');
 assert.match(changed,/^@media\s*\(min-width:\s*761px\)/);
 assert.doesNotMatch(changed,/@media\s*\(max-width:/);
 assert.match(index,/product-card-cdsb-square\.css\?v=20261016square2/);
 assert.equal(index.match(/product-card-cdsb-square\.css\?/g)?.length,1);
});
test('Disponível, Gôndola, Físico e Reservado aparecem lado a lado e à direita da foto',()=>{
 assert.match(changed,/grid-template-columns:\s*clamp\([^)]+\)\s+repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(changed,/\.grouped-inventory-info[\s\S]*?display:contents!important/);
 assert.match(changed,/\.product-stock-total[\s\S]*?grid-column:2!important;grid-row:4!important/);
 assert.match(changed,/\.product-card-location[\s\S]*?grid-column:3!important;grid-row:4!important/);
 assert.match(changed,/\.stock-total-breakdown[\s\S]*?display:contents!important/);
 assert.match(changed,/\.stock-total-metric\.reserved[\s\S]*?grid-column:4!important;grid-row:4!important/);
 assert.match(changed,/\.stock-total-metric\.available[\s\S]*?grid-column:5!important;grid-row:4!important/);
 assert.match(changed,/\.grouped-inventory-photo[\s\S]*?aspect-ratio:1\/1!important/);
});
test('cinco botões na mesma linha, exclusão em linha separada',()=>{
 assert.match(cards,/product-card-action-primary-row/);
 assert.match(cards,/product-card-action-secondary-row/);
 assert.match(cards,/product-card-action-danger-row/);
 assert.match(changed,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
 assert.match(changed,/\.product-card-action-primary-row[\s\S]*?display:contents!important/);
 assert.match(changed,/\.product-card-action-secondary-row[\s\S]*?display:contents!important/);
 assert.match(changed,/\.product-card-action-danger-row[\s\S]*?grid-column:1\/-1!important/);
 assert.match(cards,/Ver estoque/);
 assert.match(cards,/Editar produto/);
 assert.match(cards,/Etiqueta 57 mm/);
 assert.match(cards,/Compartilhar/);
 assert.match(cards,/\+ Variação/);
});
