import {previewTaxRecord,taxPeriodReport,taxCommandSchema,taxWorkspaceSchema,verifyTaxWorkspace} from './taxEvidence';
import {taxFixture,taxRecord,taxId} from '../../test/taxEvidenceFixture';

it('verifies frozen source/profile identities and an exact complete month',()=>{
 const w=taxWorkspaceSchema.parse(taxFixture());expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(true);
 expect(taxPeriodReport(w,'2026-01-01','2026-01-31')).toMatchObject({complete:true,output:'20000',input:'0',deductible:'0',difference:'20000',missing:[]});
 expect(previewTaxRecord(taxRecord(),w,w.documents[0])[0]).toMatchObject({net:'100000',tax:'20000',deductible:'0'});
});
it('refuses a tampered policy, cross-firm source, overlap or duplicate active event',()=>{
 const patches=[(w:ReturnType<typeof taxFixture>)=>{w.policies[0].lawSha256='changed';},(w:ReturnType<typeof taxFixture>)=>{w.documents[0].document.firmId=taxId(99);},(w:ReturnType<typeof taxFixture>)=>{w.profiles.push({...w.profiles[0],id:taxId(99)});},(w:ReturnType<typeof taxFixture>)=>{w.events.push({...w.events[0],id:taxId(99)});},(w:ReturnType<typeof taxFixture>)=>{w.events[0].lines[0].tax='19000';}];
 for(const patch of patches){const w=taxFixture();patch(w);expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);}
});
it('preserves cancellation history while removing its totals and tracking uncovered documents',()=>{
 const w=taxFixture();w.events[0].cancelled=true;w.events[0].cancelReason='Correction';
 const r=taxPeriodReport(w,'2026-01-01','2026-01-31');expect(r).toMatchObject({complete:false,output:'0'});expect(r.missing[0].number).toBe('=TAX-1');
 w.documents[0].sourceReversed=true;expect(taxPeriodReport(w,'2026-01-01','2026-01-31')).toMatchObject({complete:true,output:'0'});
 w.events[0].cancelled=false;w.events[0].cancelReason=null;expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
});
it('requires a full calendar period and refuses uncovered or mixed regimes',()=>{
 const w=taxFixture();for(const [from,to] of [['2026-01-02','2026-01-31'],['2026-01-01','2026-01-30'],['2025-12-01','2025-12-31'],['bad','2026-01-31']])expect(()=>taxPeriodReport(w,from,to)).toThrow();
 w.profiles[0].frequency='quarterly';expect(taxPeriodReport(w,'2026-01-01','2026-03-31').output).toBe('20000');
 expect(()=>taxPeriodReport(w,'2026-02-01','2026-04-30')).toThrow();
 w.profiles[0].validFrom='2026-01-15';expect(()=>taxPeriodReport(w,'2026-01-01','2026-03-31')).toThrow('missing_tax_profile');
});
it('requires explicit deduction evidence and retains amounts larger than JS precision',()=>{
 const w=taxFixture();w.documents[0].document.direction='incoming';w.events[0].lines[0].deductible='15000';w.events[0].lines[0].deductionEvidence='Conditions verified, partial non-deductible portion';
 expect(taxPeriodReport(w,'2026-01-01','2026-01-31')).toMatchObject({output:'0',input:'20000',deductible:'15000',difference:'-15000'});
 w.events[0].lines[0].deductionEvidence='';expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
 const big=taxFixture();big.documents[0].document.lines[0].net='900719925474099301';big.documents[0].document.lines[0].tax='180143985094819860';big.events[0].lines[0].net='900719925474099301';big.events[0].lines[0].tax='180143985094819860';
 expect(taxPeriodReport(big,'2026-01-01','2026-01-31').output).toBe('180143985094819860');
});
it('rejects unsupported source kinds, nonmatching source tax and repeated/missing lines',()=>{
 const w=taxFixture(),c=taxRecord();w.documents[0].document.kind='advance';expect(()=>previewTaxRecord(c,w,w.documents[0])).toThrow();
 w.documents[0].document.kind='invoice';w.documents[0].document.lines[0].tax='19000';expect(()=>previewTaxRecord(c,w,w.documents[0])).toThrow();
 w.documents[0].document.lines[0].tax='20000';c.data.lines.push(c.data.lines[0]);expect(()=>previewTaxRecord(c,w,w.documents[0])).toThrow();
 c.data.lines=[];expect(()=>previewTaxRecord(c,w,w.documents[0])).toThrow();
});
it('refuses profiles and commands inconsistent with supported policy dates/frequency',()=>{
 const input={action:'create_profile',idempotencyKey:'profile',data:{firmId:taxId(1),id:taxId(3),expectedRevision:'0',legalForm:'doo',regime:'regular_vat',frequency:'monthly',validFrom:'2026-01-01',validTo:'2026-12-31',evidence:'Proof',policyId:'rs-vat-reference-2026-v1'}};
 expect(taxCommandSchema.safeParse(input).success).toBe(true);
 for(const patch of [{validTo:'2027-01-01'},{frequency:'none'},{evidence:''},{policyId:'future'}])expect(taxCommandSchema.safeParse({...input,data:{...input.data,...patch}}).success).toBe(false);
});
it('keeps the original profile and its evidence while applying an immutable end and successor',()=>{
 const w=taxFixture(),p=w.profiles[0];p.ending={endsOn:'2026-11-30',reason:'Status changes from December',createdBy:taxId(9),createdAt:'2026-10-10T12:00:00Z'};
 w.profiles.push({...p,id:taxId(20),validFrom:'2026-12-01',regime:'small_taxpayer',frequency:'none',ending:null});
 expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(true);
 expect(taxPeriodReport(w,'2026-01-01','2026-01-31').output).toBe('20000');
 expect(taxPeriodReport(w,'2026-12-01','2026-12-31').profile.id).toBe(taxId(20));
 expect(p.validTo).toBe('2026-12-31');
 w.profiles[1].validFrom='2026-11-30';expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
});
it('rejects events beyond the effective end, even cancelled history, and malformed ending proof',()=>{
 const w=taxFixture(),p=w.profiles[0];p.ending={endsOn:'2026-01-14',reason:'Cannot cut historic source',createdBy:taxId(9),createdAt:'2026-01-01T00:00:00Z'};
 expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
 w.events[0].cancelled=true;w.events[0].cancelReason='Annulled';expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
 p.ending.endsOn='2026-12-31';expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
 p.ending.endsOn='2026-11-30';p.cancelled=true;p.cancelReason='Invalid';expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(false);
 p.ending.reason='';expect(taxWorkspaceSchema.safeParse(w).success).toBe(false);
});
it('blocks reports across a midperiod status change instead of silently dropping one regime',()=>{
 const w=taxFixture();w.events=[];w.documents=[];w.profiles[0].ending={endsOn:'2026-10-15',reason:'Status change',createdBy:taxId(9),createdAt:'2026-10-10T12:00:00Z'};
 w.profiles.push({...w.profiles[0],id:taxId(20),validFrom:'2026-10-16',ending:null});
 expect(verifyTaxWorkspace(w,w.firmId,w.yearId)).toBe(true);
 expect(()=>taxPeriodReport(w,'2026-10-01','2026-10-31')).toThrow('missing_tax_profile');
 expect(taxPeriodReport(w,'2026-11-01','2026-11-30').complete).toBe(true);
});
