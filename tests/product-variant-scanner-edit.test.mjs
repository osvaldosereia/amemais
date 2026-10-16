import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/product-form-scanner.js',import.meta.url),'utf8');
const {preventScannerSubmit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const variantSource=await readFile(new URL('../src/product-variants.js',import.meta.url),'utf8');
const workflowSource=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const apparelSource=await readFile(new URL('../src/apparel.js',import.meta.url),'utf8');
function fakeKey(formType,inputName,code,key='Enter'){
 let prevented=0,stopped=0,focused=0;
 const form={dataset:{form:formType},querySelectorAll:()=>[]};
 const target={name:inputName,value:code,tagName:'INPUT',type:'text',
  closest:()=>form,focus:()=>{focused++}};
 const event={key,target,preventDefault:()=>prevented++,stopPropagation:()=>stopped++};
 return {event,metrics:()=>({prevented,stopped,focused})};
}
test('leitor USB com Enter não salva novo produto e preserva o EAN',()=>{
 for(const type of ['product-new','product-edit','apparel-create','apparel-edit-variant','extra-sizes']){
  const {event,metrics}=fakeKey(type,'ean','7891234567890');
  assert.equal(preventScannerSubmit(event),true);
  assert.equal(metrics().prevented,1);
  assert.equal(event.target.value,'7891234567890');
 }
});
test('Enter no código de tamanho não cadastra produto, mas envio explícito continua permitido',()=>{
 const x=fakeKey('product-new','size_ean','7899876543210');
 assert.equal(preventScannerSubmit(x.event),true);
 assert.equal(x.metrics().prevented,1);
 const y=fakeKey('product-new','size_ean','7899876543210','Tab');
 assert.equal(preventScannerSubmit(y.event),false);
 assert.equal(y.metrics().prevented,0);
 const z=fakeKey('login-password','password','password');
 assert.equal(preventScannerSubmit(z.event),false);
});
test('cadastro inicial tem campos de gôndola e prateleira por variação',()=>{
 assert.match(variantSource,/productSizeGondolaSelectHTML\('size_gondola'/);
 assert.match(variantSource,/name="size_prateleira"/);
 assert.match(variantSource,/const gondola=get\('size_gondola'\)/);
 assert.match(variantSource,/const gondola=get\('size_gondola'\),prateleira=get\('size_prateleira'\)/);
});
test('cada variação da aba balanço oferece edição direta de EAN e gôndola',()=>{
 assert.match(workflowSource,/Editar EAN \/ gôndola/);
 assert.match(workflowSource,/group.modelId\?'apparel-variant-edit':'product-edit'/);
 assert.match(appSource,/if\(action==='product-edit'\)/);
 assert.match(apparelSource,/name="ean"/);
 assert.match(apparelSource,/gondolaSelectHTML\('gondola'/);
 assert.match(apparelSource,/name="prateleira"/);
});
test('exclusão de produto completo fica no card da lista e na edição autorizada',()=>{
 assert.match(workflowSource,/Excluir produto completo/);
 assert.match(workflowSource,/direct\('Excluir produto completo','product-model-delete'/);
 assert.match(workflowSource,/data-editor-panel="variacoes"/);
 assert.match(appSource,/if\(action==='product-model-delete'\)/);
 assert.match(appSource,/isAdmin\(\).*hasPermission\('system.force_delete'\)/);
});
test('gôndola inicial por variação é salva no mesmo RPC transacional',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261016_variant_gondola.sql',import.meta.url),'utf8');
 assert.match(sql,/create or replace function public.create_apparel_with_location/i);
 assert.match(sql,/jsonb_array_elements\(p_variants\)/);
 assert.match(sql,/variant->>'gondola'/);
 assert.match(sql,/variant->>'prateleira'/);
 assert.match(sql,/apparel_model_id\s*=\s*v_model/);
 assert.match(sql,/app_private\.role_in/);
});
