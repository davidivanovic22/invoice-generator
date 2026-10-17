import ExcelJS from 'exceljs';
import { reportWorkbook } from './reportFiles';
import { reportFixture as r,reportId as id } from '../../test/accountingReportFixture';
it('exports initial journal totals but excludes them from ledger period totals',async()=>{
 const value={...r,lines:r.lines.map((l,n)=>({...l,opening:n<2})),accounts:r.accounts.map(a=>({...a,openingDebit:a.accountId===id(3)?'14002':'0',openingCredit:a.accountId===id(4)?'14002':'0',openingBalance:a.accountId===id(3)?'14002':'-14002',debit:a.accountId===id(3)?'0':'1000',credit:a.accountId===id(4)?'0':'1000'})),totals:{...r.totals,openingDebit:'14002',openingCredit:'14002',openingBalanceDebit:'14002',openingBalanceCredit:'14002',debit:'1000',credit:'1000'}};
 const journal=new ExcelJS.Workbook();await journal.xlsx.load(await reportWorkbook(value,'journal',id(3)));const js=journal.worksheets[0];expect(js.lastRow!.getCell(15).value).toBe('110.01');
 const ledger=new ExcelJS.Workbook();await ledger.xlsx.load(await reportWorkbook(value,'ledger',id(3)));const ls=ledger.worksheets[0];expect(ls.lastRow!.getCell(15).value).toBe('0.00');expect(ls.lastRow!.getCell(16).value).toBe('10.00');expect(ls.lastRow!.getCell(17).value).toBe('130.02');
});
it.each(['journal','ledger','trial'] as const)('exports %s with snapshot context, text amounts and literal formula-like descriptions',async(kind)=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await reportWorkbook(r,kind,id(3)));
 const sheet=book.worksheets[0];expect(sheet.getCell('B2').value).toBe('Fixture firm');expect(sheet.getCell('C2').value).toBe(id(1));
 const values:unknown[]=[];sheet.eachRow(row=>row.eachCell(cell=>{expect(typeof cell.value).toBe('string');expect(cell.numFmt).toBe('@');values.push(cell.value);}));
 expect(values).toContain(kind==='journal'?'110.01':'130.02');
 if(kind!=='trial'){expect(values).toContain('=SUM(1,2)');expect(values).toContain('=Literal partner');}
});
it('preserves exact decimal text above spreadsheet integer precision',async()=>{
 const n='1999999999999999999999998';const c=(BigInt(n)+BigInt(9001)).toString();
 const value={...r,accounts:r.accounts.map(a=>({...a,openingDebit:a.accountId===id(3)?n:'0',openingCredit:a.accountId===id(4)?n:'0',openingBalance:a.accountId===id(3)?n:'-'+n,closingBalance:a.accountId===id(3)?c:'-'+c})),totals:{...r.totals,openingDebit:n,openingCredit:n,openingBalanceDebit:n,openingBalanceCredit:n,closingBalanceDebit:c,closingBalanceCredit:c}};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await reportWorkbook(value,'trial',id(3)));expect(book.worksheets[0].getCell('D9').value).toBe('19999999999999999999999.98');
});
it('refuses an unverifiable report or a ledger account outside its snapshot',async()=>{
 await expect(reportWorkbook({...r,totals:{...r.totals,debit:'1'}},'trial',id(3))).rejects.toThrow('invalid_report');
 await expect(reportWorkbook(r,'ledger',id(9))).rejects.toThrow('invalid_report_account');
});
