import { addDaysIso, daysBetween, monthLabel } from '../../../lib/dates';
import { SelectField, TextArea, TextField } from '../../../ui/Field';
import { Chips, Section } from '../../../ui/Layout';
import { CURRENCIES, isNumberTaken, nextInvoiceNumber, type Invoice } from '../model';

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

  return (
    <Section id="details" title="Details" icon="calendar" description={`No. ${invoice.number} · due ${termDays === 0 ? 'on receipt' : `in ${termDays} days`}`}>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Invoice number"
          value={invoice.number}
          onChange={(number) => onChange({ number })}
          error={taken ? 'Another invoice already uses this number.' : undefined}
          hint={
            taken ? undefined : (
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() =>
                  onChange({ number: nextInvoiceNumber(invoices.filter((other) => other.id !== invoice.id), numberPrefix, invoice.issueDate) })
                }
              >
                Use next number
              </button>
            )
          }
        />
        <SelectField
          label="Currency"
          value={invoice.currency}
          onChange={(currency) => onChange({ currency })}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
        <TextField
          type="date"
          label="Issue date"
          value={invoice.issueDate}
          onChange={(issueDate) => {
            if (!issueDate) return;
            const update: Partial<Invoice> = { issueDate, dueDate: addDaysIso(issueDate, Math.max(0, termDays)) };
            if (invoice.serviceDate === invoice.issueDate) update.serviceDate = issueDate;
            if (invoice.billingPeriod === monthLabel(invoice.issueDate)) update.billingPeriod = monthLabel(issueDate);
            onChange(update);
          }}
        />
        <TextField type="date" label="Due date" value={invoice.dueDate} onChange={(dueDate) => dueDate && onChange({ dueDate })} />
        <div className="col-span-2 -mt-1">
          <Chips
            value={TERMS.includes(termDays) ? String(termDays) : null}
            onChange={(days) => onChange({ dueDate: addDaysIso(invoice.issueDate, Number(days)) })}
            options={TERMS.map((days) => ({ value: String(days), label: days === 0 ? 'On receipt' : `${days} days` }))}
          />
        </div>
        <TextField
          type="date"
          label="Service date"
          hint="When the work was delivered"
          value={invoice.serviceDate}
          onChange={(serviceDate) => serviceDate && onChange({ serviceDate })}
        />
        <TextField label="Billing period" hint="Optional, e.g. September 2026" value={invoice.billingPeriod} onChange={(billingPeriod) => onChange({ billingPeriod })} />
        <TextArea
          wrapperClassName="col-span-2"
          label="Note"
          rows={2}
          value={invoice.note}
          onChange={(note) => onChange({ note })}
          placeholder="e.g. Not in the VAT system. Payment within 14 days."
        />
      </div>
    </Section>
  );
};
