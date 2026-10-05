import { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AccountGate, useAccount } from './features/account/AccountGate';
import { AccountPage } from './features/account/AccountPage';
import { AutoBackup } from './features/account/AutoBackup';
import { AiProvider, useAi } from './features/ai/AiSettings';
import { CommandPalette, useCommandShortcut } from './features/command/CommandPalette';
import { HomePage } from './features/home/HomePage';
import { InvoiceEditorPage } from './features/invoices/pages/InvoiceEditorPage';
import { InvoiceListPage } from './features/invoices/pages/InvoiceListPage';
import { InvoiceStoreProvider } from './features/invoices/store';
import { Onboarding } from './features/onboarding/Onboarding';
import { ProfilePage } from './features/profile/ProfilePage';
import { ResumeEditorPage } from './features/resumes/pages/ResumeEditorPage';
import { ResumeListPage } from './features/resumes/pages/ResumeListPage';
import { ResumeStoreProvider } from './features/resumes/store';
import { LanguageProvider, t, useLanguage } from './i18n';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { FeedbackProvider } from './ui/Feedback';
import { Icon } from './ui/Icon';

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
      </NavLink>
      {lock && (
        <button type="button" onClick={lockNow} title={t('Lock now')} aria-label={t('Lock now')} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <Icon name="lock" />
        </button>
      )}
    </div>
  );
};

const Header = ({ onSearch }: { onSearch: () => void }) => (
  <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
    <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <NavLink to="/" className="flex items-center gap-2 font-semibold text-slate-900" aria-label={t('Home')}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Icon name="file" className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="hidden md:inline">Paperwork</span>
      </NavLink>
      <nav className="flex items-center gap-1">
        <NavLink to="/invoices" className={navClass}>
          {t('Invoices')}
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
  </header>
);

const Shell = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useCommandShortcut(openSearch);
  return (
    <div className="flex min-h-screen flex-col">
      <Header onSearch={openSearch} />
      <AutoBackup />
      <main className="flex flex-1 flex-col">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/resumes" element={<ResumeListPage />} />
            <Route path="/resumes/:id" element={<ResumeEditorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
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
                <ResumeStoreProvider>
                  <Shell />
                </ResumeStoreProvider>
              </InvoiceStoreProvider>
            </AiProvider>
          </FeedbackProvider>
        </BrowserRouter>
      </AccountGate>
    </LanguageProvider>
  );
}

export default App;
