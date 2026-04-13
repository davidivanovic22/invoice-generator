import { forwardRef, useState } from 'react';
import type {
  EditableInvoiceField,
  EditorElement,
  InvoiceData
} from '../../types/invoice';
import {
  calculateGrandTotal,
  calculateSubtotal,
  calculateTotalHours,
  calculateVatAmount
} from '../../utils/invoice';
import { resolveInvoiceTheme } from '../../utils/invoiceTheme';
import { DraggableElement } from './DraggableElement';
import { InvoiceSignature } from './InvoiceSignature';

type Props = {
  invoice: InvoiceData;
  onInvoiceFieldChange: <K extends EditableInvoiceField>(
    field: K,
    value: InvoiceData[K]
  ) => void;
  onElementChange: (elementId: string, patch: Partial<EditorElement>) => void;
  onElementRemove: (elementId: string) => void;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);

export const InvoiceEditorPreview = forwardRef<HTMLDivElement, Props>(
  ({ invoice, onInvoiceFieldChange, onElementChange, onElementRemove }, ref) => {
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const settings = invoice.editorSettings as InvoiceData['editorSettings'] & {
      templateMode?: 'manual' | 'auto-season' | 'auto-month';
      templateKey?:
      | 'winter'
      | 'spring'
      | 'summer'
      | 'autumn'
      | 'january'
      | 'february'
      | 'march'
      | 'april'
      | 'may'
      | 'june'
      | 'july'
      | 'august'
      | 'september'
      | 'october'
      | 'november'
      | 'december';
      useTemplateAccentColor?: boolean;
    };

    const theme = resolveInvoiceTheme(settings, invoice.issueDate);

    const totalHours = calculateTotalHours(invoice);
    const subtotal = calculateSubtotal(invoice);
    const vatAmount = calculateVatAmount(invoice);
    const grandTotal = calculateGrandTotal(invoice);

    const textElements = settings.elements.filter((x) => x.type === 'text');

    return (
      <div
        ref={ref}
        className="relative mx-auto min-h-[1100px] max-w-5xl overflow-hidden rounded-[24px] p-7 shadow-soft print:hidden"
        style={{
          fontSize: `${settings.baseFontSize}px`,
          background: theme.surface,
          color: theme.textPrimary
        }}
        onClick={() => setSelectedElementId(null)}
      >
        <div
          className="absolute inset-x-0 top-0 h-[180px]"
          style={{ background: theme.headerGradient }}
        />

        <div className="relative z-10">
          <header
            className="mb-5 flex items-start justify-between gap-6 border-b pb-5"
            style={{ borderColor: theme.borderColor }}
          >
            <div className="flex items-center gap-4">
              {invoice.logo ? (
                <div
                  className="flex items-center justify-center rounded-2xl bg-white"
                  style={{
                    width: `${settings.logoWidth}px`,
                    height: `${settings.logoHeight}px`,
                    boxShadow: `0 0 0 1px ${theme.logoRing}`
                  }}
                >
                  <img
                    src={invoice.logo}
                    alt="Company logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}

              <div>
                <div
                  className="font-extrabold leading-none tracking-tight"
                  style={{
                    fontSize: `${settings.titleFontSize}px`,
                    color: theme.textPrimary
                  }}
                >
                  INVOICE
                </div>

                <input
                  value={`Invoice number: ${invoice.invoiceNumber}`}
                  onChange={(e) =>
                    onInvoiceFieldChange(
                      'invoiceNumber',
                      e.target.value.replace('Invoice number: ', '')
                    )
                  }
                  className="mt-2 w-full bg-transparent text-sm outline-none"
                  style={{ color: theme.textMuted }}
                />
              </div>
            </div>

            <div className="space-y-2 text-sm" style={{ color: theme.textPrimary }}>
              <label className="block">
                <span className="font-semibold">Issue date: </span>
                <input
                  value={invoice.issueDate}
                  onChange={(e) => onInvoiceFieldChange('issueDate', e.target.value)}
                  className="bg-transparent outline-none"
                  style={{ color: theme.textPrimary }}
                />
              </label>

              <label className="block">
                <span className="font-semibold">Due date: </span>
                <input
                  value={invoice.dueDate}
                  onChange={(e) => onInvoiceFieldChange('dueDate', e.target.value)}
                  className="bg-transparent outline-none"
                  style={{ color: theme.textPrimary }}
                />
              </label>

              <label className="block">
                <span className="font-semibold">Billing period: </span>
                <input
                  value={invoice.billingPeriod}
                  onChange={(e) => onInvoiceFieldChange('billingPeriod', e.target.value)}
                  className="bg-transparent outline-none"
                  style={{ color: theme.textPrimary }}
                />
              </label>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-4">
            <div
              className="rounded-[24px] border p-5"
              style={{
                borderColor: theme.borderColor,
                background: theme.surfaceAlt
              }}
            >
              <div
                className="mb-4 text-sm font-bold uppercase tracking-[0.24em]"
                style={{ color: theme.accentColor }}
              >
                Issuer
              </div>

              <input
                value={invoice.issuer.name}
                onChange={(e) =>
                  onInvoiceFieldChange('issuer', { ...invoice.issuer, name: e.target.value })
                }
                className="mb-2 w-full bg-transparent text-xl font-semibold outline-none"
              />
              <input
                value={invoice.issuer.address}
                onChange={(e) =>
                  onInvoiceFieldChange('issuer', { ...invoice.issuer, address: e.target.value })
                }
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={invoice.issuer.cityCountry}
                onChange={(e) =>
                  onInvoiceFieldChange('issuer', { ...invoice.issuer, cityCountry: e.target.value })
                }
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={`${invoice.issuer.taxIdLabel}: ${invoice.issuer.taxIdValue}`}
                onChange={(e) => {
                  const [label, ...rest] = e.target.value.split(':');
                  onInvoiceFieldChange('issuer', {
                    ...invoice.issuer,
                    taxIdLabel: label || invoice.issuer.taxIdLabel,
                    taxIdValue: rest.join(':').trim()
                  });
                }}
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={`${invoice.issuer.regIdLabel}: ${invoice.issuer.regIdValue}`}
                onChange={(e) => {
                  const [label, ...rest] = e.target.value.split(':');
                  onInvoiceFieldChange('issuer', {
                    ...invoice.issuer,
                    regIdLabel: label || invoice.issuer.regIdLabel,
                    regIdValue: rest.join(':').trim()
                  });
                }}
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={`IBAN: ${invoice.issuer.iban ?? ''}`}
                onChange={(e) =>
                  onInvoiceFieldChange('issuer', {
                    ...invoice.issuer,
                    iban: e.target.value.replace('IBAN:', '').trim()
                  })
                }
                className="w-full bg-transparent outline-none"
              />
            </div>

            <div
              className="rounded-[24px] border p-5"
              style={{
                borderColor: theme.borderColor,
                background: theme.surfaceAlt
              }}
            >
              <div
                className="mb-4 text-sm font-bold uppercase tracking-[0.24em]"
                style={{ color: theme.accentColor }}
              >
                Client
              </div>

              <input
                value={invoice.client.name}
                onChange={(e) =>
                  onInvoiceFieldChange('client', { ...invoice.client, name: e.target.value })
                }
                className="mb-2 w-full bg-transparent text-xl font-semibold outline-none"
              />
              <input
                value={invoice.client.address}
                onChange={(e) =>
                  onInvoiceFieldChange('client', { ...invoice.client, address: e.target.value })
                }
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={invoice.client.cityCountry}
                onChange={(e) =>
                  onInvoiceFieldChange('client', { ...invoice.client, cityCountry: e.target.value })
                }
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={`${invoice.client.taxIdLabel}: ${invoice.client.taxIdValue}`}
                onChange={(e) => {
                  const [label, ...rest] = e.target.value.split(':');
                  onInvoiceFieldChange('client', {
                    ...invoice.client,
                    taxIdLabel: label || invoice.client.taxIdLabel,
                    taxIdValue: rest.join(':').trim()
                  });
                }}
                className="mb-2 w-full bg-transparent outline-none"
              />
              <input
                value={`${invoice.client.regIdLabel}: ${invoice.client.regIdValue}`}
                onChange={(e) => {
                  const [label, ...rest] = e.target.value.split(':');
                  onInvoiceFieldChange('client', {
                    ...invoice.client,
                    regIdLabel: label || invoice.client.regIdLabel,
                    regIdValue: rest.join(':').trim()
                  });
                }}
                className="w-full bg-transparent outline-none"
              />
            </div>
          </section>

          <section
            className="mb-6 overflow-hidden rounded-[24px] border"
            style={{ borderColor: theme.borderColor }}
          >
            <div
              className="grid grid-cols-[30px_3fr_3fr_60px_90px_110px] font-semibold"
              style={{
                background: theme.tableHeaderBackground,
                color: theme.textPrimary
              }}
            >
              {['#', 'Service', 'Description', 'Hours', 'Rate', 'Amount'].map(
                (label, index, arr) => (
                  <div
                    key={label}
                    className={`py-4 px-4 flex items-center ${label === 'Amount'
                        ? 'justify-end'
                        : label === 'Hours' || label === 'Rate'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                  >
                    {label}
                  </div>
                )
              )}
            </div>

            {invoice.items.map((item, index) => {
              const row = [
                index + 1,
                item.serviceName,
                item.description,
                item.hours,
                money(item.rate, invoice.currency),
                money(item.hours * item.rate, invoice.currency)
              ];

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[30px_3fr_3fr_60px_90px_110px]"
                  style={{
                    borderTop:
                      index === 0 ? 'none' : `1px solid ${theme.borderColor}`
                  }}
                >
                  {row.map((cell, cellIndex) => (
                    <div
                      key={cellIndex}
                      className={`py-4 px-4 flex h-full ${cellIndex === 5
                          ? 'justify-end font-bold'
                          : cellIndex === 3 || cellIndex === 4
                            ? 'justify-center'
                            : 'justify-start'
                        }`}
                      style={{
                        borderRight:
                          cellIndex < row.length - 1
                            ? `1px solid ${theme.borderColor}`
                            : 'none',
                        alignItems: 'stretch'
                      }}
                    >
                      <span className="w-full">{cell}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>

          <section className="mb-8 flex justify-end">
            <div
              className="w-full max-w-md rounded-[24px] border p-5"
              style={{
                borderColor: theme.borderColor,
                background: theme.totalCardBackground
              }}
            >
              <div className="mb-3 flex justify-between">
                <span>Total hours</span>
                <strong>{totalHours} h</strong>
              </div>
              <div
                className="mb-3 flex justify-between pt-3"
                style={{ borderTop: `1px dashed ${theme.borderColor}` }}
              >
                <span>Subtotal</span>
                <strong>{money(subtotal, invoice.currency)}</strong>
              </div>
              <div
                className="mb-3 flex justify-between pt-3"
                style={{ borderTop: `1px dashed ${theme.borderColor}` }}
              >
                <span>VAT ({invoice.vatPercent}%)</span>
                <strong>{money(vatAmount, invoice.currency)}</strong>
              </div>
              <div
                className="flex items-baseline justify-between pt-3"
                style={{ borderTop: `1px dashed ${theme.borderColor}` }}
              >
                <span className="text-sm font-semibold">Total to pay</span>
                <span className="text-xl font-extrabold">{money(grandTotal, invoice.currency)}</span>
              </div>
            </div>
          </section>

          <section
            className="mb-10 rounded-[20px] border p-6"
            style={{
              borderColor: theme.borderColor,
              background: theme.noteBackground
            }}
          >
            <div
              className="mb-2 text-xs font-bold uppercase tracking-[0.24em]"
              style={{ color: theme.accentColor }}
            >
              Note
            </div>
            <textarea
              value={invoice.note}
              onChange={(e) => onInvoiceFieldChange('note', e.target.value)}
              className="min-h-[80px] w-full resize-none bg-transparent outline-none"
            />
          </section>
        </div>

        {textElements.map((element) => (
          <DraggableElement
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            selected={selectedElementId === element.id}
            onSelect={() => setSelectedElementId(element.id)}
            onMove={(x, y) => onElementChange(element.id, { x, y })}
          >
            <div className="relative h-full w-full rounded-lg bg-transparent p-1">
              <textarea
                value={element.text ?? ''}
                onChange={(e) =>
                  onElementChange(element.id, {
                    text: e.target.value,
                    height: Math.max(48, e.target.scrollHeight)
                  })
                }
                className="h-full w-full resize-none overflow-hidden bg-transparent outline-none"
                style={{
                  fontSize: `${element.fontSize ?? 16}px`,
                  color: theme.textPrimary
                }}
              />

              {selectedElementId === element.id && (
                <div className="absolute -top-10 right-0 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onElementChange(element.id, {
                        fontSize: Math.max(10, (element.fontSize ?? 16) - 1)
                      });
                    }}
                    className="rounded px-2 py-1 text-xs shadow"
                    style={{ background: 'white' }}
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onElementChange(element.id, {
                        fontSize: Math.min(48, (element.fontSize ?? 16) + 1)
                      });
                    }}
                    className="rounded px-2 py-1 text-xs shadow"
                    style={{ background: 'white' }}
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onElementRemove(element.id);
                    }}
                    className="rounded px-2 py-1 text-xs text-white shadow"
                    style={{ background: '#ef4444' }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </DraggableElement>
        ))}

        {invoice.signature ? (
          <div
            className="absolute"
            style={{
              right: '32px',
              bottom: '32px',
              width: `${settings.signatureWidth}px`,
              height: `${settings.signatureHeight}px`
            }}
          >
            <InvoiceSignature
              signature={invoice.signature}
              width={settings.signatureWidth}
              height={settings.signatureHeight}
            />
          </div>
        ) : null}
      </div>
    );
  }
);

InvoiceEditorPreview.displayName = 'InvoiceEditorPreview';