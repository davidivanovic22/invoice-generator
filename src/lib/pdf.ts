/**
 * PDF export through the browser's own print engine.
 *
 * Unlike canvas screenshots, this produces real, selectable text (which ATS
 * resume parsers and accounting tools need), exact fonts and tiny files.
 * Every `[data-pdf-page]` inside `root` becomes one A4 page. The document
 * title becomes the suggested file name in the save dialog.
 */

const PAGE_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-pdf-page] { break-after: page; page-break-after: always; box-shadow: none !important; margin: 0 !important; }
  [data-pdf-page]:last-child { break-after: auto; page-break-after: auto; }
`;

const waitForAssets = async (doc: Document) => {
  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );
  try {
    await doc.fonts.ready;
  } catch {
    // Fonts are almost certainly loaded already.
  }
};

/** A standalone HTML document with the app's styles and the given pages. */
export const buildPrintHtml = (root: HTMLElement, title: string) => {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => (node instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${node.href}">` : node.outerHTML))
    .join('\n');
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'))
    .map((page) => page.outerHTML)
    .join('\n');
  const safeTitle = title.replace(/[<&>]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><base href="${document.baseURI}">${styles}<style>${PAGE_CSS}</style></head><body>${pages}</body></html>`;
};

export const printToPdf = async (root: HTMLElement, fileName: string) => {
  if (!root.querySelector('[data-pdf-page]')) throw new Error('Nothing to export.');
  const title = fileName.replace(/\.pdf$/i, '');
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Printing is not available in this browser.');
  }
  doc.open();
  doc.write(buildPrintHtml(root, title));
  doc.close();
  await waitForAssets(doc);

  // Chrome suggests the top-level document title as the PDF file name.
  const previousTitle = document.title;
  document.title = title;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = previousTitle;
    iframe.remove();
  };
  win.addEventListener('afterprint', () => setTimeout(cleanup, 100), { once: true });
  win.focus();
  win.print();
  setTimeout(cleanup, 120_000);
};
