import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { minorUnits } from './journal';

export const paymentAmount = z.string().refine(value => {
  try { minorUnits(value); return true; } catch { return false; }
});
const positive = paymentAmount.refine(value => /^[1-9]\d{0,23}$/.test(value));
export const paymentStatus = z.enum(['not_tracked', 'unpaid', 'partial', 'paid', 'overpaid']);
const balance = z.object({ gross: paymentAmount, credits: paymentAmount, advances: paymentAmount,
  paid: paymentAmount, due: paymentAmount, overpaid: paymentAmount, status: paymentStatus }).strict().refine(b => {
  if ([b.gross,b.credits,b.advances,b.paid,b.due,b.overpaid].some(value => !paymentAmount.safeParse(value).success)) return false;
  const obligation=BigInt(b.gross)-BigInt(b.credits)-BigInt(b.advances);
  const remaining=obligation-BigInt(b.paid);
  const expected=remaining<BigInt(0)?'overpaid':remaining===BigInt(0)?'paid':b.paid==='0'?'unpaid':'partial';
  return obligation>=BigInt(0) && BigInt(b.due)===(remaining>BigInt(0)?remaining:BigInt(0)) &&
    BigInt(b.overpaid)===(remaining<BigInt(0)?-remaining:BigInt(0)) && (b.status==='not_tracked'||b.status===expected);
});
export const paymentCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('allocate'), idempotencyKey: z.string().min(1).max(100), data: z.object({
    firmId: uuid, id: uuid, transactionId: uuid, documentId: uuid, documentRevision: z.string().regex(/^[1-9]\d*$/),
    kind: z.enum(['payment', 'refund']), refundOf: uuid.nullable(), amount: positive,
  }).strict().refine(d => (d.kind === 'refund') === (d.refundOf !== null) && d.refundOf !== d.id) }),
  z.object({ action: z.literal('cancel'), idempotencyKey: z.string().min(1).max(100), data: z.object({
    firmId: uuid, id: uuid, transactionId: uuid, documentId: uuid, expectedRevision: z.literal('1'), reason: z.string().trim().min(1).max(1000),periodId:uuid.optional(),postingDate:z.iso.date().optional(),
  }).strict() }),
]);
export const paymentReceiptSchema = z.object({ firmId: uuid, allocationId: uuid, transactionId: uuid,
  documentId: uuid, revision: z.enum(['1','2']) }).strict();
export const paymentWorkspaceSchema = z.object({ firmId: uuid,
  transaction: z.object({ id: uuid, accountId: uuid, externalId: z.string(), bookingDate: z.iso.date(),
    incoming: paymentAmount, outgoing: paymentAmount, available: paymentAmount }).strict(),
  documents: z.array(z.object({ id: uuid, number: z.string(), partnerName: z.string(), direction: z.enum(['incoming','outgoing']),
    kind: z.enum(['invoice','advance']), revision: z.string().regex(/^[1-9]\d*$/), balance }).strict()),
  allocations: z.array(z.object({ id: uuid, documentId: uuid, number: z.string(), kind: z.enum(['payment','refund']),
    refundOf: uuid.nullable(), amount: positive, status: z.enum(['active','cancelled']), reason: z.string().nullable(),
    refundable: paymentAmount }).strict()),
  refundablePayments: z.array(z.object({ id: uuid, documentId: uuid, number: z.string(), externalId:z.string(),bookingDate:z.iso.date(),available: positive }).strict()),
}).strict().refine(w => {
  const tx = w.transaction;
  if (!paymentAmount.safeParse(tx.incoming).success || !paymentAmount.safeParse(tx.outgoing).success || !paymentAmount.safeParse(tx.available).success) return false;
  if (w.allocations.some(a=>!positive.safeParse(a.amount).success)) return false;
  const allocated=w.allocations.filter(a=>a.status==='active').reduce((sum,a)=>sum+BigInt(a.amount),BigInt(0));
  return ((tx.incoming !== '0' && tx.outgoing === '0') || (tx.incoming === '0' && tx.outgoing !== '0')) &&
    BigInt(tx.available)+allocated === BigInt(tx.incoming) + BigInt(tx.outgoing);
});
export type PaymentCommand = z.infer<typeof paymentCommandSchema>;
export type PaymentWorkspace = z.infer<typeof paymentWorkspaceSchema>;
