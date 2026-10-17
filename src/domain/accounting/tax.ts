import { z } from 'zod';
import { minorUnits, type MinorUnits } from './journal';

/** TAX-01 is a reference policy. TAX-02 must freeze this identity on server records. */
export const TAX_POLICY_ID = 'rs-vat-reference-2026-v1';
export const TAX_POLICY = Object.freeze({ id: TAX_POLICY_ID, validFrom: '2026-01-01', validTo: '2026-12-31',
  reviewedOn: '2026-10-09', rounding: 'Po stavci, pola pare naviše; interna referentna politika, čeka poslovnu potvrdu.' });
export const REDUCED_POINTS = Object.freeze(['1','2','2a','3','4','5','6','7','8','9','10','11','12','13','13a','14','15','16','17','18','19','20','21'] as const);
export const TAX_SOURCES = Object.freeze([
  Object.freeze({ id: 'vat-law', title: 'Zakon o PDV — Ministarstvo finansija',
    url: 'https://www.mfin.gov.rs/sr/propisi-1/zakon-o-porezu-na-dodatu-vrednost--21',
    attachmentUrl: 'https://www.mfin.gov.rs//upload/media/5MwIQ2_6aa12716d86e0.docx',
    sha256: 'a03ad9356664763f1d487bcc3d8ca0795ce9c0b4cf8b8f00f6dd0e3e39f8d8e0', bytes: 80406,
    checkedOn: '2026-10-09', kind: 'Zvanični sajt; nezvanično prečišćen tekst redakcije Službenog glasnika' }),
  Object.freeze({ id: 'vat-bylaw', title: 'Pravilnik o PDV — Ministarstvo finansija',
    url: 'https://www.mfin.gov.rs/sr/propisi-1/pravilnik-o-pdv-1',
    attachmentUrl: 'https://www.mfin.gov.rs//upload/media/etLuKX_6a82da496119b.docx',
    sha256: 'f89f574dc7e0d242514a512432b92709f295b24f308ce410c16aad06a64431de', bytes: 249757,
    checkedOn: '2026-10-09', kind: 'Zvanični sajt; nezvanično prečišćen tekst redakcije Službenog glasnika' }),
  Object.freeze({ id: 'vat-overview', title: 'Opšte o PDV — Poreska uprava',
    url: 'https://www.purs.gov.rs/pravna-lica/pdv/opste-o-pdv.html',
    checkedOn: '2026-10-09', kind: 'Zvanično objašnjenje; nije zamena za propis' }),
] as const);

export type TaxCategory = 'standard' | 'reduced' | 'exempt_with_deduction' | 'exempt_without_deduction'
  | 'small_taxpayer' | 'reverse_charge' | 'import' | 'export' | 'outside_scope';
export type TaxRule = Readonly<{ id: TaxCategory; title: string; article: string; rate: 20 | 10 | null;
  treatment: 'calculate' | 'review' | 'unsupported'; requirement: string; sourceId: 'vat-law' }>;
export const TAX_RULES: readonly TaxRule[] = Object.freeze([
  { id: 'standard', title: 'Opšti domaći promet', article: 'čl. 10, 16, 17 i 23 st. 1', rate: 20, treatment: 'calculate', requirement: 'Dobavljač je poreski dužnik; običan domaći promet, bez posebnog postupka.' },
  { id: 'reduced', title: 'Posebna stopa', article: 'čl. 23 st. 2', rate: 10, treatment: 'calculate', requirement: 'Uneti tačku člana 23 stav 2 i dokaz klasifikacije dobra/usluge.' },
  { id: 'exempt_with_deduction', title: 'Oslobođenje sa pravom na odbitak', article: 'čl. 24', rate: null, treatment: 'review', requirement: 'Tačan zakonski osnov, uslovi i dokumentacija; ne tretirati kao običnu stopu 0%.' },
  { id: 'exempt_without_deduction', title: 'Oslobođenje bez prava na odbitak', article: 'čl. 25', rate: null, treatment: 'review', requirement: 'Tačan osnov i razdvajanje prava na odbitak; potrebna poslovna provera.' },
  { id: 'small_taxpayer', title: 'Mali obveznik van PDV', article: 'čl. 33', rate: null, treatment: 'calculate', requirement: 'Izričito potvrđen status po članu 33 za datum događaja; pravna forma nije dokaz.' },
  { id: 'reverse_charge', title: 'Primalac je poreski dužnik', article: 'čl. 10', rate: null, treatment: 'unsupported', requirement: 'Interni obračun i dokaz poreskog dužnika zahtevaju poseban obračunski modul.' },
  { id: 'import', title: 'Uvoz', article: 'čl. 19 i 26', rate: null, treatment: 'unsupported', requirement: 'Carinski dokumenti i poseban poreski događaj.' },
  { id: 'export', title: 'Izvoz', article: 'čl. 24', rate: null, treatment: 'unsupported', requirement: 'Dokazi izvoza i posebna evidencija.' },
  { id: 'outside_scope', title: 'Van predmeta / mesto prometa u inostranstvu', article: 'čl. 3, 11 i 12', rate: null, treatment: 'review', requirement: 'Utvrditi mesto i predmet prometa, bez automatskog zaključka iz stope.' },
].map(rule => Object.freeze({ ...rule, sourceId: 'vat-law' } as TaxRule)));

