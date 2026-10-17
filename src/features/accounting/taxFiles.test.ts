import ExcelJS from 'exceljs';
import {taxWorkbook} from './taxFiles';
import {taxFixture} from '../../test/taxEvidenceFixture';
it('exports a complete internal snapshot as four textual sheets with source/history proof',async()=>{
 const w=taxFixture(),book=new ExcelJS.Workbook();await book.xlsx.load(await taxWorkbook(w,'2026-01-01','2026-01-31'));
 expect(book.worksheets.map(s=>s.name)).toEqual(['Kontrola','Dogadjaji','Istorija','Rezimi']);
 expect(book.getWorksheet('Kontrola')!.getCell('A1').value).toContain('NIJE PORESKA PRIJAVA');
 expect(book.getWorksheet('Dogadjaji')!.getCell('C2').value).toBe('=TAX-1');
 expect(book.getWorksheet('Dogadjaji')!.getCell('I2').value).toBe('200.00');
 book.eachSheet(s=>s.eachRow(row=>row.eachCell(cell=>{expect(typeof cell.value).toBe('string');expect(cell.numFmt).toBe('@');})));
});
it('blocks exports if an issued document has no confirmed tax evidence',async()=>{
 const w=taxFixture();w.events=[];await expect(taxWorkbook(w,'2026-01-01','2026-01-31')).rejects.toThrow('incomplete_tax_evidence');
});
it('exports the effective end together with original interval and author/reason proof',async()=>{
 const w=taxFixture(),p=w.profiles[0];p.ending={endsOn:'2026-11-30',reason:'=status evidence',createdBy:p.createdBy,createdAt:'2026-10-10T12:00:00Z'};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await taxWorkbook(w,'2026-01-01','2026-01-31'));
 const row=book.getWorksheet('Rezimi')!.getRow(2);
 expect(row.getCell(3).value).toBe('2026-11-30');expect(row.getCell(11).value).toBe('2026-12-31');
 expect(row.getCell(12).value).toBe('=status evidence');expect(row.getCell(13).value).toBe(p.createdBy);expect(row.getCell(14).value).toBe(p.ending.createdAt);
});
