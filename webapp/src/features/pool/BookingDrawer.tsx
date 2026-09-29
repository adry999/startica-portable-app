import { useMemo, useState } from 'react';
import { Button, Drawer, SearchSelect, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';
import { slotTimes } from '#features/pool/index.web.mjs';
import type { PoolSettings } from '#features/pool/pool.types.d.mts';
import { saveBooking, type WeekDay } from '@shared/pool/usePool';
import styles from './BookingDrawer.module.css';

const WEEKDAYS = [
  { value: 1, label: 'Lu' },
  { value: 2, label: 'Ma' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Jo' },
  { value: 5, label: 'Vi' },
];

export interface BookingDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  settings: PoolSettings;
  coaches: { id: string; name: string }[];
  today: string;
  /** Săptămâna deja încărcată de `PoolPage` (`usePoolWeek`) — reținută aici doar ca previzualizare
   * de ocupare pe cardurile de oră, ca să nu pornească un al doilea abonament la `/api/pool/week`
   * cât timp panoul stă montat (dar închis) în spatele ecranului. */
  weekDays: WeekDay[];
}

/** Programare nouă (22b): copil, antrenor, ziua săptămânii, oră — cu prețul lunii ca previzualizare. */
export function BookingDrawer({ open, onClose, onSaved, settings, coaches, today, weekDays }: BookingDrawerProps) {
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
  // Ocuparea reală a sloturilor (câți copii sunt deja programați), din săptămâna deja încărcată de
  // PoolPage — corectă cât timp „Începând cu” cade în săptămâna vizualizată curent (cazul obișnuit).
  const daySlots = weekDays[weekday - 1]?.slots ?? [];

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
      title="Programare la bazin"
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Renunță
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            Programează
          </Button>
        </>
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
          Ziua
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
        <div className={styles.field}>
          Ora
          <div className={styles.hours}>
            {times.map(slot => {
              const taken = daySlots.find(daySlot => daySlot.time === slot)?.entries.length ?? 0;
              const full = settings.seatsPerSlot != null && taken >= settings.seatsPerSlot;
              const active = time === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={full}
                  className={[styles.hourCard, active ? styles.hourCardActive : '', full ? styles.hourCardFull : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setTime(slot)}
                >
                  <span className={styles.hourTime}>{slot}</span>
                  <span className={styles.hourSeats}>{taken === 1 ? '1 copil' : `${taken} copii`}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            Începând cu
            <input
              type="date"
              className={styles.dateInput}
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
            />
          </label>
          <div className={styles.field}>
            Se repetă
            <span className={styles.staticValue}>Săptămânal</span>
          </div>
        </div>
        <p className={styles.priceNote}>
          Preț: <b>{settings.pricePerSession} lei</b> pe ședință, adăugat la taxa lunii după prezențe. Se poate
          schimba pentru acest copil în fișa lui.
        </p>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Drawer>
  );
}
