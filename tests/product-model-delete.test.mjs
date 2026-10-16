import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlSafe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const workflow=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const code=await import('data:text/javascript;base64,'+Buffer.from(workflow).toString('base64'));
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/202610150047_cdsb_archive_complete_product_model.sql',import.meta.url),'utf8');
const model='11111111-1111-4111-8111-111111111111';
const products=['P','M','GG'].map((size,i)=>({id:'sku'+i,name:'Camisa Branca '+size,
 apparel_model_id:model,apparel_size:size,apparel_color:'Branco',active:true,sku:'SKU'+i}));
const groups=code.groupInventory(products,[{id:model,name:'Camisa Branca'}]);
const props={
 h:htmlSafe,photoButton:()=>'<div class="photo"></div>',qtyStore:()=>15,qtyEvent:()=>0,
 qtyReserved:()=>0,qtyAvailable:()=>15,button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true,canDeleteWholeModel:()=>true,
 canManageSku:()=>true,canQuickCount:()=>false,canMoveStock:()=>false,canShare:false,mode:'products'
};
test('modelo com várias variações possui um só card',()=>{
 assert.equal(groups.length,1);
 assert.equal(groups[0].products.length,3);
});
test('admin tem exclusão do modelo além da gestão por tamanho',()=>{
 const html=code.groupedCard(groups[0],props);
 assert.match(html,/Excluir produto e todas as variações/);
 assert.match(html,/data-action="product-model-delete"/);
 assert.match(html,/data-id="11111111-1111-4111-8111-111111111111"/);
 assert.match(html,/Editar produto/);
 assert.match(html,/\+ Variação/);
 assert.match(html,/data-action="product-card-sizes"/);
 assert.doesNotMatch(html,/product-card-more/);
});
test('opção de excluir modelo completo não aparece sem acesso administrativo',()=>{
 const html=code.groupedCard(groups[0],{...props,canDeleteWholeModel:()=>false});
 assert.doesNotMatch(html,/data-action="product-model-delete"/);
});
test('produto sem variações não exibe exclusão de modelo',()=>{
 const group=code.groupInventory([{...products[0],apparel_model_id:null}],[])[0];
 const html=code.groupedCard(group,props);
 assert.doesNotMatch(html,/data-action="product-model-delete"/);
});
test('front-end exige confirmação e usa RPC de exclusão completa',()=>{
 assert.match(app,/force_archive_model_preview/);
 assert.match(app,/force_archive_model'/);
 assert.match(app,/if\(kind==='model'&&!isAdmin\(\)\)return/);
 assert.match(app,/values\.confirmation/);
});
test('exclusão é atômica, restrita e preserva histórico',()=>{
 assert.match(migration,/app_private\.role_in\('admin'\)/);
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/force_archive_entity\('product',v_variant\.id,v_variant\.name\)/);
 assert.match(migration,/EXCEPTION 'Uma variação não foi arquivada/);
 assert.match(migration,/history_preserved',true/);
 assert.doesNotMatch(migration,/DELETE FROM public\.stock_movements/i);
});
