import {type SupabaseClient} from '@supabase/supabase-js';
import {SupabaseAccountingRepository} from './accountingRepository';
import {taxFixture,taxRecord,taxId} from '../test/taxEvidenceFixture';
import type {TaxCommand} from '../domain/accounting/taxEvidence';
const setup=(data:unknown)=>{const rpc=jest.fn(async()=>({data,error:null}));return {repo:new SupabaseAccountingRepository({rpc} as unknown as SupabaseClient),rpc};};
it('binds tax receipts to the command target/action/firm/revision',async()=>{
 const c=taxRecord(),r={firmId:c.data.firmId,id:c.data.id,action:c.action,revision:'2'};expect(await setup(r).repo.taxCommand(c)).toEqual(r);
 for(const patch of [{firmId:taxId(99)},{id:taxId(99)},{action:'create_profile'},{revision:'3'}])await expect(setup({...r,...patch}).repo.taxCommand(c)).rejects.toMatchObject({code:'invalid_response'});
});
it('verifies tax workspace source amounts and exact scope',async()=>{
 const w=taxFixture();expect(await setup(w).repo.taxWorkspace(w.firmId,w.yearId)).toEqual(w);
 await expect(setup({...w,firmId:taxId(99)}).repo.taxWorkspace(w.firmId,w.yearId)).rejects.toMatchObject({code:'invalid_response'});
 w.events[0].lines[0].deductible='1';await expect(setup(w).repo.taxWorkspace(w.firmId,w.yearId)).rejects.toMatchObject({code:'invalid_response'});
});
it('checks ending receipts and rejects workspace snapshots that lose the ending contract',async()=>{
 const c:TaxCommand={action:'end_profile',idempotencyKey:'end',data:{firmId:taxId(1),id:taxId(3),expectedRevision:'2',endsOn:'2026-11-30',reason:'Dated registration evidence'}};
 const r={firmId:taxId(1),id:taxId(3),action:'end_profile',revision:'3'};const {repo,rpc}=setup(r);
 expect(await repo.taxCommand(c)).toEqual(r);expect(rpc).toHaveBeenCalledWith('paperwork_tax_command',{p_action:'end_profile',p_data:c.data,p_key:'end'});
 await expect(setup({...r,action:'cancel_profile'}).repo.taxCommand(c)).rejects.toMatchObject({code:'invalid_response'});
 const w=taxFixture();const {ending,...withoutEnding}=w.profiles[0];expect(ending).toBeNull();
 await expect(setup({...w,profiles:[withoutEnding]}).repo.taxWorkspace(w.firmId,w.yearId)).rejects.toMatchObject({code:'invalid_response'});
});
