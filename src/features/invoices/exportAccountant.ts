/**
 * One Excel file per year for the accountant: every issued invoice with its
 * dates, client, amount, status, and the amount in RSD at the NBS middle rate
 * on the issue date.
 */
import { formatDateNumeric } from '../../lib/dates';
import { safeFileName } from '../../lib/files';
import { cachedRate, fetchRatesFor } from '../../lib/nbs';
import { invoiceTotals, type InvoiceStore } from './model';

const STATUS = { draft: 'Nacrt', sent: 'Poslata', paid: 'Plaćena' } as const;

export const accountantRows = (store: InvoiceStore, year: number) =>
  store.invoices
    .filter((invoice) => invoice.status !== 'draft' && invoice.issueDate.startsWith(String(year)))
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((invoice) => {
      const total = invoiceTotals(invoice).total;
      const rate = cachedRate(invoice.currency, invoice.issueDate);
      return {
        number: invoice.number,
        issueDate: invoice.issueDate,
        serviceDate: invoice.serviceDate,
        dueDate: invoice.dueDate,
        client: invoice.client.name,
        clientTaxId: invoice.client.taxId,
        clientCountry: invoice.client.cityCountry,
        currency: invoice.currency,
        total,
        status: STATUS[invoice.status],
        paidAt: invoice.paidAt,
        rate,
        totalRsd: rate === null ? null : Math.round(total * rate * 100) / 100
      };
    });

export const exportForAccountant = async (store: InvoiceStore, year: number) => {
  const issued = store.invoices.filter((invoice) => invoice.status !== 'draft' && invoice.issueDate.startsWith(String(year)));
  await fetchRatesFor(issued.map((invoice) => ({ currency: invoice.currency, date: invoice.issueDate })));
  const rows = accountantRows(store, year);

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Paperwork';
  const sheet = workbook.addWorksheet(`Fakture ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  const FONT = 'Calibri';
  const INK = 'FF0F172A';
  const MUTED = 'FF64748B';
  const LINE = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  type Column = { title: string; key: keyof (typeof rows)[number]; width: number; align?: 'right' | 'center'; format?: string };
  const columns: Column[] = [
    { title: 'Broj', key: 'number', width: 13 },
    { title: 'Datum izdavanja', key: 'issueDate', width: 16, align: 'center' },
    { title: 'Datum prometa', key: 'serviceDate', width: 16, align: 'center' },
    { title: 'Rok plaćanja', key: 'dueDate', width: 15, align: 'center' },
    { title: 'Klijent', key: 'client', width: 30 },
    { title: 'PIB klijenta', key: 'clientTaxId', width: 16 },
    { title: 'Mesto i država', key: 'clientCountry', width: 24 },
    { title: 'Valuta', key: 'currency', width: 9, align: 'center' },
    { title: 'Iznos', key: 'total', width: 15, align: 'right', format: '#,##0.00' },
    { title: 'Kurs NBS', key: 'rate', width: 12, align: 'right', format: '0.0000' },
    { title: 'Iznos u RSD', key: 'totalRsd', width: 17, align: 'right', format: '#,##0.00' },
    { title: 'Status', key: 'status', width: 12, align: 'center' },
    { title: 'Datum plaćanja', key: 'paidAt', width: 16, align: 'center' }
  ];
  sheet.columns = columns.map((column) => ({ width: column.width }));
  const lastColumn = columns.length;
  const dateKeys = new Set(['issueDate', 'serviceDate', 'dueDate', 'paidAt']);

  // Title block
  sheet.mergeCells(1, 1, 1, lastColumn);
  const title = sheet.getCell(1, 1);
  title.value = `Fakture ${year}. — ${store.profile.party.name || ''}`.replace(/ — $/, '');
  title.font = { name: FONT, size: 16, bold: true, color: { argb: INK } };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;
  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = [store.profile.party.taxId && `PIB ${store.profile.party.taxId}`, 'Iznos u RSD: srednji kurs NBS na dan izdavanja fakture'].filter(Boolean).join('  ·  ');
  subtitle.font = { name: FONT, size: 10, color: { argb: MUTED } };
  sheet.getRow(2).height = 18;

  // Table head
  const HEAD = 4;
  const head = sheet.getRow(HEAD);
  columns.forEach((column, index) => {
    const cell = head.getCell(index + 1);
    cell.value = column.title;
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: column.align ?? 'left', indent: column.align === 'center' ? 0 : 1, wrapText: true };
  });
  head.height = 24;

  // Rows
  rows.forEach((row, rowIndex) => {
    const line = sheet.getRow(HEAD + 1 + rowIndex);
    columns.forEach((column, index) => {
      const cell = line.getCell(index + 1);
      const value = row[column.key];
      cell.value = dateKeys.has(column.key) ? (value ? formatDateNumeric(String(value)) : '') : (value ?? '');
      cell.font = { name: FONT, size: 10, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', horizontal: column.align ?? 'left', indent: column.align === 'center' ? 0 : 1 };
      cell.border = { bottom: LINE };
      if (column.format) cell.numFmt = column.format;
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    line.height = 19;
  });

  // Total in RSD (only when every rate is known)
  const totalRow = sheet.getRow(HEAD + 1 + rows.length);
  const complete = rows.every((row) => row.totalRsd !== null);
  const rsdColumn = columns.findIndex((column) => column.key === 'totalRsd') + 1;
  columns.forEach((_column, index) => {
    const cell = totalRow.getCell(index + 1);
    cell.font = { name: FONT, bold: true, size: 11, color: { argb: index + 1 === rsdColumn ? 'FF4338CA' : INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index + 1 === rsdColumn ? 'FFEEF2FF' : 'FFE2E8F0' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF1E293B' } } };
    cell.alignment = { vertical: 'middle', horizontal: index + 1 === rsdColumn ? 'right' : 'left', indent: 1 };
  });
  totalRow.getCell(1).value = `Ukupno ${year}. (${rows.length})`;
  totalRow.getCell(rsdColumn).value = complete ? rows.reduce((sum, row) => sum + (row.totalRsd ?? 0), 0) : '';
  totalRow.getCell(rsdColumn).numFmt = '#,##0.00';
  totalRow.height = 24;

  sheet.views = [{ state: 'frozen', ySplit: HEAD, showGridLines: false }];
  sheet.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(lastColumn).letter}${HEAD + 1 + rows.length}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(`Fakture-${year}-${store.profile.party.name || 'knjigovodja'}`)}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
};
