// Compacta fotos no próprio aparelho antes do envio (sem servidor externo).
export async function compressPhoto(file, maxBytes = 450000) {
  if (!file?.type?.startsWith('image/')) throw new Error('Selecione uma foto válida.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const mime of ['image/webp', 'image/jpeg']) {
      for (const quality of [0.8, 0.68, 0.54, 0.4]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
        if (blob && blob.type === mime && blob.size <= maxBytes) {
          return new File([blob], 'produto.' + (mime === 'image/webp' ? 'webp' : 'jpg'), { type: mime });
        }
      }
    }
    throw new Error('A foto ficou grande demais; escolha uma imagem menor.');
  } finally { bitmap.close(); }
}