import { advanceCommandSchema } from './advances';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const command={action:'apply',idempotencyKey:'request',data:{firmId:id(1),id:id(2),expectedRevision:'0',advanceId:id(3),invoiceId:id(4),advanceRevision:'2',invoiceRevision:'2',net:'900719925474099301',tax:'0',invoiceAccountId:id(5),advanceAccountId:id(6),fiscalYearId:id(7),periodId:id(8),postingDate:'2026-01-15'}};
it('transports exact large amounts and refuses zero or Number amounts',()=>{
 expect(advanceCommandSchema.parse(command).data).toHaveProperty('net','900719925474099301');
 expect(advanceCommandSchema.safeParse({...command,data:{...command.data,net:100}}).success).toBe(false);
 expect(advanceCommandSchema.safeParse({...command,data:{...command.data,net:'0'}}).success).toBe(false);
});
it('requires different sources and accounts, with a positive source revision',()=>{
 for(const patch of [{invoiceId:id(3)},{advanceAccountId:id(5)},{advanceRevision:'0'}])expect(advanceCommandSchema.safeParse({...command,data:{...command.data,...patch}}).success).toBe(false);
});
it('requires a reason and an active revision for cancellation',()=>{
 const cancel={action:'cancel',idempotencyKey:'cancel',data:{firmId:id(1),id:id(2),expectedRevision:'1',periodId:id(8),postingDate:'2026-01-16',reason:'Wrong application'}};
 expect(advanceCommandSchema.safeParse(cancel).success).toBe(true);
 expect(advanceCommandSchema.safeParse({...cancel,data:{...cancel.data,reason:' '}}).success).toBe(false);
 expect(advanceCommandSchema.safeParse({...cancel,data:{...cancel.data,expectedRevision:'2'}}).success).toBe(false);
});
