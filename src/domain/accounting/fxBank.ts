import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { minorUnits } from './journal';
const amount=z.string().refine(value=>{try{minorUnits(value);return true;}catch{return false;}});
const signed=z.string().regex(/^(0|-?[1-9]\d{0,23})$/);
const key=z.string().min(1).max(100);
export const normalizeFxBankNumber=(value:string)=>value.replace(/[\s-]/g,'').toUpperCase();
export const fxBankAccountInputSchema=z.object({firmId:uuid,id:uuid,name:z.string().trim().min(1).max(200),number:z.string().regex(/^[A-Z0-9]{5,64}$/),currency:z.enum(['EUR','USD','CHF','GBP']),cashAccountId:uuid}).strict();
export const fxBankAccountCommandSchema=z.object({data:fxBankAccountInputSchema,idempotencyKey:key}).strict();
export const fxBankAccountReceiptSchema=z.object({firmId:uuid,accountId:uuid}).strict();
const oneSide=(r:{incoming:string;outgoing:string})=>amount.safeParse(r.incoming).success&&amount.safeParse(r.outgoing).success&&((BigInt(r.incoming)>BigInt(0)&&r.outgoing==='0')||(BigInt(r.outgoing)>BigInt(0)&&r.incoming==='0'));
export const fxBankRowSchema=z.object({externalId:z.string().trim().min(1).max(100),bookingDate:z.iso.date(),valueDate:z.iso.date(),incoming:amount,outgoing:amount,counterparty:z.string().trim().max(500),reference:z.string().trim().max(500),description:z.string().trim().max(1000)}).strict().refine(oneSide);
type StatementAmounts={startsOn:string;endsOn:string;opening:string;closing:string;rows:Array<{externalId:string;bookingDate:string;incoming:string;outgoing:string}>};
const consistent=(data:StatementAmounts)=>{
 if(!signed.safeParse(data.opening).success||!signed.safeParse(data.closing).success||data.rows.some(r=>!oneSide(r)))return false;
 const incoming=data.rows.reduce((s,r)=>s+BigInt(r.incoming),BigInt(0));const outgoing=data.rows.reduce((s,r)=>s+BigInt(r.outgoing),BigInt(0));
 return data.startsOn<=data.endsOn&&data.rows.every(r=>r.bookingDate>=data.startsOn&&r.bookingDate<=data.endsOn)&&new Set(data.rows.map(r=>r.externalId)).size===data.rows.length&&incoming.toString().length<=24&&outgoing.toString().length<=24&&BigInt(data.opening)+incoming-outgoing===BigInt(data.closing);
};
const header={firmId:uuid,bankAccountId:uuid,fiscalYearId:uuid,reference:z.string().trim().min(1).max(100),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed};
export const fxBankStatementInputSchema=z.object({...header,rows:z.array(fxBankRowSchema).min(1).max(2000)}).strict().refine(consistent);
export const fxBankImportCommandSchema=z.object({data:fxBankStatementInputSchema,idempotencyKey:key}).strict();
export const fxBankImportReceiptSchema=z.object({firmId:uuid,accountId:uuid,statementId:uuid,newCount:z.number().int().min(0).max(2000),reusedCount:z.number().int().min(0).max(2000),previouslyImported:z.boolean()}).strict();
export const fxBankWorkspaceSchema=z.object({firmId:uuid,yearId:uuid,
 accounts:z.array(z.object({id:uuid,name:z.string(),number:z.string(),currency:z.enum(['EUR','USD','CHF','GBP']),cashAccountId:uuid}).strict()),
 statements:z.array(z.object({id:uuid,accountId:uuid,reference:z.string(),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed,rowCount:z.number().int().min(1).max(2000)}).strict())}).strict();
