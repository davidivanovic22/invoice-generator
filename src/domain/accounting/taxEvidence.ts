import { z } from 'zod';
import { accountingUuid } from './identifiers';
import { businessDocumentReadSchema, type BusinessDocument } from './documents';
import { evaluateTaxReference, REDUCED_POINTS, TAX_POLICY, TAX_SOURCES } from './tax';

const revision=z.string().regex(/^(0|[1-9]\d*)$/),amount=z.string().regex(/^(0|[1-9]\d{0,23})$/),evidence=z.string().trim().min(1).max(1000);
const category=z.enum(['standard','reduced','small_taxpayer']);
const decision=z.object({lineId:z.string().min(1).max(100),category,reducedPoint:z.enum(REDUCED_POINTS).optional(),classificationEvidence:z.string().trim().max(1000),deductible:amount,deductionEvidence:z.string().trim().max(1000)}).strict();
const common={firmId:accountingUuid,id:accountingUuid,expectedRevision:revision};
export const taxCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create_profile'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,legalForm:z.enum(['doo','sole_trader']),regime:z.enum(['regular_vat','small_taxpayer']),frequency:z.enum(['monthly','quarterly','none']),validFrom:z.iso.date(),validTo:z.iso.date(),evidence,policyId:z.literal(TAX_POLICY.id)}).strict().refine(p=>p.validFrom<=p.validTo&&p.validFrom>=TAX_POLICY.validFrom&&p.validTo<=TAX_POLICY.validTo&&((p.regime==='small_taxpayer')===(p.frequency==='none')))}),
 z.object({action:z.literal('record'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,profileId:accountingUuid,documentId:accountingUuid,documentRevision:revision,fiscalYearId:accountingUuid,periodId:accountingUuid,taxDate:z.iso.date(),policyId:z.literal(TAX_POLICY.id),evidence,confirmedOrdinaryDomesticSupply:z.literal(true),lines:z.array(decision).min(1).max(1000)}).strict()}),
 z.object({action:z.literal('cancel_profile'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,reason:evidence}).strict()}),
 z.object({action:z.literal('end_profile'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,endsOn:z.iso.date(),reason:evidence}).strict()}),
 z.object({action:z.literal('cancel_event'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,periodId:accountingUuid,reason:evidence}).strict()}),
]);
export type TaxCommand=z.infer<typeof taxCommandSchema>;
export const taxReceiptSchema=z.object({firmId:accountingUuid,id:accountingUuid,action:z.enum(['create_profile','record','cancel_profile','end_profile','cancel_event']),revision}).strict();
const history={createdBy:accountingUuid,createdAt:z.iso.datetime({offset:true}),cancelled:z.boolean(),cancelReason:evidence.nullable()};
export const taxProfileSchema=z.object({id:accountingUuid,legalForm:z.enum(['doo','sole_trader']),regime:z.enum(['regular_vat','small_taxpayer']),frequency:z.enum(['monthly','quarterly','none']),validFrom:z.iso.date(),validTo:z.iso.date(),ending:z.object({endsOn:z.iso.date(),reason:evidence,createdBy:accountingUuid,createdAt:z.iso.datetime({offset:true})}).strict().nullable(),evidence,policyId:z.literal(TAX_POLICY.id),...history}).strict();
export const taxProfileEnd=(p:z.infer<typeof taxProfileSchema>)=>p.ending?.endsOn??p.validTo;
export const taxWorkspaceSchema=z.object({firmId:accountingUuid,yearId:accountingUuid,from:z.iso.date(),to:z.iso.date(),revision,
 policies:z.array(z.object({id:z.literal(TAX_POLICY.id),validFrom:z.iso.date(),validTo:z.iso.date(),lawSha256:z.string(),bylawSha256:z.string()}).strict()).length(1),
 profiles:z.array(taxProfileSchema).max(1000),documents:z.array(businessDocumentReadSchema.extend({sourceReversed:z.boolean()})).max(1000),
 events:z.array(z.object({id:accountingUuid,profileId:accountingUuid,documentId:accountingUuid,documentRevision:revision,periodId:accountingUuid,taxDate:z.iso.date(),policyId:z.literal(TAX_POLICY.id),evidence,...history,
  lines:z.array(decision.extend({net:amount,tax:amount,reducedPoint:z.enum(REDUCED_POINTS).nullable()})).min(1).max(1000)}).strict()).max(10000)
}).strict();
export type TaxWorkspace=z.infer<typeof taxWorkspaceSchema>;

