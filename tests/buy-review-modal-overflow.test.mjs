import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const cartSource=await read('src/purchase-cart.js');
const {purchaseCartReviewGroups}=await import('data:text/javascript;base64,'+Buffer.from(cartSource).toString('base64'));
const css=await read('cdsb-purchases.css');
const app=await read('src/app.js');
const index=await read('index.html');

test('revisão de compra não comprime cards em linhas quando há muitos modelos',()=>{
 assert.match(css,/\.modalback \.buy-review-cards>\.buy-review-card\s*\{\s*flex:\s*0 0 auto\s*;/);
 assert.match(css,/\.modalback \.buy-review-cards\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.modalback \.buy-review-cards\s*\{[\s\S]*?min-height:min\(190px,32dvh\)/);
 assert.match(css,/\.modalback:not\(\.tax-backdrop\)>\.modal\.buy-review-modal/);
 assert.match(app,/closest\('\.modal'\)\?\.classList\.add\('buy-review-modal'\)/);
 assert.match(index,/cdsb-purchases\.css\?v=20261017reviewfix1/);
});

test('um carrinho grande mantém todos os 11 modelos, 27 SKUs e 106 unidades para conferência',()=>{
 const products=[],models=[],cart=new Map();
 for(let i=0;i<11;i++){
  const model='model-'+i;
  models.push({id:model,name:'Produto '+i,image_path:'fotos/'+i+'.jpg'});
  for(let n=0;n<(i<5?3:2);n++){
   const id=model+'-'+n;
   products.push({id,name:'Produto '+i,supplier_id:'fornecedor',active:true,apparel_model_id:model,apparel_size:['P','M','G'][n]});
   cart.set(id,products.length<=25?4:3);
  }
 }
 const groups=purchaseCartReviewGroups(cart,products,models,'fornecedor');
 assert.equal(groups.length,11);
 assert.equal(groups.reduce((count,g)=>count+g.rows.length,0),27);
 assert.equal(groups.reduce((sum,g)=>sum+g.total,0),106);
 assert.equal(groups.every(g=>g.photo&&g.rows.every(r=>r.quantity>0)),true);
});
