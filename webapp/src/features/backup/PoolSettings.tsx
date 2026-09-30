import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, LoadingState, NumberInput, Select, TextInput, Toggle, useToast } from '@shared/ui';
import { usePoolSettings } from '@shared/pool/usePool';
import type { PoolSettings as PoolSettingsValue } from '#features/pool/pool.types.d.mts';
import backupStyles from './BackupPage.module.css';
import styles from './PoolSettings.module.css';

const COACH_PAY_MODE_OPTIONS: { value: PoolSettingsValue['coachPayMode']; label: string }[] = [
  { value: 'per_child', label: 'Pe copil prezent' },
  { value: 'per_session', label: 'Pe ședință ținută' },
];

/** Fila „Bazin” din Backup și setări (22d) — formular pe setările per filială, cu semințele ca prefill. */
export function PoolSettings() {
  const pool = usePoolSettings();
  const toast = useToast();
  const [form, setForm] = useState<PoolSettingsValue | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pool.loading) setForm(pool.settings ?? pool.seed);
  }, [pool.loading, pool.settings, pool.seed]);

  if (pool.loading || !form) return <LoadingState />;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const saved = await pool.save(form);
      setForm(saved);
      toast.show({ message: 'Setările bazinului au fost salvate.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={backupStyles.panel}>
      <h3 className={backupStyles.panelTitle}>Bazin</h3>
      <form className={backupStyles.form} onSubmit={event => void save(event)}>
        <label className={styles.toggleRow}>
          <Toggle checked={form.enabled} onChange={enabled => setForm({ ...form, enabled })} />
          Folosim bazinul la această filială
        </label>
        <Field label="Preț per ședință (lei)" htmlFor="pool-price">
          <NumberInput
            id="pool-price"
            min={1}
            step={1}
            value={String(form.pricePerSession)}
            onChange={value => setForm({ ...form, pricePerSession: Number(value) })}
            suffix="lei"
          />
        </Field>
        <Field label="Durata ședinței (minute)" htmlFor="pool-duration">
          <NumberInput
            id="pool-duration"
            min={5}
            step={5}
            value={String(form.durationMin)}
            onChange={value => setForm({ ...form, durationMin: Number(value) })}
            suffix="minute"
          />
        </Field>
        {/* type="time" rămâne brut — nu există încă un `TimeInput`/`TimePicker` în @shared/ui
            (COMPONENTE.md §0e/30c), la fel ca type="month" din ChildFormDrawer. */}
        <label className={styles.field}>
          Program de la
          <input
            type="time"
            value={form.hoursFrom}
            onChange={event => setForm({ ...form, hoursFrom: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          Program până la
          <input
            type="time"
            value={form.hoursTo}
            onChange={event => setForm({ ...form, hoursTo: event.target.value })}
          />
        </label>
        <Field label="Locuri pe oră (gol = fără limită)" htmlFor="pool-seats">
          <NumberInput
            id="pool-seats"
            min={1}
            step={1}
            value={form.seatsPerSlot != null ? String(form.seatsPerSlot) : ''}
            onChange={value => setForm({ ...form, seatsPerSlot: value ? Number(value) : null })}
          />
        </Field>
        <label className={styles.toggleRow}>
          <Toggle
            checked={form.chargeUnexcusedAbsence}
            onChange={chargeUnexcusedAbsence => setForm({ ...form, chargeUnexcusedAbsence })}
          />
          Lipsa nemotivată se taxează
        </label>
        <Field label="Plata antrenorului" htmlFor="pool-coach-pay-mode">
          <Select
            id="pool-coach-pay-mode"
            value={form.coachPayMode}
            onChange={value => setForm({ ...form, coachPayMode: value as PoolSettingsValue['coachPayMode'] })}
            options={COACH_PAY_MODE_OPTIONS}
          />
        </Field>
        <Field label="Tarif antrenor (lei)" htmlFor="pool-coach-rate">
          <NumberInput
            id="pool-coach-rate"
            min={1}
            step={1}
            value={String(form.coachRate)}
            onChange={value => setForm({ ...form, coachRate: Number(value) })}
            suffix="lei"
          />
        </Field>
        <Field label="Ce aduce copilul (pe bonul de 58 mm)" htmlFor="pool-items-note">
          <TextInput
            id="pool-items-note"
            value={form.itemsNote}
            maxLength={300}
            placeholder="Costum de baie, cască, prosop, papuci."
            onChange={value => setForm({ ...form, itemsNote: value })}
          />
        </Field>
        <p className={backupStyles.notice}>
          Antrenorii se aleg din Personal, funcția „Antrenor bazin”.{' '}
          {pool.coaches.length === 0
            ? 'Niciun antrenor încă — adaugă-l în Personal.'
            : `${pool.coaches.length} antrenor(i) disponibil(i).`}
        </p>
        <Button type="submit" disabled={busy}>
          Salvează
        </Button>
      </form>
    </Card>
  );
}
