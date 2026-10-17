import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../../ui/Feedback';
import { LanguageProvider } from '../../i18n';
import { AccountingError, type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { AccountingWorkspacePage } from './AccountingPage';
import type { SaveDraftCommand } from '../../domain/accounting/commands';

jest.setTimeout(15000); // Multiple async UI transitions also run on busy CI workers.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context = (firmId = id(1), yearId: string | null = id(3), capabilities = ['post_journal']) => ({ firmId,yearId,capabilities,
  years:[{ id:id(3),label:2026,startsOn:'2026-01-01',endsOn:'2026-12-31' }],periods:[{ id:id(4),startsOn:'2026-01-01',endsOn:'2026-01-31',status:'open',revision:'1' }],
  accounts:[{ id:id(5),code:'204',name:'Receivable',active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null },{ id:id(6),code:'614',name:'Income',active:true,allowsPosting:true,requiresPartner:false,validFrom:'2026-01-01',validTo:null }],partners:[],drafts:[],journals:[] });
const setup = (capabilities = ['post_journal']) => {
  localStorage.setItem('studio.lang','en');
  let counter = 10;
  Object.defineProperty(global.crypto,'randomUUID',{ configurable:true,value:jest.fn(() => id(counter++)) });
  const repo = {
    documents:jest.fn(async()=>[]),
    bankWorkspace:jest.fn(async(firm:string,year:string)=>({firmId:firm,yearId:year,accounts:[],statements:[]})),
    firms:jest.fn(async () => [{ id:id(1),name:'First firm',taxId:'111' },{ id:id(2),name:'Second firm',taxId:'222' }]),
    workspace:jest.fn(async (firm: string,year: string | null) => context(firm,year,capabilities)),
    saveDraft:jest.fn(async (command: SaveDraftCommand) => ({ firmId:command.draft.firmId,draftId:command.draft.id,revision:'1',savedAt:'2026-01-01T00:00:00Z',savedBy:id(9) })),
    post:jest.fn(async () => ({ ok:true,receipt:{ firmId:id(1),journalId:id(10),revision:'1',number:'2026/000001',postedAt:'2026-01-01T00:00:00Z',postedBy:id(9) } }))
  };
  render(<MemoryRouter initialEntries={['/accounting']}><LanguageProvider><FeedbackProvider><AccountingWorkspacePage repo={repo as unknown as SupabaseAccountingRepository} /></FeedbackProvider></LanguageProvider></MemoryRouter>);
  return repo;
};
const start = async () => {
  await waitFor(() => expect(screen.getByRole('button',{ name:'New journal' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{ name:'New journal' }));
  await screen.findByLabelText('Ledger account 1');
  fireEvent.change(screen.getByLabelText('Ledger account 1'),{ target:{ value:id(5) } });
  fireEvent.change(screen.getByLabelText('Ledger account 2'),{ target:{ value:id(6) } });
  fireEvent.change(screen.getByLabelText('Debit RSD 1'),{ target:{ value:'9007199254740993.01' } });
  fireEvent.change(screen.getByLabelText('Credit RSD 2'),{ target:{ value:'9007199254740993.01' } });
};
it('preserves the loaded workspace and unsent journal when the current year is selected again',async()=>{
 const repo=setup();await start();const reads=repo.workspace.mock.calls.length;
 fireEvent.change(screen.getByLabelText('Fiscal year'),{target:{value:id(3)}});
 expect(screen.getByLabelText('Debit RSD 1')).toHaveValue('9007199254740993.01');expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();expect(repo.workspace).toHaveBeenCalledTimes(reads);
});
it('clears discarded migration input when switching to a firm without a fiscal year',async()=>{
 const repo=setup(['post_journal','manage_periods']);repo.workspace.mockImplementation(async(firm,year)=>firm===id(2)?{...context(firm,year,['post_journal','manage_periods']),years:[],periods:[]}:context(firm,year,['post_journal','manage_periods']));
 await waitFor(()=>expect(screen.getByRole('button',{name:'New journal'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Excel početnog stanja'),{target:{files:[new File(['invalid'],'bad.xlsx')]}});
 await screen.findByText(/Fajl nije važeći/);await waitFor(()=>expect(screen.getByLabelText('Accounting firm')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Accounting firm'),{target:{value:id(2)}});fireEvent.click(await screen.findByRole('button',{name:'Discard changes'}));
 await screen.findByText(/Second firm.*No fiscal year/);fireEvent.click(await screen.findByText('Years, periods and chart of accounts'));expect(screen.getByRole('button',{name:'Create year'})).toBeEnabled();
});
it('saves exact amounts and requires explicit confirmation to post a saved draft', async () => {
  const repo=setup(); await start();
  expect(screen.getByRole('button',{ name:'Post journal' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{ name:'Save draft' }));
  await screen.findByText('Draft saved to the server.');
  expect(repo.saveDraft.mock.calls[0][0].draft.lines[0].debit).toBe('900719925474099301');
  await waitFor(() => expect(screen.getByRole('button',{ name:'Post journal' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{ name:'Post journal' }));
  await screen.findByRole('alertdialog');
  expect(repo.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button',{ name:'Post journal' }).slice(-1)[0]);
  await screen.findByText('Journal posted. Changes now require a reversal.');
  expect(screen.getByText(/Posted — read only.*Revision 1/)).toBeInTheDocument();
  expect(screen.getByLabelText('Debit RSD 1')).toBeDisabled();
});
it('keeps unsaved input when switching firm is cancelled and clears it after confirmation', async () => {
  setup(); await start();
  fireEvent.change(screen.getByLabelText('Accounting firm'),{ target:{ value:id(2) } });
  await screen.findByRole('alertdialog');
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{ name:'Cancel' }));
  expect(screen.getByLabelText('Accounting firm')).toHaveValue(id(1));
  expect(screen.getByLabelText('Debit RSD 1')).toHaveValue('9007199254740993.01');
  fireEvent.change(screen.getByLabelText('Accounting firm'),{ target:{ value:id(2) } });
  fireEvent.click(await screen.findByRole('button',{ name:'Discard changes' }));
  await waitFor(() => expect(screen.getByLabelText('Accounting firm')).toHaveValue(id(2)));
  expect(screen.queryByLabelText('Debit RSD 1')).not.toBeInTheDocument();
});
it('freezes unknown save outcomes and retries the original key and payload', async () => {
  const repo=setup(); repo.saveDraft.mockRejectedValueOnce(new AccountingError('unavailable')); await start();
  fireEvent.click(screen.getByRole('button',{ name:'Save draft' }));
  await screen.findByRole('button',{ name:'Retry the same request' });
  await waitFor(() => expect(screen.getByRole('button',{ name:'Retry the same request' })).toBeEnabled());
  expect(screen.getByLabelText('Accounting firm')).toBeDisabled();
  expect(screen.getByLabelText('Debit RSD 1')).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{ name:'Retry the same request' }));
  await screen.findByText('Draft saved to the server.');
  expect(repo.saveDraft.mock.calls[1][0]).toEqual(repo.saveDraft.mock.calls[0][0]);
});
it('keeps a stale save editable and preserves the unsent amounts', async () => {
  const repo=setup(); repo.saveDraft.mockRejectedValueOnce(new AccountingError('stale_revision')); await start();
  fireEvent.click(screen.getByRole('button',{ name:'Save draft' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Debit RSD 1')).toHaveValue('9007199254740993.01');
  expect(screen.getByLabelText('Debit RSD 1')).toBeEnabled();
  expect(screen.queryByRole('button',{ name:'Retry the same request' })).not.toBeInTheDocument();
});
it('keeps a viewer from creating journals or changing the chart', async () => {
  setup([]);
  await screen.findByText('Read only. Posting requires an explicit accounting permission.');
  expect(screen.getByRole('button',{ name:'New journal' })).toBeDisabled();
  expect(screen.queryByRole('button',{ name:'Create ledger account' })).not.toBeInTheDocument();
});
