/**
 * Ready-to-send email text for an invoice or a payment reminder. There is no
 * mail server: the text opens in Gmail or the default mail app, and the PDF
 * is attached by hand.
 */
import { formatDateNumeric, daysBetween, todayIso } from '../../lib/dates';
import { formatMinor } from '../../lib/money';
import { invoiceTotals, type Invoice } from './model';

export type EmailKind = 'invoice' | 'reminder';
export type Email = { to: string; subject: string; body: string };

export const buildEmail = (invoice: Invoice, kind: EmailKind, today = todayIso()): Email => {
  const serbian = invoice.design.language === 'sr';
  const locale = serbian ? 'sr-Latn-RS' : 'en-US';
  const amount = formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency, locale);
  const due = formatDateNumeric(invoice.dueDate);
  const sender = invoice.issuer.name.trim();
  const iban = invoice.bank.iban.trim();
  const late = Math.max(0, daysBetween(invoice.dueDate, today));
  const period = invoice.billingPeriod.trim();

  if (serbian) {
    const payment = iban ? `\n\nUplatu možete izvršiti na račun ${iban}${invoice.bank.swift ? ` (SWIFT: ${invoice.bank.swift})` : ''}, uz poziv na broj ${invoice.number}.` : '';
    return kind === 'invoice'
      ? {
          to: invoice.client.email,
          subject: `Faktura ${invoice.number}${period ? ` — ${period}` : ''}${sender ? ` — ${sender}` : ''}`,
          body: `Poštovani,\n\nu prilogu Vam šaljem fakturu ${invoice.number}${period ? ` za ${period}` : ''} na iznos od ${amount}, sa rokom plaćanja do ${due}${payment}\n\nHvala na saradnji.\n\nSrdačan pozdrav,\n${sender}`
        }
      : {
          to: invoice.client.email,
          subject: `Podsetnik: faktura ${invoice.number} — rok plaćanja ${due}`,
          body: `Poštovani,\n\nljubazno Vas podsećam da faktura ${invoice.number} na iznos od ${amount} još nije plaćena. Rok plaćanja je bio ${due}${late ? ` (pre ${late} ${late === 1 ? 'dan' : 'dana'}).` : ''}${payment}\n\nAko ste uplatu već izvršili, zanemarite ovu poruku. Fakturu ponovo šaljem u prilogu.\n\nSrdačan pozdrav,\n${sender}`
        };
  }

  const payment = iban ? `\n\nPayment details: IBAN ${iban}${invoice.bank.swift ? `, SWIFT ${invoice.bank.swift}` : ''}${invoice.bank.bankName ? `, ${invoice.bank.bankName}` : ''}. Please use ${invoice.number} as the reference.` : '';
  return kind === 'invoice'
    ? {
        to: invoice.client.email,
        subject: `Invoice ${invoice.number}${period ? ` — ${period}` : ''}${sender ? ` — ${sender}` : ''}`,
        body: `Hello,\n\nplease find attached invoice ${invoice.number}${period ? ` for ${period}` : ''} for ${amount}, due on ${due}.${payment}\n\nThank you for your business.\n\nBest regards,\n${sender}`
      }
    : {
        to: invoice.client.email,
        subject: `Reminder: invoice ${invoice.number} was due on ${due}`,
        body: `Hello,\n\na friendly reminder that invoice ${invoice.number} for ${amount} is still open. It was due on ${due}${late ? ` (${late} ${late === 1 ? 'day' : 'days'} ago)` : ''}.${payment}\n\nIf you have already paid, please ignore this message. I have attached the invoice again.\n\nBest regards,\n${sender}`
      };
};

export const mailtoUrl = (email: Email) =>
  `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;

export const gmailUrl = (email: Email) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.to)}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
