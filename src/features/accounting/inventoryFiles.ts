import ExcelJS from 'exceljs';
import type { StockWorkspace } from '../../domain/accounting/inventory';
import { verifyStockWorkspace,formatQuantity } from '../../domain/accounting/inventory';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { formatRsd } from './money';
export const stockWorkbook=(data:StockWorkspace,w:AccountingWorkspace)=>{
 if(!verifyStockWorkspace(data,w.firmId)||data.items.some(i=>i.externalMovements))throw new Error('stock_snapshot');
 const book=new ExcelJS.Workbook();
 const sheet=(name:string,header:string[])=>{const s=book.addWorksheet(name);s.addRow(['Firma ID',w.firmId,'Godina pregleda ID',w.yearId||'','Obuhvat','Trenutno stanje svih godina; RSD; količina /1000']);s.addRow(header);return s;};
 const items=sheet('Stanje',['Artikal ID','Skladište','Šifra','Naziv','JM','Konto ID','Količina','RSD vrednost','Revizija']);data.items.forEach(i=>items.addRow([i.id,i.warehouse,i.sku,i.name,i.unit,i.accountId,formatQuantity(i.quantity),formatRsd(i.value),i.revision]));
 const history=sheet('Kartice',['Artikal ID','Nalog ID','Datum','Vrsta','Izvor','Količina','RSD','Prethodna količina','Prethodni RSD','Protivkonto ID','Partner ID','Revizija']);data.movements.forEach(m=>history.addRow([m.itemId,m.id,m.postingDate,m.kind,m.externalId,formatQuantity(m.quantity),formatRsd(m.value),formatQuantity(m.previousQuantity),formatRsd(m.previousValue),m.counterAccountId,m.partnerId||'',m.sequence]));
 const reverse=sheet('Storna',['Artikal ID','Originalni nalog ID','Storno nalog ID','Datum','Razlog','Revizija']);data.cancellations.forEach(c=>reverse.addRow([c.itemId,c.movementId,c.journalId,c.postingDate,c.reason,c.sequence]));
 const control=sheet('Kontrola',['Konto ID','Saldo knjige RSD']);data.accounts.forEach(a=>control.addRow([a.id,formatRsd(a.balance)]));
 book.worksheets.forEach(s=>{s.columns.forEach(c=>{c.numFmt='@';c.width=28;});s.eachRow(r=>r.eachCell(c=>{c.numFmt='@';}));});return book;
};
export const downloadStock=async(data:StockWorkspace,w:AccountingWorkspace)=>{
 const buffer=await stockWorkbook(data,w).xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buffer as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=`zalihe-${w.firmId}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
