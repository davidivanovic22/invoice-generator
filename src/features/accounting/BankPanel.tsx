import { useCallback,useEffect,useState } from 'react';
import { PaymentsPanel } from './PaymentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { bankStatementInputSchema,normalizeBankNumber,parseBankRsd,type BankAccountCommand,type BankImportCommand,type BankImportReceipt,type BankRow,type BankStatement,type BankWorkspace } from '../../domain/accounting/bank';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { BankFileError,downloadBankTemplate,readBankFile } from './bankFiles';
import { formatRsd } from './money';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
type Pending={kind:'account';command:BankAccountCommand}|{kind:'import';command:BankImportCommand};
export const BankPanel=({repo,workspace,disabled,onState}: {repo:SupabaseAccountingRepository;workspace:AccountingWorkspace;disabled:boolean;onState:(dirty:boolean,busy:boolean)=>void})=>{
 const {confirm}=useFeedback();const [data,setData]=useState<BankWorkspace|null>(null);const [refresh,setRefresh]=useState(0);const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);const [pending,setPending]=useState<Pending|null>(null);const [error,setError]=useState('');const [receipt,setReceipt]=useState<BankImportReceipt|null>(null);
 const [accountName,setAccountName]=useState('');const [accountNumber,setAccountNumber]=useState('');const [accountDirty,setAccountDirty]=useState(false);
 const [account,setAccount]=useState('');const [reference,setReference]=useState('');const [starts,setStarts]=useState(workspace.years.find(y=>y.id===workspace.yearId)?.startsOn||'');const [ends,setEnds]=useState(starts);
 const [opening,setOpening]=useState('0.00');const [closing,setClosing]=useState('0.00');const [rows,setRows]=useState<BankRow[]>([]);const [filename,setFilename]=useState('');const [fileKey,setFileKey]=useState(0);const [formDirty,setFormDirty]=useState(false);
 const [preview,setPreview]=useState<BankImportCommand['data']|null>(null);const [selected,setSelected]=useState<BankStatement|null>(null);
 const [paymentTransaction,setPaymentTransaction]=useState<string|null>(null);const [paymentBusy,setPaymentBusy]=useState(false);
 const paymentState=useCallback((value:boolean)=>{setPaymentBusy(value);onState(true,value);},[onState]);
 const [attachmentsOpen,setAttachmentsOpen]=useState(false),[attachmentBusy,setAttachmentBusy]=useState(false);
 const attachmentState=useCallback((value:boolean)=>{setAttachmentBusy(value);onState(true,value);},[onState]);
 const dirty=accountDirty||formDirty||Boolean(preview)||Boolean(paymentTransaction)||attachmentsOpen;const locked=disabled||busy||loading||paymentBusy||Boolean(pending)||Boolean(paymentTransaction)||attachmentsOpen;
 const canImport=workspace.capabilities.includes('post_journal');const canCreate=workspace.capabilities.includes('manage_chart');
 useEffect(()=>{onState(dirty,busy||paymentBusy||attachmentBusy||Boolean(pending));},[dirty,busy,paymentBusy,attachmentBusy,pending,onState]);
 useEffect(()=>()=>onState(false,false),[onState]);
 useEffect(()=>{let active=true;setLoading(true);void repo.bankWorkspace(workspace.firmId,workspace.yearId!).then(result=>{if(active)setData(result);}).catch(()=>{if(active){setData(null);setError(t('Bank register could not be loaded.'));}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[repo,workspace,refresh]);
 const file=async(value:File)=>{
  setBusy(true);setError('');setPreview(null);setRows([]);setFilename('');setFormDirty(true);
  try{setRows(await readBankFile(value));setFilename(value.name);}catch(e){const code=e instanceof BankFileError?e.code:'bank_file';const message=code==='bank_text_amount'?'Excel bank IDs and amounts must be text cells. Use the template.':code==='bank_columns'?'Use one worksheet with the eight bank template columns.':code==='bank_duplicate'?'The file repeats a bank transaction ID. No rows were accepted.':'The Excel statement is invalid. No rows were accepted.';setError(`${t(message)}${e instanceof BankFileError&&e.row?` · ${t('Row')} ${e.row}`:''}`);}finally{setBusy(false);}
 };
 const clear=()=>{setReference('');setOpening('0.00');setClosing('0.00');setRows([]);setFilename('');setFileKey(v=>v+1);setPreview(null);setFormDirty(false);};
 const run=async(request:Pending)=>{
  setBusy(true);setPending(request);onState(dirty,true);setError('');
  try{
   if(request.kind==='account'){await repo.createBankAccount(request.command);setAccountName('');setAccountNumber('');setAccountDirty(false);setAccount(request.command.data.id);setPreview(null);}
   else{setReceipt(await repo.importBankStatement(request.command));clear();}
   setPending(null);setRefresh(v=>v+1);
  }catch(e){const code=e instanceof AccountingError?e.code:'unavailable';const unknown=code==='unavailable'||code==='invalid_response';setError(t(unknown?'Unknown bank result. Retry the same request before editing.':'Bank command refused. Review access, dates, balance and conflicting statement or transaction IDs.'));if(!unknown)setPending(null);}
  finally{setBusy(false);}
 };
 const create=async()=>void run({kind:'account',command:{idempotencyKey:crypto.randomUUID(),data:{firmId:workspace.firmId,id:crypto.randomUUID(),name:accountName,number:normalizeBankNumber(accountNumber),currency:'RSD'}}});
 const prepare=()=>{
  setError('');setReceipt(null);setPreview(null);
  try{
   const value=bankStatementInputSchema.parse({firmId:workspace.firmId,bankAccountId:account,fiscalYearId:workspace.yearId,reference,startsOn:starts,endsOn:ends,opening:parseBankRsd(opening,true),closing:parseBankRsd(closing,true),rows});
   const year=workspace.years.find(y=>y.id===workspace.yearId);if(!year||value.startsOn<year.startsOn||value.endsOn>year.endsOn)throw new Error();
   setPreview(value);
  }catch{setError(t('Check the bank account, reference, dates, rows and opening plus incoming minus outgoing equals closing.'));}
 };
 const save=async()=>{
  if(!preview||!await confirm({title:t('Import this bank statement?'),message:`${data?.accounts.find(a=>a.id===preview.bankAccountId)?.number} · ${preview.reference} · ${preview.rows.length} ${t('transactions')}`,confirmLabel:t('Import statement')}))return;
  await run({kind:'import',command:{data:preview,idempotencyKey:crypto.randomUUID()}});
 };
 const read=async(id:string,accountId:string)=>{
  setBusy(true);setSelected(null);setError('');try{setSelected(await repo.readBankStatement(workspace.firmId,id,workspace.yearId!,accountId));}catch{setError(t('The saved statement could not be verified.'));}finally{setBusy(false);}
 };
 const display=(value:Array<BankRow&{id?:string}>,label:string)=><div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm" aria-label={label}><thead><tr>{['Bank transaction ID','Booking date','Value date','Incoming RSD','Outgoing RSD','Counterparty','Reference','Description'].map(label=><th key={label} className="p-2">{t(label)}</th>)}{value.some(r=>r.id)&&<th>{t('Payments')}</th>}</tr></thead><tbody>{value.map(r=><tr key={r.externalId}>{[r.externalId,r.bookingDate,r.valueDate,formatRsd(r.incoming),formatRsd(r.outgoing),r.counterparty,r.reference,r.description].map((cell,index)=><td key={index} className="p-2">{cell}</td>)}{r.id&&<td><Button disabled={locked||accountDirty||formDirty||Boolean(preview)} onClick={()=>setPaymentTransaction(r.id!)}>{t('Reconcile payments')}</Button></td>}</tr>)}</tbody></table></div>;
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={t('Bank statements')}>
  <h2 className="font-semibold">{t('Bank statements')}</h2><p className="text-sm text-slate-500">{t('Import incoming and outgoing transactions. Invoice payments and ledger posting are handled separately.')}</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}{pending&&<Button disabled={busy} onClick={()=>void run(pending)}>{t('Retry the same request')}</Button>}
  {receipt&&<p role="status">{t(receipt.previouslyImported?'This statement was already imported.':'Statement imported.')} · {t('New transactions')}: {receipt.newCount} · {t('Reused transactions')}: {receipt.reusedCount}</p>}
  {canCreate&&<details><summary>{t('Add bank account')}</summary><form onSubmit={e=>{e.preventDefault();void create();}}><fieldset disabled={locked} onChange={()=>setAccountDirty(true)} className="flex flex-wrap items-end gap-3 py-3"><label>{t('New bank account name')}<input required className={field} value={accountName} onChange={e=>setAccountName(e.target.value)}/></label><label>{t('New bank account number')}<input required className={field} value={accountNumber} onChange={e=>setAccountNumber(e.target.value)}/></label><Button type="submit">{t('Create bank account')}</Button><Button onClick={()=>{setAccountName('');setAccountNumber('');setAccountDirty(false);}}>{t('Clear account fields')}</Button></fieldset></form></details>}
  <details><summary>{t('Import Excel statement')}</summary><p className="text-sm">{t('Use one worksheet and the template columns. Bank IDs and amounts must be text; dates may be ISO dates or Excel dates. RSD only, up to 2000 rows and 5 MB. Keep the original file.')}</p>
   <Button disabled={locked} onClick={()=>void downloadBankTemplate().catch(()=>setError(t('The Excel template could not be downloaded.')))}>{t('Download Excel template')}</Button>
   <fieldset disabled={locked||!canImport} onChange={()=>{setFormDirty(true);setPreview(null);}} className="grid gap-3 py-3 sm:grid-cols-3">
    <label>{t('Statement bank account')}<select className={field} value={account} onChange={e=>setAccount(e.target.value)}><option value="">—</option>{data?.accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.number}</option>)}</select></label>
    <label>{t('Statement reference')}<input className={field} value={reference} onChange={e=>setReference(e.target.value)}/></label>
    <label>{t('Statement start')}<input type="date" className={field} value={starts} onChange={e=>setStarts(e.target.value)}/></label><label>{t('Statement end')}<input type="date" className={field} value={ends} onChange={e=>setEnds(e.target.value)}/></label>
    <label>{t('Opening RSD')}<input className={field} value={opening} onChange={e=>setOpening(e.target.value)}/></label><label>{t('Closing RSD')}<input className={field} value={closing} onChange={e=>setClosing(e.target.value)}/></label>
    <label>{t('Excel statement file')}<input key={fileKey} type="file" accept=".xlsx" disabled={locked} onChange={e=>{const value=e.target.files?.[0];if(value)void file(value);}}/></label><Button disabled={!rows.length} onClick={prepare}>{t('Review statement')}</Button><Button onClick={clear}>{t('Clear statement fields')}</Button>
   </fieldset>
   {preview&&<div className="space-y-2"><p>{filename} · {preview.rows.length} {t('transactions')} · {t('Incoming RSD')}: {formatRsd(preview.rows.reduce((s,r)=>s+BigInt(r.incoming),BigInt(0)).toString())} · {t('Outgoing RSD')}: {formatRsd(preview.rows.reduce((s,r)=>s+BigInt(r.outgoing),BigInt(0)).toString())}</p>{display(preview.rows,t('Statement preview'))}<Button disabled={locked||!canImport} onClick={()=>void save()}>{t('Import statement')}</Button></div>}
  </details>
  <div className="flex flex-wrap gap-2">{data?.statements.map(s=><Button key={s.id} disabled={locked} onClick={()=>void read(s.id,s.accountId)}>{s.reference} · {s.endsOn} · {s.rowCount}</Button>)}</div>
  {selected&&<div><h3>{selected.reference} · {formatRsd(selected.opening)} → {formatRsd(selected.closing)} RSD</h3>{display(selected.rows,t('Saved statement transactions'))}<Button disabled={locked} onClick={()=>setSelected(null)}>{t('Close statement')}</Button><Button disabled={locked||accountDirty||formDirty||Boolean(preview)} onClick={()=>setAttachmentsOpen(true)}>{t('Manage attachments')}</Button></div>}
  {attachmentsOpen&&selected&&<AttachmentsPanel repo={repo} firmId={workspace.firmId} targetType="bank_statement" targetId={selected.statementId} targetRevision={null} title={selected.reference} canWrite={canImport} disabled={disabled||busy||Boolean(pending)} onBusy={attachmentState} onClose={()=>setAttachmentsOpen(false)}/>}
  {paymentTransaction&&selected&&<PaymentsPanel key={paymentTransaction} repo={repo} workspace={workspace} firmId={workspace.firmId} transactionId={paymentTransaction} accountId={selected.accountId} canWrite={canImport} canCancel={canImport&&workspace.capabilities.includes('reverse_journal')} disabled={disabled||busy||Boolean(pending)} onBusy={paymentState} onClose={()=>setPaymentTransaction(null)}/>}
 </section>;
};
