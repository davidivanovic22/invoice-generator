import { act,fireEvent,render,screen,within } from '@testing-library/react';
import { PartnerReportsPanel } from './PartnerReportsPanel';
import type { SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { partnerReportFixture as r,partnerReportId as id } from '../../test/partnerReportFixture';
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(5),years:[],capabilities:[],periods:[],accounts:[],partners:[{id:id(2),name:'=Buyer'}],drafts:[],journals:[]};
const setup=()=>{const repo={partnerReport:jest.fn(async()=>r)};return {repo,...render(<PartnerReportsPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={workspace} disabled={false}/>)};};
const load=async()=>{await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Učitaj analitiku partnera'}));});};
it('lets a reader inspect cards, aging excluding advances, and explicit document/manual differences',async()=>{
 const {repo}=setup();await load();expect(repo.partnerReport).toHaveBeenCalledWith({firmId:id(1),partnerId:null});expect(screen.getByRole('table',{name:'Kartica partnera'})).toHaveTextContent('81.00');
 fireEvent.change(screen.getByLabelText('Pregled analitike'),{target:{value:'aging'}});expect(screen.getByRole('table',{name:'Starosna struktura računa'})).toHaveTextContent('82.00');expect(screen.getByRole('table',{name:'Avansi odvojeno'})).toHaveTextContent('40.01');
 fireEvent.change(screen.getByLabelText('Pregled analitike'),{target:{value:'control'}});const controls=screen.getByRole('table',{name:'Kontrola računa'});expect(controls).toHaveTextContent('Nedostaje analitičko knjiženje');expect(controls).toHaveTextContent('-2.00');expect(screen.getByRole('table',{name:'Kontrola konta partnera'})).toHaveTextContent('1.00');
 fireEvent.click(within(screen.getByRole('table',{name:'Kontrola konta partnera'})).getByRole('button',{name:'204 · Buyer account'}));expect(screen.getByRole('table',{name:'Kartica partnera'})).toBeInTheDocument();expect(repo.partnerReport).toHaveBeenCalledTimes(1);
});
it('clears old exports when scope changes and exposes a failed read without a previous snapshot',async()=>{
 const {repo}=setup();await load();expect(screen.getByRole('button',{name:'Izvezi analitiku Excel'})).toBeEnabled();fireEvent.change(screen.getByLabelText('Obuhvat partnera'),{target:{value:id(2)}});expect(screen.queryByRole('button',{name:'Izvezi analitiku Excel'})).not.toBeInTheDocument();repo.partnerReport.mockRejectedValueOnce(new Error('forbidden'));await load();expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('does not retain a response after the firm context unmounts',async()=>{
 const {repo,unmount}=setup();let resolve!:(v:typeof r)=>void;repo.partnerReport.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));fireEvent.click(screen.getByRole('button',{name:'Učitaj analitiku partnera'}));unmount();await act(async()=>resolve(r));expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('does not declare a zero net difference reconciled when source evidence remains unposted',async()=>{
 const {repo}=setup();repo.partnerReport.mockResolvedValueOnce({...r,documents:[{...r.documents[0],unpostedEvidenceCount:'2'}]});await load();fireEvent.change(screen.getByLabelText('Pregled analitike'),{target:{value:'control'}});expect(screen.getByRole('table',{name:'Kontrola računa'})).toHaveTextContent('Neusaglašeni izvori: 2');expect(screen.queryByText('Usklađeno u ovom obuhvatu')).not.toBeInTheDocument();
});
