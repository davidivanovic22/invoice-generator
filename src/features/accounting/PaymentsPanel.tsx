import { useEffect, useState, type ReactNode } from 'react';
import { type PaymentCommand, type PaymentWorkspace } from '../../domain/accounting/payments';
import { type PaymentLedgerCommand,type PaymentLedgerWorkspace } from '../../domain/accounting/paymentLedger';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { AccountingError, type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { t } from '../../i18n';
import { formatRsd, parseRsd } from './money';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export const PaymentsPanel = ({ repo, workspace,firmId, transactionId, accountId, canWrite, canCancel, disabled, onBusy, onClose }: {
  workspace:AccountingWorkspace;
  repo: SupabaseAccountingRepository; firmId: string; transactionId: string; accountId: string;
  canWrite: boolean; canCancel: boolean; disabled: boolean; onBusy: (busy: boolean) => void; onClose: () => void;
}) => {
  const { confirm } = useFeedback();
  const [data, setData] = useState<PaymentWorkspace | null>(null);
  const [ledger,setLedger]=useState<PaymentLedgerWorkspace|null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState<PaymentCommand|PaymentLedgerCommand | null>(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'payment'|'refund'>('payment');
  const [documentId, setDocumentId] = useState('');
  const [refundOf, setRefundOf] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [reason, setReason] = useState('');
  const [period,setPeriod]=useState(workspace.periods.find(p=>p.status==='open')?.id||'');
  const [postingDate,setPostingDate]=useState('');
  const [bankAccount,setBankAccount]=useState('');const [clearingAccount,setClearingAccount]=useState('');const [documentAccount,setDocumentAccount]=useState('');
  const locked = disabled || loading || busy || reviewing || Boolean(pending);
  useEffect(() => { onBusy(busy || reviewing || Boolean(pending)); }, [busy, reviewing, pending, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void repo.paymentWorkbench(firmId, transactionId, accountId).then(({reconciliation:value,ledger:book}) => {
      if (active) { setData(value);setLedger(book);setPostingDate(current=>current||value.transaction.bookingDate); setError(''); }
    }).catch(() => { if (active) { setData(null);setLedger(null); setError(t('Payment reconciliation could not be loaded.')); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo, firmId, transactionId, accountId, refresh]);
  const run = async (command: PaymentCommand|PaymentLedgerCommand) => {
    onBusy(true);
    setBusy(true); setPending(command); setError('');
    try {
      if(command.action==='bank'||command.action==='allocation')await repo.postPaymentLedger(command);
      else await repo.paymentCommand(command);
      setPending(null); setAmount('0.00'); setReason(''); setRefresh(v => v + 1);
    } catch (e) {
      const code = e instanceof AccountingError ? e.code : 'unavailable';
      const unknown = code === 'unavailable' || code === 'invalid_response';
      setError(t(unknown ? 'Unknown payment result. Retry the same request before editing.' :
        'Payment or ledger command refused. Review access, accounts, dates, period, remaining amounts and refunds.'));
      if (!unknown) setPending(null);
    } finally { setBusy(false); }
  };
  const selected = data?.documents.find(d => d.id === documentId);
  const documents = data?.documents.filter(d => ((d.direction === 'outgoing') !== (kind === 'refund')) === (data.transaction.incoming !== '0')) || [];
  const confirmCommand = async (command: PaymentCommand | PaymentLedgerCommand, title: string, message: ReactNode, confirmLabel: string) => {
    onBusy(true); setReviewing(true);
    try { if (await confirm({title: t(title), message, confirmLabel: t(confirmLabel)})) await run(command); }
    finally { setReviewing(false); }
  };
  const ledgerReview = (allocationId?: string, reverse = false) => {
    if (!data || !ledger) throw new Error();
    const postingPeriod = workspace.periods.find(p => p.id === period && p.status === 'open');
    if (!postingPeriod || !postingDate || postingDate < postingPeriod.startsOn || postingDate > postingPeriod.endsOn) throw new Error();
    const allocation = allocationId ? data.allocations.find(a => a.id === allocationId && a.status === 'active') : undefined;
    if (allocationId && !allocation) throw new Error();
    const booked = ledger.allocations.find(a => a.id === allocationId);
    const firstId = allocation ? ledger.bank?.clearingAccountId : bankAccount;
    const secondId = allocation ? (reverse ? booked?.documentAccountId : documentAccount) : clearingAccount;
    const first = workspace.accounts.find(a => a.id === firstId);
    const second = workspace.accounts.find(a => a.id === secondId);
    if (!first || !second || first.id === second.id || (allocation && (!ledger.bank || ledger.bank.reversed))) throw new Error();
    const inflow = data.transaction.incoming !== '0';
    const debit = inflow !== reverse ? first : second;
    const credit = inflow !== reverse ? second : first;
    const value = allocation?.amount ?? (BigInt(data.transaction.incoming) + BigInt(data.transaction.outgoing)).toString();
    const document = data.documents.find(d => d.id === allocation?.documentId);
    return <div className="space-y-2">
      <p>{data.transaction.externalId} · {t('Bank booking date')}: {data.transaction.bookingDate}</p>
      {allocation && <p>{allocation.number}{document && ` · ${document.partnerName}`} · {t(allocation.kind)}</p>}
      <p>{t('Payment posting date')}: {postingDate} · {t('Payment posting period')}: {postingPeriod.startsOn} – {postingPeriod.endsOn}</p>
      <table className="w-full text-left" aria-label={t('Payment journal preview')}>
        <thead><tr><th>{t('Ledger account')}</th><th>{t('Debit')}</th><th>{t('Credit')}</th></tr></thead>
        <tbody><tr><td>{debit.code} · {debit.name}</td><td>{formatRsd(value)}</td><td>0.00</td></tr>
          <tr><td>{credit.code} · {credit.name}</td><td>0.00</td><td>{formatRsd(value)}</td></tr></tbody>
      </table><p>{formatRsd(value)} RSD · {t(reverse ? 'Full reversal of the posted allocation.' : allocation ? 'Only this allocation will be posted.' : 'The full bank transaction will be posted.')}</p>
    </div>;
  };
  const allocate = async () => {
    try {
      if (!selected) throw new Error();
      const value = parseRsd(amount);
      if (BigInt(value) <= BigInt(0)) throw new Error();
      await confirmCommand({ action: 'allocate', idempotencyKey: crypto.randomUUID(), data: { firmId, id: crypto.randomUUID(),
        transactionId, documentId, documentRevision: selected.revision, kind, refundOf: kind === 'refund' ? refundOf : null, amount: value } },
        'Confirm bank allocation?', `${data?.transaction.externalId} · ${selected.number} · ${selected.partnerName} · ${formatRsd(value)} RSD · ${t(kind)}`, 'Confirm allocation');
    } catch { setError(t('Select a document and enter a positive exact RSD amount.')); }
  };
  const cancel = async (id: string) => {
    const allocation=data?.allocations.find(a=>a.id===id);
    if (!allocation) return;
    if (!reason.trim()) { setError(t('Enter an allocation cancellation reason.')); return; }
    const posted=ledger?.allocations.some(a=>a.id===id);
    let review: ReactNode;
    try { review = posted ? ledgerReview(id, true) : <p>{allocation.number} · {formatRsd(allocation.amount)} RSD · {t('No ledger entry exists for this allocation.')}</p>; }
    catch { setError(t('Choose the ledger accounts, open period and posting date.')); return; }
    await confirmCommand({ action: 'cancel', idempotencyKey: crypto.randomUUID(), data: { firmId, id, transactionId, documentId:allocation.documentId, expectedRevision: '1', reason,...(posted?{periodId:period,postingDate}:{}) } },
      'Cancel this allocation?', <div className="space-y-2">{review}<p>{t('Reason')}: {reason}</p></div>, 'Cancel allocation');
  };
  const postLedger=async(allocationId?:string)=>{
    let review: ReactNode;
    try { review = ledgerReview(allocationId); }
    catch { setError(t('Choose the ledger accounts, open period and posting date.')); return; }
    const common={firmId,transactionId,journalId:crypto.randomUUID(),fiscalYearId:workspace.yearId!,periodId:period,postingDate};
    await confirmCommand(allocationId?{action:'allocation',idempotencyKey:crypto.randomUUID(),data:{...common,allocationId,documentAccountId:documentAccount}}:{action:'bank',idempotencyKey:crypto.randomUUID(),data:{...common,bankAccountId:bankAccount,clearingAccountId:clearingAccount}}, 'Post bank ledger entry?', review, 'Post ledger entry');
  };
  return <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3" aria-label={t('Bank payment reconciliation')}>
    <h3 className="font-semibold">{t('Bank payment reconciliation')}</h3>
    <p className="text-sm">{t('Confirm the bank evidence and document manually. Ledger posting is a separate explicit action.')}</p>
    <p className="text-sm">{t('Close reconciliation and refresh the workspace to update document statuses.')}</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {pending && <Button disabled={busy} onClick={() => void run(pending)}>{t('Retry the same request')}</Button>}
    {data && <>
      <p>{data.transaction.externalId} · {data.transaction.bookingDate} · {t('Unallocated RSD')}: {formatRsd(data.transaction.available)}</p>
      {ledger&&<fieldset disabled={locked||!canWrite} className="grid gap-3 rounded border p-3 sm:grid-cols-3">
        <label>{t('Payment posting period')}<select className={field} value={period} onChange={e=>setPeriod(e.target.value)}><option value="">—</option>{workspace.periods.filter(p=>p.status==='open').map(p=><option key={p.id} value={p.id}>{p.startsOn} · {p.endsOn}</option>)}</select></label>
        <label>{t('Payment posting date')}<input className={field} type="date" value={postingDate} onChange={e=>setPostingDate(e.target.value)}/></label>
        {!ledger.bank?<><label>{t('Bank ledger account')}<select className={field} value={bankAccount} onChange={e=>setBankAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&!a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label>{t('Bank clearing account')}<select className={field} value={clearingAccount} onChange={e=>setClearingAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&!a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><Button onClick={()=>void postLedger()}>{t('Post bank transaction')}</Button></>:<p className="sm:col-span-3">{t(ledger.bank.reversed?'Bank source reversed.':'Bank source posted.')}{!ledger.bank.reversed&&<> · {t('Clearing remaining RSD')}: {formatRsd(ledger.bank.clearingRemaining)} · {t('Unposted allocations RSD')}: {formatRsd((BigInt(ledger.bank.clearingRemaining)-BigInt(data.transaction.available)).toString())}</>}</p>}
        <label>{t('Payment document ledger account')}<select className={field} value={documentAccount} onChange={e=>setDocumentAccount(e.target.value)}><option value="">—</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&a.requiresPartner).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
      </fieldset>}
      <fieldset disabled={locked || !canWrite} className="grid gap-3 sm:grid-cols-3">
        <label>{t('Allocation kind')}<select className={field} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setDocumentId(''); setRefundOf(''); }}><option value="payment">{t('payment')}</option><option value="refund">{t('refund')}</option></select></label>
        <label>{t('Payment document')}<select className={field} value={documentId} onChange={e => { setDocumentId(e.target.value); setRefundOf(''); }}><option value="">—</option>{documents.map(d => <option key={d.id} value={d.id}>{d.number} · {d.partnerName}</option>)}</select></label>
        {kind === 'refund' && <label>{t('Original payment allocation')}<select className={field} value={refundOf} onChange={e => setRefundOf(e.target.value)}><option value="">—</option>{data.refundablePayments.filter(p => p.documentId === documentId).map(p => <option key={p.id} value={p.id}>{p.externalId} · {p.bookingDate} · {formatRsd(p.available)} RSD</option>)}</select></label>}
        <label>{t('Allocation RSD')}<input className={field} value={amount} onChange={e => setAmount(e.target.value)}/></label>
        <Button disabled={!selected || (kind === 'refund' && !refundOf)} onClick={() => void allocate()}>{t('Confirm allocation')}</Button>
      </fieldset>
      {selected && <p>{t('Bank settled RSD')}: {formatRsd(selected.balance.paid)} · {t('Advance applied RSD')}: {formatRsd(selected.balance.advances)} · {t('Open RSD')}: {formatRsd(selected.balance.due)} · {t('Overpaid RSD')}: {formatRsd(selected.balance.overpaid)} · {t('Payment status')}: {t(selected.balance.status)}</p>}
      <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm" aria-label={t('Open document items')}><caption>{t('Latest 100 issued documents across fiscal years. Bank reconciliation is separate from the ledger balance.')}</caption>
        <thead><tr>{['Payment document','Counterparty','Bank settled RSD','Advance applied RSD','Open RSD','Overpaid RSD','Payment status'].map(label=><th className="p-2" key={label}>{t(label)}</th>)}</tr></thead>
        <tbody>{data.documents.filter(d=>d.balance.due!=='0'||d.balance.overpaid!=='0').map(d=><tr key={d.id}>{[d.number,d.partnerName,formatRsd(d.balance.paid),formatRsd(d.balance.advances),formatRsd(d.balance.due),formatRsd(d.balance.overpaid),t(d.balance.status)].map((value,index)=><td className="p-2" key={index}>{value}</td>)}</tr>)}</tbody>
      </table></div>
      <div className="space-y-2">{data.allocations.map(a => {const booked=ledger?.allocations.find(l=>l.id===a.id);return <article key={a.id} className="rounded border p-2 text-sm"><p>{a.number} · {t(a.kind)} · {formatRsd(a.amount)} RSD · {t(a.status)}{a.reason && ` · ${a.reason}`}</p>
        {booked?<p>{t(booked.reversalId?'Allocation ledger reversed.':'Allocation ledger posted.')} · {t('Document source account remaining RSD')}: {formatRsd(booked.accountRemaining)}</p>:a.status==='active'&&<Button disabled={locked||!canWrite||!ledger?.bank||ledger.bank.reversed} onClick={()=>void postLedger(a.id)}>{t('Post allocation ledger')}</Button>}
        {a.status === 'active' && <Button disabled={locked || !canCancel || (a.kind === 'payment' && a.refundable !== a.amount)} onClick={() => void cancel(a.id)}>{t('Cancel allocation')}</Button>}</article>;})}</div>
      <label>{t('Allocation cancellation reason')}<input disabled={locked || !canCancel} className={field} value={reason} onChange={e => setReason(e.target.value)}/></label>
    </>}
    <Button disabled={busy || reviewing || Boolean(pending)} onClick={onClose}>{t('Close payment reconciliation')}</Button>
  </section>;
};
