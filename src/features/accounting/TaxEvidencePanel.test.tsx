import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FeedbackProvider} from '../../ui/Feedback';
import {TaxEvidencePanel} from './TaxEvidencePanel';
import {AccountingError,type SupabaseAccountingRepository} from '../../infrastructure/accountingRepository';
import {taxFixture,taxId} from '../../test/taxEvidenceFixture';
import type {TaxCommand} from '../../domain/accounting/taxEvidence';
import type {AccountingWorkspace} from '../../domain/accounting/commands';
const workspace={firmId:taxId(1),yearId:taxId(2),capabilities:['post_journal','manage_periods','reverse_journal'],years:[],accounts:[],partners:[],drafts:[],journals:[],periods:[{id:taxId(7),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1'}]} as AccountingWorkspace;
const setup=(lost=false,capabilities=workspace.capabilities)=>{
 const w=taxFixture();w.events=[];w.revision='1';let drop=lost;
 const repo={taxWorkspace:jest.fn(async()=>w),taxCommand:jest.fn(async(c:TaxCommand)=>{if(drop){drop=false;throw new AccountingError('unavailable');}return {firmId:c.data.firmId,id:c.data.id,action:c.action,revision:'2'};})};
 const onState=jest.fn();render(<FeedbackProvider><TaxEvidencePanel repo={repo as unknown as SupabaseAccountingRepository} workspace={{...workspace,capabilities}} disabled={false} onState={onState}/></FeedbackProvider>);
 return {repo,onState,w};
};
const fill=async()=>{
 fireEvent.click(screen.getByRole('button',{name:'Učitaj PDV evidenciju'}));await screen.findByText('Revizija PDV evidencije: 1');
 fireEvent.click(screen.getByRole('button',{name:'Unos poreskog događaja'}));
 fireEvent.change(screen.getByLabelText('PDV izvorni dokument'),{target:{value:taxId(4)}});
 fireEvent.change(screen.getByLabelText('PDV profil događaja'),{target:{value:taxId(3)}});
 fireEvent.change(screen.getByLabelText('Knjigovodstveni period PDV događaja'),{target:{value:taxId(7)}});
 fireEvent.change(screen.getByLabelText('Dokaz poreskog događaja'),{target:{value:'Ordinary domestic service proof'}});
 fireEvent.click(screen.getByRole('checkbox'));
};
it('freezes unknown outcomes and retries the exact original tax payload/key',async()=>{
 const {repo,onState}=setup(true);await fill();fireEvent.click(screen.getByRole('button',{name:'Potvrdi poreski događaj'}));
 fireEvent.click(await screen.findByRole('button',{name:'Potvrdi PDV radnju'}));
 await screen.findByText(/Ishod PDV radnje je nepoznat/);
 expect(screen.getByLabelText('Dokaz poreskog događaja')).toBeDisabled();expect(onState).toHaveBeenLastCalledWith(true,true);
 const original=repo.taxCommand.mock.calls[0][0];fireEvent.click(screen.getByRole('button',{name:'Ponovi isti PDV zahtev'}));
 await screen.findByText('PDV radnja je potvrđena.');expect(repo.taxCommand.mock.calls[1][0]).toBe(original);await waitFor(()=>expect(onState).toHaveBeenLastCalledWith(false,false));
});
it('refuses unconfirmed supply and keeps form input on validation failure',async()=>{
 const {repo}=setup();await fill();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Potvrdi poreski događaj'}));
 await screen.findByRole('alert');expect(repo.taxCommand).not.toHaveBeenCalled();expect(screen.getByLabelText('Dokaz poreskog događaja')).toHaveValue('Ordinary domestic service proof');
});
it('offers read-only profiles/reports without mutation controls and exposes uncovered sources',async()=>{
 setup(false,[]);fireEvent.click(screen.getByRole('button',{name:'Učitaj PDV evidenciju'}));await screen.findByText('Revizija PDV evidencije: 1');
 expect(screen.queryByRole('button',{name:'Sačuvaj PDV profil'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Unos poreskog događaja'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('PDV kontrola od'),{target:{value:'2026-01-01'}});fireEvent.change(screen.getByLabelText('PDV kontrola do'),{target:{value:'2026-01-31'}});
 expect(screen.getByText(/Nepokrivenih dokumenata: 1/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Izvezi internu PDV kontrolu'})).toBeDisabled();
});
it('confirms the dated ending of a used profile and retries an unknown outcome with unchanged proof',async()=>{
 const {repo,w}=setup(true);w.events=taxFixture().events;
 fireEvent.click(screen.getByRole('button',{name:'Učitaj PDV evidenciju'}));await screen.findByText('Revizija PDV evidencije: 1');
 expect(screen.getByRole('button',{name:'Poništi PDV profil'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText(/PDV profil završava zaključno sa/),{target:{value:'2026-11-30'}});
 fireEvent.change(screen.getByLabelText('Razlog poništenja PDV evidencije'),{target:{value:'Registration evidence for dated status change'}});
 fireEvent.click(screen.getByRole('button',{name:'Završi PDV profil'}));
 await screen.findByText(/završava 2026-11-30/);expect(repo.taxCommand).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Potvrdi PDV radnju'}));await screen.findByText(/Ishod PDV radnje je nepoznat/);
 expect(screen.getByLabelText(/PDV profil završava zaključno sa/)).toBeDisabled();
 const original=repo.taxCommand.mock.calls[0][0];expect(original).toMatchObject({action:'end_profile',data:{id:taxId(3),endsOn:'2026-11-30',reason:'Registration evidence for dated status change'}});
 fireEvent.click(screen.getByRole('button',{name:'Ponovi isti PDV zahtev'}));await screen.findByText('PDV radnja je potvrđena.');expect(repo.taxCommand.mock.calls[1][0]).toBe(original);
});
