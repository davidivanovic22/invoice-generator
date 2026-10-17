import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { FeedbackProvider } from '../../ui/Feedback';
import { DocumentsPanel } from './DocumentsPanel';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { BusinessDocument,DocumentCommand } from '../../domain/accounting/documents';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(2),capabilities:['post_journal'],years:[{id:id(2),label:2026,startsOn:'2026-01-01',endsOn:'2026-12-31'}],periods:[],accounts:[],partners:[{id:id(3),name:'Buyer'}],drafts:[],journals:[]};
const setup=(initial:BusinessDocument[]=[])=>{
 Object.defineProperty(global.crypto,'randomUUID',{configurable:true,value:()=>id(4)});
 const repo={documents:jest.fn(async()=>initial),documentCommand:jest.fn(async(c:DocumentCommand)=>({firmId:c.data.firmId,documentId:c.data.id,revision:'1',action:c.action}))};
 const state=jest.fn();render(<FeedbackProvider><DocumentsPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={workspace} disabled={false} onState={state}/></FeedbackProvider>);
 return {repo,state};
};
const fill=async()=>{
 await waitFor(()=>expect(screen.getByLabelText('Document partner')).toBeEnabled());
 fireEvent.click(screen.getByText('Register a document'));
 fireEvent.change(screen.getByLabelText('Document partner'),{target:{value:id(3)}});
 fireEvent.change(screen.getByLabelText('Document number'),{target:{value:'SALE-1'}});
 fireEvent.change(screen.getByLabelText('Document description'),{target:{value:'Source service'}});
 fireEvent.change(screen.getByLabelText('Net RSD'),{target:{value:'9007199254740993.01'}});
};
it('saves exact source amounts without sending, approving or marking paid',async()=>{
 const {repo}=setup();await fill();fireEvent.click(screen.getByRole('button',{name:'Save document draft'}));
 await waitFor(()=>expect(repo.documentCommand).toHaveBeenCalledTimes(1));
 const command=repo.documentCommand.mock.calls[0][0];
 expect(command.action).toBe('save');
 if(command.action==='save'){expect(command.data.lines[0].net).toBe('900719925474099301');expect(command.data).not.toHaveProperty('paid');expect(command.data).not.toHaveProperty('delivery');}
 await waitFor(()=>expect(screen.getByLabelText('Document number')).toHaveValue(''));
});
it('retains unknown outcomes and retries the same document key',async()=>{
 const {repo,state}=setup();repo.documentCommand.mockRejectedValueOnce(new AccountingError('unavailable'));await fill();
 fireEvent.click(screen.getByRole('button',{name:'Save document draft'}));
 const retry=await screen.findByRole('button',{name:'Retry the same request'});await waitFor(()=>expect(retry).toBeEnabled());
 expect(screen.getByLabelText('Document number')).toBeDisabled();expect(state).toHaveBeenLastCalledWith(true,true);
 fireEvent.click(retry);await waitFor(()=>expect(screen.getByLabelText('Document number')).toHaveValue(''));
 expect(repo.documentCommand.mock.calls[1][0]).toEqual(repo.documentCommand.mock.calls[0][0]);
});
it('rejects fractional minor units before any command reaches the server',async()=>{
 const {repo}=setup();await fill();fireEvent.change(screen.getByLabelText('Tax RSD'),{target:{value:'1.001'}});fireEvent.click(screen.getByRole('button',{name:'Save document draft'}));
 await screen.findByText('Check the document fields and exact RSD amounts.');expect(repo.documentCommand).not.toHaveBeenCalled();
});
it('blocks stale approval while the edited document reloads and uses the refreshed workflow revision',async()=>{
 const original:BusinessDocument={document:{id:id(4),firmId:id(1),partnerId:id(3),direction:'outgoing',kind:'invoice',referenceId:null,number:'SALE-1',documentDate:'2026-01-01',dueDate:'2026-01-01',description:'Source service',currency:'RSD',lines:[{id:'one',description:'Source service',net:'10001',tax:'0'}]},revision:'1',lifecycle:'draft',partnerName:'Buyer',issuedAt:null,issuedBy:null,workflow:{revision:'1',approval:'pending',delivery:'not_recorded'},payment:'not_tracked',journalId:null};
 const {repo}=setup([original]);await waitFor(()=>expect(screen.getByRole('button',{name:'Edit document draft'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Edit document draft'}));fireEvent.change(screen.getByLabelText('Document description'),{target:{value:'Edited source'}});
 let release!:(documents:BusinessDocument[])=>void;repo.documents.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 fireEvent.click(screen.getByRole('button',{name:'Save document draft'}));await waitFor(()=>expect(repo.documents).toHaveBeenCalledTimes(2));
 expect(screen.getByRole('button',{name:'Approve document'})).toBeDisabled();
 await act(async()=>release([{...original,revision:'2',workflow:{...original.workflow,revision:'2'}}]));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Approve document'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Approve document'}));
 const dialog=await screen.findByRole('alertdialog');await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Confirm'}));});
 expect(repo.documentCommand.mock.calls[1][0]).toMatchObject({action:'approve',expectedRevision:'2'});
});
