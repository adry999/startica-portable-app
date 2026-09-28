import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, LoadingState, Toggle, useToast } from '@shared/ui';
import { usePoolSettings } from '@shared/pool/usePool';
import type { PoolSettings as PoolSettingsValue } from '#features/pool/pool.types.d.mts';
import backupStyles from './BackupPage.module.css';

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
        <label className={backupStyles.field}>
          <Toggle checked={form.enabled} onChange={enabled => setForm({ ...form, enabled })} />
          Folosim bazinul la această filială
        </label>
        <label className={backupStyles.field}>
          Preț per ședință (lei)
          <input
            type="number"
            min={1}
            step={1}
            value={form.pricePerSession}
            onChange={event => setForm({ ...form, pricePerSession: Number(event.target.value) })}
          />
        </label>
        <label className={backupStyles.field}>
          Durata ședinței (minute)
          <input
            type="number"
            min={5}
            step={5}
            value={form.durationMin}
            onChange={event => setForm({ ...form, durationMin: Number(event.target.value) })}
          />
        </label>
        <label className={backupStyles.field}>
          Program de la
          <input
            type="time"
            value={form.hoursFrom}
            onChange={event => setForm({ ...form, hoursFrom: event.target.value })}
          />
        </label>
        <label className={backupStyles.field}>
          Program până la
          <input
            type="time"
            value={form.hoursTo}
            onChange={event => setForm({ ...form, hoursTo: event.target.value })}
          />
        </label>
        <label className={backupStyles.field}>
          Locuri pe oră (gol = fără limită)
          <input
            type="number"
            min={1}
            value={form.seatsPerSlot ?? ''}
            onChange={event =>
              setForm({ ...form, seatsPerSlot: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
        <label className={backupStyles.field}>
          <Toggle
            checked={form.chargeUnexcusedAbsence}
            onChange={chargeUnexcusedAbsence => setForm({ ...form, chargeUnexcusedAbsence })}
          />
          Lipsa nemotivată se taxează
        </label>
        <label className={backupStyles.field}>
          Plata antrenorului
          <select
            value={form.coachPayMode}
            onChange={event =>
              setForm({ ...form, coachPayMode: event.target.value as PoolSettingsValue['coachPayMode'] })
            }
          >
            <option value="per_child">Pe copil prezent</option>
            <option value="per_session">Pe ședință ținută</option>
          </select>
        </label>
        <label className={backupStyles.field}>
          Tarif antrenor (lei)
          <input
            type="number"
            min={1}
            value={form.coachRate}
            onChange={event => setForm({ ...form, coachRate: Number(event.target.value) })}
          />
        </label>
        <label className={backupStyles.field}>
          Ce aduce copilul (pe bonul de 58 mm)
          <input
            value={form.itemsNote}
            maxLength={300}
            placeholder="Costum de baie, cască, prosop, papuci."
            onChange={event => setForm({ ...form, itemsNote: event.target.value })}
          />
        </label>
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
