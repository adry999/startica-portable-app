import { pluralRo } from '@shared/format/plural-ro';
import styles from './SaveIndicator.module.css';

export interface SaveIndicatorProps {
  saving: boolean;
  saveError: string;
  savedAt: string;
  unsavedCount: number;
  onRetry: () => void;
}

/** Indicator compact de salvare, lângă acțiunile din antet (`COMPONENTE.md` §0f/28f — Prezența,
 * Pontaj, Bazin). Înlocuiește toastul de `saveError` care ar apărea la fiecare marcaj eșuat. */
export function SaveIndicator({ saving, saveError, savedAt, unsavedCount, onRetry }: SaveIndicatorProps) {
  if (saving) {
    return (
      <span className={styles.indicator} role="status">
        Se salvează…
      </span>
    );
  }
  if (saveError) {
    return (
      <span className={`${styles.indicator} ${styles.error}`} role="status">
        Nesalvat · {pluralRo(unsavedCount, 'modificare', 'modificări')}
        <button type="button" className={styles.retry} onClick={onRetry}>
          Încearcă din nou
        </button>
      </span>
    );
  }
  if (!savedAt) return null;
  const time = new Date(savedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return (
    <span className={styles.indicator} role="status">
      Salvat · {time}
    </span>
  );
}
