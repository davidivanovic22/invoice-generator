import { accountingUuid } from './identifiers';
import { z } from 'zod';
import { minorUnits } from './journal';
import { businessDocumentReadSchema } from './documents';
const amount=z.string().refine(value=>{try{minorUnits(value);return true;}catch{return false;}});
const common={firmId:accountingUuid,id:accountingUuid,periodId:accountingUuid,postingDate:z.iso.date()};
export const advanceCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('apply'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('0'),advanceId:accountingUuid,invoiceId:accountingUuid,advanceRevision:z.string().regex(/^[1-9]\d*$/),invoiceRevision:z.string().regex(/^[1-9]\d*$/),fiscalYearId:accountingUuid,invoiceAccountId:accountingUuid,advanceAccountId:accountingUuid,net:amount,tax:amount}).strict().refine(d=>d.advanceId!==d.invoiceId&&d.advanceAccountId!==d.invoiceAccountId&&BigInt(d.net)+BigInt(d.tax)>BigInt(0))}),
 z.object({action:z.literal('cancel'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('1'),reason:z.string().trim().min(1).max(1000)}).strict()})
]);
export const advanceReceiptSchema=z.object({firmId:accountingUuid,applicationId:accountingUuid,revision:z.enum(['1','2']),journalId:accountingUuid}).strict();
export const advanceWorkspaceSchema=z.object({firmId:accountingUuid,invoiceId:accountingUuid,remainingNet:amount,remainingTax:amount,
 advances:z.array(z.object({source:businessDocumentReadSchema,remainingNet:amount,remainingTax:amount})),
 applications:z.array(z.object({id:accountingUuid,advanceId:accountingUuid,net:amount,tax:amount,revision:z.enum(['1','2']),status:z.enum(['active','cancelled']),journalId:accountingUuid,reversalId:accountingUuid.nullable(),reason:z.string().nullable()}))});
export type AdvanceCommand=z.infer<typeof advanceCommandSchema>;
export type AdvanceWorkspace=z.infer<typeof advanceWorkspaceSchema>;
