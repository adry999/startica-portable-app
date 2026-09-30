import { useState } from 'react';
import { Button, Checkbox, SegmentedControl } from '@shared/ui';
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

const SCOPE_OPTIONS = [
  { value: 'filtered', label: 'Filtrul curent' },
  { value: 'all', label: 'Toți copiii' },
] as const;

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Orizontal' },
  { value: 'portrait', label: 'Vertical' },
] as const;

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

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Ce tipăresc?</span>
          <SegmentedControl
            ariaLabel="Ce tipăresc?"
            value={options.scope}
            onChange={scope => setOptions(current => ({ ...current, scope }))}
            options={SCOPE_OPTIONS}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Coloane</span>
          <div className={styles.checkboxRow}>
            <Checkbox
              checked={options.showPhone}
              onChange={showPhone => setOptions(current => ({ ...current, showPhone }))}
              ariaLabel="Cu telefon"
            />
            <span>Cu telefon</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Orientare</span>
          <SegmentedControl
            ariaLabel="Orientare"
            value={options.orientation}
            onChange={orientation => setOptions(current => ({ ...current, orientation }))}
            options={ORIENTATION_OPTIONS}
          />
        </div>

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
