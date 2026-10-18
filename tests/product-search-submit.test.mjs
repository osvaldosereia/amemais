import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogMatchesQuery} from '../src/catalog-order.js';

const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../product-search-submit.css',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('busca por nome, palavras, acentos, SKU e EAN continua funcionando',()=>{
 const p={name:'CAMISETA AVIVAMENTO AMARELA',sku:'1001549',ean:'00010015492',apparel_size:'Tamanho P',tags:['roupas']};
 assert.equal(catalogMatchesQuery(p,'avivamento'),true);
 assert.equal(catalogMatchesQuery(p,'camiseta avivamento'),true);
 assert.equal(catalogMatchesQuery(p,'CAMISETA AMARÉLA'),true);
 assert.equal(catalogMatchesQuery(p,'1001549'),true);
 assert.equal(catalogMatchesQuery(p,'00010015492'),true);
 assert.equal(catalogMatchesQuery(p,'avivamento preta'),false);
});
test('busca tem botão de lupa, com leitura de câmera separada',()=>{
 assert.match(app,/data-action="product-search-submit"/);
 assert.match(app,/uiIcon\('search',21\)/);
 assert.match(app,/data-action="search-scan"/);
 assert.match(app,/function submitProductSearch\(value\)/);
 assert.match(app,/if\(action==='product-search-submit'\)/);
 assert.match(css,/\.product-search-submit-btn/);
 assert.match(index,/product-search-submit\.css/);
});
test('Enter pesquisa nomes; scanner continua com busca exata',()=>{
 assert.match(app,/if\(event\.key==='Enter'&&event\.target\.id==='product-search'\)\{\s*event\.preventDefault\(\);\s*submitProductSearch\(event\.target\.value\);/);
 assert.match(app,/if\(action==='search-scan'\)\{\s*try\{return scanEAN\(code=>searchAndManageSku\(code\)\);/);
 assert.doesNotMatch(app,/if\(event\.key==='Enter'&&event\.target\.id==='product-search'\)\{\s*event\.preventDefault\(\);\s*searchAndManageSku/);
});
test('digitação não reconstrói a tela antes de clicar em Buscar',()=>{
 assert.match(app,/if\(event\.target\.id==='product-search'\)state\.productSearchDraft=event\.target\.value/);
 assert.match(app,/\['movement-search','quick-search'\]\.includes\(event\.target\.id\)/);
 assert.match(app,/state\.search=query;/);
 assert.match(app,/state\.productSearchDraft=query;/);
 assert.match(app,/state\.search='';state\.productSearchDraft='';state\.categoryFilter='';/);
});
