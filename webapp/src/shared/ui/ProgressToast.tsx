import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';
import styles from './ProgressToast.module.css';

export interface ProgressToastProps {
  title: string;
  /** 0-100. Lipsă = bară nedeterminată (operație în curs, fără procent cunoscut). */
  progress?: number;
  /** Ex. "3 din 10 fișiere". */
  detail?: string;
  onCancel?: () => void;
  className?: string;
}

/**
 * Toast de progres pentru operații lungi (export/import) — aceeași carcasă vizuală ca `Toast`
 * (`Toast.tsx`), dar cu o `ProgressBar` în loc de un mesaj simplu. Nedeterminată: `ProgressBar`
 * n-are mod nedeterminat, deci se afișează la 0% (fără plumbing suplimentar, în afara scopului).
 * Apelantul decide unde/cum montează toast-ul — spre deosebire de `ToastProvider`/`useToast`,
 * nu există aici o coadă proprie.
 */
export function ProgressToast({ title, progress, detail, onCancel, className }: ProgressToastProps) {
  const classes = [styles.toast, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status">
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        {onCancel && <IconButton icon="close" ariaLabel="Anulează" onClick={onCancel} className={styles.cancel} />}
      </div>
      <ProgressBar variant="simple" value={progress ?? 0} label={title} />
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
