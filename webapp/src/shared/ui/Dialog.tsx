import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import { type PanelFooterPrimary, PanelFooter } from './PanelFooter';
import { ScrollArea } from './ScrollArea';
import { usePanelController } from './usePanelController';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  /** `aria-label` separat de `title`, când antetul vizibil are nevoie de text dinamic
   * (ex. „Plătește 3 salarii”), dar numele accesibil trebuie să rămână stabil (ex. „Confirmă plata”,
   * verificat în teste cu `getByRole('dialog', { name: ... })`). Implicit `title`. */
  ariaLabel?: string;
  /** 440 implicit (`--dialog`, 44d) — confirmări/dialoguri scurte; ecranele cu formular mai mare
   * folosesc `Drawer`, nu `Dialog`. Un `width` numeric explicit rămâne o portiță de ieșire pentru
   * un caz documentat separat (ex. `RestoreDoneDialog`, 46d, 560px). */
  width?: number;
  onClose: () => void;
  /** Întors true blochează închiderea (ex. modificări nesalvate) — Dialog nu decide cum se confirmă, doar cere voie. */
  shouldBlockClose?: () => boolean;
  /** Ascunde butonul × din antet (46d: dialogul de reîncărcare după restaurare nu are nicio
   * ieșire în afară de butonul din footer — combină de obicei cu `shouldBlockClose={() => true}`,
   * ca nici Esc, nici clicul pe voal să nu-l închidă). Implicit `false`. */
  hideClose?: boolean;
  /** „N erori” în subsol (44d) — dacă lipsește, Dialog își numără singur câmpurile native nevalide. */
  errorCount?: number;
  /** Subsolul unificat (F19/§6, `PanelFooter`) — fără `primary`/`footerStart`, panoul nu are subsol. */
  primary?: PanelFooterPrimary;
  footerStart?: ReactNode;
  /** Implicit `requestClose` — eticheta „Anulează”. */
  onCancel?: () => void;
  cancelLabel?: string;
  hideCancel?: boolean;
  children: ReactNode;
}

/**
 * Panou modal centrat — `ConfirmDialog` (mai jos) și dialogurile de conținut scurt (28g, 29e).
 * Comportamentul comun (focus inițial, Esc → `onClose`, Ctrl+Enter = submit, „N erori”) vine din
 * `usePanelController` (44d) — un singur loc, nu pe fiecare formular.
 */
export function Dialog({
  open,
  title,
  ariaLabel,
  width,
  onClose,
  shouldBlockClose,
  hideClose = false,
  errorCount,
  primary,
  footerStart,
  onCancel,
  cancelLabel,
  hideCancel,
  children,
}: DialogProps) {
  const { panelRef, requestClose, effectiveErrorCount, focusFirstInvalid } = usePanelController({
    open,
    onClose,
    shouldBlockClose,
    errorCount,
  });

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={requestClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        style={{ width: width !== undefined ? `${width}px` : 'var(--dialog)' }}
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
        <PanelFooter
          primary={primary}
          footerStart={footerStart}
          onCancel={onCancel ?? requestClose}
          cancelLabel={cancelLabel}
          hideCancel={hideCancel}
          errorCount={effectiveErrorCount}
          onFocusFirstInvalid={focusFirstInvalid}
          className={styles.footer}
        />
      </div>
    </div>
  );
}
