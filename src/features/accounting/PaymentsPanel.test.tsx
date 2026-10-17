import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { PaymentsPanel } from './PaymentsPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { PaymentCommand,PaymentWorkspace } from '../../domain/accounting/payments';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { PaymentLedgerCommand,PaymentLedgerWorkspace } from '../../domain/accounting/paymentLedger';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const data:PaymentWorkspace={firmId:id(1),transaction:{id:id(3),accountId:id(6),externalId:'BANK-1',bookingDate:'2026-01-10',incoming:'15001',outgoing:'0',available:'15001'},
 documents:[{id:id(4),number:'INV-1',partnerName:'Buyer',direction:'outgoing',kind:'invoice',revision:'2',balance:{gross:'10001',credits:'0',advances:'0',paid:'0',due:'10001',overpaid:'0',status:'not_tracked'}}],allocations:[],refundablePayments:[]};
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(5),capabilities:[],years:[],periods:[],accounts:[],partners:[],drafts:[],journals:[]};
const setup=(loaded:PaymentWorkspace=data,context:AccountingWorkspace=workspace,book:PaymentLedgerWorkspace={firmId:id(1),transactionId:id(3),bank:null,allocations:[]})=>{
 Object.defineProperty(global.crypto,'randomUUID',{configurable:true,value:()=>id(2)});
 const repo={paymentWorkbench:jest.fn(async()=>({reconciliation:loaded,ledger:book})),postPaymentLedger:jest.fn(async(c:PaymentLedgerCommand)=>({firmId:id(1),transactionId:id(3),journalId:c.data.journalId,allocationId:c.action==='allocation'?c.data.allocationId:null})),paymentCommand:jest.fn(async(c:PaymentCommand)=>({firmId:id(1),allocationId:c.data.id,transactionId:id(3),documentId:id(4),revision:'1'}))};const onBusy=jest.fn();const close=jest.fn();
 render(<FeedbackProvider><PaymentsPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={context} firmId={id(1)} transactionId={id(3)} accountId={id(6)} canWrite canCancel disabled={false} onBusy={onBusy} onClose={close}/></FeedbackProvider>);return {repo,onBusy,close};
};
const allocate=async(chooseDocument=true)=>{
 await waitFor(()=>expect(screen.getByLabelText('Payment document')).toBeEnabled());if(chooseDocument)fireEvent.change(screen.getByLabelText('Payment document'),{target:{value:id(4)}});fireEvent.change(screen.getByLabelText('Allocation RSD'),{target:{value:'40.01'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirm allocation'}));const dialog=await screen.findByRole('alertdialog');await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Confirm allocation'}));});
};
it('requires confirmation and sends an exact allocation linked to the selected bank transaction',async()=>{
 const {repo}=setup();await allocate();expect(repo.paymentCommand.mock.calls[0][0]).toEqual({action:'allocate',idempotencyKey:id(2),data:{firmId:id(1),id:id(2),transactionId:id(3),documentId:id(4),documentRevision:'2',kind:'payment',refundOf:null,amount:'4001'}});
 expect(screen.getByText(/Unallocated RSD/)).toHaveTextContent('150.01');
});
it('freezes an unknown result, blocks closing and retries the original command',async()=>{
 const {repo,onBusy}=setup();repo.paymentCommand.mockRejectedValueOnce(new AccountingError('unavailable'));await allocate();
 expect(screen.getByLabelText('Allocation RSD')).toBeDisabled();expect(screen.getByRole('button',{name:'Close payment reconciliation'})).toBeDisabled();expect(onBusy).toHaveBeenLastCalledWith(true);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry the same request'}));});expect(repo.paymentCommand.mock.calls[1][0]).toEqual(repo.paymentCommand.mock.calls[0][0]);
});
it('rejects zero allocation and clears the original refund selection on document/mode changes',async()=>{
 const {repo}=setup();await waitFor(()=>expect(screen.getByLabelText('Payment document')).toBeEnabled());fireEvent.change(screen.getByLabelText('Payment document'),{target:{value:id(4)}});
 fireEvent.click(screen.getByRole('button',{name:'Confirm allocation'}));await screen.findByRole('alert');expect(repo.paymentCommand).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Allocation kind'),{target:{value:'refund'}});expect(screen.getByLabelText('Payment document')).toHaveValue('');expect(screen.getByLabelText('Original payment allocation')).toHaveValue('');
});
it('identifies the original payment by bank reference/date and sends its allocation link for a refund',async()=>{
 const {repo}=setup({...data,transaction:{...data.transaction,incoming:'0',outgoing:'15001'},refundablePayments:[{id:id(7),documentId:id(4),number:'INV-1',externalId:'ORIGINAL-BANK-PAYMENT',bookingDate:'2026-01-09',available:'10001'}]});
 await waitFor(()=>expect(screen.getByLabelText('Allocation kind')).toBeEnabled());fireEvent.change(screen.getByLabelText('Allocation kind'),{target:{value:'refund'}});
 fireEvent.change(screen.getByLabelText('Payment document'),{target:{value:id(4)}});expect(screen.getByRole('option',{name:'ORIGINAL-BANK-PAYMENT · 2026-01-09 · 100.01 RSD'})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Original payment allocation'),{target:{value:id(7)}});await allocate(false);
 expect(repo.paymentCommand.mock.calls[0][0].data).toMatchObject({kind:'refund',refundOf:id(7),amount:'4001'});
});

const postingContext:AccountingWorkspace={...workspace,periods:[{id:id(8),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1'}],accounts:[
 {id:id(9),code:'241',name:'Bank ledger',active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null},
 {id:id(10),code:'299',name:'Clearing',active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null},
 {id:id(11),code:'204',name:'Buyer account',active:true,allowsPosting:true,requiresPartner:true,validFrom:'2026-01-01',validTo:null}]};
const selectBankAccounts=async()=>{
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Bank ledger account'})).toBeEnabled());
 fireEvent.change(screen.getByRole('combobox',{name:'Bank ledger account'}),{target:{value:id(9)}});
 fireEvent.change(screen.getByRole('combobox',{name:'Bank clearing account'}),{target:{value:id(10)}});
};
it.each([true,false])('reviews the full bank amount and correct debit/credit before posting, inflow=%s',async(inflow)=>{
 const {repo,onBusy}=setup({...data,transaction:{...data.transaction,incoming:inflow?'15001':'0',outgoing:inflow?'0':'15001'}},postingContext);
 await selectBankAccounts();fireEvent.change(screen.getByLabelText('Allocation RSD'),{target:{value:'40.01'}});
 fireEvent.click(screen.getByRole('button',{name:'Post bank transaction'}));const dialog=await screen.findByRole('alertdialog');
 const rows=within(dialog).getAllByRole('row');expect(rows[1]).toHaveTextContent(inflow?'241 · Bank ledger':'299 · Clearing');
 expect(within(rows[1]).getAllByRole('cell').map(c=>c.textContent)).toEqual([inflow?'241 · Bank ledger':'299 · Clearing','150.01','0.00']);
 expect(within(rows[2]).getAllByRole('cell').map(c=>c.textContent)).toEqual([inflow?'299 · Clearing':'241 · Bank ledger','0.00','150.01']);
 expect(dialog).toHaveTextContent('The full bank transaction will be posted.');expect(dialog).toHaveTextContent('2026-01-01 – 2026-01-31');
 expect(repo.postPaymentLedger).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Close payment reconciliation'})).toBeDisabled();expect(onBusy).toHaveBeenLastCalledWith(true);
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));});
 expect(repo.postPaymentLedger).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Close payment reconciliation'})).toBeEnabled();
});
it('rejects same accounts and dates outside the selected open period before showing a posting confirmation',async()=>{
 const {repo}=setup(data,postingContext);await selectBankAccounts();
 fireEvent.change(screen.getByRole('combobox',{name:'Bank clearing account'}),{target:{value:id(9)}});
 fireEvent.click(screen.getByRole('button',{name:'Post bank transaction'}));await screen.findByRole('alert');expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'Bank clearing account'}),{target:{value:id(10)}});
 fireEvent.change(screen.getByLabelText('Payment posting date'),{target:{value:'2026-02-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Post bank transaction'}));expect(repo.postPaymentLedger).not.toHaveBeenCalled();expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
