import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/202610160001_multi_variant_stock_count_batch.sql',import.meta.url),'utf8');
const editor=await readFile(new URL('../supabase/migrations/202610160002_product_model_basic_editor.sql',import.meta.url),'utf8');
const {groupedCard,groupInventory}=await import('data:text/javascript;base64,'+Buffer.from(workflow).toString('base64'));
const variants=['P','M','G','GG'].map((s,i)=>({
 id:'id-'+i,name:'Camiseta preta '+s,apparel_model_id:'model-test',apparel_color:'Preta',
 apparel_size:s,active:true,ean:'00000000000'+i,sku:'PRETA-'+s,gondola:'3',
}));
const g=groupInventory(variants,[{id:'model-test',name:'Camiseta preta',tags:['preta'],category_id:'cat-1'}])[0];
const h=x=>String(x??'');
const opts={
 h,photoButton:()=>'<span>Foto</span>',qtyStore:()=>35,qtyEvent:()=>0,
 qtyReserved:()=>1,qtyAvailable:()=>34,
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true,canEditProduct:()=>true,
 canManageSku:()=>true,canBalance:()=>true,canStockEntry:()=>true,
 canStockExit:()=>false,canDeleteWholeModel:()=>true,canShare:true,canLabel:true
};
test('quatro tamanhos são renderizados no mesmo formulário retrátil de contagem física',()=>{
 const html=groupedCard(g,opts);
 assert.equal((html.match(/data-balance-item/g)||[]).length,4);
 assert.equal((html.match(/data-balance-count/g)||[]).length,4);
 assert.match(html,/data-action="product-balance-scan"/);
 assert.match(html,/data-balance-scan-input/);
 assert.match(html,/data-action="product-balance-save"/);
 assert.match(html,/data-expected="35" data-reserved="1"/);
 assert.doesNotMatch(html,/data-editor-panel="fotos"/);
 assert.match(html,/data-action="product-gallery-quick"/);
 assert.match(html,/data-editor-panel="variacoes"/);
 assert.match(html,/data-editor-panel="geral"/);
 assert.doesNotMatch(html,/data-action="stock-free-save"/);
});
test('rotina de balanço valida as quatro contagens antes de enviar uma operação em lote',()=>{
 assert.match(app,/if\(action==='product-balance-save'\)/);
 assert.match(app,/items\.push\(\{product_id:row\.dataset\.productId,expected,reserved,counted:Number\(value\)\}\)/);
 assert.match(app,/rpc\('quick_stock_count_batch'/);
 assert.match(app,/note\.length<5/);
 assert.match(app,/data-balance-scan-input/);
});
test('RPC do balanço exige autenticação, perfil e permissão, preserva reservas e auditoria',()=>{
 assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/has_permission\('stock\.balance'\)/);
 assert.match(sql,/role_in\('admin','gerente','estoquista'\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/v_row\.counted < v_current_reserved/);
 assert.match(sql,/public\.quick_stock_count\(/);
 assert.match(sql,/revoke all on function public\.quick_stock_count_batch/);
 assert.match(sql,/grant execute on function public\.quick_stock_count_batch.*authenticated/);
});
test('dados gerais de modelos são salvos sob permissão de edição, sem movimentar estoque',()=>{
 assert.match(editor,/has_permission\('products\.edit'\)/);
 assert.match(editor,/update public\.apparel_models/);
 assert.match(editor,/update public\.products set category_id/);
 assert.doesNotMatch(editor,/update public\.stock_balances/);
});
