import { useEffect } from 'react';
import type { DirtyForm } from '@shared/state/dirty-forms';
import styles from './BranchSwitchDialog.module.css';

export interface BranchSwitchDialogProps {
  form: DirtyForm;
  fromName: string;
  toName: string;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/** Confirmarea de formular nesalvat la schimbarea filialei (13b, 17-filiale.md). */
export function BranchSwitchDialog({ form, fromName, toName, onStay, onDiscard, onSave }: BranchSwitchDialogProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onStay();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onStay]);

  return (
    <div className={styles.overlay} onClick={onStay}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Ai ${form.label} nesalvată în ${fromName}`}
        onClick={event => event.stopPropagation()}
      >
        <span className={styles.icon} aria-hidden="true">
          !
        </span>
        <h2 className={styles.title}>Ai {form.label} nesalvată în {fromName}</h2>
        <p className={styles.description}>
          Dacă treci acum la {toName}, formularul se închide și datele introduse se pierd.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.stay} onClick={onStay}>
            Rămân aici
          </button>
          <button type="button" className={styles.discard} onClick={onDiscard}>
            Renunț și schimb
          </button>
          <button type="button" className={styles.save} onClick={onSave}>
            Salvează și schimbă
          </button>
        </div>
      </div>
    </div>
  );
}
