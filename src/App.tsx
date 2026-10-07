import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AccountGate, useAccount } from './features/account/AccountGate';
import { LoginPage } from './features/account/LoginPage';
import { AccountPage } from './features/account/AccountPage';
import { AutoBackup } from './features/account/AutoBackup';
import { CloudChoiceDialog, CloudDot, CloudNoticeBanner, statusLabel, useCloud } from './features/account/CloudSection';
import { readCloudConfig, signOut, startCloud } from './lib/cloud';
import { isDatabaseMode, replaceDatabaseData } from './lib/storage';
import { AiProvider, useAi } from './features/ai/AiSettings';
import { FirmProvider, useFirm } from './features/firms/FirmContext';
import { FirmsPage } from './features/firms/FirmsPage';
import { HistoryPage } from './features/firms/HistoryPage';
import { LegalPage } from './features/legal/LegalPage';
import { FirmSwitcher } from './features/firms/FirmSwitcher';
import { CommandPalette, useCommandShortcut } from './features/command/CommandPalette';
import { HomePage } from './features/home/HomePage';
import { InvoiceEditorPage } from './features/invoices/pages/InvoiceEditorPage';
import { InvoiceListPage } from './features/invoices/pages/InvoiceListPage';
import { InvoiceStoreProvider, useInvoiceStore } from './features/invoices/store';
import { KpoPage } from './features/kpo/KpoPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { KpoStoreProvider } from './features/kpo/store';
import { Onboarding } from './features/onboarding/Onboarding';
import { ProfilePage } from './features/profile/ProfilePage';
import { ResumeEditorPage } from './features/resumes/pages/ResumeEditorPage';
import { ResumeListPage } from './features/resumes/pages/ResumeListPage';
import { ResumeStoreProvider } from './features/resumes/store';
import { LanguageProvider, t, useLanguage } from './i18n';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { FeedbackProvider, useFeedback } from './ui/Feedback';
import { Icon } from './ui/Icon';
import { saveTheme } from './ui/theme';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

