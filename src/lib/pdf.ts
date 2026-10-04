import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Renders every `[data-pdf-page]` inside `root` to one A4 PDF page each.
 * Pages are laid out at 794×1123 CSS px (A4 at 96 dpi), so the canvas maps
 * onto the PDF page without distortion.
 */

const waitForAssets = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );
  try {
    await document.fonts.ready;
  } catch {
    // Older browsers: fonts are almost certainly loaded by the time a user clicks export.
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
};

const buildPdf = async (root: HTMLElement) => {
  await waitForAssets(root);
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (pages.length === 0) throw new Error('Nothing to export.');

  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let first = true;
  for (const page of pages) {
    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: page.offsetWidth,
      height: page.offsetHeight,
      windowWidth: page.offsetWidth,
      windowHeight: page.offsetHeight
    });

    // Scale to the A4 width; content taller than one sheet continues on the next PDF page.
    const ratio = pageWidth / canvas.width;
    const sliceHeight = Math.floor(pageHeight / ratio);
    for (let offset = 0; offset < canvas.height - 2; offset += sliceHeight) {
      const height = Math.min(sliceHeight, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = height;
      slice.getContext('2d')?.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, height * ratio, undefined, 'FAST');
    }
  }
  return pdf;
};

export const downloadPdf = async (root: HTMLElement, fileName: string) => {
  const pdf = await buildPdf(root);
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};

/** Opens the PDF in a new tab; falls back to downloading if a popup blocker interferes. */
export const previewPdf = async (root: HTMLElement, fileName: string) => {
  const popup = window.open('', '_blank');
  const pdf = await buildPdf(root);
  const url = pdf.output('bloburl').toString();
  if (popup) {
    popup.location.href = url;
  } else {
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  }
};
