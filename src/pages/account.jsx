import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Account from './Account.jsx';
import '../index.css';
import { initAccounts } from '../lib/account.js';

// Which kind of account the site uses comes from its server: ask before showing the page.
initAccounts().then(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Account />
    </StrictMode>,
  ),
);
