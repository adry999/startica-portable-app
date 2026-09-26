import type { SaveStatus } from './save-status';
import styles from './SaveStatusCard.module.css';

export interface SaveStatusCardProps {
  status: SaveStatus;
  label: string;
  detail: string;
  onRetry: () => void;
  /** Avertizare separată (ex. copie externă neconfigurată), afișată sub starea salvată. */
  warning?: { message: string; actionLabel: string; onAction: () => void };
}

const RETRY_LABEL: Partial<Record<SaveStatus, string>> = {
  unsaved: 'Salvează acum',
  error: 'Încearcă din nou',
};

export function SaveStatusCard({ status, label, detail, onRetry, warning }: SaveStatusCardProps) {
  const retryLabel = RETRY_LABEL[status];

  return (
    <div className={`${styles.card} ${styles[status]}`} data-state={status} role="status">
      <div className={styles.row}>
        <span className={styles.dot} aria-hidden="true" />
        <strong className={styles.label}>{label}</strong>
      </div>
      {status !== 'saved' && detail && (
        <div className={styles.detailRow}>
          <small>{detail}</small>
          {retryLabel && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              {retryLabel}
            </button>
          )}
        </div>
      )}
      {status === 'saved' && warning && (
        <p className={styles.warning}>
          {warning.message} · <button onClick={warning.onAction}>{warning.actionLabel}</button>
        </p>
      )}
    </div>
  );
}
