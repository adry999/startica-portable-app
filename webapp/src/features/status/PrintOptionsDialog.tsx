import { useState } from 'react';
import { Button } from '@shared/ui';
import styles from './PrintOptionsDialog.module.css';

export type PrintScope = 'filtered' | 'all';
export type PrintOrientation = 'landscape' | 'portrait';

export interface PrintOptions {
  scope: PrintScope;
  showPhone: boolean;
  orientation: PrintOrientation;
}

export interface PrintOptionsDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (options: PrintOptions) => void;
}

const DEFAULT_OPTIONS: PrintOptions = { scope: 'filtered', showPhone: true, orientation: 'landscape' };

/** Dialogul „Ce tipăresc?” de la butonul Tipărește din Situația plăților (16c). */
export function PrintOptionsDialog({ open, onCancel, onConfirm }: PrintOptionsDialogProps) {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Tipărește situația plăților"
        onClick={event => event.stopPropagation()}
      >
        <h2 className={styles.title}>Tipărește situația plăților</h2>

        <fieldset className={styles.field}>
          <legend>Ce tipăresc?</legend>
          <label>
            <input
              type="radio"
              name="print-scope"
              checked={options.scope === 'filtered'}
              onChange={() => setOptions(current => ({ ...current, scope: 'filtered' }))}
            />
            Filtrul curent
          </label>
          <label>
            <input
              type="radio"
              name="print-scope"
              checked={options.scope === 'all'}
              onChange={() => setOptions(current => ({ ...current, scope: 'all' }))}
            />
            Toți copiii
          </label>
        </fieldset>

        <fieldset className={styles.field}>
          <legend>Coloane</legend>
          <label>
            <input
              type="checkbox"
              checked={options.showPhone}
              onChange={event => setOptions(current => ({ ...current, showPhone: event.target.checked }))}
            />
            Cu telefon
          </label>
        </fieldset>

        <fieldset className={styles.field}>
          <legend>Orientare</legend>
          <label>
            <input
              type="radio"
              name="print-orientation"
              checked={options.orientation === 'landscape'}
              onChange={() => setOptions(current => ({ ...current, orientation: 'landscape' }))}
            />
            Orizontal
          </label>
          <label>
            <input
              type="radio"
              name="print-orientation"
              checked={options.orientation === 'portrait'}
              onChange={() => setOptions(current => ({ ...current, orientation: 'portrait' }))}
            />
            Vertical
          </label>
        </fieldset>

        <div className={styles.actions}>
          <Button variant="white" onClick={onCancel}>
            Anulează
          </Button>
          <Button onClick={() => onConfirm(options)}>Tipărește</Button>
        </div>
      </div>
    </div>
  );
}
