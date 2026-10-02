import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { ScrollArea } from './ScrollArea';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  /** `aria-label` separat de `title`, când antetul vizibil are nevoie de text dinamic
   * (ex. „Plătește 3 salarii”), dar numele accesibil trebuie să rămână stabil (ex. „Confirmă plata”,
   * verificat în teste cu `getByRole('dialog', { name: ... })`). Implicit `title`. */
  ariaLabel?: string;
  /** 480 implicit — confirmări/dialoguri scurte; ecranele cu formular mai mare folosesc `Drawer`, nu `Dialog`. */
  width?: number;
  onClose: () => void;
  /** Întors true blochează închiderea (ex. modificări nesalvate) — Dialog nu decide cum se confirmă, doar cere voie. */
  shouldBlockClose?: () => boolean;
  /** Ascunde butonul × din antet (46d: dialogul de reîncărcare după restaurare nu are nicio
   * ieșire în afară de butonul din footer — combină de obicei cu `shouldBlockClose={() => true}`,
   * ca nici Esc, nici clicul pe voal să nu-l închidă). Implicit `false`. */
  hideClose?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

/** Panou modal centrat — `ConfirmDialog` (mai jos) și dialogurile de conținut scurt (28g, 29e). */
export function Dialog({
  open,
  title,
  ariaLabel,
  width = 480,
  onClose,
  shouldBlockClose,
  hideClose = false,
  footer,
  children,
}: DialogProps) {
  function requestClose() {
    if (shouldBlockClose?.()) return;
    onClose();
  }

  // Ref, nu closure direct în effect: Esc trebuie să vadă mereu shouldBlockClose/onClose
  // curente, nu pe cele din randarea în care s-a deschis dialogul (la fel ca în Drawer).
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
      <div
        className={styles.panel}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        onClick={event => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {!hideClose && <IconButton icon="close" ariaLabel="Închide" size="lg" onClick={requestClose} />}
        </header>
        <ScrollArea className={styles.body}>{children}</ScrollArea>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
}
