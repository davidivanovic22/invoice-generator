import { canAccount, postJournalSchema, periodStatusSchema, reverseJournalSchema } from './commands';
import { decimalToMinor, multiplyToMinor } from './decimal';

it('legacy accountant membership does not grant financial confirmation', () => {
  expect(canAccount('accountant', [], 'post_journal')).toBe(false);
  expect(canAccount('accountant', ['post_journal'], 'post_journal')).toBe(true);
  expect(canAccount('viewer', ['post_journal'], 'post_journal')).toBe(false);
  expect(canAccount(null, ['post_journal'], 'post_journal')).toBe(false);
});

it.each([['1.005','101'],['-1.005','-101'],['0.0049','0'],['9007199254740993.01','900719925474099301']])('rounds %s exactly to %s', (value, expected) => {
  expect(decimalToMinor(value)).toBe(expected);
});
it('multiplies decimals before rounding the result', () => {
  expect(multiplyToMinor('0.1','0.2')).toBe('2');
  expect(multiplyToMinor('2.5','1.005')).toBe('251');
});
it.each(['1e3','NaN','01.00','0.1234567890123'])('rejects unsupported decimal %s', value => {
  expect(() => decimalToMinor(value)).toThrow();
});
it('rejects malformed public commands before transport', () => {
  expect(postJournalSchema.safeParse({ kind: 'postJournal', expectedRevision: 'NaN', draft: {} }).success).toBe(false);
  expect(periodStatusSchema.safeParse({ kind: 'setPeriodStatus', reason: '' }).success).toBe(false);
  expect(reverseJournalSchema.safeParse({ kind: 'reverseJournal', postingDate: '2026-02-30' }).success).toBe(false);
});
