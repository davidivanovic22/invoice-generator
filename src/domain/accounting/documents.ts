import { accountingUuid } from './identifiers';
import { z } from 'zod';
import { minorUnits } from './journal';
import { paymentStatus } from './payments';
const amount = z.string().refine(value => { try { minorUnits(value); return true; } catch { return false; } });
const revision = z.string().regex(/^(0|[1-9]\d*)$/);
export const businessDocumentSchema = z.object({
  id:accountingUuid,firmId:accountingUuid,partnerId:accountingUuid,direction:z.enum(['incoming','outgoing']),kind:z.enum(['invoice','advance','credit_note']),referenceId:accountingUuid.nullable(),
  number:z.string().trim().min(1).max(100),documentDate:z.iso.date(),dueDate:z.iso.date(),description:z.string(),currency:z.literal('RSD'),
  lines:z.array(z.object({ id:z.string().min(1).max(100),description:z.string().trim().min(1).max(500),net:amount,tax:amount }).strict()).min(1).max(1000)
}).strict().refine(d => d.dueDate>=d.documentDate && ((d.kind==='credit_note') === (d.referenceId!==null)) && d.referenceId!==d.id);
export const businessDocumentReadSchema = z.object({ document:businessDocumentSchema,revision,lifecycle:z.enum(['draft','issued']),partnerName:z.string(),issuedAt:z.iso.datetime({offset:true}).nullable(),issuedBy:accountingUuid.nullable(),
  workflow:z.object({ revision,approval:z.enum(['pending','approved','rejected']),delivery:z.enum(['not_recorded','sent']) }),payment:paymentStatus,journalId:accountingUuid.nullable() });
export const documentCommandSchema = z.discriminatedUnion('action',[
  z.object({ action:z.literal('save'),data:businessDocumentSchema,expectedRevision:revision,idempotencyKey:z.string().min(1).max(100) }),
  z.object({ action:z.enum(['issue','approve','reject','record_delivery']),data:z.object({ firmId:accountingUuid,id:accountingUuid,evidence:z.string().trim().min(1).max(1000).optional() }).strict(),expectedRevision:revision,idempotencyKey:z.string().min(1).max(100) })
]);
export const documentReceiptSchema = z.object({ firmId:accountingUuid,documentId:accountingUuid,revision:z.string().regex(/^[1-9]\d*$/),action:z.enum(['save','issue','approve','reject','record_delivery']) }).strict();
export type BusinessDocument = z.infer<typeof businessDocumentReadSchema>;
export type DocumentCommand = z.infer<typeof documentCommandSchema>;
