// Fotografia expressa no balanço rápido, sem movimentar estoque.
// Reutiliza a galeria existente (até seis fotos); a foto nova vira capa.
export const QUICK_BALANCE_PHOTO_MAX_BYTES=100000;

function assertOk(response){
 if(response?.error)throw response.error;
 return response?.data;
}

export function existingPhotoPaths(item){
 const entries=Array.isArray(item?.image_paths)&&item.image_paths.length?
  item.image_paths:(item?.image_path?[item.image_path]:[]);
 return [...new Set(entries.filter(path=>typeof path==='string'&&path.length>0))];
}

export async function saveQuickBalancePhoto({db,product,file,compressPhoto}){
 if(!product?.id||product.force_archived_at)
  throw Error('Produto arquivado ou indisponível. Releia o código.');
 if(typeof compressPhoto!=='function')throw Error('Compactador de fotos indisponível.');
 const modelId=product.apparel_model_id||null;
 const source=modelId?
  assertOk(await db.from('apparel_models')
   .select('id,image_path,image_paths,force_archived_at').eq('id',modelId).single()):
  assertOk(await db.from('products')
   .select('id,force_archived_at,image_path,image_paths').eq('id',product.id).single());
 if(!source||source.force_archived_at)
  throw Error('Cadastro indisponível para salvar a foto.');
 const current=existingPhotoPaths(source);
 if(current.length>=6)
  throw Error('Este produto já tem seis fotos. Abra o cadastro e remova uma antes de fotografar.');
 const compressed=await compressPhoto(file,QUICK_BALANCE_PHOTO_MAX_BYTES);
 if(!compressed||!['image/jpeg','image/webp'].includes(compressed.type)||
    compressed.size<1||compressed.size>QUICK_BALANCE_PHOTO_MAX_BYTES)
  throw Error('Foto fora do limite de 100 KB; tente novamente.');
 const folder=modelId?'apparel/'+modelId+'/':product.id+'/';
 const path=folder+crypto.randomUUID()+(compressed.type==='image/webp'?'.webp':'.jpg');
 assertOk(await db.storage.from('ame-produtos').upload(path,compressed,{
  contentType:compressed.type,upsert:false
 }));
 const paths=[path,...current];
 try{
  if(modelId){
   assertOk(await db.rpc('set_apparel_gallery',{p_model:modelId,p_paths:paths}));
  }else{
   const updated=assertOk(await db.from('products').update({
    image_paths:paths,image_path:path
   }).eq('id',product.id).is('force_archived_at',null)
    .select('id').maybeSingle());
   if(!updated)throw Error('Não foi possível vincular a fotografia ao cadastro.');
  }
 }catch(error){
  // Estoquista pode enviar fotos, mas não tem DELETE no Storage.
  // Nunca marcar sucesso se o arquivo foi enviado sem vínculo no cadastro.
  console.warn('Imagem enviada sem vínculo no cadastro; limpeza pendente:',path,error);
  throw error;
 }
 return {path,paths,modelId,productId:product.id,bytes:compressed.size};
}
