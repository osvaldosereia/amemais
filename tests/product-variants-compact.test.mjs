import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const {groupInventory,groupedCard}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sizes=['P','M','G','GG'];
const products=sizes.map((size,i)=>({
 id:'sku-'+size,apparel_model_id:'model-1',name:'CAMISETA AVIVA 2026 - '+size,
 apparel_size:size,apparel_color:'Azul',active:true,
 sku:'AVV-BB-'+size,ean:'789123456789'+i
}));
const group=groupInventory(products,[{id:'model-1',name:'CAMISETA AVIVA 2026 - BABY LOOK'}])[0];
const options={
 h:x=>String(x),photoButton:()=>'<button>Foto do produto</button>',
 qtyStore:id=>({P:32,M:41,G:35,GG:15})[id.replace('sku-','')]||0,
 qtyEvent:()=>0,qtyReserved:()=>0,
 qtyAvailable:id=>({P:32,M:41,G:35,GG:15})[id.replace('sku-','')]||0,
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true,canEditProduct:()=>true,
 canManageSku:()=>true,canBalance:()=>true,canStockEntry:()=>true,canStockExit:()=>true,
 canLabel:true,canShare:true
};
const html=groupedCard(group,options);
test('consulta de variações não repete imagens por tamanho',()=>{
 const section=html.split('<div class="product-variant-overview"')[1].split('<details class="product-advanced-stock">')[0];
 assert.equal((section.match(/data-variant-overview-id=/g)||[]).length,4);
 assert.doesNotMatch(section,/<img|product-photo|gallery-thumb|mini-photo/);
 for(const size of sizes)assert.match(section,new RegExp('AVV-BB-'+size));
});
test('consulta imediata mostra saldo físico, reservado, disponível e edição para cada SKU',()=>{
 const section=html.split('product-variant-overview-list')[1].split('product-variant-add')[0];
 assert.match(section,/product-variant-size/);
 assert.equal((section.match(/product-variant-figure is-available/g)||[]).length,4);
 assert.equal((section.match(/data-action="apparel-variant-edit"/g)||[]).length,4);
 assert.match(section,/data-variant-overview-id="sku-P"/);
 assert.match(section,/EAN: 7891234567890/);
 assert.match(section,/Físico/);
 assert.match(section,/Reservado/);
 assert.match(section,/Disponível/);
});
test('balanço e movimentação aparecem em seção fechada, preservando controles existentes',()=>{
 assert.match(html,/<summary>Variações \(4\)<\/summary>/);
 assert.match(html,/<details class="product-advanced-stock"><summary>Operações de estoque/);
 assert.match(html,/data-stock-panel="balanco"/);
 assert.match(html,/data-stock-panel="movimentar"/);
 assert.match(html,/data-stock-panel="historico"/);
 assert.match(html,/data-action="product-balance-save"/);
 assert.match(html,/data-action="product-stock-mode"/);
 assert.doesNotMatch(html,/<details class="product-advanced-stock" open/);
});
test('card fechado contém todos os saldos, com layout de três colunas',()=>{
 const header=html.split('grouped-inventory-top')[1].split('grouped-inventory-actions')[0];
 assert.match(header,/Disponível/);
 assert.match(header,/Físico/);
 assert.match(header,/Reservado/);
 assert.match(header,/stock-total-breakdown/);
 assert.doesNotMatch(header,/EAN individual por variação/);
 const css=await readFile(new URL('../product-card-clean-v8.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@container productcard \(max-width:620px\)/);
 assert.match(css,/@media\(max-width:355px\)/);
});
test('sem permissão de edição não oferece botões para alterar variações',()=>{
 const viewOnly=groupedCard(group,{...options,canEditProduct:()=>false,canRegisterProducts:()=>false,
  canManageSku:()=>false,canBalance:()=>false,canStockEntry:()=>false,canStockExit:()=>false,
  canLabel:false,canShare:false});
 const section=viewOnly.split('product-variant-overview-list')[1].split('product-advanced-stock')[0];
 assert.doesNotMatch(section,/data-action="apparel-variant-edit"/);
 assert.doesNotMatch(section,/data-action="add-variants"/);
 assert.match(section,/product-variant-figure is-available/);
});
