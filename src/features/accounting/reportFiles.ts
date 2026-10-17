import { accountingReportSchema,verifyReport,ledgerRows,type AccountingReport } from '../../domain/accounting/reports';
import { formatRsd } from './money';
export type ReportKind='journal'|'ledger'|'trial';
/** Every cell is explicit text: no spreadsheet formulas or numeric rounding. */
export const reportWorkbook=async(value:AccountingReport,kind:ReportKind,accountId:string)=>{
 const r=accountingReportSchema.parse(value);
 if(!verifyReport(r,{firmId:r.firmId,yearId:r.yearId,from:r.from,to:r.to})||!['journal','ledger','trial'].includes(kind))throw new Error('invalid_report');
 const account=r.accounts.find(a=>a.accountId===accountId);if(kind==='ledger'&&!account)throw new Error('invalid_report_account');
 const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();const sheet=book.addWorksheet(kind);
 sheet.addRow(['Internal RSD accounting report',kind]);sheet.addRow(['Firm',r.firmName,r.firmId]);sheet.addRow(['Fiscal year',String(r.yearLabel),r.yearId]);
 sheet.addRow(['From / to',r.from,r.to]);sheet.addRow(['Snapshot',r.generatedAt]);sheet.addRow(['Scope','Posted journals; opening includes explicit opening migration and earlier entries in this fiscal year. Opening journals remain in the journal export, excluded from period turnover. No automatic prior-year carryforward.']);
 sheet.addRow([]);
 if(kind==='trial'){
  sheet.addRow(['Account ID','Code','Name','Opening debit RSD','Opening credit RSD','Period debit RSD','Period credit RSD','Closing debit RSD','Closing credit RSD']);
  r.accounts.forEach(a=>sheet.addRow([a.accountId,a.code,a.name,formatRsd(BigInt(a.openingBalance)>BigInt(0)?a.openingBalance:'0'),formatRsd(BigInt(a.openingBalance)<BigInt(0)?(-BigInt(a.openingBalance)).toString():'0'),formatRsd(a.debit),formatRsd(a.credit),formatRsd(BigInt(a.closingBalance)>BigInt(0)?a.closingBalance:'0'),formatRsd(BigInt(a.closingBalance)<BigInt(0)?(-BigInt(a.closingBalance)).toString():'0')]));
  sheet.addRow(['','TOTAL','',...['openingBalanceDebit','openingBalanceCredit','debit','credit','closingBalanceDebit','closingBalanceCredit'].map(k=>formatRsd(r.totals[k as keyof typeof r.totals]))]);
 }else{
  if(kind==='ledger')sheet.addRow(['Account',account!.code,account!.name,'Opening RSD',formatRsd(account!.openingBalance)]);
  sheet.addRow(['Journal ID','Number','Posting date','Posted at','Journal description','Reversal of','Reason','Line ID','Account ID','Account code snapshot','Account name snapshot','Partner ID','Partner name','Line description','Debit RSD','Credit RSD',...(kind==='ledger'?['Running balance RSD']:[])]);
  (kind==='ledger'?ledgerRows(r,accountId):r.lines).forEach(l=>sheet.addRow([l.journalId,l.number,l.postingDate,l.postedAt,l.journalDescription,l.reversalOf||'',l.reason||'',l.lineId,l.accountId,l.accountCode,l.accountName,l.partnerId||'',l.partnerName||'',l.description,formatRsd(l.debit),formatRsd(l.credit),...('balance' in l?[formatRsd(String(l.balance))]:[])]));
  sheet.addRow(['TOTAL',...Array(13).fill(''),formatRsd(kind==='ledger'?account!.debit:r.lines.reduce((s,l)=>s+BigInt(l.debit),BigInt(0)).toString()),formatRsd(kind==='ledger'?account!.credit:r.lines.reduce((s,l)=>s+BigInt(l.credit),BigInt(0)).toString()),...(kind==='ledger'?[formatRsd(account!.closingBalance)]:[])]);
 }
 sheet.eachRow(row=>row.eachCell(cell=>{if(typeof cell.value!=='string')throw new Error('non_text_export');cell.numFmt='@';}));
 sheet.columns.forEach(column=>{column.width=24;});return book.xlsx.writeBuffer();
};
export const downloadReport=async(r:AccountingReport,kind:ReportKind,accountId:string)=>{
 const bytes=await reportWorkbook(r,kind,accountId);const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 try{const link=document.createElement('a');link.href=url;link.download=`${kind}-${r.firmId}-${r.yearLabel}-${r.from}-${r.to}.xlsx`;link.click();}finally{URL.revokeObjectURL(url);}
};
