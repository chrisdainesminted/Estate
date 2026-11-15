import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/toast.jsx';
import './index.css';
import { initAccounts } from './lib/account.js';

// Anyone can try the app; an account keeps it on every device (the app offers one).
// Which kind of account the site uses comes from its server, so ask that first.
const onWebsite = window.location.pathname.startsWith('/app');
(onWebsite ? initAccounts() : Promise.resolve()).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StrictMode>,
  );
});
