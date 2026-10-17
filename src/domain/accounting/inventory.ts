import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
const amount=z.string().regex(/^(0|[1-9]\d{0,23})$/),positive=z.string().regex(/^[1-9]\d{0,23}$/),revision=z.string().regex(/^(0|[1-9]\d{0,8})$/);
const common={firmId:uuid,itemId:uuid,expectedRevision:revision};
const posting={...common,fiscalYearId:uuid,periodId:uuid,postingDate:z.iso.date()};
const movement={...posting,journalId:uuid,quantity:positive,counterAccountId:uuid,partnerId:uuid.optional(),externalId:z.string().trim().min(1).max(200)};
export const stockCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('0'),sku:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),warehouse:z.string().trim().min(1).max(100),unit:z.string().trim().min(1).max(20),accountId:uuid}).strict()}),
 z.object({action:z.literal('receipt'),idempotencyKey:z.string().min(1).max(100),data:z.object({...movement,value:positive}).strict()}),
 z.object({action:z.literal('issue'),idempotencyKey:z.string().min(1).max(100),data:z.object(movement).strict()}),
 z.object({action:z.literal('cancel'),idempotencyKey:z.string().min(1).max(100),data:z.object({...posting,targetId:uuid,reason:z.string().trim().min(1).max(1000)}).strict()})
]);
export type StockCommand=z.infer<typeof stockCommandSchema>;
export const stockReceiptSchema=z.object({firmId:uuid,itemId:uuid,revision,journalId:uuid.nullable()}).strict();
export const stockWorkspaceSchema=z.object({firmId:uuid,
 items:z.array(z.object({id:uuid,sku:z.string().min(1),name:z.string().min(1),warehouse:z.string().min(1),unit:z.string().min(1),accountId:uuid,revision,quantity:amount,value:amount,externalMovements:z.boolean()}).strict()).max(1000),
 movements:z.array(z.object({id:uuid,itemId:uuid,sequence:revision,kind:z.enum(['receipt','issue']),quantity:positive,value:positive,previousQuantity:amount,previousValue:amount,counterAccountId:uuid,partnerId:uuid.nullable(),externalId:z.string().min(1),postingDate:z.iso.date()}).strict()).max(10000),
 cancellations:z.array(z.object({movementId:uuid,itemId:uuid,journalId:uuid,sequence:revision,postingDate:z.iso.date(),reason:z.string().min(1)}).strict()).max(10000),
 accounts:z.array(z.object({id:uuid,balance:z.string().regex(/^(0|-?[1-9]\d{0,39})$/)}).strict()).max(1000)
}).strict();
export type StockWorkspace=z.infer<typeof stockWorkspaceSchema>;
export const stockIssueValue=(quantity:string,value:string,issued:string)=>{
 const q=BigInt(amount.parse(quantity)),v=BigInt(amount.parse(value)),n=BigInt(positive.parse(issued));
 if(n>q)throw new Error('stock_insufficient');
 const result=n===q?v:(v*n*BigInt(2)+q)/(q*BigInt(2));
 if(result<=BigInt(0)||(n<q&&result>=v))throw new Error('stock_precision');
 return positive.parse(result.toString());
};
export const parseQuantity=(text:string)=>{
 const v=text.trim().replace(',','.');if(!/^\d+(\.\d{1,3})?$/.test(v))throw new Error('quantity');
 const [whole,fraction='']=v.split('.');return positive.parse((BigInt(whole)*BigInt(1000)+BigInt(fraction.padEnd(3,'0'))).toString());
};
export const formatQuantity=(quantity:string)=>{const v=BigInt(quantity);return `${v/BigInt(1000)}.${(v%BigInt(1000)).toString().padStart(3,'0')}`;};
export const verifyStockWorkspace=(w:StockWorkspace,firmId:string)=>{
 try{
 if(w.firmId!==firmId||new Set(w.items.map(i=>i.id)).size!==w.items.length||new Set(w.items.map(i=>JSON.stringify([i.warehouse,i.sku]))).size!==w.items.length||new Set(w.accounts.map(a=>a.id)).size!==w.accounts.length)return false;
 const identifiers=new Set<string>(),sources=new Set<string>();
 for(const m of w.movements){if(identifiers.has(m.id)||sources.has(m.externalId)||!w.items.some(i=>i.id===m.itemId))return false;identifiers.add(m.id);sources.add(m.externalId);}
 const cancelled=new Set<string>();for(const c of w.cancellations){if(cancelled.has(c.movementId)||identifiers.has(c.journalId)||!w.movements.some(m=>m.id===c.movementId&&m.itemId===c.itemId))return false;cancelled.add(c.movementId);identifiers.add(c.journalId);}
 const balances=new Map<string,bigint>();
 for(const item of w.items){
  let q=BigInt(0),v=BigInt(0),rev=BigInt(1),date='';const active:Array<StockWorkspace['movements'][number]>=[];
  const history=[...w.movements.filter(m=>m.itemId===item.id).map(m=>({type:'movement' as const,m})),...w.cancellations.filter(c=>c.itemId===item.id).map(c=>({type:'cancel' as const,m:c}))].sort((a,b)=>Number(a.m.sequence)-Number(b.m.sequence));
  for(const e of history){rev++;if(e.m.sequence!==rev.toString()||e.m.postingDate<date)return false;date=e.m.postingDate;
   if(e.type==='cancel'){const m=active.pop();if(!m||m.id!==e.m.movementId)return false;q=BigInt(m.previousQuantity);v=BigInt(m.previousValue);}
   else {const m=e.m;if(m.previousQuantity!==q.toString()||m.previousValue!==v.toString()||m.counterAccountId===item.accountId||w.items.some(i=>i.accountId===m.counterAccountId))return false;
    if(m.kind==='receipt'){q+=BigInt(m.quantity);v+=BigInt(m.value);}else{if(stockIssueValue(q.toString(),v.toString(),m.quantity)!==m.value)return false;q-=BigInt(m.quantity);v-=BigInt(m.value);}active.push(m);
   }
  }
  if(rev.toString()!==item.revision||q.toString()!==item.quantity||v.toString()!==item.value||q<BigInt(0)||v<BigInt(0)||q>=BigInt('1000000000000000000000000')||v>=BigInt('1000000000000000000000000'))return false;
  balances.set(item.accountId,(balances.get(item.accountId)||BigInt(0))+v);
 }
 if(w.accounts.length!==balances.size)return false;
 return w.accounts.every(a=>balances.has(a.id)&&(w.items.some(i=>i.accountId===a.id&&i.externalMovements)||balances.get(a.id)===BigInt(a.balance)));
 }catch{return false;}
};
export const stockPreview=(command:StockCommand,w:StockWorkspace)=>{
 const c=stockCommandSchema.parse(command),i=w.items.find(i=>i.id===c.data.itemId);
 if(c.action==='create'||c.action==='cancel')throw new Error('stock_preview_kind');
 if(!i||i.externalMovements||w.firmId!==c.data.firmId||i.revision!==c.data.expectedRevision||c.data.counterAccountId===i.accountId||w.items.some(i=>i.accountId===c.data.counterAccountId))throw new Error('stock_context');
 const value=c.action==='receipt'?c.data.value:stockIssueValue(i.quantity,i.value,c.data.quantity);
 if(c.action==='receipt'&&(BigInt(i.quantity)+BigInt(c.data.quantity)>=BigInt('1000000000000000000000000')||BigInt(i.value)+BigInt(value)>=BigInt('1000000000000000000000000')))throw new Error('stock_overflow');
 return [{accountId:i.accountId,partnerId:null,debit:c.action==='receipt'?value:'0',credit:c.action==='issue'?value:'0'},{accountId:c.data.counterAccountId,partnerId:c.data.partnerId||null,debit:c.action==='issue'?value:'0',credit:c.action==='receipt'?value:'0'}];
};
