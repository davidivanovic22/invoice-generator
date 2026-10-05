import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Installable, works offline; a new version is offered through the update banner.
registerServiceWorker((activate) => window.dispatchEvent(new CustomEvent('app-update', { detail: activate })));
