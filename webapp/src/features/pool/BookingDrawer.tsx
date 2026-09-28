import { useMemo, useState } from 'react';
import { Button, Drawer, SearchSelect, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';
import { slotTimes } from '#features/pool/index.web.mjs';
import type { PoolSettings } from '#features/pool/pool.types.d.mts';
import { saveBooking } from '@shared/pool/usePool';
import styles from './BookingDrawer.module.css';

const WEEKDAYS = [
  { value: 1, label: 'Luni' },
  { value: 2, label: 'Marți' },
  { value: 3, label: 'Miercuri' },
  { value: 4, label: 'Joi' },
  { value: 5, label: 'Vineri' },
];

export interface BookingDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  settings: PoolSettings;
  coaches: { id: string; name: string }[];
  today: string;
}

/** Programare nouă (22b): copil, antrenor, ziua săptămânii, oră — cu prețul lunii ca previzualizare. */
export function BookingDrawer({ open, onClose, onSaved, settings, coaches, today }: BookingDrawerProps) {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const toast = useToast();
  const [childId, setChildId] = useState('');
  const [coachId, setCoachId] = useState(coaches[0]?.id ?? '');
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const times = useMemo(() => slotTimes(settings), [settings]);

  const childOptions = useMemo(
    () =>
      records.children
        .filter((child: Child) => !child.archived)
        .map((child: Child) => ({ value: child.id, label: child.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ro')),
    [records.children],
  );

  async function submit() {
    if (!childId || !coachId || !time) {
      setError('Completează copilul, antrenorul și ora.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveBooking({ childId, coachId, weekday, time: time || times[0], startDate, endDate: null });
      toast.show({ message: 'Programare salvată.' });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      title="Programare nouă"
      width={520}
      onClose={onClose}
      footer={
        <Button disabled={saving} onClick={() => void submit()}>
          Salvează
        </Button>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          Copil
          <SearchSelect
            options={childOptions}
            value={childId}
            onChange={setChildId}
            ariaLabel="Copil"
            placeholder="Caută copilul…"
          />
        </label>
        <label className={styles.field}>
          Antrenor
          <select value={coachId} onChange={event => setCoachId(event.target.value)}>
            <option value="" disabled>
              Alege antrenorul
            </option>
            {coaches.map(coach => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          Ziua săptămânii
          <div className={styles.weekdays}>
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                type="button"
                className={weekday === day.value ? styles.weekdayActive : styles.weekday}
                onClick={() => setWeekday(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          Ora
          <select value={time} onChange={event => setTime(event.target.value)}>
            <option value="" disabled>
              Alege ora
            </option>
            {times.map(slot => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Din data
          <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
        </label>
        <p className={styles.price}>{settings.pricePerSession} lei / ședință</p>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Drawer>
  );
}