// A read row has the extra server UUID; avoid strict input row rejecting it.
const readRow=z.object({externalId:z.string().trim().min(1).max(100),bookingDate:z.iso.date(),valueDate:z.iso.date(),incoming:amount,outgoing:amount,counterparty:z.string().max(500),reference:z.string().max(500),description:z.string().max(1000),id:uuid}).strict().refine(oneSide);
const baseRead=z.object({firmId:uuid,statementId:uuid,accountId:uuid,yearId:uuid,reference:z.string(),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed,rows:z.array(readRow).min(1).max(2000)}).strict().refine(consistent);
export type FxBankRow=z.infer<typeof fxBankRowSchema>;
export type FxBankImportCommand=z.infer<typeof fxBankImportCommandSchema>;
export type FxBankAccountCommand=z.infer<typeof fxBankAccountCommandSchema>;
export type FxBankWorkspace=z.infer<typeof fxBankWorkspaceSchema>;

export type FxBankImportReceipt=z.infer<typeof fxBankImportReceiptSchema>;


export const fxBankLinkCommandSchema=z.object({data:z.object({firmId:uuid,transactionId:uuid,settlementId:uuid}).strict(),idempotencyKey:key}).strict();
export const fxBankLinkReceiptSchema=z.object({firmId:uuid,transactionId:uuid,settlementId:uuid}).strict();
export const fxBankReadSchema=baseRead.safeExtend({currency:z.enum(['EUR','USD','CHF','GBP']),number:z.string().regex(/^[A-Z0-9]{5,64}$/),cashAccountId:uuid,
 postings:z.array(z.object({transactionId:uuid,journalId:uuid,revision:z.string().regex(/^[1-9]\d{0,8}$/),closed:z.boolean(),remainingForeign:amount,remainingRsd:amount}).strict()).max(2000).optional(),
 links:z.array(z.object({transactionId:uuid,settlementId:uuid,linked:z.boolean(),cancelled:z.boolean()}).strict()).max(2000)
}).refine(s=>new Set(s.rows.map(r=>r.id)).size===s.rows.length && new Set(s.links.map(l=>l.transactionId)).size===s.links.length && new Set(s.links.map(l=>l.settlementId)).size===s.links.length && s.links.every(l=>s.rows.some(r=>r.id===l.transactionId)) && new Set((s.postings||[]).map(p=>p.transactionId)).size===(s.postings||[]).length && (s.postings||[]).every(p=>{const r=s.rows.find(r=>r.id===p.transactionId);return r&&!s.links.some(l=>l.transactionId===p.transactionId)&&BigInt(p.remainingForeign)<=BigInt(r.incoming)+BigInt(r.outgoing)&&(!p.closed||(p.remainingForeign==='0'&&p.remainingRsd==='0'));}));
export type FxBankStatement=z.infer<typeof fxBankReadSchema>;
export type FxBankLinkCommand=z.infer<typeof fxBankLinkCommandSchema>;
/** Foreign statement arithmetic and active linked coverage, never a RSD ledger balance. */
export const fxBankControl=(s:FxBankStatement)=>{
 const incoming=s.rows.reduce((n,r)=>n+BigInt(r.incoming),BigInt(0)),outgoing=s.rows.reduce((n,r)=>n+BigInt(r.outgoing),BigInt(0));
 const active=new Set(s.links.filter(l=>l.linked&&!l.cancelled).map(l=>l.transactionId));
 const unmatched=s.rows.map(r=>{const p=s.postings?.find(p=>p.transactionId===r.id);const remaining=active.has(r.id)?'0':p&&!p.closed?p.remainingForeign:(BigInt(r.incoming)+BigInt(r.outgoing)).toString();return {...r,incoming:r.incoming==='0'?'0':remaining,outgoing:r.outgoing==='0'?'0':remaining};}).filter(r=>r.incoming!=='0'||r.outgoing!=='0');
 return {incoming:incoming.toString(),outgoing:outgoing.toString(),computedClosing:(BigInt(s.opening)+incoming-outgoing).toString(),
 unmatchedCount:unmatched.length,unmatchedIncoming:unmatched.reduce((n,r)=>n+BigInt(r.incoming),BigInt(0)).toString(),unmatchedOutgoing:unmatched.reduce((n,r)=>n+BigInt(r.outgoing),BigInt(0)).toString()};
};
