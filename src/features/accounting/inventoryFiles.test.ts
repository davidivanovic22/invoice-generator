import ExcelJS from 'exceljs';
import { stockWorkbook } from './inventoryFiles';
import { stockReceived,stockId as id } from '../../test/inventoryFixture';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
it('roundtrips snapshot identifiers, formula-looking text, exact money and quantities in four Excel sheets',async()=>{
 const d={...stockReceived,items:[{...stockReceived.items[0],name:'=SUM(1,2)'}]},w={firmId:id(1),yearId:id(8)} as AccountingWorkspace;
 const book=new ExcelJS.Workbook();await book.xlsx.load(await stockWorkbook(d,w).xlsx.writeBuffer());
 expect(book.worksheets).toHaveLength(4);expect(book.getWorksheet('Stanje')!.getRow(3).getCell(4).value).toBe('=SUM(1,2)');expect(book.getWorksheet('Stanje')!.getRow(3).getCell(8).value).toBe('100.00');expect(book.getWorksheet('Stanje')!.getRow(3).getCell(7).value).toBe('10.000');
 book.worksheets.forEach(s=>s.eachRow(r=>r.eachCell(c=>{expect(c.type).toBe(ExcelJS.ValueType.String);expect(c.numFmt).toBe('@');})));
});
