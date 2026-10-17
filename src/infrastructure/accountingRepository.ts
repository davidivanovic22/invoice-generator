import { accountingUuid } from '../domain/accounting/identifiers';
import {taxCommandSchema,taxReceiptSchema,taxWorkspaceSchema,verifyTaxWorkspace,type TaxCommand} from '../domain/accounting/taxEvidence';
import { openingCommandSchema,openingReceiptSchema,openingWorkspaceSchema,verifyOpeningWorkspace,type OpeningCommand } from '../domain/accounting/opening';
import { stockCommandSchema,stockReceiptSchema,stockWorkspaceSchema,verifyStockWorkspace,type StockCommand } from '../domain/accounting/inventory';
import { fxBankPostingCommandSchema,fxBankPostingReceiptSchema,fxBankWorkbenchSchema,verifyFxBankWorkbench,type FxBankPostingCommand } from '../domain/accounting/fxBankPosting';
import { fxBankAccountCommandSchema,fxBankAccountReceiptSchema,fxBankImportCommandSchema,fxBankImportReceiptSchema,fxBankWorkspaceSchema,fxBankReadSchema,fxBankLinkCommandSchema,fxBankLinkReceiptSchema,type FxBankAccountCommand,type FxBankImportCommand,type FxBankLinkCommand } from '../domain/accounting/fxBank';
import { fxCommandSchema,fxReceiptSchema,fxWorkspaceSchema,verifyFxWorkspace,type FxCommand } from '../domain/accounting/fx';
import { partnerReportQuerySchema,partnerReportSchema,verifyPartnerReport,type PartnerReportQuery } from '../domain/accounting/partnerReports';
import { accountingReportSchema,reportQuerySchema,verifyReport,type ReportQuery } from '../domain/accounting/reports';
import { attachmentCommandSchema,attachmentReceiptSchema,attachmentWorkspaceSchema,attachmentTarget,type AttachmentCommand,type AttachmentTarget } from '../domain/accounting/attachments';
import { paymentLedgerCommandSchema,paymentLedgerReceiptSchema,paymentLedgerWorkspaceSchema,type PaymentLedgerCommand } from '../domain/accounting/paymentLedger';
import { paymentCommandSchema,paymentReceiptSchema,paymentWorkspaceSchema,type PaymentCommand } from '../domain/accounting/payments';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { bankAccountCommandSchema,bankAccountReceiptSchema,bankImportCommandSchema,bankImportReceiptSchema,bankReadSchema,bankWorkspaceSchema,type BankAccountCommand,type BankImportCommand } from '../domain/accounting/bank';
import { advanceCommandSchema,advanceReceiptSchema,advanceWorkspaceSchema,type AdvanceCommand } from '../domain/accounting/advances';
import { businessDocumentReadSchema, documentCommandSchema, documentReceiptSchema, type DocumentCommand } from '../domain/accounting/documents';
import { accountingFirmsSchema, workspaceSchema } from '../domain/accounting/commands';
import { saveDraftSchema, draftReceiptSchema, savedDraftSchema, agencyConsentSchema, agencyAssignmentSchema, agencyMemberSchema, createAgencySchema,
  type SaveDraftCommand, type AgencyConsentCommand, type AgencyAssignmentCommand } from '../domain/accounting/commands';
import type { JournalRepository, PostJournalCommand, PostingResult } from '../domain/accounting/journal';
import { accountingEntitySchema, permissionSchema, periodStatusSchema, postJournalSchema, readJournalSchema, receiptSchema, reverseJournalSchema,
  type AccountingEntityCommand, type PeriodStatusCommand, type PermissionCommand, type PostedJournal, type ReverseJournalCommand } from '../domain/accounting/commands';

