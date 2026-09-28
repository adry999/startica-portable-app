import { useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Staff } from '@shared/personal/personal.types';
import styles from './AdvanceFormDrawer.module.css';

export interface AdvanceFormDrawerProps {
  staff: Staff | null;
  month: string;
  onClose: () => void;
}

const METHODS = ['Cash', 'Card', 'Transfer'];

/** Avans (23c ⋯) — devine cheltuială din ziua dării; scăzut o singură dată, la plata salariului. */
export function AdvanceFormDrawer({ staff, month, onClose }: AdvanceFormDrawerProps) {
  const session = useAppSession();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(METHODS[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!staff || submitting) return;
    setSubmitting(true);
    try {
      // Avansul devine o cheltuială a filialei active (runRevisionTransaction) — trece prin
      // session.mutate, ca orice altă scriere pe branch, ca revizia să rămână corectă.
      await session.mutate('/api/personal/advances', {
        advance: { staffId: staff.id, date, amount: Number(amount), method, month },
      });
      toast.show({ message: 'Avansul a fost înregistrat.' });
      onClose();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={staff !== null}
      title={staff ? `Avans: ${staff.name}` : 'Avans'}
      width={420}
      onClose={onClose}
      footer={
        <Button type="submit" form="advance-form-drawer" disabled={submitting}>
          Salvează
        </Button>
      }
    >
      <form
        id="advance-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          Sumă (lei)
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          Data
          <input required type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className={styles.field}>
          Metoda
          <select value={method} onChange={event => setMethod(event.target.value)}>
            {METHODS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </form>
    </Drawer>
  );
}
