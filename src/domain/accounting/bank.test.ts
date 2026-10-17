import { bankStatementInputSchema,normalizeBankNumber,parseBankRsd } from './bank';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row={externalId:'BANK-0001',bookingDate:'2026-01-01',valueDate:'2026-01-02',incoming:'900719925474099301',outgoing:'0',counterparty:'Buyer',reference:'001',description:'Source'};
const data={firmId:id(1),bankAccountId:id(2),fiscalYearId:id(3),reference:'2026-001',startsOn:'2026-01-01',endsOn:'2026-01-31',opening:'-100',closing:'900719925474099201',rows:[row]};
it('keeps exact large incoming amounts and negative opening balances',()=>{
 expect(normalizeBankNumber(' rs35-1600 0000-0010 ')).toBe('RS35160000000010');
 expect(bankStatementInputSchema.parse(data)).toEqual(data);
 expect(parseBankRsd('9007199254740993.01')).toBe('900719925474099301');
 expect(parseBankRsd('-1,00',true)).toBe('-100');expect(parseBankRsd('-0.00',true)).toBe('0');
});
it('refuses unbalanced statements, duplicate IDs and out-of-range bookings',()=>{
 for(const patch of [{closing:'0'},{rows:[row,row]},{rows:[{...row,bookingDate:'2026-02-01'}]},{rows:[{...row,incoming:'1',outgoing:'1'}]}])expect(bankStatementInputSchema.safeParse({...data,...patch}).success).toBe(false);
});
it('reports malformed amounts without throwing inside safeParse',()=>{
 for(const incoming of ['garbage','-1','01','1e3','0.1',100])expect(bankStatementInputSchema.safeParse({...data,rows:[{...row,incoming}]}).success).toBe(false);
 expect(bankStatementInputSchema.safeParse({...data,opening:'garbage'}).success).toBe(false);
 expect(()=>parseBankRsd('1.001')).toThrow();expect(()=>parseBankRsd('1.000,00')).toThrow();
});
