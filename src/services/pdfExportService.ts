import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

// Dimensões de página A4 e margens usadas no relatório em PDF
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2;

/**
 * Gera um PDF a partir de um container que contém vários blocos marcados com a
 * classe "pdf-block". Cada bloco é capturado como uma imagem (preservando os
 * gráficos exatamente como aparecem na tela) e posicionado no PDF, quebrando
 * de página automaticamente e evitando cortar um bloco (ex: o gráfico de uma
 * pergunta) ao meio sempre que ele cabe inteiro em uma página.
 */
export async function exportPrintableReportToPdf(
  containerId: string,
  fileName: string,
  onProgress?: (etapa: string, atual: number, total: number) => void
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error('Não foi possível localizar o conteúdo do relatório para exportar.');
  }

  const blocks = Array.from(container.querySelectorAll<HTMLElement>('.pdf-block'));
  if (blocks.length === 0) {
    throw new Error('Não há conteúdo para exportar neste relatório.');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  let cursorYMm = MARGIN_MM;
  let isFirstImageOnPdf = true;

  for (let i = 0; i < blocks.length; i++) {
    onProgress?.('Renderizando seção', i + 1, blocks.length);

    const block = blocks[i];
    const canvas = await html2canvas(block, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
    const blockHeightMm = canvas.height / pxPerMm;

    if (blockHeightMm <= CONTENT_HEIGHT_MM) {
      // O bloco cabe inteiro: quebra de página apenas se não couber no espaço restante
      if (!isFirstImageOnPdf && cursorYMm + blockHeightMm > PAGE_HEIGHT_MM - MARGIN_MM) {
        pdf.addPage();
        cursorYMm = MARGIN_MM;
      }
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', MARGIN_MM, cursorYMm, CONTENT_WIDTH_MM, blockHeightMm);
      cursorYMm += blockHeightMm + 4;
      isFirstImageOnPdf = false;
    } else {
      // Bloco maior que uma página inteira (ex: tabela longa de respondentes):
      // fatiar em pedaços do tamanho de uma página
      if (!isFirstImageOnPdf) {
        pdf.addPage();
        cursorYMm = MARGIN_MM;
      }
      const pageHeightPx = Math.floor(CONTENT_HEIGHT_MM * pxPerMm);
      let renderedPx = 0;
      let firstSlice = true;

      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const sliceHeightMm = sliceHeightPx / pxPerMm;

          if (!firstSlice) {
            pdf.addPage();
            cursorYMm = MARGIN_MM;
          }
          pdf.addImage(sliceImgData, 'JPEG', MARGIN_MM, cursorYMm, CONTENT_WIDTH_MM, sliceHeightMm);
          cursorYMm += sliceHeightMm + 4;
        }
        renderedPx += sliceHeightPx;
        firstSlice = false;
      }
      isFirstImageOnPdf = false;
    }
  }

  onProgress?.('Finalizando arquivo', blocks.length, blocks.length);
  pdf.save(fileName);
}
