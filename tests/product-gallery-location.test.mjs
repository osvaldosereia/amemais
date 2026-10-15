import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=await readFile(new URL('../src/stock-workflows.js',import.meta.url),'utf8');
const {groupInventory,groupedCard,productGalleryPaths}=await import(
 'data:text/javascript;base64,'+Buffer.from(src).toString('base64')
);
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>(
 {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
));
const props={
 h:safe,photoButton:()=>'<button class="fallback-photo">Foto</button>',
 qtyStore:()=>12,qtyEvent:()=>0,qtyReserved:()=>0,qtyAvailable:()=>12,
 button:(label,action,attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',
 isManager:()=>true,canRegisterProducts:()=>true
};
const product={id:'p1',name:'Camiseta HDH',active:true,apparel_model_id:'m1',
 apparel_size:'P',gondola:'03',prateleira:'B',image_path:'photos/old.webp'};

test('modelo com múltiplas fotos exibe setas, contador e amplia foto atual',()=>{
 const group=groupInventory([product],[{
  id:'m1',name:'Camiseta HDH',image_paths:['model/front.webp','model/back.webp','model/detail.webp']
 }])[0];
 const html=groupedCard(group,props);
 assert.deepEqual(productGalleryPaths(group),['model/front.webp','model/back.webp','model/detail.webp']);
 assert.match(html,/data-action="product-gallery-prev"/);
 assert.match(html,/data-action="product-gallery-next"/);
 assert.match(html,/data-action="product-gallery-zoom"/);
 assert.match(html,/data-photo-path="model\/front.webp"/);
 assert.match(html,/1 \/ 3/);
 assert.match(html,/aria-label="Próxima foto de Camiseta HDH"/);
});
test('uma só foto não exibe setas nem contador',()=>{
 const group=groupInventory([{...product,apparel_model_id:null}],[])[0];
 const html=groupedCard(group,props);
 assert.deepEqual(productGalleryPaths(group),['photos/old.webp']);
 assert.doesNotMatch(html,/data-action="product-gallery-next"/);
 assert.doesNotMatch(html,/data-action="product-gallery-prev"/);
 assert.doesNotMatch(html,/data-gallery-count/);
});
test('usa galeria do produto quando o modelo só tem uma foto',()=>{
 const group=groupInventory([{
  ...product,image_paths:['product/front.webp','product/back.webp']
 }],[{id:'m1',name:'Camiseta',image_path:'model/old.webp'}])[0];
 assert.deepEqual(productGalleryPaths(group),['product/front.webp','product/back.webp','photos/old.webp']);
});
test('destaca gôndola e prateleira no card e nas variações',()=>{
 const group=groupInventory([product],[{id:'m1',name:'Camiseta HDH'}])[0];
 const html=groupedCard(group,props);
 assert.match(html,/class="product-card-location"/);
 assert.match(html,/Gôndola 03 · Prateleira B/);
 assert.match(html,/class="group-variant-location"/);
});
test('foto e localização são escapadas no HTML',()=>{
 const group=groupInventory([{...product,apparel_model_id:null,
  name:'<script>x</script>',gondola:'<img src=x>',image_paths:['image/"quote.webp']
 }],[])[0];
 const html=groupedCard(group,props);
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/<img src=x>/);
 assert.match(html,/&quot;quote.webp/);
});
