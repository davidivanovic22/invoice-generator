import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { getCloudState, signIn, signOut, startCloud, subscribeCloud, usernameAvailable, type CloudState } from './lib/cloud';
import { disableDatabaseMode, replaceDatabaseData, readRaw } from './lib/storage';

jest.mock('./lib/cloud', () => ({
  ...jest.requireActual('./lib/cloud'),
  readCloudConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'test-public-key' }),
  getCloudState: jest.fn(),
  subscribeCloud: jest.fn(),
  startCloud: jest.fn(async () => undefined),
  signIn: jest.fn(),
  signOut: jest.fn(),
  sendSignInLink: jest.fn(),
  usernameAvailable: jest.fn(async () => true),
  getAccountProfile: jest.fn(async () => ({ firstName: '', lastName: '', username: '', phone: '' }))
}));

configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(30000);

let state: CloudState;
let listeners: Set<(value: CloudState) => void>;
const publish = (patch: Partial<CloudState>) => {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener(state));
};

beforeEach(() => {
  jest.clearAllMocks();
  (usernameAvailable as jest.Mock).mockResolvedValue(true);
  state = { status: 'signed-out', email: null, lastSync: null, error: null, choice: null, dataReady: false, dataRevision: 0 };
  listeners = new Set();
  (startCloud as jest.Mock).mockResolvedValue(undefined);
  (getCloudState as jest.Mock).mockImplementation(() => state);
  (subscribeCloud as jest.Mock).mockImplementation(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  (signIn as jest.Mock).mockImplementation(async () => {
    publish({ email: 'reader@example.com', status: 'synced', dataReady: true });
    return 'signed-in';
  });
  (signOut as jest.Mock).mockImplementation(async () => publish({ email: null, status: 'signed-out', dataReady: false }));
  localStorage.setItem('studio.lock', JSON.stringify({ salt: 'old-salt', hash: 'old-hash', name: 'Old browser lock', autoLockMinutes: 15 }));
  localStorage.setItem('studio.lang', 'en');
  localStorage.setItem('studio.onboarded', '1');
});

test('registration validates confirmation and passes personal details without creating a firm', async () => {
  window.history.replaceState({}, '', '/login');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Example ' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: ' Person ' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'Example_User' } });
  fireEvent.change(screen.getByLabelText('Phone number (optional)'), { target: { value: '+381 60 1234567' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'example@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'example-password' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'example-password' } });
  (signIn as jest.Mock).mockResolvedValueOnce('confirm-email');
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await screen.findByText('Check your email and confirm the address, then sign in.');
  expect(usernameAvailable).toHaveBeenCalledWith('Example_User');
  expect(signIn).toHaveBeenCalledWith('example@example.test', 'example-password', 'sign-up', {
    firstName: 'Example', lastName: 'Person', username: 'example_user', phone: '+381 60 1234567'
  });
});

test('changing UI language preserves hydrated database data', async () => {
  const data = { 'studio.resumes.v2': { version: 2, resumes: [] }, 'studio.invoices.v2@cache-test': { signature: 'saved', count: 12 } };
  replaceDatabaseData(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)])));
  state = { ...state, email: 'reader@example.com', status: 'synced', dataReady: true };
  window.history.replaceState({}, '', '/firms');
  render(<App />);
  await screen.findByRole('banner');
  fireEvent.click(screen.getAllByRole('radio', { name: 'sr' })[0]);
  await waitFor(() => expect(readRaw('studio.invoices.v2@cache-test')).toBe(JSON.stringify(data['studio.invoices.v2@cache-test'])));
  fireEvent.click(screen.getAllByRole('radio', { name: 'en' })[0]);
});

afterEach(() => disableDatabaseMode());

test.each(['/account', '/invoices/private-document', '/firms'])('signed-out visit to %s opens login without the application shell', async path => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  expect(screen.queryByText('Automatic backup')).not.toBeInTheDocument();
});

test('password login opens the application and logout returns to the standalone login page', async () => {
  window.history.replaceState({}, '', '/login');
  render(<App />);
  await screen.findByRole('heading', { name: 'Sign in' });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'example-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());
  expect(signIn).toHaveBeenCalledWith('reader@example.com', 'example-password', 'sign-in');
  fireEvent.click(screen.getByTitle('Account'));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe('/login'));
});
