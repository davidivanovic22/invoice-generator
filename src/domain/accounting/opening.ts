import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import type { AccountingWorkspace } from './commands';
const amount=z.string().regex(/^(0|[1-9]\d{0,23})$/),positive=z.string().regex(/^[1-9]\d{0,23}$/),revision=z.string().regex(/^(0|[1-9]\d{0,8})$/),code=z.string().trim().min(1).max(100),external=z.string().trim().min(1).max(200);
const sourceBalance=z.object({sourceAccount:code,sourcePartner:z.string().trim().max(100),debit:amount,credit:amount}).strict().refine(r=>(r.debit!=='0')!==(r.credit!=='0'));
const sourceItem=z.object({sourceAccount:code,sourcePartner:code,externalId:external,number:external,documentDate:z.iso.date(),dueDate:z.iso.date(),direction:z.enum(['receivable','payable']),amount:positive}).strict().refine(i=>i.dueDate>=i.documentDate);
export const openingSourceSchema=z.object({version:z.literal('1'),currency:z.literal('RSD'),sourceTaxId:code,asOf:z.iso.date(),sourceReference:external,balances:z.array(sourceBalance).min(2).max(500),items:z.array(sourceItem).max(500)}).strict();
export type OpeningSource=z.infer<typeof openingSourceSchema>;
const mappedBalance=sourceBalance.safeExtend({accountId:uuid,partnerId:uuid.optional()});
const common={firmId:uuid,batchId:uuid,expectedRevision:revision};
export const openingCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('import'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('0'),journalId:uuid,fiscalYearId:uuid,periodId:uuid,postingDate:z.iso.date(),asOf:z.iso.date(),currency:z.literal('RSD'),sourceTaxId:code,sourceReference:external,fileName:z.string().min(1).max(255),fileSha256:z.string().regex(/^[a-f0-9]{64}$/),balances:z.array(mappedBalance).min(2).max(500),items:z.array(sourceItem.safeExtend({id:uuid})).max(500)}).strict()}),
 z.object({action:z.literal('cancel'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('1'),periodId:uuid,reason:z.string().trim().min(1).max(1000)}).strict()}),
 z.object({action:z.literal('apply'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,itemId:uuid,applicationId:uuid,journalId:uuid,lineId:z.string().min(1).max(100),amount:positive}).strict()})
]);
export type OpeningCommand=z.infer<typeof openingCommandSchema>;
export const openingReceiptSchema=z.object({firmId:uuid,batchId:uuid,itemId:uuid.nullable(),applicationId:uuid.nullable(),journalId:uuid,revision}).strict();
export const openingWorkspaceSchema=z.object({firmId:uuid,businessDate:z.iso.date(),
 batches:z.array(z.object({id:uuid,journalId:uuid,sourceReference:external,sourceTaxId:code,fileName:z.string().min(1),fileSha256:z.string().regex(/^[a-f0-9]{64}$/),postingDate:z.iso.date(),cancelled:z.boolean(),reversalId:uuid.nullable(),reason:z.string().nullable()}).strict()).max(5000),
 balances:z.array(z.object({...sourceBalance.shape,accountId:uuid,partnerId:uuid.nullable(),batchId:uuid,row:z.number().int().positive()}).strict().refine(r=>(r.debit!=='0')!==(r.credit!=='0'))).max(5000),
 items:z.array(z.object({...sourceItem.shape,id:uuid,batchId:uuid,row:z.number().int().positive(),journalLineId:z.string().min(1).max(100),revision,remaining:amount}).omit({sourceAccount:true,sourcePartner:true}).strict().refine(i=>i.dueDate>=i.documentDate)).max(5000),
 applications:z.array(z.object({id:uuid,itemId:uuid,journalId:uuid,lineId:z.string(),amount:positive,lineAmount:positive,accountId:uuid,partnerId:uuid,postingDate:z.iso.date(),reversed:z.boolean(),reversalId:uuid.nullable()}).strict()).max(10000),
 controls:z.array(z.object({accountId:uuid,partnerId:uuid,balance:z.string().regex(/^(0|-?[1-9]\d{0,39})$/)}).strict()).max(5000)
}).strict();
export type OpeningWorkspace=z.infer<typeof openingWorkspaceSchema>;
export const validateOpeningImport=(command:Extract<OpeningCommand,{action:'import'}>,w:AccountingWorkspace)=>{
 const c=openingCommandSchema.parse(command);if(c.action!=='import')throw new Error('opening_action');const d=c.data,y=w.years.find(y=>y.id===w.yearId),p=w.periods.find(p=>p.id===d.periodId);
 if(d.firmId!==w.firmId||d.fiscalYearId!==w.yearId||!y||d.postingDate!==y.startsOn||new Date(Date.parse(`${d.asOf}T00:00:00Z`)+86400000).toISOString().slice(0,10)!==d.postingDate||!p||p.status!=='open'||d.postingDate<p.startsOn||d.postingDate>p.endsOn)throw new Error('opening_context');
 const seen=new Set<string>(),pairs=new Set<string>(),maps=new Map<string,string>(),partners=new Map<string,string>();let debit=BigInt(0),credit=BigInt(0);
 for(const r of d.balances){const a=w.accounts.find(a=>a.id===r.accountId),key=JSON.stringify([r.sourceAccount,r.sourcePartner]),pair=JSON.stringify([r.accountId,r.partnerId||'']);
  if(seen.has(key)||pairs.has(pair)||(maps.has(r.sourceAccount)&&maps.get(r.sourceAccount)!==r.accountId)||!a?.active||!a.allowsPosting||a.validFrom>d.postingDate||(a.validTo!==null&&a.validTo<d.postingDate)||a.requiresPartner!==Boolean(r.sourcePartner)||a.requiresPartner!==Boolean(r.partnerId)||(r.partnerId&&!w.partners.some(p=>p.id===r.partnerId))||(r.sourcePartner&&partners.has(r.sourcePartner)&&partners.get(r.sourcePartner)!==r.partnerId))throw new Error('opening_mapping');
  seen.add(key);pairs.add(pair);maps.set(r.sourceAccount,r.accountId);if(r.partnerId)partners.set(r.sourcePartner,r.partnerId);debit+=BigInt(r.debit);credit+=BigInt(r.credit);
  const items=d.items.filter(i=>i.sourceAccount===r.sourceAccount&&i.sourcePartner===r.sourcePartner);
  if(a.requiresPartner){for(const side of ['receivable','payable'] as const)if(items.filter(i=>i.direction===side).reduce((s,i)=>s+BigInt(i.amount),BigInt(0))!==BigInt(side==='receivable'?r.debit:r.credit))throw new Error('opening_item_balance');}else if(items.length)throw new Error('opening_item_mapping');
 }
 if(debit!==credit)throw new Error('opening_balance');
 if(new Set(d.items.map(i=>i.id)).size!==d.items.length||new Set(d.items.map(i=>i.externalId)).size!==d.items.length||d.items.some(i=>i.documentDate>=d.postingDate||!seen.has(JSON.stringify([i.sourceAccount,i.sourcePartner]))))throw new Error('opening_items');
 return {debit:debit.toString(),credit:credit.toString(),lines:[...d.balances.filter(r=>!r.partnerId).map((r,n)=>({id:`balance-${d.balances.indexOf(r)+1}`,accountId:r.accountId,partnerId:null,debit:r.debit,credit:r.credit,description:`Opening: ${r.sourceAccount}`})),...d.items.map(i=>{const r=d.balances.find(r=>r.sourceAccount===i.sourceAccount&&r.sourcePartner===i.sourcePartner)!;return {id:`open-${i.id}`,accountId:r.accountId,partnerId:r.partnerId!,debit:i.direction==='receivable'?i.amount:'0',credit:i.direction==='payable'?i.amount:'0',description:`Opening item: ${i.number}`};})]};
};
export const verifyOpeningWorkspace=(w:OpeningWorkspace,firmId:string)=>{
 try{
 if(w.firmId!==firmId||new Set(w.batches.map(b=>b.id)).size!==w.batches.length||new Set(w.batches.flatMap(b=>[b.journalId,...(b.reversalId?[b.reversalId]:[])])).size!==w.batches.reduce((n,b)=>n+1+(b.reversalId?1:0),0)||new Set(w.items.map(i=>i.id)).size!==w.items.length||new Set(w.items.map(i=>JSON.stringify([i.batchId,i.externalId]))).size!==w.items.length||new Set(w.applications.map(a=>a.id)).size!==w.applications.length||w.batches.filter(b=>!b.cancelled).length>1)return false;
 const controls=new Map<string,bigint>(),budget=new Map<string,{claimed:bigint;amount:string;account:string;partner:string;reversed:boolean}>();
 for(const b of w.batches){if(b.cancelled!==(b.reversalId!==null)||b.cancelled!==(b.reason!==null))return false;
  const rows=w.balances.filter(r=>r.batchId===b.id);if(rows.length<2||new Set(rows.map(r=>r.row)).size!==rows.length||new Set(rows.map(r=>JSON.stringify([r.sourceAccount,r.sourcePartner]))).size!==rows.length||new Set(rows.map(r=>JSON.stringify([r.accountId,r.partnerId]))).size!==rows.length||rows.reduce((s,r)=>s+BigInt(r.debit)-BigInt(r.credit),BigInt(0))!==BigInt(0))return false;
  for(const r of rows){const items=w.items.filter(i=>i.batchId===b.id&&i.row===r.row);if(Boolean(r.partnerId)!==Boolean(r.sourcePartner))return false;
   if(r.partnerId){for(const direction of ['receivable','payable'] as const)if(items.filter(i=>i.direction===direction).reduce((s,i)=>s+BigInt(i.amount),BigInt(0))!==BigInt(direction==='receivable'?r.debit:r.credit))return false;}else if(items.length)return false;
  }
 }
 for(const i of w.items){const b=w.batches.find(b=>b.id===i.batchId),r=w.balances.find(r=>r.batchId===i.batchId&&r.row===i.row);if(!b||!r?.partnerId||i.journalLineId!==`open-${i.id}`||i.documentDate>=b.postingDate)return false;
  let paid=BigInt(0),rev=BigInt(1);for(const a of w.applications.filter(a=>a.itemId===i.id)){if(b.cancelled||a.accountId!==r.accountId||a.partnerId!==r.partnerId||a.postingDate<b.postingDate||a.reversed!==(a.reversalId!==null)||w.batches.some(b=>b.journalId===a.journalId||b.reversalId===a.journalId))return false;
   rev+=BigInt(1)+(a.reversed?BigInt(1):BigInt(0));if(!a.reversed)paid+=BigInt(a.amount);const key=JSON.stringify([a.journalId,a.lineId]),v=budget.get(key)||{claimed:BigInt(0),amount:a.lineAmount,account:a.accountId,partner:a.partnerId,reversed:a.reversed};
   if(v.amount!==a.lineAmount||v.account!==a.accountId||v.partner!==a.partnerId||v.reversed!==a.reversed)return false;v.claimed+=BigInt(a.amount);if(v.claimed>BigInt(v.amount))return false;budget.set(key,v);
  }
  if(paid>BigInt(i.amount)||rev.toString()!==i.revision||(b.cancelled?'0':(BigInt(i.amount)-paid).toString())!==i.remaining)return false;
  const key=JSON.stringify([r.accountId,r.partnerId]);controls.set(key,(controls.get(key)||BigInt(0))+(i.direction==='receivable'?BigInt(i.remaining):-BigInt(i.remaining)));
 }
 return w.balances.every(r=>w.batches.some(b=>b.id===r.batchId))&&w.applications.every(a=>w.items.some(i=>i.id===a.itemId))&&new Set(w.controls.map(c=>JSON.stringify([c.accountId,c.partnerId]))).size===w.controls.length&&w.controls.length===controls.size&&w.controls.every(c=>controls.has(JSON.stringify([c.accountId,c.partnerId])));
 }catch{return false;}
};
export const openingControls=(w:OpeningWorkspace)=>w.controls.map(c=>{const expected=w.items.reduce((s,i)=>{const r=w.balances.find(r=>r.batchId===i.batchId&&r.row===i.row);return r?.accountId===c.accountId&&r.partnerId===c.partnerId?s+(i.direction==='receivable'?BigInt(i.remaining):-BigInt(i.remaining)):s;},BigInt(0));return {...c,expected:expected.toString(),difference:(BigInt(c.balance)-expected).toString()};});
