import { act,fireEvent,render,screen,within } from '@testing-library/react';
import { FxPanel } from './FxPanel';
import { FeedbackProvider } from '../../ui/Feedback';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import type { FxCommand } from '../../domain/accounting/fx';
import { fxFixture as w,fxEventFixture as event,fxSettlementFixture as payment,fxId as id } from '../../test/fxFixture';
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(10),years:[],capabilities:['post_journal','reverse_journal'],periods:[{id:id(11),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1'}],accounts:[{id:id(4),code:'204.EUR',name:'FX receivable',active:true,allowsPosting:true,requiresPartner:true,validFrom:'2026-01-01',validTo:null},...[[6,'614'],[7,'663'],[8,'563']].map(([n,code])=>({id:id(Number(n)),code:String(code),name:String(code),active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null}))],partners:[{id:id(5),name:'Foreign partner'}],drafts:[],journals:[]};
const setup=(readOnly=false)=>{const repo={fxWorkspace:jest.fn(async()=>w),fxCommand:jest.fn(async(command:FxCommand)=>({positionId:command.data.id})),read:jest.fn(async()=>({draft:{lines:[{accountId:id(4),partnerId:id(5),debit:'20000',credit:'0'},{accountId:id(7),partnerId:null,debit:'0',credit:'20000'}]}}))};const onState=jest.fn();return {repo,onState,...render(<FeedbackProvider><FxPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={readOnly?{...workspace,capabilities:[]}:workspace} disabled={false} onState={onState}/></FeedbackProvider>)};};
const change=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
const fill=()=>{change('Devizni iznos','100.00');change('Devizni partner',id(5));change('Devizno analitičko konto',id(4));change('Protivkonto početnog knjiženja',id(6));change('Kurs RSD','117');change('Izvor kursa','Manual list');change('Dokaz kursa / referenca','Retained 001');};
it('previews exact balanced source lines before posting and retries the identical request after an unknown result',async()=>{
 const {repo,onState}=setup();repo.fxCommand.mockRejectedValueOnce(new AccountingError('unavailable'));fill();fireEvent.click(screen.getByRole('button',{name:'Knjiži deviznu stavku'}));const dialog=await screen.findByRole('alertdialog');expect(within(dialog).getByRole('table',{name:'Pregled deviznog naloga'})).toHaveTextContent('11700.00');expect(repo.fxCommand).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Potvrdi knjiženje'})));expect(screen.getByRole('alert')).toHaveTextContent('Ishod je nepoznat');expect(screen.getByLabelText('Kurs RSD')).toBeDisabled();expect(onState).toHaveBeenLastCalledWith(true,true);
 const sent=repo.fxCommand.mock.calls[0][0];await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Ponovi isti devizni zahtev'})));expect(repo.fxCommand.mock.calls[1][0]).toBe(sent);expect(screen.getByRole('status')).toHaveTextContent('potvrđena');
});
it('reads history for a reader without write controls and blocks independently changed monetary analytics',async()=>{
 const {repo}=setup(true);repo.fxWorkspace.mockResolvedValueOnce({...w,positions:[{...w.positions[0],revision:'2',events:[event],analyticBalance:'1190000',externalMovements:true}]});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne stavke'})));change('Devizna stavka',id(2));expect(screen.getByRole('table',{name:'Istorija kursnih razlika'})).toHaveTextContent('200.00');expect(screen.getByRole('alert')).toHaveTextContent('samostalne promene');expect(screen.queryByRole('button',{name:'Knjiži kursnu razliku'})).not.toBeInTheDocument();
});
it('previews a full reversal from the immutable source without requiring a new rate',async()=>{
 const {repo}=setup();repo.fxWorkspace.mockResolvedValueOnce({...w,positions:[{...w.positions[0],revision:'2',events:[event],analyticBalance:'1190000'}]});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne stavke'})));change('Devizna stavka',id(2));change('Datum deviznog knjiženja','2026-01-16');change('Razlog deviznog storna','Correction');fireEvent.click(screen.getByRole('button',{name:'Storniraj poslednju kursnu razliku'}));const dialog=await screen.findByRole('alertdialog');expect(repo.read).toHaveBeenCalledWith(id(1),id(12));expect(within(dialog).getByRole('table',{name:'Pregled deviznog naloga'})).toHaveTextContent('200.00');await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Potvrdi knjiženje'})));expect(repo.fxCommand).toHaveBeenCalledWith(expect.objectContaining({action:'cancel',data:expect.objectContaining({revaluationId:id(12),expectedRevision:'2'})}));
});
it('shows a liability decrease as a positive income amount while preserving the signed change',async()=>{
 const {repo}=setup();repo.fxWorkspace.mockResolvedValueOnce({...w,positions:[{...w.positions[0],direction:'payable',analyticBalance:'-1170000'}]});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne stavke'})));change('Devizna stavka',id(2));change('Kurs RSD','116');
 expect(screen.getByText('RSD vrednost: 11600.00 · Prihod: 100.00')).toBeInTheDocument();
 expect(repo.fxCommand).not.toHaveBeenCalled();
});
it('previews a partial payment with its bank identity and retries the same three-line journal',async()=>{
 const {repo,onState}=setup();repo.fxCommand.mockRejectedValueOnce(new AccountingError('unavailable'));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne stavke'})));change('Devizna stavka',id(2));change('Devizna radnja','payment');
 change('Plaćeni devizni iznos','40.00');change('Konto novca za devizno plaćanje',id(6));change('Konto pozitivnih kursnih razlika',id(7));change('Konto negativnih kursnih razlika',id(8));change('Račun izvora deviznog plaćanja','rs35 160-0001');change('ID devizne bankarske transakcije','PAY-001');change('Kurs RSD','120');change('Izvor kursa','Manual list');change('Dokaz kursa / referenca','Payment list');
 fireEvent.click(screen.getByRole('button',{name:'Knjiži devizno plaćanje'}));const dialog=await screen.findByRole('alertdialog'),table=within(dialog).getByRole('table',{name:'Pregled deviznog naloga'});
 expect(table).toHaveTextContent('4800.00');expect(table).toHaveTextContent('4680.00');expect(table).toHaveTextContent('120.00');expect(dialog).toHaveTextContent('RS351600001');expect(repo.fxCommand).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Potvrdi knjiženje'})));expect(onState).toHaveBeenLastCalledWith(true,true);expect(screen.getByLabelText('Plaćeni devizni iznos')).toBeDisabled();
 const sent=repo.fxCommand.mock.calls[0][0];expect(sent).toMatchObject({action:'settle',data:{foreignMinor:'4000',currency:'EUR',sourceId:'PAY-001',sourceAccount:'RS351600001'}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Ponovi isti devizni zahtev'})));expect(repo.fxCommand.mock.calls[1][0]).toBe(sent);
});
it('shows remaining principal and restores a payment through its immutable original journal',async()=>{
 const {repo}=setup();repo.fxWorkspace.mockResolvedValueOnce({...w,positions:[{...w.positions[0],revision:'2',settlements:[payment],analyticBalance:'702000'}]});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Učitaj devizne stavke'})));change('Devizna stavka',id(2));expect(screen.getByText(/Preostalo 60.00 EUR/)).toBeInTheDocument();expect(screen.getByRole('table',{name:'Istorija deviznih plaćanja'})).toHaveTextContent('FX-PAY-001');
 change('Datum deviznog knjiženja','2026-01-16');change('Razlog deviznog storna','Payment correction');fireEvent.click(screen.getByRole('button',{name:'Storniraj poslednje devizno plaćanje'}));const dialog=await screen.findByRole('alertdialog');expect(repo.read).toHaveBeenCalledWith(id(1),payment.journalId);
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'Potvrdi knjiženje'})));expect(repo.fxCommand).toHaveBeenCalledWith(expect.objectContaining({action:'cancel_settlement',data:expect.objectContaining({settlementId:payment.id,expectedRevision:'2'})}));
});
