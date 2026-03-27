import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { Navigation } from './components/layout/Navigation';
import { InvoicePage } from './modules/invoice/InvoicePage';
import { ResumePage } from './modules/resume/ResumePage';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <BrowserRouter>
      <AppShell>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        >
          <Navigation />
        </Sidebar>

        <MainContent
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/invoices" />} />
            <Route path="/invoices" element={<InvoicePage />} />
            <Route path="/resumes" element={<ResumePage />} />
          </Routes>
        </MainContent>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;