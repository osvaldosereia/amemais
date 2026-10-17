import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/shelf-labels.js',import.meta.url),'utf8');
const workflow=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const {code128SVG,shelfLabelData,shelfLabelArticle,shelfLabelsHTML,shelfLabelPicker,collectShelfLabels}
=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const p={id:'a',active:true,name:'Camiseta HDH preta',ean:'000100005073',sku:'1000507',
 gondola:'Gôndola 03',prateleira:'Prateleira A',apparel_color:'Preta',apparel_size:'P'};
const p2={...p,id:'b',ean:'000100005074',sku:'1000508',gondola:'Gôndola 10',apparel_size:'M'};
const capture=p=>({id:p.id,checked:true,dataset:{shelfLabelId:p.id}});
const fakeForm=(ids,copies)=>({
 querySelectorAll:()=>ids.map(id=>capture({id})),
 querySelector:selector=>{
  const id=selector.match(/copies="([^"]+)"/)?.[1];
  return {value:String(copies[id]??1)};
 }
});
test('Code128 local mantém zeros à esquerda e representa EAN e SKU corretamente',()=>{
 const barcode=code128SVG(p.ean);
 assert.match(barcode,/<svg\b/);assert.match(barcode,/<rect\b/);
 assert.match(barcode,/000100005073/);
 assert.match(barcode,/width="72mm"/);
 assert.ok(barcode.match(/<rect/g).length>20);
 assert.match(code128SVG('CAM-1'),/<svg/);
 assert.equal(code128SVG(''), '');
 assert.equal(code128SVG('🔴'), '');
 assert.doesNotMatch(source,/jsdelivr|JsBarcode|googleapis|<img/);
});
test('prévia imprime modelo, cor, tamanho, gôndola, prateleira, SKU e EAN',()=>{
 const label=shelfLabelData(p);
 assert.equal(label.gondola,'03');assert.equal(label.shelf,'A');
 const html=shelfLabelsHTML([label]);
 assert.match(html,/GÔNDOLA 03/);
 assert.match(html,/Camiseta HDH preta/);
 assert.match(html,/Preta · P/);
 assert.match(html,/1000507/);assert.match(html,/000100005073/);
 assert.match(html,/PRATELEIRA/);assert.match(html,/>A<\/strong>/);
 assert.match(html,/width:80mm/);assert.match(html,/height:70mm/);
 assert.match(html,/size:80mm /);
 assert.match(html,/shelf-label-identifiers/);
 assert.match(html,/length\*70\+2/);assert.match(html,/const mm=sheet.querySelectorAll/);
 assert.doesNotMatch(html,/<img\b|foto|preço|R\$/i);
});
test('o modal seleciona variações e suas cópias sem alterar EANs',()=>{
 const html=shelfLabelPicker([p,p2],'Camiseta HDH preta');
 assert.match(html,/data-shelf-label-id="a"/);
 assert.match(html,/data-shelf-label-id="b"/);
 assert.match(html,/data-shelf-label-copies="a"/);
 assert.match(html,/até 40 por impressão/);
 const selected=collectShelfLabels([p,p2],fakeForm(['a','b'],{a:1,b:2}),'Camiseta HDH preta');
 assert.deepEqual(selected.map(x=>x.scanned),['000100005073','000100005074','000100005074']);
 assert.equal(shelfLabelsHTML(selected).match(/class="shelf-label"/g).length,3);
});
test('sem gôndola ou código válido não imprime uma etiqueta incorreta',()=>{
 const bad={...p,id:'invalid',gondola:'',sku:'',ean:''};
 assert.equal(shelfLabelData(bad).valid,false);
 assert.match(shelfLabelPicker([bad]),/Cadastre a gôndola/);
 assert.throws(()=>shelfLabelsHTML([shelfLabelData(bad)]),/gôndola ou código/);
 assert.throws(()=>collectShelfLabels([p],fakeForm([],{})),/Selecione/);
 assert.throws(()=>collectShelfLabels([p],fakeForm(['a'],{a:21})),/1 a 20/);
 assert.throws(()=>shelfLabelsHTML(Array.from({length:41},()=>shelfLabelData(p))),/1 a 40/);
});
test('textos de produtos são escapados e não injetam marcação',()=>{
 const sample=shelfLabelArticle(shelfLabelData({...p,name:'<img src=x onerror=alert(1)>'}));
 assert.doesNotMatch(sample,/<img/);
 assert.match(sample,/&lt;img/);
});
test('ação está disponível no catálogo e no editor, com módulo versionado',()=>{
 assert.match(workflow,/shelf-label-open/);
 assert.match(app,/shelf-label-open/);
 assert.match(app,/shelf-label-one/);
 assert.match(app,/shelf-label-print/);
 assert.match(app,/Salve as alterações do produto antes de imprimir a etiqueta/);
 assert.match(index,/shelf-labels\.css\?v=20261016label57/);
});
