import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
const money=z.string().regex(/^[1-9]\d{0,23}$/),signed=z.string().regex(/^(0|-?[1-9]\d{0,39})$/),revision=z.string().regex(/^[1-9]\d{0,8}$/);
export const fxRateFields={rateMicros:z.string().regex(/^[1-9]\d{0,17}$/),quoteUnits:z.enum(['1','100']),rateDate:z.iso.date(),publishedOn:z.iso.date(),rateSource:z.string().trim().min(1).max(200),sourceReference:z.string().trim().min(1).max(1000)};
const posting={firmId:uuid,id:uuid,expectedRevision:z.string().regex(/^(0|[1-9]\d{0,8})$/),periodId:uuid,postingDate:z.iso.date()};
const rateValid=(v:{publishedOn:string;rateDate:string;postingDate:string})=>v.publishedOn<=v.rateDate&&v.rateDate<=v.postingDate;
export const normalizeFxSourceAccount=(s:string)=>s.replace(/[\s-]/g,'').toUpperCase();
const sourceAccount=z.string().transform(normalizeFxSourceAccount).pipe(z.string().regex(/^[A-Z0-9]{5,64}$/));
export const fxCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:z.literal('0'),journalId:uuid,fiscalYearId:uuid,accountId:uuid,counterAccountId:uuid,partnerId:uuid,currency:z.enum(['EUR','USD','CHF','GBP']),direction:z.enum(['receivable','payable']),foreignMinor:money,...fxRateFields}).strict().refine(rateValid).refine(v=>v.accountId!==v.counterAccountId)}),
 z.object({action:z.literal('revalue'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:revision,journalId:uuid,fiscalYearId:uuid,gainAccountId:uuid,lossAccountId:uuid,...fxRateFields}).strict().refine(rateValid).refine(v=>v.gainAccountId!==v.lossAccountId)}),
 z.object({action:z.literal('cancel'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:revision,revaluationId:uuid,reason:z.string().trim().min(1).max(1000)}).strict()}),
 z.object({action:z.literal('close'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:revision,reason:z.string().trim().min(1).max(1000)}).strict()}),
 z.object({action:z.literal('settle'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:revision,journalId:uuid,fiscalYearId:uuid,foreignMinor:money,currency:z.enum(['EUR','USD','CHF','GBP']),cashAccountId:uuid,gainAccountId:uuid,lossAccountId:uuid,sourceAccount,sourceId:z.string().trim().min(1).max(200),...fxRateFields}).strict().refine(rateValid).refine(v=>new Set([v.cashAccountId,v.gainAccountId,v.lossAccountId]).size===3)}),
 z.object({action:z.literal('cancel_settlement'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,expectedRevision:revision,settlementId:uuid,reason:z.string().trim().min(1).max(1000)}).strict()})
]);
export type FxCommand=z.infer<typeof fxCommandSchema>;
export const fxReceiptSchema=z.object({firmId:uuid,positionId:uuid,revision,journalId:uuid}).strict();
const cancellation={cancelled:z.boolean(),reversalId:uuid.nullable(),reason:z.string().min(1).max(1000).nullable(),cancelDate:z.iso.date().nullable(),cancelSequence:revision.nullable()};
const event=z.object({id:uuid,sequence:revision,journalId:uuid,foreignMinor:money.optional(),previousRsd:money,targetRsd:money,delta:signed,...fxRateFields,postingDate:z.iso.date(),createdAt:z.iso.datetime({offset:true}),...cancellation}).strict();
const settlement=z.object({id:uuid,sequence:revision,journalId:uuid,foreignMinor:money,previousForeign:money,previousRsd:money,carryingRsd:money,paidRsd:money,delta:signed,cashAccountId:uuid,gainAccountId:uuid,lossAccountId:uuid,currency:z.enum(['EUR','USD','CHF','GBP']),sourceAccount:z.string().regex(/^[A-Z0-9]{5,64}$/),sourceId:z.string().min(1).max(200),...fxRateFields,postingDate:z.iso.date(),createdAt:z.iso.datetime({offset:true}),...cancellation,bank:z.object({transactionId:uuid,previousForeign:money,previousRsd:money}).strict().nullable().optional()}).strict();
export const fxWorkspaceSchema=z.object({firmId:uuid,generatedAt:z.iso.datetime({offset:true}),positions:z.array(z.object({id:uuid,revision,sourceJournalId:uuid,accountId:uuid,partnerId:uuid,direction:z.enum(['receivable','payable']),currency:z.enum(['EUR','USD','CHF','GBP']),foreignMinor:money,initialRsd:money,...fxRateFields,postingDate:z.iso.date(),closed:z.boolean(),externalMovements:z.boolean(),analyticBalance:signed,events:z.array(event).max(5000),settlements:z.array(settlement).max(5000).optional(),closure:z.object({sequence:revision,journalId:uuid,postingDate:z.iso.date(),reason:z.string().min(1).max(1000)}).strict().nullable()}).strict()).max(500)}).strict();
export type FxWorkspace=z.infer<typeof fxWorkspaceSchema>;
export type FxPosition=FxWorkspace['positions'][number];
export const parseFxRate=(s:string)=>{const v=s.trim().replace(',','.');if(!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(v))throw new Error('invalid_rate');const [whole,fraction='']=v.split('.');const n=(BigInt(whole)*BigInt(1000000)+BigInt(fraction.padEnd(6,'0'))).toString();return fxRateFields.rateMicros.parse(n);};
export const formatFxRate=(s:string)=>`${BigInt(s)/BigInt(1000000)}.${(BigInt(s)%BigInt(1000000)).toString().padStart(6,'0')}`;
export const convertFx=(amount:string,rate:string,units:'1'|'100')=>{money.parse(amount);fxRateFields.rateMicros.parse(rate);fxRateFields.quoteUnits.parse(units);const denominator=BigInt(units)*BigInt(1000000),numerator=BigInt(amount)*BigInt(rate);return money.parse(((numerator*BigInt(2)+denominator)/(denominator*BigInt(2))).toString());};
export const fxRemaining=(p:FxPosition)=>p.closed?'0':(BigInt(p.foreignMinor)-(p.settlements||[]).filter(s=>!s.cancelled).reduce((sum,s)=>sum+BigInt(s.foreignMinor),BigInt(0))).toString();
export const fxCarrying=(p:FxPosition)=>p.closed?'0':(BigInt(p.initialRsd)+p.events.filter(e=>!e.cancelled).reduce((s,e)=>s+BigInt(e.delta),BigInt(0))-(p.settlements||[]).filter(s=>!s.cancelled).reduce((sum,s)=>sum+BigInt(s.carryingRsd),BigInt(0))).toString();
/** Half-up allocation; the final settlement consumes the entire carrying remainder. */
export const allocateFxCarrying=(carrying:string,remaining:string,amount:string)=>{
 money.parse(carrying);money.parse(remaining);money.parse(amount);const a=BigInt(amount),r=BigInt(remaining),c=BigInt(carrying);
 if(a>r)throw new Error('payment_cap');const value=a===r?c:(c*a*BigInt(2)+r)/(r*BigInt(2));
 if(value<=BigInt(0)||(a<r&&value>=c))throw new Error('payment_precision');return value.toString();
};
export const fxLatestActive=(p:FxPosition)=>[...p.events.filter(e=>!e.cancelled).map(e=>({id:e.id,sequence:e.sequence,kind:'value' as const})),...(p.settlements||[]).filter(s=>!s.cancelled).map(s=>({id:s.id,sequence:s.sequence,kind:'payment' as const}))].sort((a,b)=>Number(b.sequence)-Number(a.sequence))[0];
export type FxPreviewLine={accountId:string;partnerId:string|null;debit:string;credit:string};
export const fxPreview=(command:FxCommand,p?:FxPosition):FxPreviewLine[]=>{
 const c=fxCommandSchema.parse(command);if(c.action!=='create'&&c.action!=='revalue'&&c.action!=='settle')throw new Error('source_preview_required');
 if(c.action==='settle'){
  if(!p||p.id!==c.data.id||p.closed||p.externalMovements||p.revision!==c.data.expectedRevision||p.currency!==c.data.currency)throw new Error('stale_preview');
  const d=c.data,carrying=allocateFxCarrying(fxCarrying(p),fxRemaining(p),d.foreignMinor),paid=convertFx(d.foreignMinor,d.rateMicros,d.quoteUnits),delta=BigInt(paid)-BigInt(carrying),asset=p.direction==='receivable';
  const lines:FxPreviewLine[]=[{accountId:d.cashAccountId,partnerId:null,debit:asset?paid:'0',credit:asset?'0':paid},{accountId:p.accountId,partnerId:p.partnerId,debit:asset?'0':carrying,credit:asset?carrying:'0'}];
  if(delta!==BigInt(0)){const debit=asset===(delta<BigInt(0)),value=(delta<BigInt(0)?-delta:delta).toString();lines.push({accountId:debit?d.lossAccountId:d.gainAccountId,partnerId:null,debit:debit?value:'0',credit:debit?'0':value});}return lines;
 }
 const d=c.data;let value:string,account:string,partner:string,contra:string,debit:boolean;
 if(c.action==='create'){value=convertFx(c.data.foreignMinor,d.rateMicros,d.quoteUnits);account=c.data.accountId;partner=c.data.partnerId;contra=c.data.counterAccountId;debit=c.data.direction==='receivable';}
 else {if(!p||p.id!==d.id||p.closed||p.externalMovements||p.revision!==d.expectedRevision)throw new Error('stale_preview');const delta=BigInt(convertFx(fxRemaining(p),d.rateMicros,d.quoteUnits))-BigInt(fxCarrying(p));if(delta===BigInt(0))throw new Error('no_change');value=(delta<BigInt(0)?-delta:delta).toString();account=p.accountId;partner=p.partnerId;debit=(p.direction==='receivable')===(delta>BigInt(0));contra=debit?c.data.gainAccountId:c.data.lossAccountId;}
 return [{accountId:account,partnerId:partner,debit:debit?value:'0',credit:debit?'0':value},{accountId:contra,partnerId:null,debit:debit?'0':value,credit:debit?value:'0'}];
};
export const verifyFxWorkspace=(w:FxWorkspace,firmId:string)=>{
 if(w.firmId!==firmId||new Set(w.positions.map(p=>p.id)).size!==w.positions.length)return false;
 const journals=new Set<string>(),sources=new Set<string>(),sourceKinds=new Map<string,string|null>();
 try{for(const p of w.positions){
  const payments=p.settlements||[];
  if(!rateValid(p)||convertFx(p.foreignMinor,p.rateMicros,p.quoteUnits)!==p.initialRsd||p.closed!==(p.closure!==null)||journals.has(p.sourceJournalId))return false;journals.add(p.sourceJournalId);
  let current=p.initialRsd,foreign=p.foreignMinor,lastDate=p.postingDate;
  const active:{id:string;rsd:string;foreign:string}[]=[];
  const history=[
   ...p.events.map(e=>({sequence:e.sequence,type:'value' as const,e,date:e.postingDate})),
   ...payments.map(e=>({sequence:e.sequence,type:'payment' as const,e,date:e.postingDate})),
   ...[...p.events,...payments].filter(e=>e.cancelled).map(e=>({sequence:e.cancelSequence!,type:'cancel' as const,e,date:e.cancelDate!}))
  ].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  let seq=BigInt(1);
  for(const h of history){seq++;if(h.sequence!==seq.toString()||h.date<lastDate)return false;lastDate=h.date;
   if(h.type==='value'){
    const e=h.e;
    if(!rateValid(e)||(e.foreignMinor!==undefined?e.foreignMinor!==foreign:payments.length>0)||e.previousRsd!==current||convertFx(foreign,e.rateMicros,e.quoteUnits)!==e.targetRsd||(BigInt(e.targetRsd)-BigInt(current)).toString()!==e.delta||e.delta==='0'||journals.has(e.journalId)||e.id!==e.journalId)return false;
    journals.add(e.journalId);active.push({id:e.id,rsd:current,foreign});current=e.targetRsd;
   }else if(h.type==='payment'){
    const e=h.e,key=JSON.stringify([e.sourceAccount,e.sourceId,e.bank?e.id:null]);
    const identity=JSON.stringify([e.sourceAccount,e.sourceId]),kind=e.bank?.transactionId||null;
    if(sourceKinds.has(identity)&&sourceKinds.get(identity)!==kind)return false;sourceKinds.set(identity,kind);
    const paid=e.bank?allocateFxCarrying(e.bank.previousRsd,e.bank.previousForeign,e.foreignMinor):convertFx(e.foreignMinor,e.rateMicros,e.quoteUnits);
    if(!rateValid(e)||sources.has(key)||e.currency!==p.currency||e.previousForeign!==foreign||e.previousRsd!==current||allocateFxCarrying(current,foreign,e.foreignMinor)!==e.carryingRsd||paid!==e.paidRsd||(BigInt(e.paidRsd)-BigInt(e.carryingRsd)).toString()!==e.delta||new Set([p.accountId,e.cashAccountId,e.gainAccountId,e.lossAccountId]).size!==4||journals.has(e.journalId)||e.id!==e.journalId)return false;
    sources.add(key);journals.add(e.journalId);active.push({id:e.id,rsd:current,foreign});current=(BigInt(current)-BigInt(e.carryingRsd)).toString();foreign=(BigInt(foreign)-BigInt(e.foreignMinor)).toString();
   }else{
    const e=h.e,last=active.pop();if(!last||last.id!==e.id||!e.reversalId||!e.reason||journals.has(e.reversalId))return false;journals.add(e.reversalId);current=last.rsd;foreign=last.foreign;
   }
  }
  if([...p.events,...payments].some(e=>e.cancelled!==(e.reversalId!==null)||e.cancelled!==(e.reason!==null)||e.cancelled!==(e.cancelDate!==null)||e.cancelled!==(e.cancelSequence!==null)))return false;
  if(p.closure){seq++;if(active.length||p.closure.sequence!==seq.toString()||p.closure.postingDate<lastDate||journals.has(p.closure.journalId))return false;journals.add(p.closure.journalId);current='0';foreign='0';}
  if(seq.toString()!==p.revision||current!==fxCarrying(p)||foreign!==fxRemaining(p)||(!p.closed&&!p.externalMovements&&(BigInt(current)*(p.direction==='receivable'?BigInt(1):BigInt(-1))).toString()!==p.analyticBalance))return false;
 }return true;}catch{return false;}
};
