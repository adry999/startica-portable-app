import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@shared/ui';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Plasă de siguranță la nivel de aplicație — o excepție netratată la randare (dată nevalidă dintr-o
 * înregistrare veche, referință lipsă după o ștergere concurentă) nu mai lasă ecranul alb, ci arată
 * `ErrorState` cu opțiunea de reîncărcare. React cere o componentă de clasă pentru asta — nu există
 * echivalent cu hook-uri. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Eroare netratată la randare:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.screen}>
          <ErrorState
            className={styles.box}
            title="Aplicația a întâmpinat o eroare"
            description="Datele introduse anterior sunt salvate. Reîncarcă aplicația ca să continui."
            technicalDetail={this.state.error.message}
            onRetry={() => window.location.reload()}
            retryLabel="Reîncarcă aplicația"
          />
        </div>
      );
    }
    return this.props.children;
  }
}
