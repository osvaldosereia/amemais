import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js');

test('Produto inexistente: EAN numérico oferece cadastro direto',()=>{
  assert.ok(app.includes(String.raw`hasPermission('products.create')&&/^\d{8,14}$/.test(state.search.trim())`));
  assert.ok(app.includes(String.raw`if(!/^\d{8,14}$/.test(ean))return;`));
});

test('Preço de venda aceita números decimais e rejeita conteúdo não numérico',()=>{
  assert.ok(app.includes(String.raw`!/^\d+(\.\d{1,2})?$/.test(rawPrice)`));
  const price=/^\d+(\.\d{1,2})?$/;
  for(const value of ['0','10','10.5','10.50','99999999.99'])assert.equal(price.test(value),true,value);
  for(const value of ['10,50','-1','1.234','abc',' 5'])assert.equal(price.test(value),false,value);
});

test('Balanço rápido preserva idempotência em repetição e renova UUID quando alterado',()=>{
  assert.match(app,/operationKey=JSON\.stringify\(\[p\.id,mode,expected,Number\(raw\)\]\)/);
  assert.match(app,/form\.dataset\.operationKey!==operationKey/);
  assert.match(app,/form\.dataset\.requestId=crypto\.randomUUID\(\)/);
  assert.match(app,/const request=form\.dataset\.requestId/);
});

test('Cadastro parcialmente persistido não incentiva novo lançamento duplicado',()=>{
  assert.match(app,/postCreateWarning=true/);
  assert.match(app,/Produto cadastrado, mas informações comerciais pendentes/);
  assert.match(app,/\.select\('id'\)\.maybeSingle\(\)/);
});

test('Navegador busca nova versão do app com correções',()=>{
  assert.match(read('index.html'),/secure-entry\.js\?v=20261026cadastrobalanco1/);
  assert.match(read('src/secure-entry.js'),/app\.js\?v=20261026cadastrobalanco1/);
});
