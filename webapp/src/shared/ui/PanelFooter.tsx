import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { errorCountLabel } from './usePanelController';
import styles from './PanelFooter.module.css';

export interface PanelFooterPrimaryBase {
  label: ReactNode;
  /** Text afișat cât timp `loading` e true (29b) — implicit „Salvez…”; o acțiune care nu salvează
   * (Trimite SMS, Tipărește, Restaurează, Plătește…) își dă propriul gerunziu. */
  loadingLabel?: string;
  loading?: boolean;
  type?: 'submit' | 'button';
  form?: string;
  onClick?: () => void;
  variant?: ButtonVariant;
}

/** `disabled` fără `disabledReason` e eroare de tip (F19/§6) — motivul apare în stânga subsolului. */
export type PanelFooterPrimary =
  | (PanelFooterPrimaryBase & { disabled?: undefined })
  | (PanelFooterPrimaryBase & { disabled: boolean; disabledReason: string });

export interface PanelFooterProps {
  primary?: PanelFooterPrimary;
  /** O bifă, o notă sau un buton secundar (ex. „Șterge”, „Salvează și adaugă alta”) — stânga subsolului. */
  footerStart?: ReactNode;
  onCancel?: () => void;
  cancelLabel?: string;
  hideCancel?: boolean;
  errorCount: number;
  onFocusFirstInvalid: () => void;
  className: string;
}

/**
 * Subsolul unificat `Drawer`/`Dialog` (F19/§6, 15k) — un singur loc pentru ordinea fixă
 * [footerStart] … Anulează · Principal, „N erori” mutat în stânga (nu bandă separată), și
 * „Salvez…” + ambele butoane inactive cât timp `primary.loading`.
 */
export function PanelFooter({
  primary,
  footerStart,
  onCancel,
  cancelLabel = 'Anulează',
  hideCancel = false,
  errorCount,
  onFocusFirstInvalid,
  className,
}: PanelFooterProps) {
  if (!primary && !footerStart && errorCount === 0) return null;

  return (
    <footer className={className}>
      <div className={styles.start}>
        {primary?.disabled && primary.disabledReason && <span className={styles.reason}>{primary.disabledReason}</span>}
        {footerStart}
        {errorCount > 0 && (
          <button type="button" className={styles.errorCount} onClick={onFocusFirstInvalid}>
            {errorCountLabel(errorCount)}
          </button>
        )}
      </div>
      {primary && (
        <div className={styles.actions}>
          {!hideCancel && (
            <Button type="button" variant="outline" disabled={primary.loading} onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type={primary.type ?? 'submit'}
            form={primary.form}
            variant={primary.variant}
            loading={primary.loading}
            disabled={primary.disabled}
            onClick={primary.onClick}
            title={primary.disabled ? primary.disabledReason : undefined}
          >
            {primary.loading ? (primary.loadingLabel ?? 'Salvez…') : primary.label}
          </Button>
        </div>
      )}
    </footer>
  );
}
