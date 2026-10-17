import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const css=await readFile(new URL('../product-card-clean-v8.css',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const touchScript=await readFile(new URL('../src/product-card-mobile-gallery.js',import.meta.url),'utf8');
const {groupInventory,groupedCard}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options={
 h:escape,photoButton:()=>'<button class="fallback-photo">Sem foto</button>',
 qtyStore:()=>123,qtyEvent:()=>0,qtyReserved:()=>0,qtyAvailable:()=>123,
 button:(label,action,attrs='')=>'<button type="button" data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true,canEditProduct:()=>true,
 canManageSku:()=>true,canLabel:true,canShare:true,
 categories:[{id:'c1',name:'Roupas'}]
};
const product={id:'p1',name:'Camiseta',active:true,apparel_model_id:'m1',
 category_id:'c1',apparel_size:'P',gondola:'01',image_path:'photos/front.webp'};
const model={id:'m1',name:'CAMISETA AVIVA 2026 - BABY LOOK',category_id:'c1',
 tags:['Aviva'],image_paths:['photos/front.webp','photos/back.webp']};

test('foto não contém botão de edição; atalho permanece fora da imagem e respeita permissão',()=>{
 const html=groupedCard(groupInventory([product],[model])[0],options);
 const photo=html.split('<div class="grouped-inventory-photo">')[1].split('<div class="grouped-inventory-info">')[0];
 assert.doesNotMatch(photo,/product-card-photo-quick/);
 const info=html.split('<div class="grouped-inventory-info">')[1];
 assert.match(info,/product-card-photo-quick/);
 assert.match(info,/data-action="product-gallery-quick"/);
 assert.match(info,/aria-label="Editar fotos/);
 assert.match(info,/product-card-name/);
 const blocked=groupedCard(groupInventory([product],[model])[0],
  {...options,canEditProduct:()=>false,canRegisterProducts:()=>false});
 assert.doesNotMatch(blocked,/data-action="product-gallery-quick"/);
});
test('metadados reais, galeria e estoques permanecem corretos',()=>{
 const html=groupedCard(groupInventory([product],[model])[0],options);
 assert.match(html,/product-gallery-indicators/);
 assert.match(html,/product-gallery-indicator is-active/);
 assert.match(html,/data-action="product-gallery-next"/);
 assert.match(html,/data-action="product-gallery-zoom"/);
 assert.match(html,/Roupas/);
 assert.match(html,/Aviva/);
 assert.match(html,/Gôndola 01/);
 assert.match(html,/Ver variações \(1\)/);
 assert.match(html,/Disponível/);
 assert.match(html,/Físico/);
 assert.match(html,/Reservado/);
 assert.match(html,/data-product-details/);
 assert.match(html,/data-product-editor/);
});
test('camada mobile segue a referência e esconde setas sem suprimir navegação',()=>{
 assert.match(index,/product-card-clean-v8\.css\?v=20261017mobile-ref1/);
 assert.match(index,/product-card-mobile-gallery\.js/);
 assert.match(css,/\.product-gallery-arrow,[\s\S]*?\.product-gallery-count\{\s*display:none!important/);
 assert.match(css,/grid-template-areas:"photo info" "totals totals"/);
 assert.match(css,/aspect-ratio:4\/5!important/);
 assert.match(css,/\.product-card-photo-quick/);
 assert.match(css,/\.product-card-context-chip/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.35fr\)/);
 assert.match(css,/#102d50/);
});
test('deslizar troca a foto via ações existentes, sem impedir rolagem vertical',()=>{
 const handlers=new Map();
 const document={addEventListener(name,fn){handlers.set(name,fn);}};
 const MutationObserver=class{observe(){}};
 vm.runInNewContext(touchScript,{document,MutationObserver,WeakSet});
 let next=0,previous=0;
 const gallery={
  isConnected:true,dataset:{galleryIndex:'0'},
  closest:()=>({querySelectorAll:()=>[]}),
  querySelector:selector=>selector.includes('next')?{click(){next++;}}:
   selector.includes('prev')?{click(){previous++;}}:null
 };
 const target={closest:()=>gallery};
 handlers.get('touchstart')({touches:[{clientX:160,clientY:70}],target});
 handlers.get('touchend')({changedTouches:[{clientX:80,clientY:73}]});
 assert.equal(next,1);
 handlers.get('touchstart')({touches:[{clientX:80,clientY:70}],target});
 handlers.get('touchend')({changedTouches:[{clientX:170,clientY:74}]});
 assert.equal(previous,1);
 handlers.get('touchstart')({touches:[{clientX:120,clientY:70}],target});
 handlers.get('touchend')({changedTouches:[{clientX:118,clientY:160}]});
 assert.equal(next,1);
});
