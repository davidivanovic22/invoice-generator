import { useCallback, useEffect, useState } from 'react';
import { AdvancesPanel } from './AdvancesPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { AccountingError, type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { BusinessDocument, DocumentCommand } from '../../domain/accounting/documents';
import { minorUnits, type PostJournalCommand } from '../../domain/accounting/journal';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';
import { formatRsd, parseRsd } from './money';

type Pending = {kind:'document';command:DocumentCommand} | {kind:'post';documentId:string;documentRevision:string;command:PostJournalCommand};
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export const DocumentsPanel = ({repo,workspace,disabled,onState}: {repo:SupabaseAccountingRepository;workspace:AccountingWorkspace;disabled:boolean;onState:(dirty:boolean,busy:boolean)=>void}) => {
  const {confirm}=useFeedback();
  const [documents,setDocuments]=useState<BusinessDocument[]>([]);
  const [registerLoading,setRegisterLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<Pending|null>(null);
  const [error,setError]=useState('');
  const [number,setNumber]=useState(''); const [partner,setPartner]=useState('');
  const [formDirty,setFormDirty]=useState(false);
  const [formOpen,setFormOpen]=useState(false);
  const [draftId,setDraftId]=useState<string|null>(null);
  const [draftRevision,setDraftRevision]=useState('0');
  const [direction,setDirection]=useState<'incoming'|'outgoing'>('outgoing');
  const [kind,setKind]=useState<'invoice'|'advance'|'credit_note'>('invoice'); const [reference,setReference]=useState('');
  const [date,setDate]=useState(workspace.years.find(y=>y.id===workspace.yearId)?.startsOn || '');
  const [due,setDue]=useState(date); const [description,setDescription]=useState('');
  const [net,setNet]=useState('0.00');const [tax,setTax]=useState('0.00');
  const [selected,setSelected]=useState<BusinessDocument|null>(null);
  const [applicationInvoice,setApplicationInvoice]=useState<BusinessDocument|null>(null);
  const [applicationBusy,setApplicationBusy]=useState(false);
  const [attachmentDocument,setAttachmentDocument]=useState<BusinessDocument|null>(null);
  const [attachmentBusy,setAttachmentBusy]=useState(false);
  const attachmentState=useCallback((value:boolean)=>{setAttachmentBusy(value);onState(true,value);},[onState]);
  const applicationState=useCallback((value:boolean)=>setApplicationBusy(value),[]);
  const [period,setPeriod]=useState(workspace.periods.find(p=>p.status==='open')?.id || '');
  const [postingDate,setPostingDate]=useState(date);
  const [counterpart,setCounterpart]=useState('');const [base,setBase]=useState('');const [taxAccount,setTaxAccount]=useState('');
  const dirty=formDirty||Boolean(selected)||Boolean(applicationInvoice)||Boolean(attachmentDocument);
  const canWrite=workspace.capabilities.includes('post_journal');
  const locked=disabled||busy||registerLoading||applicationBusy||Boolean(attachmentDocument)||Boolean(pending)||!canWrite;
  useEffect(()=>{onState(dirty,busy||applicationBusy||attachmentBusy||Boolean(pending));},[dirty,busy,applicationBusy,attachmentBusy,pending,onState]);
  useEffect(()=>()=>onState(false,false),[onState]);
  useEffect(()=>{
    let active=true;
    if (!workspace.yearId) return;
    setRegisterLoading(true);
    void repo.documents(workspace.firmId,workspace.yearId).then(result=>{if(active)setDocuments(result);}).catch(()=>{if(active){setDocuments([]);setError(t('Document register could not be loaded.'));}}).finally(()=>{if(active)setRegisterLoading(false);});
    return ()=>{active=false;};
  },[repo,workspace,refresh]);
  const run=async(request:Pending)=>{
    setBusy(true);setPending(request);setError('');
    try {
      if(request.kind==='document')await repo.documentCommand(request.command);
      else {const result=await repo.postDocument(request.documentId,request.documentRevision,request.command);if(!result.ok)throw new AccountingError(result.code);}
      setRegisterLoading(true);setPending(null);setSelected(null);if(request.kind==='document'&&request.command.action==='save'){setNumber('');setDescription('');setNet('0.00');setTax('0.00');setFormDirty(false);setDraftId(null);setDraftRevision('0');}
      setRefresh(v=>v+1);
    } catch(e){
      const code=e instanceof AccountingError?e.code:'unavailable';
      setError(code==='unavailable'||code==='invalid_response'?t('Unknown document result. Retry the same request before editing.'):t('Document command refused. Review permissions, revision, approval, reference and amounts.'));
      if(code!=='unavailable'&&code!=='invalid_response')setPending(null);
    } finally {setBusy(false);}
  };
  const save=async()=>{
    try {
      await run({kind:'document',command:{action:'save',expectedRevision:draftRevision,idempotencyKey:crypto.randomUUID(),data:{id:draftId||crypto.randomUUID(),firmId:workspace.firmId,partnerId:partner,direction,kind,referenceId:kind==='credit_note'?reference:null,number,documentDate:date,dueDate:due,description,currency:'RSD',lines:[{id:'one',description,net:parseRsd(net),tax:parseRsd(tax)}]}}});
    }catch{setError(t('Check the document fields and exact RSD amounts.'));}
  };
  const edit=async(d:BusinessDocument)=>{
    if(dirty&&!await confirm({title:t('Discard unsaved changes?'),confirmLabel:t('Discard changes')}))return;
    const value=d.document;setSelected(null);setDraftId(value.id);setDraftRevision(d.revision);setNumber(value.number);setPartner(value.partnerId);setDirection(value.direction);setKind(value.kind);setReference(value.referenceId||'');setDate(value.documentDate);setDue(value.dueDate);setDescription(value.lines[0].description);setNet(formatRsd(value.lines[0].net));setTax(formatRsd(value.lines[0].tax));setFormOpen(true);setFormDirty(true);
  };
  const action=async(d:BusinessDocument,action:'approve'|'reject'|'issue'|'record_delivery')=>{
    if(!await confirm({title:t('Confirm document action?'),message:`${d.document.number} · ${action}`,confirmLabel:t('Confirm')}))return;
    let evidence:string|undefined;
    if(action==='record_delivery'){const answer=window.prompt(t('Enter external delivery evidence.'));if(!answer?.trim())return;evidence=answer.trim();}
    await run({kind:'document',command:{action,data:{firmId:workspace.firmId,id:d.document.id,...(evidence?{evidence}:{})},expectedRevision:action==='issue'?d.revision:d.workflow.revision,idempotencyKey:crypto.randomUUID()}});
  };
  const post=async()=>{
    if(!selected)return;
    const d=selected.document;
    const n=d.lines.reduce((sum,l)=>sum+BigInt(l.net),BigInt(0));const taxTotal=d.lines.reduce((sum,l)=>sum+BigInt(l.tax),BigInt(0));
    const debit=(d.direction==='outgoing')!==(d.kind==='credit_note');
    const line=(id:string,accountId:string,amount:bigint,isDebit:boolean,partnerId?:string)=>({id,accountId,...(partnerId?{partnerId}:{}),debit:minorUnits(isDebit?amount.toString():'0'),credit:minorUnits(isDebit?'0':amount.toString()),description:d.number});
    const lines=[line('partner',counterpart,n+taxTotal,debit,d.partnerId),...(n>BigInt(0)?[line('base',base,n,!debit)]:[]),...(taxTotal>BigInt(0)?[line('tax',taxAccount,taxTotal,!debit)]:[])];
    if(!await confirm({title:t('Post this journal?'),message:`${d.number} · ${formatRsd((n+taxTotal).toString())} RSD`,confirmLabel:t('Post journal')}))return;
    await run({kind:'post',documentId:d.id,documentRevision:selected.revision,command:{kind:'postJournal',expectedRevision:'0',idempotencyKey:crypto.randomUUID(),draft:{id:crypto.randomUUID(),firmId:workspace.firmId,fiscalYearId:workspace.yearId!,periodId:period,postingDate,description:d.number,lines}}});
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={t('Business documents')}>
    <h2 className="font-semibold">{t('Business documents')}</h2><p className="text-sm text-slate-500">{t('Internal document register. Tax amounts are entered from the source; this does not send invoices or calculate taxes.')}</p>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {pending&&<Button disabled={busy} onClick={()=>void run(pending)}>{t('Retry the same request')}</Button>}
    <details open={formOpen} onToggle={e=>setFormOpen(e.currentTarget.open)}><summary>{t('Register a document')}</summary><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={locked||Boolean(applicationInvoice)} onChange={()=>setFormDirty(true)} className="grid gap-3 py-3 sm:grid-cols-3">
      <label>{t('Document direction')}<select className={field} value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option value="outgoing">{t('Outgoing')}</option><option value="incoming">{t('Incoming')}</option></select></label>
      <label>{t('Document kind')}<select className={field} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="invoice">{t('Invoice')}</option><option value="advance">{t('Advance document')}</option><option value="credit_note">{t('Credit note')}</option></select></label>
      <label>{t('Document partner')}<select required className={field} value={partner} onChange={e=>setPartner(e.target.value)}><option value="">—</option>{workspace.partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {kind==='credit_note'&&<label>{t('Original document')}<select required className={field} value={reference} onChange={e=>setReference(e.target.value)}><option value="">—</option>{documents.filter(d=>d.lifecycle==='issued'&&d.document.kind!=='credit_note'&&d.document.partnerId===partner&&d.document.direction===direction).map(d=><option key={d.document.id} value={d.document.id}>{d.document.number}</option>)}</select></label>}
      <label>{t('Document number')}<input required className={field} value={number} onChange={e=>setNumber(e.target.value)}/></label>
      <label>{t('Document date')}<input required type="date" className={field} value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>{t('Document due date')}<input required type="date" className={field} value={due} onChange={e=>setDue(e.target.value)}/></label>
      <label>{t('Document description')}<input required className={field} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <label>{t('Net RSD')}<input className={field} inputMode="decimal" value={net} onChange={e=>setNet(e.target.value)}/></label>
      <label>{t('Tax RSD')}<input className={field} inputMode="decimal" value={tax} onChange={e=>setTax(e.target.value)}/></label><Button type="submit">{t('Save document draft')}</Button><Button onClick={()=>{setNumber('');setDescription('');setNet('0.00');setTax('0.00');setFormDirty(false);setDraftId(null);setDraftRevision('0');}}>{t('Cancel')}</Button>
    </fieldset></form></details>
    <div className="space-y-2">{documents.map(d=><article key={d.document.id} className="rounded-lg border p-3 text-sm">
      <p className="font-medium">{d.document.number} · {d.partnerName} · {formatRsd(d.document.lines.reduce((s,l)=>s+BigInt(l.net)+BigInt(l.tax),BigInt(0)).toString())} RSD</p>
      <p>{t('Document status')}: {d.lifecycle} · {t('Approval')}: {d.workflow.approval} · {t('Delivery')}: {d.workflow.delivery} · {t('Booking')}: {d.journalId?t('Posted'):t('Not posted')} · {d.payment==='not_tracked'?t('Payment is not tracked yet.'):`${t('Bank reconciliation status')}: ${t(d.payment)}`}</p>
      <fieldset disabled={locked||formDirty||Boolean(selected)||Boolean(applicationInvoice)} className="flex flex-wrap gap-2">{d.lifecycle==='draft'?<><Button disabled={d.document.lines.length!==1} onClick={()=>void edit(d)}>{t('Edit document draft')}</Button><Button onClick={()=>void action(d,'approve')}>{t('Approve document')}</Button><Button onClick={()=>void action(d,'reject')}>{t('Reject document')}</Button><Button disabled={d.workflow.approval!=='approved'} onClick={()=>void action(d,'issue')}>{t('Issue document')}</Button></>:<><Button onClick={()=>void action(d,'record_delivery')}>{t('Record delivery')}</Button><Button disabled={Boolean(d.journalId)} onClick={()=>{setSelected(d);setPostingDate(d.document.documentDate);}}>{t('Prepare source posting')}</Button>{d.document.kind==='invoice'&&<Button onClick={()=>setApplicationInvoice(d)}>{t('Manage advances')}</Button>}</>}</fieldset>
      <Button disabled={disabled||busy||registerLoading||Boolean(pending)||dirty} onClick={()=>setAttachmentDocument(d)}>{t('Manage attachments')}</Button>
    </article>)}</div>
    {attachmentDocument&&<AttachmentsPanel repo={repo} firmId={workspace.firmId} targetType="document" targetId={attachmentDocument.document.id} targetRevision={attachmentDocument.revision} title={attachmentDocument.document.number} canWrite={canWrite} disabled={disabled||busy||Boolean(pending)} onBusy={attachmentState} onClose={()=>setAttachmentDocument(null)}/>}
    {applicationInvoice&&<AdvancesPanel repo={repo} workspace={workspace} invoice={applicationInvoice} disabled={disabled||busy||Boolean(pending)||!canWrite} onBusy={applicationState} onClose={()=>{setApplicationInvoice(null);setRefresh(v=>v+1);}}/>}
    {selected&&<fieldset disabled={locked} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3"><p className="sm:col-span-3">{t('Source document')}: {selected.document.number}</p>
      <label>{t('Counterpart account')}<select className={field} value={counterpart} onChange={e=>setCounterpart(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
      <label>{t('Base account')}<select className={field} value={base} onChange={e=>setBase(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&!a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
      <label>{t('Tax account')}<select className={field} value={taxAccount} onChange={e=>setTaxAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&!a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
      <label>{t('Source posting period')}<select className={field} value={period} onChange={e=>setPeriod(e.target.value)}>{workspace.periods.filter(p=>p.status==='open').map(p=><option key={p.id} value={p.id}>{p.startsOn} — {p.endsOn}</option>)}</select></label>
      <label>{t('Source posting date')}<input type="date" className={field} value={postingDate} onChange={e=>setPostingDate(e.target.value)}/></label>
      <Button disabled={!counterpart||!base||!period} onClick={()=>void post()}>{t('Post source document')}</Button><Button onClick={()=>setSelected(null)}>{t('Cancel')}</Button>
    </fieldset>}
  </section>;
};
