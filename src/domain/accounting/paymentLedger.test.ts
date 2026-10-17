import { paymentLedgerCommandSchema,paymentLedgerWorkspaceSchema } from './paymentLedger';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const data={firmId:id(1),transactionId:id(2),journalId:id(3),fiscalYearId:id(4),periodId:id(5),postingDate:'2026-01-10',bankAccountId:id(6),clearingAccountId:id(7)};
it('requires distinct bank/clearing accounts and a scoped explicit posting command',()=>{
 expect(paymentLedgerCommandSchema.parse({action:'bank',idempotencyKey:'stable',data}).data).toEqual(data);
 expect(paymentLedgerCommandSchema.safeParse({action:'bank',idempotencyKey:'stable',data:{...data,clearingAccountId:id(6)}}).success).toBe(false);
 expect(paymentLedgerCommandSchema.safeParse({action:'bank',idempotencyKey:'stable',data:{...data,postingDate:'2026-02-30'}}).success).toBe(false);
});
it('preserves exact clearing balances and signed source account balances',()=>{
 const value={firmId:id(1),transactionId:id(2),bank:{journalId:id(3),bankAccountId:id(6),clearingAccountId:id(7),reversed:false,clearingRemaining:'900719925474099301'},allocations:[{id:id(8),journalId:id(9),documentAccountId:id(10),reversalId:null,accountRemaining:'-10001'}]};
 expect(paymentLedgerWorkspaceSchema.parse(value)).toEqual(value);
 expect(paymentLedgerWorkspaceSchema.safeParse({...value,bank:{...value.bank,clearingRemaining:100}}).success).toBe(false);
});
