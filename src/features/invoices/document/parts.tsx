import type { CSSProperties, ReactNode } from 'react';
import type { InvoiceView } from './view';

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

export const FONTS = {
  inter: "'Inter', system-ui, sans-serif",
  serif: "'Source Serif 4', Georgia, serif",
  grotesk: "'Space Grotesk', 'Inter', sans-serif",
  display: "'Playfair Display', Georgia, serif",
  dm: "'DM Sans', 'Inter', sans-serif"
};

/** One A4 sheet. Grows past A4 for very long invoices; the PDF exporter slices it into pages. */
export const Page = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    data-pdf-page
    style={{
      width: PAGE_WIDTH,
      minHeight: PAGE_HEIGHT,
      position: 'relative',
      background: '#ffffff',
      color: '#0f172a',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 12.5,
      lineHeight: 1.5,
      overflow: 'hidden',
      ...style
    }}
  >
    {children}
  </div>
);

export const Logo = ({ src, height = 56, align = 'left' }: { src: string; height?: number; align?: 'left' | 'right' }) =>
  src ? (
    <img
      data-edit="from"
      src={src}
      alt=""
      style={{ maxHeight: height, maxWidth: 200, objectFit: 'contain', objectPosition: align, display: 'block' }}
    />
  ) : null;

export const PartyBlock = ({
  label,
  party,
  labelStyle,
  nameStyle,
  edit
}: {
  label: string;
  party: InvoiceView['issuer'];
  labelStyle?: CSSProperties;
  nameStyle?: CSSProperties;
  /** Editor section opened when this block is clicked in the preview. */
  edit?: 'from' | 'client';
}) => (
  <div data-edit={edit} style={{ minWidth: 0 }}>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6, ...labelStyle }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, ...nameStyle }}>{party.name || '—'}</div>
    {party.lines.map((line, index) => (
      <div key={index} style={{ color: '#475569', whiteSpace: 'pre-line' }}>
        {line}
      </div>
    ))}
  </div>
);

type TableStyle = {
  headerBackground?: string;
  headerColor?: string;
  headerBorder?: string;
  rowBorder?: string;
  zebra?: string;
  radius?: number;
  font?: string;
};

