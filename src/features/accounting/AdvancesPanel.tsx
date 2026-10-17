import { useEffect,useState } from 'react';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { BusinessDocument } from '../../domain/accounting/documents';
import type { AdvanceCommand,AdvanceWorkspace } from '../../domain/accounting/advances';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';
import { formatRsd,parseRsd } from './money';
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export const AdvancesPanel=({repo,workspace,invoice,disabled,onBusy,onClose}: {repo:SupabaseAccountingRepository;workspace:AccountingWorkspace;invoice:BusinessDocument;disabled:boolean;onBusy:(busy:boolean)=>void;onClose:()=>void})=>{
 const {confirm}=useFeedback();
 const [data,setData]=useState<AdvanceWorkspace|null>(null);const [refresh,setRefresh]=useState(0);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [pending,setPending]=useState<AdvanceCommand|null>(null);const [error,setError]=useState('');
 const [advance,setAdvance]=useState('');const [net,setNet]=useState('0.00');const [tax,setTax]=useState('0.00');
 const [invoiceAccount,setInvoiceAccount]=useState('');const [advanceAccount,setAdvanceAccount]=useState('');
 const [period,setPeriod]=useState(workspace.periods.find(p=>p.status==='open')?.id||'');const [date,setDate]=useState(invoice.document.documentDate);
 const [reason,setReason]=useState('');
 const locked=disabled||busy||loading||Boolean(pending);
 useEffect(()=>{onBusy(busy||Boolean(pending));},[busy,pending,onBusy]);
 useEffect(()=>()=>onBusy(false),[onBusy]);
 useEffect(()=>{let active=true;setLoading(true);void repo.advances(workspace.firmId,invoice.document.id).then(result=>{if(active)setData(result);}).catch(()=>{if(active){setData(null);setError(t('Advance register could not be loaded.'));}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[repo,workspace.firmId,invoice.document.id,refresh]);
 const run=async(command:AdvanceCommand)=>{
  setBusy(true);setPending(command);setError('');
  try{await repo.advanceCommand(command);setPending(null);setRefresh(v=>v+1);setNet('0.00');setTax('0.00');setReason('');}
  catch(e){const code=e instanceof AccountingError?e.code:'unavailable';const unknown=code==='unavailable'||code==='invalid_response';setError(t(unknown?'Unknown advance result. Retry the same request before editing.':'Advance command refused. Review remaining amounts, source journals, accounts, permissions and period.'));if(!unknown)setPending(null);}
  finally{setBusy(false);}
 };
 const apply=async()=>{
  const source=data?.advances.find(a=>a.source.document.id===advance);if(!source)return;
  let n:string;let tx:string;try{n=parseRsd(net);tx=parseRsd(tax);}catch{setError(t('Enter exact RSD amounts.'));return;}
  if(BigInt(n)+BigInt(tx)===BigInt(0)||BigInt(n)>BigInt(source.remainingNet)||BigInt(tx)>BigInt(source.remainingTax)||BigInt(n)>BigInt(data!.remainingNet)||BigInt(tx)>BigInt(data!.remainingTax)){setError(t('The application exceeds the available net or tax amount.'));return;}
  if(!await confirm({title:t('Apply this advance?'),message:`${source.source.document.number} → ${invoice.document.number} · ${formatRsd((BigInt(n)+BigInt(tx)).toString())} RSD`,confirmLabel:t('Apply advance')}))return;
  await run({action:'apply',idempotencyKey:crypto.randomUUID(),data:{firmId:workspace.firmId,id:crypto.randomUUID(),expectedRevision:'0',advanceId:advance,invoiceId:invoice.document.id,advanceRevision:source.source.revision,invoiceRevision:invoice.revision,net:n,tax:tx,invoiceAccountId:invoiceAccount,advanceAccountId:advanceAccount,fiscalYearId:workspace.yearId!,periodId:period,postingDate:date}});
 };
 const cancel=async(id:string)=>{
  if(!reason.trim()){setError(t('Enter a cancellation reason.'));return;}
  if(!await confirm({title:t('Cancel this advance application?'),message:t('A reversal journal will restore the available advance amount.'),confirmLabel:t('Cancel application')}))return;
  await run({action:'cancel',idempotencyKey:crypto.randomUUID(),data:{firmId:workspace.firmId,id,expectedRevision:'1',periodId:period,postingDate:date,reason}});
 };
 return <section className="space-y-3 rounded-lg bg-slate-50 p-3" aria-label={t('Advance applications')}>
  <h3 className="font-semibold">{t('Advance applications')}: {invoice.document.number}</h3>
  <p className="text-sm text-slate-600">{t('Applications post an explicit transfer between source accounts. They do not confirm a bank payment or calculate VAT adjustments.')}</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {pending&&<Button disabled={busy} onClick={()=>void run(pending)}>{t('Retry the same request')}</Button>}
  {data&&<p>{t('Available invoice net / tax')}: {formatRsd(data.remainingNet)} / {formatRsd(data.remainingTax)} RSD</p>}
  <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-3">
   <label>{t('Advance source')}<select className={field} value={advance} onChange={e=>setAdvance(e.target.value)}><option value="">—</option>{data?.advances.map(a=><option key={a.source.document.id} value={a.source.document.id}>{a.source.document.number} · {formatRsd(a.remainingNet)} / {formatRsd(a.remainingTax)}</option>)}</select></label>
   <label>{t('Apply net RSD')}<input className={field} value={net} onChange={e=>setNet(e.target.value)} inputMode="decimal"/></label>
   <label>{t('Apply tax RSD')}<input className={field} value={tax} onChange={e=>setTax(e.target.value)} inputMode="decimal"/></label>
   <label>{t('Invoice source account')}<select className={field} value={invoiceAccount} onChange={e=>setInvoiceAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
   <label>{t('Advance source account')}<select className={field} value={advanceAccount} onChange={e=>setAdvanceAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
   <label>{t('Application period')}<select className={field} value={period} onChange={e=>setPeriod(e.target.value)}>{workspace.periods.filter(p=>p.status==='open').map(p=><option key={p.id} value={p.id}>{p.startsOn} — {p.endsOn}</option>)}</select></label>
   <label>{t('Application date')}<input className={field} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <Button disabled={!advance||!invoiceAccount||!advanceAccount||invoiceAccount===advanceAccount||!period||!invoice.journalId} onClick={()=>void apply()}>{t('Apply advance')}</Button>
   <label>{t('Cancellation reason')}<input className={field} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  </fieldset>
  {data?.applications.map(a=><div key={a.id} className="rounded-lg border bg-white p-2 text-sm"><p>{a.id} · {formatRsd((BigInt(a.net)+BigInt(a.tax)).toString())} RSD · {t(a.status==='active'?'Active application':'Cancelled application')}</p><p>{t('Journal')}: {a.journalId}{a.reversalId&&` · ${t('Reversal')}: ${a.reversalId}`}{a.reason&&` · ${a.reason}`}</p>{a.status==='active'&&<Button disabled={locked||!workspace.capabilities.includes('reverse_journal')} onClick={()=>void cancel(a.id)}>{t('Cancel application')}</Button>}</div>)}
  <Button disabled={busy||Boolean(pending)} onClick={onClose}>{t('Close advance applications')}</Button>
 </section>;
};
