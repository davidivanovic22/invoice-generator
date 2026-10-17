import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { minorUnits } from './journal';
const amount=z.string().refine(value=>{try{minorUnits(value);return true;}catch{return false;}});
const signed=z.string().regex(/^(0|-?[1-9]\d{0,23})$/);
const key=z.string().min(1).max(100);
export const normalizeBankNumber=(value:string)=>value.replace(/[\s-]/g,'').toUpperCase();
export const bankAccountInputSchema=z.object({firmId:uuid,id:uuid,name:z.string().trim().min(1).max(200),number:z.string().regex(/^[A-Z0-9]{5,50}$/),currency:z.literal('RSD')}).strict();
export const bankAccountCommandSchema=z.object({data:bankAccountInputSchema,idempotencyKey:key}).strict();
export const bankAccountReceiptSchema=z.object({firmId:uuid,accountId:uuid}).strict();
const oneSide=(r:{incoming:string;outgoing:string})=>amount.safeParse(r.incoming).success&&amount.safeParse(r.outgoing).success&&((BigInt(r.incoming)>BigInt(0)&&r.outgoing==='0')||(BigInt(r.outgoing)>BigInt(0)&&r.incoming==='0'));
export const bankRowSchema=z.object({externalId:z.string().trim().min(1).max(100),bookingDate:z.iso.date(),valueDate:z.iso.date(),incoming:amount,outgoing:amount,counterparty:z.string().trim().max(500),reference:z.string().trim().max(500),description:z.string().trim().max(1000)}).strict().refine(oneSide);
type StatementAmounts={startsOn:string;endsOn:string;opening:string;closing:string;rows:Array<{externalId:string;bookingDate:string;incoming:string;outgoing:string}>};
const consistent=(data:StatementAmounts)=>{
 if(!signed.safeParse(data.opening).success||!signed.safeParse(data.closing).success||data.rows.some(r=>!oneSide(r)))return false;
 const incoming=data.rows.reduce((s,r)=>s+BigInt(r.incoming),BigInt(0));const outgoing=data.rows.reduce((s,r)=>s+BigInt(r.outgoing),BigInt(0));
 return data.startsOn<=data.endsOn&&data.rows.every(r=>r.bookingDate>=data.startsOn&&r.bookingDate<=data.endsOn)&&new Set(data.rows.map(r=>r.externalId)).size===data.rows.length&&incoming.toString().length<=24&&outgoing.toString().length<=24&&BigInt(data.opening)+incoming-outgoing===BigInt(data.closing);
};
const header={firmId:uuid,bankAccountId:uuid,fiscalYearId:uuid,reference:z.string().trim().min(1).max(100),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed};
export const bankStatementInputSchema=z.object({...header,rows:z.array(bankRowSchema).min(1).max(2000)}).strict().refine(consistent);
export const bankImportCommandSchema=z.object({data:bankStatementInputSchema,idempotencyKey:key}).strict();
export const bankImportReceiptSchema=z.object({firmId:uuid,accountId:uuid,statementId:uuid,newCount:z.number().int().min(0).max(2000),reusedCount:z.number().int().min(0).max(2000),previouslyImported:z.boolean()}).strict();
export const bankWorkspaceSchema=z.object({firmId:uuid,yearId:uuid,
 accounts:z.array(z.object({id:uuid,name:z.string(),number:z.string(),currency:z.literal('RSD')}).strict()),
 statements:z.array(z.object({id:uuid,accountId:uuid,reference:z.string(),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed,rowCount:z.number().int().min(1).max(2000)}).strict())}).strict();
// A read row has the extra server UUID; avoid strict input row rejecting it.
const readRow=z.object({externalId:z.string().trim().min(1).max(100),bookingDate:z.iso.date(),valueDate:z.iso.date(),incoming:amount,outgoing:amount,counterparty:z.string().max(500),reference:z.string().max(500),description:z.string().max(1000),id:uuid}).strict().refine(oneSide);
export const bankReadSchema=z.object({firmId:uuid,statementId:uuid,accountId:uuid,yearId:uuid,reference:z.string(),startsOn:z.iso.date(),endsOn:z.iso.date(),opening:signed,closing:signed,rows:z.array(readRow).min(1).max(2000)}).strict().refine(consistent);
export type BankRow=z.infer<typeof bankRowSchema>;
export type BankImportCommand=z.infer<typeof bankImportCommandSchema>;
export type BankAccountCommand=z.infer<typeof bankAccountCommandSchema>;
export type BankWorkspace=z.infer<typeof bankWorkspaceSchema>;
export type BankStatement=z.infer<typeof bankReadSchema>;
export type BankImportReceipt=z.infer<typeof bankImportReceiptSchema>;

export const parseBankRsd=(input:string,signedBalance=false)=>{
 const value=input.trim().replace(',','.');
 if(value.length>26)throw new Error('bank_amount');
 if(!(signedBalance?/^-?(0|[1-9]\d*)(\.\d{1,2})?$/:/^(0|[1-9]\d*)(\.\d{1,2})?$/).test(value))throw new Error('bank_amount');
 const negative=value.startsWith('-');const [whole,fraction='']=(negative?value.slice(1):value).split('.');
 const magnitude=minorUnits((BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'))).toString());
 return negative&&magnitude!=='0'?`-${magnitude}`:magnitude;
};