it('reviews storno using the original posted account even when the currently selected document account differs',async()=>{
 const allocation:PaymentWorkspace['allocations'][number]={id:id(12),documentId:id(4),number:'INV-1',kind:'payment',refundOf:null,amount:'4001',status:'active',reason:null,refundable:'4001'};
 const book:PaymentLedgerWorkspace={firmId:id(1),transactionId:id(3),bank:{journalId:id(13),bankAccountId:id(9),clearingAccountId:id(10),reversed:false,clearingRemaining:'11000'},allocations:[{id:id(12),journalId:id(14),documentAccountId:id(11),reversalId:null,accountRemaining:'6000'}]};
 const {repo}=setup({...data,allocations:[allocation],transaction:{...data.transaction,available:'11000'}},{...postingContext,accounts:[...postingContext.accounts,{...postingContext.accounts[2],id:id(15),code:'205',name:'Other account'}]},book);
 await waitFor(()=>expect(screen.getByLabelText('Allocation cancellation reason')).toBeEnabled());
 fireEvent.change(screen.getByRole('combobox',{name:'Payment document ledger account'}),{target:{value:id(15)}});
 fireEvent.change(screen.getByLabelText('Allocation cancellation reason'),{target:{value:'Wrong allocation'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel allocation'}));const dialog=await screen.findByRole('alertdialog');const rows=within(dialog).getAllByRole('row');
 expect(within(rows[1]).getAllByRole('cell').map(c=>c.textContent)).toEqual(['204 · Buyer account','40.01','0.00']);
 expect(dialog).toHaveTextContent('Full reversal of the posted allocation.');expect(dialog).toHaveTextContent('Wrong allocation');
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Cancel allocation'}));});
 expect(repo.paymentCommand.mock.calls[0][0].data).toMatchObject({id:id(12),periodId:id(8),postingDate:'2026-01-10',reason:'Wrong allocation'});
});
it('reviews only the saved allocation amount and posts the same reviewed accounts and period',async()=>{
 const allocation:PaymentWorkspace['allocations'][number]={id:id(12),documentId:id(4),number:'INV-1',kind:'payment',refundOf:null,amount:'4001',status:'active',reason:null,refundable:'4001'};
 const book:PaymentLedgerWorkspace={firmId:id(1),transactionId:id(3),bank:{journalId:id(13),bankAccountId:id(9),clearingAccountId:id(10),reversed:false,clearingRemaining:'15001'},allocations:[]};
 const {repo}=setup({...data,allocations:[allocation],transaction:{...data.transaction,available:'11000'}},postingContext,book);
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Payment document ledger account'})).toBeEnabled());
 fireEvent.change(screen.getByRole('combobox',{name:'Payment document ledger account'}),{target:{value:id(11)}});
 fireEvent.change(screen.getByLabelText('Allocation RSD'),{target:{value:'10.00'}});
 fireEvent.click(screen.getByRole('button',{name:'Post allocation ledger'}));const dialog=await screen.findByRole('alertdialog');
 const rows=within(dialog).getAllByRole('row');expect(within(rows[1]).getAllByRole('cell').map(c=>c.textContent)).toEqual(['299 · Clearing','40.01','0.00']);
 expect(dialog).toHaveTextContent('INV-1 · Buyer');expect(dialog).toHaveTextContent('Only this allocation will be posted.');
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Post ledger entry'}));});
 expect(repo.postPaymentLedger.mock.calls[0][0]).toMatchObject({action:'allocation',data:{allocationId:id(12),documentAccountId:id(11),periodId:id(8),postingDate:'2026-01-10'}});
});
it('allows review and cancellation of an unposted allocation without a ledger period',async()=>{
 const allocation:PaymentWorkspace['allocations'][number]={id:id(12),documentId:id(4),number:'INV-1',kind:'payment',refundOf:null,amount:'4001',status:'active',reason:null,refundable:'4001'};
 const {repo}=setup({...data,allocations:[allocation],transaction:{...data.transaction,available:'11000'}});
 await waitFor(()=>expect(screen.getByLabelText('Allocation cancellation reason')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Allocation cancellation reason'),{target:{value:'Wrong evidence'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel allocation'}));const dialog=await screen.findByRole('alertdialog');
 expect(dialog).toHaveTextContent('No ledger entry exists for this allocation.');expect(within(dialog).queryByRole('table')).not.toBeInTheDocument();
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Cancel allocation'}));});
 expect(repo.paymentCommand.mock.calls[0][0].data).not.toHaveProperty('periodId');
});
