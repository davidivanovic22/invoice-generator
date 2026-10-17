import { act,fireEvent,render,screen,within } from '@testing-library/react';
import { FxBankPostingPanel } from './FxBankPostingPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { fxBankUnposted,fxBankPosted,fxBankAllocated } from '../../test/fxBankPostingFixture';
import { fxId as id } from '../../test/fxFixture';
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(10),years:[],capabilities:['post_journal','reverse_journal'],periods:[{id:id(11),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1'}],accounts:[6,7,8,22].map(n=>({id:id(n),code:String(n),name:String(n),active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null})),partners:[{id:id(5),name:'Foreign partner'}],drafts:[],journals:[]};
const setup=(w=fxBankUnposted,reader=false)=>{const repo={fxBankWorkbench:jest.fn(async()=>w),fxBankPostingCommand:jest.fn(async(_c:unknown)=>({})),read:jest.fn()};const onBusy=jest.fn(),onClose=jest.fn();render(<FeedbackProvider><FxBankPostingPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={reader?{...workspace,capabilities:[]}:workspace} transactionId={id(20)} accountId={id(21)} disabled={false} onBusy={onBusy} onClose={onClose}/></FeedbackProvider>);return {repo,onBusy,onClose};};
const change=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
it('previews a source and freezes the same request and context after a lost response',async()=>{
 const {repo,onBusy,onClose}=setup();repo.fxBankPostingCommand.mockRejectedValueOnce(new AccountingError('unavailable'));await screen.findByLabelText('Kurs bankarskog izvora RSD');
 change('Prelazni konto devizne banke',id(6));change('Kurs bankarskog izvora RSD','120');change('Izvor kursa banke','Manual list');change('Dokaz kursa banke','Retained proof');
 fireEvent.click(screen.getByRole('button',{name:'Knjiži bankarski izvor'}));const dialog=await screen.findByRole('alertdialog');expect(within(dialog).getByRole('table',{name:'Pregled bankarskog deviznog naloga'})).toHaveTextContent('12000.00');expect(repo.fxBankPostingCommand).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Potvrdi bankarski nalog'})));expect(screen.getByRole('alert')).toHaveTextContent('nepoznat');expect(onBusy).toHaveBeenLastCalledWith(true);expect(screen.getByRole('button',{name:'Zatvori bankarsku raspodelu'})).toBeDisabled();expect(onClose).not.toHaveBeenCalled();
 const sent=repo.fxBankPostingCommand.mock.calls[0][0];await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Ponovi isti bankarski nalog'})));expect(repo.fxBankPostingCommand.mock.calls[1][0]).toBe(sent);
});
it('shows clearing remainder and previews allocation without another cash line',async()=>{
 setup(fxBankPosted);await screen.findByText(/Neraspoređeno: 100.00 EUR/);change('Devizni iznos raspodele','40');change('Stavka bankarske raspodele',id(2));change('Pozitivne razlike bankarske raspodele',id(7));change('Negativne razlike bankarske raspodele',id(8));fireEvent.click(screen.getByRole('button',{name:'Raspodeli devizno plaćanje'}));
 const dialog=await screen.findByRole('alertdialog'),table=within(dialog).getByRole('table');expect(table).toHaveTextContent('4800.00');expect(table).toHaveTextContent('4680.00');expect(within(table).queryByRole('cell',{name:'22'})).not.toBeInTheDocument();
});
it('lets readers inspect the attributed clearing balance and immutable history without mutating',async()=>{
 setup(fxBankAllocated,true);await screen.findByText(/Neraspoređeno: 60.00 EUR/);expect(screen.getByRole('table',{name:'Istorija bankarske devizne raspodele'})).toHaveTextContent('4800.00');expect(screen.queryByRole('button',{name:'Raspodeli devizno plaćanje'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Storniraj raspodelu'})).not.toBeInTheDocument();
});
