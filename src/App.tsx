import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { InvoiceStoreProvider } from './features/invoices/store';
import { InvoiceListPage } from './features/invoices/pages/InvoiceListPage';
import { InvoiceEditorPage } from './features/invoices/pages/InvoiceEditorPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { ResumeStoreProvider } from './features/resumes/store';
import { ResumeListPage } from './features/resumes/pages/ResumeListPage';
import { ResumeEditorPage } from './features/resumes/pages/ResumeEditorPage';
import { FeedbackProvider } from './ui/Feedback';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Icon } from './ui/Icon';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

const Header = () => (
  <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
    <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-4 sm:gap-6 sm:px-6">
      <NavLink to="/invoices" className="flex items-center gap-2 font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Icon name="file" className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="hidden sm:inline">Paperwork</span>
      </NavLink>
      <nav className="flex items-center gap-1">
        <NavLink to="/invoices" className={navClass}>
          Invoices
        </NavLink>
        <NavLink to="/resumes" className={navClass}>
          Resumes
        </NavLink>
      </nav>
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `ml-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`
        }
      >
        <Icon name="building" />
        <span className="hidden sm:inline">Business profile</span>
      </NavLink>
    </div>
  </header>
);

function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <InvoiceStoreProvider>
          <ResumeStoreProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex flex-1 flex-col">
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Navigate to="/invoices" replace />} />
                    <Route path="/invoices" element={<InvoiceListPage />} />
                    <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/resumes" element={<ResumeListPage />} />
                    <Route path="/resumes/:id" element={<ResumeEditorPage />} />
                    <Route path="*" element={<Navigate to="/invoices" replace />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </ResumeStoreProvider>
        </InvoiceStoreProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}

export default App;
