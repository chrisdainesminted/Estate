import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LegalPage from './LegalPage.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LegalPage page="privacy" />
  </StrictMode>,
);
