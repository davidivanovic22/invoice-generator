/**
 * Exports a year of the KPO book as a styled Excel workbook (same layout as
 * the paper form: header block, title, five columns) or as CSV.
 */
import { safeFileName } from '../../lib/files';
import { bookYear, describeWithDate, entryTotal, yearTotals, type KpoBook } from './model';

const COLORS = {
  ink: 'FF0F172A',
  muted: 'FF64748B',
  line: 'FFE2E8F0',
  head: 'FF1E293B',
  subHead: 'FF334155',
  zebra: 'FFF8FAFC',
  totalFill: 'FFEEF2FF',
  totalInk: 'FF4338CA',
  footer: 'FFE2E8F0'
};

const HEADER_ROWS: [string, keyof KpoBook['header']][] = [
  ['PIB:', 'pib'],
  ['Obveznik:', 'taxpayer'],
  ['Firma-radnje:', 'business'],
  ['Sedište:', 'seat'],
  ['Šifra poreskog obveznika:', 'taxpayerCode'],
  ['Šifra delatnosti:', 'activity']
];

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const kpoFileName = (book: KpoBook, year: number, extension: string) =>
  `${safeFileName(`KPO-${year}-${book.header.taxpayer || book.header.business || 'knjiga'}`)}.${extension}`;

export const exportKpoXlsx = async (book: KpoBook, year: number, includePlanned: boolean) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Paperwork';
  const sheet = workbook.addWorksheet(`KPO ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }]
  });
  sheet.columns = [{ width: 11 }, { width: 68 }, { width: 20 }, { width: 20 }, { width: 24 }];
  const money = `#,##0.00 "${book.currency === 'EUR' ? '€' : 'RSD'}"`;
  const thin = { style: 'thin' as const, color: { argb: COLORS.line } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  // Title
  sheet.mergeCells('A1:E1');
  const title = sheet.getCell('A1');
  title.value = 'KPO';
  title.font = { name: 'Calibri', size: 20, bold: true, color: { argb: COLORS.ink } };
  title.alignment = { horizontal: 'right' };
  sheet.getRow(1).height = 30;

  // Header block
  HEADER_ROWS.forEach(([label, field], index) => {
    const row = sheet.getRow(index + 2);
    sheet.mergeCells(`B${index + 2}:C${index + 2}`);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.muted } };
    row.getCell(2).value = book.header[field] || '';
    row.getCell(2).font = { size: 11, color: { argb: COLORS.ink } };
    row.getCell(1).border = { bottom: thin };
    row.getCell(2).border = { bottom: thin };
    row.height = 20;
  });

  // Form title
  const formRow = HEADER_ROWS.length + 3;
  sheet.mergeCells(`A${formRow}:E${formRow}`);
  const form = sheet.getCell(`A${formRow}`);
  form.value = 'KNJIGA O OSTVARENOM PROMETU PAUŠALNO OPOREZOVANIH OBVEZNIKA';
  form.font = { size: 14, bold: true, color: { argb: COLORS.ink } };
  form.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(formRow).height = 34;

  // Table head (two rows, like the official form)
  const head = formRow + 1;
  sheet.mergeCells(`A${head}:A${head + 1}`);
  sheet.mergeCells(`B${head}:B${head + 1}`);
  sheet.mergeCells(`C${head}:D${head}`);
  sheet.mergeCells(`E${head}:E${head + 1}`);
  const headCells: [string, string][] = [
    [`A${head}`, 'Redni broj'],
    [`B${head}`, 'Datum i opis knjiženja'],
    [`C${head}`, 'PRIHOD OD DELATNOSTI'],
    [`C${head + 1}`, 'od prodaje proizvoda'],
    [`D${head + 1}`, 'od izvršenih usluga'],
    [`E${head}`, 'SVEGA PRIHODI OD DELATNOSTI (3+4)']
  ];
  for (const [address, value] of headCells) {
    const cell = sheet.getCell(address);
    cell.value = value;
  }
  for (const rowNumber of [head, head + 1]) {
    for (let column = 1; column <= 5; column += 1) {
      const cell = sheet.getRow(rowNumber).getCell(column);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === head ? COLORS.head : COLORS.subHead } };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: COLORS.head } }, bottom: { style: 'thin', color: { argb: COLORS.head } } };
    }
  }
  sheet.getRow(head).height = 22;
  sheet.getRow(head + 1).height = 20;
  // Column numbers 1–5 under the head, as on the form.
  const numbering = sheet.getRow(head + 2);
  [1, 2, 3, 4, 5].forEach((number) => {
    const cell = numbering.getCell(number);
    cell.value = number;
    cell.font = { size: 8, color: { argb: COLORS.muted } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: thin };
  });

  // Entries
  const rows = bookYear(book, year).filter((row) => includePlanned || !row.planned);
  let rowNumber = head + 3;
  rows.forEach(({ entry, number, planned }, index) => {
    const row = sheet.getRow(rowNumber);
    row.values = [number ?? '', describeWithDate(entry), entry.products, entry.services, entryTotal(entry)];
    for (let column = 1; column <= 5; column += 1) {
      const cell = row.getCell(column);
      cell.border = box;
      cell.font = { size: 10, italic: planned, color: { argb: planned ? COLORS.muted : COLORS.ink } };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
      if (column >= 3) cell.numFmt = money;
    }
    row.getCell(1).alignment = { horizontal: 'center' };
    const total = row.getCell(5);
    total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalFill } };
    total.font = { size: 10, bold: true, italic: planned, color: { argb: planned ? COLORS.muted : COLORS.totalInk } };
    row.height = 18;
    rowNumber += 1;
  });

  // Totals
  const totals = yearTotals(rows, includePlanned);
  const footer = sheet.getRow(rowNumber);
  footer.values = ['', `Ukupno ${year}.`, totals.products, totals.services, totals.total];
  for (let column = 1; column <= 5; column += 1) {
    const cell = footer.getCell(column);
    cell.font = { bold: true, size: 11, color: { argb: column === 5 ? COLORS.totalInk : COLORS.ink } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column === 5 ? COLORS.totalFill : COLORS.footer } };
    cell.border = { top: { style: 'medium', color: { argb: COLORS.head } }, bottom: thin };
    if (column >= 3) cell.numFmt = money;
  }
  footer.height = 22;
  sheet.views = [{ showGridLines: false, state: 'frozen', ySplit: head + 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), kpoFileName(book, year, 'xlsx'));
};

const csvCell = (value: string | number) => {
  const text = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : value;
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportKpoCsv = (book: KpoBook, year: number, includePlanned: boolean) => {
  const rows = bookYear(book, year).filter((row) => includePlanned || !row.planned);
  const lines = [
    ['Redni broj', 'Datum i opis knjiženja', 'Od prodaje proizvoda', 'Od izvršenih usluga', 'Svega prihodi od delatnosti (3+4)'],
    ...rows.map(({ entry, number }) => [number ?? '', describeWithDate(entry), entry.products, entry.services, entryTotal(entry)])
  ];
  const totals = yearTotals(rows, includePlanned);
  lines.push(['', `Ukupno ${year}.`, totals.products, totals.services, totals.total]);
  // BOM + semicolons so Excel in Serbian locale opens it correctly.
  const csv = '﻿' + lines.map((line) => line.map(csvCell).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), kpoFileName(book, year, 'csv'));
};
