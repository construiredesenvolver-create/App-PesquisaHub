/**
 * Comprime uma imagem no navegador (redimensiona e reduz qualidade) antes de enviar
 * para o backend, economizando espaço no Google Drive e tempo de upload no celular.
 */
export function compressImageToBase64(
  file: File,
  maxDimensionPx: number = 1280,
  quality: number = 0.72
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível processar a imagem selecionada.'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimensionPx || height > maxDimensionPx) {
          if (width >= height) {
            height = Math.round((height / width) * maxDimensionPx);
            width = maxDimensionPx;
          } else {
            width = Math.round((width / height) * maxDimensionPx);
            height = maxDimensionPx;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem selecionada.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
