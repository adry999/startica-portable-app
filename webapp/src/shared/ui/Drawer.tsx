import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  title: string;
  /** 620 pentru copil (3a), 560 pentru achitare (3b), 520 pentru cheltuială (3c). */
  width?: number;
  onClose: () => void;
  /** Întors true blochează închiderea (ex. modificări nesalvate) — Drawer nu decide cum se confirmă, doar cere voie. */
  shouldBlockClose?: () => boolean;
  footer?: ReactNode;
  children: ReactNode;
}

/** Panou lateral fix dreapta — înlocuiește `dialog` pentru creare/editare. */
export function Drawer({ open, title, width = 620, onClose, shouldBlockClose, footer, children }: DrawerProps) {
  function requestClose() {
    if (shouldBlockClose?.()) return;
    onClose();
  }

  // Ref, nu closure direct în effect: Esc trebuie să vadă mereu shouldBlockClose/onClose
  // curente, nu pe cele din randarea în care s-a deschis panoul.
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={requestClose}>
      <aside
        className={styles.panel}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={event => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Închide" onClick={requestClose}>
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </aside>
    </div>
  );
}
