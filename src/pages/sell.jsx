import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Sell from './Sell.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sell />
  </StrictMode>,
);
