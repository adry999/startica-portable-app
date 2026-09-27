import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@shared/tokens/tokens.css';
import { DesignSystemPage } from './DesignSystemPage';

// Punct de intrare pentru build-ul static (`npm run build:design-system`), separat de `main.tsx`:
// nicio sesiune, niciun router al aplicației reale — doar pagina de design, fără backend.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignSystemPage />
  </StrictMode>,
);
