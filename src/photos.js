// Compacta fotos no aparelho antes do envio. Balanço rápido: até 100.000 bytes.
export async function compressPhoto(file,maxBytes=450000){
 if(!file?.type?.startsWith('image/'))throw Error('Selecione uma foto válida.');
 if(!Number.isInteger(maxBytes)||maxBytes<1000)throw Error('Limite de foto inválido.');
 const bitmap=await createImageBitmap(file);
 try{
  if(!bitmap.width||!bitmap.height)throw Error('A imagem não pôde ser aberta.');
  const maxEdge=Math.max(bitmap.width,bitmap.height);
  const preferred=maxBytes<=100000?960:1280;
  const dimensions=[preferred,840,720,600,480,360,256,192];
  for(const edge of dimensions){
   const scale=Math.min(1,edge/maxEdge);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Compactação indisponível neste aparelho.');
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const mime of ['image/webp','image/jpeg']){
    for(const quality of [0.8,0.68,0.54,0.4,0.3]){
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality));
     if(blob&&blob.type===mime&&blob.size>0&&blob.size<=maxBytes)
      return new File([blob],'produto.'+(mime==='image/webp'?'webp':'jpg'),{type:mime});
    }
   }
  }
  throw Error('Não foi possível compactar a foto para até '+Math.ceil(maxBytes/1000)+' KB. Tente outra imagem.');
 }finally{bitmap.close?.();}
}
