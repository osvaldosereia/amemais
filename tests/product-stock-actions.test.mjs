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
test('card do produto possui movimentação no modelo e em cada tamanho',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'<button>Foto</button>',qtyStore:()=>12,qtyEvent:()=>0,
  qtyReserved:()=>0,qtyAvailable:()=>12,button,
  isManager:()=>true,canRegisterProducts:()=>true,canMoveStock:()=>true
 });
 assert.equal((html.match(/data-action="stock-group-modal"/g)||[]).length,1);
 assert.equal((html.match(/data-action="stock-modal"/g)||[]).length,4); // menu + 3 SKUs
 assert.match(html,/data-product-details/);
 assert.match(html,/3 tamanhos/);
});
test('card sem permissão não expõe movimentações',()=>{
 const html=groupedCard(group,{
  h,photoButton:()=>'',qtyStore:()=>12,qtyEvent:()=>0,qtyReserved:()=>0,
  qtyAvailable:()=>12,button,isManager:()=>false,canRegisterProducts:()=>false,
  canMoveStock:()=>false
 });
 assert.doesNotMatch(html,/data-action="stock-modal"/);
 assert.doesNotMatch(html,/data-action="stock-group-modal"/);
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
