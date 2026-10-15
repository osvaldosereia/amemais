import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/sku-panel.js',import.meta.url),'utf8');
const {skuPanelModes,renderSkuPanel,validateSkuAction}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const item={
 id:'product-id',name:'Camiseta Masculina HDH · Branco M',sku:'1000112',ean:'000100001129',
 active:true,apparel_color:'Branco',apparel_size:'M',gondola:'01',prateleira:'B'
};
const enabled=()=>true;
const validate=(mode,values,physical=23,reserved=0)=>validateSkuAction({mode,values,physical,reserved});

test('o painel mostra físico, reservado, livre e os quatro comandos',()=>{
 const html=renderSkuPanel({item,model:{name:'Camiseta Masculina HDH'},physical:23,reserved:5,
  can:enabled,reservations:[{order_id:'00000000-aaaa',quantity:5}],history:[]});
 for(const mode of skuPanelModes)assert.match(html,new RegExp('data-mode="'+mode.key+'"'));
 assert.match(html,/>23<\/strong>/);
 assert.match(html,/>5<\/strong>/);
 assert.match(html,/>18<\/strong>/);
 assert.match(html,/Pedido #00000000/);
 assert.match(html,/Gôndola 01/);
 assert.match(html,/000100001129/);
});
test('permissão restrita não expõe abas de entrada, saída ou edição',()=>{
 const html=renderSkuPanel({item,physical:23,reserved:0,can:perm=>perm==='stock.balance'});
 assert.match(html,/data-mode="contagem"/);
 assert.doesNotMatch(html,/data-mode="entrada"/);
 assert.doesNotMatch(html,/data-mode="saida"/);
 assert.doesNotMatch(html,/data-mode="edicao"/);
});
test('contagem zero é válida sem reservas; divergência exige justificativa',()=>{
 assert.equal(validate('contagem',{count_qty:'0',count_note:'Contagem realizada'}).quantity,0);
 assert.throws(()=>validate('contagem',{count_qty:'0',count_note:'a'}),/Explique a divergência/);
 assert.throws(()=>validate('contagem',{count_qty:'0',count_note:'Contagem confirmada'},23,5),/reservada/);
 assert.equal(validate('contagem',{count_qty:'23',count_note:''}).quantity,23);
});
test('saída protege o estoque livre, não o físico total',()=>{
 const base={exit_qty:'19',exit_reason:'extravio',exit_note:'Produto extraviado'};
 assert.throws(()=>validate('saida',base,23,5),/Estoque livre insuficiente/);
 assert.equal(validate('saida',{...base,exit_qty:'18'},23,5).quantity,18);
});
test('avaria e doação requerem justificativa, doação identifica destinatário',()=>{
 assert.equal(validate('saida',{exit_qty:'2',exit_reason:'avaria',exit_note:'Costura aberta'}).reason,'avaria');
 assert.throws(()=>validate('saida',{exit_qty:'1',exit_reason:'doacao',exit_note:'Doação à escola'}),/Informe quem recebeu/);
 assert.equal(validate('saida',{exit_qty:'1',exit_reason:'doacao',exit_note:'Doação à escola',exit_recipient:'Instituição'}).recipient,'Instituição');
});
test('entrada só aceita quantidades inteiras positivas e referência até 400 caracteres',()=>{
 assert.equal(validate('entrada',{entry_qty:'5',entry_note:'Fábrica'}).quantity,5);
 for(const qty of ['0','-1','1.5','','1000001'])
  assert.throws(()=>validate('entrada',{entry_qty:qty}),/quantidade|unidade/i);
});
test('edição valida EAN sem alterar estoque',()=>{
 const edited=validate('edicao',{edit_name:'Camiseta M',edit_sku:'ABC',edit_ean:'000100001129',
  edit_gondola:'A',edit_prateleira:'02'});
 assert.deepEqual(edited,{name:'Camiseta M',sku:'ABC',ean:'000100001129',gondola:'A',prateleira:'02'});
 assert.throws(()=>validate('edicao',{edit_name:'Camisa',edit_ean:'1234'}),/EAN/);
});
test('texto dos dados do produto é escapado na ficha',()=>{
 const html=renderSkuPanel({item:{...item,name:'<script>alert(1)</script>'},physical:23,reserved:0,can:enabled});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