export class AccountingError extends Error {
  constructor(public readonly code: 'forbidden' | 'stale_revision' | 'closed_period' | 'invalid_journal' | 'duplicate_source' | 'idempotency_reuse' | 'unavailable' | 'invalid_response') { super(code); }
}
const failure = (error: unknown): AccountingError => {
  const value = error as { message?: string; code?: string } | null;
  const message = value?.message || '';
  if (message.includes('ACCOUNTING_FORBIDDEN') || value?.code === '42501') return new AccountingError('forbidden');
  if (message.includes('STALE_REVISION')) return new AccountingError('stale_revision');
  if (message.includes('CLOSED_PERIOD')) return new AccountingError('closed_period');
  if (message.includes('IDEMPOTENCY_REUSE')) return new AccountingError('idempotency_reuse');
  if (message.includes('DUPLICATE_SOURCE')) return new AccountingError('duplicate_source');
  if (value?.code === '23505') return new AccountingError('duplicate_source');
  if (value?.code?.startsWith('22') || value?.code?.startsWith('23') || value?.code === 'P0001' || value?.code === 'P0002') return new AccountingError('invalid_journal');
  return new AccountingError('unavailable');
};
const parse = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) throw new AccountingError('invalid_response');
  return result.data;
};
const input = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) throw new AccountingError('invalid_journal');
  return result.data;
};

