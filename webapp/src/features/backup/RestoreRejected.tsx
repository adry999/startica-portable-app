import styles from './RestoreRejected.module.css';

export type RestoreRejectedTone = 'blocked' | 'warning';

export interface RestoreRejectedItem {
  tone: RestoreRejectedTone;
  title: string;
  message: string;
}

export interface RestoreRejectedProps {
  items: RestoreRejectedItem[];
}

/** 46c — arhivă respinsă: roz = blocat (versiune mai nouă, numărătoare greșită), galben =
 * avertisment (backup vechi `.db`, restaurarea poate continua). Aceleași carduri arată ambele
 * cazuri — doar tonul și mesajul diferă, niciodată componenta. */
export function RestoreRejected({ items }: RestoreRejectedProps) {
  if (!items.length) return null;
  return (
    <div className={styles.list} role="alert">
      {items.map(item => (
        <div key={item.title} className={item.tone === 'blocked' ? styles.cardBlocked : styles.cardWarning}>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.message}>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
