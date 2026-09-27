import { useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Leave, LeaveType, Staff } from '@shared/personal/personal.types';
import styles from './LeaveFormDrawer.module.css';

export interface LeaveFormDrawerProps {
  open: boolean;
  staff: Staff[];
  onClose: () => void;
  onSubmit: (leave: Leave) => Promise<void>;
}

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'CO', label: 'Concediu de odihnă' },
  { value: 'CM', label: 'Concediu medical' },
  { value: 'FP', label: 'Fără plată' },
];

/** Formular concediu (23f) — angajat, tip, interval, planificat, notă. */
export function LeaveFormDrawer({ open, staff, onClose, onSubmit }: LeaveFormDrawerProps) {
  const toast = useToast();
  const staffSorted = [...staff].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const [staffId, setStaffId] = useState(staffSorted[0]?.id ?? '');
  const [type, setType] = useState<LeaveType>('CO');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [planned, setPlanned] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || !staffId) return;
    setSubmitting(true);
    try {
      await onSubmit({ id: `LV-${crypto.randomUUID()}`, staffId, from, to, type, planned, note: note || undefined });
      toast.show({ message: 'Concediul a fost salvat.' });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      title="Adaugă: concediu"
      width={480}
      onClose={onClose}
      footer={
        <Button type="submit" form="leave-form-drawer" disabled={submitting}>
          Salvează
        </Button>
      }
    >
      <form
        id="leave-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          Angajat
          <select required value={staffId} onChange={event => setStaffId(event.target.value)}>
            {staffSorted.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Tip
          <select value={type} onChange={event => setType(event.target.value as LeaveType)}>
            {LEAVE_TYPES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          De la
          <input required type="date" value={from} onChange={event => setFrom(event.target.value)} />
        </label>
        <label className={styles.field}>
          Până la
          <input required type="date" value={to} onChange={event => setTo(event.target.value)} />
        </label>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={planned} onChange={event => setPlanned(event.target.checked)} />
          Planificat (viitor)
        </label>
        <label className={styles.field}>
          Notă
          <textarea rows={2} value={note} onChange={event => setNote(event.target.value)} />
        </label>
      </form>
    </Drawer>
  );
}
