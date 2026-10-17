import { useEffect,useState } from 'react';
import type { AttachmentCommand,AttachmentTarget,AttachmentWorkspace } from '../../domain/accounting/attachments';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';

export const AttachmentsPanel=({repo,firmId,targetType,targetId,targetRevision,title,canWrite,disabled,onBusy,onClose}:{repo:SupabaseAccountingRepository;firmId:string;targetType:AttachmentTarget;targetId:string;targetRevision:string|null;title:string;canWrite:boolean;disabled:boolean;onBusy:(value:boolean)=>void;onClose:()=>void})=>{
 const {confirm}=useFeedback();
 const [data,setData]=useState<AttachmentWorkspace|null>(null),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<AttachmentCommand|null>(null),[error,setError]=useState('');
 const [file,setFile]=useState<{name:string;bytes:string;sha256:string}|null>(null),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[fileKey,setFileKey]=useState(0);
 const lock=disabled||busy||loading||Boolean(pending);
 useEffect(()=>{onBusy(busy||Boolean(pending));},[busy,pending,onBusy]);
 useEffect(()=>()=>onBusy(false),[onBusy]);
 useEffect(()=>{let active=true;setLoading(true);void repo.attachments(firmId,targetType,targetId).then(v=>{if(active)setData(v);}).catch(()=>{if(active){setData(null);setError(t('Attachments could not be loaded.'));}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[repo,firmId,targetType,targetId,refresh]);
 const select=async(value:File)=>{
  onBusy(true);setBusy(true);setError('');setFile(null);
  try{
   if(value.size<1||value.size>10485760)throw new Error('size');
   const digest=await crypto.subtle.digest('SHA-256',await value.arrayBuffer());
   setFile({name:value.name,bytes:String(value.size),sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')});
  }catch{setError(t('Select a readable file between 1 byte and 10 MiB.'));}
  finally{setBusy(false);onBusy(false);}
 };
 const run=async(command:AttachmentCommand)=>{
  onBusy(true);setBusy(true);setPending(command);setError('');
  try{await repo.attachmentCommand(command);setPending(null);setRefresh(v=>v+1);setFile(null);setFileKey(v=>v+1);setReference('');setReason('');}
  catch(e){const code=e instanceof AccountingError?e.code:'unavailable';const unknown=code==='unavailable'||code==='invalid_response';setError(t(unknown?'Unknown attachment result. Retry the same request before editing.':'Attachment command refused. Review access, document revision and fields.'));if(!unknown)setPending(null);}
  finally{setBusy(false);}
 };
 const submit=async(command:AttachmentCommand,message:string)=>{
  onBusy(true);setBusy(true);
  try{if(await confirm({title:t('Confirm attachment action?'),message,confirmLabel:t('Confirm')}))await run(command);}
  finally{setBusy(false);}
 };
 return <section aria-label={t('Attachment register')} className="space-y-3 rounded-lg bg-slate-50 p-3">
  <h3 className="font-semibold">{t('Attachment register')}: {title}</h3>
  <p>{t('Only the filename, size, checksum and archive reference are saved. Keep the original file in your archive; this does not upload or back up the file.')}</p>
  {error&&<p role="alert">{error}</p>}
  {pending&&<Button disabled={busy} onClick={()=>void run(pending)}>{t('Retry the same request')}</Button>}
  {canWrite&&<fieldset disabled={lock||!data} className="space-y-2">
   <label>{t('Original attachment file')}<input key={fileKey} type="file" onChange={e=>{const value=e.target.files?.[0];if(value)void select(value);else setFile(null);}}/></label>
   {file&&<p>{file.name} · {file.bytes} bytes · SHA256 {file.sha256}</p>}
   <label>{t('External archive reference')}<input value={reference} maxLength={1000} onChange={e=>setReference(e.target.value)}/></label>
   <Button disabled={!file||!reference.trim()} onClick={()=>{if(file)void submit({action:'register',idempotencyKey:crypto.randomUUID(),data:{firmId,id:crypto.randomUUID(),targetType,targetId,targetRevision,...file,externalReference:reference}},`${title} · ${file.name} · ${file.bytes} bytes · ${reference}`);}}>{t('Register attachment')}</Button>
   <label>{t('Withdrawal reason')}<input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>
  </fieldset>}
  <p>{t('Showing the latest 100 attachment records.')}</p>
  {data?.attachments.map(a=><article key={a.id} className="rounded border p-2"><p>{a.name} · {a.bytes} bytes · {t(a.status)}{a.targetRevision&&` · ${t('Document revision')}: ${a.targetRevision}`}</p><p>{a.externalReference}</p><p className="break-all">SHA256 {a.sha256}</p><p>{a.registeredAt} · {a.registeredBy}</p>{a.reason&&<p>{a.reason}</p>}{canWrite&&a.status==='externally_retained'&&<Button disabled={lock||!reason.trim()} onClick={()=>void submit({action:'withdraw',idempotencyKey:crypto.randomUUID(),data:{firmId,id:a.id,targetType,targetId,expectedRevision:'1',reason}},`${title} · ${a.name} · ${reason}`)}>{t('Withdraw attachment record')}</Button>}</article>)}
  <Button disabled={busy||Boolean(pending)} onClick={onClose}>{t('Close attachment register')}</Button>
 </section>;
};
