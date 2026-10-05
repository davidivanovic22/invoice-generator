import { forwardRef, useMemo } from 'react';
import type { BusinessProfile, Invoice } from '../model';
import { INVOICE_TEMPLATES } from './templates';
import { buildInvoiceView } from './view';

type Props = { invoice: Invoice; profile: BusinessProfile };

export const InvoiceDocument = forwardRef<HTMLDivElement, Props>(({ invoice, profile }, ref) => {
  const view = useMemo(() => buildInvoiceView(invoice, profile), [invoice, profile]);
  const template = INVOICE_TEMPLATES[invoice.design.template] ?? INVOICE_TEMPLATES.modern;
  const { Component } = template;
  return (
    <div ref={ref}>
      <Component view={view} invoice={invoice} />
    </div>
  );
});
InvoiceDocument.displayName = 'InvoiceDocument';
