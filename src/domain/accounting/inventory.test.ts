import { stockIssueValue,parseQuantity,verifyStockWorkspace,stockPreview } from './inventory';
import { stockEmpty,stockReceived,stockIssue,stockId as id } from '../../test/inventoryFixture';
it('allocates rounded average and consumes the exact final residual without Number conversion',()=>{
 expect(stockIssueValue('3','5','1')).toBe('2');expect(stockIssueValue('2','3','1')).toBe('2');expect(stockIssueValue('1','1','1')).toBe('1');
 expect(stockIssueValue('900719925474099301','900719925474099301','900719925474099300')).toBe('900719925474099300');
 expect(()=>stockIssueValue('1','1','2')).toThrow();expect(()=>stockIssueValue('100','1','1')).toThrow();expect(()=>stockIssueValue('100','1','99')).toThrow();
});
it('parses quantities to three decimals exactly and rejects greater precision or zero',()=>{expect(parseQuantity('0001,005')).toBe('1005');expect(parseQuantity('9007199254740993.001')).toBe('9007199254740993001');expect(()=>parseQuantity('1.0001')).toThrow();expect(()=>parseQuantity('0')).toThrow();});
it('reconstructs stock from immutable history and independently reconciles the GL balance',()=>{
 expect(verifyStockWorkspace(stockEmpty,id(1))).toBe(true);expect(verifyStockWorkspace(stockReceived,id(1))).toBe(true);
 for(const w of [{...stockReceived,firmId:id(99)},{...stockReceived,items:[{...stockReceived.items[0],value:'9999'}]},{...stockReceived,accounts:[{id:id(3),balance:'1'}]},{...stockReceived,movements:[{...stockReceived.movements[0],previousValue:'1'}]}])expect(verifyStockWorkspace(w,id(1))).toBe(false);
});
it('verifies latest-first reversal history and restored quantities',()=>{
 const w={...stockReceived,items:[{...stockEmpty.items[0],revision:'3'}],accounts:stockEmpty.accounts,cancellations:[{movementId:id(4),itemId:id(2),journalId:id(11),sequence:'3',postingDate:'2026-01-02',reason:'Correction'}]};expect(verifyStockWorkspace(w,id(1))).toBe(true);
 expect(verifyStockWorkspace({...w,cancellations:[{...w.cancellations[0],movementId:id(99)}]},id(1))).toBe(false);
});
it('previews a balanced issue and refuses independently changed accounts or excess quantity',()=>{
 expect(stockPreview(stockIssue,stockReceived)).toEqual([{accountId:id(3),partnerId:null,debit:'0',credit:'4000'},{accountId:id(10),partnerId:null,debit:'4000',credit:'0'}]);
 expect(()=>stockPreview(stockIssue,{...stockReceived,items:[{...stockReceived.items[0],externalMovements:true}]})).toThrow();
});
