import ExcelJS from 'exceljs';
import { fxBankColumns,parseBankTable,readBankFile } from './bankFiles';
const row=['BANK-001','2026-01-15','15.01.2026','9007199254740993.01','0','Partner','','Payment'];
it('accepts declared foreign headers and refuses RSD headers in the foreign adapter',()=>{
 expect(parseBankTable([[...fxBankColumns],row],'fx')[0]).toMatchObject({incoming:'900719925474099301',valueDate:'2026-01-15'});
 expect(()=>parseBankTable([[...fxBankColumns],row])).toThrow();
 expect(()=>parseBankTable([[...fxBankColumns],row,row],'fx')).toThrow();
});
it('rejects numeric amount and formula cells in real XLSX files',async()=>{
 for(const value of [40,{formula:'1+2',result:3}]){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Foreign');sheet.addRow([...fxBankColumns]);sheet.addRow(['BANK-001','2026-01-15','2026-01-15',value,'0','','','']);
  const bytes=await book.xlsx.writeBuffer();const file={name:'foreign.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes} as File;
  await expect(readBankFile(file,'fx')).rejects.toMatchObject({code:'bank_text_amount',row:2});
 }
});
