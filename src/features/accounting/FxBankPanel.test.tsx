import { act,fireEvent,render,screen,within } from '@testing-library/react';
import { FxBankPanel } from './FxBankPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(3),years:[],capabilities:['post_journal'],periods:[],accounts:[],partners:[],drafts:[],journals:[]};
const saved={firmId:id(1),statementId:id(5),accountId:id(2),yearId:id(3),reference:'FX-001',startsOn:'2026-01-15',endsOn:'2026-01-15',opening:'0',closing:'4000',currency:'EUR' as const,number:'RS35160001',cashAccountId:id(4),rows:[{id:id(6),externalId:'BANK-001',bookingDate:'2026-01-15',valueDate:'2026-01-15',incoming:'4000',outgoing:'0',counterparty:'Partner',reference:'',description:''}],links:[{transactionId:id(6),settlementId:id(7),linked:false,cancelled:false}]};
const setup=(reader=false,cancelled=false)=>{
 const repo={fxBankWorkspace:jest.fn(async()=>({firmId:id(1),yearId:id(3),accounts:[],statements:[{id:id(5),accountId:id(2),reference:'FX-001',endsOn:'2026-01-15'}]})),readFxBankStatement:jest.fn(async()=>({...saved,links:[{...saved.links[0],cancelled}]})),linkFxBankPayment:jest.fn(async(_c:unknown)=>({}))};
 const onState=jest.fn();render(<FeedbackProvider><FxBankPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={reader?{...workspace,capabilities:[]}:workspace} disabled={false} onState={onState}/></FeedbackProvider>);return {repo,onState};
};
const open=async()=>{await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne izvode'})));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'FX-001 · 2026-01-15'})));};
it('confirms linking an existing journal and retries the identical payload/key after an unknown result',async()=>{
 const {repo,onState}=setup();repo.linkFxBankPayment.mockRejectedValueOnce(new AccountingError('unavailable'));await open();
 expect(screen.getByText(/Nepovezano: 1 transakcija/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Poveži postojeće plaćanje'}));const dialog=await screen.findByRole('alertdialog');expect(repo.linkFxBankPayment).not.toHaveBeenCalled();expect(onState).toHaveBeenLastCalledWith(false,true);
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Poveži plaćanje'})));
 expect(screen.getByRole('alert')).toHaveTextContent('nepoznat');expect(screen.getByRole('button',{name:'Učitaj devizne izvode'})).toBeDisabled();expect(onState).toHaveBeenLastCalledWith(false,true);
 const sent=repo.linkFxBankPayment.mock.calls[0][0];await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Ponovi isti zahtev za devizni izvod'})));expect(repo.linkFxBankPayment.mock.calls[1][0]).toBe(sent);expect(screen.getByRole('status')).toHaveTextContent('Novi nalog nije napravljen');
});
it('shows cancellation evidence and prevents linking a cancelled payment',async()=>{
 setup(false,true);await open();expect(screen.getByRole('table',{name:'Povezivanje deviznog izvoda'})).toHaveTextContent('Stornirano');expect(screen.queryByRole('button',{name:'Poveži postojeće plaćanje'})).not.toBeInTheDocument();
});
it('allows readers to inspect foreign saldo without performing reconciliation',async()=>{
 setup(true);await open();expect(screen.getByText(/Računica usaglašena u ovom izvodu/)).toHaveTextContent('40.00 EUR');expect(screen.getByRole('button',{name:'Poveži postojeće plaćanje'})).toBeDisabled();
});
