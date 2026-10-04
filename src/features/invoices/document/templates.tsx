import type { ReactElement } from 'react';
import motifCatalog from '../../../data/invoiceMotifs.json';
import { alpha, readableOn, shade, textSafe, tint } from '../../../lib/color';
import { parseIsoDate } from '../../../lib/dates';
import { MONTHS, type Invoice, type InvoiceTemplateId, type MonthKey } from '../model';
import {
  FONTS,
  ItemsTable,
  Logo,
  NoteBlock,
  Page,
  PaidStamp,
  PartyBlock,
  PaymentBlock,
  SignatureBlock,
  TotalsRows
} from './parts';
import type { InvoiceView } from './view';

type TemplateProps = { view: InvoiceView; invoice: Invoice };

const MetaList = ({ view, align = 'left', labelColor = '#64748b' }: { view: InvoiceView; align?: 'left' | 'right'; labelColor?: string }) => (
  <table style={{ borderCollapse: 'collapse', marginLeft: align === 'right' ? 'auto' : undefined }}>
    <tbody>
      {view.meta.map((entry) => (
        <tr key={entry.label}>
          <td style={{ color: labelColor, padding: '2px 16px 2px 0', textAlign: align, whiteSpace: 'nowrap' }}>{entry.label}</td>
          <td style={{ fontWeight: 600, padding: '2px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{entry.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Footer = ({ view, accent }: { view: InvoiceView; accent?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minWidth: 0 }}>
      <PaymentBlock view={view} labelStyle={accent ? { color: accent } : undefined} />
      <NoteBlock view={view} labelStyle={accent ? { color: accent } : undefined} />
    </div>
    <SignatureBlock view={view} />
  </div>
);

/* ------------------------------ Modern ------------------------------ */

const Modern = ({ view }: TemplateProps) => {
  const accent = view.accent;
  const ink = textSafe(accent);
  return (
    <Page style={{ fontFamily: FONTS.inter, padding: '0 0 48px' }}>
      <div style={{ height: 8, background: accent }} />
      <div style={{ padding: '44px 56px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
        <div>
          <Logo src={view.logo} />
          <div style={{ marginTop: view.logo ? 18 : 0 }}>
            <PartyBlock label={view.t('from')} party={view.issuer} labelStyle={{ color: ink }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{view.t('invoice')}</div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: ink }}>#{view.number}</div>
          <div style={{ marginTop: 18 }}>
            <MetaList view={view} align="right" />
          </div>
        </div>
      </div>

      <div style={{ margin: '36px 56px 0', display: 'flex', gap: 24, alignItems: 'stretch' }}>
        <div style={{ flex: 1, background: tint(accent, 0.94), borderRadius: 14, padding: '18px 22px' }}>
          <PartyBlock label={view.t('billTo')} party={view.client} labelStyle={{ color: ink }} />
        </div>
        <div
          style={{
            width: 230,
            background: accent,
            color: readableOn(accent),
            borderRadius: 14,
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8 }}>
            {view.t('amountDue')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{view.total}</div>
          <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
            {view.t('dueDate')}: {view.meta[1]?.value}
          </div>
        </div>
      </div>

      <div style={{ margin: '32px 56px 0' }}>
        <ItemsTable view={view} style={{ headerBackground: tint(accent, 0.94), headerColor: ink, headerBorder: 'none', radius: 8 }} />
        <div style={{ marginTop: 16 }}>
          <TotalsRows view={view} totalStyle={{ color: ink, borderTop: `2px solid ${accent}` }} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ margin: '40px 56px 0' }}>
        <Footer view={view} accent={ink} />
      </div>
      <PaidStamp view={view} color="#059669" />
    </Page>
  );
};

/* ------------------------------ Classic ------------------------------ */

const Classic = ({ view }: TemplateProps) => {
  const ink = textSafe(view.accent);
  const rule = `1px solid ${tint('#0f172a', 0.8)}`;
  return (
    <Page style={{ fontFamily: FONTS.serif, padding: '56px 64px 52px', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, borderBottom: `2px solid ${ink}` }}>
        <div>
          {view.logo ? <Logo src={view.logo} height={60} /> : <div style={{ fontSize: 22, fontWeight: 700 }}>{view.issuer.name}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: ink, lineHeight: 1 }}>
            {view.t('invoice')}
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {view.t('number')} <strong>{view.number}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, padding: '26px 0', borderBottom: rule }}>
        <div style={{ flex: 1 }}>
          <PartyBlock label={view.t('from')} party={view.issuer} labelStyle={{ fontFamily: FONTS.inter, color: ink }} nameStyle={{ fontSize: 15 }} />
        </div>
        <div style={{ flex: 1 }}>
          <PartyBlock label={view.t('billTo')} party={view.client} labelStyle={{ fontFamily: FONTS.inter, color: ink }} nameStyle={{ fontSize: 15 }} />
        </div>
        <div style={{ fontFamily: FONTS.inter, fontSize: 12 }}>
          <MetaList view={view} align="right" />
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <ItemsTable
          view={view}
          style={{ headerBorder: `1.5px solid ${ink}`, headerColor: ink, rowBorder: rule, font: FONTS.serif }}
        />
        <div style={{ marginTop: 14 }}>
          <TotalsRows view={view} totalStyle={{ borderTop: `1.5px solid ${ink}`, color: ink, fontSize: 17 }} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ marginTop: 40, paddingTop: 22, borderTop: rule }}>
        <Footer view={view} accent={ink} />
      </div>
      <PaidStamp view={view} color="#059669" />
    </Page>
  );
};

