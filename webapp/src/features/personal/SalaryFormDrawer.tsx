import { useState } from 'react';
import { Drawer, Field, MonthInput, NumberInput, Select, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Salary, SalaryMode, Staff } from '@shared/personal/personal.types';
import styles from './SalaryFormDrawer.module.css';
import { toUserError } from '@shared/api/to-user-error';

export interface SalaryFormDrawerProps {
  staff: Staff | null;
  /** Intrarea validă acum (F31) — precompletează formularul; `null` = niciun salariu setat încă. */
  currentSalary: Pick<Salary, 'id' | 'mode' | 'amount' | 'validFrom'> | null;
  onClose: () => void;
  onSubmit: (input: Omit<Salary, 'id'> & { id?: string; staffId: string; mode: SalaryMode }) => Promise<void>;
}

const MODE_OPTIONS: { value: SalaryMode; label: string }[] = [
  { value: 'fix', label: 'Fix — lei / lună' },
  { value: 'zi', label: 'Pe zi — lei × zile lucrate' },
  { value: 'bazin', label: 'Bazin — plătit din Bazin' },
];

function currentSalaryLabel(salary: Pick<Salary, 'mode' | 'amount' | 'validFrom'>): string {
  const since = `din ${formatMonthLabel(salary.validFrom)}`;
  if (salary.mode === 'bazin') return `plătit din Bazin ${since}`;
  const unit = salary.mode === 'zi' ? '/zi' : '/lună';
  return `${formatMoney(salary.amount)}${unit} ${since}`;
}

/**
 * Setează salariul (23c ⋯) — F31 (PROMPT-11 §19): precompletează cu salariul valabil acum, nu
 * pornește gol; schimbarea pe aceeași lună de start înlocuiește intrarea (același `id`), nu
 * adaugă una nouă; toate modurile (inclusiv Bazin) se pot salva.
 */
export function SalaryFormDrawer({ staff, currentSalary, onClose, onSubmit }: SalaryFormDrawerProps) {
  const toast = useToast();
  const [mode, setMode] = useState<SalaryMode>(currentSalary?.mode ?? 'fix');
  const [amount, setAmount] = useState(currentSalary ? String(currentSalary.amount) : '');
  const [validFrom, setValidFrom] = useState(currentSalary?.validFrom ?? today().slice(0, 7));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!staff || submitting) return;
    setSubmitting(true);
    try {
      // Aceeași lună de start ca intrarea curentă → înlocuiește (același id), nu dublează rândul.
      const id = currentSalary && currentSalary.validFrom === validFrom ? currentSalary.id : undefined;
      await onSubmit({ id, staffId: staff.id, mode, amount: Number(amount), validFrom });
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
      title={staff ? `Salariul: ${staff.name}` : 'Salariul'}
      size="detail"
      onClose={onClose}
      primary={{ label: 'Salvează salariul', form: 'salary-form-drawer', loading: submitting }}
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
        {currentSalary && <p className={styles.notice}>Acum: {currentSalaryLabel(currentSalary)}</p>}
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