export const previewTaxRecord=(c:Extract<TaxCommand,{action:'record'}>,w:TaxWorkspace,doc:BusinessDocument)=>{
 const d=c.data,p=w.profiles.find(p=>p.id===d.profileId&&!p.cancelled);
 if(!p||d.firmId!==w.firmId||d.fiscalYearId!==w.yearId||d.documentId!==doc.document.id||doc.document.firmId!==w.firmId||doc.revision!==d.documentRevision||doc.lifecycle!=='issued'||doc.document.kind!=='invoice'||doc.document.documentDate!==d.taxDate||!doc.journalId||doc.workflow.approval!=='approved')throw new Error('invalid_tax_source');
 if(d.lines.length!==doc.document.lines.length||new Set(d.lines.map(l=>l.lineId)).size!==d.lines.length)throw new Error('invalid_tax_lines');
 return d.lines.map(l=>{
  const src=doc.document.lines.find(s=>s.id===l.lineId);if(!src)throw new Error('invalid_tax_lines');
  const r=evaluateTaxReference({firmId:w.firmId,profile:{firmId:w.firmId,legalForm:p.legalForm,regime:p.regime,method:'accrual',validFrom:p.validFrom,validTo:taxProfileEnd(p),evidence:p.evidence},
   direction:doc.document.direction==='outgoing'?'sale':'purchase',category:l.category,event:'supply',supplyDate:d.taxDate,netMinor:src.net,currency:'RSD',domestic:true,ordinarySupply:true,supplierIsTaxDebtor:true,
   ...(l.reducedPoint?{reducedPoint:l.reducedPoint}:{}),classificationEvidence:l.classificationEvidence});
  if(r.status!=='supported'||r.vatMinor!==src.tax||BigInt(l.deductible)>BigInt(src.tax)||(doc.document.direction==='outgoing'&&l.deductible!=='0')||(doc.document.direction==='incoming'&&!l.deductionEvidence.trim()))throw new Error('invalid_tax_calculation');
  return {...l,net:src.net,tax:src.tax,reducedPoint:l.reducedPoint||null};
 });
};
const unique=(xs:Array<{id:string}>)=>new Set(xs.map(x=>x.id)).size===xs.length;
export const verifyTaxWorkspace=(w:TaxWorkspace,f:string,y:string)=>{
 try{
  if(w.firmId!==f||w.yearId!==y||w.from>w.to||!unique(w.profiles)||!unique(w.events)||!unique(w.documents.map(d=>d.document)))return false;
  const pol=w.policies[0];if(pol.validFrom!==TAX_POLICY.validFrom||pol.validTo!==TAX_POLICY.validTo||pol.lawSha256!==TAX_SOURCES[0].sha256||pol.bylawSha256!==TAX_SOURCES[1].sha256)return false;
  for(const p of w.profiles){if(p.validFrom>p.validTo||p.validFrom<pol.validFrom||p.validTo>pol.validTo||((p.regime==='small_taxpayer')!==(p.frequency==='none'))||p.cancelled!==(p.cancelReason!==null)||(p.ending&&(p.cancelled||p.ending.endsOn<p.validFrom||p.ending.endsOn>=p.validTo)))return false;}
  const active=w.profiles.filter(p=>!p.cancelled).sort((a,b)=>a.validFrom.localeCompare(b.validFrom));if(active.some((p,i)=>i>0&&taxProfileEnd(active[i-1])>=p.validFrom))return false;
  for(const d of w.documents)if(d.document.firmId!==f||d.lifecycle!=='issued'||d.document.documentDate<w.from||d.document.documentDate>w.to)return false;
  for(const e of w.events){
   const d=w.documents.find(d=>d.document.id===e.documentId);if(!d||e.cancelled!==(e.cancelReason!==null)||(!e.cancelled&&d.sourceReversed))return false;
   const profile=w.profiles.find(p=>p.id===e.profileId);if(!profile||profile.cancelled)return false;
   const lines=previewTaxRecord({action:'record',idempotencyKey:'verify',data:{firmId:f,id:e.id,expectedRevision:w.revision,profileId:e.profileId,documentId:e.documentId,documentRevision:e.documentRevision,fiscalYearId:y,periodId:e.periodId,taxDate:e.taxDate,policyId:e.policyId,evidence:e.evidence,confirmedOrdinaryDomesticSupply:true,lines:e.lines.map(l=>({lineId:l.lineId,category:l.category,reducedPoint:l.reducedPoint||undefined,classificationEvidence:l.classificationEvidence,deductible:l.deductible,deductionEvidence:l.deductionEvidence}))}},w,d);
   if(lines.some((l,i)=>l.net!==e.lines[i].net||l.tax!==e.lines[i].tax))return false;
  }
  if(new Set(w.events.filter(e=>!e.cancelled).map(e=>e.documentId)).size!==w.events.filter(e=>!e.cancelled).length)return false;
  return true;
 }catch{return false;}
};
export const taxPeriodReport=(w:TaxWorkspace,from:string,to:string)=>{
 if(!verifyTaxWorkspace(w,w.firmId,w.yearId)||!z.iso.date().safeParse(from).success||!z.iso.date().safeParse(to).success||from<w.from||to>w.to||from>to)throw new Error('invalid_tax_report');
 const profiles=w.profiles.filter(p=>!p.cancelled&&p.validFrom<=from&&taxProfileEnd(p)>=to);
 if(profiles.length!==1)throw new Error('missing_tax_profile');const p=profiles[0];
 const [year,month,day]=from.split('-').map(Number),months=p.frequency==='quarterly'?3:1;
 const end=new Date(Date.UTC(year,month-1+months,0)).toISOString().slice(0,10);
 if(day!==1||end!==to||(months===3&&(month-1)%3!==0))throw new Error('invalid_tax_period');
 const docs=w.documents.filter(d=>!d.sourceReversed&&d.document.documentDate>=from&&d.document.documentDate<=to);
 const events=w.events.filter(e=>!e.cancelled&&e.taxDate>=from&&e.taxDate<=to);
 const missing=docs.filter(d=>!events.some(e=>e.documentId===d.document.id));
 let output=BigInt(0),input=BigInt(0),deductible=BigInt(0);
 const rows=events.flatMap(e=>{const d=docs.find(d=>d.document.id===e.documentId);if(!d||e.profileId!==p.id)throw new Error('invalid_tax_report');return e.lines.map(l=>{
  if(d.document.direction==='outgoing')output+=BigInt(l.tax);else{input+=BigInt(l.tax);deductible+=BigInt(l.deductible);}
  return {...l,eventId:e.id,documentId:e.documentId,number:d.document.number,direction:d.document.direction,taxDate:e.taxDate,policyId:e.policyId,evidence:e.evidence};
 });});
 return {firmId:w.firmId,yearId:w.yearId,revision:w.revision,from,to,profile:p,rows,missing:missing.map(d=>({id:d.document.id,number:d.document.number,kind:d.document.kind})),
  output:output.toString(),input:input.toString(),deductible:deductible.toString(),difference:(output-deductible).toString(),complete:missing.length===0};
};
