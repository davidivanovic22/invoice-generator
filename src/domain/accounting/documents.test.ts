import { businessDocumentSchema,documentCommandSchema } from './documents';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const document={id:id(1),firmId:id(2),partnerId:id(3),direction:'outgoing',kind:'invoice',referenceId:null,number:'2026-1',documentDate:'2026-01-01',dueDate:'2026-01-15',description:'Service',currency:'RSD',lines:[{id:'one',description:'Service',net:'900719925474099301',tax:'0'}]};
it('preserves exact document amounts and rejects numeric JSON transport',()=>{
 expect(businessDocumentSchema.parse(document).lines[0].net).toBe('900719925474099301');
 expect(businessDocumentSchema.safeParse({...document,lines:[{...document.lines[0],net:100}]}).success).toBe(false);
});
it('requires scoped correction references and valid chronological dates',()=>{
 expect(businessDocumentSchema.safeParse({...document,kind:'credit_note'}).success).toBe(false);
 expect(businessDocumentSchema.safeParse({...document,kind:'credit_note',referenceId:id(4)}).success).toBe(true);
 expect(businessDocumentSchema.safeParse({...document,dueDate:'2025-12-31'}).success).toBe(false);
 expect(businessDocumentSchema.safeParse({...document,documentDate:'2026-02-30'}).success).toBe(false);
});
it('rejects fictional payment/delivery state on document creation',()=>{
 expect(documentCommandSchema.safeParse({action:'save',data:{...document,paid:true},expectedRevision:'0',idempotencyKey:'same-key'}).success).toBe(false);
});
