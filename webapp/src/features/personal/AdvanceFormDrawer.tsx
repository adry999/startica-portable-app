import { useState } from 'react';
import { AmountInput, Button, DateInput, Drawer, Field, Select, useToast, useUndoToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Staff } from '@shared/personal/personal.types';
import styles from './AdvanceFormDrawer.module.css';
import { toUserError } from '@shared/api/to-user-error';

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
  const undoToast = useUndoToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(METHODS[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!staff || submitting) return;
    setSubmitting(true);
    const staffName = staff.name;
    const amountNumber = Number(amount);
    try {
      // Avansul devine o cheltuială a filialei active (runRevisionTransaction) — trece prin
      // session.mutate, ca orice altă scriere pe branch, ca revizia să rămână corectă.
      const result = await session.mutate('/api/personal/advances', {
        advance: { staffId: staff.id, date, amount: amountNumber, method, month },
      });
      onSaved?.();
      onClose();
      toast.show({ message: 'Avansul a fost înregistrat.' });
      // 40b (tiparul de la cheltuială, §5 PROMPT-9), dar fără /api/undo generic — avansul nu
      // trăiește doar în `recordRepository` (ca o cheltuială obișnuită), ci și ca rând propriu în
      // `personalRepository` (advances), cu `expenseId` legat de cheltuiala auto-generată.
      // `/api/undo` ar reface doar cheltuiala, lăsând rândul de avans orfan (expenseId spre o
      // cheltuială ștearsă) — „Anulează” cere în schimb ștergerea corectă, deja existentă
      // (`/api/personal/advances` cu `remove:true`, ca în AdvancesTab), care arhivează
      // cheltuiala ȘI scoate avansul. Vezi INTREBARI.md pentru decizie.
      const advanceId = (result as { advance?: { id?: string } } | undefined)?.advance?.id;
      if (advanceId) {
        undoToast.show({
          title: 'Avans adăugat',
          detail: `${formatMoney(amountNumber)} · ${staffName}`,
          onUndo: () => session.mutate('/api/personal/advances', { id: advanceId, remove: true }),
        });
      }
    } catch (error) {
      toast.show({ message: toUserError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={staff !== null}
      title={staff ? `Avans: ${staff.name}` : 'Avans'}
      size="detail"
      onClose={onClose}
      footer={
        <Button type="submit" form="advance-form-drawer" loading={submitting}>
          Salvează
        </Button>
      }
    >
      <form
        id="advance-form-drawer"
        className={styles.form}
        autoComplete="off"
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
