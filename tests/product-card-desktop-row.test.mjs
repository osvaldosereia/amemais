import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../product-card-cdsb-square.css',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const cards=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const changed=css.split('/* Desktop: cinco ações e quatro indicadores na mesma linha. */')[1];
test('regra nova opera somente no desktop e CSS recebe cache atualizado',()=>{
 assert.ok(changed,'Faltou bloco de layout desktop');
 assert.match(changed.trimStart(),/^@media\s*\(min-width:\s*761px\)/);
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
test('operações principais continuam visíveis e ações auxiliares são agrupadas',()=>{
 const finalTheme=css+'\n'+String('');
 assert.match(cards,/product-card-action-primary-row/);
 assert.match(cards,/product-card-action-secondary-row/);
 assert.match(cards,/product-card-action-danger-row/);
 assert.match(cards,/product-card-utilities/);
 assert.match(cards,/<summary>Mais opções/);
 assert.match(cards,/Ver variações/);
 assert.match(cards,/Editar produto/);
 assert.match(cards,/Etiqueta 80 mm/);
 assert.match(cards,/Compartilhar/);
 assert.match(cards,/\+ Variação/);
 assert.match(finalTheme,/\.product-card-action-primary-row/);
});
