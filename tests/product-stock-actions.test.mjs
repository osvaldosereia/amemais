import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const moduleCode=async name=>{
 const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8');
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const {groupInventory,groupedCard}=await moduleCode('stock-workflows.js');
const {stockOperationPage,operationCartLines}=await moduleCode('stock-inout.js');
const products=['P','M','G'].map((size,i)=>({
 id:'product-'+i,apparel_model_id:'model-1',name:'Camiseta / '+size,
 apparel_color:'Preta',apparel_size:size,active:true,
 ean:'000100100'+i,sku:'SKU-'+size
}));
const group=groupInventory(products,[{id:'model-1',name:'Camiseta Preta'}])[0];
const h=x=>String(x);
const button=(label,action,extra='')=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>';
test('card agrupado possui abas retráteis de consulta, balanço, movimentação e histórico',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'<button>Foto</button>',qtyStore:()=>12,qtyEvent:()=>0,
  qtyReserved:()=>2,qtyAvailable:()=>10,button,
  isManager:()=>true,canRegisterProducts:()=>true,canMoveStock:()=>true,
  canManageSku:()=>true,canBalance:()=>true,canEditProduct:()=>true,
  canStockEntry:()=>true,canStockExit:()=>true
 });
 assert.match(html,/data-action="product-card-sizes"/);
 assert.match(html,/data-action="product-card-edit-toggle"/);
 assert.match(html,/data-stock-panel="balanco"/);
 assert.match(html,/data-stock-panel="movimentar"/);
 assert.match(html,/data-stock-panel="historico"/);
 assert.match(html,/data-product-details/);
 assert.match(html,/data-product-editor/);
 assert.equal((html.match(/data-balance-item/g)||[]).length,3);
 assert.equal((html.match(/data-balance-count/g)||[]).length,3);
 assert.match(html,/data-action="product-balance-save"/);
 assert.doesNotMatch(html,/product-card-more/);
});
test('balanço edita contagem física de todas as variações, não o saldo livre',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'',qtyStore:()=>12,qtyEvent:()=>0,
  qtyReserved:()=>2,qtyAvailable:()=>10,button,
  isManager:()=>true,canRegisterProducts:()=>true,
  canMoveStock:()=>true,canManageSku:()=>true,canBalance:()=>true,expanded:true
 });
 assert.equal((html.match(/data-balance-count/g)||[]).length,3);
 assert.match(html,/data-expected="12" data-reserved="2"/);
 assert.match(html,/min="2" max="1000000" step="1" value="12"/);
 assert.match(html,/data-product-details open/);
 assert.match(html,/data-balance-note/);
 assert.doesNotMatch(html,/data-count-free/);
 assert.doesNotMatch(html,/data-action="stock-free-save"/);
});
test('perfil somente de consulta não pode editar estoque ou cadastro',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'',qtyStore:()=>12,qtyEvent:()=>0,qtyReserved:()=>0,
  qtyAvailable:()=>12,button,isManager:()=>false,canRegisterProducts:()=>false,
  canMoveStock:()=>false,canManageSku:()=>false,canBalance:()=>false,
  canEditProduct:()=>false
 });
 assert.match(html,/Ver variações/);
 assert.doesNotMatch(html,/data-action="product-card-edit-toggle"/);
 assert.doesNotMatch(html,/data-action="product-balance-save"/);
 assert.doesNotMatch(html,/data-action="product-stock-mode"/);
 assert.match(html,/data-balance-count[^>]+disabled/);
});
test('permissões distinguem entradas e saídas excepcionais de cada SKU',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'',qtyStore:()=>12,qtyEvent:()=>0,qtyReserved:()=>0,
  qtyAvailable:()=>12,button,isManager:()=>false,canRegisterProducts:()=>false,
  canManageSku:()=>true,canStockEntry:()=>true,canStockExit:()=>false
 });
 assert.match(html,/data-mode="entrada"/);
 assert.doesNotMatch(html,/data-mode="saida"/);
});
test('remessa usa carrinho existente sem seção pública de saídas',()=>{
 const html=stockOperationPage({
  kind:'entrada',query:'',cart:new Map(),items:products,models:[],
  destinations:[],batches:[],batchLines:[],selectedDestination:'',
  qtyStore:()=>12,qtyAvailable:()=>12,groupInventory,
  photoButton:()=>'',h,button,embeddedReceipt:true
 });
 assert.match(html,/Receber remessa/);
 assert.match(html,/stock-receipt-back/);
 assert.match(html,/data-view="produtos"/);
 assert.match(html,/data-form="stock-operation"/);
});
test('quantidades de saída respeitam estoque livre',()=>{
 const cart=new Map([[products[0].id,{quantity:5,expected:12}]]);
 assert.throws(()=>operationCartLines(cart,products,()=>12,'saida',()=>4),/Estoque livre insuficiente/);
 assert.equal(operationCartLines(cart,products,()=>12,'entrada',()=>4)[0].expected,12);
});

test('produto único usa as mesmas abas sem excluir o conjunto indevidamente',()=>{
 const only={...products[0],apparel_model_id:null};
 const one=groupInventory([only],[])[0];
 const html=groupedCard(one,{
  h,photoButton:()=>'<button>Foto</button>',qtyStore:()=>12,qtyEvent:()=>0,
  qtyReserved:()=>2,qtyAvailable:()=>10,button,
  isManager:()=>true,canRegisterProducts:()=>true,canEditProduct:()=>true,
  canBalance:()=>true,canManageSku:()=>true,canDeleteProduct:()=>true,
  canShare:true,canLabel:true
 });
 assert.match(html,/Ver variações/);
 assert.match(html,/data-action="product-card-edit-toggle"/);
 for(const action of ['product-edit','product-balance-save','shelf-label-open','share-product','product-delete'])
  assert.match(html,new RegExp('data-action="'+action+'"'));
 assert.doesNotMatch(html,/data-action="product-model-delete"/);
 assert.doesNotMatch(html,/product-card-more/);
});
