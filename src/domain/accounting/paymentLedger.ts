import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
import { paymentAmount } from './payments';
const common={firmId:uuid,transactionId:uuid,journalId:uuid,fiscalYearId:uuid,periodId:uuid,postingDate:z.iso.date()};
export const paymentLedgerCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('bank'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,bankAccountId:uuid,clearingAccountId:uuid}).strict().refine(d=>d.bankAccountId!==d.clearingAccountId)}),
 z.object({action:z.literal('allocation'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,allocationId:uuid,documentAccountId:uuid}).strict()})
]);
export const paymentLedgerReceiptSchema=z.object({firmId:uuid,transactionId:uuid,allocationId:uuid.nullable(),journalId:uuid}).strict();
export const paymentLedgerWorkspaceSchema=z.object({firmId:uuid,transactionId:uuid,
 bank:z.object({journalId:uuid,bankAccountId:uuid,clearingAccountId:uuid,reversed:z.boolean(),clearingRemaining:paymentAmount}).strict().nullable(),
 allocations:z.array(z.object({id:uuid,journalId:uuid,documentAccountId:uuid,reversalId:uuid.nullable(),accountRemaining:z.string().regex(/^(0|-?[1-9]\d{0,23})$/)}).strict())
}).strict();
export type PaymentLedgerCommand=z.infer<typeof paymentLedgerCommandSchema>;
export type PaymentLedgerWorkspace=z.infer<typeof paymentLedgerWorkspaceSchema>;
