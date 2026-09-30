import { Button } from './Button';
import { Card } from './Card';
import { Spinner } from './Spinner';
import styles from './SyncStatusCard.module.css';

export type SyncStatusCardState = 'synced' | 'syncing' | 'error' | 'offline';

export interface SyncStatusCardProps {
  state: SyncStatusCardState;
  /** Ex. „Sincronizat acum 2 minute” / „Se sincronizează…” / „Eroare la sincronizare” / „Offline”. */
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Cartelă de stare a sincronizării din antet/shell (32b). V1 simplificat la 4 stări (spec-ul
 * artboard-ului are 5, cu „conflict” separat de „eroare” — aici „conflict” se raportează tot
 * prin `state="error"`, cu mesajul potrivit) și fără puls animat pe punctul „syncing”.
 */
export function SyncStatusCard({ state, message, onRetry, className }: SyncStatusCardProps) {
  const classes = className ? `${styles.root} ${className}` : styles.root;
  return (
    <Card className={classes}>
      <span className={styles.indicator}>
        {state === 'syncing' ? <Spinner size={16} /> : <span className={`${styles.dot} ${styles[state]}`} />}
      </span>
      <span className={styles.message}>{message}</span>
      {state === 'error' && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Reîncearcă
        </Button>
      )}
    </Card>
  );
}
