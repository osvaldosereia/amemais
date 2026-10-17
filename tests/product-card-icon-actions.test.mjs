import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source=await read('src/stock-workflows.js');
const app=await read('src/app.js');
const css=await read('product-card-actions-icons.css');
const html=await read('index.html');
const {groupInventory,groupedCard}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const variants=['P','M','G','GG'].map((sz,i)=>({id:'sku-'+i,name:'CAMISETA',apparel_model_id:'model1',active:true,apparel_size:sz,sku:'SKU-'+sz,gondola:'01'}));
const group=groupInventory(variants,[{id:'model1',name:'Camiseta Aviva'}])[0];
const opts={
 h:escape,photoButton:()=>'<button>Foto</button>',
 qtyStore:()=>10,qtyEvent:()=>0,qtyAvailable:()=>10,qtyReserved:()=>0,
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true,canEditProduct:()=>true,
 canDeleteWholeModel:()=>true,canDeleteProduct:()=>true,canLabel:true,canShare:true
};
test('sete ações diretas, sem menu oculto ou texto visual; cada controle com título e aria-label',()=>{
 const card=groupedCard(group,opts);
 const toolbar=card.split('product-card-icon-toolbar')[1].split('</div>')[0];
 const acts=[...toolbar.matchAll(/data-action="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(acts,[
  'product-card-sizes','product-card-edit-toggle','product-gallery-quick',
  'shelf-label-open','share-product','add-variants','product-model-delete'
 ]);
 assert.equal((toolbar.match(/<svg /g)||[]).length,7);
 assert.equal((toolbar.match(/aria-label="/g)||[]).length,7);
 assert.equal((toolbar.match(/ title="/g)||[]).length,7);
 assert.doesNotMatch(card,/product-card-utilities|Mais opções/);
 assert.match(toolbar,/aria-label="Ver variações \(4\)"/);
 assert.match(toolbar,/aria-label="Etiqueta 80 mm"/);
 assert.match(toolbar,/aria-label="Excluir produto e todas as variações"/);
 assert.match(toolbar,/data-id="model1"/);
});
test('edição contém somente Geral e Variações; foto exclusivamente pelo ícone câmera externo',()=>{
 const card=groupedCard(group,opts);
 const header=card.split('grouped-inventory-top')[1].split('product-card-icon-toolbar')[0];
 assert.doesNotMatch(header,/product-card-photo-quick/);
 const editor=card.split('data-product-editor')[1];
 assert.match(editor,/data-tab="geral"/);
 assert.match(editor,/data-tab="variacoes"/);
 assert.doesNotMatch(editor,/data-tab="fotos"|data-editor-panel="fotos"|Gerenciar fotos/);
 assert.equal((card.match(/data-action="product-gallery-quick"/g)||[]).length,1);
 assert.match(card,/class="product-icon-action product-card-photo-quick"/);
 assert.match(card,/circle cx="12" cy="13" r="3"/);
});
test('perfis sem autonomia não recebem comandos de cadastro, exclusão ou fotos',()=>{
 const card=groupedCard(group,{...opts,canEditProduct:()=>false,canRegisterProducts:()=>false,
  canDeleteWholeModel:()=>false,canDeleteProduct:()=>false,canShare:false,canLabel:false});
 assert.match(card,/data-action="product-card-sizes"/);
 for(const action of ['product-card-edit-toggle','product-gallery-quick','share-product','shelf-label-open','add-variants','product-model-delete'])
  assert.doesNotMatch(card,new RegExp('data-action="'+action+'"'));
});
test('layout tem alvos acessíveis em desktop e grade de quatro colunas no celular',()=>{
 assert.match(css,/product-card-icon-toolbar>button\.product-icon-action/);
 assert.match(css,/min-height:44px!important/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(css,/product-icon-danger/);
 assert.match(css,/:focus-visible/);
 const last=html.match(/<link rel="stylesheet"[^>]+>/g).at(-1);
 assert.match(last,/product-card-actions-icons\.css\?v=20261017icons1/);
});
test('alternância das abas mantém SVG original sem substituir innerHTML',()=>{
 const toggle=app.split("if(action==='product-card-sizes'||action==='product-card-edit-toggle')")[1].split("if(action==='product-stock-tab'")[0];
 assert.match(toggle,/aria-expanded/);
 assert.match(toggle,/aria-label/);
 assert.match(toggle,/\.title=label/);
 assert.doesNotMatch(toggle,/\.innerHTML\s*=/);
});
