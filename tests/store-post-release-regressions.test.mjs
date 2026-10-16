import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const unitSource=await readFile(new URL('../src/store-unit.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const eventSource=await readFile(new URL('../src/event-simple.js',import.meta.url),'utf8');
const {renderStoreUnit}=await import('data:text/javascript;base64,'+Buffer.from(unitSource).toString('base64'));
const {eventCompactDetail}=await import('data:text/javascript;base64,'+Buffer.from(eventSource).toString('base64'));
const button=(label,action,extra='')=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>';
const own={id:'own',name:'Loja Cristo Rei',kind:'filial',ownership_type:'propria',active:true};
const fr={id:'fr',name:'Franquia A',kind:'franquia',active:true};
const order={id:'ord1',kind:'loja',code:'AA100',status:'recebido_divergente',total:5,raw:{to_store_id:'fr'},created_at:'2026-10-16'};

test('recebimento da franquia exibe quantidades conferidas por SKU e diferenças',()=>{
 const html=renderStoreUnit({store:fr,tab:'recebimentos',orders:[order],
  storeOrderReceipts:[{order_id:'ord1',product_id:'sku1',expected_quantity:5,received_quantity:3,missing_quantity:2,reason:'Faltaram duas peças'}],
  products:[{id:'sku1',name:'Camiseta HDH',sku:'HDH01'}],context:{button}});
 assert.match(html,/Camiseta HDH/);
 assert.match(html,/3\s*de\s*5/);
 assert.match(html,/2\s*(?:un\.|unidades).*falta/i);
 assert.match(html,/Faltaram duas peças/);
});

test('aba estoque sem saldo positivo exibe estado vazio real',()=>{
 const html=renderStoreUnit({store:own,tab:'estoque',storeBalances:[{store_id:'own',product_id:'sku1',quantity:0}],context:{button}});
 assert.match(html,/Não há saldo físico registrado/);
 assert.doesNotMatch(html,/<div class="su-data-list"><\/div>/);
});

test('fechamento de temporária não oferece encerramento com pedidos ainda abertos',()=>{
 const html=eventCompactDetail({
  event:{id:'ev',name:'Evento X',status:'ativo'},tab:'fechamento',
  balances:[],products:[],openOrders:2,canClose:true,button
 });
 assert.doesNotMatch(html,/data-action="event-close"/);
 assert.match(html,/2 pedidos? pendentes?/i);
});

test('mensagens de fechamento não orientam registrar vendas',()=>{
 const close=appSource.slice(appSource.indexOf("if(action==='event-close')"),appSource.indexOf("if(action==='member-remove')"));
 assert.doesNotMatch(close,/registre venda\/baixa|vendas não|registrar venda/i);
 assert.match(close,/hasPermission\('events.close'\)/);
});

test('exclusão de membro exige permissão explícita e escopo do evento',()=>{
 const section=appSource.slice(appSource.indexOf("if(action==='member-remove')"),appSource.indexOf("if(action==='user-toggle')"));
 assert.match(section,/hasPermission\('events.manage'\)/);
 assert.match(section,/eventById\(eventId\)/);
});
