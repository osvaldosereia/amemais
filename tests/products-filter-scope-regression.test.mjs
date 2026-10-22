import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const begin=app.indexOf('function selectedProductCatalogGroups(){');
const end=app.indexOf('function franchiseCatalogPage(){',begin);
assert.ok(begin>=0&&end>begin,'Localizar função do catálogo e da impressão');
const scope=app.slice(begin,end);
const sample={id:'p1',name:'Produto do CD',sku:'001',ean:'000123456789',active:true,category_id:'c1'};
const state={
 items:[sample],apparelModels:[],categories:[],search:'',productSearchDraft:'',
 showInactiveProducts:false,categoryFilter:'',tagFilter:'',gondolaFilter:'',catalogSort:'name-asc',page:0
};
const context={
 state,
 isFranchisePortal:()=>false,
 availableGondolas:()=>[{key:'G1',label:'Gôndola 01'}],
 catalogMatchesQuery:()=>true,
 findProductByCode:()=>({item:null,status:'ambiguous'}),
 categoryChain:()=>[],
 groupInventory:items=>items.map(p=>({key:'product:'+p.id,products:[p]})),
 filterCatalogGondola:groups=>groups,
 orderCatalogGroups:groups=>groups,
 qtyAvailable:()=>0,qtyStore:()=>0,qtyReserved:()=>0,
 hasPermission:()=>true,
 productCatalogCard:g=>'<article>'+g.key+'</article>',
 catalogSortOptions:[['name-asc','Nome']],
 button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',
 uiIcon:()=>'',categoryFull:()=>'',h:v=>String(v??'')
};
vm.createContext(context);
vm.runInContext(scope,context,{timeout:1000});

test('Produtos renderiza filtros de gôndola após extração para função compartilhada',()=>{
 const rendered=vm.runInContext('productsPage()',context,{timeout:1000});
 assert.match(rendered,/Gôndola 01/);
 assert.match(rendered,/product:p1/);
 assert.match(rendered,/Imprimir estoque/);
});

test('Sem resultado com EAN ambíguo: mensagem renderizada, sem ReferenceError',()=>{
 state.search='123456789';state.productSearchDraft=state.search;
 const rendered=vm.runInContext('productsPage()',context,{timeout:1000});
 assert.match(rendered,/Os últimos nove dígitos deste EAN correspondem a mais de um produto/);
 assert.match(rendered,/Gôndola 01/);
 state.search='';state.productSearchDraft='';
});

test('Impressão e listagem compartilham o mesmo conjunto e os filtros',()=>{
 const result=vm.runInContext('selectedProductCatalogGroups()',context,{timeout:1000});
 assert.equal(result.groups.length,1);
 assert.equal(result.matched.length,1);
 assert.equal(result.gondolas.length,1);
 assert.ok(Object.hasOwn(result,'codeResult'));
});
