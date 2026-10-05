import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { addDaysIso, todayIso } from '../../lib/dates';
import { formatMinor, lineTotalMinor } from '../../lib/money';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { inputClass, NumberField, SelectField, TextArea, TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useAi } from '../ai/AiSettings';
import { CURRENCIES, createLineItem, createParty, invoiceTotals, sameClient, UNITS, type Invoice, type InvoiceStore } from './model';
import { useInvoiceStore } from './store';

const UNIT_LABELS: Record<string, string> = { h: 'hours', day: 'days', pcs: 'pieces', month: 'months', project: 'project', km: 'km' };

/** The latest invoice per client, newest first: the "same as last month" shortcuts. */
export const recurringInvoices = (store: InvoiceStore, limit = 4): Invoice[] => {
  const seen: Invoice[] = [];
  for (const invoice of [...store.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate))) {
    if (!invoice.client.name.trim() || invoice.items.every((item) => item.unitPrice === 0)) continue;
    if (seen.some((other) => sameClient(other.client, invoice.client))) continue;
    seen.push(invoice);
    if (seen.length === limit) break;
  }
  return seen;
};

type Props = { onClose: () => void };

export const QuickInvoiceDialog = ({ onClose }: Props) => {
  const { store, createInvoice, duplicateInvoice } = useInvoiceStore();
  const { hasKey, openSettings } = useAi();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const defaults = store.profile.defaults;
  const recurring = useMemo(() => recurringInvoices(store), [store]);

  const [prompt, setPrompt] = useState('');
  const [thinking, setThinking] = useState(false);
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState(defaults.unit);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState(defaults.currency);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      abortRef.current?.abort();
    };
  }, [onClose]);

  const clientMatches = store.clients.filter((client) => clientName.trim() && client.party.name.toLowerCase().includes(clientName.trim().toLowerCase())).slice(0, 5);

  const open = (invoice: Invoice, print: boolean) => {
    onClose();
    navigate(`/invoices/${invoice.id}${print ? '?print=1' : ''}`);
  };

  const repeat = (source: Invoice) => {
    const copy = duplicateInvoice(source.id);
    if (copy) {
      toast(t('Invoice {number} for {client} is ready', { number: copy.number, client: copy.client.name }));
      open(copy, false);
    }
  };

  const createFromForm = (print: boolean) => {
    const client = store.clients.find((candidate) => sameClient(candidate.party, createParty({ name: clientName })));
    const invoice = createInvoice({
      client: client ? { ...client.party } : createParty({ name: clientName.trim() }),
      clientId: client?.id ?? null,
      currency,
      items: [createLineItem({ title: title.trim(), quantity, unit, unitPrice: price })]
    });
    open(invoice, print);
  };

  const createWithAi = async () => {
    if (!hasKey) {
      openSettings();
      return;
    }
    setThinking(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { parseInvoiceRequest } = await import('./ai');
      const request = await parseInvoiceRequest(prompt, store.clients.map((client) => client.party.name), controller.signal);
      const client = store.clients.find((candidate) => sameClient(candidate.party, createParty({ name: request.clientName })));
      const issueDate = todayIso();
      const invoice = createInvoice({
        client: client ? { ...client.party } : createParty({ name: request.clientName }),
        clientId: client?.id ?? null,
        currency: CURRENCIES.includes(request.currency) ? request.currency : client?.currency || defaults.currency,
        vatPercent: request.vatPercent >= 0 ? request.vatPercent : defaults.vatPercent,
        dueDate: addDaysIso(issueDate, request.dueDays >= 0 ? request.dueDays : defaults.paymentDays),
        items: request.items.length ? request.items.map((item) => createLineItem(item)) : [createLineItem({ unit: defaults.unit })]
      });
      toast(t('Invoice {number} created. Check it and download the PDF.', { number: invoice.number }));
      open(invoice, false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast(error instanceof Error ? error.message : t('Something went wrong.'), 'error');
    } finally {
      setThinking(false);
    }
  };

  const total = formatMinor(lineTotalMinor(quantity, price, currency), currency);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="quick-invoice-title" className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 id="quick-invoice-title" className="text-lg font-semibold text-slate-900">
            {t('New invoice')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="x" />
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-3">
          {recurring.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-medium text-slate-700">{t('Same as last time, one click:')}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recurring.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => repeat(invoice)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-slate-200 transition hover:bg-indigo-50/60 hover:ring-indigo-300"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <Icon name="refresh" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{invoice.client.name}</span>
                      <span className="block truncate text-xs text-slate-500">{formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-indigo-900">
              <Icon name="sparkle" />
              {t('Describe it in one sentence')}
            </div>
            <TextArea
              rows={2}
              value={prompt}
              onChange={setPrompt}
              placeholder={t('e.g. Acme d.o.o., 40 hours of development at 25 €, due in 15 days')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && prompt.trim()) createWithAi();
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-indigo-900/60">{hasKey ? t('AI fills in the client, items and terms.') : t('Needs Claude AI (one-minute setup).')}</span>
              <Button variant="accent" icon="sparkle" onClick={createWithAi} disabled={!prompt.trim() || thinking}>
                {thinking ? t('Creating…') : t('Create')}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            {t('or fill in')}
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2">
              <TextField
                label={t('Client')}
                value={clientName}
                onChange={(value) => {
                  setClientName(value);
                  setShowSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                placeholder={store.clients.length ? t('Start typing a saved client or a new name') : 'Acme d.o.o.'}
                autoComplete="off"
              />
              {showSuggestions && clientMatches.length > 0 && !clientMatches.some((client) => client.party.name === clientName) && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
                  {clientMatches.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setClientName(client.party.name);
                          setCurrency(client.currency || currency);
                          setShowSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                      >
                        {client.party.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <TextField wrapperClassName="col-span-2" label={t('What are you billing for?')} value={title} onChange={setTitle} placeholder={t('e.g. Website development')} />
            <NumberField label={t('Quantity')} value={quantity} onChange={setQuantity} min={0} />
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{t('Unit')}</span>
              <select value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass} aria-label={t('Unit')}>
                {UNITS.map((value) => (
                  <option key={value} value={value}>
                    {t(UNIT_LABELS[value] ?? value)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label={t('Price per unit')} value={price} onChange={setPrice} min={0} suffix={currency} />
            <SelectField label={t('Currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((code) => ({ value: code, label: code }))} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-500">
              {t('Total')}: <span className="text-base font-semibold text-slate-900">{total}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createFromForm(false)}>{t('Open in editor')}</Button>
              <Button variant="primary" icon="download" onClick={() => createFromForm(true)} disabled={!clientName.trim() || price <= 0}>
                {t('Create & download PDF')}
              </Button>
            </div>
          </div>
          {!store.profile.party.name && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {t('Your business details are still empty. Add them once in the business profile and they appear on every invoice.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
