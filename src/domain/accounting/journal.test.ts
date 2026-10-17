import { minorUnits, validateJournal, type JournalDraft, type PostingContext } from './journal';

const context: PostingContext = {
  firmId: 'firm', fiscalYearId: 'year', periodId: 'period', periodStart: '2026-01-01', periodEnd: '2026-01-31', periodStatus: 'open', canPost: true,
  accounts: [
    { id: 'receivable', firmId: 'firm', active: true, allowsPosting: true, requiresPartner: true },
    { id: 'income', firmId: 'firm', active: true, allowsPosting: true, requiresPartner: false },
    { id: 'foreign', firmId: 'other-firm', active: true, allowsPosting: true, requiresPartner: false }
  ], partners: [{ id: 'buyer', firmId: 'firm' }, { id: 'foreign-buyer', firmId: 'other-firm' }]
};
const draft = (): JournalDraft => ({
  id: 'draft', firmId: 'firm', fiscalYearId: 'year', periodId: 'period', postingDate: '2026-01-15', description: 'Example',
  lines: [
    { id: 'a', accountId: 'receivable', partnerId: 'buyer', debit: minorUnits('10000'), credit: minorUnits('0'), description: '' },
    { id: 'b', accountId: 'income', debit: minorUnits('0'), credit: minorUnits('10000'), description: '' }
  ]
});
const codes = (value: JournalDraft, ctx = context) => validateJournal(value, ctx).map(issue => issue.code);

it('accepts balanced exact amounts beyond JS safe integer precision', () => {
  const value = draft();
  value.lines[0].debit = minorUnits('900719925474099300');
  value.lines[1].credit = minorUnits('900719925474099300');
  expect(validateJournal(value, context)).toEqual([]);
  value.lines[1].credit = minorUnits('900719925474099301');
  expect(codes(value)).toContain('balance');
});

it.each(['-1', '1.5', 'NaN', 'Infinity', '01', '1e3', '', '9'.repeat(25)])('rejects ambiguous money transport %s', value => {
  expect(() => minorUnits(value)).toThrow();
});

it('rejects JSON numbers instead of silently coercing them to exact strings', () => {
  expect(() => minorUnits(100 as unknown as string)).toThrow();
});

it('rejects cross-firm accounts and partners despite a balanced amount', () => {
  const value = draft();
  value.lines[0].accountId = 'foreign';
  value.lines[0].partnerId = 'foreign-buyer';
  expect(codes(value)).toEqual(expect.arrayContaining(['account', 'partner']));
});

it('requires an open, matching period and posting permission', () => {
  expect(codes(draft(), { ...context, periodStatus: 'closed', canPost: false, fiscalYearId: 'other' })).toEqual(expect.arrayContaining(['permission', 'period', 'scope']));
});

it.each(['2026-02-01', '2026-02-30', 'bad-date'])('rejects invalid or out-of-period date %s', postingDate => {
  expect(codes({ ...draft(), postingDate })).toContain('date');
});

it('rejects two-sided lines, missing analytic partner and duplicate line IDs', () => {
  const value = draft();
  value.lines[0].credit = minorUnits('1');
  delete value.lines[0].partnerId;
  value.lines[1].id = 'a';
  expect(codes(value)).toEqual(expect.arrayContaining(['amount', 'partner', 'lines', 'balance']));
});

it('rejects inactive and parent accounts', () => {
  expect(codes(draft(), { ...context, accounts: context.accounts.map(account => ({ ...account, active: false, allowsPosting: false })) })).toContain('account');
});
