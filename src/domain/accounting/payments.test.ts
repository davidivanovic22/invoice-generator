import { paymentCommandSchema, paymentWorkspaceSchema } from './payments';
const id = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const command = {action:'allocate',idempotencyKey:'stable',data:{firmId:id(1),id:id(2),transactionId:id(3),documentId:id(4),documentRevision:'2',kind:'payment',refundOf:null,amount:'900719925474099301'}};
it('preserves exact amounts and requires an explicit original payment for refunds',()=>{
 expect(paymentCommandSchema.parse(command).data).toEqual(command.data);
 expect(paymentCommandSchema.safeParse({...command,data:{...command.data,kind:'refund'}}).success).toBe(false);
 expect(paymentCommandSchema.safeParse({...command,data:{...command.data,kind:'refund',refundOf:id(5)}}).success).toBe(true);
 for(const amount of ['0','-1','1.01','01',1,'1000000000000000000000000'])expect(paymentCommandSchema.safeParse({...command,data:{...command.data,amount}}).success).toBe(false);
});
it('rejects malformed or excessive remaining bank capacity without throwing',()=>{
 const workspace={firmId:id(1),transaction:{id:id(3),accountId:id(6),externalId:'BANK-1',bookingDate:'2026-01-01',incoming:'100',outgoing:'0',available:'100'},documents:[],allocations:[],refundablePayments:[]};
 expect(paymentWorkspaceSchema.safeParse(workspace).success).toBe(true);
 for(const patch of [{available:'101'},{available:'bad'},{outgoing:'1'},{incoming:100}])expect(paymentWorkspaceSchema.safeParse({...workspace,transaction:{...workspace.transaction,...patch}}).success).toBe(false);
});
