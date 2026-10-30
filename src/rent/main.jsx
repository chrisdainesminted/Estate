import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RentPage from './RentPage.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RentPage />
  </StrictMode>,
);
