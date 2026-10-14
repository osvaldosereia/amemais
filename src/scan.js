let cleanup = null;

export async function scanEAN(onCode) {
  if (cleanup) cleanup();
  const overlay = document.createElement('div');
  overlay.className = 'scan-backdrop';
  overlay.innerHTML = '<section class="scan-panel" role="dialog" aria-modal="true" aria-label="Ler código de barras"><header><strong>Ler código EAN</strong><button type="button" class="plain" data-close-scan>Fechar ×</button></header><video autoplay muted playsinline aria-label="Câmera para escanear código"></video><p>Aponte a câmera para o código de barras. Se não funcionar, digite o EAN manualmente.</p></section>';
  document.body.appendChild(overlay);
  let stopped = false, controls = null, stream = null, timer = null;
  const video = overlay.querySelector('video');
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    controls?.stop?.();
    stream?.getTracks()?.forEach(track => track.stop());
    video.srcObject?.getTracks()?.forEach(track => track.stop());
    overlay.remove();
    cleanup = null;
  };
  cleanup = stop;
  overlay.querySelector('[data-close-scan]').onclick = stop;
  const found = value => {
    if (stopped || !value) return;
    stop();
    onCode(String(value).trim());
  };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível. Use HTTPS e permita o acesso.');
    // ZXing amplia a compatibilidade onde BarcodeDetector nativo não é suportado.
    const { BrowserMultiFormatReader } = await import('https://esm.sh/@zxing/browser@0.1.5');
    if (stopped) return;
    const reader = new BrowserMultiFormatReader();
    controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (result, err) => {
      if (result) found(result.getText());
    });
    if (stopped) controls?.stop?.();
  } catch (error) {
    if (!stopped) {
      stop();
      throw new Error('Não foi possível iniciar o leitor: ' + error.message);
    }
  }
}