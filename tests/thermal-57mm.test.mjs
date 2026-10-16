import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const rawLabel=await readFile(new URL('../src/shelf-labels.js',import.meta.url),'utf8');
const rawPicking=await readFile(new URL('../src/thermal-picking.js',import.meta.url),'utf8');
const css=await readFile(new URL('../shelf-labels.css',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const stock=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const importLocal=code=>import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const labels=await importLocal(rawLabel);
const picking=await importLocal(rawPicking);
const product={id:'p',active:true,name:'CAMISETA AVIVA 2026',gondola:'01',prateleira:'B',
 apparel_size:'G',apparel_color:'Azul',sku:'1003831',ean:'000100033267'};
const order={code:'AA003',origin:'CDSB',target:'RETIRO ENCHEIVOS - NOBRES',
 lines:[{modelTitle:'CAMISETA AVIVA 2026',color:'Azul',size:'G',sku:'1003831',
 ean:'000100033267',gondola:'01',prateleira:'B',quantity:12}]};

test('prévia da etiqueta e documento de impressão respeitam bobina 57 mm',()=>{
 const label=labels.shelfLabelData(product);
 const modal=labels.shelfLabelPicker([product],product.name);
 const html=labels.shelfLabelsHTML([label]);
 assert.match(modal,/bobina de 57 mm/);
 assert.match(modal,/57 mm de largura/);
 assert.match(html,/\.label-sheet\{width:57mm/);
 assert.match(html,/\.shelf-label\{height:70mm;width:57mm;max-width:57mm/);
 assert.match(html,/\.shelf-barcode\{width:49mm;height:18mm/);
 assert.match(html,/@page\{size:57mm /);
 assert.match(html,/length\*70\+2/);
 assert.doesNotMatch(html,/80mm|85mm|72mm|printLabels80/);
 assert.match(css,/width:57mm/);
 assert.match(css,/\.shelf-barcode\{width:49mm/);
 assert.doesNotMatch(css,/80mm|85mm|72mm/);
 assert.match(labels.code128SVG(product.ean),/width="49mm"/);
});
test('lote de 40 etiquetas cabe no formato contínuo e mantém os dados sem foto',()=>{
 const label=labels.shelfLabelData(product);
 const html=labels.shelfLabelsHTML(Array(40).fill(label));
 assert.match(html,/Math\.min\(3000,/);
 assert.equal((html.match(/class="shelf-label"/g)||[]).length,40);
 assert.match(html,/GÔNDOLA 01/);
 assert.match(html,/000100033267/);
 assert.doesNotMatch(html,/<img\b/);
});
test('pedido de separação usa largura física 57 mm, área útil 49 mm e altura dinâmica',()=>{
 const html=picking.pickingThermalHTML(order,{printedAt:'16/10/2026 15:00'});
 assert.match(html,/\.slip\{width:49mm;max-width:49mm/);
 assert.match(html,/html,body\{width:57mm!important;max-width:57mm!important/);
 assert.match(html,/@page\{size:57mm /);
 assert.match(html,/printSlip57/);
 assert.match(html,/\.pick-quantity\{display:flex;flex-wrap:wrap/);
 assert.doesNotMatch(html,/80mm|72mm|printSlip80/);
 assert.match(html,/SEPARAR <b>12<\/b> UN\./);
 assert.match(html,/PRATELEIRA B/);
 assert.match(html,/GÔNDOLA 1/);
 assert.match(html,/TOTAL: 12 UNIDADES/);
});
test('o sistema identifica os dois formatos de impressão como 57 mm',()=>{
 assert.match(app,/Etiquetas de gôndola · 57 mm/);
 assert.match(app,/Imprimir etiqueta 57 mm/);
 assert.match(stock,/Etiqueta 57 mm/);
 assert.match(app,/shelf-label-print/);
 assert.match(app,/pickingThermalHTML/);
});
