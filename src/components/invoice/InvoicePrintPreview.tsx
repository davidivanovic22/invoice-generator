import { forwardRef } from 'react';
import type { InvoiceData } from '../../types/invoice';
import {
  calculateGrandTotal,
  calculateSubtotal,
  calculateTotalHours,
  calculateVatAmount
} from '../../utils/invoice';
import { resolveInvoiceTheme } from '../../utils/invoiceTheme';
import { InvoiceSignature } from './InvoiceSignature';

type Props = {
  invoice: InvoiceData;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);

export const InvoicePrintPreview = forwardRef<HTMLDivElement, Props>(({ invoice }, ref) => {
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
      data-pdf-page="true"
      className="relative"
      style={{
        width: '794px',
        minHeight: '1123px',
        padding: '28px',
        fontSize: `${settings.baseFontSize}px`,
        background: theme.surface,
        color: theme.textPrimary
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: '180px',
          background: theme.headerGradient
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '24px',
            borderBottom: `1px solid ${theme.borderColor}`,
            paddingBottom: '24px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {invoice.logo ? (
              <div
                style={{
                  width: `${settings.logoWidth}px`,
                  height: `${settings.logoHeight}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: `0 0 0 1px ${theme.logoRing}`
                }}
              >
                <img
                  src={invoice.logo}
                  alt="Company logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            ) : null}

            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: `${settings.titleFontSize}px`,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: theme.textPrimary
                }}
              >
                INVOICE
              </div>
              <div
                style={{
                  marginTop: '10px',
                  color: theme.textMuted,
                  fontSize: '15px'
                }}
              >
                Invoice number: {invoice.invoiceNumber}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '16px', lineHeight: 1.9 }}>
            <div>
              <strong>Issue date:</strong> {invoice.issueDate}
            </div>
            <div>
              <strong>Due date:</strong> {invoice.dueDate}
            </div>
            <div>
              <strong>Billing period:</strong> {invoice.billingPeriod}
            </div>
          </div>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px'
          }}
        >
          <div
            style={{
              border: `1px solid ${theme.borderColor}`,
              borderRadius: '24px',
              padding: '20px',
              background: theme.surfaceAlt
            }}
          >
            <div
              style={{
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.accentColor
              }}
            >
              Issuer
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
              {invoice.issuer.name}
            </div>
            <div style={{ marginBottom: '8px' }}>{invoice.issuer.address}</div>
            <div style={{ marginBottom: '8px' }}>{invoice.issuer.cityCountry}</div>
            <div style={{ marginBottom: '8px' }}>
              {invoice.issuer.taxIdLabel}: {invoice.issuer.taxIdValue}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {invoice.issuer.regIdLabel}: {invoice.issuer.regIdValue}
            </div>
            {invoice.issuer.iban ? <div>IBAN: {invoice.issuer.iban}</div> : null}
          </div>

          <div
            style={{
              border: `1px solid ${theme.borderColor}`,
              borderRadius: '24px',
              padding: '20px',
              background: theme.surfaceAlt
            }}
          >
            <div
              style={{
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.accentColor
              }}
            >
              Client
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
              {invoice.client.name}
            </div>
            <div style={{ marginBottom: '8px' }}>{invoice.client.address}</div>
            <div style={{ marginBottom: '8px' }}>{invoice.client.cityCountry}</div>
            <div style={{ marginBottom: '8px' }}>
              {invoice.client.taxIdLabel}: {invoice.client.taxIdValue}
            </div>
            <div>
              {invoice.client.regIdLabel}: {invoice.client.regIdValue}
            </div>
          </div>
        </section>

        <section
          style={{
            overflow: 'hidden',
            border: `1px solid ${theme.borderColor}`,
            borderRadius: '24px',
            marginBottom: '24px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '30px 3fr 3fr 60px 90px 110px',
              background: theme.tableHeaderBackground,
              fontWeight: 700
            }}
          >
            {['#', 'Service', 'Description', 'Hours', 'Rate', 'Amount'].map(
              (label, index, arr) => (
                <div
                  key={label}
                  style={{
                    padding: '16px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      label === 'Amount'
                        ? 'flex-end'
                        : label === 'Hours' || label === 'Rate'
                          ? 'center'
                          : 'flex-start'
                  }}
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
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 3fr 3fr 60px 90px 110px',
                  borderTop:
                    index === 0 ? 'none' : `1px solid ${theme.borderColor}`
                }}
              >
                {row.map((cell, cellIndex) => (
                  <div
                    key={cellIndex}
                    style={{
                      padding: '16px',
                      borderRight:
                        cellIndex < row.length - 1
                          ? `1px solid ${theme.borderColor}`
                          : 'none',
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'stretch',
                      justifyContent:
                        cellIndex === 5
                          ? 'flex-end'
                          : cellIndex === 3 || cellIndex === 4
                            ? 'center'
                            : 'flex-start',
                      fontWeight: cellIndex === 5 ? 700 : 400
                    }}
                  >
                    <span>{cell}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <section style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <div
            style={{
              width: '280px',
              border: `1px solid ${theme.borderColor}`,
              borderRadius: '24px',
              padding: '20px',
              background: theme.totalCardBackground
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span>Total hours</span>
              <strong>{totalHours} h</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '14px',
                paddingTop: '14px',
                borderTop: `1px dashed ${theme.borderColor}`
              }}
            >
              <span>Subtotal</span>
              <strong>{money(subtotal, invoice.currency)}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '14px',
                paddingTop: '14px',
                borderTop: `1px dashed ${theme.borderColor}`
              }}
            >
              <span>VAT ({invoice.vatPercent}%)</span>
              <strong>{money(vatAmount, invoice.currency)}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingTop: '14px',
                borderTop: `1px dashed ${theme.borderColor}`
              }}
            >
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700
                }}
              >
                Total to pay
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 800
                }}
              >
                {money(grandTotal, invoice.currency)}
              </span>
            </div>
          </div>
        </section>

        <section
          style={{
            border: `1px solid ${theme.borderColor}`,
            borderRadius: '20px',
            padding: '24px',
            background: theme.noteBackground
          }}
        >
          <div
            style={{
              marginBottom: '10px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: theme.accentColor
            }}
          >
            Note
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{invoice.note}</div>
        </section>
      </div>

      {textElements.map((element) => (
        <div
          key={element.id}
          style={{
            position: 'absolute',
            left: `${element.x}px`,
            top: `${element.y}px`,
            width: `${element.width}px`,
            minHeight: `${element.height}px`,
            fontSize: `${element.fontSize ?? 16}px`,
            whiteSpace: 'pre-wrap',
            zIndex: 20,
            color: theme.textPrimary
          }}
        >
          {element.text}
        </div>
      ))}

      {invoice.signature ? (
        <div
          style={{
            position: 'absolute',
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
});

InvoicePrintPreview.displayName = 'InvoicePrintPreview';