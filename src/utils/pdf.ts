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
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
      });
    })
  );

  if ('fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    } catch {}
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const getRenderablePages = (element: HTMLElement) => {
  const explicitPages = Array.from(
    element.querySelectorAll<HTMLElement>('[data-pdf-page="true"]')
  );

  if (explicitPages.length > 0) {
    return explicitPages;
  }

  return [element];
};

const renderPageToCanvas = async (page: HTMLElement) => {
  await waitForAssets(page);

  const rect = page.getBoundingClientRect();
  const width = Math.max(
    Math.ceil(rect.width),
    page.scrollWidth,
    page.offsetWidth,
    page.clientWidth
  );
  const height = Math.max(
    Math.ceil(rect.height),
    page.scrollHeight,
    page.offsetHeight,
    page.clientHeight
  );

  return html2canvas(page, {
    scale: Math.max(2, Math.min(window.devicePixelRatio || 1, 3)),
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: width,
    windowHeight: height,
    width,
    height
  });
};

const renderPdf = async (
  { element, fileName }: PdfOptions,
  mode: 'preview' | 'download'
) => {
  await waitForAssets(element);

  const pages = getRenderablePages(element);

  if (pages.length === 0) {
    throw new Error('No renderable pages found for PDF export.');
  }

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const canvas = await renderPageToCanvas(page);
    const imgData = canvas.toDataURL('image/png', 1.0);

    if (i > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      pdfWidth,
      pdfHeight,
      undefined,
      'FAST'
    );
  }

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