export const ItemsTable = ({ view, style = {} }: { view: InvoiceView; style?: TableStyle }) => {
  const { t } = view;
  const cell: CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
  const head: CSSProperties = {
    ...cell,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: style.headerColor ?? '#64748b',
    background: style.headerBackground ?? 'transparent',
    borderBottom: style.headerBorder ?? '1px solid #e2e8f0',
    textAlign: 'left'
  };
  const radius = style.radius ?? 0;
  return (
    <table data-edit="items" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: style.font }}>
      <thead>
        <tr>
          <th style={{ ...head, borderTopLeftRadius: radius, borderBottomLeftRadius: radius }}>{t('description')}</th>
          <th style={{ ...head, textAlign: 'right', width: 90 }}>{t('qty')}</th>
          <th style={{ ...head, textAlign: 'right', width: 110 }}>{t('unitPrice')}</th>
          <th style={{ ...head, textAlign: 'right', width: 120, borderTopRightRadius: radius, borderBottomRightRadius: radius }}>
            {t('amount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {view.lines.map((line, index) => {
          const row: CSSProperties = {
            ...cell,
            borderBottom: style.rowBorder ?? '1px solid #f1f5f9',
            background: style.zebra && index % 2 === 1 ? style.zebra : 'transparent'
          };
          return (
            <tr key={line.id}>
              <td style={row}>
                <div style={{ fontWeight: 600 }}>{line.title || line.description}</div>
                {line.title && line.description && (
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2, whiteSpace: 'pre-line' }}>{line.description}</div>
                )}
              </td>
              <td style={{ ...row, textAlign: 'right', whiteSpace: 'nowrap', color: '#475569' }}>{line.quantity}</td>
              <td style={{ ...row, textAlign: 'right', whiteSpace: 'nowrap', color: '#475569' }}>{line.unitPrice}</td>
              <td style={{ ...row, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{line.amount}</td>
            </tr>
          );
        })}
        {view.lines.length === 0 && (
          <tr>
            <td colSpan={4} style={{ ...cell, color: '#94a3b8', fontStyle: 'italic', borderBottom: style.rowBorder ?? '1px solid #f1f5f9' }}>
              —
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export const TotalsRows = ({
  view,
  width = 280,
  totalStyle,
  labelColor = '#64748b'
}: {
  view: InvoiceView;
  width?: number;
  totalStyle?: CSSProperties;
  labelColor?: string;
}) => {
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0' };
  return (
    <div data-edit="items" style={{ width, marginLeft: 'auto' }}>
      {view.tax !== null && (
        <>
          <div style={row}>
            <span style={{ color: labelColor }}>{view.t('subtotal')}</span>
            <span style={{ fontWeight: 500 }}>{view.subtotal}</span>
          </div>
          <div style={row}>
            <span style={{ color: labelColor }}>{view.vatLabel}</span>
            <span style={{ fontWeight: 500 }}>{view.tax}</span>
          </div>
        </>
      )}
      <div
        style={{
          ...row,
          alignItems: 'baseline',
          marginTop: 6,
          paddingTop: 12,
          borderTop: '1px solid #e2e8f0',
          fontSize: 16,
          fontWeight: 700,
          ...totalStyle
        }}
      >
        <span>{view.t('amountDue')}</span>
        <span>{view.total}</span>
      </div>
    </div>
  );
};

export const PaymentBlock = ({ view, labelStyle }: { view: InvoiceView; labelStyle?: CSSProperties }) =>
  view.payment.length ? (
    <div data-edit="from">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 8, ...labelStyle }}>
        {view.t('paymentDetails')}
      </div>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {view.payment.map((entry) => (
            <tr key={entry.label}>
              <td style={{ color: '#64748b', padding: '1.5px 16px 1.5px 0', whiteSpace: 'nowrap' }}>{entry.label}</td>
              <td style={{ fontWeight: 500, padding: '1.5px 0', fontVariantNumeric: 'tabular-nums' }}>{entry.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;

export const NoteBlock = ({ view, labelStyle }: { view: InvoiceView; labelStyle?: CSSProperties }) =>
  view.note ? (
    <div data-edit="details">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 8, ...labelStyle }}>
        {view.t('notes')}
      </div>
      <div style={{ color: '#475569', whiteSpace: 'pre-line' }}>{view.note}</div>
    </div>
  ) : null;

export const SignatureBlock = ({ view, lineColor = '#cbd5e1' }: { view: InvoiceView; lineColor?: string }) =>
  view.signature ? (
    <div data-edit="from" style={{ width: 200, textAlign: 'center' }}>
      <img src={view.signature} alt="" style={{ height: 64, maxWidth: 200, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
      <div style={{ borderTop: `1px solid ${lineColor}`, paddingTop: 6, fontSize: 10.5, color: '#64748b' }}>{view.t('signature')}</div>
    </div>
  ) : null;

/** "Paid" stamp, or a red "Cancelled" stamp on a cancelled invoice. */
export const PaidStamp = ({ view, color: paidColor }: { view: InvoiceView; color: string }) => {
  const color = view.isCancelled ? '#dc2626' : paidColor;
  return view.isPaid || view.isCancelled ? (
    <div
      style={{
        position: 'absolute',
        top: 210,
        right: 64,
        transform: 'rotate(-12deg)',
        border: `3px solid ${color}`,
        color,
        borderRadius: 10,
        padding: '4px 16px',
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        opacity: 0.75
      }}
    >
      {view.t(view.isCancelled ? 'cancelled' : 'paid')}
    </div>
  ) : null;
};
