import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Contact from './Contact.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Contact />
  </StrictMode>,
);
