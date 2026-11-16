import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BecomeAgent from './BecomeAgent.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BecomeAgent />
  </StrictMode>,
);
