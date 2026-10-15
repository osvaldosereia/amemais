// Galeria compartilhada pelo modelo: até 3 fotos, com ordem e capa editáveis.
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const initialPaths=item=>Array.isArray(item?.image_paths)&&item.image_paths.length?
 item.image_paths.slice(0,3):(item?.image_path?[item.image_path]:[]);
export function galleryMarkup(item){
 const paths=initialPaths(item);
 return '<section class="form-section wide gallery-editor"><div class="section-head"><strong>Fotos do produto</strong>'+
 '<small>Até 3 fotos por modelo; a primeira é a capa</small></div>'+
 '<div data-gallery class="product-gallery-grid">'+paths.map((path,i)=>photoTile({path},i)).join('')+'</div>'+
 '<div class="gallery-controls"><button type="button" class="button" data-action="choose-photo">+ Adicionar fotos</button>'+
 '<button type="button" class="button" data-action="take-photo">📷 Câmera</button>'+
 '<small data-photo-status>Selecione até 3 fotos. Você pode trocar, remover ou escolher a principal.</small></div>'+
 '<input hidden type="file" name="gallery_file" accept="image/*" multiple>'+
 '<input hidden type="file" name="camera_file" accept="image/*" capture="environment"></section>';
}
function photoTile(item,i){
 return '<div class="gallery-tile" data-gallery-item data-path="'+esc(item.path||'')+'">'+
 '<button type="button" data-action="gallery-zoom" class="gallery-thumb" aria-label="Ampliar imagem '+(i+1)+'">'+
 '<img '+(item.url?'src="'+esc(item.url)+'"':'data-photo-path="'+esc(item.path)+'"')+' alt="Foto '+(i+1)+' do produto" loading="lazy"></button>'+
 '<div class="gallery-tile-actions">'+
 '<button type="button" data-action="gallery-primary" data-index="'+i+'" '+(i===0?'disabled':'')+'>'+(i===0?'Principal':'Definir capa')+'</button>'+
 '<button type="button" data-action="gallery-remove" data-index="'+i+'">Excluir</button></div></div>';
}
export function galleryState(form){
 if(!form.__gallery){
  form.__gallery=[...form.querySelectorAll('[data-gallery-item]')].map(el=>({path:el.dataset.path||''})).filter(x=>x.path);
  form.__galleryInitial=form.__gallery.map(x=>x.path);
 }
 return form.__gallery;
}
function paint(form){
 const gallery=form.querySelector('[data-gallery]');if(!gallery)return;
 gallery.replaceChildren();
 gallery.innerHTML=galleryState(form).map(photoTile).join('');
 form.querySelector('[data-photo-status]').textContent=galleryState(form).length+
  ' de 3 foto(s). A primeira é exibida nos cards e na impressão.';
}
export function galleryRemove(form,index){
 const photos=galleryState(form);
 if(index<0||index>=photos.length)return;
 const [old]=photos.splice(index,1);
 if(old.url)URL.revokeObjectURL(old.url);
 paint(form);
}
export function galleryMain(form,index){
 const photos=galleryState(form);
 if(index<=0||index>=photos.length)return;
 photos.unshift(photos.splice(index,1)[0]);paint(form);
}
export async function galleryAddFiles(form,files,compress){
 const photos=galleryState(form);const incoming=[...files];
 if(!incoming.length)return;
 if(incoming.length+photos.length>3)throw Error('É permitido cadastrar no máximo 3 fotos por modelo.');
 const compressed=[];
 for(const file of incoming){
  if(!file.type.startsWith('image/')||file.size>20*1024*1024)
   throw Error('Use imagens de até 20 MB, em formato JPG, PNG ou WEBP.');
  const blob=await compress(file);
  compressed.push({blob,url:URL.createObjectURL(blob)});
 }
 photos.push(...compressed);paint(form);
}
export async function savePhotoGallery(form,{db,assertOk,modelId=null,productId=null}){
 const gallery=galleryState(form);
 if(gallery.length>3)throw Error('Máximo de três fotos.');
 const folder=modelId?'apparel/'+modelId+'/':productId+'/';
 if(!modelId&&!productId)throw Error('Produto não identificado para as fotos.');
 const uploaded=[];
 const paths=[];
 for(const item of gallery){
  if(item.path){paths.push(item.path);continue;}
  if(!item.blob)continue;
  const path=folder+crypto.randomUUID()+'.'+(item.blob.type==='image/webp'?'webp':'jpg');
  assertOk(await db.storage.from('ame-produtos').upload(path,item.blob,{
   contentType:item.blob.type,upsert:false
  }));
  uploaded.push(path);paths.push(path);
 }
 if(modelId)assertOk(await db.rpc('set_apparel_gallery',{p_model:modelId,p_paths:paths}));
 else assertOk(await db.from('products').update({
  image_paths:paths,image_path:paths[0]||null
 }).eq('id',productId));
 // Limpeza é posterior à atualização; erro de limpeza não reverte dados válidos.
 const removed=(form.__galleryInitial||[]).filter(x=>x&&!paths.includes(x)&&x.startsWith(folder));
 if(removed.length){
  try{const r=await db.storage.from('ame-produtos').remove(removed);
   if(r.error)console.warn('Arquivo desvinculado mas remoção física pendente',r.error);}
  catch(error){console.warn('Limpeza posterior de foto necessária',error);}
 }
 return {paths,uploaded,removed};
}
export function galleryHasChanges(form){
 const photos=galleryState(form);
 const old=form.__galleryInitial||[];
 return photos.some(x=>x.blob)||photos.map(x=>x.path).join('|')!==old.join('|');
}
