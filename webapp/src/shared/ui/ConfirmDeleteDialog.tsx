import { useEffect, useState } from 'react';
import styles from './ConfirmDeleteDialog.module.css';

export interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Cuvântul pe care operatorul trebuie să-l scrie exact pentru a debloca ștergerea. */
  confirmWord?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Dialog pentru ștergere definitivă — „Scrie ȘTERGE” (docs/design/screens/13-formulare.md §3d). */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmWord = 'ȘTERGE',
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = typed === confirmWord;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={event => event.stopPropagation()}
      >
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <label className={styles.field}>
          Scrie {confirmWord}
          <input
            value={typed}
            onChange={event => setTyped(event.target.value)}
            autoFocus
            aria-label={`Scrie ${confirmWord} pentru confirmare`}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Anulează
          </button>
          <button type="button" className={styles.confirm} disabled={!canConfirm} onClick={onConfirm}>
            Șterge definitiv
          </button>
        </div>
      </div>
    </div>
  );
}
