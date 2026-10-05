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
  const sheet = workbook.addWorksheet(`Fakture ${year}`, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  sheet.columns = [
    { header: 'Broj', key: 'number', width: 14 },
    { header: 'Datum izdavanja', key: 'issueDate', width: 16 },
    { header: 'Datum prometa', key: 'serviceDate', width: 16 },
    { header: 'Rok plaćanja', key: 'dueDate', width: 14 },
    { header: 'Klijent', key: 'client', width: 32 },
    { header: 'PIB klijenta', key: 'clientTaxId', width: 18 },
    { header: 'Mesto i država', key: 'clientCountry', width: 24 },
    { header: 'Valuta', key: 'currency', width: 9 },
    { header: 'Iznos', key: 'total', width: 14 },
    { header: 'Kurs NBS', key: 'rate', width: 11 },
    { header: 'Iznos u RSD', key: 'totalRsd', width: 16 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Datum plaćanja', key: 'paidAt', width: 15 }
  ];
  for (const row of rows) {
    sheet.addRow({
      ...row,
      issueDate: formatDateNumeric(row.issueDate),
      serviceDate: formatDateNumeric(row.serviceDate),
      dueDate: formatDateNumeric(row.dueDate),
      paidAt: row.paidAt ? formatDateNumeric(row.paidAt) : ''
    });
  }
  const totalRow = sheet.addRow({
    number: 'Ukupno',
    totalRsd: rows.every((row) => row.totalRsd !== null) ? rows.reduce((sum, row) => sum + (row.totalRsd ?? 0), 0) : null
  });

  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle' };
  });
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    row.getCell('total').numFmt = '#,##0.00';
    row.getCell('rate').numFmt = '0.0000';
    row.getCell('totalRsd').numFmt = '#,##0.00';
    if (number % 2 === 1 && row !== totalRow) row.eachCell({ includeEmpty: true }, (cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }));
  });
  totalRow.font = { bold: true };
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { top: { style: 'medium', color: { argb: 'FF1E293B' } } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(`Fakture-${year}-${store.profile.party.name || 'knjigovodja'}`)}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
};
