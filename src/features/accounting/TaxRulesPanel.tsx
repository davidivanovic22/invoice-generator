import { useState } from 'react';
import { evaluateTaxReference, REDUCED_POINTS, TAX_POLICY, TAX_RULES, TAX_SOURCES, TAX_TRANSITIONS, type TaxReferenceResult } from '../../domain/accounting/tax';
import { formatRsd, parseRsd } from './money';
import { Button } from '../../ui/Button';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const outcome = { supported: 'Referentni obračun', review: 'Potrebna poreska provera', unsupported: 'Scenario nije podržan', invalid: 'Neispravan primer' };

/** No RPC or firm setting is inferred or written by this reference screen. */
export const TaxRulesPanel = ({ firmId, disabled = false }: { firmId: string; disabled?: boolean }) => {
  const [legalForm, setLegalForm] = useState('');
  const [regime, setRegime] = useState('');
  const [validFrom, setValidFrom] = useState<string>(TAX_POLICY.validFrom);
  const [validTo, setValidTo] = useState<string>(TAX_POLICY.validTo);
  const [profileEvidence, setProfileEvidence] = useState('');
  const [direction, setDirection] = useState('sale');
  const [category, setCategory] = useState('standard');
  const [event, setEvent] = useState('supply');
  const [supplyDate, setSupplyDate] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [net, setNet] = useState('');
  const [point, setPoint] = useState('');
  const [classification, setClassification] = useState('');
  const [result, setResult] = useState<TaxReferenceResult | null>(null);
  const [error, setError] = useState('');
  const calculate = () => {
    setResult(null); setError('');
    try {
      setResult(evaluateTaxReference({ firmId, profile: { firmId, legalForm, regime, method: 'accrual', validFrom, validTo, evidence: profileEvidence },
        direction, category, event, supplyDate, ...(advanceDate ? { advanceDate } : {}), netMinor: parseRsd(net),
        currency: 'RSD', domestic: true, ordinarySupply: true, supplierIsTaxDebtor: true,
        ...(point ? { reducedPoint: point } : {}), classificationEvidence: classification }));
    } catch { setError('Unesite nenegativan RSD iznos sa najviše dve decimale.'); }
  };
  return <details className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
    <summary className="cursor-pointer font-semibold">Poreska pravila i referentni primeri</summary>
    <p className="text-sm">Verzija {TAX_POLICY.id} · {TAX_POLICY.validFrom}–{TAX_POLICY.validTo} · provera izvora {TAX_POLICY.reviewedOn}.</p>
    <p className="text-sm">Primer za običan domaći RSD promet, kada je dobavljač poreski dužnik. Izbori važe samo za ovaj primer; poreski režim firme i dokumenti se ne čuvaju. PDV evidencije su sledeći modul.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Matrica poreskih pravila</caption>
      <thead><tr><th className="p-2">Kategorija</th><th className="p-2">Stopa / osnov</th><th className="p-2">Uslov i obuhvat</th></tr></thead>
      <tbody>{TAX_RULES.map(rule => <tr key={rule.id} className="border-t"><td className="p-2">{rule.title}</td><td className="p-2">{rule.rate === null ? 'Bez automatske stope' : `${rule.rate}%`} · {rule.article}</td><td className="p-2">{rule.requirement}</td></tr>)}</tbody>
    </table></div>
    <form onSubmit={e => { e.preventDefault(); calculate(); }} onChange={() => { setResult(null); setError(''); }}>
      <fieldset disabled={disabled} className="space-y-3"><legend className="font-medium">Provera referentnog primera</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Pravna forma u primeru<select className={field} value={legalForm} onChange={e => setLegalForm(e.target.value)}><option value="">Izaberite</option><option value="doo">DOO</option><option value="sole_trader">Preduzetnik</option></select></label>
          <label>Poreski režim u primeru<select className={field} value={regime} onChange={e => setRegime(e.target.value)}><option value="">Izaberite</option><option value="regular_vat">Redovni obveznik PDV</option><option value="small_taxpayer">Mali obveznik po članu 33</option></select></label>
          <label>Režim važi od<input className={field} type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}/></label>
          <label>Režim važi do<input className={field} type="date" value={validTo} onChange={e => setValidTo(e.target.value)}/></label>
          <label>Dokaz režima za primer<input className={field} maxLength={1000} value={profileEvidence} onChange={e => setProfileEvidence(e.target.value)}/></label>
          <label>Smer primera<select className={field} value={direction} onChange={e => setDirection(e.target.value)}><option value="sale">Prodaja</option><option value="purchase">Nabavka</option></select></label>
          <label>Poreska kategorija primera<select className={field} value={category} onChange={e => { setCategory(e.target.value); setPoint(''); setClassification(''); }}>{TAX_RULES.map(rule => <option key={rule.id} value={rule.id}>{rule.title}</option>)}</select></label>
          <label>Vrsta događaja primera<select className={field} value={event} onChange={e => setEvent(e.target.value)}><option value="supply">Redovni promet</option><option value="advance">Avans</option><option value="correction">Korekcija</option></select></label>
          <label>Datum prometa u primeru<input className={field} type="date" value={supplyDate} onChange={e => setSupplyDate(e.target.value)}/></label>
          <label>Datum ranijeg avansa (ako postoji)<input className={field} type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)}/></label>
          <label>Osnovica primera RSD<input className={field} inputMode="decimal" value={net} onChange={e => setNet(e.target.value)}/></label>
          {category === 'reduced' && <><label>Tačka člana 23 stav 2<select className={field} value={point} onChange={e => setPoint(e.target.value)}><option value="">Izaberite</option>{REDUCED_POINTS.map(p => <option key={p} value={p}>{p}</option>)}</select></label><label>Dokaz klasifikacije<input className={field} maxLength={1000} value={classification} onChange={e => setClassification(e.target.value)}/></label></>}
        </div>
        <p className="text-sm text-slate-600">{TAX_POLICY.rounding} Nabavka ne potvrđuje pravo na odbitak prethodnog poreza.</p>
        <Button type="submit">Proveri poreski primer</Button>
      </fieldset>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" aria-label="Rezultat poreskog primera" className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
      <p className="font-semibold">{outcome[result.status]}</p><p>{result.reason}</p>
      {result.taxDate && <p>Poreski datum: {result.taxDate}</p>}
      {result.vatMinor !== undefined && <p>Osnovica {formatRsd(result.netMinor!)} RSD · PDV {formatRsd(result.vatMinor)} RSD · Ukupno {formatRsd(result.grossMinor!)} RSD</p>}
      <p>Pravilo: {result.ruleId || '—'} · verzija {result.policyId}</p>
    </div>}
    <details><summary className="cursor-pointer font-medium">Datumi primene i granice verzija</summary><ul className="list-disc pl-5 space-y-2 text-sm">{TAX_TRANSITIONS.map((row,i) => <li key={i}>{row.appliesFrom} · {row.article}: {row.scope} {row.disposition}</li>)}</ul>
      <p className="text-sm">Za 80/2026 postoje i izuzeci od dana stupanja na snagu (član 1 i ovlašćenja); ne izvode se iz datuma preuzimanja. Kalkulator koristi samo neizmenjene stope člana 23 i ne obračunava ove posebne slučajeve.</p>
    </details>
    <ul className="space-y-2 text-sm">{TAX_SOURCES.map(source => <li key={source.id}><a className="text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.kind} · provera {source.checkedOn}</p></li>)}</ul>
  </details>;
};
