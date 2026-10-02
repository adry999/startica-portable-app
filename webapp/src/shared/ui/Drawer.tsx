import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { ScrollArea } from './ScrollArea';
import { errorCountLabel, usePanelController } from './usePanelController';
import styles from './Drawer.module.css';

export type DrawerSize = 'form' | 'detail';

export interface DrawerProps {
  open: boolean;
  title: string;
  /** `'form'` (620px, implicit) pentru formulare complete, `'detail'` (480px) pentru panouri mai
   * simple — token-izate în tokens.css (`--drawer-form`/`--drawer-detail`, 44d). Un `width` numeric
   * explicit rămâne o portiță de ieșire pentru un caz documentat separat, dar nu mai e calea obișnuită. */
  size?: DrawerSize;
  width?: number;
  onClose: () => void;
  /** Întors true blochează închiderea (ex. modificări nesalvate) — Drawer nu decide cum se confirmă, doar cere voie. */
  shouldBlockClose?: () => boolean;
  /** „N erori” în subsol (44d) — dacă lipsește, Drawer își numără singur câmpurile native nevalide. */
  errorCount?: number;
  footer?: ReactNode;
  children: ReactNode;
}

const SIZE_WIDTH: Record<DrawerSize, string> = {
  form: 'var(--drawer-form)',
  detail: 'var(--drawer-detail)',
};

/**
 * Panou lateral fix dreapta — înlocuiește `dialog` pentru creare/editare. Comportamentul comun
 * (focus inițial, Esc → `onClose`, Ctrl+Enter = submit, „N erori”) vine din `usePanelController`
 * (44d) — un singur loc, nu pe fiecare formular.
 */
export function Drawer({
  open,
  title,
  size = 'form',
  width,
  onClose,
  shouldBlockClose,
  errorCount,
  footer,
  children,
}: DrawerProps) {
  const { panelRef, requestClose, effectiveErrorCount } = usePanelController({
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
        style={{ width: width !== undefined ? `${width}px` : SIZE_WIDTH[size] }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={event => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Închide" onClick={requestClose}>
            <Icon name="close" />
          </button>
        </header>
        <ScrollArea className={styles.body}>{children}</ScrollArea>
        {effectiveErrorCount > 0 && (
          <p className={styles.errorBanner} role="status">
            {errorCountLabel(effectiveErrorCount)}
          </p>
        )}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
}
