import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraFailureMessage,cameraVideoConstraints,openPhotoCamera} from '../src/photo-camera.js';
const gallery=readFileSync(new URL('../src/photo-gallery.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../photo-camera.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/secure-entry.js',import.meta.url),'utf8');
test('Botão Câmera usa webcam real; escolha de arquivo é independente',()=>{
 assert.match(gallery,/data-action="take-photo">📷 Abrir câmera/);
 assert.match(gallery,/name="gallery_file"/);
 assert.doesNotMatch(gallery,/capture="environment"/);
 assert.doesNotMatch(gallery,/name="camera_file"/);
 assert.match(app,/if\(action==='take-photo'\)/);
 assert.match(app,/openPhotoCamera\(\{form,onCapture:async file=>/);
 assert.match(app,/galleryAddFiles\(form,\[file\],compressPhoto\)/);
 assert.match(app,/if\(action==='choose-photo'\)/);
 assert.doesNotMatch(app,/input\[name="camera_file"\]/);
});
test('Solicita vídeo sem áudio, prioriza câmera traseira, permite dispositivo específico',()=>{
 assert.deepEqual(cameraVideoConstraints().audio,false);
 assert.equal(cameraVideoConstraints().video.facingMode.ideal,'environment');
 assert.deepEqual(cameraVideoConstraints('camera-123').video,{deviceId:{exact:'camera-123'}});
 assert.equal(typeof openPhotoCamera,'function');
});
test('Mensagens distinguem câmera negada, ausente, ocupada ou HTTP',()=>{
 assert.match(cameraFailureMessage({name:'NotAllowedError'}),/Permita o acesso/);
 assert.match(cameraFailureMessage({name:'NotFoundError'}),/Nenhuma câmera/);
 assert.match(cameraFailureMessage({name:'NotReadableError'}),/outro aplicativo/);
 assert.match(cameraFailureMessage({name:'NoSecureContext'}),/HTTPS/);
});
test('Libera tracks ao fechar, aborta permissão tardia e não envia foto automaticamente',()=>{
 const source=readFileSync(new URL('../src/photo-camera.js',import.meta.url),'utf8');
 assert.match(source,/track=>track\.stop\(\)/);
 assert.match(source,/if\(disposed\|\|ticket!==generation\)/);
 assert.match(source,/document\.addEventListener\('visibilitychange',onVisibility\)/);
 assert.match(source,/watcher\.observe\(document\.body/);
 assert.match(source,/await onCapture\(blob\)/);
 assert.doesNotMatch(source,/supabase|storage\.from/);
 assert.match(css,/\.product-photo-camera-backdrop/);
 assert.match(css,/z-index:100000/);
});
test('Novos arquivos têm versão própria para impedir cache de interface antiga',()=>{
 assert.match(index,/photo-camera\.css\?v=20261022camera1/);
 assert.match(index,/secure-entry\.js\?v=20261022passwordfix1/);
 assert.match(entry,/app\.js\?v=20261022passwordfix1/);
 assert.match(app,/photo-camera\.js\?v=20261022camera1/);
 assert.match(app,/photo-gallery\.js\?v=20261022camera1/);
});
