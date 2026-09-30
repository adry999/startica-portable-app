import { useMemo, useState } from 'react';
import { Button, ChipSelect, ChoiceCards, DateInput, Drawer, Field, SearchSelect, Select, useToast } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';
import { slotTimes } from '#features/pool/index.web.mjs';
import type { PoolSettings } from '#features/pool/pool.types.d.mts';
import { saveBooking, type WeekDay } from '@shared/pool/usePool';
import styles from './BookingDrawer.module.css';

const WEEKDAYS = [
  { value: '1', label: 'Lu' },
  { value: '2', label: 'Ma' },
  { value: '3', label: 'Mi' },
  { value: '4', label: 'Jo' },
  { value: '5', label: 'Vi' },
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
        <div className={styles.field}>
          Copil
          <SearchSelect
            options={childOptions}
            value={childId}
            onChange={setChildId}
            ariaLabel="Copil"
            placeholder="Caută copilul…"
          />
        </div>
        <Field label="Antrenor" htmlFor="booking-coach">
          <Select
            id="booking-coach"
            value={coachId}
            onChange={setCoachId}
            placeholder="Alege antrenorul"
            options={coaches.map(coach => ({ value: coach.id, label: coach.name }))}
          />
        </Field>
        <div className={styles.field}>
          Ziua
          <ChipSelect
            ariaLabel="Ziua"
            value={String(weekday)}
            onChange={value => setWeekday(Number(value))}
            options={WEEKDAYS}
          />
        </div>
        <div className={styles.field}>
          Ora
          <ChoiceCards
            ariaLabel="Ora"
            value={time}
            onChange={setTime}
            columns={times.length}
            options={times.map(slot => {
              const taken = daySlots.find(daySlot => daySlot.time === slot)?.entries.length ?? 0;
              const full = settings.seatsPerSlot != null && taken >= settings.seatsPerSlot;
              return {
                value: slot,
                title: slot,
                sub: taken === 1 ? '1 copil' : `${taken} copii`,
                disabled: full,
              };
            })}
          />
        </div>
        <div className={styles.grid2}>
          <Field label="Începând cu" htmlFor="booking-start-date">
            <DateInput id="booking-start-date" value={startDate} onChange={setStartDate} />
          </Field>
          <div className={styles.field}>
            Se repetă
            <span className={styles.staticValue}>Săptămânal</span>
          </div>
        </div>
        <p className={styles.priceNote}>
          Preț: <b>{settings.pricePerSession} lei</b> pe ședință, adăugat la taxa lunii după prezențe. Se poate schimba
          pentru acest copil în fișa lui.
        </p>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Drawer>
  );
}