const AiStatus = () => {
  const { hasKey, openSettings } = useAi();
  return (
    <button
      type="button"
      onClick={openSettings}
      className="relative flex items-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
      title={hasKey ? t('Eden AI is connected') : t('Connect Eden AI')}
      aria-label={hasKey ? t('Eden AI is connected') : t('Connect Eden AI')}
    >
      <Icon name="sparkle" />
      <span className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-white ${hasKey ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    </button>
  );
};

const LanguageSwitch = () => {
  const { lang, setLang } = useLanguage();
  return (
    <div className="hidden items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold sm:flex" role="radiogroup" aria-label={t('Language')}>
      {(['sr', 'en'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={lang === value}
          onClick={() => setLang(value)}
          className={`rounded-md px-2 py-1 uppercase transition ${lang === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
};

const LogoutButton = ({ className, role, onClose }: { className: string; role?: 'menuitem'; onClose: () => void }) => {
  const cloud = useCloud();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!cloud.email) return null;
  return (
    <button
      type="button"
      role={role}
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          onClose();
          navigate('/login', { replace: true });
        } catch (error) {
          toast((error as Error).message, 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="logout" className="h-4 w-4" /> {busy ? t('Please wait…') : t('Sign out')}
    </button>
  );
};

/** Avatar menu: business profile, account & backup, lock and sign out. */
const AccountButton = () => {
  const { lock, lockNow } = useAccount();
  const cloud = useCloud();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const item = 'flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('Account')}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg py-1 pl-1 pr-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
          {lock?.name ? lock.name.slice(0, 1) : <Icon name="user" className="h-4 w-4" />}
          {cloud.status !== 'off' && (
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-[2px]" title={statusLabel(cloud)}>
              <CloudDot status={cloud.status} />
            </span>
          )}
        </span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {lock?.name && <div className="truncate px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">{lock.name}</div>}
          <button type="button" role="menuitem" className={item} onClick={() => go('/profile')}>
            <Icon name="building" className="h-4 w-4 text-slate-400" /> {t('Business profile')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => go('/account')}>
            <Icon name="shield" className="h-4 w-4 text-slate-400" /> {t('Account & backup')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => go('/firms')}>
            <Icon name="list" className="h-4 w-4 text-slate-400" /> {t('All firms')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => go('/history')}>
            <Icon name="refresh" className="h-4 w-4 text-slate-400" /> {t('History of changes')}
          </button>
          {lock && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  lockNow();
                }}
              >
                <Icon name="lock" className="h-4 w-4 text-slate-400" /> {t('Lock now')}
              </button>
            </>
          )}
          {cloud.email && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <LogoutButton
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClose={() => setOpen(false)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** One click switches between light and dark (the first visit follows the system). */
const useThemeToggle = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    saveTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };
  return { dark, toggle, label: dark ? t('Switch to light theme') : t('Switch to dark theme') };
};

const ThemeSwitch = ({ withLabel = false }: { withLabel?: boolean }) => {
  const { dark, toggle, label } = useThemeToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon name={dark ? 'sun' : 'moon'} />
      {withLabel && <span>{dark ? t('Light theme') : t('Dark theme')}</span>}
    </button>
  );
};

const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${isActive ? 'text-indigo-600' : 'text-slate-500'}`;

/** Phones: the main sections sit in a bottom tab bar; everything else is under "More". */
const MobileTabBar = () => {
  const [open, setOpen] = useState(false);
  const { hasKey, openSettings } = useAi();
  const { lang, setLang } = useLanguage();
  const { lock, lockNow } = useAccount();
  const close = () => setOpen(false);
  const sheetLink = 'flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-slate-800 hover:bg-slate-100';
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden" aria-label={t('Main')}>
        <NavLink to="/invoices" className={mobileTabClass}>
          <Icon name="file" className="h-5 w-5" />
          {t('Invoices')}
        </NavLink>
        <NavLink to="/overview" className={mobileTabClass}>
          <Icon name="cash" className="h-5 w-5" />
          {t('Overview')}
        </NavLink>
        <NavLink to="/kpo" className={mobileTabClass}>
          <Icon name="list" className="h-5 w-5" />
          KPO
        </NavLink>
        <NavLink to="/resumes" className={mobileTabClass}>
          <Icon name="user" className="h-5 w-5" />
          {t('Resumes')}
        </NavLink>
        <button type="button" onClick={() => setOpen(true)} className={mobileTabClass({ isActive: open })} aria-haspopup="dialog">
          <Icon name="more" className="h-5 w-5" />
          {t('More')}
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden" onMouseDown={close}>
          <div role="dialog" aria-modal="true" aria-label={t('More')} className="w-full rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mb-2 px-1">
              <FirmSwitcher onNavigate={close} />
            </div>
            <NavLink to="/firms" className={sheetLink} onClick={close}>
              <Icon name="list" /> {t('All firms')}
            </NavLink>
            <NavLink to="/" className={sheetLink} onClick={close}>
              <Icon name="home" /> {t('Home')}
            </NavLink>
            <NavLink to="/profile" className={sheetLink} onClick={close}>
              <Icon name="building" /> {t('Business profile')}
            </NavLink>
            <NavLink to="/history" className={sheetLink} onClick={close}>
              <Icon name="refresh" /> {t('History of changes')}
            </NavLink>
            <NavLink to="/account" className={sheetLink} onClick={close}>
              <Icon name="shield" /> {t('Account & backup')}
            </NavLink>
            <button
              type="button"
              className={`${sheetLink} w-full`}
              onClick={() => {
                close();
                openSettings();
              }}
            >
              <Icon name="sparkle" /> {hasKey ? t('AI on') : t('Connect AI')}
            </button>
            {lock && (
              <button
                type="button"
                className={`${sheetLink} w-full`}
                onClick={() => {
                  close();
                  lockNow();
                }}
              >
                <Icon name="lock" /> {t('Lock now')}
              </button>
            )}
            <LogoutButton
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClose={close}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3">
              <ThemeSwitch withLabel />
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="radiogroup" aria-label={t('Language')}>
                {(['sr', 'en'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={lang === value}
                    onClick={() => setLang(value)}
                    className={`rounded-md px-3 py-1.5 uppercase ${lang === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Header = ({ onSearch }: { onSearch: () => void }) => (
  <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
    <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <NavLink to="/" className="flex items-center gap-2 font-semibold text-slate-900" aria-label={t('Home')}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Icon name="file" className="h-4 w-4" strokeWidth={2} />
        </span>
        <span>Paperwork</span>
      </NavLink>
      <div className="hidden lg:block">
        <FirmSwitcher />
      </div>
      <nav className="hidden items-center gap-1 lg:flex">
        <NavLink to="/invoices" className={navClass}>
          {t('Invoices')}
        </NavLink>
        <NavLink to="/overview" className={navClass}>
          {t('Overview')}
        </NavLink>
        <NavLink to="/kpo" className={navClass}>
          KPO
        </NavLink>
        <NavLink to="/resumes" className={navClass}>
          {t('Resumes')}
        </NavLink>
      </nav>
      <button
        type="button"
        onClick={onSearch}
        className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm text-slate-500 transition hover:bg-slate-200/70 xl:w-56"
        aria-label={t('Search and commands')}
      >
        <Icon name="search" />
        <span className="hidden flex-1 text-left xl:inline">{t('Search…')}</span>
        <kbd className="hidden rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 shadow-sm xl:inline">Ctrl K</kbd>
      </button>
      <LanguageSwitch />
      <ThemeSwitch />
      <div className="hidden items-center gap-1 lg:flex">
        <AiStatus />
        <AccountButton />
      </div>
    </div>
  </header>
);

/** Viewers of a shared firm can look around, but their changes are not saved to the cloud. */
const ViewerBanner = () => {
  const { active } = useFirm();
  const { toast } = useFeedback();
  // A refused change (see the stores) is explained, at most once every few seconds.
  useEffect(() => {
    let last = 0;
    const onRefused = () => {
      if (Date.now() - last < 4000) return;
      last = Date.now();
      toast(t('You can only view this firm. Ask the owner for the accountant role to make changes.'), 'error');
    };
    window.addEventListener('read-only', onRefused);
    return () => window.removeEventListener('read-only', onRefused);
  }, [toast]);
  if (active.role !== 'viewer') return null;
  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900 print:hidden">
      {t('View only: you can look at this firm and export, but not change it.')}
    </div>
  );
};

/** Offers to switch to a newly downloaded version of the app. */
const UpdateBanner = () => {
  const [activate, setActivate] = useState<(() => void) | null>(null);
  useEffect(() => {
    const onUpdate = (event: Event) => setActivate(() => (event as CustomEvent<() => void>).detail);
    window.addEventListener('app-update', onUpdate);
    return () => window.removeEventListener('app-update', onUpdate);
  }, []);
  if (!activate) return null;
  return (
    <div className="fixed bottom-20 left-1/2 lg:bottom-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl print:hidden">
      {t('A new version is ready.')}
      <button type="button" onClick={activate} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100">
        {t('Update')}
      </button>
    </div>
  );
};

/** Prepares due recurring invoices once per app start (and hourly while open). */
const RecurringInvoices = () => {
  const { runRecurring } = useInvoiceStore();
  const { toast } = useFeedback();
  useEffect(() => {
    const run = () => {
      const created = runRecurring();
      if (created.length) toast(t('{count} recurring invoice is ready as a draft|{count} recurring invoices are ready as drafts', { count: created.length }));
    };
    run();
    const timer = window.setInterval(run, 3_600_000);
    return () => window.clearInterval(timer);
  }, [runRecurring, toast]);
  return null;
};

const Shell = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useCommandShortcut(openSearch);
  return (
    <div className="flex min-h-screen flex-col">
      <Header onSearch={openSearch} />
      <AutoBackup />
      <ViewerBanner />
      <CloudNoticeBanner />
      <RecurringInvoices />
      <CloudChoiceDialog />
      <UpdateBanner />
      <main className="flex flex-1 flex-col pb-16 lg:pb-0">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/kpo" element={<KpoPage />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/firms" element={<FirmsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/resumes" element={<ResumeListPage />} />
            <Route path="/resumes/:id" element={<ResumeEditorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <MobileTabBar />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Onboarding />
    </div>
  );
};

/** Invoice and KPO data belong to the active firm; switching firms remounts them with that firm's data. */
const FirmStores = ({ children }: { children: ReactNode }) => {
  const { active, keyFor } = useFirm();
  const cloud = useCloud();
  const readOnly = active.role === 'viewer' || (isDatabaseMode() && (!cloud.dataReady || !cloud.email || !active.cloudId));
  return (
    <InvoiceStoreProvider key={`invoices-${active.id}`} storageKey={keyFor('studio.invoices.v2')} readOnly={readOnly}>
      <KpoStoreProvider key={`kpo-${active.id}`} storageKey={keyFor('studio.kpo.v1')} readOnly={readOnly}>
        {children}
      </KpoStoreProvider>
    </InvoiceStoreProvider>
  );
};

/** Mount document stores only after their database cache is loaded. */
const DataProviders = () => {
  const cloud = useCloud();
  const [started, setStarted] = useState(false);
  useState(() => { if (readCloudConfig() && !isDatabaseMode()) replaceDatabaseData({}); });
  useEffect(() => { void startCloud().finally(() => setStarted(true)); }, []);
  if (readCloudConfig() && !cloud.dataReady && (!started || cloud.status === 'syncing')) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{t('Loading data from the database...')}</div>;
  }
  if (readCloudConfig() && !cloud.email) {
    return <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>;
  }
  return <FirmProvider key={cloud.dataRevision}>
    <ResumeStoreProvider readOnly={isDatabaseMode() && (!cloud.dataReady || !cloud.email)}>
      <FirmStores><Shell /></FirmStores>
    </ResumeStoreProvider>
  </FirmProvider>;
};

function App() {
  useCloud(); // Re-evaluate the browser-lock bypass when database configuration changes.
  return (
    <LanguageProvider>
      <AccountGate disabled={Boolean(readCloudConfig())}>
        <BrowserRouter>
          <FeedbackProvider>
            <AiProvider>
              <DataProviders />
            </AiProvider>
          </FeedbackProvider>
        </BrowserRouter>
      </AccountGate>
    </LanguageProvider>
  );
}

export default App;
