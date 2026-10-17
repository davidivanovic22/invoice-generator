import { accountingUuid } from './identifiers';
it('accepts canonical PostgreSQL UUIDs without assuming RFC version bits',()=>{
 expect(accountingUuid.parse('abcdef01-2345-f678-0123-456789abcdef')).toBe('abcdef01-2345-f678-0123-456789abcdef');
 for(const value of ['invalid','abcdef01-2345-f678-0123-456789abcdeg','abcdef012345f6780123456789abcdef','ABCDEF01-2345-F678-0123-456789ABCDEF'])expect(accountingUuid.safeParse(value).success).toBe(false);
});
