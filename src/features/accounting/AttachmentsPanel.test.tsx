import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { AttachmentsPanel } from './AttachmentsPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AttachmentCommand } from '../../domain/accounting/attachments';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const setup=(canWrite=true)=>{
 Object.defineProperty(global.crypto,'randomUUID',{configurable:true,value:()=>id(4)});
 Object.defineProperty(global.crypto,'subtle',{configurable:true,value:{digest:jest.fn(async()=>new Uint8Array(32).fill(10).buffer)}});
 const repo={attachments:jest.fn(async()=>({firmId:id(1),targetType:'document',targetId:id(2),attachments:[]})),attachmentCommand:jest.fn(async(c:AttachmentCommand)=>({firmId:id(1),attachmentId:c.data.id,targetType:'document',targetId:id(2),revision:'1'}))};
 const onBusy=jest.fn(),onClose=jest.fn();
 render(<FeedbackProvider><AttachmentsPanel repo={repo as unknown as SupabaseAccountingRepository} firmId={id(1)} targetType="document" targetId={id(2)} targetRevision="3" title="INV-1" canWrite={canWrite} disabled={false} onBusy={onBusy} onClose={onClose}/></FeedbackProvider>);
 return {repo,onBusy,onClose};
};
const select=async()=>{
 await waitFor(()=>expect(screen.getByLabelText('Original attachment file')).toBeEnabled());
 const file=new File(['abc'],'source.pdf');Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([97,98,99]).buffer});
 fireEvent.change(screen.getByLabelText('Original attachment file'),{target:{files:[file]}});
 await screen.findByText(/source.pdf/);fireEvent.change(screen.getByLabelText('External archive reference'),{target:{value:'Archive 2026'}});
};
it('reviews actual file metadata, blocks closing during confirmation and supports cancelling without a write',async()=>{
 const {repo,onBusy}=setup();await select();fireEvent.click(screen.getByRole('button',{name:'Register attachment'}));
 const dialog=await screen.findByRole('alertdialog');expect(dialog).toHaveTextContent('source.pdf');expect(dialog).toHaveTextContent('3 bytes');expect(dialog).toHaveTextContent('Archive 2026');
 expect(screen.getByRole('button',{name:'Close attachment register'})).toBeDisabled();expect(onBusy).toHaveBeenLastCalledWith(true);
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));});
 expect(repo.attachmentCommand).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Close attachment register'})).toBeEnabled();
});
it('freezes an unknown outcome and retries the original target, revision, metadata and key',async()=>{
 const {repo,onBusy}=setup();repo.attachmentCommand.mockRejectedValueOnce(new AccountingError('unavailable'));await select();
 fireEvent.click(screen.getByRole('button',{name:'Register attachment'}));const dialog=await screen.findByRole('alertdialog');
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Confirm'}));});
 expect(screen.getByLabelText('External archive reference')).toBeDisabled();expect(screen.getByRole('button',{name:'Close attachment register'})).toBeDisabled();expect(onBusy).toHaveBeenLastCalledWith(true);
 expect(repo.attachmentCommand.mock.calls[0][0]).toMatchObject({action:'register',idempotencyKey:id(4),data:{firmId:id(1),targetId:id(2),targetRevision:'3',name:'source.pdf',bytes:'3',sha256:'0a'.repeat(32),externalReference:'Archive 2026'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry the same request'}));});
 expect(repo.attachmentCommand.mock.calls[1][0]).toEqual(repo.attachmentCommand.mock.calls[0][0]);
});
it('lets a reader inspect the registry without registration controls',async()=>{
 const {repo}=setup(false);await waitFor(()=>expect(repo.attachments).toHaveBeenCalled());expect(screen.queryByLabelText('Original attachment file')).not.toBeInTheDocument();expect(screen.getByText(/does not upload or back up/)).toBeInTheDocument();
});
