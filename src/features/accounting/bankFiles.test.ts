import ExcelJS from 'exceljs';
import { bankColumns,bankColumnLabels,parseBankTable,readBankFile } from './bankFiles';
const row=['BANK-0001','2026-01-01','2026-01-02','9007199254740993.01','0','Buyer','0001','Same source'];
it('accepts Serbian column names, exact money and distinct IDs for equal transactions',()=>{
 const parsed=parseBankTable([bankColumnLabels,row,['BANK-0002',...row.slice(1)]]);
 expect(parsed).toHaveLength(2);expect(parsed[0].incoming).toBe('900719925474099301');expect(parsed[0].reference).toBe('0001');
});
it('refuses a malformed row or duplicate ID instead of partially accepting a file',()=>{
 expect(()=>parseBankTable([[...bankColumns],row,row])).toThrow('bank_duplicate');
 expect(()=>parseBankTable([[...bankColumns],row,['BANK-2','2026-02-30','2026-01-02','10.001','0','','','']])).toThrow('bank_row');
 expect(()=>parseBankTable([['Date','Amount'],['2026-01-01','1']])).toThrow('bank_columns');
});
const file=async(amount:ExcelJS.CellValue='100.01',extraSheet=false)=>{
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Izvod');sheet.addRow(bankColumnLabels);sheet.addRow(['BANK-0001',new Date('2026-01-01T00:00:00Z'),'02.01.2026.',amount,'0.00','Buyer','0001','Source']);sheet.getCell('B2').numFmt='yyyy-mm-dd';if(extraSheet)workbook.addWorksheet('Other');
 const bytes=await workbook.xlsx.writeBuffer();return {name:'izvod.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes} as File;
};
it('reads a real Excel workbook, including Excel dates',async()=>{
 expect((await readBankFile(await file()))[0]).toMatchObject({externalId:'BANK-0001',bookingDate:'2026-01-01',valueDate:'2026-01-02',incoming:'10001'});
});
it('refuses numeric and formula amount cells, and multiple worksheets',async()=>{
 await expect(readBankFile(await file(100.01))).rejects.toMatchObject({code:'bank_text_amount',row:2});
 await expect(readBankFile(await file({formula:'100+0.01',result:100.01}))).rejects.toMatchObject({code:'bank_text_amount'});
 await expect(readBankFile(await file('100.01',true))).rejects.toMatchObject({code:'bank_file'});
});
