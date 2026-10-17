import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
const money=z.string().regex(/^(0|[1-9]\d{0,39})$/);
const lineMoney=z.string().regex(/^(0|[1-9]\d{0,23})$/);
const signed=z.string().regex(/^(0|-?[1-9]\d{0,39})$/);
const date=z.iso.date();
export const reportQuerySchema=z.object({firmId:uuid,yearId:uuid,from:date,to:date}).strict().refine(q=>q.from<=q.to);
export type ReportQuery=z.infer<typeof reportQuerySchema>;
export const accountingReportSchema=z.object({firmId:uuid,firmName:z.string(),yearId:uuid,yearLabel:z.number().int().min(1900).max(9999),yearStart:date,yearEnd:date,from:date,to:date,currency:z.literal('RSD'),generatedAt:z.iso.datetime({offset:true}),journalCount:money,lineCount:money,
 lines:z.array(z.object({journalId:uuid,number:z.string().min(1),postingDate:date,postedAt:z.iso.datetime({offset:true}),journalDescription:z.string(),reversalOf:uuid.nullable(),reason:z.string().nullable(),lineId:z.string().min(1).max(100),accountId:uuid,accountCode:z.string(),accountName:z.string(),partnerId:uuid.nullable(),partnerName:z.string().nullable(),description:z.string(),debit:lineMoney,credit:lineMoney,opening:z.boolean().optional()}).strict()).max(10000),
 accounts:z.array(z.object({accountId:uuid,code:z.string(),name:z.string(),openingDebit:money,openingCredit:money,debit:money,credit:money,openingBalance:signed,closingBalance:signed}).strict()).max(5000),
 totals:z.object({openingDebit:money,openingCredit:money,debit:money,credit:money,openingBalanceDebit:money,openingBalanceCredit:money,closingBalanceDebit:money,closingBalanceCredit:money}).strict()
}).strict();
export type AccountingReport=z.infer<typeof accountingReportSchema>;

/** Refuse inconsistent snapshots before rendering or exporting financial totals. */
export const verifyReport=(r:AccountingReport,q:ReportQuery)=>{
 if(r.firmId!==q.firmId||r.yearId!==q.yearId||r.from!==q.from||r.to!==q.to||r.from<r.yearStart||r.to>r.yearEnd||r.yearStart>r.yearEnd)return false;
 if(new Set(r.accounts.map(a=>a.accountId)).size!==r.accounts.length||String(r.lines.length)!==r.lineCount)return false;
 const accounts=new Map(r.accounts.map(a=>[a.accountId,a]));
 const movements=new Map<string,{debit:bigint;credit:bigint}>(),journals=new Map<string,{debit:bigint;credit:bigint;key:string}>(),seen=new Set<string>();
 let last='';
 for(const l of r.lines){
  const key=JSON.stringify([l.journalId,l.lineId]),order=`${l.postingDate}|${l.postedAt}|${l.journalId}`;
  if(seen.has(key)||!accounts.has(l.accountId)||l.postingDate<r.from||l.postingDate>r.to||order<last||(l.partnerId===null)!==(l.partnerName===null)||(l.reversalOf===null)!==(l.reason===null))return false;
  seen.add(key);last=order;
  const d=BigInt(l.debit),c=BigInt(l.credit);if((d>BigInt(0))===(c>BigInt(0)))return false;
  if(!l.opening){const m=movements.get(l.accountId)||{debit:BigInt(0),credit:BigInt(0)};m.debit+=d;m.credit+=c;movements.set(l.accountId,m);}
  const journalKey=JSON.stringify([l.number,l.postingDate,l.postedAt,l.journalDescription,l.reversalOf,l.reason]);
  const j=journals.get(l.journalId)||{debit:BigInt(0),credit:BigInt(0),key:journalKey};if(j.key!==journalKey)return false;j.debit+=d;j.credit+=c;journals.set(l.journalId,j);
 }
 if(String(journals.size)!==r.journalCount||Array.from(journals.values()).some(j=>j.debit!==j.credit)||new Set(Array.from(journals.values()).map(j=>JSON.parse(j.key)[0])).size!==journals.size)return false;
 const totals={openingDebit:BigInt(0),openingCredit:BigInt(0),debit:BigInt(0),credit:BigInt(0),openingBalanceDebit:BigInt(0),openingBalanceCredit:BigInt(0),closingBalanceDebit:BigInt(0),closingBalanceCredit:BigInt(0)};
 for(const a of r.accounts){
  const od=BigInt(a.openingDebit),oc=BigInt(a.openingCredit),d=BigInt(a.debit),c=BigInt(a.credit),opening=od-oc,closing=opening+d-c;
  const inRangeOpening=r.lines.filter(l=>l.opening&&l.accountId===a.accountId);
  if(inRangeOpening.reduce((s,l)=>s+BigInt(l.debit),BigInt(0))>od||inRangeOpening.reduce((s,l)=>s+BigInt(l.credit),BigInt(0))>oc)return false;
  const m=movements.get(a.accountId);if((m?.debit||BigInt(0))!==d||(m?.credit||BigInt(0))!==c||opening.toString()!==a.openingBalance||closing.toString()!==a.closingBalance)return false;
  totals.openingDebit+=od;totals.openingCredit+=oc;totals.debit+=d;totals.credit+=c;
  totals.openingBalanceDebit+=opening>BigInt(0)?opening:BigInt(0);totals.openingBalanceCredit+=opening<BigInt(0)?-opening:BigInt(0);
  totals.closingBalanceDebit+=closing>BigInt(0)?closing:BigInt(0);totals.closingBalanceCredit+=closing<BigInt(0)?-closing:BigInt(0);
 }
 return Object.entries(totals).every(([k,v])=>v.toString()===r.totals[k as keyof typeof totals])&&totals.openingDebit===totals.openingCredit&&totals.debit===totals.credit&&totals.openingBalanceDebit===totals.openingBalanceCredit&&totals.closingBalanceDebit===totals.closingBalanceCredit;
};

export const ledgerRows=(r:AccountingReport,accountId:string)=>{
 let balance=BigInt(r.accounts.find(a=>a.accountId===accountId)?.openingBalance||'0');
 return r.lines.filter(l=>l.accountId===accountId&&!l.opening).map(l=>{balance+=BigInt(l.debit)-BigInt(l.credit);return {...l,balance:balance.toString()};});
};
