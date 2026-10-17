import { formatRsd, parseRsd } from './money';

it('round trips RSD above the JS safe integer range exactly', () => {
  expect(parseRsd('9007199254740993.01')).toBe('900719925474099301');
  expect(formatRsd('900719925474099301')).toBe('9007199254740993.01');
  expect(parseRsd('12,3')).toBe('1230');
  expect(formatRsd('-1230')).toBe('-12.30');
});
it.each(['1.001','-1','1e3','NaN','01','','1,000.00'])('rejects ambiguous or unsupported amount %s', value => {
  expect(() => parseRsd(value)).toThrow();
});
