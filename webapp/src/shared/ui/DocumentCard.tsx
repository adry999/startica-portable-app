import { Card } from './Card';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import styles from './DocumentCard.module.css';

export interface DocumentCardProps {
  fileName: string;
  /** Ex. "PDF · 240 KB". */
  meta: string;
  onOpen?: () => void;
  onRemove?: () => void;
  className?: string;
}

/** Rând pentru un document încărcat (COMPONENTE.md §0i) — ex. documentele unui copil.
 * Fără iconiță dedicată de tip fișier în registrul `Icon` — `external-link` ca substituent neutru. */
export function DocumentCard({ fileName, meta, onOpen, onRemove, className }: DocumentCardProps) {
  const info = (
    <>
      <Icon name="external-link" className={styles.icon} />
      <span className={styles.info}>
        <span className={styles.fileName}>{fileName}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </>
  );

  return (
    <Card tone="white" className={className ? `${styles.card} ${className}` : styles.card}>
      {onOpen ? (
        <button type="button" className={styles.openButton} onClick={onOpen}>
          {info}
        </button>
      ) : (
        <span className={styles.openButton}>{info}</span>
      )}
      {onRemove && <IconButton icon="close" ariaLabel={`Elimină ${fileName}`} onClick={onRemove} />}
    </Card>
  );
}
