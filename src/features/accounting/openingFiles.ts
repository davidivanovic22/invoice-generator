import ExcelJS from 'exceljs';
import { openingSourceSchema,verifyOpeningWorkspace,openingControls,type OpeningSource,type OpeningWorkspace } from '../../domain/accounting/opening';
import { parseRsd,formatRsd } from './money';
export const openingBalanceColumns=['source_account','source_partner','debit_rsd','credit_rsd'];
export const openingItemColumns=['source_account','source_partner','external_id','number','document_date','due_date','direction','remaining_rsd'];
const metadata=['version','currency','source_tax_id','as_of','source_reference'];
export const openingTemplate=()=>{const w=new ExcelJS.Workbook();const m=w.addWorksheet('Meta');m.addRow(['key','value']);metadata.forEach(key=>m.addRow([key,key==='version'?'1':key==='currency'?'RSD':'']));w.addWorksheet('Stanja').addRow(openingBalanceColumns);w.addWorksheet('Otvorene').addRow(openingItemColumns);w.eachSheet(s=>{s.columns.forEach(c=>{c.numFmt='@';c.width=26;});});return w;};
export const readOpeningWorkbook=(w:ExcelJS.Workbook):OpeningSource=>{
 if(w.worksheets.length!==3||w.worksheets.some(s=>s.state!=='visible'))throw new Error('opening_sheets');
 const text=(s:ExcelJS.Worksheet,row:number,count:number)=>{const r=s.getRow(row);if(r.hidden||r.cellCount>count)throw new Error('opening_row');return Array.from({length:count},(_,n)=>{const v=r.getCell(n+1).value;if(v===null)return '';if(typeof v!=='string')throw new Error('opening_text');return v.trim();});};
 const sheet=(name:string,columns:string[])=>{const s=w.getWorksheet(name);if(!s||s.rowCount>501||s.columnCount>columns.length||s.columns.some(c=>c.hidden)||text(s,1,columns.length).join('|')!==columns.join('|'))throw new Error('opening_columns');return s;};
 const meta=sheet('Meta',['key','value']);if(meta.rowCount!==6)throw new Error('opening_meta');const m:Record<string,string>={};for(let n=2;n<=6;n++){const [k,v]=text(meta,n,2);if(!metadata.includes(k)||k in m)throw new Error('opening_meta');m[k]=v;}
 const rows=(name:string,columns:string[])=>{const s=sheet(name,columns),r:string[][]=[];for(let n=2;n<=s.rowCount;n++){const v=text(s,n,columns.length);if(v.every(v=>!v))throw new Error('opening_blank_row');r.push(v);}return r;};
 return openingSourceSchema.parse({version:m.version,currency:m.currency,sourceTaxId:m.source_tax_id,asOf:m.as_of,sourceReference:m.source_reference,
 balances:rows('Stanja',openingBalanceColumns).map(([sourceAccount,sourcePartner,debit,credit])=>({sourceAccount,sourcePartner,debit:parseRsd(debit||'0'),credit:parseRsd(credit||'0')})),
 items:rows('Otvorene',openingItemColumns).map(([sourceAccount,sourcePartner,externalId,number,documentDate,dueDate,direction,amount])=>({sourceAccount,sourcePartner,externalId,number,documentDate,dueDate,direction,amount:parseRsd(amount)}))});
};
export const readOpeningFile=async(file:File)=>{if(file.size>5*1024*1024||!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('opening_file');const bytes=await file.arrayBuffer(),w=new ExcelJS.Workbook();await w.xlsx.load(bytes);const sha=await crypto.subtle.digest('SHA-256',bytes);return {source:readOpeningWorkbook(w),fileName:file.name,fileSha256:Array.from(new Uint8Array(sha)).map(v=>v.toString(16).padStart(2,'0')).join('')};};
export const saveOpeningWorkbook=async(w:ExcelJS.Workbook,name:string)=>{const bytes=await w.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes as BlobPart]));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export const openingControlWorkbook=(w:OpeningWorkspace)=>{
 if(!verifyOpeningWorkspace(w,w.firmId))throw new Error('opening_snapshot');const book=new ExcelJS.Workbook();
 const sheet=(name:string,header:string[])=>{const s=book.addWorksheet(name);s.addRow(['Firma',w.firmId,'RSD; trenutno stanje svih godina']);s.addRow(header);return s;};
 const batches=sheet('Izvori',['Batch ID','Izvor','PIB','Fajl','SHA256','Datum','Nalog','Storno','Razlog']);w.batches.forEach(b=>batches.addRow([b.id,b.sourceReference,b.sourceTaxId,b.fileName,b.fileSha256,b.postingDate,b.journalId,b.reversalId||'',b.reason||'']));
 const balances=sheet('Stanja',['Batch ID','Red','Izvorno konto','Izvorni partner','Konto ID','Partner ID','Duguje','Potražuje']);w.balances.forEach(r=>balances.addRow([r.batchId,String(r.row),r.sourceAccount,r.sourcePartner,r.accountId,r.partnerId||'',formatRsd(r.debit),formatRsd(r.credit)]));
 balances.addRow(['Kontrola trenutnog salda']);balances.addRow(['Konto ID','Partner ID','Preostale početne RSD','Knjiga RSD','Razlika RSD']);openingControls(w).forEach(c=>balances.addRow([c.accountId,c.partnerId,formatRsd(c.expected),formatRsd(c.balance),formatRsd(c.difference)]));
 const items=sheet('Otvorene',['ID','Batch','Izvor ID','Broj','Datum izvora','Dospeće','Smer','Početno RSD','Preostalo RSD','Revizija']);w.items.forEach(i=>items.addRow([i.id,i.batchId,i.externalId,i.number,i.documentDate,i.dueDate,i.direction,formatRsd(i.amount),formatRsd(i.remaining),i.revision]));
 const applied=sheet('Povezivanja',['ID','Stavka','Nalog','Red naloga','Iznos','Storno nalog']);w.applications.forEach(a=>applied.addRow([a.id,a.itemId,a.journalId,a.lineId,formatRsd(a.amount),a.reversalId||'']));
 book.eachSheet(s=>{s.eachRow(r=>r.eachCell(c=>{c.numFmt='@';}));s.columns.forEach(c=>{c.numFmt='@';c.width=28;});});return book;
};
