import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/toast.jsx';
import './index.css';
import { accountLink } from './lib/account.js';
import { signInRedirect } from './lib/gate.js';

// On the website the app needs an account: signed out, make one (or sign in) first.
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
