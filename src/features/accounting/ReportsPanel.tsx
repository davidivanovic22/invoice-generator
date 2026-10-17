import { useEffect,useRef,useState } from 'react';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { ledgerRows,type AccountingReport } from '../../domain/accounting/reports';
import type { SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { Button } from '../../ui/Button';
import { t } from '../../i18n';
import { formatRsd } from './money';
import { downloadReport,type ReportKind } from './reportFiles';
const field='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const positive=(v:string)=>formatRsd(BigInt(v)>BigInt(0)?v:'0');
const negative=(v:string)=>formatRsd(BigInt(v)<BigInt(0)?(-BigInt(v)).toString():'0');
export const ReportsPanel=({repo,workspace,disabled}:{repo:SupabaseAccountingRepository;workspace:AccountingWorkspace;disabled:boolean})=>{
 const year=workspace.years.find(y=>y.id===workspace.yearId);
 const [from,setFrom]=useState(year?.startsOn||''),[to,setTo]=useState(year?.endsOn||'');
 const [data,setData]=useState<AccountingReport|null>(null),[busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState('');
 const [kind,setKind]=useState<ReportKind>('trial'),[account,setAccount]=useState(''),[journal,setJournal]=useState('');
 const request=useRef(0);useEffect(()=>()=>{request.current++;},[]);
 const changeRange=(value:string,which:'from'|'to')=>{request.current++;setData(null);setJournal('');setError('');if(which==='from')setFrom(value);else setTo(value);};
 const load=async()=>{
  const token=++request.current;setData(null);setBusy(true);setError('');setJournal('');
  try{const r=await repo.report({firmId:workspace.firmId,yearId:workspace.yearId!,from,to});if(token===request.current){setData(r);setAccount(r.accounts[0]?.accountId||'');}}
  catch{if(token===request.current)setError(t('The report could not be verified. Check access and dates; narrow the range if it exceeds 10000 lines.'));}
  finally{if(token===request.current)setBusy(false);}
 };
 const exportFile=async()=>{if(!data)return;setExporting(true);setError('');try{await downloadReport(data,kind,account);}catch{setError(t('The report could not be exported.'));}finally{setExporting(false);}};
 const lock=disabled||busy||exporting;
 const selected=data?.accounts.find(a=>a.accountId===account);
 const journalRows=data?.lines.filter(l=>l.journalId===journal)||[];
 const journalHeads=Array.from(new Map(data?.lines.map(l=>[l.journalId,l])||[]).values());
 const table=(lines:typeof journalRows,ledger=false)=><div className="overflow-auto"><table className="w-full text-left text-sm" aria-label={t(ledger?'Ledger entries':'Journal lines')}><thead><tr>{['Posting date','Journal','Ledger account','Partner','Description','Debit','Credit',...(ledger?['Running balance']:[])].map(h=><th className="p-2" key={h}>{t(h)}</th>)}</tr></thead><tbody>{lines.map(l=><tr key={`${l.journalId}:${l.lineId}`}><td className="p-2">{l.postingDate}</td><td className="p-2"><Button onClick={()=>{setKind('journal');setJournal(l.journalId);}}>{l.number}</Button></td><td className="p-2">{l.accountCode} · {l.accountName}</td><td className="p-2">{l.partnerName||'—'}</td><td className="p-2">{l.description}</td><td className="p-2">{formatRsd(l.debit)}</td><td className="p-2">{formatRsd(l.credit)}</td>{ledger&&<td className="p-2">{formatRsd('balance' in l?String(l.balance):'0')}</td>}</tr>)}</tbody></table></div>;
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={t('Accounting reports')}>
  <h2 className="font-semibold">{t('Accounting reports')}</h2><p className="text-sm text-slate-600">{t('Internal RSD reports from posted journals. Opening balances include earlier entries in this fiscal year; prior-year balances are not carried forward automatically.')}</p>
  {error&&<p role="alert">{error}</p>}
  <fieldset disabled={lock} className="flex flex-wrap items-end gap-3"><label>{t('Report from')}<input className={field} type="date" min={year?.startsOn} max={year?.endsOn} value={from} onChange={e=>changeRange(e.target.value,'from')}/></label><label>{t('Report to')}<input className={field} type="date" min={year?.startsOn} max={year?.endsOn} value={to} onChange={e=>changeRange(e.target.value,'to')}/></label><Button disabled={!from||!to||from>to||!year||from<year.startsOn||to>year.endsOn} onClick={()=>void load()}>{t('Load reports')}</Button></fieldset>
  {busy&&<p role="status">{t('Loading accounting reports...')}</p>}
  {data&&<><p>{data.firmName} · {data.yearLabel} · {data.from} — {data.to} · RSD · {t('Snapshot')}: {data.generatedAt}</p><p>{t('Posted journals')}: {data.journalCount} · {t('Lines')}: {data.lineCount} · {t('Debit')}: {formatRsd(data.totals.debit)} · {t('Credit')}: {formatRsd(data.totals.credit)} RSD</p>{data.lines.some(l=>l.opening)&&<p>Početni nalozi su u dnevniku; njihov iznos ulazi u početno stanje i ne ulazi ponovo u tekući promet. Glavna knjiga počinje tim saldom.</p>}
   <fieldset disabled={lock} className="flex flex-wrap gap-3"><label>{t('Report view')}<select className={field} value={kind} onChange={e=>{setKind(e.target.value as ReportKind);setJournal('');}}><option value="trial">{t('Trial balance')}</option><option value="journal">{t('Journal register')}</option><option value="ledger">{t('General ledger')}</option></select></label>{kind==='ledger'&&<label>{t('Report ledger account')}<select className={field} value={account} onChange={e=>setAccount(e.target.value)}>{data.accounts.map(a=><option key={a.accountId} value={a.accountId}>{a.code} · {a.name}</option>)}</select></label>}<Button disabled={kind==='ledger'&&!selected} onClick={()=>void exportFile()}>{t('Export report Excel')}</Button></fieldset>
   {kind==='trial'&&<div className="overflow-auto"><table aria-label={t('Trial balance')} className="w-full text-left text-sm"><thead><tr>{['Ledger account','Opening debit','Opening credit','Period debit','Period credit','Closing debit','Closing credit'].map(h=><th key={h} className="p-2">{t(h)}</th>)}</tr></thead><tbody>{data.accounts.map(a=><tr key={a.accountId}><td className="p-2"><Button onClick={()=>{setAccount(a.accountId);setKind('ledger');}}>{a.code} · {a.name}</Button></td>{[positive(a.openingBalance),negative(a.openingBalance),formatRsd(a.debit),formatRsd(a.credit),positive(a.closingBalance),negative(a.closingBalance)].map((v,i)=><td className="p-2" key={i}>{v}</td>)}</tr>)}</tbody><tfoot><tr><th>{t('Total')}</th>{['openingBalanceDebit','openingBalanceCredit','debit','credit','closingBalanceDebit','closingBalanceCredit'].map(k=><td className="p-2" key={k}>{formatRsd(data.totals[k as keyof typeof data.totals])}</td>)}</tr></tfoot></table></div>}
   {kind==='ledger'&&selected&&<><p>{selected.code} · {selected.name} · {t('Opening balance')}: {formatRsd(selected.openingBalance)} · {t('Closing balance')}: {formatRsd(selected.closingBalance)} RSD</p>{table(ledgerRows(data,account),true)}</>}
   {kind==='journal'&&<><div className="flex flex-wrap gap-2">{journalHeads.map(j=><Button key={j.journalId} onClick={()=>setJournal(j.journalId)}>{j.number} · {j.postingDate} · {j.journalDescription}</Button>)}</div>{journal? <><p>{journalRows[0]?.journalDescription}{journalRows[0]?.reversalOf&&` · ${t('Reversal')}: ${journalRows[0].reversalOf} · ${journalRows[0].reason}`}</p>{table(journalRows)}</>:table(data.lines)}</>}
   {!data.lines.length&&<p>{t('No posted entries in this date range.')}</p>}
  </>}
 </section>;
};