/** Applicability notes are per provision, never the publication date of a whole file. */
export const TAX_TRANSITIONS = Object.freeze([
  Object.freeze({ sourceId: 'vat-law', article: '109/2025, čl. 12', appliesFrom: '2026-01-01', scope: 'Izuzetak: član 2 izmene.', disposition: 'Posebna kontrola izmene; ne primenjivati ceo tekst od ovog datuma.' }),
  Object.freeze({ sourceId: 'vat-law', article: '109/2025, čl. 12', appliesFrom: '2026-04-01', scope: 'Opšta primena za april / april–jun 2026, uz navedene izuzetke.', disposition: 'Avansi, korekcije i odbitak zahtevaju datiranu proveru u TAX-02.' }),
  Object.freeze({ sourceId: 'vat-bylaw', article: '30/2026, čl. 29', appliesFrom: '2026-04-01', scope: 'Primena za april / april–jun 2026.', disposition: 'Izvozi moraju koristiti obrazac odgovarajućeg perioda.' }),
  Object.freeze({ sourceId: 'vat-bylaw', article: '71/2026, čl. 19', appliesFrom: '2026-09-01', scope: 'Izuzetak: čl. 2, 3 i 4 izmene.', disposition: 'Ostale izmene imaju zasebne datume; novi obrazac nije automatski obrazac za 2026.' }),
  Object.freeze({ sourceId: 'vat-law', article: '80/2026, čl. 17', appliesFrom: '2026-12-15', scope: 'Izuzetak: član 7 izmene.', disposition: 'Dodatna kontrola evidencija pri implementaciji TAX-02.' }),
  Object.freeze({ sourceId: 'vat-law', article: '80/2026, čl. 17', appliesFrom: '2027-01-01', scope: 'Opšta primena, uz izuzetke i prelazne odredbe čl. 12–16.', disposition: 'Obračunska politika za 2027. još nije podržana.' }),
  Object.freeze({ sourceId: 'vat-bylaw', article: '71/2026, čl. 19', appliesFrom: '2027-01-01', scope: 'Opšta primena za januar / januar–mart 2027, uz izuzetke.', disposition: 'Obrasci za 2027. zahtevaju novu verziju i proveru.' }),
] as const);

const profileSchema = z.object({ firmId: z.uuid(), legalForm: z.enum(['doo', 'sole_trader']),
  regime: z.enum(['regular_vat', 'small_taxpayer']), method: z.literal('accrual'),
  validFrom: z.iso.date(), validTo: z.iso.date(), evidence: z.string().trim().min(1).max(1000),
}).strict().refine(p => p.validFrom <= p.validTo, 'Invalid profile interval');
export type TaxReferenceProfile = z.infer<typeof profileSchema>;
const requestSchema = z.object({ firmId: z.uuid(), profile: profileSchema, direction: z.enum(['sale', 'purchase']),
  category: z.enum(['standard','reduced','exempt_with_deduction','exempt_without_deduction','small_taxpayer','reverse_charge','import','export','outside_scope']),
  event: z.enum(['supply','advance','correction']), supplyDate: z.iso.date(), advanceDate: z.iso.date().optional(),
  netMinor: z.string().regex(/^(0|[1-9]\d{0,23})$/), currency: z.literal('RSD'),
  domestic: z.literal(true), ordinarySupply: z.literal(true), supplierIsTaxDebtor: z.literal(true),
  reducedPoint: z.enum(REDUCED_POINTS).optional(), classificationEvidence: z.string().trim().max(1000).optional(),
}).strict();
export type TaxReferenceRequest = z.infer<typeof requestSchema>;
export type TaxReferenceResult = Readonly<{ status: 'supported' | 'review' | 'unsupported' | 'invalid'; reason: string;
  policyId: typeof TAX_POLICY_ID; ruleId?: TaxCategory; taxDate?: string; rate?: 20 | 10 | null;
  netMinor?: MinorUnits; vatMinor?: MinorUnits; grossMinor?: MinorUnits; sourceIds: readonly string[];
  inputDeduction: 'not_applicable' | 'unassessed' }>;