/* ------------------------------ Minimal ------------------------------ */

const Minimal = ({ view }: TemplateProps) => {
  const ink = textSafe(view.accent);
  const label = { color: '#94a3b8', letterSpacing: '0.14em' };
  return (
    <Page style={{ fontFamily: FONTS.dm, padding: '64px 72px 56px', fontSize: 12.5, color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Logo src={view.logo} height={44} />
          <div style={{ marginTop: view.logo ? 14 : 0, fontSize: 15, fontWeight: 700 }}>{view.issuer.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: ink }}>{view.t('invoice')}</div>
          <div style={{ fontSize: 28, fontWeight: 400, marginTop: 4, letterSpacing: '-0.01em' }}>{view.number}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginTop: 56 }}>
        <PartyBlock label={view.t('billTo')} party={view.client} labelStyle={label} />
        <PartyBlock label={view.t('from')} party={{ ...view.issuer, name: '' }} labelStyle={label} nameStyle={{ display: 'none' }} />
        <div>
          {view.meta.map((entry) => (
            <div key={entry.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', ...label }}>{entry.label}</div>
              <div style={{ fontWeight: 500 }}>{entry.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <ItemsTable view={view} style={{ headerColor: '#94a3b8', headerBorder: '1px solid #1e293b', rowBorder: '1px solid #e2e8f0' }} />
        <div style={{ marginTop: 18 }}>
          <TotalsRows view={view} totalStyle={{ fontSize: 22, fontWeight: 500, borderTop: '1px solid #1e293b', color: ink }} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ marginTop: 48 }}>
        <Footer view={view} />
      </div>
      <PaidStamp view={view} color="#059669" />
    </Page>
  );
};

/* ------------------------------ Bold ------------------------------ */

const Bold = ({ view }: TemplateProps) => {
  const accent = view.accent;
  const header = shade(accent, 0.55);
  const onHeader = readableOn(header);
  return (
    <Page style={{ fontFamily: FONTS.grotesk, fontSize: 12.5 }}>
      <div style={{ background: header, color: onHeader, padding: '48px 56px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div>
            {view.logo && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 10, display: 'inline-block', marginBottom: 18 }}>
                <Logo src={view.logo} height={44} />
              </div>
            )}
            <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.03em' }}>{view.t('invoice')}</div>
            <div style={{ marginTop: 10, fontSize: 15, opacity: 0.8 }}>#{view.number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>{view.t('amountDue')}</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: tint(accent, 0.35) }}>{view.total}</div>
            <div style={{ marginTop: 14, fontSize: 12 }}>
              <MetaList view={view} align="right" labelColor={alpha(onHeader === '#ffffff' ? '#ffffff' : '#0f172a', 0.65)} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 6, background: accent }} />

      <div style={{ padding: '32px 56px 0', display: 'flex', gap: 32 }}>
        <div style={{ flex: 1 }}>
          <PartyBlock label={view.t('billTo')} party={view.client} labelStyle={{ color: textSafe(accent) }} nameStyle={{ fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <PartyBlock label={view.t('from')} party={view.issuer} labelStyle={{ color: textSafe(accent) }} nameStyle={{ fontSize: 16 }} />
        </div>
      </div>

      <div style={{ padding: '30px 56px 0' }}>
        <ItemsTable view={view} style={{ headerBackground: header, headerColor: onHeader, headerBorder: 'none', zebra: '#f8fafc' }} />
        <div style={{ marginTop: 16 }}>
          <TotalsRows view={view} totalStyle={{ background: tint(accent, 0.9), borderTop: 'none', padding: '12px 14px', borderRadius: 8, marginTop: 10 }} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ padding: '40px 56px 48px' }}>
        <Footer view={view} accent={textSafe(accent)} />
      </div>
      <PaidStamp view={view} color="#059669" />
    </Page>
  );
};

