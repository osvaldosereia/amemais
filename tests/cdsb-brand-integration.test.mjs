import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const files=['../src/app.js','../src/tv-dashboard.js','../index.html',
 '../painel-tv.html','../cdsb-theme.css','../cdsb-tv-theme.css',
 '../manifest.webmanifest','../src/unified-orders.js','../src/event-lots.js',
 '../supabase/migrations/20261016_disable_customer_orders.sql'];
const [app,tv,entry,tvPage,theme,tvTheme,manifest,orders,temporary,deny]
 =await Promise.all(files.map(name=>readFile(new URL(name,import.meta.url),'utf8')));
test('marca CDSB: imagem oficial única na sidebar e cabeçalho exclusivo no celular',()=>{
 assert.match(app,/const desktopIdentity='<div class="brand brand-lockup">'\+mark\+'<\/div>'/);
 assert.match(app,/const mark='<img class="cdsb-brand-logo" src="\.\/cdsb-brand\.jpg"/);
 assert.match(app,/cdsb-mobile-identity/);
 assert.match(theme,/\.cdsb-mobile-identity\{display:none\}/);
 assert.match(theme,/@media\(max-width:760px\)/);
 assert.match(theme,/\.mobile-c-app \.sidebar \.brand-lockup\{display:none!important\}/);
 assert.equal((app.match(/<div class="brand brand-lockup"/g)||[]).length,1);
});
test('login e Painel TV usam marca horizontal; favicon e PWA usam brasão',()=>{
 assert.match(app,/brand-login"><img src="\.\/cdsb-brand\.jpg"/);
 assert.match(tv,/tv-one-logo"><img src="\.\/cdsb-brand\.jpg"/);
 assert.match(entry,/rel="icon" type="image\/jpeg" href="\.\/cdsb-emblem\.jpg/);
 assert.match(tvPage,/rel="icon" type="image\/jpeg" href="\.\/cdsb-emblem\.jpg/);
 const m=JSON.parse(manifest);
 assert.equal(m.name,'CDSB — Centro de Distribuição São Bento');
 assert.match(m.icons[0].src,/cdsb-emblem\.jpg/);
 assert.match(tvTheme,/\.tv-one-header\{background:#fff/);
});
test('contraste visual padronizado para azul e dourado sem neutralizar falhas',()=>{
 assert.match(theme,/--cdsb-blue:#102d50/);
 assert.match(theme,/--cdsb-gold:#c7a35f/);
 assert.match(theme,/\.login-wrap/);
 assert.match(theme,/\.uo-exception-badge/);
 assert.match(theme,/\.mobile-c-app \.sidebar \.brand-lockup\{height:143px/);
 assert.match(theme,/\.button\.primary/);
});
test('criação pública de links e pedidos sem destino desativada; pedido único persiste',()=>{
 assert.match(app,/if\(action==='unified-order-new'\)return orderDestinationPicker\(\)/);
 assert.match(app,/if\(action==='order-new'\)return orderDestinationPicker\(\)/);
 assert.match(app,/if\(type==='order-create'\)return toast\('Novo pedido precisa de destino/);
 assert.match(deny,/revoke all on function public\.create_internal_avulso_order/);
 assert.match(deny,/revoke all on function public\.create_customer_catalog_access/);
 assert.doesNotMatch(orders,/data-action="customer-link-new"/);
 assert.match(temporary,/Pedidos da loja temporária/);
});
