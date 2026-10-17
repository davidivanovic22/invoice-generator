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

/* Direct download: renders the pages to images and saves a PDF file, with no print dialog in between. */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
/** Render at 2x the CSS size: sharp text in print (about 190 dpi) at a few hundred KB per page. */
const PIXEL_RATIO = 2;

const fontDataCache = new Map<string, Promise<string>>();

const toDataUrl = (url: string) => {
  let cached = fontDataCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font ${url}: ${response.status}`);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      );
    cached.catch(() => fontDataCache.delete(url));
    fontDataCache.set(url, cached);
  }
  return cached;
};

const familyNames = (value: string) => value.split(',').map((name) => name.trim().replace(/^["']|["']$/g, '').toLowerCase());

/** Does a `unicode-range` descriptor cover any of the characters? An empty range covers everything. */
const coversAny = (range: string, codePoints: Set<number>) => {
  if (!range.trim()) return true;
  return range.split(',').some((part) => {
    const match = part.trim().match(/^u\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
    if (!match) return true;
    const start = parseInt(match[1].replace(/\?/g, '0'), 16);
    const end = parseInt(match[2] ?? match[1].replace(/\?/g, 'f'), 16);
    return Array.from(codePoints).some((point) => point >= start && point <= end);
  });
};

const coversWeight = (descriptor: string, weight: number) => {
  const [low, high = low] = descriptor.replace('normal', '400').replace('bold', '700').split(/\s+/).map(Number);
  return Number.isNaN(low) || (weight >= low && weight <= high);
};

/**
 * The @font-face rules the pages actually use, with the font files inlined. The page images are
 * drawn from an isolated SVG, which cannot see the app's fonts, so they have to travel with it.
 * Only the faces in use go along: the app loads dozens of weights and alphabets.
 */
const buildFontCss = async (pages: HTMLElement[]) => {
  const used = new Map<string, Set<string>>();
  const codePoints = new Set<number>();
  for (const page of pages) {
    for (const element of [page, ...Array.from(page.querySelectorAll<HTMLElement>('*'))]) {
      const style = getComputedStyle(element);
      for (const family of familyNames(style.fontFamily)) {
        const faces = used.get(family) ?? new Set<string>();
        faces.add(`${style.fontWeight}|${style.fontStyle}`);
        used.set(family, faces);
      }
    }
    for (const char of Array.from(page.textContent ?? '')) codePoints.add(char.codePointAt(0) ?? 0);
  }

  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // A cross-origin stylesheet: its fonts are not ours to inline.
    }
    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const faces = used.get(familyNames(rule.style.getPropertyValue('font-family'))[0]);
      if (!faces) continue;
      const weight = rule.style.getPropertyValue('font-weight') || '400';
      const italic = (rule.style.getPropertyValue('font-style') || 'normal') !== 'normal';
      const wanted = Array.from(faces).some((face) => {
        const [usedWeight, usedStyle] = face.split('|');
        return coversWeight(weight, Number(usedWeight)) && (usedStyle !== 'normal') === italic;
      });
      if (wanted && coversAny(rule.style.getPropertyValue('unicode-range'), codePoints)) rules.push(rule);
    }
  }

  const css = await Promise.all(
    rules.map(async (rule) => {
      const src = rule.style.getPropertyValue('src');
      const sources = Array.from(src.matchAll(/url\((["']?)([^"')]+)\1\)\s*(format\([^)]*\))?/g));
      const source = sources.find((candidate) => /woff2/.test(candidate[3] ?? candidate[2])) ?? sources[0];
      if (!source) return '';
      try {
        const data = await toDataUrl(new URL(source[2], rule.parentStyleSheet?.href ?? document.baseURI).href);
        return rule.cssText.replace(src, `url(${data}) ${source[3] ?? ''}`);
      } catch {
        return ''; // The page still renders, in a fallback font.
      }
    })
  );
  return css.join('\n');
};

/**
 * Where a tall page may be cut without slicing through a line of text: below table rows,
 * paragraphs, list items and headings. In CSS px from the top of the page.
 */
const breakPoints = (page: HTMLElement) => {
  const box = page.getBoundingClientRect();
  const scale = box.height / page.offsetHeight || 1; // The on-screen preview may be scaled down.
  return Array.from(page.querySelectorAll<HTMLElement>('tr, p, li, h1, h2, h3, h4'))
    .map((element) => (element.getBoundingClientRect().bottom - box.top) / scale)
    .sort((a, b) => a - b);
};

/** Saves every `[data-pdf-page]` inside `root` straight to a PDF file, as one or more A4 sheets each. */
export const downloadPdf = async (root: HTMLElement, fileName: string) => {
  const sources = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (!sources.length) throw new Error('Nothing to export.');
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  // Render copies, off screen and outside the editor, so its hover outlines, scaling and dark
  // theme stay out of the file, the same way the print view leaves them out.
  const stage = document.createElement('div');
  stage.className = 'light-scope';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  const pages = sources.map((source) => stage.appendChild(source.cloneNode(true) as HTMLElement));
  document.body.appendChild(stage);
  try {
    await waitForAssets(document);
    await savePages(pages, fileName, toCanvas, jsPDF);
  } finally {
    stage.remove();
  }
};

const savePages = async (
  pages: HTMLElement[],
  fileName: string,
  toCanvas: typeof import('html-to-image').toCanvas,
  jsPDF: typeof import('jspdf').jsPDF
) => {
  const fontEmbedCSS = await buildFontCss(pages);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  let firstSheet = true;

  for (const page of pages) {
    const width = page.offsetWidth;
    const height = page.offsetHeight;
    const canvas = await toCanvas(page, {
      width,
      height,
      pixelRatio: PIXEL_RATIO,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
      style: { margin: '0', boxShadow: 'none', transform: 'none' }
    });
    const ratio = canvas.width / width;
    const sheetHeight = (width * A4_HEIGHT_MM) / A4_WIDTH_MM;
    const breaks = breakPoints(page);

    // A page taller than A4 continues on the next sheet, cut below the last whole line that fits.
    for (let top = 0; top < height - 2; ) {
      // A couple of px of rounding past A4 is not worth another sheet.
      let bottom = height - top > sheetHeight + 2 ? top + sheetHeight : height;
      if (bottom < height) {
        const cut = breaks.filter((point) => point > top + sheetHeight / 2 && point <= bottom).pop();
        if (cut) bottom = Math.ceil(cut);
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.round((bottom - top) * ratio);
      const context = slice.getContext('2d');
      if (!context) throw new Error('Canvas is not available in this browser.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, Math.round(top * ratio), canvas.width, slice.height, 0, 0, slice.width, slice.height);

      if (!firstSheet) pdf.addPage('a4', 'portrait');
      firstSheet = false;
      pdf.addImage(slice, 'JPEG', 0, 0, A4_WIDTH_MM, ((bottom - top) * A4_WIDTH_MM) / width, undefined, 'FAST');
      top = bottom;
    }
  }

  pdf.setProperties({ title: fileName.replace(/\.pdf$/i, '') });
  pdf.save(/\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`);
};
