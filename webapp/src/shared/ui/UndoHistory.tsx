import { useRef } from 'react';
import type { UndoHistoryEntry } from '@shared/state/useUndoStack';
import styles from './UndoHistory.module.css';

export type { UndoHistoryEntry };

export interface UndoHistoryProps {
  history: UndoHistoryEntry[];
  canUndo: boolean;
  onUndoLast: () => void;
  onUndoUntil: (id: string) => void;
  onUndoAll: () => void;
}

/** „↶ Anulează | N ▾” + popover „Modificări azi” (`COMPONENTE.md` §0f/28f) — Ctrl/⌘+Z pe pagină
 * face `onUndoLast()` direct. Stiva efectivă (istoricul, undo/redo) vine din `useUndoStack`
 * (`@shared/state`); componenta doar randează ce primește. */
export function UndoHistory({ history, canUndo, onUndoLast, onUndoUntil, onUndoAll }: UndoHistoryProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.undoButton}
        disabled={!canUndo}
        title="Anulează ultima acțiune (Ctrl+Z)"
        onClick={onUndoLast}
      >
        ↶ Anulează
      </button>
      <details ref={detailsRef} className={styles.history} onClick={event => event.stopPropagation()}>
        <summary aria-label="Istoricul zilei" title="Istoricul zilei">
          {history.length} ▾
        </summary>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Modificări azi</span>
            <button
              type="button"
              className={styles.undoAll}
              disabled={!canUndo}
              onClick={() => {
                onUndoAll();
                close();
              }}
            >
              Anulează tot
            </button>
          </div>
          {history.length === 0 ? (
            <p className={styles.empty}>Nicio modificare încă azi.</p>
          ) : (
            <div className={styles.list}>
              {history.map((entry, index) => (
                <div key={entry.id} className={styles.row}>
                  <span className={styles.time}>{entry.time}</span>
                  <span className={styles.label}>{entry.label}</span>
                  <button
                    type="button"
                    className={styles.rowUndo}
                    onClick={() => {
                      onUndoUntil(entry.id);
                      close();
                    }}
                  >
                    {/* `history` e deja cel mai recent primul (index 0) — „Anulează” pe orice rând
                        care nu e cel mai recent desface și acțiunile de după el, deci eticheta
                        trebuie să spună asta explicit (nu doar butonul de mai sus, „Anulează tot"). */}
                    {index === 0 ? 'Anulează' : 'Anulează până aici'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <span className={styles.note}>Fiecare modificare e salvată și în Administrare → Istoric.</span>
        </div>
      </details>
    </div>
  );
}
