import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findProductByCode} from '../src/product-code-search.js';
import {findQuickStockProduct} from '../src/quick-balance.js';
import {productCatalogCard,productCardVariantStock} from '../src/products-grid.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sample=[
 {id:'short',name:'Camisa PP',sku:'S-1',ean:'123456789',active:true,apparel_size:'Tamanho PP'},
 {id:'long',name:'Camisa M',sku:'S-2',ean:'7890000001234',active:true,apparel_size:'M'},
 {id:'g',name:'Camisa G',sku:'S-3',ean:'4000001234567',active:true,apparel_size:'G'},
];
test('EAN completo tem prioridade e SKU exato continua funcionando',()=>{
 assert.equal(findProductByCode(sample,'7890000001234').item.id,'long');
 assert.equal(findProductByCode(sample,'S-1').item.id,'short');
 assert.equal(findProductByCode(sample,'123456789').status,'exact');
});
test('EAN maior localiza o produto de nove dígitos com a mesma terminação',()=>{
 assert.equal(findProductByCode(sample,'7890123456789').item.id,'short');
 assert.equal(findProductByCode(sample,'7890123456789').status,'last9');
 assert.equal(findProductByCode(sample,'9999999999999').item,null);
 assert.equal(findProductByCode(sample,'12345678').status,'notfound');
 assert.equal(findQuickStockProduct(sample,'7890123456789').item.id,'short');
});
test('EAN ambíguo não seleciona um SKU arbitrariamente',()=>{
 const duplicate=[...sample,{id:'other',name:'Outro produto',ean:'8900123456789',active:true}];
 assert.equal(findProductByCode(duplicate,'7890123456789').status,'ambiguous');
 assert.equal(findProductByCode(duplicate,'7890123456789').item,null);
 assert.match(findQuickStockProduct(duplicate,'7890123456789').error,/mais de um produto/);
 const exact=[...duplicate,{id:'exact',name:'Prioridade',ean:'7890123456789',active:true}];
 assert.equal(findProductByCode(exact,'7890123456789').item.id,'exact');
});
test('SKU único mostra Único e estoque disponível na lista',()=>{
 const group={key:'product:single',title:'Bíblia',main:{id:'single',sku:'S1',ean:'123456789',active:true},
  products:[{id:'single',sku:'S1',ean:'123456789',active:true}]};
 const h=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const html=productCatalogCard(group,{h,qtyStore:()=>12,qtyReserved:()=>4,
   qtyAvailable:()=>8,categories:[]});
 assert.match(html,/Estoque por variação/);
 assert.match(html,/product-grid-variant-name">Único/);
 assert.match(html,/product-grid-variant-qty"[^>]*>8</);
 assert.equal((html.match(/<button\b/g)||[]).length,1);
 assert.ok(html.indexOf('product-grid-variants')<html.indexOf('data-action="product-drawer-open"'));
});
test('Card com oito tamanhos preserva reservas, estoque zero e ordem natural',()=>{
 const order=['GG','M','EXGG','PP','G','XGG','P','XXGG'];
 const products=order.map((size,i)=>({id:'id'+i,active:true,apparel_size:'Tamanho '+size}));
 const h=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const html=productCardVariantStock(products,{h,qtyAvailable:id=>id==='id0'?0:id==='id1'?5:3});
 const labels=[...html.matchAll(/class="product-grid-variant-name">([^<]+)/g)].map(m=>m[1]);
 assert.deepEqual(labels,['PP','P','M','G','GG','XGG','XXGG','EXGG']);
 assert.equal((html.match(/class="product-grid-variant(?: is-zero)?"/g)||[]).length,8);
 assert.match(html,/product-grid-variant is-zero/);
 assert.match(html,/product-grid-variant-qty"[^>]*>5</);
 assert.doesNotMatch(html,/<button|<input/);
});
test('A cor aparece quando há dois tamanhos iguais; conteúdo é escapado',()=>{
 const h=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const html=productCardVariantStock([{id:'1',apparel_size:'M',apparel_color:'Azul',active:true},
  {id:'2',apparel_size:'M',apparel_color:'<Preto>',active:true}],{h,qtyAvailable:()=>1});
 assert.match(html,/M · Azul/);
 assert.match(html,/M · &lt;Preto>/);
});
test('CSS mantém três colunas desktop e layout compacto mobile',()=>{
 const css=read('products-grid-drawer.css');
 assert.match(css,/product-grid-variants-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.products-panel \.products-card-grid\{/);
 assert.match(css,/@media\(max-width:799px\)/);
});
test('Pesquisa do catálogo e leitura por câmera reutilizam busca exata e fallback',()=>{
 const app=read('src/app.js');
 assert.match(app,/findProductByCode\(eligible,q,\{activeOnly:false\}\)/);
 assert.match(app,/findProductByCode\(state\.items\.filter\(p=>!p\.force_archived_at\),value,\{activeOnly:false\}\)/);
 assert.match(app,/codeResult\?\.status==='ambiguous'/);
 assert.match(app,/searchAndManageSku\(code\)/);
 assert.match(app,/catalogMatchesQuery\(p,q,/);
});
