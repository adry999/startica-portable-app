import { useState } from 'react';
import { Button, Drawer, Field, MonthInput, NumberInput, Select, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Salary, SalaryMode, Staff } from '@shared/personal/personal.types';
import styles from './SalaryFormDrawer.module.css';
import { toUserError } from '@shared/api/to-user-error';

export interface SalaryFormDrawerProps {
  staff: Staff | null;
  onClose: () => void;
  onSubmit: (input: Omit<Salary, 'id'> & { staffId: string; mode: SalaryMode }) => Promise<void>;
}

const MODE_OPTIONS: { value: SalaryMode; label: string }[] = [
  { value: 'fix', label: 'Fix — lei / lună' },
  { value: 'zi', label: 'Pe zi — lei × zile lucrate' },
  { value: 'bazin', label: 'Bazin — plătit din Bazin' },
];

/** Setează salariul (23c ⋯) — istoric pe luni, `validFrom` marchează începutul valabilității. */
export function SalaryFormDrawer({ staff, onClose, onSubmit }: SalaryFormDrawerProps) {
  const toast = useToast();
  const [mode, setMode] = useState<SalaryMode>('fix');
  const [amount, setAmount] = useState('');
  const [validFrom, setValidFrom] = useState(today().slice(0, 7));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!staff || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ staffId: staff.id, mode, amount: Number(amount), validFrom });
      toast.show({ message: 'Salariul a fost salvat.' });
      onClose();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={staff !== null}
      title={staff ? `Setează salariul: ${staff.name}` : 'Setează salariul'}
      size="detail"
      onClose={onClose}
      footer={
        <Button type="submit" form="salary-form-drawer" loading={submitting} disabled={mode === 'bazin'}>
          Salvează
        </Button>
      }
    >
      <form
        id="salary-form-drawer"
        className={styles.form}
        autoComplete="off"
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <Field label="Mod" htmlFor="salary-mode">
          <Select
            id="salary-mode"
            value={mode}
            onChange={value => setMode(value as SalaryMode)}
            options={MODE_OPTIONS}
          />
        </Field>
        {mode !== 'bazin' && (
          <Field label="Sumă (lei)" htmlFor="salary-amount">
            <NumberInput id="salary-amount" required min={0} value={amount} onChange={setAmount} />
          </Field>
        )}
        <Field label="Valabil din luna" htmlFor="salary-valid-from">
          <MonthInput id="salary-valid-from" required value={validFrom} onChange={setValidFrom} />
        </Field>
        {mode === 'bazin' && <p className={styles.notice}>Salariul unui antrenor de bazin vine din 23-Bazin.</p>}
      </form>
    </Drawer>
  );
}
