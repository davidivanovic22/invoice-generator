import { Link } from 'react-router-dom';
import { Button, IconButton } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { NumberField, SelectField, TextArea, TextField } from '../../ui/Field';
import { ImagePicker, SignaturePad } from '../../ui/ImageInputs';
import { Section, Segmented, Swatches } from '../../ui/Layout';
import { INVOICE_TEMPLATES } from '../invoices/document/templates';
import { PartyFields } from '../invoices/editor/PartyFields';
import { CURRENCIES, UNITS, nextInvoiceNumber, type BankDetails, type BusinessProfile, type DocLanguage, type InvoiceTemplateId } from '../invoices/model';
import { useInvoiceStore } from '../invoices/store';

export const ProfilePage = () => {
  const { store, updateProfile, deleteClient } = useInvoiceStore();
  const { confirm, toast } = useFeedback();
  const { profile } = store;
  const set = (patch: Partial<BusinessProfile>) => updateProfile(patch);
  const setDefaults = (patch: Partial<BusinessProfile['defaults']>) => updateProfile({ defaults: { ...profile.defaults, ...patch } });
  const setBank = (field: keyof BankDetails) => (value: string) => set({ bank: { ...profile.bank, [field]: value } });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Fill this in once. Every new invoice starts with these details, so you only add the client and the work.
      </p>

      <div className="mt-6 space-y-4">
        <Section title="Your business" icon="building" description="Shown as the issuer on every invoice">
          <PartyFields party={profile.party} onChange={(party) => set({ party })} />
        </Section>

        <Section title="Bank account" icon="cash" description="Printed in the payment details">
          <div className="grid grid-cols-2 gap-3">
            <TextField wrapperClassName="col-span-2" label="IBAN / account number" value={profile.bank.iban} onChange={setBank('iban')} placeholder="RS35 1050 0812 3123 1231 23" />
            <TextField label="SWIFT / BIC" value={profile.bank.swift} onChange={setBank('swift')} placeholder="AIKBRS22" />
            <TextField label="Bank name" value={profile.bank.bankName} onChange={setBank('bankName')} placeholder="Banka Intesa" />
          </div>
        </Section>

        <Section title="Logo & signature" icon="image" description="Optional, but they make invoices look official">
          <div className="space-y-6">
            <ImagePicker label="Logo" value={profile.logo} onChange={(logo) => set({ logo })} hint="PNG or SVG with a transparent background works best." />
            <SignaturePad value={profile.signature} onChange={(signature) => set({ signature })} />
          </div>
        </Section>

        <Section title="Invoice defaults" icon="settings" description="Used for every new invoice; you can still change them per invoice">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Currency"
              value={profile.defaults.currency}
              onChange={(currency) => setDefaults({ currency })}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <NumberField label="VAT" suffix="%" min={0} value={profile.defaults.vatPercent} onChange={(vatPercent) => setDefaults({ vatPercent })} />
            <NumberField label="Payment due after" suffix="days" min={0} value={profile.defaults.paymentDays} onChange={(paymentDays) => setDefaults({ paymentDays: Math.round(paymentDays) })} />
            <SelectField
              label="Default unit"
              value={profile.defaults.unit}
              onChange={(unit) => setDefaults({ unit })}
              options={UNITS.map((unit) => ({ value: unit, label: unit }))}
            />
            <TextField
              wrapperClassName="col-span-2"
              label="Number prefix"
              value={profile.defaults.numberPrefix}
              onChange={(numberPrefix) => setDefaults({ numberPrefix })}
              placeholder="e.g. INV-"
              hint={`Next invoice number: ${nextInvoiceNumber(store.invoices, profile.defaults.numberPrefix)}`}
            />
            <TextArea
              wrapperClassName="col-span-2"
              label="Default note"
              rows={2}
              value={profile.defaults.note}
              onChange={(note) => setDefaults({ note })}
              placeholder="e.g. The issuer is not in the VAT system."
            />
            <SelectField
              label="Template"
              value={profile.defaults.template}
              onChange={(template) => setDefaults({ template: template as InvoiceTemplateId })}
              options={(Object.keys(INVOICE_TEMPLATES) as InvoiceTemplateId[]).map((id) => ({ value: id, label: INVOICE_TEMPLATES[id].name }))}
            />
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-slate-700">Document language</div>
              <Segmented<DocLanguage>
                size="sm"
                value={profile.defaults.language}
                onChange={(language) => setDefaults({ language })}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'sr', label: 'SR' },
                  { value: 'en-sr', label: 'SR + EN' }
                ]}
              />
            </div>
            <div className="col-span-2">
              <div className="mb-1.5 text-[13px] font-medium text-slate-700">Accent colour</div>
              <Swatches value={profile.defaults.accentColor} onChange={(accentColor) => setDefaults({ accentColor })} />
            </div>
          </div>
        </Section>

        <Section title="Clients" icon="users" description={`${store.clients.length} saved · added automatically when you invoice someone new`}>
          {store.clients.length === 0 ? (
            <p className="text-sm text-slate-500">
              No clients yet. <Link to="/invoices" className="font-medium text-indigo-600 hover:underline">Create an invoice</Link> and the client is saved here.
            </p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {[...store.clients]
                .sort((a, b) => a.party.name.localeCompare(b.party.name))
                .map((client) => (
                  <li key={client.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {client.party.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{client.party.name}</div>
                      <div className="truncate text-xs text-slate-500">{[client.party.cityCountry, client.party.taxId, client.currency].filter(Boolean).join(' · ')}</div>
                    </div>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`Remove ${client.party.name}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove ${client.party.name}?`,
                          message: 'Existing invoices keep their details. The client just stops showing up in suggestions.',
                          confirmLabel: 'Remove',
                          tone: 'danger'
                        });
                        if (ok) {
                          deleteClient(client.id);
                          toast('Client removed');
                        }
                      }}
                    />
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <div className="flex justify-end pt-2">
          <Link to="/invoices">
            <Button variant="primary" iconRight="chevronRight">
              Done
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
