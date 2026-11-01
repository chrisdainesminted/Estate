import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Lenders from './Lenders.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Lenders />
  </StrictMode>,
);
