import { allocateFxCarrying,fxCommandSchema,fxWorkspaceSchema,fxPreview,fxCarrying,fxRemaining,fxLatestActive,verifyFxWorkspace } from './fx';
import { fxFixture as w,fxSettlementFixture as payment,fxEventFixture as event,fxId as id,fxRateFixture as rate } from '../../test/fxFixture';
const command={action:'settle' as const,idempotencyKey:'fx-pay',data:{firmId:id(1),id:id(2),expectedRevision:'1',journalId:id(15),fiscalYearId:id(10),periodId:id(11),postingDate:'2026-01-15',foreignMinor:'4000',currency:'EUR' as const,cashAccountId:id(6),gainAccountId:id(7),lossAccountId:id(8),sourceAccount:'rs35 160-0001',sourceId:' FX-PAY-001 ',...rate,rateMicros:'120000000'}};
it('allocates exact carrying value and leaves every residual for the final payment',()=>{
 expect(allocateFxCarrying('1170000','10000','4000')).toBe('468000');
 expect(allocateFxCarrying('2','3','1')).toBe('1');expect(allocateFxCarrying('1','2','2')).toBe('1');expect(()=>allocateFxCarrying('1','2','1')).toThrow();
 expect(allocateFxCarrying('900719925474099301','900719925474099301','900719925474099300')).toBe('900719925474099300');
 expect(()=>allocateFxCarrying('1170000','10000','10001')).toThrow();
});
it('previews both settlement directions with balanced positive sides and normalized bank identity',()=>{
 const c=fxCommandSchema.parse(command);if(c.action!=='settle')throw new Error('fixture');expect(c.data.sourceAccount).toBe('RS351600001');expect(c.data.sourceId).toBe('FX-PAY-001');
 const p=w.positions[0];expect(fxPreview(c,p)).toEqual([{accountId:id(6),partnerId:null,debit:'480000',credit:'0'},{accountId:id(4),partnerId:id(5),debit:'0',credit:'468000'},{accountId:id(7),partnerId:null,debit:'0',credit:'12000'}]);
 expect(fxPreview(c,{...p,direction:'payable'})[2]).toMatchObject({accountId:id(8),debit:'12000',credit:'0'});
 expect(fxPreview({...c,data:{...c.data,rateMicros:'115000000'}},p)[2]).toMatchObject({accountId:id(8),debit:'8000'});
 expect(fxPreview({...c,data:{...c.data,rateMicros:'117000000'}},p)).toHaveLength(2);
 expect(()=>fxPreview({...c,data:{...c.data,currency:'USD'}},p)).toThrow();
});
it('verifies remaining-principal revaluation, mixed chronology and full settlement/storno',()=>{
 const p={...w.positions[0],revision:'2',settlements:[payment],analyticBalance:'702000'};
 expect(verifyFxWorkspace(fxWorkspaceSchema.parse({...w,positions:[p]}),id(1))).toBe(true);expect(fxRemaining(p)).toBe('6000');expect(fxCarrying(p)).toBe('702000');expect(fxLatestActive(p)?.kind).toBe('payment');
 const e={...event,sequence:'3',foreignMinor:'6000',previousRsd:'702000',targetRsd:'708000',delta:'6000',rateMicros:'118000000'};
 const valued={...p,revision:'3',events:[e],analyticBalance:'708000'};expect(verifyFxWorkspace({...w,positions:[valued]},id(1))).toBe(true);expect(fxLatestActive(valued)?.kind).toBe('value');
 const bad={...valued,revision:'4',settlements:[{...payment,cancelled:true,reversalId:id(18),reason:'Wrong order',cancelDate:'2026-01-16',cancelSequence:'4'}]};expect(verifyFxWorkspace({...w,positions:[bad]},id(1))).toBe(false);
 const cancelled={...p,revision:'3',analyticBalance:'1170000',settlements:[{...payment,cancelled:true,reversalId:id(18),reason:'Correction',cancelDate:'2026-01-16',cancelSequence:'3'}]};expect(verifyFxWorkspace({...w,positions:[cancelled]},id(1))).toBe(true);expect(fxRemaining(cancelled)).toBe('10000');
 const full={...p,analyticBalance:'0',settlements:[{...payment,foreignMinor:'10000',carryingRsd:'1170000',paidRsd:'1200000',delta:'30000'}]};expect(verifyFxWorkspace({...w,positions:[full]},id(1))).toBe(true);expect(fxCarrying(full)).toBe('0');expect(fxRemaining(full)).toBe('0');
});
it('rejects corrupt evidence, omitted revisions and duplicate bank identities',()=>{
 const p={...w.positions[0],revision:'2',settlements:[payment],analyticBalance:'702000'};
 for(const patch of [{carryingRsd:'1'},{foreignMinor:'10001'},{paidRsd:'1'},{delta:'0'},{previousForeign:'6000'},{sourceAccount:'rs35'},{gainAccountId:id(6)}]){
  const dto=fxWorkspaceSchema.safeParse({...w,positions:[{...p,settlements:[{...payment,...patch}]}]});expect(dto.success&&verifyFxWorkspace(dto.data,id(1))).toBe(false);
 }
 expect(verifyFxWorkspace({...w,positions:[{...p,settlements:[]}]},id(1))).toBe(false);
 const duplicate={...p,id:id(20),sourceJournalId:id(21),settlements:[{...payment,id:id(22),journalId:id(22)}]};expect(verifyFxWorkspace({...w,positions:[p,duplicate]},id(1))).toBe(false);
});
