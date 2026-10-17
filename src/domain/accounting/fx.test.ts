import { convertFx,parseFxRate,formatFxRate,fxPreview,fxCarrying,fxCommandSchema,fxWorkspaceSchema,verifyFxWorkspace } from './fx';
import { fxFixture as w,fxCreate,fxEventFixture as event,fxId as id } from '../../test/fxFixture';
it('converts exact rates with quote units and half-up rounding without floats',()=>{
 expect(parseFxRate('117,1234')).toBe('117123400');expect(formatFxRate('117123400')).toBe('117.123400');
 expect(convertFx('10000','117000000','1')).toBe('1170000');expect(convertFx('10000','11700000000','100')).toBe('1170000');
 expect(convertFx('1','500000','1')).toBe('1');expect(()=>convertFx('1','499999','1')).toThrow();
});
it('preserves large amounts and rejects overflow or ambiguous rate syntax',()=>{
 expect(convertFx('900719925474099301','1000000','1')).toBe('900719925474099301');
 ['0','-1','1e3','1.1234567','NaN','01.2'].forEach(s=>expect(()=>parseFxRate(s)).toThrow());
 expect(()=>convertFx('999999999999999999999999','999999999999999999','1')).toThrow();
});
it('builds asset/liability gain and loss previews with balanced positive sides',()=>{
 expect(fxPreview(fxCreate)[0]).toMatchObject({debit:'1170000',credit:'0'});
 const command={action:'revalue' as const,idempotencyKey:'r',data:{firmId:id(1),id:id(2),expectedRevision:'1',journalId:id(12),fiscalYearId:id(10),periodId:id(11),postingDate:'2026-01-15',gainAccountId:id(7),lossAccountId:id(8),rateMicros:'119000000',quoteUnits:'1' as const,rateDate:'2026-01-15',publishedOn:'2026-01-15',rateSource:'Manual',sourceReference:'Reference'}};
 const p=w.positions[0];expect(fxPreview(command,p)).toEqual([{accountId:id(4),partnerId:id(5),debit:'20000',credit:'0'},{accountId:id(7),partnerId:null,debit:'0',credit:'20000'}]);
 expect(fxPreview(command,{...p,direction:'payable'})[1]).toMatchObject({accountId:id(8),debit:'20000',credit:'0'});
 expect(fxPreview({...command,data:{...command.data,rateMicros:'116000000'}},p)[1]).toMatchObject({accountId:id(8),debit:'10000'});
 expect(()=>fxPreview(command,{...p,externalMovements:true})).toThrow();
});
it('checks chronological revision history, conversion, carrying amount and actual analytical balance',()=>{
 expect(verifyFxWorkspace(fxWorkspaceSchema.parse(w),id(1))).toBe(true);
 const p={...w.positions[0],revision:'2',events:[event],analyticBalance:'1190000'};expect(verifyFxWorkspace({...w,positions:[p]},id(1))).toBe(true);expect(fxCarrying(p)).toBe('1190000');
 const cancelled={...p,revision:'3',events:[{...event,cancelled:true,reversalId:id(13),reason:'Correction',cancelDate:'2026-01-16',cancelSequence:'3'}],analyticBalance:'1170000'};
 expect(verifyFxWorkspace({...w,positions:[cancelled]},id(1))).toBe(true);
 const closed={...cancelled,revision:'4',closed:true,analyticBalance:'0',closure:{sequence:'4',journalId:id(14),postingDate:'2026-01-17',reason:'Initial correction'}};expect(verifyFxWorkspace({...w,positions:[closed]},id(1))).toBe(true);expect(fxCarrying(closed)).toBe('0');
 for(const v of [{...p,analyticBalance:'1'},{...p,revision:'3'},{...p,events:[{...event,delta:'1'}]},{...p,events:[{...event,previousRsd:'1'}]},{...p,events:[event,event]},{...closed,closure:{...closed.closure,postingDate:'2026-01-01'}}])expect(verifyFxWorkspace({...w,positions:[v]},id(1))).toBe(false);
 expect(verifyFxWorkspace({...w,firmId:id(9)},id(1))).toBe(false);
});
it('rejects unsupported currencies and invalid dates before an API command',()=>{
 if(fxCreate.action!=='create')throw new Error('fixture');
 for(const patch of [{currency:'JPY'},{publishedOn:'2026-01-02'},{rateDate:'2026-01-02'},{quoteUnits:'0'},{rateMicros:'117.1'}])expect(fxCommandSchema.safeParse({...fxCreate,data:{...fxCreate.data,...patch}}).success).toBe(false);
});
