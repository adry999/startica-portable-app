import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@app/App';
import { ToastProvider } from '@shared/ui';
import '@shared/tokens/tokens.css';

const root = createRoot(document.getElementById('root')!);

// Ruta /design-system e doar pentru dezvoltare (comparație vizuală cu docs/design/*.dc.html):
// randată separat de AppShell/sesiune, ca să nu declanșeze niciun apel /api/*. `import.meta.env.DEV`
// e cunoscut static de Vite, deci ramura asta — inclusiv importul dinamic — e eliminată din
// bundle-ul de producție pe care îl livrează aplicația desktop (vezi webapp/src/design-system).
if (import.meta.env.DEV && window.location.pathname.startsWith('/design-system')) {
  import('./design-system/DesignSystemPage').then(({ DesignSystemPage }) => {
    root.render(
      <StrictMode>
        <DesignSystemPage />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
