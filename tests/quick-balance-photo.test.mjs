import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quickStockResult} from '../src/quick-balance.js';
import {saveQuickBalancePhoto,existingPhotoPaths,QUICK_BALANCE_PHOTO_MAX_BYTES} from '../src/quick-balance-photo.js';
import {compressPhoto} from '../src/photos.js';

const product={id:'a-id',name:'Produto A',active:true,ean:'12345678'};
const tinyFile={type:'image/webp',size:79000};
const compress=async (_file,max)=>{assert.equal(max,100000);return tinyFile;};

function fakeDb({model=null,initial={active:true,image_path:'antiga.jpg',image_paths:['antiga.jpg']},errorUpload=null,errorDb=null}={}){
 const calls={uploads:[],updates:[],rpcs:[]};
 const db={
  from(table){
   return {
    select(){return this;},eq(){return this;},is(){return this;},
    single:async()=>({data:table==='apparel_models'?model:initial,error:errorDb&&errorDb.phase==='select'?errorDb:null}),
    update(payload){calls.updates.push({table,payload});return this;},
    maybeSingle:async()=>({data:{id:product.id},error:errorDb&&errorDb.phase==='update'?errorDb:null})
   };
  },
  storage:{
   from(bucket){
    assert.equal(bucket,'ame-produtos');
    return {upload:async(path,file,options)=>{
     calls.uploads.push({path,file,options});
     return {data:errorUpload?null:{path},error:errorUpload};
    }};
   }
  },
  rpc:async(name,payload)=>{
   calls.rpcs.push({name,payload});
   return {data:null,error:errorDb&&errorDb.phase==='rpc'?errorDb:null};
  }
 };
 return {db,calls};
}

test('Botão aparece após encontrar produto e exige permissão de edição',()=>{
 const html=quickStockResult(product,{physical:12,reserved:2,can:()=>true});
 assert.match(html,/data-action="quick-balance-product-photo"/);
 assert.match(html,/Tirar foto e salvar no cadastro/);
 assert.match(html,/até 100 KB/);
 assert.match(html,/data-form="quick-balance-action"/);
 assert.doesNotMatch(quickStockResult(product,{can:permission=>permission!=='products.edit'}),/quick-balance-product-photo/);
});

test('A fotografia fica na capa e preserva fotos antigas, sem movimentar estoque',async()=>{
 const {db,calls}=fakeDb();
 const result=await saveQuickBalancePhoto({db,product,file:new Blob(),compressPhoto:compress});
 assert.equal(result.bytes,79000);
 assert.ok(result.path.startsWith(product.id+'/'));
 assert.equal(result.paths[1],'antiga.jpg');
 assert.deepEqual(calls.updates[0].payload.image_paths,result.paths);
 assert.equal(calls.updates[0].payload.image_path,result.path);
 assert.equal(calls.uploads[0].file.size,79000);
 assert.equal(calls.uploads[0].options.upsert,false);
 assert.equal(calls.rpcs.length,0);
});

test('Foto do SKU com variação atualiza a galeria do modelo por RPC existente',async()=>{
 const modelId='modelo-1';
 const {db,calls}=fakeDb({model:{id:modelId,image_path:'apparel/antiga.webp',image_paths:['apparel/antiga.webp']}});
 const result=await saveQuickBalancePhoto({db,product:{...product,apparel_model_id:modelId},file:new Blob(),compressPhoto:compress});
 assert.equal(result.modelId,modelId);
 assert.equal(calls.rpcs[0].name,'set_apparel_gallery');
 assert.deepEqual(calls.rpcs[0].payload.p_paths,result.paths);
 assert.ok(result.path.startsWith('apparel/'+modelId+'/'));
 assert.equal(calls.updates.length,0);
});

test('Galeria cheia impede envio e não apaga nenhuma foto',async()=>{
 const {db,calls}=fakeDb({initial:{active:true,image_paths:['1','2','3','4','5','6']}});
 await assert.rejects(saveQuickBalancePhoto({db,product,file:new Blob(),compressPhoto:compress}),/seis fotos/);
 assert.equal(calls.uploads.length,0);
 assert.equal(calls.updates.length,0);
});

test('Não salva arquivos maiores que 100.000 bytes e não escreve no banco',async()=>{
 const {db,calls}=fakeDb();
 await assert.rejects(saveQuickBalancePhoto({
  db,product,file:new Blob(),compressPhoto:async()=>({size:100001,type:'image/jpeg'})
 }),/100 KB/);
 assert.equal(calls.uploads.length,0);
 assert.equal(calls.updates.length,0);
 assert.equal(QUICK_BALANCE_PHOTO_MAX_BYTES,100000);
});

test('Erro do Storage não atualiza cadastro nem retorna sucesso',async()=>{
 const {db,calls}=fakeDb({errorUpload:new Error('Upload indisponível')});
 await assert.rejects(saveQuickBalancePhoto({db,product,file:new Blob(),compressPhoto:compress}),/Upload indisponível/);
 assert.equal(calls.updates.length,0);
});

test('Normaliza lista de fotos e mantém foto antiga legada',()=>{
 assert.deepEqual(existingPhotoPaths({image_path:'legada.webp'}),['legada.webp']);
 assert.deepEqual(existingPhotoPaths({image_paths:['a','a','b'],image_path:'a'}),['a','b']);
});

test('Compactador reduz resolução até respeitar 100 KB no navegador',async()=>{
 const oldBitmap=globalThis.createImageBitmap,oldDocument=globalThis.document;
 const sizes=[];
 globalThis.createImageBitmap=async()=>({width:1800,height:1200,close(){}});
 globalThis.document={createElement:()=>({
  width:0,height:0,
  getContext(){return {drawImage:()=>{}};},
  toBlob(done,mime,quality){
   sizes.push([this.width,this.height,quality]);
   const length=Math.max(1,Math.round(this.width*this.height*quality));
   done(new Blob([new Uint8Array(length)],{type:mime}));
  }
 })};
 try{
  const output=await compressPhoto(new Blob(['camera'],{type:'image/jpeg'}),100000);
  assert.ok(output.size<=100000);
  assert.ok(output.size>0);
  assert.ok(sizes.some(([width])=>width<960),'precisa reduzir resolução quando necessário');
 }finally{
  globalThis.createImageBitmap=oldBitmap;
  globalThis.document=oldDocument;
 }
});

test('Tela preserva quantidade digitada ao salvar a foto e atualiza miniatura',()=>{
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/saveQuickBalancePhoto\(\{/);
 assert.match(app,/saveImmediately:true/);
 assert.match(app,/existing\.replaceWith\(image\)/);
 assert.match(app,/Não reconstruir o formulário/);
 assert.match(app,/image\.dataset\.photoPath=saved\.path/);
 assert.match(app,/state\.loading=true/);
});
