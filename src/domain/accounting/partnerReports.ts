import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { openingWorkspaceSchema,verifyOpeningWorkspace } from './opening';
const money=z.string().regex(/^(0|[1-9]\d{0,39})$/),signed=z.string().regex(/^(0|-?[1-9]\d{0,39})$/),lineMoney=z.string().regex(/^(0|[1-9]\d{0,23})$/);
export const partnerReportQuerySchema=z.object({firmId:uuid,partnerId:uuid.nullable()}).strict();
export type PartnerReportQuery=z.infer<typeof partnerReportQuerySchema>;
export const partnerReportSchema=z.object({firmId:uuid,firmName:z.string(),partnerId:uuid.nullable(),currency:z.literal('RSD'),generatedAt:z.iso.datetime({offset:true}),businessDate:z.iso.date(),migration:openingWorkspaceSchema.optional(),
 lines:z.array(z.object({journalId:uuid,lineId:z.string().min(1).max(100),number:z.string(),postingDate:z.iso.date(),postedAt:z.iso.datetime({offset:true}),reversalOf:uuid.nullable(),reason:z.string().nullable(),description:z.string(),journalDescription:z.string(),partnerId:uuid,partnerName:z.string(),accountId:uuid,accountCode:z.string(),accountName:z.string(),debit:lineMoney,credit:lineMoney,linked:z.boolean()}).strict()).max(10000),
 accounts:z.array(z.object({partnerId:uuid,partnerName:z.string(),accountId:uuid,code:z.string(),name:z.string(),debit:money,credit:money,balance:signed,linkedBalance:signed,unlinkedBalance:signed}).strict()).max(10000),
 documents:z.array(z.object({id:uuid,partnerId:uuid,partnerName:z.string(),number:z.string(),direction:z.enum(['incoming','outgoing']),kind:z.enum(['invoice','advance']),documentDate:z.iso.date(),dueDate:z.iso.date(),evidence:z.object({gross:money,credits:money,advances:money,paid:signed,due:money,overpaid:money,status:z.enum(['not_tracked','overpaid','paid','partial','unpaid'])}).strict(),sourceStatus:z.enum(['unposted','reversed','active']),hasControlAccount:z.boolean(),controlAccountIds:z.array(uuid).max(1000),journalIds:z.array(uuid).max(10000),ledgerBalance:signed.nullable(),expectedBalance:signed,difference:signed.nullable(),unpostedEvidenceCount:money,appliedOut:money}).strict()).max(5000)
}).strict();
export type PartnerReport=z.infer<typeof partnerReportSchema>;
const zero=BigInt(0);
/** Partner-only lines need not balance globally: verify each partner/account against its complete detail. */
export const verifyPartnerReport=(r:PartnerReport,q:PartnerReportQuery)=>{
 if(r.firmId!==q.firmId||r.partnerId!==q.partnerId||(r.migration&&!verifyOpeningWorkspace(r.migration,q.firmId)))return false;
 const accounts=new Map(r.accounts.map(a=>[`${a.partnerId}:${a.accountId}`,a]));
 if(accounts.size!==r.accounts.length)return false;
 if(r.migration){
  for(const c of r.migration.controls){if(q.partnerId!==null&&c.partnerId!==q.partnerId)continue;const a=accounts.get(`${c.partnerId}:${c.accountId}`);if(!a||a.balance!==c.balance)return false;}
  for(const i of r.migration.items){const row=r.migration.balances.find(b=>b.batchId===i.batchId&&b.row===i.row)!,batch=r.migration.batches.find(b=>b.id===i.batchId)!;if(q.partnerId!==null&&row.partnerId!==q.partnerId)continue;
   const line=r.lines.find(l=>l.journalId===batch.journalId&&l.lineId===i.journalLineId);if(!line||line.partnerId!==row.partnerId||line.accountId!==row.accountId||line.debit!==(i.direction==='receivable'?i.amount:'0')||line.credit!==(i.direction==='payable'?i.amount:'0'))return false;
  }
 }
 const sums=new Map<string,{d:bigint;c:bigint;l:bigint}>(),seen=new Set<string>();let last='';
 for(const l of r.lines){
  const id=`${l.journalId}:${l.lineId}`,key=`${l.partnerId}:${l.accountId}`,order=`${l.postingDate}|${l.postedAt}|${l.journalId}`;
  if(seen.has(id)||!accounts.has(key)||order<last||(q.partnerId!==null&&l.partnerId!==q.partnerId)||(l.reversalOf===null)!==(l.reason===null))return false;
  seen.add(id);last=order;const d=BigInt(l.debit),c=BigInt(l.credit);if((d>zero)===(c>zero))return false;
  const s=sums.get(key)||{d:zero,c:zero,l:zero};s.d+=d;s.c+=c;if(l.linked)s.l+=d-c;sums.set(key,s);
 }
 for(const [key,a] of accounts){const s=sums.get(key);if(!s||s.d.toString()!==a.debit||s.c.toString()!==a.credit||(s.d-s.c).toString()!==a.balance||s.l.toString()!==a.linkedBalance||(s.d-s.c-s.l).toString()!==a.unlinkedBalance)return false;}
 if(new Set(r.documents.map(d=>d.id)).size!==r.documents.length)return false;
 for(const d of r.documents){
  if((q.partnerId!==null&&d.partnerId!==q.partnerId)||d.dueDate<d.documentDate)return false;
  const control=new Set(d.controlAccountIds),journals=new Set(d.journalIds);
  if(control.size!==d.controlAccountIds.length||journals.size!==d.journalIds.length||d.hasControlAccount!==(control.size>0)||(d.sourceStatus==='unposted'&&control.size>0))return false;
  const e=d.evidence,remaining=BigInt(e.gross)-BigInt(e.credits)-BigInt(e.advances)-BigInt(e.paid);
  if((remaining>zero?remaining:zero).toString()!==e.due||(remaining<zero?-remaining:zero).toString()!==e.overpaid||(remaining*(d.direction==='outgoing'?BigInt(1):BigInt(-1))).toString()!==d.expectedBalance)return false;
  if(d.kind==='advance'){if(d.ledgerBalance!==null||d.difference!==null||d.hasControlAccount||journals.size||e.advances!=='0')return false;}
  else {
   const actual=r.lines.filter(l=>l.partnerId===d.partnerId&&control.has(l.accountId)&&journals.has(l.journalId)).reduce((s,l)=>s+BigInt(l.debit)-BigInt(l.credit),zero);
   if(d.ledgerBalance===null||d.difference===null||actual.toString()!==d.ledgerBalance||(actual-BigInt(d.expectedBalance)).toString()!==d.difference||d.appliedOut!=='0')return false;
  }
 }
 return true;
};
export const agingBuckets=['notDue','1-30','31-60','61-90','91+'] as const;
export const agingBucket=(today:string,due:string):typeof agingBuckets[number]=>{
 const days=(Date.parse(`${today}T00:00:00Z`)-Date.parse(`${due}T00:00:00Z`))/86400000;
 return days<=0?'notDue':days<=30?'1-30':days<=60?'31-60':days<=90?'61-90':'91+';
};
export const agingTotals=(r:PartnerReport,direction:'incoming'|'outgoing')=>{
 const buckets:Record<typeof agingBuckets[number],bigint>={notDue:zero,'1-30':zero,'31-60':zero,'61-90':zero,'91+':zero};let due=zero,overpaid=zero;
 r.documents.filter(d=>d.kind==='invoice'&&d.direction===direction).forEach(d=>{const value=BigInt(d.evidence.due);due+=value;overpaid+=BigInt(d.evidence.overpaid);buckets[agingBucket(r.businessDate,d.dueDate)]+=value;});
 r.migration?.items.filter(i=>i.direction===(direction==='outgoing'?'receivable':'payable')&&(r.partnerId===null||r.migration!.balances.some(b=>b.batchId===i.batchId&&b.row===i.row&&b.partnerId===r.partnerId))).forEach(i=>{const value=BigInt(i.remaining);due+=value;buckets[agingBucket(r.businessDate,i.dueDate)]+=value;});
 return {due:due.toString(),overpaid:overpaid.toString(),buckets:Object.fromEntries(agingBuckets.map(k=>[k,buckets[k].toString()])) as Record<typeof agingBuckets[number],string>};
};
export const partnerCardRows=(r:PartnerReport,partnerId:string,accountId:string)=>{
 let balance=zero;return r.lines.filter(l=>l.partnerId===partnerId&&l.accountId===accountId).map(l=>{balance+=BigInt(l.debit)-BigInt(l.credit);return {...l,balance:balance.toString()};});
};
