import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { allocateFxCarrying,convertFx,fxRateFields,fxWorkspaceSchema,verifyFxWorkspace,fxCarrying,fxRemaining,type FxPreviewLine } from './fx';
const positive=z.string().regex(/^[1-9]\d{0,23}$/),amount=z.string().regex(/^(0|[1-9]\d{0,23})$/),revision=z.string().regex(/^(0|[1-9]\d{0,8})$/);
const common={firmId:uuid,transactionId:uuid,expectedRevision:revision,fiscalYearId:uuid,periodId:uuid,postingDate:z.iso.date()};
const reason=z.string().trim().min(1).max(1000);
export const fxBankPostingCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('post'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('0'),journalId:uuid,clearingAccountId:uuid,...fxRateFields}).strict().refine(d=>d.publishedOn<=d.rateDate&&d.rateDate<=d.postingDate)}),
 z.object({action:z.literal('allocate'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,journalId:uuid,positionId:uuid,positionRevision:positive,foreignMinor:positive,gainAccountId:uuid,lossAccountId:uuid}).strict().refine(d=>d.gainAccountId!==d.lossAccountId)}),
 z.object({action:z.literal('fee'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,journalId:uuid,foreignMinor:positive,feeAccountId:uuid}).strict()}),
 z.object({action:z.enum(['cancel_allocation','cancel_fee','cancel_bank']),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,targetId:uuid,reason,positionRevision:positive.optional()}).strict()})
]);
export type FxBankPostingCommand=z.infer<typeof fxBankPostingCommandSchema>;
export const fxBankPostingReceiptSchema=z.object({firmId:uuid,transactionId:uuid,revision,journalId:uuid}).strict();
const event={id:uuid,sequence:positive,foreignMinor:positive,paidRsd:positive,previousForeign:positive,previousRsd:positive,postingDate:z.iso.date()};
export const fxBankWorkbenchSchema=z.object({firmId:uuid,transactionId:uuid,revision,legacyPayment:z.boolean(),
 transaction:z.object({externalId:z.string().min(1).max(100),bookingDate:z.iso.date(),incoming:amount,outgoing:amount}).strict(),
 account:z.object({id:uuid,number:z.string().regex(/^[A-Z0-9]{5,64}$/),currency:z.enum(['EUR','USD','CHF','GBP']),cashAccountId:uuid}).strict(),
 posting:z.object({journalId:uuid,clearingAccountId:uuid,foreignMinor:positive,rsdMinor:positive,postingDate:z.iso.date(),...fxRateFields,closed:z.boolean(),remainingForeign:amount,remainingRsd:amount,attributedBalance:z.string().regex(/^(0|-?[1-9]\d{0,39})$/)}).strict().nullable(),
 allocations:z.array(z.object({...event,positionId:uuid}).strict()).max(5000),fees:z.array(z.object({...event,feeAccountId:uuid}).strict()).max(5000),
 cancellations:z.array(z.object({id:uuid,kind:z.enum(['bank','allocation','fee']),sequence:positive,journalId:uuid,postingDate:z.iso.date(),reason}).strict()).max(10001),fx:fxWorkspaceSchema
}).strict();
export type FxBankWorkbench=z.infer<typeof fxBankWorkbenchSchema>;
export const verifyFxBankWorkbench=(w:FxBankWorkbench,firmId:string,transactionId:string)=>{
 try{
 if(w.firmId!==firmId||w.transactionId!==transactionId||!verifyFxWorkspace(w.fx,firmId))return false;
 const incoming=BigInt(w.transaction.incoming),outgoing=BigInt(w.transaction.outgoing);if(!((incoming>BigInt(0)&&outgoing===BigInt(0))||(outgoing>BigInt(0)&&incoming===BigInt(0))))return false;
 const b=w.posting;if(!b)return w.revision==='0'&&!w.allocations.length&&!w.fees.length&&!w.cancellations.length;
 if(w.legacyPayment||b.clearingAccountId===w.account.cashAccountId||b.postingDate!==w.transaction.bookingDate||b.foreignMinor!==(incoming+outgoing).toString()||b.publishedOn>b.rateDate||b.rateDate>b.postingDate||convertFx(b.foreignMinor,b.rateMicros,b.quoteUnits)!==b.rsdMinor)return false;
 let foreign=BigInt(b.foreignMinor),rsd=BigInt(b.rsdMinor),seq=BigInt(1),date=b.postingDate,closed=false;
 const active=new Map<string,{kind:string;foreignMinor:string;paidRsd:string}>(),ids=new Set([b.journalId]),cancelled=new Set<string>();
 const history=[...w.allocations.map(e=>({kind:'allocation' as const,e})),...w.fees.map(e=>({kind:'fee' as const,e})),...w.cancellations.map(e=>({kind:'cancel' as const,e}))].sort((a,b)=>Number(a.e.sequence)-Number(b.e.sequence));
 for(const h of history){const e=h.e;seq++;if(closed||e.sequence!==seq.toString()||e.postingDate<date)return false;date=e.postingDate;
 if(h.kind==='cancel'){
  const e=h.e;if(cancelled.has(e.id)||ids.has(e.journalId))return false;ids.add(e.journalId);cancelled.add(e.id);
  if(e.kind==='bank'){if(e.id!==b.journalId||active.size)return false;foreign=BigInt(0);rsd=BigInt(0);closed=true;}
  else {const original=active.get(e.id);if(!original||original.kind!==e.kind)return false;foreign+=BigInt(original.foreignMinor);rsd+=BigInt(original.paidRsd);active.delete(e.id);}
 }else{
  const e=h.e;if(ids.has(e.id)||e.previousForeign!==foreign.toString()||e.previousRsd!==rsd.toString()||allocateFxCarrying(rsd.toString(),foreign.toString(),e.foreignMinor)!==e.paidRsd)return false;ids.add(e.id);
  if(h.kind==='allocation'){
   const e=h.e,p=w.fx.positions.find(p=>p.id===e.positionId),s=p?.settlements?.find(s=>s.id===e.id);
   if(!p||!s||s.bank?.transactionId!==transactionId||s.bank.previousForeign!==e.previousForeign||s.bank.previousRsd!==e.previousRsd||s.foreignMinor!==e.foreignMinor||s.paidRsd!==e.paidRsd||s.cashAccountId!==b.clearingAccountId||s.sourceAccount!==w.account.number||s.sourceId!==w.transaction.externalId||s.currency!==w.account.currency||s.postingDate!==e.postingDate||p.direction!==(incoming>BigInt(0)?'receivable':'payable')||s.rateMicros!==b.rateMicros||s.quoteUnits!==b.quoteUnits||s.rateDate!==b.rateDate||s.publishedOn!==b.publishedOn||s.rateSource!==b.rateSource||s.sourceReference!==b.sourceReference)return false;
  }else if(incoming>BigInt(0)||h.e.feeAccountId===b.clearingAccountId||h.e.feeAccountId===w.account.cashAccountId)return false;
  active.set(e.id,{kind:h.kind,foreignMinor:e.foreignMinor,paidRsd:e.paidRsd});foreign-=BigInt(e.foreignMinor);rsd-=BigInt(e.paidRsd);
 }
 }
 if(w.allocations.some(e=>w.fx.positions.find(p=>p.id===e.positionId)?.settlements?.find(s=>s.id===e.id)?.cancelled!==cancelled.has(e.id)))return false;
 return seq.toString()===w.revision&&closed===b.closed&&foreign.toString()===b.remainingForeign&&rsd.toString()===b.remainingRsd&&(rsd*(incoming>BigInt(0)?BigInt(-1):BigInt(1))).toString()===b.attributedBalance;
 }catch{return false;}
};
export const fxBankPostingPreview=(command:FxBankPostingCommand,w:FxBankWorkbench):FxPreviewLine[]=>{
 const c=fxBankPostingCommandSchema.parse(command),d=c.data;if(d.firmId!==w.firmId||d.transactionId!==w.transactionId||d.expectedRevision!==w.revision)throw new Error('stale_preview');
 const incoming=w.transaction.incoming!=='0';
 if(c.action==='post'){if(w.posting||w.legacyPayment||d.postingDate!==w.transaction.bookingDate)throw new Error('source_conflict');const paid=convertFx((BigInt(w.transaction.incoming)+BigInt(w.transaction.outgoing)).toString(),c.data.rateMicros,c.data.quoteUnits);return [{accountId:w.account.cashAccountId,partnerId:null,debit:incoming?paid:'0',credit:incoming?'0':paid},{accountId:c.data.clearingAccountId,partnerId:null,debit:incoming?'0':paid,credit:incoming?paid:'0'}];}
 const b=w.posting;if(!b||b.closed)throw new Error('source_conflict');
 if(c.action==='fee'){if(incoming)throw new Error('fee_direction');const paid=allocateFxCarrying(b.remainingRsd,b.remainingForeign,c.data.foreignMinor);return [{accountId:c.data.feeAccountId,partnerId:null,debit:paid,credit:'0'},{accountId:b.clearingAccountId,partnerId:null,debit:'0',credit:paid}];}
 if(c.action!=='allocate')throw new Error('immutable_preview_required');
 const p=w.fx.positions.find(p=>p.id===c.data.positionId);if(!p||p.closed||p.externalMovements||p.revision!==c.data.positionRevision||p.currency!==w.account.currency||p.direction!==(incoming?'receivable':'payable'))throw new Error('stale_preview');
 const paid=allocateFxCarrying(b.remainingRsd,b.remainingForeign,c.data.foreignMinor),carrying=allocateFxCarrying(fxCarrying(p),fxRemaining(p),c.data.foreignMinor),delta=BigInt(paid)-BigInt(carrying);
 const lines:FxPreviewLine[]=[{accountId:b.clearingAccountId,partnerId:null,debit:incoming?paid:'0',credit:incoming?'0':paid},{accountId:p.accountId,partnerId:p.partnerId,debit:incoming?'0':carrying,credit:incoming?carrying:'0'}];
 if(delta!==BigInt(0)){const debit=incoming===(delta<BigInt(0)),v=(delta<BigInt(0)?-delta:delta).toString();lines.push({accountId:debit?c.data.lossAccountId:c.data.gainAccountId,partnerId:null,debit:debit?v:'0',credit:debit?'0':v});}return lines;
};
