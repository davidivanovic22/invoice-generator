import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { allowFolder, folderState, runDailyBackup, writeFolderBackup } from '../../lib/backup';
import { AutoBackup } from './AutoBackup';

jest.mock('../../i18n', () => ({ t: (value: string) => value }));
jest.mock('../../lib/backup', () => ({
  allowFolder: jest.fn(), folderState: jest.fn(), runDailyBackup: jest.fn(), writeFolderBackup: jest.fn()
}));

const success = { snapshot: null, snapshotError: false, folderWritten: true, folderError: false };

beforeEach(() => {
  jest.resetAllMocks();
  (runDailyBackup as jest.Mock).mockResolvedValue(success);
  (folderState as jest.Mock).mockResolvedValue({ name: 'Backup', permission: 'prompt', lastWrite: null });
  (allowFolder as jest.Mock).mockResolvedValue('granted');
});

it('keeps a visible error after an approved folder fails and offers a successful retry', async () => {
  (writeFolderBackup as jest.Mock).mockRejectedValue(new Error('Disk full'));
  render(<MemoryRouter><AutoBackup /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Automatic backup failed');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(runDailyBackup).toHaveBeenCalledTimes(2);
});

it('does not dismiss a false write result as success', async () => {
  (writeFolderBackup as jest.Mock).mockResolvedValue(false);
  render(<MemoryRouter><AutoBackup /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

it('shows browser backup failures even without a configured folder', async () => {
  (runDailyBackup as jest.Mock).mockResolvedValue({ ...success, snapshotError: true });
  (folderState as jest.Mock).mockResolvedValue(null);
  render(<MemoryRouter><AutoBackup /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Automatic backup failed');
});
