import { useState } from 'react';
import { AmountInput, Button, DateInput, Drawer, Field, Select, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Staff } from '@shared/personal/personal.types';
import styles from './AdvanceFormDrawer.module.css';

export interface AdvanceFormDrawerProps {
  staff: Staff | null;
  month: string;
  onClose: () => void;
  /** M8: SalariesView nu reîncărca lista după un avans — coloanele „Avansuri”/„Net” rămâneau
   * vechi până la o remontare întâmplătoare. */
  onSaved?: () => void;
}

const METHODS = ['Cash', 'Card', 'Transfer'];

/** Avans (23c ⋯) — devine cheltuială din ziua dării; scăzut o singură dată, la plata salariului. */
export function AdvanceFormDrawer({ staff, month, onClose, onSaved }: AdvanceFormDrawerProps) {
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
      onSaved?.();
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
        <Field label="Sumă (lei)" htmlFor="advance-amount">
          <AmountInput id="advance-amount" required min={0} currency="lei" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Data" htmlFor="advance-date">
          <DateInput id="advance-date" required value={date} onChange={setDate} />
        </Field>
        <Field label="Metoda" htmlFor="advance-method">
          <Select
            id="advance-method"
            value={method}
            onChange={setMethod}
            options={METHODS.map(option => ({ value: option, label: option }))}
          />
        </Field>
      </form>
    </Drawer>
  );
}
