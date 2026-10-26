// Captura fotográfica real via getUserMedia (desktop e celular).
// A câmera não faz upload: entrega a foto ao fluxo existente da galeria.
let activeClose=null;
export function cameraFailureMessage(error){
 const name=error?.name||'';
 if(name==='NotAllowedError'||name==='PermissionDeniedError'||name==='SecurityError')
  return 'A câmera está bloqueada. Permita o acesso à câmera nas configurações do navegador e tente novamente.';
 if(name==='NotFoundError'||name==='DevicesNotFoundError')
  return 'Nenhuma câmera foi encontrada. Conecte uma webcam e tente novamente, ou use Adicionar fotos.';
 if(name==='NotReadableError'||name==='TrackStartError')
  return 'A câmera está sendo utilizada por outro aplicativo. Feche o aplicativo e tente novamente.';
 if(name==='OverconstrainedError')return 'Esta câmera não suporta a configuração solicitada. Tente outra câmera.';
 if(name==='AbortError')return 'Não foi possível iniciar a câmera. Tente novamente.';
 if(name==='NoSecureContext')return 'A câmera exige conexão HTTPS. Abra o CDSB pelo endereço seguro.';
 return 'Não foi possível abrir a câmera. Confira as permissões e tente novamente.';
}
export function cameraVideoConstraints(deviceId){
 return {
  audio:false,
  video:deviceId?{deviceId:{exact:deviceId}}:{
   facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}
  }
 };
}
export function openPhotoCamera({form,onCapture,saveImmediately=false}){
 if(!form||typeof onCapture!=='function')throw Error('Galeria de fotos indisponível.');
 activeClose?.();
 const origin=document.activeElement;
 const backdrop=document.createElement('div');
 backdrop.className='product-photo-camera-backdrop';
 backdrop.innerHTML='<section class="product-photo-camera-panel" role="dialog" aria-modal="true" aria-label="Fotografar produto">'+
  '<header class="product-photo-camera-header"><strong>Fotografar produto</strong>'+
  '<button type="button" class="button" data-photo-camera-close aria-label="Fechar câmera">Fechar ✕</button></header>'+
  '<div class="product-photo-camera-viewport"><video autoplay muted playsinline aria-label="Imagem ao vivo da câmera"></video>'+
  '<span class="product-photo-camera-wait" data-photo-camera-wait>Iniciando câmera…</span></div>'+
  '<p class="product-photo-camera-status" role="status" aria-live="polite" data-photo-camera-status>Solicitando permissão da câmera…</p>'+
  '<div class="product-photo-camera-device" data-photo-camera-device-wrap hidden>'+
  '<label for="product-photo-camera-device">Câmera em uso</label>'+
  '<select id="product-photo-camera-device" data-photo-camera-device></select></div>'+
  '<footer class="product-photo-camera-actions">'+
  '<button class="button" type="button" data-photo-camera-retry>Tentar novamente</button>'+
  '<button class="button primary" type="button" data-photo-camera-shoot disabled>Fotografar</button></footer>'+
  '<p class="product-photo-camera-note">Depois de fotografar, clique em <strong>Salvar fotos</strong> na ficha do produto.</p>'+
  '</section>';
 document.body.append(backdrop);
 if(saveImmediately)backdrop.querySelector('.product-photo-camera-note').textContent=
  'A foto será compactada e salva automaticamente no cadastro (até 100 KB).';
 const video=backdrop.querySelector('video');
 const statusNode=backdrop.querySelector('[data-photo-camera-status]');
 const wait=backdrop.querySelector('[data-photo-camera-wait]');
 const retry=backdrop.querySelector('[data-photo-camera-retry]');
 const shoot=backdrop.querySelector('[data-photo-camera-shoot]');
 const chooser=backdrop.querySelector('[data-photo-camera-device]');
 const deviceWrap=backdrop.querySelector('[data-photo-camera-device-wrap]');
 const closeButton=backdrop.querySelector('[data-photo-camera-close]');
 let stream=null,disposed=false,generation=0,starting=false,capturing=false;
 let watcher=null;
 const status=(value,error=false)=>{
  if(disposed)return;
  statusNode.textContent=value;statusNode.classList.toggle('is-error',error);
 };
 const stopStream=()=>{
  if(stream)stream.getTracks().forEach(track=>track.stop());
  stream=null;video.pause();video.srcObject=null;
  shoot.disabled=true;
 };
 const onVisibility=()=>{if(document.hidden)close();};
 const onPageHide=()=>close();
 const close=()=>{
  if(disposed)return;
  disposed=true;++generation;stopStream();
  watcher?.disconnect();watcher=null;
  document.removeEventListener('visibilitychange',onVisibility);
  window.removeEventListener('pagehide',onPageHide);
  backdrop.remove();
  if(activeClose===close)activeClose=null;
  if(form.isConnected&&origin?.isConnected)origin.focus({preventScroll:true});
 };
 activeClose=close;
 const onKeyDown=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  if(event.key!=='Tab')return;
  const focusable=[...backdrop.querySelectorAll('button:not([disabled]),select:not([disabled]):not([hidden])')]
   .filter(el=>!el.closest('[hidden]'));
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 };
 backdrop.addEventListener('keydown',onKeyDown,true);
 closeButton.addEventListener('click',close);
 backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});
 document.addEventListener('visibilitychange',onVisibility);
 window.addEventListener('pagehide',onPageHide);
 if(typeof MutationObserver==='function'){
  watcher=new MutationObserver(()=>{if(!form.isConnected)close();});
  watcher.observe(document.body,{childList:true,subtree:true});
 }
 async function listDevices(selected){
  try{
   const devices=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput');
   if(disposed||devices.length<2){deviceWrap.hidden=true;return;}
   chooser.replaceChildren();
   devices.forEach((device,index)=>{
    const option=document.createElement('option');
    option.value=device.deviceId;option.textContent=device.label||'Câmera '+(index+1);
    chooser.append(option);
   });
   chooser.value=selected||devices[0].deviceId;
   deviceWrap.hidden=false;
  }catch{deviceWrap.hidden=true;}
 }
 async function begin(deviceId=''){
  if(disposed||starting||capturing)return;
  starting=true;const ticket=++generation;stopStream();
  retry.disabled=true;wait.hidden=false;
  status('Solicitando permissão da câmera…');
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    const error=new Error('HTTPS required');error.name='NoSecureContext';throw error;
   }
   let feed;
   try{feed=await navigator.mediaDevices.getUserMedia(cameraVideoConstraints(deviceId));}
   catch(error){
    if(deviceId||!['OverconstrainedError','NotFoundError'].includes(error?.name))throw error;
    feed=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
   }
   if(disposed||ticket!==generation){
    feed.getTracks().forEach(track=>track.stop());return;
   }
   stream=feed;video.srcObject=feed;
   await video.play();
   if(disposed||ticket!==generation)return;
   wait.hidden=true;shoot.disabled=false;
   status('Câmera pronta. Enquadre o produto e clique em Fotografar.');
   await listDevices(feed.getVideoTracks()[0]?.getSettings?.().deviceId);
  }catch(error){
   if(!disposed&&ticket===generation){
    stopStream();status(cameraFailureMessage(error),true);
    wait.hidden=true;
   }
  }finally{
   starting=false;
   if(!disposed)retry.disabled=false;
  }
 }
 retry.addEventListener('click',()=>{void begin(chooser.value||'');});
 chooser.addEventListener('change',()=>{void begin(chooser.value);});
 shoot.addEventListener('click',async()=>{
  if(disposed||!stream||capturing||!form.isConnected)return;
  if(!video.videoWidth||!video.videoHeight){
   status('A imagem ainda não está pronta. Aguarde um instante.',true);return;
  }
  capturing=true;shoot.disabled=true;retry.disabled=true;
  status('Preparando fotografia…');
  try{
   const canvas=document.createElement('canvas');
   const scale=Math.min(1,1920/Math.max(video.videoWidth,video.videoHeight));
   canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
   canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas indisponível');
   ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise((resolve,reject)=>
    canvas.toBlob(file=>file?resolve(file):reject(Error('Não foi possível gerar a fotografia')),'image/jpeg',0.9));
   if(disposed||!form.isConnected)return;
   await onCapture(blob);
   if(!disposed)close();
  }catch(error){
   status(error?.message||'Não foi possível fotografar. Tente novamente.',true);
  }finally{
   capturing=false;
   if(!disposed){shoot.disabled=!stream;retry.disabled=false;}
  }
 });
 closeButton.focus({preventScroll:true});
 void begin();
 return close;
}
