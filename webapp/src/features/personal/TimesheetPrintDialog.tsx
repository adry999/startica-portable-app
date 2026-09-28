import { useState } from 'react';
import { Button } from '@shared/ui';
import type { Department, Staff } from '@shared/personal/personal.types';
import styles from './TimesheetPrintDialog.module.css';

export type TimesheetPrintScope = 'all' | 'department' | 'staff';
export type TimesheetPrintDisplay = 'hours' | 'present';

export interface TimesheetPrintOptions {
  scope: TimesheetPrintScope;
  targetId?: string;
  display: TimesheetPrintDisplay;
}

export interface TimesheetPrintDialogProps {
  open: boolean;
  departments: Department[];
  staff: Staff[];
  onCancel: () => void;
  onConfirm: (options: TimesheetPrintOptions) => void;
}

/** Dialogul „Ce tipăresc?” din 23k — toți / un departament / un angajat. */
export function TimesheetPrintDialog({ open, departments, staff, onCancel, onConfirm }: TimesheetPrintDialogProps) {
  const [scope, setScope] = useState<TimesheetPrintScope>('all');
  const [targetId, setTargetId] = useState('');
  const [display, setDisplay] = useState<TimesheetPrintDisplay>('hours');

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Tipărește pontajul"
        onClick={event => event.stopPropagation()}
      >
        <h2 className={styles.title}>Tipărește pontajul</h2>

        <fieldset className={styles.field}>
          <legend>Ce tipăresc?</legend>
          <label>
            <input type="radio" name="ts-print-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
            Toți angajații
          </label>
          <label>
            <input
              type="radio"
              name="ts-print-scope"
              checked={scope === 'department'}
              onChange={() => setScope('department')}
            />
            Un departament
          </label>
          <label>
            <input type="radio" name="ts-print-scope" checked={scope === 'staff'} onChange={() => setScope('staff')} />
            Un angajat
          </label>
        </fieldset>

        {scope === 'department' && (
          <select value={targetId} onChange={event => setTargetId(event.target.value)}>
            <option value="">Alege departament…</option>
            {departments.map(department => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        )}

        {scope === 'staff' && (
          <select value={targetId} onChange={event => setTargetId(event.target.value)}>
            <option value="">Alege angajat…</option>
            {staff.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        )}

        <fieldset className={styles.field}>
          <legend>Cum arăt zilele?</legend>
          <label>
            <input
              type="radio"
              name="ts-print-display"
              checked={display === 'hours'}
              onChange={() => setDisplay('hours')}
            />
            Ore lucrate („8”)
          </label>
          <label>
            <input
              type="radio"
              name="ts-print-display"
              checked={display === 'present'}
              onChange={() => setDisplay('present')}
            />
            Prezență („P”)
          </label>
        </fieldset>

        <div className={styles.actions}>
          <Button variant="white" onClick={onCancel}>
            Anulează
          </Button>
          <Button onClick={() => onConfirm({ scope, targetId: targetId || undefined, display })}>Tipărește</Button>
        </div>
      </div>
    </div>
  );
}