/** Database-mode adapter only. Never saves ledger state to browser storage or retries blindly. */
export class SupabaseAccountingRepository implements JournalRepository {
  async taxWorkspace(firmId:string,yearId:string) {
    input(accountingUuid,firmId);input(accountingUuid,yearId);
    const r=parse(taxWorkspaceSchema,await this.rpc('paperwork_tax_workspace',{p_firm:firmId,p_year:yearId}));
    if(!verifyTaxWorkspace(r,firmId,yearId))throw new AccountingError('invalid_response');return r;
  }
  async taxCommand(command:TaxCommand) {
    const c=input(taxCommandSchema,command),r=parse(taxReceiptSchema,await this.rpc('paperwork_tax_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.id!==c.data.id||r.action!==c.action||r.revision!==(BigInt(c.data.expectedRevision)+BigInt(1)).toString())throw new AccountingError('invalid_response');return r;
  }
  async openingWorkspace(firmId:string) {
    input(accountingUuid,firmId);const r=parse(openingWorkspaceSchema,await this.rpc('paperwork_opening_workspace',{p_firm:firmId}));
    if(!verifyOpeningWorkspace(r,firmId))throw new AccountingError('invalid_response');return r;
  }
  async openingCommand(command:OpeningCommand) {
    const c=input(openingCommandSchema,command),r=parse(openingReceiptSchema,await this.rpc('paperwork_opening_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.batchId!==c.data.batchId||r.revision!==(BigInt(c.data.expectedRevision)+BigInt(1)).toString()||(c.action==='apply'?(r.itemId!==c.data.itemId||r.applicationId!==c.data.applicationId||r.journalId!==c.data.journalId):(r.itemId!==null||r.applicationId!==null))||(c.action==='import'&&r.journalId!==c.data.journalId))throw new AccountingError('invalid_response');return r;
  }
  async stockWorkspace(firmId:string) {
    input(accountingUuid,firmId);
    const r=parse(stockWorkspaceSchema,await this.rpc('paperwork_stock_workspace',{p_firm:firmId}));
    if(!verifyStockWorkspace(r,firmId))throw new AccountingError('invalid_response');return r;
  }
  async stockCommand(command:StockCommand) {
    const c=input(stockCommandSchema,command),r=parse(stockReceiptSchema,await this.rpc('paperwork_stock_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.itemId!==c.data.itemId||r.revision!==(BigInt(c.data.expectedRevision)+BigInt(1)).toString()||(c.action==='create'?r.journalId!==null:!r.journalId)||('journalId' in c.data&&r.journalId!==c.data.journalId))throw new AccountingError('invalid_response');return r;
  }
  async fxBankWorkbench(firmId:string,transactionId:string) {
    input(accountingUuid,firmId);input(accountingUuid,transactionId);
    const r=parse(fxBankWorkbenchSchema,await this.rpc('paperwork_fx_bank_workbench',{p_firm:firmId,p_transaction:transactionId}));
    if(!verifyFxBankWorkbench(r,firmId,transactionId))throw new AccountingError('invalid_response');return r;
  }
  async fxBankPostingCommand(command:FxBankPostingCommand) {
    const c=input(fxBankPostingCommandSchema,command),r=parse(fxBankPostingReceiptSchema,await this.rpc('paperwork_fx_bank_posting_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.transactionId!==c.data.transactionId||r.revision!==(BigInt(c.data.expectedRevision)+BigInt(1)).toString()||('journalId' in c.data&&r.journalId!==c.data.journalId))throw new AccountingError('invalid_response');return r;
  }
  async fxBankWorkspace(firmId:string,yearId:string) {
    input(accountingUuid,firmId);input(accountingUuid,yearId);
    const r=parse(fxBankWorkspaceSchema,await this.rpc('paperwork_fx_bank_workspace',{p_firm:firmId,p_year:yearId}));
    if(r.firmId!==firmId||r.yearId!==yearId||new Set(r.accounts.map(a=>a.id)).size!==r.accounts.length||new Set(r.statements.map(s=>s.id)).size!==r.statements.length||r.statements.some(s=>!r.accounts.some(a=>a.id===s.accountId)))throw new AccountingError('invalid_response');return r;
  }
  async createFxBankAccount(command:FxBankAccountCommand) {
    const c=input(fxBankAccountCommandSchema,command),r=parse(fxBankAccountReceiptSchema,await this.rpc('paperwork_create_fx_bank_account',{p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.accountId!==c.data.id)throw new AccountingError('invalid_response');return r;
  }
  async importFxBankStatement(command:FxBankImportCommand) {
    const c=input(fxBankImportCommandSchema,command),r=parse(fxBankImportReceiptSchema,await this.rpc('paperwork_import_fx_bank_statement',{p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.accountId!==c.data.bankAccountId||r.newCount+r.reusedCount!==c.data.rows.length||(r.previouslyImported&&r.newCount!==0))throw new AccountingError('invalid_response');return r;
  }
  async readFxBankStatement(firmId:string,statementId:string,yearId:string,accountId:string) {
    [firmId,statementId,yearId,accountId].forEach(v=>input(accountingUuid,v));
    const r=parse(fxBankReadSchema,await this.rpc('paperwork_fx_bank_reconciliation',{p_firm:firmId,p_statement:statementId}));
    if(r.firmId!==firmId||r.statementId!==statementId||r.yearId!==yearId||r.accountId!==accountId)throw new AccountingError('invalid_response');return r;
  }
  async linkFxBankPayment(command:FxBankLinkCommand) {
    const c=input(fxBankLinkCommandSchema,command),r=parse(fxBankLinkReceiptSchema,await this.rpc('paperwork_link_fx_bank_payment',{p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.transactionId!==c.data.transactionId||r.settlementId!==c.data.settlementId)throw new AccountingError('invalid_response');return r;
  }
  async fxWorkspace(firmId:string) {
    input(accountingUuid,firmId);const value=parse(fxWorkspaceSchema,await this.rpc('paperwork_fx_workspace',{p_firm:firmId}));
    if(!verifyFxWorkspace(value,firmId))throw new AccountingError('invalid_response');return value;
  }
  async fxCommand(command:FxCommand) {
    const c=input(fxCommandSchema,command),r=parse(fxReceiptSchema,await this.rpc('paperwork_fx_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(r.firmId!==c.data.firmId||r.positionId!==c.data.id||r.revision!==(BigInt(c.data.expectedRevision)+BigInt(1)).toString()||(('journalId' in c.data)&&r.journalId!==c.data.journalId))throw new AccountingError('invalid_response');return r;
  }
  async partnerReport(query:PartnerReportQuery) {
    const q=input(partnerReportQuerySchema,query);
    const value=parse(partnerReportSchema,await this.rpc('paperwork_partner_report',{p_firm:q.firmId,p_partner:q.partnerId}));
    if(!verifyPartnerReport(value,q))throw new AccountingError('invalid_response');
    return value;
  }
  async report(query:ReportQuery) {
    const q=input(reportQuerySchema,query);
    const value=parse(accountingReportSchema,await this.rpc('paperwork_accounting_report',{p_firm:q.firmId,p_year:q.yearId,p_from:q.from,p_to:q.to}));
    if(!verifyReport(value,q))throw new AccountingError('invalid_response');
    return value;
  }
  async attachments(firmId:string,targetType:AttachmentTarget,targetId:string) {
    input(accountingUuid,firmId);input(accountingUuid,targetId);input(attachmentTarget,targetType);
    const value=parse(attachmentWorkspaceSchema,await this.rpc('paperwork_attachment_workspace',{p_firm:firmId,p_type:targetType,p_target:targetId}));
    if(value.firmId!==firmId||value.targetType!==targetType||value.targetId!==targetId)throw new AccountingError('invalid_response');
    return value;
  }
  async attachmentCommand(command:AttachmentCommand) {
    const c=input(attachmentCommandSchema,command);
    const value=parse(attachmentReceiptSchema,await this.rpc('paperwork_attachment_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(value.firmId!==c.data.firmId||value.attachmentId!==c.data.id||value.targetType!==c.data.targetType||value.targetId!==c.data.targetId||value.revision!==(c.action==='register'?'1':'2'))throw new AccountingError('invalid_response');
    return value;
  }
  constructor(private readonly client: SupabaseClient) {}
  async paymentWorkbench(firmId:string,transactionId:string,accountId:string) {
    [firmId,transactionId,accountId].forEach(value=>input(accountingUuid,value));
    const result=parse(z.object({reconciliation:paymentWorkspaceSchema,ledger:paymentLedgerWorkspaceSchema}).strict(),await this.rpc('paperwork_payment_workbench',{p_firm:firmId,p_transaction:transactionId}));
    const {reconciliation:r,ledger:l}=result;
    if(r.firmId!==firmId||r.transaction.id!==transactionId||r.transaction.accountId!==accountId||l.firmId!==firmId||l.transactionId!==transactionId||
      (l.bank&&!l.bank.reversed&&BigInt(l.bank.clearingRemaining)<BigInt(r.transaction.available))||
      l.allocations.some(a=>{const evidence=r.allocations.find(e=>e.id===a.id);return !evidence||(evidence.status==='active')!==(a.reversalId===null);}))throw new AccountingError('invalid_response');
    const posted=r.allocations.filter(a=>a.status==='active'&&l.allocations.some(link=>link.id===a.id)).reduce((sum,a)=>sum+BigInt(a.amount),BigInt(0));
    if((!l.bank&&l.allocations.length>0)||(l.bank&&(l.bank.bankAccountId===l.bank.clearingAccountId||BigInt(l.bank.clearingRemaining)!==BigInt(r.transaction.incoming)+BigInt(r.transaction.outgoing)-posted)))throw new AccountingError('invalid_response');
    return result;
  }
  async paymentLedger(firmId:string,transactionId:string) {
    [firmId,transactionId].forEach(value=>input(accountingUuid,value));
    const result=parse(paymentLedgerWorkspaceSchema,await this.rpc('paperwork_payment_ledger_workspace',{p_firm:firmId,p_transaction:transactionId}));
    if(result.firmId!==firmId||result.transactionId!==transactionId)throw new AccountingError('invalid_response');
    return result;
  }
  async postPaymentLedger(command:PaymentLedgerCommand) {
    const c=input(paymentLedgerCommandSchema,command);
    const result=parse(paymentLedgerReceiptSchema,await this.rpc('paperwork_payment_ledger_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(result.firmId!==c.data.firmId||result.transactionId!==c.data.transactionId||result.journalId!==c.data.journalId||result.allocationId!==(c.action==='allocation'?c.data.allocationId:null))throw new AccountingError('invalid_response');
    return result;
  }
  async paymentWorkspace(firmId:string,transactionId:string,accountId:string) {
    [firmId,transactionId,accountId].forEach(value=>input(accountingUuid,value));
    const result=parse(paymentWorkspaceSchema,await this.rpc('paperwork_payment_workspace',{p_firm:firmId,p_transaction:transactionId}));
    if(result.firmId!==firmId||result.transaction.id!==transactionId||result.transaction.accountId!==accountId)throw new AccountingError('invalid_response');
    return result;
  }
  async paymentCommand(command:PaymentCommand) {
    const c=input(paymentCommandSchema,command);
    const result=parse(paymentReceiptSchema,await this.rpc('paperwork_payment_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(result.firmId!==c.data.firmId||result.allocationId!==c.data.id||result.revision!==(c.action==='allocate'?'1':'2') ||
      result.transactionId!==c.data.transactionId||result.documentId!==c.data.documentId)throw new AccountingError('invalid_response');
    return result;
  }
  async bankWorkspace(firmId:string,yearId:string) {
    input(accountingUuid,firmId);input(accountingUuid,yearId);
    const result=parse(bankWorkspaceSchema,await this.rpc('paperwork_bank_workspace',{p_firm:firmId,p_year:yearId}));
    if(result.firmId!==firmId||result.yearId!==yearId||result.statements.some(s=>!result.accounts.some(a=>a.id===s.accountId)))throw new AccountingError('invalid_response');
    return result;
  }
  async createBankAccount(command:BankAccountCommand) {
    const c=input(bankAccountCommandSchema,command);
    const result=parse(bankAccountReceiptSchema,await this.rpc('paperwork_create_bank_account',{p_data:c.data,p_key:c.idempotencyKey}));
    if(result.firmId!==c.data.firmId||result.accountId!==c.data.id)throw new AccountingError('invalid_response');return result;
  }
  async importBankStatement(command:BankImportCommand) {
    const c=input(bankImportCommandSchema,command);
    const result=parse(bankImportReceiptSchema,await this.rpc('paperwork_import_bank_statement',{p_data:c.data,p_key:c.idempotencyKey}));
    if(result.firmId!==c.data.firmId||result.accountId!==c.data.bankAccountId||result.newCount+result.reusedCount!==c.data.rows.length||(result.previouslyImported&&result.newCount!==0))throw new AccountingError('invalid_response');return result;
  }
  async readBankStatement(firmId:string,statementId:string,yearId:string,accountId:string) {
    [firmId,statementId,yearId,accountId].forEach(value=>input(accountingUuid,value));
    const result=parse(bankReadSchema,await this.rpc('paperwork_read_bank_statement',{p_firm:firmId,p_statement:statementId}));
    if(result.firmId!==firmId||result.statementId!==statementId||result.yearId!==yearId||result.accountId!==accountId)throw new AccountingError('invalid_response');return result;
  }
  async advances(firmId:string,invoiceId:string) {
    input(accountingUuid,firmId);input(accountingUuid,invoiceId);
    const result=parse(advanceWorkspaceSchema,await this.rpc('paperwork_advance_workspace',{p_firm:firmId,p_invoice:invoiceId}));
    if(result.firmId!==firmId||result.invoiceId!==invoiceId||result.advances.some(a=>a.source.document.firmId!==firmId||a.source.document.kind!=='advance'||a.source.lifecycle!=='issued'))throw new AccountingError('invalid_response');
    return result;
  }
  async advanceCommand(command:AdvanceCommand) {
    const c=input(advanceCommandSchema,command);
    const result=parse(advanceReceiptSchema,await this.rpc('paperwork_advance_command',{p_action:c.action,p_data:c.data,p_key:c.idempotencyKey}));
    if(result.firmId!==c.data.firmId||result.applicationId!==c.data.id||result.revision!==(c.action==='apply'?'1':'2')||(c.action==='apply'&&result.journalId!==c.data.id))throw new AccountingError('invalid_response');
    return result;
  }
  async documents(firmId: string,yearId: string) {
    input(accountingUuid,firmId); input(accountingUuid,yearId);
    const result=parse(z.array(businessDocumentReadSchema),await this.rpc('paperwork_list_business_documents',{p_firm:firmId,p_year:yearId}));
    if (result.some(d => d.document.firmId!==firmId)) throw new AccountingError('invalid_response');
    return result;
  }
  async documentCommand(command: DocumentCommand) {
    const c=input(documentCommandSchema,command);
    const receipt=parse(documentReceiptSchema,await this.rpc('paperwork_business_document_command',{p_action:c.action,p_data:c.data,p_expected:c.expectedRevision,p_key:c.idempotencyKey}));
    if (receipt.firmId!==c.data.firmId || receipt.documentId!==c.data.id || receipt.action!==c.action) throw new AccountingError('invalid_response');
    return receipt;
  }
  async postDocument(documentId: string,documentRevision: string,command: PostJournalCommand): Promise<PostingResult> {
    try {
      input(accountingUuid,documentId);input(z.string().regex(/^[1-9]\d*$/),documentRevision);const c=input(postJournalSchema,command);
      const receipt=parse(receiptSchema,await this.rpc('paperwork_post_document_journal',{p_document:documentId,p_document_expected:documentRevision,p_draft:c.draft,p_expected:c.expectedRevision,p_key:c.idempotencyKey}));
      if (receipt.firmId!==c.draft.firmId || receipt.journalId!==c.draft.id) throw new AccountingError('invalid_response');
      return {ok:true,receipt};
    } catch(e) {const code=e instanceof AccountingError ? e.code:'unavailable';return {ok:false,code:code==='invalid_response'?'unavailable':code};}
  }
  async firms() { return parse(accountingFirmsSchema, await this.rpc('paperwork_accounting_firms', {})); }
  async workspace(firmId: string, yearId: string | null) {
    input(accountingUuid, firmId); if (yearId !== null) input(accountingUuid, yearId);
    const result = parse(workspaceSchema, await this.rpc('paperwork_accounting_workspace', { p_firm: firmId, p_year: yearId }));
    if (result.firmId !== firmId || result.yearId !== yearId) throw new AccountingError('invalid_response');
    return result;
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const result = await this.client.rpc(name, args);
      if (result.error) throw failure(result.error);
      return result.data;
    } catch (error) { throw error instanceof AccountingError ? error : failure(error); }
  }
  async post(command: PostJournalCommand): Promise<PostingResult> {
    const checked = postJournalSchema.safeParse(command);
    if (!checked.success) return { ok: false, code: 'invalid_journal' };
    try {
      const c = checked.data;
      const receipt = parse(receiptSchema, await this.rpc('paperwork_post_journal', { p_draft: c.draft, p_expected: c.expectedRevision, p_key: c.idempotencyKey }));
      if (receipt.firmId !== c.draft.firmId || receipt.journalId !== c.draft.id) throw new AccountingError('invalid_response');
      return { ok: true, receipt };
    } catch (error) {
      const code = (error as AccountingError).code;
      return { ok: false, code: code === 'invalid_response' ? 'unavailable' : code };
    }
  }
  async read(firmId: string, journalId: string): Promise<PostedJournal | null> {
    input(accountingUuid, firmId); input(accountingUuid, journalId);
    const result = await this.rpc('paperwork_read_journal', { p_firm: firmId, p_journal: journalId });
    if (result === null) return null;
    const journal = parse(readJournalSchema, result);
    if (journal.receipt.firmId !== firmId || journal.receipt.journalId !== journalId || journal.draft.firmId !== firmId || journal.draft.id !== journalId) throw new AccountingError('invalid_response');
    return journal;
  }
  async reverse(command: ReverseJournalCommand) {
    const c = input(reverseJournalSchema, command);
    const receipt = parse(receiptSchema, await this.rpc('paperwork_reverse_journal', { p_firm: c.firmId, p_journal: c.journalId, p_period: c.periodId, p_date: c.postingDate, p_reason: c.reason, p_expected: c.expectedRevision, p_key: c.idempotencyKey }));
    if (receipt.firmId !== c.firmId) throw new AccountingError('invalid_response');
    return receipt;
  }
  async setPeriodStatus(command: PeriodStatusCommand): Promise<string> {
    const c = input(periodStatusSchema, command);
    return parse(z.string().regex(/^[1-9]\d*$/), await this.rpc('paperwork_set_period_status', { p_firm: c.firmId, p_period: c.periodId, p_status: c.status, p_expected: c.expectedRevision, p_reason: c.reason }));
  }
  async setPermission(command: PermissionCommand): Promise<void> {
    const c = input(permissionSchema, command);
    await this.rpc('paperwork_set_accounting_permission', { p_firm: c.firmId, p_user: c.userId, p_capability: c.capability, p_enabled: c.enabled });
  }
  async createEntity(firmId: string, command: AccountingEntityCommand): Promise<string> {
    input(accountingUuid, firmId);
    const c = input(accountingEntitySchema, command);
    const id = parse(accountingUuid, await this.rpc('paperwork_create_accounting_entity', { p_firm: firmId, p_kind: c.kind, p_data: c.data }));
    if (id !== c.data.id) throw new AccountingError('invalid_response');
    return id;
  }
  async saveDraft(command: SaveDraftCommand) {
    const c = input(saveDraftSchema, command);
    const receipt = parse(draftReceiptSchema, await this.rpc('paperwork_save_journal_draft', { p_draft: c.draft, p_expected: c.expectedRevision, p_key: c.idempotencyKey }));
    if (receipt.firmId !== c.draft.firmId || receipt.draftId !== c.draft.id) throw new AccountingError('invalid_response');
    return receipt;
  }
  async readDraft(firmId: string, draftId: string) {
    input(accountingUuid, firmId); input(accountingUuid, draftId);
    const data = await this.rpc('paperwork_read_journal_draft', { p_firm: firmId, p_id: draftId });
    if (data === null) return null;
    const result = parse(savedDraftSchema, data);
    if (result.draft.firmId !== firmId || result.draft.id !== draftId) throw new AccountingError('invalid_response');
    return result;
  }
  async createAgency(command: z.infer<typeof createAgencySchema>) {
    const c = input(createAgencySchema, command);
    const id = parse(accountingUuid, await this.rpc('paperwork_create_agency', { p_id: c.id, p_name: c.name }));
    if (id !== c.id) throw new AccountingError('invalid_response');
    return id;
  }
  async setAgencyMember(command: z.infer<typeof agencyMemberSchema>): Promise<void> {
    const c = input(agencyMemberSchema, command);
    await this.rpc('paperwork_set_agency_member', { p_agency: c.agencyId, p_user: c.userId, p_enabled: c.enabled });
  }
  async setAgencyConsent(command: AgencyConsentCommand): Promise<void> {
    const c = input(agencyConsentSchema, command);
    await this.rpc('paperwork_set_agency_consent', { p_firm: c.firmId, p_agency: c.agencyId, p_capability: c.capability, p_enabled: c.enabled });
  }
  async setAgencyAssignment(command: AgencyAssignmentCommand): Promise<void> {
    const c = input(agencyAssignmentSchema, command);
    await this.rpc('paperwork_set_agency_assignment', { p_firm: c.firmId, p_agency: c.agencyId, p_user: c.userId, p_capability: c.capability, p_enabled: c.enabled });
  }
}
