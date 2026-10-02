import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@app/App';
import { ErrorBoundary } from '@app/shell/ErrorBoundary';
import { ToastProvider, UndoToastProvider } from '@shared/ui';
import { initUiScale } from '@shared/state/ui-scale';
import '@shared/tokens/tokens.css';

initUiScale();

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <UndoToastProvider>
            <App />
          </UndoToastProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
