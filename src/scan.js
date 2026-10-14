// Leitor EAN: câmera nativa quando possível e ZXing no iPhone/outros navegadores.
const formats=['ean_13','ean_8','upc_a','upc_e','itf','code_128','code_39'];
let cleanup=null;
let zxingPromise=null;
const validEAN=value=>/^[0-9]{8,14}$/.test(String(value??'').trim())?String(value).trim():null;

async function zxing(){
  if(!zxingPromise){
    zxingPromise=import('https://esm.sh/@zxing/browser@0.1.5')
      .catch(()=>import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm'))
      .catch(error=>{zxingPromise=null;throw error;});
  }
  const lib=await zxingPromise;
  const Reader=lib.BrowserMultiFormatOneDReader || lib.BrowserMultiFormatReader;
  if(typeof Reader!=='function')throw new Error('Leitor de códigos de barras indisponível');
  return new Reader();
}

function explain(error){
  if(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name))
    return 'Permita a câmera nas configurações do navegador e tente novamente.';
  if(['NotFoundError','DevicesNotFoundError'].includes(error?.name))
    return 'Nenhuma câmera encontrada. Use uma foto ou digite o EAN.';
  if(['NotReadableError','TrackStartError'].includes(error?.name))
    return 'Câmera ocupada por outro aplicativo. Feche-o e tente novamente.';
  if(error?.message==='https')
    return 'A câmera precisa de HTTPS. Abra o site oficial pelo navegador.';
  return 'Não foi possível iniciar a leitura. Tente novamente ou use uma foto.';
}

async function detector(){
  if(!window.BarcodeDetector?.getSupportedFormats)return null;
  try{
    const supported=await window.BarcodeDetector.getSupportedFormats();
    const kinds=formats.filter(f=>supported.includes(f));
    if(!kinds.some(f=>['ean_13','ean_8','upc_a'].includes(f)))return null;
    return new window.BarcodeDetector({formats:kinds});
  }catch{return null;}
}

