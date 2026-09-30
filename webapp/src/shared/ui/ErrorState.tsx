import { Button } from './Button';
import styles from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Codul tehnic (mesaj de eroare brut) — arătat mic, dedesubt, opțional. */
  technicalDetail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Eroare de secțiune/pagină — datele afișate anterior nu dispar, doar secțiunea eșuată arată asta
 * (COMPONENTE.md §0d, 29g). Pentru eroarea unui singur câmp, vezi `InlineError`. */
export function ErrorState({
  title = 'Nu am putut încărca datele',
  description,
  technicalDetail,
  onRetry,
  retryLabel = 'Încearcă din nou',
  className,
}: ErrorStateProps) {
  const classes = [styles.card, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="alert">
      <strong className={styles.title}>{title}</strong>
      {description && <p className={styles.text}>{description}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
      {technicalDetail && <p className={styles.technical}>{technicalDetail}</p>}
    </div>
  );
}
