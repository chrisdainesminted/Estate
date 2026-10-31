import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Account from './Account.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Account />
  </StrictMode>,
);
