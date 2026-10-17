import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { AdvancesPanel } from './AdvancesPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AdvanceCommand,AdvanceWorkspace } from '../../domain/accounting/advances';
import type { BusinessDocument } from '../../domain/accounting/documents';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const invoice:BusinessDocument={document:{id:id(1),firmId:id(2),partnerId:id(3),direction:'outgoing',kind:'invoice',referenceId:null,number:'FINAL',documentDate:'2026-01-15',dueDate:'2026-01-30',description:'',currency:'RSD',lines:[{id:'one',description:'Source',net:'10000',tax:'2000'}]},revision:'2',lifecycle:'issued',partnerName:'Buyer',issuedAt:'2026-01-15T12:00:00Z',issuedBy:id(9),workflow:{revision:'2',approval:'approved',delivery:'not_recorded'},payment:'not_tracked',journalId:id(10)};
const source:BusinessDocument={...invoice,document:{...invoice.document,id:id(4),kind:'advance',number:'ADVANCE'},journalId:id(11)};
const data:AdvanceWorkspace={firmId:id(2),invoiceId:id(1),remainingNet:'10000',remainingTax:'2000',advances:[{source,remainingNet:'5000',remainingTax:'1000'}],applications:[]};
const workspace:AccountingWorkspace={firmId:id(2),yearId:id(5),years:[],periods:[{id:id(6),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1'}],accounts:[{id:id(7),code:'204',name:'Buyer',allowsPosting:true,requiresPartner:true,active:true,validFrom:'2026-01-01',validTo:null},{id:id(8),code:'430',name:'Advances',allowsPosting:true,requiresPartner:false,active:true,validFrom:'2026-01-01',validTo:null}],partners:[],drafts:[],journals:[],capabilities:['post_journal','reverse_journal']};
const setup=()=>{
 Object.defineProperty(global.crypto,'randomUUID',{configurable:true,value:()=>id(12)});
 const repo={advances:jest.fn(async()=>data),advanceCommand:jest.fn(async(_c:AdvanceCommand)=>({}))};const state=jest.fn();const close=jest.fn();
 render(<FeedbackProvider><AdvancesPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={workspace} invoice={invoice} disabled={false} onBusy={state} onClose={close}/></FeedbackProvider>);
 return {repo,state,close};
};
const fill=async(net='40.01')=>{
 await screen.findByText('Available invoice net / tax: 100.00 / 20.00 RSD');
 await waitFor(()=>expect(screen.getByLabelText('Advance source')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Advance source'),{target:{value:id(4)}});
 fireEvent.change(screen.getByLabelText('Apply net RSD'),{target:{value:net}});
 fireEvent.change(screen.getByLabelText('Apply tax RSD'),{target:{value:'8.00'}});
 fireEvent.change(screen.getByLabelText('Invoice source account'),{target:{value:id(7)}});
 fireEvent.change(screen.getByLabelText('Advance source account'),{target:{value:id(8)}});
};
const confirm=async()=>{fireEvent.click(screen.getByRole('button',{name:'Apply advance'}));const dialog=await screen.findByRole('alertdialog');await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Apply advance'}));});};
it('posts explicitly selected accounts with exact amounts and source revisions',async()=>{
 const {repo}=setup();await fill();await confirm();await waitFor(()=>expect(repo.advanceCommand).toHaveBeenCalledTimes(1));
 expect(repo.advanceCommand.mock.calls[0][0]).toMatchObject({action:'apply',data:{net:'4001',tax:'800',advanceRevision:'2',invoiceRevision:'2',invoiceAccountId:id(7),advanceAccountId:id(8)}});
});
it('blocks component over-allocation before sending a command',async()=>{
 const {repo}=setup();await fill('50.01');fireEvent.click(screen.getByRole('button',{name:'Apply advance'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('The application exceeds');expect(repo.advanceCommand).not.toHaveBeenCalled();
});
it('freezes an uncertain application and retries the identical request',async()=>{
 const {repo,state,close}=setup();repo.advanceCommand.mockRejectedValueOnce(new AccountingError('unavailable'));await fill();await confirm();
 const retry=await screen.findByRole('button',{name:'Retry the same request'});await waitFor(()=>expect(retry).toBeEnabled());
 expect(screen.getByLabelText('Apply net RSD')).toBeDisabled();expect(screen.getByRole('button',{name:'Close advance applications'})).toBeDisabled();expect(state).toHaveBeenLastCalledWith(true);
 await act(async()=>{fireEvent.click(retry);});await waitFor(()=>expect(repo.advanceCommand).toHaveBeenCalledTimes(2));
 expect(repo.advanceCommand.mock.calls[1][0]).toEqual(repo.advanceCommand.mock.calls[0][0]);expect(close).not.toHaveBeenCalled();
});
