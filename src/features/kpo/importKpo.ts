/**
 * Reads an existing KPO book from Excel (.xlsx) or CSV. The layout is found
 * from the labels, so it works with the official form and home-made copies:
 * a header block (PIB, Obveznik, Firma-radnje, Sedište, Šifra …) followed by
 * the table "Redni broj | Datum i opis knjiženja | proizvoda | usluga | Svega".
 */
import { parseAmount, parseDate, round2, splitDescriptionDate, type KpoHeader } from './model';

export type Cell = string | number | Date | null;

export type ParsedRow = {
  date: string | null;
  description: string;
  products: number;
  services: number;
  number: number | null;
};

export type ParsedBook = { header: Partial<KpoHeader>; rows: ParsedRow[] };

const text = (cell: Cell | undefined) => (cell instanceof Date ? '' : cell === null || cell === undefined ? '' : String(cell).trim());

const HEADER_LABELS: [keyof KpoHeader, RegExp][] = [
  ['pib', /^pib\b/i],
  ['taxpayer', /^obveznik/i],
  ['business', /^firma|^naziv radnje|^radnja/i],
  ['seat', /^sedi[sš]te|^adresa/i],
  ['taxpayerCode', /^[sš]ifra poreskog/i],
  ['activity', /^[sš]ifra delatnosti|^delatnost/i]
];

const isLabel = (value: string) => HEADER_LABELS.some(([, pattern]) => pattern.test(value));

const readHeaderBlock = (rows: Cell[][], end: number): Partial<KpoHeader> => {
  const header: Partial<KpoHeader> = {};
  for (let index = 0; index < end; index += 1) {
    const cells = rows[index].map(text);
    const labelAt = cells.findIndex(isLabel);
    if (labelAt < 0) continue;
    const [field] = HEADER_LABELS.find(([, pattern]) => pattern.test(cells[labelAt]))!;
    const inline = cells[labelAt].split(':').slice(1).join(':').trim();
    let value = inline || cells.slice(labelAt + 1).find(Boolean) || '';
    // Some forms put the value on the next row, under the label (e.g. Sedište).
    if (!value && index + 1 < end) {
      const next = rows[index + 1].map(text);
      if (!next.some(isLabel)) value = next.find((cell) => cell && !/^\(.*\)$/.test(cell)) ?? '';
    }
    if (value && !/^\(.*\)$/.test(value)) header[field] = value;
  }
  return header;
};

type Columns = { number: number; description: number; date: number; products: number; services: number; total: number };

const findTable = (rows: Cell[][]): { columns: Columns; firstDataRow: number } | null => {
  for (let index = 0; index < rows.length; index += 1) {
    const cells = rows[index].map((cell) => text(cell).toLowerCase());
    const description = cells.findIndex((cell) => /opis|datum/.test(cell));
    if (description < 0 || !cells.some((cell) => /redni|r\.\s*br|^rb$|svega|ukupno|uslug|prihod/.test(cell))) continue;

    const columns: Columns = { number: -1, description, date: -1, products: -1, services: -1, total: -1 };
    let last = index;
    // The amount headers are often on the next row, under a merged "PRIHOD OD DELATNOSTI".
    for (let look = index; look < Math.min(rows.length, index + 3); look += 1) {
      // Stop at the first row with data (numbers or dates).
      if (look > index && rows[look].some((cell) => typeof cell === 'number' || cell instanceof Date || /\d{1,2}\.\d{1,2}\.\d{4}|^\s*-?[\d.,]+\s*$/.test(text(cell)))) break;
      for (let column = 0; column < rows[look].length; column += 1) {
        const cell = text(rows[look][column]).toLowerCase();
        if (!cell) continue;
        let matched = true;
        if (/redni|r\.\s*br|^rb$/.test(cell)) columns.number = column;
        else if (/proizvod/.test(cell)) columns.products = column;
        else if (/uslug/.test(cell)) columns.services = column;
        else if (/svega|ukupno/.test(cell)) columns.total = column;
        else if (/^datum$/.test(cell) && column !== description) columns.date = column;
        else matched = /opis|datum|prihod/.test(cell);
        if (matched) last = Math.max(last, look);
      }
    }
    if (columns.products < 0 && columns.services < 0 && columns.total < 0) continue;
    return { columns, firstDataRow: last + 1 };
  }
  return null;
};

/** Turns the cells of a sheet into header details and bookings. */
export const parseKpoRows = (rows: Cell[][]): ParsedBook | null => {
  const table = findTable(rows);
  if (!table) return null;
  const { columns, firstDataRow } = table;
  const result: ParsedRow[] = [];
  for (const row of rows.slice(firstDataRow)) {
    const raw = text(row[columns.description]);
    const amount = (column: number) => (column >= 0 ? parseAmount(row[column] ?? null) : null);
    const products = amount(columns.products);
    const services = amount(columns.services);
    const total = amount(columns.total);
    if (!raw && products === null && services === null && total === null) continue;

    const split = splitDescriptionDate(raw);
    const date = (columns.date >= 0 ? parseDate(row[columns.date]) : null) ?? split.date ?? (row[columns.description] instanceof Date ? parseDate(row[columns.description]) : null);
    // Totals and carry-over lines are not bookings.
    if (!date && /ukupno|svega|prenos|zbir/i.test(raw)) continue;
    if (!date && !raw) continue;
    // The 1–5 column-number row under the head of the official form.
    if (!date && /^\d$/.test(raw)) continue;

    let productValue = products ?? 0;
    let serviceValue = services ?? 0;
    if (products === null && services === null && total !== null) serviceValue = total;
    if (productValue === 0 && serviceValue === 0 && total) serviceValue = total;
    const numberCell = columns.number >= 0 ? parseAmount(row[columns.number] ?? null) : null;

    result.push({
      date,
      description: split.description,
      products: round2(productValue),
      services: round2(serviceValue),
      number: numberCell !== null && Number.isInteger(numberCell) ? numberCell : null
    });
  }
  return { header: readHeaderBlock(rows, firstDataRow), rows: result };
};

/* ---------- Files ---------- */

const parseCsv = (source: string): Cell[][] => {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

type ExcelValue = unknown;

/** Flattens ExcelJS cell values (rich text, formulas, hyperlinks) to plain values. */
const plain = (value: ExcelValue): Cell => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  const object = value as { result?: ExcelValue; richText?: { text: string }[]; text?: string; error?: string };
  if (object.richText) return object.richText.map((part) => part.text).join('');
  if ('result' in object) return plain(object.result);
  if (object.text !== undefined) return object.text;
  return null;
};

export const readSpreadsheet = async (file: File): Promise<Cell[][][]> => {
  if (/\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv') return [parseCsv(await file.text())];
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook.worksheets.map((sheet) => {
    const rows: Cell[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cells[column - 1] = plain(cell.value);
      });
      rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? null);
    });
    return Array.from(rows, (row) => row ?? []);
  });
};

/** Reads the first sheet that looks like a KPO book. */
export const importKpoFile = async (file: File): Promise<ParsedBook | null> => {
  for (const sheet of await readSpreadsheet(file)) {
    const parsed = parseKpoRows(sheet);
    if (parsed && parsed.rows.length) return parsed;
  }
  return null;
};
