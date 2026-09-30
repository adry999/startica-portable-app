import { useState } from 'react';
import { Button, Dialog, Field, SegmentedControl, Select } from '@shared/ui';
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

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Toți angajații' },
  { value: 'department', label: 'Un departament' },
  { value: 'staff', label: 'Un angajat' },
] as const;

const DISPLAY_OPTIONS = [
  { value: 'hours', label: 'Ore lucrate („8”)' },
  { value: 'present', label: 'Prezență („P”)' },
] as const;

/** Dialogul „Ce tipăresc?” din 23k — toți / un departament / un angajat. */
export function TimesheetPrintDialog({ open, departments, staff, onCancel, onConfirm }: TimesheetPrintDialogProps) {
  const [scope, setScope] = useState<TimesheetPrintScope>('all');
  const [targetId, setTargetId] = useState('');
  const [display, setDisplay] = useState<TimesheetPrintDisplay>('hours');

  return (
    <Dialog
      open={open}
      title="Tipărește pontajul"
      width={380}
      onClose={onCancel}
      footer={
        <>
          <Button variant="white" onClick={onCancel}>
            Anulează
          </Button>
          <Button onClick={() => onConfirm({ scope, targetId: targetId || undefined, display })}>Tipărește</Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Ce tipăresc?</span>
          <SegmentedControl ariaLabel="Ce tipăresc?" value={scope} onChange={setScope} options={SCOPE_OPTIONS} />
        </div>

        {scope === 'department' && (
          <Field label="Departament" htmlFor="ts-print-department">
            <Select
              id="ts-print-department"
              value={targetId}
              onChange={setTargetId}
              placeholder="Alege departament…"
              options={departments.map(department => ({ value: department.id, label: department.name }))}
            />
          </Field>
        )}

        {scope === 'staff' && (
          <Field label="Angajat" htmlFor="ts-print-staff">
            <Select
              id="ts-print-staff"
              value={targetId}
              onChange={setTargetId}
              placeholder="Alege angajat…"
              options={staff.map(person => ({ value: person.id, label: person.name }))}
            />
          </Field>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Cum arăt zilele?</span>
          <SegmentedControl
            ariaLabel="Cum arăt zilele?"
            value={display}
            onChange={setDisplay}
            options={DISPLAY_OPTIONS}
          />
        </div>
      </div>
    </Dialog>
  );
}