/* ------------------------------ Seasonal ------------------------------ */

type Motif = { palette: string[]; names: string[] };
const catalog = motifCatalog as Record<MonthKey, Motif>;

export const resolveSeasonal = (invoice: Invoice) => {
  const date = parseIsoDate(invoice.issueDate) ?? new Date();
  const month = invoice.design.seasonalMonth ?? MONTHS[date.getMonth()];
  const motif = catalog[month];
  const count = motif.names.length;
  const variant =
    invoice.design.seasonalVariant !== null && invoice.design.seasonalVariant < count
      ? invoice.design.seasonalVariant
      : date.getFullYear() % count;
  return {
    month,
    variant,
    names: motif.names,
    palette: motif.palette,
    image: `/invoice-motifs/${String(variant + 1).padStart(2, '0')}-${month}.svg`,
    imageFor: (index: number) => `/invoice-motifs/${String(index + 1).padStart(2, '0')}-${month}.svg`
  };
};

const Seasonal = ({ view, invoice }: TemplateProps) => {
  const seasonal = resolveSeasonal(invoice);
  const [accent, light, deep] = seasonal.palette;
  const ink = textSafe(deep);
  const card = { background: 'rgba(255,255,255,0.9)', borderRadius: 14, border: `1px solid ${alpha(deep, 0.14)}` };
  return (
    <Page style={{ fontFamily: FONTS.inter, padding: '52px 56px 48px' }}>
      <img src={seasonal.image} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Logo src={view.logo} />
            <div style={{ marginTop: view.logo ? 14 : 0, fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: ink, textShadow: '0 0 8px #fff' }}>
              {view.t('invoice')}
            </div>
            <div style={{ fontWeight: 600, color: '#334155' }}>#{view.number}</div>
          </div>
          <div style={{ ...card, padding: '12px 16px' }}>
            <MetaList view={view} align="right" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 30 }}>
          <div style={{ ...card, flex: 1, padding: '16px 20px' }}>
            <PartyBlock label={view.t('from')} party={view.issuer} labelStyle={{ color: ink }} />
          </div>
          <div style={{ ...card, flex: 1, padding: '16px 20px' }}>
            <PartyBlock label={view.t('billTo')} party={view.client} labelStyle={{ color: ink }} />
          </div>
        </div>

        <div style={{ ...card, marginTop: 22, overflow: 'hidden' }}>
          <ItemsTable view={view} style={{ headerBackground: alpha(light, 0.85), headerColor: ink, headerBorder: 'none' }} />
          <div style={{ padding: '6px 16px 14px' }}>
            <TotalsRows view={view} totalStyle={{ color: ink, borderTop: `2px solid ${accent}` }} />
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ ...card, marginTop: 28, padding: '18px 22px' }}>
          <Footer view={view} accent={ink} />
        </div>
      </div>
      <PaidStamp view={view} color="#059669" />
    </Page>
  );
};

export const INVOICE_TEMPLATES: Record<InvoiceTemplateId, { name: string; description: string; Component: (props: TemplateProps) => ReactElement }> = {
  modern: { name: 'Modern', description: 'Clean, with a highlighted amount due', Component: Modern },
  classic: { name: 'Classic', description: 'Serif type and fine rules', Component: Classic },
  minimal: { name: 'Minimal', description: 'Lots of white space', Component: Minimal },
  bold: { name: 'Bold', description: 'Strong dark header', Component: Bold },
  seasonal: { name: 'Seasonal', description: 'Illustrated monthly motifs', Component: Seasonal }
};
