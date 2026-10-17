import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { ReportsPanel } from './ReportsPanel';
import type { SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { reportFixture as r,reportId as id } from '../../test/accountingReportFixture';
const workspace:AccountingWorkspace={firmId:id(1),yearId:id(2),years:[{id:id(2),label:2026,startsOn:'2026-01-01',endsOn:'2026-12-31'}],capabilities:[],periods:[],accounts:[],partners:[],drafts:[],journals:[]};
const setup=()=>{const repo={report:jest.fn(async()=>r)};const view=render(<ReportsPanel repo={repo as unknown as SupabaseAccountingRepository} workspace={workspace} disabled={false}/>);return {repo,...view};};
const load=async()=>{fireEvent.change(screen.getByLabelText('Report from'),{target:{value:r.from}});fireEvent.change(screen.getByLabelText('Report to'),{target:{value:r.to}});await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Load reports'}));});};
it('supports trial-to-ledger-to-journal drill-down from the same validated snapshot for a reader',async()=>{
 const {repo}=setup();await load();expect(repo.report).toHaveBeenCalledWith({firmId:id(1),yearId:id(2),from:r.from,to:r.to});
 const trial=screen.getByRole('table',{name:'Trial balance'});expect(trial).toHaveTextContent('130.02');
 fireEvent.click(within(trial).getByRole('button',{name:'204 · Receivable'}));expect(screen.getByRole('table',{name:'Ledger entries'})).toHaveTextContent('140.02');
 fireEvent.click(screen.getByRole('button',{name:'2026/5'}));
 expect(screen.getByRole('table',{name:'Journal lines'})).toHaveTextContent('100.01');expect(repo.report).toHaveBeenCalledTimes(1);
});
it('clears exportable data on changed dates and blocks invalid date ranges',async()=>{
 setup();await load();expect(screen.getByRole('button',{name:'Export report Excel'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Report from'),{target:{value:'2026-02-01'}});expect(screen.queryByRole('button',{name:'Export report Excel'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Load reports'})).toBeDisabled();
});
it('shows read errors without retaining an older export and ignores responses after context unmount',async()=>{
 const {repo,unmount}=setup();repo.report.mockRejectedValueOnce(new Error('forbidden'));await load();expect(screen.getByRole('alert')).toHaveTextContent('could not be verified');expect(screen.queryByRole('table')).not.toBeInTheDocument();
 let resolve!:(v:typeof r)=>void;repo.report.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));fireEvent.click(screen.getByRole('button',{name:'Load reports'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Load reports'})).toBeDisabled());unmount();await act(async()=>{resolve(r);});
});
