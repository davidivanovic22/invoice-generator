import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type PdfOptions = {
  element: HTMLElement;
  fileName?: string;
};

const renderPdf = async ({ element, fileName }: PdfOptions, mode: 'preview' | 'download') => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'pt', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
  const imgWidth = canvas.width * ratio;
  const imgHeight = canvas.height * ratio;

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

  if (mode === 'preview') {
    window.open(pdf.output('bloburl'), '_blank');
    return;
  }

  pdf.save(fileName ?? 'invoice.pdf');
};

export const previewInvoicePdf = async (options: PdfOptions) => {
  await renderPdf(options, 'preview');
};

export const downloadInvoicePdf = async (options: PdfOptions) => {
  await renderPdf(options, 'download');
};