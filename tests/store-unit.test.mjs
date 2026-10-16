import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/store-unit.js',import.meta.url),'utf8');
const {renderStoreUnit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const button=(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>';
const own={id:'own',name:'Loja Cristo Rei',code:'CRISTOREICBA',kind:'filial',ownership_type:'propria',active:true};
const franchise={id:'fr',name:'Franquia Azul',kind:'franquia',active:true};
const orders=[{id:'a',kind:'loja',code:'AA002',status:'separado',total:5,created_at:'2026-10-15',raw:{to_store_id:'own'}}];
test('loja própria exibe estoque físico e opera por unidade',()=>{
 const html=renderStoreUnit({store:own,orders,storeBalances:[{store_id:'own',product_id:'sku',quantity:11}],products:[{id:'sku',name:'Camiseta A'}],tab:'estoque',context:{button,canMove:true,canManageStores:true,canRequest:true}});
 assert.match(html,/11 un/);
 assert.match(html,/data-action="branch-stock-new"/);
 assert.match(html,/data-id="own"/);
 assert.match(html,/Camiseta A/);
 assert.doesNotMatch(html,/Gerenciar outra loja/);
});
test('franquia não mostra estoque físico nem funções de filial',()=>{
 const html=renderStoreUnit({store:franchise,orders:[],tab:'resumo',context:{button,canRequest:true,canManageStores:true}});
 assert.doesNotMatch(html,/Estoque físico|branch-stock-new|branch-return-new/);
 assert.match(html,/Solicitações|franquia|Franquia/);
});
test('pedidos na unidade têm ação contextual e etapa correta',()=>{
 const html=renderStoreUnit({store:own,orders,tab:'pedidos',context:{button,canBrowseOrders:true}});
 assert.match(html,/data-action="store-hub-open-order"/);
 assert.match(html,/data-location-id="own"/);
 assert.match(html,/A conferir/);
 assert.doesNotMatch(html,/5 unidades conferidas/);
});
test('sem permissão de criar pedido ou movimentar estoque não mostra botões de escrita',()=>{
 const html=renderStoreUnit({store:own,orders:[],tab:'resumo',context:{button}});
 assert.doesNotMatch(html,/data-action="branch-stock-new"|data-action="store-order-new"|data-action="branch-return-new"/);
});
test('nomes de lojas e produtos são escapados',()=>{
 const html=renderStoreUnit({store:{...own,name:'<script>x</script>'},products:[{id:'sku',name:'<img onerror=x>'}],storeBalances:[{store_id:'own',product_id:'sku',quantity:3}],tab:'estoque',context:{button}});
 assert.doesNotMatch(html,/<script>|<img onerror=/);
});
