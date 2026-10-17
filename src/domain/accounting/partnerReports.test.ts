import { agingBucket,agingTotals,partnerCardRows,partnerReportSchema,verifyPartnerReport } from './partnerReports';
import { partnerReportFixture as r,partnerReportId as id } from '../../test/partnerReportFixture';
import { openingSnapshot,openingPartnerReport } from '../../test/openingFixture';
it('reconciles opening evidence with actual partner card rows before rendering',()=>{
 expect(verifyPartnerReport(openingPartnerReport,{firmId:openingPartnerReport.firmId,partnerId:null})).toBe(true);
 expect(verifyPartnerReport({...openingPartnerReport,migration:{...openingSnapshot,controls:[{...openingSnapshot.controls[0],balance:'9999'}]}},{firmId:openingPartnerReport.firmId,partnerId:null})).toBe(false);
 expect(verifyPartnerReport({...r,migration:openingSnapshot},{firmId:r.firmId,partnerId:null})).toBe(false);
});
it('includes initial remaining items once in aging and respects the selected partner',()=>{
 expect(agingTotals({...r,migration:openingSnapshot},'outgoing').due).toBe('18200');expect(agingTotals({...r,partnerId:id(99),migration:openingSnapshot},'outgoing').due).toBe('8200');
 expect(agingTotals({...r,migration:{...openingSnapshot,items:openingSnapshot.items.map(i=>({...i,remaining:'0'}))}},'outgoing').due).toBe('8200');
});
const q={firmId:r.firmId,partnerId:null};
it('verifies complete partner/account detail without netting supplier and customer balances',()=>{
 expect(verifyPartnerReport(partnerReportSchema.parse(r),q)).toBe(true);
 expect(partnerCardRows(r,id(2),id(3)).map(l=>l.balance)).toEqual(['12000','8000','8100']);
 expect(agingTotals(r,'outgoing')).toEqual({due:'8200',overpaid:'0',buckets:{notDue:'0','1-30':'0','31-60':'0','61-90':'0','91+':'8200'}});
 expect(agingTotals(r,'incoming').due).toBe('700');
});
it.each([['2026-10-09','notDue'],['2026-10-08','notDue'],['2026-10-07','1-30'],['2026-09-08','1-30'],['2026-09-07','31-60'],['2026-08-09','31-60'],['2026-08-08','61-90'],['2026-07-10','61-90'],['2026-07-09','91+']])('classifies due date %s at exact boundaries', (date,bucket)=>expect(agingBucket(r.businessDate,date)).toBe(bucket));
it('refuses scope, missing/duplicate detail, totals and evidence inconsistencies',()=>{
 const variants=[{...r,firmId:id(9)},{...r,partnerId:id(2)},{...r,lines:r.lines.slice(1)},{...r,lines:[...r.lines,r.lines[0]]},{...r,accounts:[...r.accounts,r.accounts[0]]},{...r,accounts:r.accounts.map((a,i)=>i? a:{...a,unlinkedBalance:'0'})},{...r,documents:r.documents.map((d,i)=>i?d:{...d,difference:'1'})},{...r,documents:r.documents.map((d,i)=>i?d:{...d,evidence:{...d.evidence,due:'1'}})},{...r,documents:[...r.documents,r.documents[0]]}];
 variants.forEach(v=>expect(verifyPartnerReport(v,q)).toBe(false));
 // Internally consistent document numbers still fail when they disagree with their actual source lines.
 expect(verifyPartnerReport({...r,documents:r.documents.map((d,i)=>i?d:{...d,ledgerBalance:'8001',difference:'1'})},q)).toBe(false);
 expect(verifyPartnerReport({...r,documents:r.documents.map((d,i)=>i?d:{...d,journalIds:[id(10)]})},q)).toBe(false);
});
it('preserves large exact amounts and keeps advances and prepayments outside invoice aging',()=>{
 const huge='999999999999999999999999',wide={...r,lines:[{...r.lines[0],debit:huge}],accounts:[{...r.accounts[0],debit:huge,credit:'0',balance:huge,linkedBalance:huge,unlinkedBalance:'0'}],documents:[]};
 expect(verifyPartnerReport(wide,q)).toBe(true);
 const over={...r,documents:[{...r.documents[0],evidence:{gross:'12000',credits:'0',advances:'0',paid:'14000',due:'0',overpaid:'2000',status:'overpaid' as const},expectedBalance:'-2000',ledgerBalance:'-2000',difference:'0'},r.documents[3]]};
 expect(agingTotals(over,'outgoing').due).toBe('0');expect(agingTotals(over,'outgoing').overpaid).toBe('2000');
});
