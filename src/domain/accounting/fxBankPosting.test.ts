import { fxBankPostingPreview,fxBankWorkbenchSchema,verifyFxBankWorkbench } from './fxBankPosting';
import { fxBankUnposted as unposted,fxBankPosted as posted,fxBankAllocated as allocated,fxBankPostCommand,fxBankAllocationCommand } from '../../test/fxBankPostingFixture';
import { fxId as id } from '../../test/fxFixture';
const verify=(w:typeof posted)=>verifyFxBankWorkbench(fxBankWorkbenchSchema.parse(w),id(1),id(20));
it('verifies unposted, cash-source and partial allocation snapshots with exact linked clearing balances',()=>{
 expect(verify(unposted)).toBe(true);expect(verify(posted)).toBe(true);expect(verify(allocated)).toBe(true);
 expect(verify({...allocated,posting:{...allocated.posting!,attributedBalance:'0'}})).toBe(false);
 expect(verify({...allocated,revision:'3'})).toBe(false);
 expect(verifyFxBankWorkbench(allocated,id(99),id(20))).toBe(false);
});
it('previews one cash posting followed by clearing/analytic/realized lines without posting cash twice',()=>{
 const bank=fxBankPostingPreview(fxBankPostCommand,unposted);expect(bank[0]).toMatchObject({accountId:id(22),debit:'1200000',credit:'0'});
 const lines=fxBankPostingPreview(fxBankAllocationCommand,posted);expect(lines.map(l=>l.accountId)).toEqual([id(6),id(4),id(7)]);expect(lines.map(l=>[l.debit,l.credit])).toEqual([['480000','0'],['0','468000'],['0','12000']]);
 expect(()=>fxBankPostingPreview(fxBankAllocationCommand,allocated)).toThrow('stale_preview');
});
it('rejects wrong-bank or mismatched settlement provenance and a hidden manual/bank source collision',()=>{
 const p=allocated.fx.positions[0],s=p.settlements![0];
 for(const payment of [{...s,bank:{...s.bank!,transactionId:id(99)}},{...s,cashAccountId:id(22)},{...s,sourceId:'OTHER'}])expect(verify({...allocated,fx:{...allocated.fx,positions:[{...p,settlements:[payment]}]}})).toBe(false);
});
it('restores both clearing amounts on cancellation and forbids reversal with active allocations',()=>{
 const s=allocated.fx.positions[0].settlements![0],cancelled={...s,cancelled:true,reversalId:id(25),reason:'Correction',cancelDate:'2026-01-16',cancelSequence:'3'};
 const w={...allocated,revision:'3',posting:{...posted.posting!},cancellations:[{id:id(15),kind:'allocation' as const,sequence:'3',journalId:id(25),postingDate:'2026-01-16',reason:'Correction'}],fx:{...allocated.fx,positions:[{...allocated.fx.positions[0],revision:'3',analyticBalance:'1170000',settlements:[cancelled]}]}};
 expect(verify(w)).toBe(true);expect(verify({...w,posting:{...w.posting,remainingRsd:'720000'}})).toBe(false);
 expect(verify({...allocated,revision:'3',cancellations:[{id:id(23),kind:'bank',sequence:'3',journalId:id(26),postingDate:'2026-01-16',reason:'Correction'}]})).toBe(false);
});
