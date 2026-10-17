import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { BankPanel } from './BankPanel';
import { readBankFile } from './bankFiles';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { BankImportCommand } from '../../domain/accounting/bank';
jest.mock('./bankFiles',()=>({...jest.requireActual('./bankFiles'),readBankFile:jest.fn(),downloadBankTemplate:jest.fn(async()=>{})}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=[{externalId:'BANK-1',bookingDate:'2026-01-01',valueDate:'2026-01-02',incoming:'10001',outgoing:'0',counterparty:'Buyer',reference:'0001',description:'Source'}];
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(2),years:[{id:id(2),label:2026,startsOn:'2026-01-01',endsOn:'2026-12-31'}],capabilities:['post_journal','manage_chart'],accounts:[],partners:[],periods:[],drafts:[],journals:[]};
const setup=()=>{
 Object.defineProperty(global.crypto,'randomUUID',{configurable:true,value:()=>id(4)});(readBankFile as jest.Mock).mockReset().mockResolvedValue(rows);
 const repo={bankWorkspace:jest.fn(async()=>({firmId:id(1),yearId:id(2),accounts:[{id:id(3),name:'Operating',number:'160-001-00',currency:'RSD'}],statements:[]})),importBankStatement:jest.fn(async(c:BankImportCommand)=>({firmId:id(1),accountId:id(3),statementId:id(5),newCount:c.data.rows.length,reusedCount:0,previouslyImported:false}))};const state=jest.fn();
 render(<FeedbackProvider><BankPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={workspace} disabled={false} onState={state}/></FeedbackProvider>);return {repo,state};
};
const prepare=async(closing='100.01')=>{
 fireEvent.click(screen.getByText('Import Excel statement'));await waitFor(()=>expect(screen.getByLabelText('Statement bank account')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Statement bank account'),{target:{value:id(3)}});fireEvent.change(screen.getByLabelText('Statement reference'),{target:{value:'2026-001'}});fireEvent.change(screen.getByLabelText('Closing RSD'),{target:{value:closing}});
 await act(async()=>{fireEvent.change(screen.getByLabelText('Excel statement file'),{target:{files:[new File(['fixture'],'statement.xlsx')]}});});fireEvent.click(screen.getByRole('button',{name:'Review statement'}));
};
const save=async()=>{fireEvent.click(screen.getByRole('button',{name:'Import statement'}));const dialog=await screen.findByRole('alertdialog');await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Import statement'}));});};
it('requires a reviewed balanced statement and sends exact amounts without marking paid',async()=>{
 const {repo,state}=setup();repo.importBankStatement.mockImplementationOnce(async(c:BankImportCommand)=>{
  expect(state).toHaveBeenLastCalledWith(true,true);
  return {firmId:id(1),accountId:id(3),statementId:id(5),newCount:c.data.rows.length,reusedCount:0,previouslyImported:false};
 });await prepare();expect(screen.getByRole('table',{name:'Statement preview'})).toBeInTheDocument();await save();
 expect(repo.importBankStatement).toHaveBeenCalledTimes(1);expect(repo.importBankStatement.mock.calls[0][0].data.rows).toEqual(rows);expect(repo.importBankStatement.mock.calls[0][0].data).not.toHaveProperty('paid');
 expect(screen.getByRole('status')).toHaveTextContent('New transactions: 1');
});
it('refuses imbalance and invalidates review whenever metadata changes',async()=>{
 const {repo}=setup();await prepare('100.00');expect(screen.getByRole('alert')).toHaveTextContent('opening plus incoming');expect(screen.queryByRole('button',{name:'Import statement'})).not.toBeInTheDocument();expect(repo.importBankStatement).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Closing RSD'),{target:{value:'100.01'}});fireEvent.click(screen.getByRole('button',{name:'Review statement'}));
 expect(screen.getByRole('table',{name:'Statement preview'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Statement reference'),{target:{value:'Other'}});expect(screen.queryByRole('table',{name:'Statement preview'})).not.toBeInTheDocument();
});
it('freezes an uncertain import and retries exactly the same request',async()=>{
 const {repo,state}=setup();repo.importBankStatement.mockRejectedValueOnce(new AccountingError('unavailable'));await prepare();await save();
 expect(screen.getByLabelText('Statement reference')).toBeDisabled();expect(screen.getByRole('button',{name:'Clear statement fields'})).toBeDisabled();expect(state).toHaveBeenLastCalledWith(true,true);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry the same request'}));});expect(repo.importBankStatement).toHaveBeenCalledTimes(2);expect(repo.importBankStatement.mock.calls[1][0]).toEqual(repo.importBankStatement.mock.calls[0][0]);
});
