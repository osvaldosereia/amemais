import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const gallerySrc=await read('src/photo-gallery.js');
const workflow=await read('src/stock-workflows.js');
const app=await read('src/app.js');
const css=await read('product-gallery-navigation.css');
const mig=await read('supabase/migrations/20261016_gallery_six_photos.sql');
const {galleryMarkup,galleryState,galleryHasChanges,galleryAddFiles}=await import('data:text/javascript;base64,'+Buffer.from(gallerySrc).toString('base64'));
test('galeria abre seis fotos existentes sem truncar, mantendo a primeira como principal',()=>{
 const paths=Array.from({length:6},(_,i)=>'apparel/00000000-0000-0000-0000-000000000001/'+i+'.webp');
 const html=galleryMarkup({image_paths:paths,image_path:paths[0]});
 assert.equal((html.match(/data-gallery-item/g)||[]).length,6);
 assert.match(html,/Até 6 fotos/);
 assert.match(html,/6 fotos/);
 assert.match(html,/data-index="0" disabled/);
 assert.match(html,/name="gallery_file"/);
});
test('novo upload pode atingir 6 imagens mas bloqueia a sétima antes de compactar',async()=>{
 const items=Array.from({length:6},(_,i)=>({dataset:{path:'product/p'+i+'.webp'}}));
 const form={querySelectorAll:()=>items,querySelector:()=>null};
 const files=[{type:'image/jpeg',size:400}];
 let compressed=0;
 await assert.rejects(galleryAddFiles(form,files,async()=>{compressed++;return {size:120,type:'image/webp'}}),/máximo 6 fotos/i);
 assert.equal(compressed,0);
 assert.equal(galleryState(form).length,6);
 assert.equal(galleryHasChanges(form),false);
});
test('card oferece atalho de ícone acessível ao editor de fotos quando autorizado',()=>{
 assert.match(workflow,/'product-gallery-quick','camera'/);
 assert.match(workflow,/'Editar fotos de '\+group.title/);
 assert.match(workflow,/product-card-photo-quick/);
 assert.match(workflow,/canEdit\?/);
 assert.match(css,/\.product-card-photo-quick/);
 assert.match(app,/if\(action==='product-gallery-quick'\)/);
 assert.match(app,/hasPermission\('products.edit'\)/);
});
test('produto único pode salvar fotos sem submeter novamente seu cadastro',()=>{
 assert.match(app,/function quickProductPhotoModal/);
 assert.match(app,/type==='product-photo-quick'/);
 assert.match(app,/savePhotoGallery\(form,\{db,assertOk,productId:id\}\)/);
 assert.match(app,/galleryHasChanges\(form\)/);
 assert.match(app,/apparelPhotoModal\(/);
});
test('migração atualiza 2 limites e o RPC com autorização original',()=>{
 assert.match(mig,/DROP CONSTRAINT IF EXISTS products_gallery_max_three/);
 assert.match(mig,/DROP CONSTRAINT IF EXISTS apparel_gallery_max_three/);
 assert.match(mig,/cardinality\(image_paths\) <= 6/g);
 assert.match(mig,/CREATE OR REPLACE FUNCTION public.set_apparel_gallery/);
 assert.match(mig,/cardinality\(p_paths\)\s*>\s*6/);
 assert.match(mig,/app_private\.has_permission\('products.edit'\)/);
 assert.doesNotMatch(mig,/DELETE FROM public.products|DELETE FROM public.apparel_models/);
});
