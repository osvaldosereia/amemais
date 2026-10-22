import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=read('src/catalog-import-identity.js'),front=read('src/catalog-transfer.js');
const sql=read('supabase/migrations/20261022190000_import_only_new_products_ean9.sql');
const moduleUrl='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const {classifyCatalogImport,normalizeImportEan}=await import(moduleUrl);
const row=(sku,ean)=>({SKU:sku,'Codigo de barras':ean});
test('SKU existente protege cadastro mesmo com EAN e dados diferentes',()=>{
 const out=classifyCatalogImport([row(' abc123 ','000000001')],[{sku:'ABC123',ean:'987654321'}]);
 assert.equal(out.newRows.length,0);
 assert.equal(out.skippedRows.length,1);
});
test('EAN completo e nove últimos dígitos protegem produto, mesmo com outro SKU',()=>{
 const known=[{sku:'1',ean:'7890012345678'}];
 const out=classifyCatalogImport([row('2','7890012345678'),row('3','012345678'),
   row('4','111111111'),row('5','111111111')],known);
 assert.deepEqual(out.newRows.map(x=>x.SKU),['4']);
 assert.deepEqual(out.skippedRows.map(x=>x.SKU),['2','3','5']);
});
test('Nenhum produto inativo/arquivado pode ser tratado como novo',()=>{
 const out=classifyCatalogImport([row('N','123456789'),row('ANTIGO','888888888')],
  [{sku:'X',ean:'000123456789',active:false,force_archived_at:'2026-10-19'},
   {sku:'antigo',ean:'',active:false}]);
 assert.equal(out.newRows.length,0);
 assert.equal(out.skippedRows.length,2);
});
test('Importação repetida mantém zero registros novos; zeros à esquerda são preservados',()=>{
 assert.equal(normalizeImportEan(' 000-123 456789 '),'000123456789');
 const existing=[{sku:'A1',ean:'000123456789'}];
 const first=classifyCatalogImport([row('A2','123456789'),row('B','000000123')],existing);
 assert.deepEqual(first.newRows.map(x=>x.SKU),['B']);
 const repeat=classifyCatalogImport(first.newRows,[...existing,{sku:'B',ean:'000000123'}]);
 assert.equal(repeat.newRows.length,0);
});
test('Opção de atualizar removida e importador envia flag false até em página antiga',()=>{
 assert.doesNotMatch(front,/data-transfer-update|Atualizar cadastros existentes/);
 assert.match(front,/p_update_existing:false/);
 assert.match(front,/previewCandidates=newRows/);
 assert.match(front,/classifyCatalogImport\(selected,existing\)/);
 assert.match(read('src/secure-entry.js'),/catalog-transfer\.js\?v=20261022importnew1/);
});
test('Banco ignora duplicados antes de qualquer inclusão ou ajuste, mesmo com flag true',()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/right\(regexp_replace\(coalesce\(p\.ean,''\)/);
 assert.match(sql,/lower\(btrim\(coalesce\(p\.sku,''\)\)\)=lower\(v_sku\)/);
 assert.ok(sql.indexOf('if exists (')<sql.indexOf('insert into public.categories('));
 assert.doesNotMatch(sql,/update public\.products set/i);
 assert.doesNotMatch(sql,/if not p_update_existing then/i);
 assert.match(sql,/v_skipped := v_skipped \+ 1;\s*continue;/);
});
