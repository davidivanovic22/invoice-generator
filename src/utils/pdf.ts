import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type PdfOptions = {
  element: HTMLElement;
  fileName?: string;
};

const waitForAssets = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));

  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  if ('fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    } catch {
      // ignore
    }
  }
};

const renderPdf = async (
  { element, fileName }: PdfOptions,
  mode: 'preview' | 'download'
) => {
  await waitForAssets(element);

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const margin = 20;
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = pdfHeight - margin * 2;

  const rect = element.getBoundingClientRect();
  const targetWidth = Math.round(rect.width);
  const targetHeight = Math.round(rect.height);

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    width: targetWidth,
    height: targetHeight,
    windowWidth: targetWidth,
    windowHeight: targetHeight
  });

  if (!canvas.width || !canvas.height) {
    throw new Error('Canvas render failed.');
  }

  const imgData = canvas.toDataURL('image/png', 1.0);

  const imgRatio = canvas.width / canvas.height;
  const pageRatio = contentWidth / contentHeight;

  let imgWidth = contentWidth;
  let imgHeight = contentHeight;

  if (imgRatio > pageRatio) {
    imgWidth = contentWidth;
    imgHeight = imgWidth / imgRatio;
  } else {
    imgHeight = contentHeight;
    imgWidth = imgHeight * imgRatio;
  }

  const x = (pdfWidth - imgWidth) / 2;
  const y = (pdfHeight - imgHeight) / 2;

  pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');

  if (mode === 'preview') {
    window.open(pdf.output('bloburl'), '_blank');
    return;
  }

  pdf.save(fileName ?? 'document.pdf');
};

export const previewDocumentPdf = async (options: PdfOptions) => {
  await renderPdf(options, 'preview');
};

export const downloadDocumentPdf = async (options: PdfOptions) => {
  await renderPdf(options, 'download');
};