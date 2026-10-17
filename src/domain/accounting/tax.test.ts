import { evaluateTaxReference, TAX_POLICY, TAX_RULES, TAX_SOURCES, type TaxReferenceRequest } from './tax';

const firmId = '00000000-0000-4000-8000-000000000001';
const request = (): TaxReferenceRequest => ({ firmId, profile: { firmId, legalForm:'doo', regime:'regular_vat', method:'accrual',
  validFrom:'2026-01-01', validTo:'2026-12-31', evidence:'Potvrda evidencije PDV za probnu firmu' },
  direction:'sale', category:'standard', event:'supply', supplyDate:'2026-10-09', netMinor:'100000',
  currency:'RSD', domestic:true, ordinarySupply:true, supplierIsTaxDebtor:true });

it.each([
  ['100000','standard','20000','120000'], ['100000','reduced','10000','110000'],
  ['5','reduced','1','6'], ['2','standard','0','2'], ['3','standard','1','4'],
  ['900719925474099301','standard','180143985094819860','1080863910568919161'],
  ['0','standard','0','0'],
])('calculates exact reference amounts %s at %s without floating point', (netMinor,category,vatMinor,grossMinor) => {
  const input = { ...request(), netMinor, category, reducedPoint:'1', classificationEvidence:'Potvrđena klasifikacija hleba, čl. 23 st. 2 tač. 1' };
  expect(evaluateTaxReference(input)).toMatchObject({ status:'supported', netMinor,vatMinor,grossMinor,policyId:'rs-vat-reference-2026-v1' });
});
it.each(['2026-01-01','2026-03-31','2026-04-01','2026-08-31','2026-09-01','2026-12-15','2026-12-31'])('keeps Article 23 rates valid at boundary %s', supplyDate => {
  expect(evaluateTaxReference({ ...request(),supplyDate })).toMatchObject({status:'supported',vatMinor:'20000',taxDate:supplyDate});
});
it.each(['2025-12-31','2027-01-01'])('refuses an unverified policy year %s', supplyDate => {
  expect(evaluateTaxReference({ ...request(),supplyDate }).status).toBe('unsupported');
});
it.each(['1a','7a','12a','22',1])('refuses deleted or invalid reduced point %s', reducedPoint => {
  expect(evaluateTaxReference({ ...request(),category:'reduced',reducedPoint,classificationEvidence:'Evidence' }).status).toBe('invalid');
});
it.each(['2a','13a'])('accepts the existing lettered reduced point %s with evidence', reducedPoint => {
  expect(evaluateTaxReference({ ...request(),category:'reduced',reducedPoint,classificationEvidence:'Confirmed classification' }).status).toBe('supported');
});
it('requires reduced classification and does not infer it from a rate or legal form', () => {
  expect(evaluateTaxReference({...request(),category:'reduced'}).status).toBe('review');
  expect(evaluateTaxReference({...request(),category:'reduced',reducedPoint:'1',classificationEvidence:'  '}).status).toBe('review');
  expect(evaluateTaxReference({...request(),profile:{...request().profile,regime:''}}).status).toBe('invalid');
});
it('keeps input VAT separate from input deduction', () => {
  expect(evaluateTaxReference({...request(),direction:'purchase'})).toMatchObject({status:'supported',vatMinor:'20000',inputDeduction:'unassessed'});
});
it('distinguishes small taxpayer from exemptions and does not assign it to a VAT firm', () => {
  const input = {...request(),category:'small_taxpayer',profile:{...request().profile,regime:'small_taxpayer'}};
  expect(evaluateTaxReference(input)).toMatchObject({status:'supported',rate:null,vatMinor:'0',grossMinor:'100000'});
  expect(evaluateTaxReference({...input,direction:'purchase'}).status).toBe('unsupported');
  expect(evaluateTaxReference({...request(),category:'small_taxpayer'}).status).toBe('invalid');
  expect(evaluateTaxReference({...input,category:'standard'}).status).toBe('invalid');
});
it.each(['exempt_with_deduction','exempt_without_deduction','outside_scope'])('requires review instead of converting %s to zero', category => {
  const result = evaluateTaxReference({...request(),category}); expect(result.status).toBe('review'); expect(result.vatMinor).toBeUndefined();
});
it.each(['reverse_charge','import','export'])('refuses automatic calculation for %s', category => {
  const result=evaluateTaxReference({...request(),category}); expect(result.status).toBe('unsupported'); expect(result.vatMinor).toBeUndefined();
});
it('dates an ordinary advance at the earliest event but leaves settlement for TAX-02', () => {
  expect(evaluateTaxReference({...request(),advanceDate:'2026-09-01'})).toMatchObject({status:'review',taxDate:'2026-09-01'});
  expect(evaluateTaxReference({...request(),advanceDate:'2026-10-10'}).status).toBe('invalid');
  expect(evaluateTaxReference({...request(),event:'advance'}).status).toBe('review');
  expect(evaluateTaxReference({...request(),event:'correction'}).status).toBe('review');
  expect(evaluateTaxReference({...request(),supplyDate:'2027-01-01',advanceDate:'2026-12-31'}).status).toBe('unsupported');
});
it('rejects cross-firm, missing, reversed and uncovered tax profiles', () => {
  for (const profile of [undefined, {...request().profile,firmId:'00000000-0000-4000-8000-000000000002'},
    {...request().profile,validFrom:'2026-11-01'}, {...request().profile,validTo:'2026-09-30'},
    {...request().profile,validFrom:'2026-12-31',validTo:'2026-01-01'}, {...request().profile,evidence:''}])
    expect(evaluateTaxReference({...request(),profile}).status).toBe('invalid');
});
it.each(['-1','1.5','01','NaN','1000000000000000000000000'])('rejects malformed or oversized minor units %s', netMinor => {
  expect(evaluateTaxReference({...request(),netMinor}).status).toBe('invalid');
});
it('rejects gross overflow as well as unknown scope and special accounting methods', () => {
  expect(evaluateTaxReference({...request(),netMinor:'999999999999999999999999'}).status).toBe('invalid');
  for (const patch of [{currency:'EUR'}, {domestic:false}, {ordinarySupply:false}, {supplierIsTaxDebtor:false},
    {category:'0'}, {supplyDate:'2026-02-30'}, {profile:{...request().profile,method:'cash'}}])
    expect(evaluateTaxReference({...request(),...patch}).status).toBe('invalid');
});
it('links immutable rules to explicit sources and marks the policy interval', () => {
  expect(TAX_POLICY).toMatchObject({validFrom:'2026-01-01',validTo:'2026-12-31',reviewedOn:'2026-10-09'});
  expect(new Set(TAX_RULES.map(r=>r.id)).size).toBe(9);
  for (const rule of TAX_RULES) { expect(Object.isFrozen(rule)).toBe(true); expect(TAX_SOURCES.some(s=>s.id===rule.sourceId)).toBe(true); }
  for (const source of TAX_SOURCES) { expect(source.url).toMatch(/^https:\/\/(www\.)?(mfin|purs)\.gov\.rs\//); if ('sha256' in source) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/); }
  expect(Object.isFrozen(evaluateTaxReference(request()))).toBe(true);
});
