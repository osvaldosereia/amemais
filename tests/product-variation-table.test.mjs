import test from 'node:test';
import assert from 'node:assert/strict';
import {variationFormHTML,readVariationForm} from '../src/product-variation-coverage.js';
const choices=['Tamanho P','Tamanho M','Tamanho G'];
const model=[{id:'p',apparel_size:'M',active:true,sku:'SKU-M',ean:'1234567890123'}];
test('tamanhos existentes mantêm campos e saldos reais; novos começam em zero',()=>{
 const html=variationFormHTML(choices,model,{isModel:true,canEdit:true,physicalFor:()=>7});
 assert.match(html,/data-id="p"/);
 assert.match(html,/data-expected-quantity="7"/);
 assert.match(html,/value="SKU-M"/);
 assert.match(html,/value="1234567890123"/);
 assert.equal((html.match(/value="0" type=/g)||[]).length,0);
 assert.equal((html.match(/name="quantity"/g)||[]).length,3);
 assert.match(html,/value="0"/);
});
const fakeRow=({size='Tamanho P',sku='',ean='',qty='0',id='',previousQty=0,previousSku='',previousEan=''})=>({
 dataset:{size,id,status:id?'registered':'new',expectedQuantity:String(previousQty),
   expectedSku:previousSku,expectedEan:previousEan},
 querySelector:selector=>{
  const n=(selector.match(/name="([^"]+)"/)||[])[1];
  const value={sku,ean,quantity:qty}[n];
  return value===undefined?null:{value};
 }
});
const fakeForm=(rows,{original='',isModel='true'}={})=>({
 dataset:{isModel},querySelector:sel=>sel==='[data-original-size]:checked'&&original?{value:original}:null,
 querySelectorAll:sel=>sel==='[data-variation-row]'?rows:[]
});
test('valida estoque, EAN e códigos repetidos no preenchimento direto',()=>{
 const saved=readVariationForm(fakeForm([
  fakeRow({size:'Tamanho P',qty:'0'}),fakeRow({size:'Tamanho G',qty:'9',sku:'NEW-G',ean:'1234567890123'})
 ]));
 assert.equal(saved.rows.length,2);
 assert.equal(saved.rows[1].quantity,'9');
 assert.throws(()=>readVariationForm(fakeForm([fakeRow({qty:'-1'})])),/Estoque inválido/);
 assert.throws(()=>readVariationForm(fakeForm([fakeRow({ean:'123',qty:'1'})])),/EAN inválido/);
 assert.throws(()=>readVariationForm(fakeForm([
   fakeRow({sku:'repeat'}),fakeRow({size:'Tamanho G',sku:'repeat'})
 ])),/Código repetido/);
});
test('SKU Único não pode ser reclassificado sem tamanho definido',()=>{
 assert.throws(()=>readVariationForm(fakeForm([fakeRow({qty:'4'})],{isModel:'false'})),/Marque qual tamanho/);
 assert.equal(readVariationForm(fakeForm([fakeRow({qty:'4'})],{isModel:'false',original:'Tamanho P'})).originalSize,'Tamanho P');
});
