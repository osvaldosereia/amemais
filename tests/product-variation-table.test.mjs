import test from 'node:test';
import assert from 'node:assert/strict';
import {variationTablePayload,variationTableHTML} from '../src/product-variation-coverage.js';
const sizes=['Tamanho P','Tamanho M','Tamanho G'];
const p={id:'u1',sku:'1000209',ean:'100002096',active:true,apparel_size:null};
test('Produto Único mostra a tabela de tamanhos, SKU, EAN e estoque desde a abertura',()=>{
 const html=variationTableHTML(sizes,[p],{isModel:false,canEdit:true,main:p});
 assert.match(html,/data-form="product-variation-table"/);
 assert.match(html,/name="existing_size"/);
 assert.equal((html.match(/name="quantity"/g)||[]).length,3);
 assert.equal((html.match(/name="sku"/g)||[]).length,3);
 assert.match(html,/Salvar tamanhos e estoque/);
 assert.doesNotMatch(html,/Ativar tamanhos neste produto/);
});
test('Só cria variações com estoque maior que zero',()=>{
 const payload=variationTablePayload({existingSize:'Tamanho P',rows:[
 {size:'Tamanho P',quantity:19,sku:'ORIGINAL'},
 {size:'Tamanho M',quantity:0,sku:'NAO-CRIAR'},
 {size:'Tamanho G',quantity:8,sku:'G-1',ean:'1234567890123'}
 ]},{allowed:sizes});
 assert.equal(payload.existingSize,'Tamanho P');
 assert.deepEqual(payload.entries,[{size:'Tamanho G',sku:'G-1',ean:'1234567890123',quantity:8}]);
});
test('Validação impede EAN e tamanhos duplicados',()=>{
 assert.throws(()=>variationTablePayload({existingSize:'Tamanho M',rows:[
  {size:'Tamanho P',quantity:3,ean:'123'}]},{allowed:sizes}),/EAN inválido/);
 assert.throws(()=>variationTablePayload({existingSize:'Tamanho M',rows:[
 {size:'Tamanho P',quantity:3,sku:'DUP'},{size:'Tamanho G',quantity:2,sku:'DUP'}
 ]},{allowed:sizes}),/Código repetido/);
});
test('Tamanhos existentes nunca são inseridos outra vez',()=>{
 const html=variationTableHTML(sizes,[{id:'p',active:true,apparel_size:'M',sku:'100'}],
 {isModel:true,canEdit:true,physicalFor:()=>5});
 assert.equal((html.match(/name="quantity"/g)||[]).length,2);
 assert.match(html,/Cadastrado/);
 const data=variationTablePayload({rows:[{size:'Tamanho M',quantity:10},
 {size:'Tamanho P',quantity:0},{size:'Tamanho G',quantity:1}]},
 {isModel:true,allowed:sizes,existing:[{apparel_size:'M'}]});
 assert.equal(data.entries.length,1);
 assert.equal(data.entries[0].size,'Tamanho G');
});
