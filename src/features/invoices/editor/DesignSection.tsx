import { A4Thumbnail } from '../../../ui/A4Preview';
import { SelectField } from '../../../ui/Field';
import { Section, Segmented, Swatches } from '../../../ui/Layout';
import { InvoiceDocument } from '../document/InvoiceDocument';
import { INVOICE_TEMPLATES, resolveSeasonal } from '../document/templates';
import { MONTHS, type BusinessProfile, type DocLanguage, type Invoice, type InvoiceDesign, type InvoiceTemplateId, type MonthKey } from '../model';
import { t, uiLocale } from '../../../i18n';

type Props = {
  invoice: Invoice;
  profile: BusinessProfile;
  onChange: (design: InvoiceDesign) => void;
};

/** Month name in the app's language. */
const monthName = (month: MonthKey) => {
  const name = new Intl.DateTimeFormat(uiLocale(), { month: 'long' }).format(new Date(2026, MONTHS.indexOf(month), 1));
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const DesignSection = ({ invoice, profile, onChange }: Props) => {
  const design = invoice.design;
  const set = (patch: Partial<InvoiceDesign>) => onChange({ ...design, ...patch });
  const seasonal = design.template === 'seasonal' ? resolveSeasonal(invoice) : null;

  return (
    <Section id="design" title={t('Design')} icon="palette" description={t('{name} template', { name: t(INVOICE_TEMPLATES[design.template].name) })}>
      <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
        {(Object.keys(INVOICE_TEMPLATES) as InvoiceTemplateId[]).map((id) => {
          const active = id === design.template;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => set({ template: id })}
              className="group shrink-0 snap-start text-left"
            >
              <div
                className={`overflow-hidden rounded-lg bg-white ring-2 transition ${active ? 'ring-indigo-500' : 'ring-slate-200 group-hover:ring-slate-300'}`}
              >
                <A4Thumbnail width={90}>
                  <InvoiceDocument invoice={{ ...invoice, design: { ...design, template: id } }} profile={profile} />
                </A4Thumbnail>
              </div>
              <div className={`mt-1.5 text-xs font-medium ${active ? 'text-indigo-700' : 'text-slate-600'}`}>{t(INVOICE_TEMPLATES[id].name)}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        {seasonal ? (
          <>
            <SelectField
              label={t('Motif month')}
              value={design.seasonalMonth ?? 'auto'}
              onChange={(value) => set({ seasonalMonth: value === 'auto' ? null : (value as MonthKey), seasonalVariant: null })}
              options={[
                { value: 'auto', label: t('Follow issue date ({month})', { month: monthName(seasonal.month) }) },
                ...MONTHS.map((month) => ({ value: month, label: monthName(month) }))
              ]}
            />
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-slate-700">{t('Illustration')}</div>
              <div className="grid grid-cols-5 gap-2">
                {seasonal.names.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    aria-pressed={index === seasonal.variant}
                    onClick={() => set({ seasonalVariant: index })}
                    className={`overflow-hidden rounded-md bg-white ring-2 transition ${index === seasonal.variant ? 'ring-indigo-500' : 'ring-slate-200 hover:ring-slate-300'}`}
                  >
                    <img src={seasonal.imageFor(index)} alt="" className="aspect-[794/1123] w-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{seasonal.names[seasonal.variant]}</p>
            </div>
          </>
        ) : (
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-slate-700">{t('Accent colour')}</div>
            <Swatches value={design.accentColor} onChange={(accentColor) => set({ accentColor })} />
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[13px] font-medium text-slate-700">{t('Document language')}</div>
          <Segmented<DocLanguage>
            label={t('Document language')}
            value={design.language}
            onChange={(language) => set({ language })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'sr', label: 'Srpski' },
              { value: 'en-sr', label: 'Srpski + English' }
            ]}
          />
        </div>
      </div>
    </Section>
  );
};
