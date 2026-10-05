import { useEffect, useState } from 'react';
import { t } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { TextArea, TextField } from '../../../ui/Field';
import { buildEmail, gmailUrl, mailtoUrl, type EmailKind } from '../email';
import type { Invoice } from '../model';

type Props = {
  invoice: Invoice;
  kind: EmailKind;
  onClose: () => void;
  /** Opens the PDF save dialog; omitted where the invoice is not on screen. */
  onDownloadPdf?: () => void;
  /** Called once the email was opened, with the address it went to. */
  onSent?: (to: string) => void;
};

/** Prepares the email for an invoice or a reminder and opens it in Gmail or the mail app. */
export const EmailDialog = ({ invoice, kind, onClose, onDownloadPdf, onSent }: Props) => {
  const { toast } = useFeedback();
  const [email, setEmail] = useState(() => buildEmail(invoice, kind));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = (url: string, newTab: boolean) => {
    if (newTab) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
    onSent?.(email.to.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="email-title" className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="email-title" className="text-lg font-semibold text-slate-900">
            {kind === 'invoice' ? t('Send invoice {number}', { number: invoice.number }) : t('Payment reminder for {number}', { number: invoice.number })}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('The text is ready. Download the PDF, open the email and attach the file.')}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <TextField label={t('To')} type="email" value={email.to} onChange={(to) => setEmail({ ...email, to })} placeholder="klijent@firma.rs" />
          <TextField label={t('Subject')} value={email.subject} onChange={(subject) => setEmail({ ...email, subject })} />
          <TextArea label={t('Message')} rows={10} value={email.body} onChange={(body) => setEmail({ ...email, body })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {onDownloadPdf && (
              <Button icon="download" onClick={onDownloadPdf}>
                {t('1. Download PDF')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon="copy"
              onClick={() => {
                void navigator.clipboard?.writeText(`${email.subject}\n\n${email.body}`);
                toast(t('Copied'));
              }}
            >
              {t('Copy text')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="mail" onClick={() => open(mailtoUrl(email), false)}>
              {t('Mail app')}
            </Button>
            <Button variant="accent" icon="mail" onClick={() => open(gmailUrl(email), true)}>
              {onDownloadPdf ? t('2. Open in Gmail') : t('Open in Gmail')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
