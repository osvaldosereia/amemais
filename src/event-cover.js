// Capa de eventos em proporção 16:9, recorte central consistente.
export async function cropEventCover(file){
 if(!file||!file.type?.startsWith('image/'))throw Error('Escolha uma imagem válida.');
 if(file.size>20*1024*1024)throw Error('A imagem deve ter até 20 MB.');
 const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
 canvas.width=1600;canvas.height=900;
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('Não foi possível preparar a capa.');}
 const scale=Math.max(1600/bitmap.width,900/bitmap.height);
 const w=bitmap.width*scale,h=bitmap.height*scale;
 ctx.drawImage(bitmap,(1600-w)/2,(900-h)/2,w,h);
 bitmap.close();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Erro ao converter capa.')),'image/webp',0.83));
 if(blob.size>2097152)throw Error('A capa ficou acima de 2 MB.');
 return blob;
}
export async function uploadEventCover(db,eventId,file){
 const blob=await cropEventCover(file),path='events/'+eventId+'/'+crypto.randomUUID()+'.webp';
 const upload=await db.storage.from('ame-eventos').upload(path,blob,{contentType:'image/webp',upsert:false});
 if(upload.error)throw upload.error;
 const save=await db.from('events').update({cover_path:path}).eq('id',eventId);
 if(save.error)throw save.error;
 return path;
}
export async function generateEventCover(db,eventId){
 const response=await db.functions.invoke('generate-event-cover',{body:{event_id:eventId}});
 if(response.error){
  let message=response.error.message;
  try{const info=await response.error.context?.json?.();if(info?.error)message=info.error;}
  catch{}
  throw Error('Geração de capa indisponível: '+message);
 }
 if(!response.data?.base64)throw Error(response.data?.error||'Não foi possível gerar a imagem.');
 const binary=atob(response.data.base64),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return uploadEventCover(db,eventId,new Blob([bytes],{type:'image/webp'}));
}
