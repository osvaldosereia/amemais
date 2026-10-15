import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/photo-gallery.js',import.meta.url),'utf8');
const {galleryMarkup,galleryState,galleryHasChanges}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('modelo com três fotos exibe uma principal e operações de trocar/excluir',()=>{
 const paths=['apparel/model/1.webp','apparel/model/2.webp','apparel/model/3.webp'];
 const html=galleryMarkup({image_paths:paths,image_path:paths[0]});
 assert.equal((html.match(/data-gallery-item/g)||[]).length,3);
 assert.equal((html.match(/data-action="gallery-replace"/g)||[]).length,3);
 assert.equal((html.match(/data-action="gallery-remove"/g)||[]).length,3);
 assert.equal((html.match(/data-action="gallery-primary"/g)||[]).length,3);
 assert.match(html,/data-index="0" disabled/);
 assert.match(html,/gallery_replace_file/);
});
test('foto antiga continua aparecendo na galeria sem migração destrutiva',()=>{
 const html=galleryMarkup({image_path:'catalogo/foto-antiga.webp'});
 assert.equal((html.match(/data-gallery-item/g)||[]).length,1);
 assert.match(html,/catalogo\/foto-antiga.webp/);
});
test('estado preserva ordem inicial para detectar troca e remoção',()=>{
 const form={querySelectorAll:()=>[{dataset:{path:'a'}},{dataset:{path:'b'}}]};
 const state=galleryState(form);
 assert.equal(state.length,2);
 assert.equal(galleryHasChanges(form),false);
 state.reverse();
 assert.equal(galleryHasChanges(form),true);
});
