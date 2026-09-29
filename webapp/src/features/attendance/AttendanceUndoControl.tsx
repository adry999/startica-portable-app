import { useRef } from 'react';
import type { HistoryEntryView } from './useAttendanceDay';
import styles from './AttendanceUndoControl.module.css';

export interface AttendanceUndoControlProps {
  history: HistoryEntryView[];
  canUndo: boolean;
  onUndoLast: () => void;
  onUndoUntil: (id: string) => void;
  onUndoAll: () => void;
}

/** „↶ Anulează | N ▾” din antetul Prezenței (A3c) — Ctrl+Z pe pagină face `onUndoLast()` direct. */
export function AttendanceUndoControl({
  history,
  canUndo,
  onUndoLast,
  onUndoUntil,
  onUndoAll,
}: AttendanceUndoControlProps) {
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
              {history.map(entry => (
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
                    {entry.bulk ? 'Anulează până aici' : 'Anulează'}
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
