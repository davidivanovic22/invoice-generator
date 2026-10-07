import { useState } from 'react';
import { t } from '../../../i18n';
import { addDaysIso, daysBetween } from '../../../lib/dates';
import { SelectField, TextArea, TextField } from '../../../ui/Field';
import { Chips, MoreToggle, Section } from '../../../ui/Layout';
import { CURRENCIES, isDefaultPeriod, isNumberTaken, nextInvoiceNumber, NOTE_PRESETS, periodLabel, type Invoice } from '../model';

type Props = {
  invoice: Invoice;
  invoices: Invoice[];
  numberPrefix: string;
  onChange: (update: Partial<Invoice>) => void;
};

const TERMS = [0, 7, 14, 30, 45];

export const DetailsSection = ({ invoice, invoices, numberPrefix, onChange }: Props) => {
  const taken = isNumberTaken(invoices, invoice.number, invoice.id);
  const termDays = daysBetween(invoice.issueDate, invoice.dueDate);
  const currencies = CURRENCIES.includes(invoice.currency) ? CURRENCIES : [invoice.currency, ...CURRENCIES];
  const customised = Boolean(invoice.note.trim()) || !isDefaultPeriod(invoice.billingPeriod, invoice.issueDate);
  const [more, setMore] = useState(customised);
  const due = termDays === 0 ? t('due on receipt') : t('due in {count} day|due in {count} days', { count: termDays });

  return (
    <Section id="details" title={t('Details')} icon="calendar" description={`${t('No.')} ${invoice.number} · ${due}`}>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('Invoice number')}
          value={invoice.number}
          onChange={(number) => onChange({ number })}
          error={taken ? t('Another invoice already uses this number.') : undefined}
          hint={
            taken ? undefined : (
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => onChange({ number: nextInvoiceNumber(invoices.filter((other) => other.id !== invoice.id), numberPrefix, invoice.issueDate) })}
              >
                {t('Use next number')}
              </button>
            )
          }
        />
        <SelectField label={t('Currency')} value={invoice.currency} onChange={(currency) => onChange({ currency })} options={currencies.map((code) => ({ value: code, label: code }))} />
        <TextField
          type="date"
          label={t('Issue date')}
          value={invoice.issueDate}
          onChange={(issueDate) => {
            if (!issueDate) return;
            const update: Partial<Invoice> = { issueDate, dueDate: addDaysIso(issueDate, Math.max(0, termDays)) };
            if (isDefaultPeriod(invoice.billingPeriod, invoice.issueDate)) update.billingPeriod = periodLabel(issueDate, invoice.design.language);
            onChange(update);
          }}
        />
        <TextField type="date" label={t('Due date')} value={invoice.dueDate} onChange={(dueDate) => dueDate && onChange({ dueDate })} />
        <div className="col-span-2 -mt-1">
          <Chips
            value={TERMS.includes(termDays) ? String(termDays) : null}
            onChange={(days) => onChange({ dueDate: addDaysIso(invoice.issueDate, Number(days)) })}
            options={TERMS.map((days) => ({ value: String(days), label: days === 0 ? t('On receipt') : t('{count} day|{count} days', { count: days }) }))}
          />
        </div>
        {invoice.status === 'paid' && (
          <TextField
            type="date"
            wrapperClassName="col-span-2 sm:col-span-1"
            label={t('Paid on')}
            hint={t('The day the money arrived; the KPO book uses it.')}
            value={invoice.paidAt ?? ''}
            onChange={(paidAt) => paidAt && onChange({ paidAt })}
          />
        )}
        <label className="col-span-2 flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/70">
          <input
            type="checkbox"
            checked={Boolean(invoice.repeatDay)}
            onChange={(event) => onChange({ repeatDay: event.target.checked ? Number(invoice.issueDate.slice(8, 10)) : null })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">{t('Repeat every month')}</span>
            <span className="block text-xs text-slate-500">
              {invoice.repeatDay
                ? t('On the {day}. of every month a new draft with the next number is created automatically.', { day: invoice.repeatDay })
                : t('For clients you invoice every month: the next invoice is prepared for you.')}
            </span>
          </span>
        </label>
        <div className="col-span-2">
          <MoreToggle open={more} onToggle={() => setMore((value) => !value)} label={t('Billing period and note')} />
        </div>
        {more && (
          <>
            <TextField wrapperClassName="col-span-2" label={t('Billing period')} hint={t('Optional, e.g. September 2026')} value={invoice.billingPeriod} onChange={(billingPeriod) => onChange({ billingPeriod })} />
            <TextArea
              wrapperClassName="col-span-2"
              label={t('Note')}
              rows={2}
              value={invoice.note}
              onChange={(note) => onChange({ note })}
              placeholder={t('e.g. Not in the VAT system. Payment within 14 days.')}
            />
            <div className="col-span-2 -mt-1 flex flex-wrap gap-1.5">
              {NOTE_PRESETS.filter((preset) => !invoice.note.includes(preset.text[invoice.design.language])).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ note: [invoice.note.trim(), preset.text[invoice.design.language]].filter(Boolean).join('\n') })}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  + {t(preset.label)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Section>
  );
};
