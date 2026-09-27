import { useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Salary, SalaryMode, Staff } from '@shared/personal/personal.types';
import styles from './SalaryFormDrawer.module.css';

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
      toast.show({ message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={staff !== null}
      title={staff ? `Setează salariul: ${staff.name}` : 'Setează salariul'}
      width={440}
      onClose={onClose}
      footer={
        <Button type="submit" form="salary-form-drawer" disabled={submitting || mode === 'bazin'}>
          Salvează
        </Button>
      }
    >
      <form
        id="salary-form-drawer"
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          Mod
          <select value={mode} onChange={event => setMode(event.target.value as SalaryMode)}>
            {MODE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {mode !== 'bazin' && (
          <label className={styles.field}>
            Sumă (lei)
            <input required type="number" min={0} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
        )}
        <label className={styles.field}>
          Valabil din luna
          <input required type="month" value={validFrom} onChange={event => setValidFrom(event.target.value)} />
        </label>
        {mode === 'bazin' && <p className={styles.notice}>Salariul unui antrenor de bazin vine din 23-Bazin.</p>}
      </form>
    </Drawer>
  );
}
