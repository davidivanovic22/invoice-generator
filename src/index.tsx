import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts';
import './index.css';
import App from './App';
import { registerServiceWorker } from './serviceWorkerRegistration';
import { applyTheme, watchSystemTheme } from './ui/theme';

// Before the first paint, so dark mode does not flash white.
applyTheme();
watchSystemTheme();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable, works offline; a new version is offered through the update banner.
registerServiceWorker((activate) => window.dispatchEvent(new CustomEvent('app-update', { detail: activate })));