export function scanEAN(onCode){
  cleanup?.();
  const backdrop=document.createElement('div');
  backdrop.className='scan-backdrop';
  backdrop.innerHTML=[
    '<section class="scan-panel" role="dialog" aria-modal="true" aria-label="Leitor de EAN">',
    '<header><strong>Ler EAN</strong><button type="button" class="plain" data-close>Fechar ✕</button></header>',
    '<div class="scan-video-wrap"><video autoplay muted playsinline aria-label="Câmera"></video>',
    '<div class="scan-guide" aria-hidden="true"></div></div>',
    '<p data-status role="status" aria-live="polite">Abrindo câmera…</p>',
    '<div class="scan-actions"><button class="button" type="button" data-retry>Tentar câmera novamente</button>',
    '<label class="button scan-file-button">Ler foto do código<input type="file" accept="image/*" data-photo aria-label="Escolher foto do EAN"></label></div>',
    '<form class="scan-manual" autocomplete="off"><label for="scan-manual-input">Ou digite o EAN</label>',
    '<div class="scan-manual-row"><input id="scan-manual-input" inputmode="numeric" pattern="[0-9]{8,14}" maxlength="14" required placeholder="8 a 14 dígitos">',
    '<button class="button primary" type="submit">Usar código</button></div></form></section>'
  ].join('');
  document.body.appendChild(backdrop);

  const video=backdrop.querySelector('video');
  const message=backdrop.querySelector('[data-status]');
  const retry=backdrop.querySelector('[data-retry]');
  const photo=backdrop.querySelector('[data-photo]');
  let disposed=false,stream=null,controls=null,animation=0,sequence=0,starting=false;

  const status=(text,error=false)=>{
    if(disposed)return;
    message.textContent=text;message.classList.toggle('scan-error',error);
  };
  const stopCamera=()=>{
    ++sequence;
    if(animation)cancelAnimationFrame(animation);
    animation=0;
    controls?.stop?.();controls=null;
    stream?.getTracks().forEach(t=>t.stop());
    video.srcObject?.getTracks?.().forEach(t=>t.stop());
    stream=null;video.srcObject=null;
  };
  const close=()=>{
    if(disposed)return;
    disposed=true;stopCamera();backdrop.remove();
    if(cleanup===close)cleanup=null;
  };
  cleanup=close;
  const detected=code=>{
    const normalized=validEAN(code);
    if(!normalized){
      status('Código não aceito. EAN deve ter de 8 a 14 dígitos.',true);return;
    }
    if(disposed)return;
    close();try{navigator.vibrate?.(50);}catch{}
    onCode(normalized);
  };
  backdrop.querySelector('[data-close]').addEventListener('click',close);
  backdrop.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();close();}
  },true);
  backdrop.querySelector('.scan-manual').addEventListener('submit',event=>{
    event.preventDefault();event.stopPropagation();
    detected(backdrop.querySelector('#scan-manual-input').value);
  });

  async function begin(){
    if(disposed||starting)return;
    starting=true;stopCamera();
    const generation=sequence;
    retry.disabled=true;
    status('Solicitando permissão da câmera…');
    try{
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('https');
      // Abre a câmera antes de carregar bibliotecas externas (importante no celular).
      let feed;
      try{
        feed=await navigator.mediaDevices.getUserMedia({
          audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}
        });
      }catch(e){
        if(!['OverconstrainedError','NotFoundError'].includes(e.name))throw e;
        feed=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
      }
      if(disposed||generation!==sequence){
        feed.getTracks().forEach(t=>t.stop());return;
      }
      stream=feed;video.srcObject=feed;
      await video.play();
      if(disposed||generation!==sequence)return;
      status('Aponte para as barras do EAN, com boa luz e sem reflexos.');
      const native=await detector();
      if(disposed||generation!==sequence)return;

      const startZXing=async()=>{
        const reader=await zxing();
        if(disposed||generation!==sequence)return;
        controls=await reader.decodeFromStream(feed,video,(decoded,_error,readerControls)=>{
          if(disposed||generation!==sequence){readerControls?.stop?.();return;}
          if(decoded)detected(decoded.getText());
        });
        if(disposed||generation!==sequence)controls?.stop?.();
      };

      if(native){
        let last=0,startedAt=null,switched=false;
        const fallback=async()=>{
          if(switched||disposed||generation!==sequence)return;
          switched=true;
          if(animation)cancelAnimationFrame(animation);
          animation=0;
          status('Ajustando foco e tentando outro método de leitura…');
          try{
            await startZXing();
            if(!disposed&&generation===sequence)
              status('Leitor alternativo ativo. Aproxime o EAN do centro da câmera.');
          }catch(error){
            status('Não foi possível ler pela câmera. Use foto ou digite o código.',true);
          }
        };
        const tick=async time=>{
          if(disposed||generation!==sequence||switched)return;
          if(startedAt===null)startedAt=time;
          if(time-startedAt>=3500){await fallback();return;}
          if(time-last>=170&&video.readyState>=2){
            last=time;
            try{
              const results=await native.detect(video);
              if(disposed||generation!==sequence||switched)return;
              const result=results.map(x=>validEAN(x.rawValue)).find(Boolean);
              if(result){detected(result);return;}
            }catch{await fallback();return;}
          }
          if(!disposed&&generation===sequence&&!switched)animation=requestAnimationFrame(tick);
        };
        animation=requestAnimationFrame(tick);
      }else{
        status('Iniciando leitura de código de barras…');
        await startZXing();
        if(!disposed&&generation===sequence)
          status('Leitor ativo. Centralize as barras, ajuste a distância e a iluminação.');
      }
    }catch(error){
      if(!disposed&&generation===sequence){
        status(explain(error),true);
        stopCamera();
      }
    }finally{
      starting=false;
      if(!disposed)retry.disabled=false;
    }
  }
  retry.addEventListener('click',()=>{void begin();});
  photo.addEventListener('change',async()=>{
    const file=photo.files?.[0];
    if(!file||disposed)return;
    if(!file.type.startsWith('image/')||file.size>15*1024*1024){
      status('Selecione uma foto válida de até 15 MB.',true);return;
    }
    status('Procurando código na foto…');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.src=url;
      await new Promise((resolve,reject)=>{
        image.onload=resolve;
        image.onerror=()=>reject(new Error('Foto inválida'));
      });
      if(disposed)return;
      let result=null;
      const native=await detector();
      if(native){
        try{result=(await native.detect(image)).map(x=>validEAN(x.rawValue)).find(Boolean);}
        catch{/* Alguns navegadores não permitem imagem estática; usar ZXing. */}
      }
      if(!result){
        const reader=await zxing();
        const decoded=await reader.decodeFromImageElement(image);
        result=validEAN(decoded.getText());
      }
      if(result)detected(result);
      else status('Não foi possível identificar o EAN. Tente uma foto mais nítida.',true);
    }catch{
      status('Código não encontrado na foto. Use outra foto ou digite o EAN.',true);
    }finally{
      URL.revokeObjectURL(url);
      photo.value='';
    }
  });
  // Falha de câmera não fecha o leitor: foto e entrada manual ficam disponíveis.
  void begin();
}
