import { fxBankAccountCommandSchema,fxBankStatementInputSchema,fxBankReadSchema,fxBankControl } from './fxBank';
const firm='10000000-0000-4000-8000-000000000001',account='10000000-0000-4000-8000-000000000002',year='10000000-0000-4000-8000-000000000003',tx='10000000-0000-4000-8000-000000000004',settlement='10000000-0000-4000-8000-000000000005';
const row={externalId:'FX1',bookingDate:'2026-01-15',valueDate:'2026-01-15',incoming:'900719925474099301',outgoing:'0',counterparty:'Partner',reference:'',description:''};
const data={firmId:firm,bankAccountId:account,fiscalYearId:year,reference:'1',startsOn:'2026-01-15',endsOn:'2026-01-15',opening:'-1',closing:'900719925474099300',rows:[row]};
const saved={firmId:firm,statementId:year,accountId:account,yearId:year,reference:'1',startsOn:data.startsOn,endsOn:data.endsOn,opening:data.opening,closing:data.closing,rows:[{...row,id:tx}],currency:'EUR' as const,number:'RS35160001',cashAccountId:account,links:[{transactionId:tx,settlementId:settlement,linked:true,cancelled:false}]};
it('preserves exact large foreign amounts and rejects inconsistent or double-sided balances',()=>{
 expect(fxBankStatementInputSchema.parse(data).closing).toBe(data.closing);
 for(const bad of [{...data,closing:'900719925474099301'},{...data,rows:[row,row]},{...data,rows:[{...row,outgoing:'1'}]},{...data,opening:'-0'},{...data,rows:[{...row,incoming:100}]}])expect(fxBankStatementInputSchema.safeParse(bad).success).toBe(false);
});
it('requires a supported currency, canonical source and firm-scoped cash UUID',()=>{
 const c={data:{firmId:firm,id:account,name:'EUR',number:'RS35160001',currency:'EUR',cashAccountId:account},idempotencyKey:'one'};
 expect(fxBankAccountCommandSchema.safeParse(c).success).toBe(true);
 for(const bad of [{...c.data,currency:'RSD'},{...c.data,number:'rs35 160'},{...c.data,cashAccountId:'unknown'}])expect(fxBankAccountCommandSchema.safeParse({...c,data:bad}).success).toBe(false);
});
it('cancellation removes active coverage while preserving a verified statement saldo',()=>{
 const s=fxBankReadSchema.parse(saved);expect(fxBankControl(s)).toMatchObject({computedClosing:data.closing,unmatchedCount:0});
 expect(fxBankControl({...s,links:[{...s.links[0],cancelled:true}]})).toMatchObject({unmatchedCount:1,unmatchedIncoming:row.incoming});
 expect(fxBankControl({...s,links:[{...s.links[0],linked:false}]}).unmatchedCount).toBe(1);
});
it('rejects unmatched link IDs and duplicate source linkage in a response',()=>{
 expect(fxBankReadSchema.safeParse({...saved,links:[{...saved.links[0],transactionId:year}]}).success).toBe(false);
 expect(fxBankReadSchema.safeParse({...saved,links:[saved.links[0],saved.links[0]]}).success).toBe(false);
});
it('counts only the remaining portion of a posted bank row, and restores the whole row after bank storno',()=>{
 const s=fxBankReadSchema.parse({...saved,links:[],postings:[{transactionId:tx,journalId:settlement,revision:'2',closed:false,remainingForeign:'6000',remainingRsd:'720000'}]});
 expect(fxBankControl(s)).toMatchObject({unmatchedCount:1,unmatchedIncoming:'6000'});
 expect(fxBankControl({...s,postings:[{...s.postings![0],closed:true,remainingForeign:'0',remainingRsd:'0'}]}).unmatchedIncoming).toBe(row.incoming);
 expect(fxBankReadSchema.safeParse({...saved,postings:s.postings}).success).toBe(false);
});
