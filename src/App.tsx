import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AccountGate, useAccount } from './features/account/AccountGate';
import { AccountPage } from './features/account/AccountPage';
import { AutoBackup } from './features/account/AutoBackup';
import { CloudChoiceDialog, CloudDot, statusLabel, useCloud } from './features/account/CloudSection';
import { startCloud } from './lib/cloud';
import { AiProvider, useAi } from './features/ai/AiSettings';
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
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

const AiStatus = () => {
  const { hasKey, openSettings } = useAi();
  return (
    <button
      type="button"
      onClick={openSettings}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      title={hasKey ? t('Claude AI is connected') : t('Connect Claude AI')}
    >
      <span className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <Icon name="sparkle" />
      <span className="hidden lg:inline">{hasKey ? t('AI on') : t('Connect AI')}</span>
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

const AccountButton = () => {
  const { lock, lockNow } = useAccount();
  const cloud = useCloud();
  return (
    <div className="flex items-center">
      <NavLink
        to="/account"
        title={t('Account & backup')}
        className={({ isActive }) => `flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        {lock?.name ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold uppercase text-indigo-700">{lock.name.slice(0, 1)}</span>
        ) : (
          <Icon name="shield" />
        )}
        <span className="hidden xl:inline">{lock?.name || t('Account')}</span>
        {cloud.status !== 'off' && (
          <span title={statusLabel(cloud)}>
            <CloudDot status={cloud.status} />
          </span>
        )}
      </NavLink>
      {lock && (
        <button type="button" onClick={lockNow} title={t('Lock now')} aria-label={t('Lock now')} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <Icon name="lock" />
        </button>
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
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden" aria-label={t('Main')}>
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
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 md:hidden" onMouseDown={close}>
          <div role="dialog" aria-modal="true" aria-label={t('More')} className="w-full rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <NavLink to="/" className={sheetLink} onClick={close}>
              <Icon name="home" /> {t('Home')}
            </NavLink>
            <NavLink to="/profile" className={sheetLink} onClick={close}>
              <Icon name="building" /> {t('Business profile')}
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
        <span className="md:hidden lg:inline">Paperwork</span>
      </NavLink>
      <nav className="hidden items-center gap-1 md:flex">
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
        className="ml-auto flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm text-slate-500 transition hover:bg-slate-200/70 sm:w-56"
        aria-label={t('Search and commands')}
      >
        <Icon name="search" />
        <span className="hidden flex-1 text-left sm:inline">{t('Search…')}</span>
        <kbd className="hidden rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 shadow-sm sm:inline">Ctrl K</kbd>
      </button>
      <LanguageSwitch />
      <ThemeSwitch />
      <div className="hidden items-center gap-1 md:flex">
        <AiStatus />
        <NavLink
          to="/profile"
          title={t('Business profile')}
          className={({ isActive }) => `flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Icon name="building" />
          <span className="hidden xl:inline">{t('Business profile')}</span>
        </NavLink>
        <AccountButton />
      </div>
    </div>
  </header>
);

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
    <div className="fixed bottom-20 left-1/2 md:bottom-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl print:hidden">
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
  // Optional cloud sync; does nothing until a Supabase project is connected.
  useEffect(() => {
    void startCloud();
  }, []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useCommandShortcut(openSearch);
  return (
    <div className="flex min-h-screen flex-col">
      <Header onSearch={openSearch} />
      <AutoBackup />
      <RecurringInvoices />
      <CloudChoiceDialog />
      <UpdateBanner />
      <main className="flex flex-1 flex-col pb-16 md:pb-0">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/kpo" element={<KpoPage />} />
            <Route path="/overview" element={<OverviewPage />} />
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

function App() {
  return (
    <LanguageProvider>
      <AccountGate>
        <BrowserRouter>
          <FeedbackProvider>
            <AiProvider>
              <InvoiceStoreProvider>
                <KpoStoreProvider>
                  <ResumeStoreProvider>
                    <Shell />
                  </ResumeStoreProvider>
                </KpoStoreProvider>
              </InvoiceStoreProvider>
            </AiProvider>
          </FeedbackProvider>
        </BrowserRouter>
      </AccountGate>
    </LanguageProvider>
  );
}

export default App;
