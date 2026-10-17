import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAccountingRepository } from './accountingRepository';
import { minorUnits, type PostJournalCommand } from '../domain/accounting/journal';
import { reportFixture,reportQuery } from '../test/accountingReportFixture';
import { partnerReportFixture } from '../test/partnerReportFixture';
import { fxFixture,fxCreate } from '../test/fxFixture';
import { fxBankAllocated,fxBankPostCommand } from '../test/fxBankPostingFixture';
import { stockReceived,stockIssue } from '../test/inventoryFixture';
import { openingImport,openingSnapshot } from '../test/openingFixture';
it('binds opening receipts to the original source, journal and revision and validates read evidence',async()=>{
 const c=openingImport,r={firmId:c.data.firmId,batchId:c.data.batchId,journalId:c.data.journalId,itemId:null,applicationId:null,revision:'1'};
 const {repo,rpc}=setup(r);expect(await repo.openingCommand(c)).toEqual(r);expect(rpc).toHaveBeenCalledWith('paperwork_opening_command',{p_action:'import',p_data:c.data,p_key:c.idempotencyKey});
 for(const patch of [{firmId:id(99)},{batchId:id(99)},{journalId:id(99)},{revision:'2'},{itemId:id(99)}])await expect(setup({...r,...patch}).repo.openingCommand(c)).rejects.toMatchObject({code:'invalid_response'});
 expect(await setup(openingSnapshot).repo.openingWorkspace(openingSnapshot.firmId)).toEqual(openingSnapshot);await expect(setup({...openingSnapshot,items:openingSnapshot.items.map(i=>({...i,remaining:'9999'}))}).repo.openingWorkspace(openingSnapshot.firmId)).rejects.toMatchObject({code:'invalid_response'});
});

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12,'0')}`;
const command: PostJournalCommand = { kind: 'postJournal', idempotencyKey: 'request', expectedRevision: '0', draft: {
  id: id(1), firmId: id(2), fiscalYearId: id(3), periodId: id(4), postingDate: '2026-01-15', description: '', lines: [
    { id: 'a', accountId: id(5), debit: minorUnits('900719925474099301'), credit: minorUnits('0'), description: '' },
    { id: 'b', accountId: id(6), credit: minorUnits('900719925474099301'), debit: minorUnits('0'), description: '' }
  ]
} };
const receipt = { journalId: id(1), firmId: id(2), revision: '1', number: '2026/000001', postedAt: '2026-01-15T12:00:00+00:00', postedBy: id(7) };
const setup = (data: unknown = receipt, error: unknown = null) => {
  const rpc = jest.fn(async () => ({ data, error }));
  return { rpc, repo: new SupabaseAccountingRepository({ rpc } as unknown as SupabaseClient) };
};
it('verifies inventory history/control balances and binds movement receipts to the exact command',async()=>{
 expect(await setup(stockReceived).repo.stockWorkspace(stockReceived.firmId)).toEqual(stockReceived);
 await expect(setup({...stockReceived,accounts:[{...stockReceived.accounts[0],balance:'1'}]}).repo.stockWorkspace(stockReceived.firmId)).rejects.toMatchObject({code:'invalid_response'});
 const r={firmId:stockIssue.data.firmId,itemId:stockIssue.data.itemId,revision:'3',journalId:id(7)};
 expect(await setup(r).repo.stockCommand(stockIssue)).toEqual(r);
 await expect(setup({...r,journalId:id(99)}).repo.stockCommand(stockIssue)).rejects.toMatchObject({code:'invalid_response'});
});
it('checks bank/FX snapshots together and binds source command receipts to the exact revision and journal',async()=>{
 expect(await setup(fxBankAllocated).repo.fxBankWorkbench(fxBankAllocated.firmId,fxBankAllocated.transactionId)).toEqual(fxBankAllocated);
 await expect(setup({...fxBankAllocated,posting:{...fxBankAllocated.posting!,remainingRsd:'1'}}).repo.fxBankWorkbench(fxBankAllocated.firmId,fxBankAllocated.transactionId)).rejects.toMatchObject({code:'invalid_response'});
 const c=fxBankPostCommand;if(c.action!=='post')throw new Error('fixture');const r={firmId:c.data.firmId,transactionId:c.data.transactionId,revision:'1',journalId:c.data.journalId};expect(await setup(r).repo.fxBankPostingCommand(c)).toEqual(r);
 await expect(setup({...r,revision:'2'}).repo.fxBankPostingCommand(c)).rejects.toMatchObject({code:'invalid_response'});
});
it('binds foreign bank linkage to the exact firm, transaction and existing settlement',async()=>{
 const c={idempotencyKey:'fx-bank-link',data:{firmId:id(1),transactionId:id(2),settlementId:id(3)}};
 expect(await setup(c.data).repo.linkFxBankPayment(c)).toEqual(c.data);
 for(const bad of [{...c.data,firmId:id(99)},{...c.data,transactionId:id(99)},{...c.data,settlementId:id(99)}])await expect(setup(bad).repo.linkFxBankPayment(c)).rejects.toMatchObject({code:'invalid_response'});
 const {repo,rpc}=setup(c.data);await expect(repo.linkFxBankPayment({...c,data:{...c.data,transactionId:'invalid'}})).rejects.toMatchObject({code:'invalid_journal'});expect(rpc).not.toHaveBeenCalled();
});
it('checks FX snapshots and binds immutable command receipts to the exact position, revision and journal',async()=>{
 const {repo,rpc}=setup(fxFixture);expect(await repo.fxWorkspace(fxFixture.firmId)).toEqual(fxFixture);expect(rpc).toHaveBeenCalledWith('paperwork_fx_workspace',{p_firm:fxFixture.firmId});
 await expect(setup({...fxFixture,positions:[{...fxFixture.positions[0],analyticBalance:'1'}]}).repo.fxWorkspace(fxFixture.firmId)).rejects.toMatchObject({code:'invalid_response'});
 const c=fxCreate;if(c.action!=='create')throw new Error('fixture');const r={firmId:c.data.firmId,positionId:c.data.id,revision:'1',journalId:c.data.journalId};expect(await setup(r).repo.fxCommand(c)).toEqual(r);
 await expect(setup({...r,revision:'2'}).repo.fxCommand(c)).rejects.toMatchObject({code:'invalid_response'});await expect(setup({...r,journalId:id(99)}).repo.fxCommand(c)).rejects.toMatchObject({code:'invalid_response'});
});
it('binds current partner reports to firm and optional partner and rejects inconsistent snapshots',async()=>{
 const q={firmId:partnerReportFixture.firmId,partnerId:null};const {repo,rpc}=setup(partnerReportFixture);expect(await repo.partnerReport(q)).toEqual(partnerReportFixture);expect(rpc).toHaveBeenCalledWith('paperwork_partner_report',{p_firm:q.firmId,p_partner:null});
 for(const v of [{...partnerReportFixture,firmId:id(99)},{...partnerReportFixture,lines:[]},{...partnerReportFixture,partnerId:id(2)}])await expect(setup(v).repo.partnerReport(q)).rejects.toMatchObject({code:'invalid_response'});
 await expect(repo.partnerReport({...q,partnerId:'invalid'})).rejects.toMatchObject({code:'invalid_journal'});expect(rpc).toHaveBeenCalledTimes(1);
});
it('binds accounting reports to the requested snapshot and verifies financial totals before returning data',async()=>{
 const {repo,rpc}=setup(reportFixture);expect(await repo.report(reportQuery)).toEqual(reportFixture);
 expect(rpc).toHaveBeenCalledWith('paperwork_accounting_report',{p_firm:reportQuery.firmId,p_year:reportQuery.yearId,p_from:reportQuery.from,p_to:reportQuery.to});
 for(const value of [{...reportFixture,firmId:id(9)},{...reportFixture,totals:{...reportFixture.totals,debit:'1'}},{...reportFixture,lines:reportFixture.lines.slice(1)}])await expect(setup(value).repo.report(reportQuery)).rejects.toMatchObject({code:'invalid_response'});
 await expect(repo.report({...reportQuery,from:'2026-02-30'})).rejects.toMatchObject({code:'invalid_journal'});expect(rpc).toHaveBeenCalledTimes(1);
});

it('registers only validated attachment metadata and binds the receipt to the original target',async()=>{
 const c={action:'register' as const,idempotencyKey:'attachment-key',data:{firmId:id(2),id:id(1),targetType:'document' as const,targetId:id(3),targetRevision:'2',name:'original.pdf',bytes:'3',sha256:'a'.repeat(64),externalReference:'Archive 2026'}};
 const r={firmId:id(2),attachmentId:id(1),targetType:'document',targetId:id(3),revision:'1'};
 const {repo,rpc}=setup(r);expect(await repo.attachmentCommand(c)).toEqual(r);
 expect(rpc).toHaveBeenCalledWith('paperwork_attachment_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey});
 await expect(setup({...r,targetId:id(9)}).repo.attachmentCommand(c)).rejects.toMatchObject({code:'invalid_response'});
 await expect(repo.attachmentCommand({...c,data:{...c.data,bytes:'10485761'}})).rejects.toMatchObject({code:'invalid_journal'});
 expect(rpc).toHaveBeenCalledTimes(1);
});
it('rejects attachment workspaces with inconsistent targets, duplicate records or withdrawal status',async()=>{
 const a={id:id(1),name:'source.pdf',bytes:'3',sha256:'a'.repeat(64),externalReference:'Archive',targetRevision:'1',registeredAt:'2026-01-01T00:00:00+00:00',registeredBy:id(8),status:'externally_retained',reason:null};
 const w={firmId:id(2),targetType:'document' as const,targetId:id(3),attachments:[a]};
 expect(await setup(w).repo.attachments(id(2),'document',id(3))).toEqual(w);
 for(const invalid of [{...w,firmId:id(9)},{...w,attachments:[a,a]},{...w,attachments:[{...a,targetRevision:null}]},{...w,attachments:[{...a,status:'withdrawn'}]},{...w,attachments:[{...a,bytes:3}]}])await expect(setup(invalid).repo.attachments(id(2),'document',id(3))).rejects.toMatchObject({code:'invalid_response'});
});

it('keeps exact money and the original idempotency key on the wire', async () => {
  const { rpc, repo } = setup();
  expect(await repo.post(command)).toEqual({ ok: true, receipt });
  expect(rpc).toHaveBeenCalledWith('paperwork_post_journal', { p_draft: command.draft, p_expected: '0', p_key: 'request' });
});
it.each([['ACCOUNTING_FORBIDDEN','forbidden'],['STALE_REVISION','stale_revision'],['CLOSED_PERIOD','closed_period'],['IDEMPOTENCY_REUSE','idempotency_reuse']])('maps %s without retrying the financial command', async (message, code) => {
  const { repo, rpc } = setup(null, { code: 'P0001', message });
  expect(await repo.post(command)).toEqual({ ok: false, code });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('rejects a receipt for another firm and a malformed command', async () => {
  const { repo, rpc } = setup({ ...receipt, firmId: id(9) });
  expect(await repo.post(command)).toEqual({ ok: false, code: 'unavailable' });
  expect(await repo.post({ ...command, expectedRevision: 'invalid' })).toEqual({ ok: false, code: 'invalid_journal' });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('reads exact amounts and refuses JSON numbers from an incompatible server', async () => {
  const result = { receipt, draft: command.draft, reversalOf: null, reason: null };
  expect((await setup(result).repo.read(id(2),id(1)))?.draft.lines[0].debit).toBe('900719925474099301');
  const malformed = { ...result, draft: { ...command.draft, lines: command.draft.lines.map(line => ({ ...line, debit: 1 })) } };
  await expect(setup(malformed).repo.read(id(2),id(1))).rejects.toMatchObject({ code: 'invalid_response' });
});

it('saves an empty draft with a stable key and checks its server receipt', async () => {
  const draft = { ...command.draft, lines: [] };
  const result = { firmId: id(2), draftId: id(1), revision: '1', savedBy: id(7), savedAt: receipt.postedAt };
  const { repo, rpc } = setup(result);
  expect(await repo.saveDraft({ draft, expectedRevision: '0', idempotencyKey: 'save-request' })).toEqual(result);
  expect(rpc).toHaveBeenCalledWith('paperwork_save_journal_draft', { p_draft: draft, p_expected: '0', p_key: 'save-request' });
  await expect(setup({ ...result, firmId: id(9) }).repo.saveDraft({ draft, expectedRevision: '0', idempotencyKey: 'save-request' })).rejects.toMatchObject({ code: 'invalid_response' });
});
it('rejects malformed inputs consistently before sending any RPC', async () => {
  const { repo, rpc } = setup();
  await expect(repo.read('invalid', id(1))).rejects.toMatchObject({ code: 'invalid_journal' });
  await expect(repo.readDraft(id(2), 'invalid')).rejects.toMatchObject({ code: 'invalid_journal' });
  await expect(repo.saveDraft({ draft: command.draft, expectedRevision: '-1', idempotencyKey: 'request' })).rejects.toMatchObject({ code: 'invalid_journal' });
  await expect(repo.setAgencyConsent({ firmId: id(2), agencyId: 'invalid', capability: 'read', enabled: true })).rejects.toMatchObject({ code: 'invalid_journal' });
  expect(rpc).not.toHaveBeenCalled();
});
it('distinguishes a missing draft from an invalid or cross-firm response', async () => {
  expect(await setup(null).repo.readDraft(id(2),id(1))).toBeNull();
  const saved = { draft: command.draft, revision: '4', status: 'draft', savedBy: id(7), savedAt: receipt.postedAt };
  expect(await setup(saved).repo.readDraft(id(2),id(1))).toEqual(saved);
  await expect(setup(saved).repo.readDraft(id(9),id(1))).rejects.toMatchObject({ code: 'invalid_response' });
  await expect(setup({ ...saved, revision: 4 }).repo.readDraft(id(2),id(1))).rejects.toMatchObject({ code: 'invalid_response' });
});
it('sends agency consent and staff assignment as separate commands', async () => {
  const { repo, rpc } = setup(null);
  await repo.setAgencyConsent({ firmId: id(2), agencyId: id(8), capability: 'post_journal', enabled: true });
  await repo.setAgencyAssignment({ firmId: id(2), agencyId: id(8), userId: id(7), capability: 'read', enabled: false });
  expect(rpc.mock.calls).toEqual([
    ['paperwork_set_agency_consent', { p_firm: id(2), p_agency: id(8), p_capability: 'post_journal', p_enabled: true }],
    ['paperwork_set_agency_assignment', { p_firm: id(2), p_agency: id(8), p_user: id(7), p_capability: 'read', p_enabled: false }]
  ]);
});

it('rejects a workspace for a different firm or year', async () => {
  const workspace = { firmId:id(2),yearId:id(3),capabilities:[],years:[],periods:[],accounts:[],partners:[],drafts:[],journals:[] };
  expect(await setup(workspace).repo.workspace(id(2),id(3))).toEqual(workspace);
  await expect(setup(workspace).repo.workspace(id(9),id(3))).rejects.toMatchObject({ code:'invalid_response' });
  await expect(setup(workspace).repo.workspace(id(2),id(9))).rejects.toMatchObject({ code:'invalid_response' });
});

it('rejects document acknowledgements for another document or action', async () => {
  const request = { action:'approve' as const,data:{ firmId:id(2),id:id(8) },expectedRevision:'1',idempotencyKey:'document-request' };
  const acknowledged = { firmId:id(2),documentId:id(8),revision:'2',action:'approve' };
  const {repo,rpc} = setup(acknowledged);
  expect(await repo.documentCommand(request)).toEqual(acknowledged);
  expect(rpc).toHaveBeenCalledWith('paperwork_business_document_command',{ p_action:'approve',p_data:request.data,p_expected:'1',p_key:'document-request' });
  await expect(setup({...acknowledged,documentId:id(9)}).repo.documentCommand(request)).rejects.toMatchObject({code:'invalid_response'});
  await expect(setup({...acknowledged,action:'issue'}).repo.documentCommand(request)).rejects.toMatchObject({code:'invalid_response'});
});

it('preserves source revisions and refuses malformed source input before RPC', async () => {
  const {repo,rpc} = setup();
  expect(await repo.postDocument(id(8),'2',command)).toEqual({ok:true,receipt});
  expect(rpc).toHaveBeenCalledWith('paperwork_post_document_journal',{ p_document:id(8),p_document_expected:'2',p_draft:command.draft,p_expected:'0',p_key:'request' });
  rpc.mockClear();
  expect(await repo.postDocument(id(8),'0',command)).toEqual({ok:false,code:'invalid_journal'});
  expect(rpc).not.toHaveBeenCalled();
  expect(await setup({...receipt,firmId:id(9)}).repo.postDocument(id(8),'2',command)).toEqual({ok:false,code:'unavailable'});
});

it('refuses mismatched advance receipts and preserves cancellation reason/key',async()=>{
 const request={action:'cancel' as const,idempotencyKey:'cancel-advance',data:{firmId:id(2),id:id(8),expectedRevision:'1' as const,periodId:id(4),postingDate:'2026-01-16',reason:'Incorrect allocation'}};
 const acknowledged={firmId:id(2),applicationId:id(8),revision:'2',journalId:id(9)};
 const {repo,rpc}=setup(acknowledged);
 expect(await repo.advanceCommand(request)).toEqual(acknowledged);
 expect(rpc).toHaveBeenCalledWith('paperwork_advance_command',{p_action:'cancel',p_data:request.data,p_key:'cancel-advance'});
 for(const patch of [{firmId:id(7)},{applicationId:id(7)},{revision:'1'}])await expect(setup({...acknowledged,...patch}).repo.advanceCommand(request)).rejects.toMatchObject({code:'invalid_response'});
});

it('refuses advance workspaces for another invoice and invalid remaining amounts',async()=>{
 const data={firmId:id(2),invoiceId:id(8),remainingNet:'900719925474099301',remainingTax:'0',advances:[],applications:[]};
 expect(await setup(data).repo.advances(id(2),id(8))).toEqual(data);
 await expect(setup({...data,invoiceId:id(9)}).repo.advances(id(2),id(8))).rejects.toMatchObject({code:'invalid_response'});
 await expect(setup({...data,remainingNet:100}).repo.advances(id(2),id(8))).rejects.toMatchObject({code:'invalid_response'});
});

it('reads PostgreSQL reversal identifiers with non-RFC version bits',async()=>{
 const reversedId='abcdef01-2345-f678-0123-456789abcdef';
 const posted={receipt:{...receipt,journalId:reversedId},draft:{...command.draft,id:reversedId},reversalOf:id(1),reason:'Test reversal'};
 expect(await setup(posted).repo.read(id(2),reversedId)).toEqual(posted);
 const workspace={firmId:id(2),yearId:id(3),capabilities:[],years:[],periods:[],accounts:[],partners:[],drafts:[],journals:[{id:reversedId,number:'2026/000002',postingDate:'2026-01-16',description:'Reversal'}]};
 expect(await setup(workspace).repo.workspace(id(2),id(3))).toEqual(workspace);
});

it('accepts the existing PostgreSQL reversal ID in a cancellation receipt',async()=>{
 const acknowledged={firmId:id(2),applicationId:id(8),revision:'2',journalId:'abcdef01-2345-f678-0123-456789abcdef'};
 expect(await setup(acknowledged).repo.advanceCommand({action:'cancel',idempotencyKey:'cancel-existing-id',data:{firmId:id(2),id:id(8),expectedRevision:'1',periodId:id(4),postingDate:'2026-01-16',reason:'Test'}})).toEqual(acknowledged);
});

it('checks bank receipt scope/counts and preserves the import key',async()=>{
 const request={data:{firmId:id(2),bankAccountId:id(8),fiscalYearId:id(3),reference:'2026-001',startsOn:'2026-01-01',endsOn:'2026-01-31',opening:'0',closing:'10001',rows:[{externalId:'BANK-1',bookingDate:'2026-01-01',valueDate:'2026-01-02',incoming:'10001',outgoing:'0',counterparty:'Buyer',reference:'0001',description:'Source'}]},idempotencyKey:'bank-import'};
 const acknowledged={firmId:id(2),accountId:id(8),statementId:id(9),newCount:1,reusedCount:0,previouslyImported:false};const {repo,rpc}=setup(acknowledged);
 expect(await repo.importBankStatement(request)).toEqual(acknowledged);expect(rpc).toHaveBeenCalledWith('paperwork_import_bank_statement',{p_data:request.data,p_key:'bank-import'});
 for(const patch of [{firmId:id(7)},{accountId:id(7)},{newCount:0},{previouslyImported:true}])await expect(setup({...acknowledged,...patch}).repo.importBankStatement(request)).rejects.toMatchObject({code:'invalid_response'});
});

it('refuses cross-year bank workspace and unbalanced read responses',async()=>{
 const workspace={firmId:id(2),yearId:id(3),accounts:[],statements:[]};expect(await setup(workspace).repo.bankWorkspace(id(2),id(3))).toEqual(workspace);
 await expect(setup({...workspace,yearId:id(4)}).repo.bankWorkspace(id(2),id(3))).rejects.toMatchObject({code:'invalid_response'});
 await expect(setup({firmId:id(2),statementId:id(9),accountId:id(8),yearId:id(3),reference:'2026-001',startsOn:'2026-01-01',endsOn:'2026-01-31',opening:'0',closing:'2',rows:[{id:id(10),externalId:'BANK-1',bookingDate:'2026-01-01',valueDate:'2026-01-01',incoming:'1',outgoing:'0',counterparty:'',reference:'',description:''}]}).repo.readBankStatement(id(2),id(9),id(3),id(8))).rejects.toMatchObject({code:'invalid_response'});
});

it('checks payment receipt identities and preserves the cancellation command/key',async()=>{
 const request={action:'cancel' as const,idempotencyKey:'payment-cancel',data:{firmId:id(2),id:id(8),transactionId:id(9),documentId:id(10),expectedRevision:'1' as const,reason:'Incorrect match'}};
 const acknowledged={firmId:id(2),allocationId:id(8),transactionId:id(9),documentId:id(10),revision:'2'};
 const {repo,rpc}=setup(acknowledged);expect(await repo.paymentCommand(request)).toEqual(acknowledged);
 expect(rpc).toHaveBeenCalledWith('paperwork_payment_command',{p_action:'cancel',p_data:request.data,p_key:'payment-cancel'});
 for(const patch of [{firmId:id(7)},{allocationId:id(7)},{transactionId:id(7)},{documentId:id(7)},{revision:'1'}])await expect(setup({...acknowledged,...patch}).repo.paymentCommand(request)).rejects.toMatchObject({code:'invalid_response'});
});

it('rejects payment workspace scope or inconsistent remaining bank amounts',async()=>{
 const workspace={firmId:id(2),transaction:{id:id(9),accountId:id(8),externalId:'BANK-1',bookingDate:'2026-01-01',incoming:'100',outgoing:'0',available:'100'},documents:[],allocations:[],refundablePayments:[{id:id(11),documentId:id(10),number:'INV-1',externalId:'BANK-ORIGINAL',bookingDate:'2026-01-01',available:'50'}]};
 expect(await setup(workspace).repo.paymentWorkspace(id(2),id(9),id(8))).toEqual(workspace);
 for(const patch of [{accountId:id(7)},{id:id(7)},{available:'50'}])await expect(setup({...workspace,transaction:{...workspace.transaction,...patch}}).repo.paymentWorkspace(id(2),id(9),id(8))).rejects.toMatchObject({code:'invalid_response'});
});
it('checks bank ledger receipt scope and sends exactly the original posting key',async()=>{
 const request={action:'bank' as const,idempotencyKey:'bank-ledger',data:{firmId:id(2),transactionId:id(8),journalId:id(9),fiscalYearId:id(3),periodId:id(4),postingDate:'2026-01-10',bankAccountId:id(5),clearingAccountId:id(6)}};
 const receipt={firmId:id(2),transactionId:id(8),allocationId:null,journalId:id(9)};const {repo,rpc}=setup(receipt);
 expect(await repo.postPaymentLedger(request)).toEqual(receipt);expect(rpc).toHaveBeenCalledWith('paperwork_payment_ledger_command',{p_action:'bank',p_data:request.data,p_key:'bank-ledger'});
 for(const patch of [{firmId:id(7)},{transactionId:id(7)},{journalId:id(7)},{allocationId:id(7)}])await expect(setup({...receipt,...patch}).repo.postPaymentLedger(request)).rejects.toMatchObject({code:'invalid_response'});
});
it('refuses payment ledger workspace from another bank transaction',async()=>{
 const workspace={firmId:id(2),transactionId:id(8),bank:null,allocations:[]};expect(await setup(workspace).repo.paymentLedger(id(2),id(8))).toEqual(workspace);
 await expect(setup({...workspace,transactionId:id(9)}).repo.paymentLedger(id(2),id(8))).rejects.toMatchObject({code:'invalid_response'});
});
it('validates the atomic payment workbench against bank scope and posted allocation totals',async()=>{
 const reconciliation={firmId:id(2),transaction:{id:id(8),accountId:id(6),externalId:'BANK-1',bookingDate:'2026-01-01',incoming:'100',outgoing:'0',available:'100'},documents:[],allocations:[],refundablePayments:[]};
 const ledger={firmId:id(2),transactionId:id(8),bank:{journalId:id(9),bankAccountId:id(5),clearingAccountId:id(7),reversed:false,clearingRemaining:'100'},allocations:[]};
 const value={reconciliation,ledger};expect(await setup(value).repo.paymentWorkbench(id(2),id(8),id(6))).toEqual(value);
 for(const patch of [{firmId:id(1)},{bank:{...ledger.bank,clearingRemaining:'101'}},{bank:{...ledger.bank,clearingRemaining:'50'}}])await expect(setup({...value,ledger:{...ledger,...patch}}).repo.paymentWorkbench(id(2),id(8),id(6))).rejects.toMatchObject({code:'invalid_response'});
});
