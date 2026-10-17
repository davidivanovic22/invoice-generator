import { bankRowSchema,parseBankRsd,type BankRow } from '../../domain/accounting/bank';
export const bankColumns=['transaction_id','booking_date','value_date','incoming_rsd','outgoing_rsd','counterparty','reference','description'] as const;
export const bankColumnLabels=['ID transakcije','Datum knjiženja','Datum valute','Priliv RSD','Odliv RSD','Partner','Poziv na broj','Opis'];
export const fxBankColumns=['transaction_id','booking_date','value_date','incoming_foreign','outgoing_foreign','counterparty','reference','description'] as const;
export const fxBankColumnLabels=['ID transakcije','Datum knjiženja','Datum valute','Priliv devize','Odliv devize','Partner','Poziv na broj','Opis'];
export class BankFileError extends Error {constructor(public readonly code:'bank_columns'|'bank_row'|'bank_duplicate'|'bank_text_amount'|'bank_file',public readonly row?:number){super(code);}}
type Cell=string|Date|null;
export const parseBankTable=(table:Cell[][],format:'rsd'|'fx'='rsd'):BankRow[]=>{
 if(table.length<2||table.length>2001)throw new BankFileError('bank_file');
 const header=table[0].map(c=>typeof c==='string'?c.trim():'');
 const columns=format==='fx'?fxBankColumns:bankColumns,labels=format==='fx'?fxBankColumnLabels:bankColumnLabels;
 const positions=columns.map((key,index)=>header.findIndex(value=>value===key||value===labels[index]));
 if(header.length!==8||positions.some(p=>p<0)||new Set(positions).size!==8)throw new BankFileError('bank_columns');
 const rows:BankRow[]=[];const ids=new Set<string>();
 const date=(cell:Cell)=>{
  if(cell instanceof Date){if(!Number.isFinite(cell.getTime())||cell.getUTCHours()||cell.getUTCMinutes()||cell.getUTCSeconds()||cell.getUTCMilliseconds())throw new Error();return cell.toISOString().slice(0,10);}
  if(typeof cell!=='string')throw new Error();const text=cell.trim();const local=/^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(text);return local?`${local[3]}-${local[2]}-${local[1]}`:text;
 };
 for(let i=1;i<table.length;i++){
  const row=table[i];if(row.every(c=>c===null||c==='')){if(table.slice(i).every(r=>r.every(c=>c===null||c==='')))break;throw new BankFileError('bank_row',i+1);}
  try{
   if(row.length>8)throw new Error();const text=(column:number)=>{const v=row[positions[column]];if(v===null||v===undefined)return '';if(typeof v!=='string')throw new Error();return v;};
   const item=bankRowSchema.parse({externalId:text(0),bookingDate:date(row[positions[1]]),valueDate:date(row[positions[2]]),incoming:parseBankRsd(text(3)||'0'),outgoing:parseBankRsd(text(4)||'0'),counterparty:text(5),reference:text(6),description:text(7)});
   if(ids.has(item.externalId))throw new BankFileError('bank_duplicate',i+1);ids.add(item.externalId);rows.push(item);
  }catch(e){if(e instanceof BankFileError)throw e;throw new BankFileError('bank_row',i+1);}
 }
 if(!rows.length)throw new BankFileError('bank_file');return rows;
};

export const readBankFile=async(file:File,format:'rsd'|'fx'='rsd'):Promise<BankRow[]>=>{
 if(file.size>5*1024*1024||!file.name.toLowerCase().endsWith('.xlsx'))throw new BankFileError('bank_file');
 try{
  const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
  if(workbook.worksheets.length!==1)throw new BankFileError('bank_file');const sheet=workbook.worksheets[0];if(sheet.state!=='visible'||sheet.rowCount>2001||sheet.columnCount!==8)throw new BankFileError('bank_columns');
  const table:Cell[][]=[];
  for(let index=1;index<=sheet.rowCount;index++){
   const row=sheet.getRow(index);if(row.hidden)throw new BankFileError('bank_row',index);
   table.push(bankColumns.map((_key,column)=>{
    const value=row.getCell(column+1).value;
    if(value===null||typeof value==='string'||value instanceof Date)return value;
    if(column===0||column===3||column===4)throw new BankFileError('bank_text_amount',index);
    throw new BankFileError('bank_row',index);
   }));
  }
  return parseBankTable(table,format);
 }catch(e){if(e instanceof BankFileError)throw e;throw new BankFileError('bank_file');}
};
export const downloadBankTemplate=async(format:'rsd'|'fx'='rsd')=>{
 const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Izvod');
 sheet.addRow(format==='fx'?fxBankColumnLabels:bankColumnLabels);
 sheet.columns.forEach(column=>{column.width=23;column.numFmt='@';});sheet.getRow(1).font={bold:true};
 const bytes=await workbook.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=format==='fx'?'sablon-deviznog-izvoda.xlsx':'sablon-bankarskog-izvoda.xlsx';link.click();URL.revokeObjectURL(url);
};
