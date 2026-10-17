import { accountingReportSchema,ledgerRows,reportQuerySchema,verifyReport } from './reports';
import { reportFixture as r,reportId as id,reportQuery as q } from '../../test/accountingReportFixture';
it('keeps initial journals visible while excluding them from movements and running balance rows',()=>{
 const value={...r,journalCount:'1',lineCount:'2',lines:r.lines.slice(0,2).map(l=>({...l,opening:true})),accounts:r.accounts.map(a=>({...a,openingDebit:a.accountId===id(3)?'14002':'0',openingCredit:a.accountId===id(4)?'14002':'0',openingBalance:a.accountId===id(3)?'14002':'-14002',closingBalance:a.accountId===id(3)?'14002':'-14002',debit:'0',credit:'0'})),totals:{openingDebit:'14002',openingCredit:'14002',debit:'0',credit:'0',openingBalanceDebit:'14002',openingBalanceCredit:'14002',closingBalanceDebit:'14002',closingBalanceCredit:'14002'}};
 expect(verifyReport(value,q)).toBe(true);expect(ledgerRows(value,id(3))).toEqual([]);expect(verifyReport({...value,lines:value.lines.map(l=>({...l,opening:false}))},q)).toBe(false);
});
it('reconciles posted journals, account movements and opening/closing balances',()=>{
 expect(verifyReport(accountingReportSchema.parse(r),q)).toBe(true);
 expect(ledgerRows(r,id(3)).map(l=>l.balance)).toEqual(['14002','13002']);
 expect(ledgerRows(r,id(4)).map(l=>l.balance)).toEqual(['-14002','-13002']);
});
it('keeps aggregate balances beyond the 24-digit source line limit exact',()=>{
 const huge='1999999999999999999999998';
 const value={...r,accounts:r.accounts.map(a=>({...a,openingDebit:a.accountId===id(3)?huge:'0',openingCredit:a.accountId===id(4)?huge:'0',openingBalance:a.accountId===id(3)?huge:'-'+huge,closingBalance:(a.accountId===id(3)?BigInt(huge)+BigInt(9001):-BigInt(huge)-BigInt(9001)).toString()})),totals:{...r.totals,openingDebit:huge,openingCredit:huge,openingBalanceDebit:huge,openingBalanceCredit:huge,closingBalanceDebit:(BigInt(huge)+BigInt(9001)).toString(),closingBalanceCredit:(BigInt(huge)+BigInt(9001)).toString()}};
 expect(verifyReport(accountingReportSchema.parse(value),q)).toBe(true);
});
it('refuses partial, duplicated, wrong-scope or inconsistent snapshots',()=>{
 for(const value of [{...r,firmId:id(9)},{...r,yearId:id(9)},{...r,lines:r.lines.slice(1)},{...r,lines:[r.lines[0],r.lines[0],...r.lines.slice(2)]},{...r,accounts:[r.accounts[0],r.accounts[0]]},{...r,totals:{...r.totals,debit:'11002'}},{...r,accounts:r.accounts.map(a=>({...a,closingBalance:'0'}))},{...r,lines:[...r.lines].reverse()},{...r,lines:r.lines.map(l=>({...l,journalDescription:l.lineId}))}])expect(verifyReport(value,q)).toBe(false);
 expect(accountingReportSchema.safeParse({...r,lineCount:4}).success).toBe(false);
 expect(reportQuerySchema.safeParse({...q,from:'2026-02-30'}).success).toBe(false);
 expect(reportQuerySchema.safeParse({...q,from:'2026-02-01'}).success).toBe(false);
});
