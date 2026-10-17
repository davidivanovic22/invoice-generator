import {openingCommandSchema,openingWorkspaceSchema,validateOpeningImport,verifyOpeningWorkspace,openingControls} from './opening';
import {openingImport as c,openingContext as w,openingSnapshot as s,openingId as id} from '../../test/openingFixture';
it('replaces partner aggregates with individual items without doubling the initial journal',()=>{
 const p=validateOpeningImport(c,w);expect(p.debit).toBe('10000');expect(p.credit).toBe('10000');expect(p.lines).toHaveLength(2);expect(p.lines.reduce((n,l)=>n+BigInt(l.debit),BigInt(0))).toBe(BigInt(10000));
});
it('rejects incomplete item coverage, netting, foreign mapping and wrong year/period dates',()=>{
 for(const d of [{items:[]},{items:c.data.items.map(i=>({...i,amount:'9999'}))},{balances:c.data.balances.map(r=>({...r,accountId:id(99)}))},{asOf:'2026-01-01'},{postingDate:'2026-01-02'},{items:[...c.data.items,...c.data.items]}])expect(()=>validateOpeningImport({...c,data:{...c.data,...d}},w)).toThrow();
 expect(()=>validateOpeningImport(c,{...w,periods:w.periods.map(p=>({...p,status:'closed'}))})).toThrow();
});
it('preserves exact large amounts and rejects numeric JSON or hidden extra source fields',()=>{
 const huge='900719925474099301';const d={...c.data,balances:c.data.balances.map(r=>({...r,debit:r.debit==='0'?'0':huge,credit:r.credit==='0'?'0':huge})),items:c.data.items.map(i=>({...i,amount:huge}))};expect(validateOpeningImport({...c,data:d},w).debit).toBe(huge);
 expect(openingCommandSchema.safeParse({...c,data:{...c.data,balances:c.data.balances.map(r=>({...r,debit:10000}))}}).success).toBe(false);
});
it('reconstructs outstanding amounts, revisions and reversal evidence independently',()=>{
 expect(verifyOpeningWorkspace(openingWorkspaceSchema.parse(s),id(1))).toBe(true);
 const a={id:id(10),itemId:id(9),journalId:id(11),lineId:'close',amount:'4000',lineAmount:'4000',accountId:id(4),partnerId:id(6),postingDate:'2026-01-05',reversed:false,reversalId:null};
 const paid={...s,applications:[a],items:s.items.map(i=>({...i,remaining:'6000',revision:'2'})),controls:[{...s.controls[0],balance:'6000'}]};expect(verifyOpeningWorkspace(paid,id(1))).toBe(true);
 expect(verifyOpeningWorkspace({...paid,items:s.items},id(1))).toBe(false);
 const reversed={...paid,applications:[{...a,reversed:true,reversalId:id(12)}],items:s.items.map(i=>({...i,revision:'3'})),controls:s.controls};expect(verifyOpeningWorkspace(reversed,id(1))).toBe(true);
 expect(verifyOpeningWorkspace({...paid,applications:[{...a,amount:'4001'}]},id(1))).toBe(false);
 expect(verifyOpeningWorkspace({...paid,applications:[{...a,partnerId:id(99)}]},id(1))).toBe(false);
});
it('refuses duplicate source identities and reports independent book differences explicitly',()=>{
 expect(verifyOpeningWorkspace({...s,items:[...s.items,...s.items]},id(1))).toBe(false);expect(verifyOpeningWorkspace(s,id(99))).toBe(false);
 const difference={...s,controls:[{...s.controls[0],balance:'10200'}]};expect(verifyOpeningWorkspace(difference,id(1))).toBe(true);expect(openingControls(difference)[0].difference).toBe('200');
});
