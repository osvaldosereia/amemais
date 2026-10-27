import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findQuickStockProduct,quickBalancePage,quickStockResult,quickBalancePreview,quickModes} from '../src/quick-balance.js';
import {singleVariantFormHTML,readSingleVariantForm} from '../src/product-variation-coverage.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/app.js'),sql=read('supabase/migrations/20261022190000_quick_stock_scanner_single.sql');
const product={id:'111',name:'A BIBLIA DO BEBÊ',sku:'1003192',ean:'100026900',active:true,apparel_model_id:null,apparel_size:null};
test('Menu próprio de balanço e leitura por EAN ou SKU, sem justificativa',()=>{
 assert.match(app,/id:'balanco',label:'Balanço rápido'/);
 assert.match(app,/if\(state\.view==='balanco'\)/);
 assert.match(app,/scanEAN\(code=>selectQuickBalanceProduct\(code\)\)/);
 assert.match(app,/db\.rpc\('quick_stock_update'/);
 assert.doesNotMatch(quickBalancePage(),/name="note"|name="reason"/);
});
test('EAN e SKU únicos localizam e duplicidade é bloqueada',()=>{
 assert.equal(findQuickStockProduct([product],'100026900').item.id,'111');
 assert.equal(findQuickStockProduct([product],'1003192').item.id,'111');
 assert.match(findQuickStockProduct([product,{...product,id:'222'}],'1003192').error,/mais de um produto/);
 assert.match(findQuickStockProduct([], '111').error,/não encontrado/);
});
test('Três operações, estoque esperado e proteção de reserva',()=>{
 const html=quickStockResult(product,{physical:15,reserved:5,mode:'contagem',can:()=>true});
 assert.match(html,/data-form="quick-balance-action"/);
 assert.match(html,/data-mode="contagem"/);
 assert.deepEqual(quickModes.map(x=>x.id),['contagem','entrada','saida']);
 assert.match(quickBalancePreview('saida',15,5,11),/insuficiente/);
 assert.match(quickBalancePreview('entrada',15,5,2),/15 → 17/);
});
test('Produto Único mostra os três campos sem painel de operações',()=>{
 const html=singleVariantFormHTML(product,{physical:3,canEdit:true,canStock:true});
 for(const name of ['sku','ean','quantity'])assert.ok(html.includes('name="'+name+'"'));
 assert.match(app,/stock\.querySelector\('\.product-advanced-stock'\)\?\.remove\(\)/);
 assert.match(app,/singleVariantFormHTML\(main/);
 assert.match(app,/db\.rpc\('save_single_product_workspace'/);
});
test('Validação do SKU único',()=>{
 const form={dataset:{expected:'0',expectedSku:'S',expectedEan:'12345678'},
 querySelector:q=>({value:q.includes('quantity')?'2':q.includes('ean')?'12345678':'S'})};
 assert.equal(readSingleVariantForm(form).quantity,2);
});
test('Movimentos auditados e protegidos no banco',()=>{
 for(const key of ['stock.balance','stock.entry','stock.exit'])
  assert.ok(sql.includes("app_private.has_permission('"+key+"')"));
 for(const txt of ['v_result<v_reserved','v_current IS DISTINCT FROM p_expected',
  'app_private.quick_stock_requests','INSERT INTO public.stock_movements',
  'INSERT INTO public.audit_log','REVOKE ALL ON FUNCTION public.quick_stock_update'])
  assert.ok(sql.includes(txt),txt);
});
test('Versão cache de CSS e aplicação',()=>{
 assert.match(read('index.html'),/quick-balance\.css\?v=20261026foto100k1/);
 assert.match(read('src/secure-entry.js'),/app\.js\?v=20261027catalogrecovery1/);
});
