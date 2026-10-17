import { useCallback, useEffect, useState } from 'react';
import { DocumentsPanel } from './DocumentsPanel';
import { BankPanel } from './BankPanel';
import { ReportsPanel } from './ReportsPanel';
import { PartnerReportsPanel } from './PartnerReportsPanel';
import { FxPanel } from './FxPanel';
import { FxBankPanel } from './FxBankPanel';
import { InventoryPanel } from './InventoryPanel';
import { OpeningPanel } from './OpeningPanel';
import { TaxRulesPanel } from './TaxRulesPanel';
import { TaxEvidencePanel } from './TaxEvidencePanel';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCloud } from '../account/CloudSection';
import { getClient } from '../../lib/cloud';
import { AccountingError, SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace, SaveDraftCommand } from '../../domain/accounting/commands';
import { validateJournal, type JournalDraft, type PostJournalCommand } from '../../domain/accounting/journal';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';
import { formatRsd, parseRsd } from './money';

type Line = { id: string; accountId: string; partnerId: string; debit: string; credit: string; description: string };
type Editor = { id: string; periodId: string; date: string; description: string; lines: Line[]; revision: string; status: 'draft' | 'posted'; number?: string };
type Pending = { kind: 'save'; command: SaveDraftCommand } | { kind: 'post'; command: PostJournalCommand };
const blankLine = (): Line => ({ id: crypto.randomUUID(), accountId: '', partnerId: '', debit: '0.00', credit: '0.00', description: '' });
const fromDraft = (draft: JournalDraft, revision: string, status: Editor['status']): Editor => ({ id: draft.id, periodId: draft.periodId, date: draft.postingDate, description: draft.description, revision, status,
  lines: draft.lines.map(line => ({ ...line, partnerId: line.partnerId || '', debit: formatRsd(line.debit), credit: formatRsd(line.credit) })) });
const message = (error: unknown) => {
  const code = error instanceof AccountingError ? error.code : error instanceof Error ? error.message : '';
  const messages: Record<string,string> = {
    forbidden: 'Your accounting access has been revoked or this action is not allowed.',
    stale_revision: 'This draft changed on the server. Your input remains here. Open the saved draft to review it.',
    closed_period: 'This period is closed. The journal was not changed.',
    invalid_journal: 'Check the date, accounts, partners and journal amounts.',
    invalid_amount: 'Enter a nonnegative RSD amount with at most two decimal places.',
    duplicate_source: 'This identifier or account code already exists.',
    idempotency_reuse: 'This request key belongs to a different command. Reload and review the server state.',
    invalid_response: 'The server response could not be verified. Retry the same request.',
    unavailable: 'The result is unknown because the connection failed. Retry the same request before editing.'
  };
  return t(messages[code] || 'Accounting is unavailable. Check your connection and whether accounting is enabled on this server.');
};
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-4 space-y-3';

export const AccountingPage = () => {
  const cloud = useCloud();
  const [repo, setRepo] = useState<SupabaseAccountingRepository | null>(null);
  useEffect(() => {
    let active = true;
    if (cloud.email) void getClient().then(client => { if (active && client) setRepo(new SupabaseAccountingRepository(client)); });
    return () => { active = false; };
  }, [cloud.email]);
  if (!cloud.email) return <div className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">{t('Accounting')}</h1><p>{t('Connect to the database and sign in to use accounting.')}</p></div>;
  if (!repo) return <p className="p-6">{t('Loading accounting...')}</p>;
  return <AccountingWorkspacePage key={cloud.email} repo={repo} />;
};

