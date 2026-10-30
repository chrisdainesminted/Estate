import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HomesPage from './HomesPage.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HomesPage />
  </StrictMode>,
);
