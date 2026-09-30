import { SegmentCounter } from './SegmentCounter';
import styles from './SmsPreview.module.css';

export interface SmsPreviewProps {
  /** Numele expeditorului afișat pe telefon, ex. "Grădinița Pitici". */
  senderName: string;
  message: string;
  className?: string;
}

/** Previzualizare SMS, stil bulă de mesaj pe telefon (COMPONENTE.md §0g) — statică, fără interacțiune. */
export function SmsPreview({ senderName, message, className }: SmsPreviewProps) {
  const classes = className ? `${styles.wrapper} ${className}` : styles.wrapper;

  return (
    <div className={classes}>
      <div className={styles.bubble}>
        <span className={styles.sender}>{senderName}</span>
        <p className={styles.message}>{message}</p>
      </div>
      <SegmentCounter text={message} className={styles.counter} />
    </div>
  );
}
