import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/thermal-picking.js',import.meta.url),'utf8');
const {groupedThermalPickingLines,pickingThermalHTML}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const line=(gondola,sku,qty=1,prateleira='',photo='model/photo.webp')=>({
 gondola,sku,quantity:qty,prateleira,imagePath:photo,
 name:'Camiseta preta',modelTitle:'Camiseta HDH preta',
 color:'Preta',size:'P',ean:'000100005073'
});
const order={
 id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
 kind:'evento',sequence:2,target:'RETIRO ENCHEIVOS - NOBRES',
 origin:'CDSB',created_at:'2026-10-15T11:00:00Z',
 lines:[
  line('10','T-10',2),line('3','T-3',3,'B'),line('02','T-2',1,'C'),
  line('', 'SEM',1),line('03','T-03',1,'A'),line('Gôndola 2','T-02',2,'A')
 ]
};

test('ordena gôndolas numericamente, agrupa 03 com 3 e deixa sem endereço por último',()=>{
 const groups=groupedThermalPickingLines(order.lines);
 assert.deepEqual(groups.map(x=>x.title),[
  'GÔNDOLA 2','GÔNDOLA 3','GÔNDOLA 10','SEM GÔNDOLA CADASTRADA'
 ]);
 assert.deepEqual(groups.map(x=>x.units),[3,4,2,1]);
 assert.deepEqual(groups[1].lines.map(x=>x.sku),['T-03','T-3']);
 assert.equal(groupedThermalPickingLines([...order.lines,line('99','ZERO',0)]).flatMap(x=>x.lines).length,6);
});

test('tira a impressão A4 da separação, usa 57 mm, largura útil de 49 mm e altura dinâmica',()=>{
 const html=pickingThermalHTML(order,{printedAt:'15/10/2026 08:00'});
 assert.match(html,/57mm/);
 assert.match(html,/width:49mm/);
 assert.doesNotMatch(html,/size:A4|size:57mm auto/);
 assert.match(html,/slip\.getBoundingClientRect\(\)\.height/);
 assert.match(html,/Math\.min\(3000,Math\.max\(40,heightMM\)\)/);
 assert.match(html,/window\.printSlip57/);
 assert.doesNotMatch(html,/document\.images/);
 assert.match(html,/window\.addEventListener\("load",\(\)=>window\.printSlip57\(\)\)/);
 assert.match(html,/TOTAL: 10 UNIDADES/);
});
test('imprime sem fotos, aproveita a largura para nome, EAN, SKU, variação, prateleira e quantidade',()=>{
 const html=pickingThermalHTML(order);
 assert.doesNotMatch(html,/class="pick-photo"|<img\b|SEM FOTO|photo\.webp/);
 assert.match(html,/\.pick-main\{display:block/);
 assert.match(html,/\.pick-name\{font-size:10.5pt/);
 assert.match(html,/Camiseta HDH preta/);
 assert.match(html,/EAN 000100005073/);
 assert.match(html,/CÓD. T-03/);
 assert.match(html,/Preta · P/);
 assert.match(html,/PRATELEIRA A/);
 assert.match(html,/SEPARAR <b>3<\/b> UN\./);
 assert.doesNotMatch(html,/grayscale|photoUrls/);
 assert.equal((html.match(/class="pick-item"/g)||[]).length,6);
});
test('ignora linhas com quantidade zero, mantém dados do pedido e escapa HTML',()=>{
 const injection={...order,target:'<script>alert(1)</script>',lines:[
   {...line('2','SKU"><img src=x>',1),modelTitle:'<svg/onload=alert(1)>'},
   line('', 'EMPTY',0)
 ]};
 const html=pickingThermalHTML(injection);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>|<svg\/onload/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;svg\/onload/);
 assert.doesNotMatch(html,/SEM FOTO|pick-photo|<img\b/);
 assert.match(html,/TOTAL: 1 UNIDADES/);
 assert.doesNotMatch(html,/SEM GÔNDOLA CADASTRADA/);
});
