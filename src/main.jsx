import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/toast.jsx';
import './index.css';
import { accountLink, initAccounts } from './lib/account.js';
import { signInRedirect } from './lib/gate.js';

// On the website the app needs an account: signed out, make one (or sign in) first.
// Which kind of account the site uses comes from its server, so ask that first.
const onWebsite = window.location.pathname.startsWith('/app');
(onWebsite ? initAccounts() : Promise.resolve()).then(() => {
  const away = signInRedirect(window.location, accountLink());
  if (away) window.location.replace(away);
  else
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StrictMode>,
    );
});
