import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/final-verification.js',import.meta.url),'utf8');
const uo=await readFile(new URL('../src/unified-orders.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/20261015_final_hybrid_barcode_verification.sql',import.meta.url),'utf8');
const ui=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const mod=await import('data:text/javascript;base64,'+Buffer.from(uo).toString('base64'));
const order={kind:'evento',id:'order-1',code:'AA003',status:'separado',adjustments:[],lines:[
 {id:'p1',ean:'000100005073',sku:'1000507',name:'Camiseta HDH preta',
  modelTitle:'Camiseta HDH preta',quantity:10,color:'Preta',size:'P',gondola:'3',imagePath:'item.webp'},
 {id:'p2',ean:'000100005074',sku:'1000508',name:'Camiseta HDH preta',
  modelTitle:'Camiseta HDH preta',quantity:1,color:'Preta',size:'M',gondola:'3'}
]};
const verified=[{kind:'evento',order_id:'order-1',product_id:'p1',counted_quantity:10,expected_quantity:10}];
const cb=(title,action,attrs='',style='')=>'<button data-action="'+action+'" '+attrs+'>'+title+'</button>';

test('uma leitura identifica o SKU e o campo da quantidade começa vazio',()=>{
 assert.equal(ui.findVerificationProduct(order,'000100005073').line.id,'p1');
 assert.equal(ui.findVerificationProduct(order,'1000507').line.id,'p1');
 assert.match(ui.findVerificationProduct(order,'999999').error,/não pertence/);
 const markup=ui.finalVerificationMarkup(order,[]);
 assert.match(markup,/name="verify_quantity"/);
 assert.doesNotMatch(markup,/name="verify_quantity"[^>]*value=/);
 assert.match(markup,/data-verify-scan/);
 assert.match(markup,/10 un/);
 assert.match(markup,/Gôndola 3/);
 assert.match(markup,/data-photo-path="item.webp"/);
});
test('só libera expedição depois de validar todos os tamanhos/quantidades',()=>{
 assert.deepEqual(ui.verificationProgress(order,[]).matched,0);
 assert.deepEqual(ui.verificationProgress(order,verified).matched,1);
 assert.equal(ui.verificationCanDispatch(order,verified),false);
 assert.equal(ui.verificationCanDispatch(order,[...verified,
  {kind:'evento',order_id:'order-1',product_id:'p2',counted_quantity:1,expected_quantity:1}]),true);
 assert.equal(ui.verificationCanDispatch(order,[...verified,
  {kind:'evento',order_id:'order-1',product_id:'p2',counted_quantity:0,expected_quantity:1}]),false);
});
test('mostra botão de conferência antes da saída',()=>{
 const card=mod.unifiedOrderCard(order,{button:cb,canVerify:true,canDispatch:true,isVerified:false});
 assert.match(card,/data-action="order-final-verify"/);
 assert.doesNotMatch(card,/data-action="event-batch-dispatch"/);
 const approved=mod.unifiedOrderCard(order,{button:cb,canVerify:true,canDispatch:true,isVerified:true});
 assert.match(approved,/data-action="event-batch-dispatch"/);
 const nope=mod.unifiedOrderCard(order,{button:cb,canVerify:false,canDispatch:true,isVerified:false});
 assert.doesNotMatch(nope,/data-action="order-final-verify"/);
});
test('backend valida código, quantidade, status e bloqueia os três tipos de saída',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.order_final_verifications/);
 assert.match(sql,/app_private\.has_permission\('orders\.separate'\)/);
 assert.match(sql,/p_counted<0/);
 assert.match(sql,/Código ambíguo neste pedido/);
 assert.match(sql,/EAN\/SKU não corresponde/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/order_final_verifications_staff_read/);
 assert.match(sql,/REVOKE ALL ON public\.order_final_verifications FROM PUBLIC,anon,authenticated/);
 for(const kind of ['avulso','loja','evento']){
  assert.match(sql,new RegExp("PERFORM public.assert_order_final_verification\\\\('"+kind+"'"));
 }
});
test('login e código de barras são integrados à interface, com CSS versionado',()=>{
 assert.match(app,/if\(action==='order-final-verify'\)/);
 assert.match(app,/if\(action==='verify-confirm-item'\)/);
 assert.match(app,/save_order_final_verification/);
 assert.match(app,/event\.target\.matches\('\[data-verify-scan\]'\)/);
 assert.match(app,/verificationCanDispatch\(o,state\.orderVerificationRows\)/);
 assert.match(html,/final-verification\.css\?v=20261015finalverify1/);
});
