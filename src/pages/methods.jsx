import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Methods from './Methods.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Methods />
  </StrictMode>,
);