export const AccountingWorkspacePage = ({ repo }: { repo: SupabaseAccountingRepository }) => {
  const { confirm } = useFeedback();
  const navigate = useNavigate();
  const active = useLocation().pathname === '/accounting';
  const [firms, setFirms] = useState<Array<{ id: string; name: string; taxId: string | null }>>([]);
  const [firmId, setFirmId] = useState('');
  const [yearId, setYearId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<AccountingWorkspace | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [documentDirty,setDocumentDirty]=useState(false);
  const [documentBusy,setDocumentBusy]=useState(false);
  const [bankDirty,setBankDirty]=useState(false);
  const [bankBusy,setBankBusy]=useState(false);
  const [fxOwnDirty,setFxDirty]=useState(false);
  const [fxOwnBusy,setFxBusy]=useState(false);
  const [fxBankDirty,setFxBankDirty]=useState(false);
  const [fxBankBusy,setFxBankBusy]=useState(false);
  const [stockDirty,setStockDirty]=useState(false);
  const [stockBusy,setStockBusy]=useState(false);
  const stockState=useCallback((dirty:boolean,busy:boolean)=>{setStockDirty(dirty);setStockBusy(busy);},[]);
  const [openingDirty,setOpeningDirty]=useState(false);
  const [openingBusy,setOpeningBusy]=useState(false);
  const openingState=useCallback((dirty:boolean,busy:boolean)=>{setOpeningDirty(dirty);setOpeningBusy(busy);},[]);
  const [taxDirty,setTaxDirty]=useState(false),[taxBusy,setTaxBusy]=useState(false);
  const taxState=useCallback((dirty:boolean,busy:boolean)=>{setTaxDirty(dirty);setTaxBusy(busy);},[]);
  const fxDirty=fxOwnDirty||fxBankDirty||stockDirty||openingDirty||taxDirty,fxBusy=fxOwnBusy||fxBankBusy||stockBusy||openingBusy||taxBusy;
  const fxBankState=useCallback((dirty:boolean,busy:boolean)=>{setFxBankDirty(dirty);setFxBankBusy(busy);},[]);
  const fxState=useCallback((dirty:boolean,busy:boolean)=>{setFxDirty(dirty);setFxBusy(busy);},[]);
  const bankState=useCallback((dirty:boolean,busy:boolean)=>{setBankDirty(dirty);setBankBusy(busy);},[]);
  const documentState=useCallback((dirty:boolean,busy:boolean)=>{setDocumentDirty(dirty);setDocumentBusy(busy);},[]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [requiresPartner, setRequiresPartner] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void repo.firms().then(result => { if (active) { setFirms(result); setFirmId(current => result.some(f => f.id === current) ? current : result[0]?.id || ''); } })
      .catch(e => { if (active) { setFirms([]); setFirmId(''); setWorkspace(null); setError(message(e)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo, refresh]);
  useEffect(() => {
    let active = true;
    setWorkspace(null);
    if (!firmId) return;
    setLoading(true);
    void repo.workspace(firmId,yearId).then(result => {
      if (!active) return;
      if (yearId === null && result.years.length) { setYearId(result.years[0].id); return; }
      setWorkspace(result);
    }).catch(e => { if (active) setError(message(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo, firmId, yearId, refresh]);

  // Keep unsent input on the page until the user explicitly agrees to leave.
  useEffect(() => {
    if (!dirty && !documentDirty && !documentBusy && !bankDirty && !bankBusy && !fxDirty && !fxBusy && !pending && !busy) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const leave = (event: MouseEvent) => {
      if (!active) return;
      const link = (event.target as HTMLElement)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || new URL(link.href).origin !== window.location.origin || link.target === '_blank' || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      if (busy || documentBusy || bankBusy || fxBusy || pending) { setError(t('Resolve the pending request before leaving this workspace.')); return; }
      void confirm({ title: t('Leave unsaved journal?'), message: t('Your latest changes have not been saved to the server.'), confirmLabel: t('Leave') }).then(yes => { if (yes) { setEditor(null); setDirty(false); navigate(new URL(link.href).pathname); } });
    };
    window.addEventListener('beforeunload',unload);
    document.addEventListener('click',leave,true);
    return () => { window.removeEventListener('beforeunload',unload); document.removeEventListener('click',leave,true); };
  }, [dirty,documentDirty,documentBusy,bankDirty,bankBusy,fxDirty,fxBusy,pending,busy,confirm,navigate,active]);

  const can = (capability: AccountingWorkspace['capabilities'][number]) => workspace?.capabilities.includes(capability) || false;
  const selectedPeriod = workspace?.periods.find(p => p.id === editor?.periodId);
  const locked = busy || loading || Boolean(pending) || documentBusy || bankBusy || fxBusy;
  const editable = !locked && !documentDirty && !bankDirty && !fxDirty && editor?.status === 'draft' && can('post_journal') && selectedPeriod?.status === 'open';
  const allowReplace = async () => (!dirty&&!documentDirty&&!bankDirty&&!fxDirty) || await confirm({ title: t('Discard unsaved changes?'), message: t('Your latest changes have not been saved to the server.'), confirmLabel: t('Discard changes') });
  const resetEditor = () => { setEditor(null); setDirty(false); setDocumentDirty(false); setBankDirty(false); setFxDirty(false); setFxBankDirty(false); setStockDirty(false); setOpeningDirty(false); setTaxDirty(false); setError(''); setNotice(''); setAccountCode(''); setAccountName(''); setPartnerName(''); setRequiresPartner(false); setPeriodStart(''); setPeriodEnd(''); };
  const switchFirm = async (id: string) => { if (locked || !await allowReplace()) return; resetEditor(); setWorkspace(null); setYearId(null); setFirmId(id); };
  const switchYear = async (id: string) => { if ((id || null) === yearId || locked || !await allowReplace()) return; resetEditor(); setWorkspace(null); setYearId(id || null); };
  const update = (patch: Partial<Editor>) => { if (editable && editor) { setEditor({ ...editor,...patch }); setDirty(true); setNotice(''); } };
  const updateLine = (id: string, patch: Partial<Line>) => update({ lines: editor!.lines.map(line => line.id === id ? { ...line,...patch } : line) });
  const newJournal = async () => {
    if (locked || documentDirty || bankDirty || fxDirty || !await allowReplace()) return;
    const period = workspace?.periods.find(p => p.status === 'open');
    if (!period) return;
    setEditor({ id: crypto.randomUUID(), periodId: period.id, date: period.startsOn, description: '', lines: [blankLine(),blankLine()], revision: '0', status: 'draft' });
    setDirty(true); setError(''); setNotice('');
  };
  const open = async (id: string, posted: boolean) => {
    if (locked || documentDirty || bankDirty || fxDirty || !await allowReplace()) return;
    setBusy(true); setError('');
    try {
      if (posted) {
        const result = await repo.read(firmId,id);
        if (!result || result.draft.fiscalYearId !== yearId) throw new AccountingError('invalid_response');
        const draft = { ...result.draft, lines: result.draft.lines.map(line => ({ ...line, partnerId: line.partnerId || undefined })) };
        setEditor({ ...fromDraft(draft,result.receipt.revision,'posted'), number: result.receipt.number });
      } else {
        const result = await repo.readDraft(firmId,id);
        if (!result || result.draft.fiscalYearId !== yearId) throw new AccountingError('invalid_response');
        setEditor(fromDraft(result.draft,result.revision,result.status));
      }
      setDirty(false); setNotice('');
    } catch(e) { setError(message(e)); } finally { setBusy(false); }
  };
  const payload = (): JournalDraft => {
    if (!editor || !yearId) throw new AccountingError('invalid_journal');
    return { id: editor.id, firmId, fiscalYearId: yearId, periodId: editor.periodId, postingDate: editor.date, description: editor.description,
      lines: editor.lines.map(line => ({ id: line.id, accountId: line.accountId, ...(line.partnerId ? { partnerId: line.partnerId } : {}), debit: parseRsd(line.debit), credit: parseRsd(line.credit), description: line.description })) };
  };
  const execute = async (request: Pending) => {
    setBusy(true); setPending(request); setError(''); setNotice('');
    try {
      if (request.kind === 'save') {
        const result = await repo.saveDraft(request.command);
        setEditor(current => current ? { ...current, revision: result.revision } : current);
        setNotice(t('Draft saved to the server.'));
      } else {
        const result = await repo.post(request.command);
        if (!result.ok) throw new AccountingError(result.code);
        setEditor(current => current ? { ...current, status: 'posted', revision: result.receipt.revision, number: result.receipt.number } : current);
        setNotice(t('Journal posted. Changes now require a reversal.'));
      }
      setDirty(false); setPending(null); setRefresh(value => value+1);
    } catch(e) {
      setError(message(e));
      if (e instanceof AccountingError && e.code !== 'unavailable' && e.code !== 'invalid_response') setPending(null);
    } finally { setBusy(false); }
  };
  const save = async () => {
    try { await execute({ kind: 'save', command: { draft: payload(), expectedRevision: editor!.revision, idempotencyKey: crypto.randomUUID() } }); }
    catch(e) { setError(message(e)); }
  };
  const post = async () => {
    try {
      const draft = payload();
      if (!workspace || !selectedPeriod) return;
      const issues = validateJournal(draft,{ firmId, fiscalYearId: yearId!, periodId: selectedPeriod.id, periodStart: selectedPeriod.startsOn, periodEnd: selectedPeriod.endsOn, periodStatus: selectedPeriod.status, canPost: can('post_journal'), accounts: workspace.accounts.map(a => ({ ...a,firmId })), partners: workspace.partners.map(p => ({ ...p,firmId })) });
      if (issues.length) { setError(t('The journal must contain at least two valid, balanced lines. Check accounts and required partners.')); return; }
      if (!await confirm({ title: t('Post this journal?'), message: `${editor!.date} · ${editor!.description} · ${formatRsd(draft.lines.reduce((sum,line) => sum+BigInt(line.debit),BigInt(0)).toString())} RSD`, confirmLabel: t('Post journal') })) return;
      await execute({ kind: 'post', command: { kind: 'postJournal', draft, expectedRevision: editor!.revision, idempotencyKey: crypto.randomUUID() } });
    } catch(e) { setError(message(e)); }
  };
  const create = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); setRefresh(value => value+1); setNotice(t('Saved to the server.')); }
    catch(e) { setError(message(e)); } finally { setBusy(false); }
  };
  let debit = BigInt(0), credit = BigInt(0), invalidAmount = false;
  for (const line of editor?.lines || []) { try { debit+=BigInt(parseRsd(line.debit)); credit+=BigInt(parseRsd(line.credit)); } catch { invalidAmount=true; } }
  const firm = firms.find(f => f.id === firmId);
  const year = workspace?.years.find(y => y.id === yearId);

  return <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{t('Accounting')}</h1><Button disabled={locked || dirty || documentDirty || bankDirty || fxDirty} onClick={() => { setError(''); setRefresh(v => v+1); }}>{t('Refresh workspace')}</Button></div>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {pending && <Button disabled={busy} onClick={() => void execute(pending)}>{t('Retry the same request')}</Button>}
    <section aria-label={t('Accounting context')} className={card}>
      <div className="grid gap-3 sm:grid-cols-2"><label>{t('Accounting firm')}<select className={field} value={firmId} disabled={locked} onChange={e => void switchFirm(e.target.value)}><option value="">{t('Select a firm')}</option>{firms.map(f => <option key={f.id} value={f.id}>{f.name} · {f.taxId || '—'}</option>)}</select></label>
      <label>{t('Fiscal year')}<select className={field} value={yearId || ''} disabled={locked || !workspace?.years.length} onChange={e => void switchYear(e.target.value)}><option value="">{t('Select a year')}</option>{workspace?.years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label></div>
      {firm && <p className="text-sm font-medium">{firm.name} · PIB {firm.taxId || '—'} · {year?.label || t('No fiscal year')}</p>}
      {loading && <p>{t('Loading accounting...')}</p>}
      {!loading && !firms.length && <p>{t('No firms assigned. Ask the firm owner for accounting access.')}</p>}
      {workspace && !can('post_journal') && <p className="text-sm text-slate-600">{t('Read only. Posting requires an explicit accounting permission.')}</p>}
    </section>
    {workspace && <>
      <TaxRulesPanel key={`tax:${firmId}:${yearId}`} firmId={firmId} disabled={locked}/>
      {yearId&&<TaxEvidencePanel key={`tax-evidence:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||bankDirty||bankBusy||fxOwnDirty||fxOwnBusy||fxBankDirty||fxBankBusy||stockDirty||stockBusy||openingDirty||openingBusy} onState={taxState}/>}
      {yearId && <OpeningPanel key={`opening:${firmId}:${yearId}`} repo={repo} workspace={workspace} taxId={firms.find(f=>f.id===firmId)?.taxId||null} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||bankDirty||bankBusy||fxOwnDirty||fxOwnBusy||fxBankDirty||fxBankBusy||stockDirty||stockBusy||taxDirty||taxBusy} onState={openingState}/>}
      {yearId && <InventoryPanel key={`stock:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||bankDirty||bankBusy||fxOwnDirty||fxOwnBusy||fxBankDirty||fxBankBusy||openingDirty||openingBusy||taxDirty||taxBusy} onState={stockState}/>}
      {yearId && <ReportsPanel key={`reports:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={locked||dirty||documentDirty||bankDirty||fxDirty}/>}
      {yearId && <PartnerReportsPanel key={`partners:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={locked||dirty||documentDirty||bankDirty||fxDirty}/>}
      {yearId && <FxPanel key={`fx:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||bankDirty||bankBusy||fxBankDirty||fxBankBusy||stockDirty||stockBusy||openingDirty||openingBusy||taxDirty||taxBusy} onState={fxState}/>}
      {yearId && <FxBankPanel key={`fxbank:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||bankDirty||bankBusy||fxOwnDirty||fxOwnBusy||stockDirty||stockBusy||openingDirty||openingBusy||taxDirty||taxBusy} onState={fxBankState}/>}
      {yearId && <BankPanel key={`bank:${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||documentDirty||documentBusy||fxDirty||fxBusy} onState={bankState}/>}
      {yearId && <DocumentsPanel key={`${firmId}:${yearId}`} repo={repo} workspace={workspace} disabled={busy||loading||Boolean(pending)||dirty||bankDirty||bankBusy||fxDirty||fxBusy} onState={documentState}/>} 
      <details className={card} open={settingsOpen} onToggle={e => setSettingsOpen(e.currentTarget.open)}><summary className="cursor-pointer font-semibold">{t('Years, periods and chart of accounts')}</summary>
        <fieldset disabled={locked || documentDirty || bankDirty || fxDirty} className="space-y-4">
          {can('manage_periods') && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void create(() => repo.createEntity(firmId,{ kind:'year',data:{ id:crypto.randomUUID(),label:Number(newYear),startsOn:`${newYear}-01-01`,endsOn:`${newYear}-12-31` } })); }}><label>{t('New fiscal year')}<input className={field} type="number" min="1900" max="9999" required value={newYear} onChange={e => setNewYear(e.target.value)} /></label><Button type="submit">{t('Create year')}</Button></form>}
          {can('manage_periods') && yearId && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void create(() => repo.createEntity(firmId,{ kind:'period',data:{ id:crypto.randomUUID(),fiscalYearId:yearId,startsOn:periodStart,endsOn:periodEnd } })); }}><label>{t('Period start')}<input className={field} type="date" required value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></label><label>{t('Period end')}<input className={field} type="date" required value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></label><Button type="submit">{t('Create period')}</Button></form>}
          <ul className="text-sm">{workspace.periods.map(p => <li key={p.id}>{p.startsOn} — {p.endsOn} · {t(p.status === 'open' ? 'Open period' : 'Closed period')}</li>)}</ul>
          {can('manage_chart') && year && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void create(async () => { await repo.createEntity(firmId,{ kind:'account',data:{ id:crypto.randomUUID(),code:accountCode,name:accountName,validFrom:year.startsOn,requiresPartner } }); setAccountCode(''); setAccountName(''); }); }}><label>{t('Account code')}<input className={field} required maxLength={20} value={accountCode} onChange={e => setAccountCode(e.target.value)} /></label><label>{t('Account name')}<input className={field} required maxLength={200} value={accountName} onChange={e => setAccountName(e.target.value)} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={requiresPartner} onChange={e => setRequiresPartner(e.target.checked)} />{t('Partner required')}</label><Button type="submit">{t('Create ledger account')}</Button></form>}
          <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t('Account code')}</th><th>{t('Account name')}</th><th>{t('Valid from')}</th><th>{t('Partner required')}</th></tr></thead><tbody>{workspace.accounts.map(a => <tr key={a.id}><td>{a.code}</td><td>{a.name}{!a.active && ` · ${t('Inactive')}`}{!a.allowsPosting && ` · ${t('Summary account')}`}</td><td>{a.validFrom} — {a.validTo || '…'}</td><td>{a.requiresPartner ? t('Yes') : '—'}</td></tr>)}</tbody></table></div>
          {can('manage_chart') && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void create(async () => { await repo.createEntity(firmId,{ kind:'partner',data:{ id:crypto.randomUUID(),name:partnerName } }); setPartnerName(''); }); }}><label>{t('New accounting partner')}<input className={field} required maxLength={200} value={partnerName} onChange={e => setPartnerName(e.target.value)} /></label><Button type="submit">{t('Create partner')}</Button></form>}
        </fieldset>
      </details>
      <div className="grid items-start gap-4 lg:grid-cols-[17rem_1fr]">
        <section className={card}><Button variant="primary" disabled={locked || documentDirty || bankDirty || fxDirty || !can('post_journal') || !workspace.periods.some(p => p.status === 'open')} onClick={() => void newJournal()}>{t('New journal')}</Button>
          <h2 className="font-semibold">{t('Saved drafts')}</h2>{workspace.drafts.map(d => <button key={d.id} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-slate-50" disabled={locked} onClick={() => void open(d.id,false)}>{d.postingDate} · {d.description || t('Untitled journal')}</button>)}
          <h2 className="font-semibold">{t('Posted journals')}</h2>{workspace.journals.map(j => <button key={j.id} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-slate-50" disabled={locked} onClick={() => void open(j.id,true)}>{j.number} · {j.description}</button>)}
          <p className="text-xs text-slate-500">{t('Showing up to 100 recent drafts and 100 recent posted journals for this year.')}</p>
        </section>
        {editor ? <section className={card} aria-label={t('Journal editor')}>
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{editor.number || t('Journal draft')}</h2><span className="text-sm">{editor.status === 'posted' ? t('Posted — read only') : dirty ? t('Unsaved changes') : t('Saved draft')} · {t('Revision')} {editor.revision}</span></div>
          <fieldset disabled={!editable} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><label>{t('Accounting period')}<select className={field} value={editor.periodId} onChange={e => update({ periodId:e.target.value })}>{workspace.periods.map(p => <option key={p.id} value={p.id} disabled={p.status === 'closed'}>{p.startsOn} — {p.endsOn} · {t(p.status === 'open' ? 'Open period' : 'Closed period')}</option>)}</select></label><label>{t('Posting date')}<input className={field} type="date" value={editor.date} onChange={e => update({ date:e.target.value })} /></label></div>
            <label className="block">{t('Journal description')}<input className={field} value={editor.description} onChange={e => update({ description:e.target.value })} /></label>
            <div className="space-y-3">{editor.lines.map((line,index) => <div key={line.id} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3">
              <label>{t('Ledger account')} {index+1}<select className={field} value={line.accountId} onChange={e => updateLine(line.id,{ accountId:e.target.value })}><option value="">{t('Select an account')}</option>{workspace.accounts.map(a => <option key={a.id} value={a.id} disabled={!a.active || !a.allowsPosting}>{a.code} · {a.name}</option>)}</select></label>
              <label>{t('Partner')} {index+1}<select className={field} value={line.partnerId} onChange={e => updateLine(line.id,{ partnerId:e.target.value })}><option value="">—</option>{workspace.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>{t('Line description')} {index+1}<input className={field} value={line.description} onChange={e => updateLine(line.id,{ description:e.target.value })} /></label>
              <label>{t('Debit RSD')} {index+1}<input className={field} inputMode="decimal" value={line.debit} onChange={e => updateLine(line.id,{ debit:e.target.value })} /></label>
              <label>{t('Credit RSD')} {index+1}<input className={field} inputMode="decimal" value={line.credit} onChange={e => updateLine(line.id,{ credit:e.target.value })} /></label>
              <Button onClick={() => update({ lines:editor.lines.filter(l => l.id !== line.id) })}>{t('Remove line')} {index+1}</Button>
            </div>)}</div>
            <Button disabled={editor.lines.length >= 1000} onClick={() => update({ lines:[...editor.lines,blankLine()] })}>{t('Add line')}</Button>
          </fieldset>
          <p className="font-mono text-sm">{t('Debit')}: {formatRsd(debit.toString())} · {t('Credit')}: {formatRsd(credit.toString())} · {t('Difference')}: {formatRsd((debit-credit).toString())} RSD {invalidAmount && ` · ${t('Invalid amount')}`}</p>
          {editor.status === 'draft' && <div className="flex flex-wrap gap-2"><Button disabled={!editable || !dirty} onClick={() => void save()}>{t('Save draft')}</Button><Button variant="primary" disabled={!editable || dirty || editor.revision === '0' || invalidAmount || debit !== credit || debit === BigInt(0)} onClick={() => void post()}>{t('Post journal')}</Button></div>}
          {editor.status === 'draft' && dirty && <p className="text-sm text-slate-500">{t('Save the draft before posting.')}</p>}
        </section> : <section className={card}>{t('Select a saved journal or create a new draft.')}</section>}
      </div>
    </>}
  </div>;
};
