import ExcelJS from 'exceljs';
import { partnerReportWorkbook } from './partnerReportFiles';
import { partnerReportFixture as r } from '../../test/partnerReportFixture';
import { openingPartnerReport } from '../../test/openingFixture';
it('exports initial items separately and includes their remainder once in the aging total',async()=>{
 const b=new ExcelJS.Workbook();await b.xlsx.load(await partnerReportWorkbook(openingPartnerReport));expect(b.worksheets).toHaveLength(4);const source=b.getWorksheet('Početna')!;expect(source.getCell('D7').value).toBe('=Literal invoice');expect(source.getCell('K7').value).toBe('100.00');expect(JSON.stringify(b.getWorksheet('Dospeće')!.getSheetValues())).toContain('182.00');
});
it('exports all three views of one snapshot as literal text with separate aging/control totals',async()=>{
 const bytes=await partnerReportWorkbook(r),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);expect(book.worksheets.map(s=>s.name)).toEqual(['Kartice','Dospeće','Kontrola']);
 book.eachSheet(s=>{const values:string[]=[];s.eachRow(row=>row.eachCell(c=>{expect(c.type).toBe(ExcelJS.ValueType.String);expect(c.numFmt).toBe('@');values.push(String(c.value));}));expect(values).toContain(r.firmId);expect(values).toContain(r.generatedAt);expect(values).toContain(r.businessDate);});
 const cards=JSON.stringify(book.worksheets[0].getSheetValues()),aging=JSON.stringify(book.worksheets[1].getSheetValues()),controls=JSON.stringify(book.worksheets[2].getSheetValues());expect(cards).toContain('=SUM(A1:A9)');expect(cards).toContain('81.00');expect(aging).toContain('82.00');expect(aging).toContain('Avans - izuzet iz starosti računa');expect(controls).toContain('-2.00');
});
it('refuses an inconsistent snapshot before producing a file',async()=>{await expect(partnerReportWorkbook({...r,lines:[]})).rejects.toThrow('invalid_partner_report');});
