import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../product-card-cdsb-square.css',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const cards=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const gallery=await readFile(new URL('../src/photo-gallery.js',import.meta.url),'utf8');
const baseTheme=await readFile(new URL('../cdsb-theme.css',import.meta.url),'utf8');
const finalTheme=await readFile(new URL('../operational-clean-ui.css',import.meta.url),'utf8');

test('nova camada visual é a última folha CSS e usa a identidade CDSB',()=>{
 assert.match(index,/product-card-cdsb-square\.css\?v=20261016square2/);
 const lastCss=index.match(/<link\s+rel="stylesheet"[^>]+>/g).at(-1);
 assert.match(lastCss,/operational-clean-ui\.css/);
 assert.match(baseTheme,/--cdsb-blue:#102d50/);
 assert.match(baseTheme,/--cdsb-gold:#c7a35f/);
 assert.match(css,/--card-blue:\s*var\(--cdsb-blue/);
 assert.match(css,/--card-gold:\s*var\(--cdsb-gold/);
 assert.match(finalTheme,/\.product-card-utilities/);
});
test('fotos quadradas em desktop e mobile sem tocar nas imagens originais',()=>{
 assert.match(css,/\.grouped-inventory-photo\s*\{/);
 assert.match(css,/aspect-ratio:\s*1\s*\/\s*1\s*!important/);
 assert.match(css,/\.product-photo-gallery/);
 assert.match(css,/\.thumb/);
 assert.match(css,/object-fit:\s*cover/);
 assert.match(css,/@media\s*\(max-width:\s*760px\)/);
 assert.match(css,/\.product-gallery-grid \.gallery-thumb/);
 assert.match(css,/aspect-ratio:\s*1\s*\/\s*1/);
});
test('ações de pedido e estoque permanecem, mas exclusão fica separada visualmente',()=>{
 assert.match(cards,/data-action="product-card-sizes"/);
 assert.match(cards,/data-action="product-card-edit-toggle"/);
 assert.match(cards,/shelf-label-open/);
 assert.match(cards,/share-product/);
 assert.match(cards,/add-variants/);
 assert.match(cards,/product-model-delete/);
 assert.match(cards,/product-gallery-quick/);
 assert.match(cards,/product-card-action-danger-row/);
 assert.match(css,/\.product-card-action-danger-row/);
});
test('cores operacionais usam azul e dourado, vermelho só em exclusão/sem estoque',()=>{
 assert.match(css,/\.product-stock-total/);
 assert.match(css,/\.stock-total-metric/);
 assert.match(css,/\.product-card-location/);
 assert.match(css,/\.product-card-action-stock/);
 assert.match(css,/\.product-card-photo-quick/);
 assert.match(css,/\.product-card-delete-whole/);
 assert.doesNotMatch(css,/#(?:166446|18573b|e8f5ed|eaf5ee|155b3c|0b6648)\b/i);
});
test('galeria de seis imagens e os links de edição ficam preservados',()=>{
 assert.match(gallery,/Até 6 fotos/);
 assert.match(gallery,/gallery\.length>6/);
 assert.match(cards,/aria-label="Editar fotos/);
});