const result = (status: TaxReferenceResult['status'], reason: string, extra: Partial<TaxReferenceResult> = {}): TaxReferenceResult =>
  Object.freeze({ status, reason, policyId: TAX_POLICY_ID, sourceIds: Object.freeze(['vat-law']), inputDeduction: 'not_applicable', ...extra });

/** Refuses unknown categories/profiles/dates rather than silently calculating zero VAT. */
export const evaluateTaxReference = (input: unknown): TaxReferenceResult => {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return result('invalid', 'Proverite režim, datume, obuhvat i iznos. Podržan je običan domaći RSD promet.');
  const r = parsed.data;
  if (r.firmId !== r.profile.firmId) return result('invalid', 'Primer režima pripada drugoj firmi.');
  if (r.advanceDate && r.advanceDate > r.supplyDate) return result('invalid', 'Datum avansa mora prethoditi ili biti jednak datumu prometa.');
  const taxDate = r.advanceDate || r.supplyDate;
  const meta = { ruleId: r.category, taxDate, inputDeduction: r.direction === 'purchase' ? 'unassessed' as const : 'not_applicable' as const };
  if (taxDate < '2026-01-01' || taxDate > '2026-12-31' || r.supplyDate > '2026-12-31')
    return result('unsupported', 'Ova verzija pokriva događaje i promet u 2026; prelazak između verzija zahteva posebnu proveru.', meta);
  if (taxDate < r.profile.validFrom || taxDate > r.profile.validTo || r.supplyDate < r.profile.validFrom || r.supplyDate > r.profile.validTo)
    return result('invalid', 'Datumi nisu pokriveni potvrđenim intervalom režima.', meta);
  if (r.event !== 'supply' || r.advanceDate)
    return result('review', 'Avans ili korekcija: proveriti izvorni dokument, raniji PDV i datiranu verziju uslova u TAX-02.', meta);
  if (r.direction === 'purchase' && r.profile.regime === 'small_taxpayer')
    return result('unsupported', 'Nabavka firme van PDV zahteva poseban scenario; ovaj primer pokriva njenu prodaju.', meta);
  const rule = TAX_RULES.find(row => row.id === r.category)!;
  if (r.profile.regime === 'small_taxpayer' && r.category !== 'small_taxpayer')
    return result('invalid', 'Mali obveznik po članu 33 ne koristi obračun redovnog PDV.', meta);
  if (r.profile.regime === 'regular_vat' && r.category === 'small_taxpayer')
    return result('invalid', 'Status redovnog obveznika nije status malog obveznika po članu 33.', meta);
  if (rule.treatment !== 'calculate') return result(rule.treatment === 'review' ? 'review' : 'unsupported', rule.requirement, meta);
  // Deleted points 1a and 7a are not accepted as classifications. Point alone is not evidence.
  if (r.category === 'reduced' && (!r.reducedPoint || !r.classificationEvidence))
    return result('review', rule.requirement, meta);
  const net = BigInt(r.netMinor);
  const vat = rule.rate === null ? BigInt(0) : (net * BigInt(rule.rate) + BigInt(50)) / BigInt(100);
  const gross = net + vat;
  if (gross.toString().length > 24) return result('invalid', 'Ukupan iznos prelazi dozvoljenu preciznost.', meta);
  return result('supported', r.direction === 'purchase' ? 'PDV na računu je izračunat; pravo na odbitak nije utvrđeno.' : 'Referentni obračun; nije sačuvan dokument niti poreska prijava.',
    { ...meta, rate: rule.rate, netMinor: minorUnits(net.toString()), vatMinor: minorUnits(vat.toString()), grossMinor: minorUnits(gross.toString()) });
};
