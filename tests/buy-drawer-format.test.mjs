import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,purchases,panelStyles,drawerStyles,html,entry]=await Promise.all([
 read('src/app.js'),read('src/cdsb-purchases.js'),read('buy-one-panel.css'),
 read('buy-purchase-drawer.css'),read('index.html'),read('src/secure-entry.js')
]);
test('painel de Compras conserva classes do componente original depois de mover os elementos',()=>{
 assert.match(app,/class="buy-drawer-slot buy-page" data-buy-drawer-content/);
 assert.match(app,/slot\.append\(panel\)/);
 assert.match(app,/buy-drawer-section-title/);
 assert.match(purchases,/class="buy-variation-disclosure buy-one-panel"/);
 assert.match(purchases,/class="buy-variants"/);
 assert.match(purchases,/class="buy-variant"/);
 assert.match(purchases,/class="buy-panel-history"/);
 assert.match(purchases,/class="buy-panel-footer"/);
 assert.match(panelStyles,/\.buy-page \.buy-one-panel \.buy-variant/);
 assert.match(panelStyles,/\.buy-page \.buy-one-panel \.buy-panel-column-head/);
});
test('no drawer a largura governa o layout, sem comprimir tamanhos, chips e quantidade',()=>{
 for(const selector of [
  '.buy-drawer-slot.buy-page','.buy-one-panel','.buy-panel-column-head',
  '.buy-variants','.buy-variant','.buy-variant-pick','.buy-variant-name',
  '.buy-variant-values','.buy-inline-order','.buy-inline-order input',
  '.buy-panel-history','.buy-history-rows','.buy-history-row','.buy-panel-footer'
 ]){
  const needle=selector==='.buy-drawer-slot.buy-page'
    ?' .buy-drawer-slot.buy-page'
    :' .buy-drawer-slot '+selector;
  assert.ok(drawerStyles.includes(needle),'Sem regra de layout para '+selector);
 }
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-variant\{\s*display:flex!important;flex-direction:column!important/);
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-variant-pick\{\s*display:grid!important;grid-template-columns:minmax\(0,1fr\) auto!important/);
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-inline-order input\{[\s\S]*?width:88px!important/);
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-panel-column-head\{\s*display:none!important/);
});
test('mantém cabeçalho, lista de saídas de 90 dias e inclusão no mesmo painel',()=>{
 assert.match(purchases,/Saídas do CD · últimos 90 dias/);
 assert.match(drawerStyles,/\.buy-drawer-section-title\{/);
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-history-row\{/);
 assert.match(drawerStyles,/\.buy-drawer-slot \.buy-panel-footer\{/);
 assert.match(drawerStyles,/position:sticky!important;bottom:0!important/);
 assert.match(app,/function purchaseDraftTargetModal\(groupKey\)/);
 assert.match(app,/data-form="buy-add-draft"/);
 assert.doesNotMatch(app,/formModal\('Adicionar ao pedido/);
});
test('escopo isolado e versão nova, sem alterar cards ou demais painéis',()=>{
 assert.match(drawerStyles,/\.buy-drawer-backdrop \.buy-drawer \.buy-drawer-slot/);
 assert.match(drawerStyles,/@media\(max-width:600px\)/);
 assert.match(html,/buy-purchase-drawer\.css\?v=20261022stockcards1/);
 assert.match(html,/secure-entry\.js\?v=20261022lookup2/);
 assert.match(entry,/app\.js\?v=20261022lookup2/);
 const cleaned=drawerStyles.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"[^"]*"|'[^']*'/g,'');
 let nesting=0;
 for(const char of cleaned){
  if(char==='{')nesting++;
  if(char==='}')nesting--;
  assert.ok(nesting>=0,'Fechamento inesperado de bloco CSS');
 }
 assert.equal(nesting,0,'Blocos CSS não fechados');
});
