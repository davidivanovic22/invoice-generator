import { z } from 'zod';
import { accountingUuid as uuid } from './identifiers';
export const attachmentTarget=z.enum(['document','bank_statement']);
const bytes=z.string().regex(/^[1-9]\d{0,7}$/).refine(v=>BigInt(v)<=BigInt(10485760));
const name=z.string().min(1).max(255).refine(v=>!/[\\/:]/.test(v)&&!Array.from(v).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&v!=='.'&&v!=='..');
const common={firmId:uuid,id:uuid,targetType:attachmentTarget,targetId:uuid};
export const attachmentCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,name,bytes,sha256:z.string().regex(/^[0-9a-f]{64}$/),externalReference:z.string().trim().min(1).max(1000),targetRevision:z.string().regex(/^[1-9]\d*$/).nullable()}).strict().refine(v=>(v.targetType==='document')===(v.targetRevision!==null))}),
 z.object({action:z.literal('withdraw'),idempotencyKey:z.string().min(1).max(100),data:z.object({...common,expectedRevision:z.literal('1'),reason:z.string().trim().min(1).max(1000)}).strict()})]);
export const attachmentReceiptSchema=z.object({firmId:uuid,attachmentId:uuid,targetType:attachmentTarget,targetId:uuid,revision:z.enum(['1','2'])}).strict();
export const attachmentWorkspaceSchema=z.object({firmId:uuid,targetType:attachmentTarget,targetId:uuid,attachments:z.array(z.object({id:uuid,name,bytes,sha256:z.string().regex(/^[0-9a-f]{64}$/),externalReference:z.string().min(1).max(1000),targetRevision:z.string().regex(/^[1-9]\d*$/).nullable(),registeredAt:z.iso.datetime({offset:true}),registeredBy:uuid,status:z.enum(['externally_retained','withdrawn']),reason:z.string().min(1).max(1000).nullable()}).strict()).max(100)}).strict().refine(v=>new Set(v.attachments.map(a=>a.id)).size===v.attachments.length&&v.attachments.every(a=>(v.targetType==='document')===(a.targetRevision!==null)&&(a.status==='withdrawn')===(a.reason!==null)));
export type AttachmentCommand=z.infer<typeof attachmentCommandSchema>;
export type AttachmentWorkspace=z.infer<typeof attachmentWorkspaceSchema>;
export type AttachmentTarget=z.infer<typeof attachmentTarget>;
