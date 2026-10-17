import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const css=await read('product-card-desktop-compact.css');
const legacy=await read('product-card-cdsb-square.css');
const mobile=await read('product-card-clean-v8.css');
const index=await read('index.html');
const card=await read('src/stock-workflows.js');

test('layout compacto desktop é a última camada e mantém os estilos mobile precedentes',()=>{
 const links=[...index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(links.some(x=>/product-card-actions-icons\.css\?v=20261017icons1/.test(x)));
 assert.ok(links.findIndex(x=>x.includes('product-card-desktop-compact.css'))<links.findIndex(x=>x.includes('product-card-actions-icons.css')));
 assert.ok(links.findIndex(x=>x.includes('product-card-clean-v8.css'))<links.length-1);
 assert.match(css,/@media \(min-width:761px\)/);
 assert.match(css,/@media \(min-width:761px\) and \(max-width:1180px\)/);
 assert.doesNotMatch(css,/@media\s*\(max-width:760px\)/);
 assert.match(mobile,/grid-template-areas:"photo info" "totals totals"/);
});

test('neutraliza grid legado de cinco colunas e preserva blocos foto, informações e saldos',()=>{
 assert.match(legacy,/repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-areas:"photo info totals"!important/);
 assert.match(css,/grid-template-areas:"photo info" "photo totals"!important/);
 assert.match(css,/grid-template-columns:clamp\(130px,10\.6vw,154px\)/);
 assert.match(css,/\.grouped-inventory-top>\.grouped-inventory-info\{[\s\S]*?display:flex!important/);
 assert.match(css,/\.grouped-inventory-top>\.stock-total-breakdown\{[\s\S]*?display:grid!important/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/grid-column:auto!important;grid-row:auto!important/);
 assert.match(css,/min-height:0!important;height:auto!important/);
});

test('ações, edição de foto fora da imagem, saldos e variações continuam no card',()=>{
 assert.match(card,/grouped-inventory-top/);
 assert.match(card,/grouped-inventory-photo/);
 assert.match(card,/grouped-inventory-info/);
 assert.match(card,/stock-total-breakdown/);
 assert.match(card,/product-card-photo-quick/);
 assert.match(card,/product-card-icon-toolbar/);
 assert.doesNotMatch(card,/product-card-utilities/);
 assert.match(card,/'product-card-sizes','layers'/);
 assert.match(card,/Ver variações/);
 assert.match(card,/Editar produto/);
 assert.match(card,/data-product-details/);
 assert.match(card,/product-card-photo-quick/);
 assert.match(css,/\.grouped-inventory-photo :is\(\.product-gallery-arrow,\.product-gallery-count\)\{[\s\S]*?display:none!important/);
});

test('identidade CDSB e dimensão compacta não atingem compras nem pedidos das lojas',()=>{
 assert.match(css,/#102d50/);
 assert.match(css,/#dce5ef/);
 assert.match(css,/\.mobile-c-app \.products-panel \.product-card-v3/);
 assert.doesNotMatch(css,/\.buy-page/);
 assert.doesNotMatch(css,/\.uo-page/);
 assert.match(css,/min-height:39px!important/);
 assert.match(css,/max-height:154px!important/);
});
