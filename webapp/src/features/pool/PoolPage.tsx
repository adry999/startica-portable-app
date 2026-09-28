import { useState } from 'react';
import { Button, MonthStepper, SegmentedControl, useTopbarActions } from '@shared/ui';
import { today, shiftDays } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { shiftMonth } from '@shared/format/month-shift';
import { usePoolWeek, usePoolMonth, usePoolSettings } from '@shared/pool/usePool';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { BookingDrawer } from './BookingDrawer';
import styles from './PoolPage.module.css';

export interface PoolPageProps {
  month: string;
}

/** Ecranul „Bazin" (spec 23): comutator Săptămâna/Luna, ca la Prezența. */
export function PoolPage({ month }: PoolPageProps) {
  const [mode, setMode] = usePersistedState<'week' | 'month'>('view.pool', 'week');
  const [weekDate, setWeekDate] = useState(() => today());
  const [monthKey, setMonthKey] = useState(month);
  const [bookingOpen, setBookingOpen] = useState(false);
  const settings = usePoolSettings();
  const week = usePoolWeek(weekDate);
  const monthData = usePoolMonth(monthKey);

  useTopbarActions(
    <>
      <SegmentedControl
        ariaLabel="Mod de afișare"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'week', label: 'Săptămâna' },
          { value: 'month', label: 'Luna' },
        ]}
      />
      {mode === 'week' ? (
        <>
          <div className={styles.weekNav}>
            <button
              type="button"
              aria-label="Săptămâna anterioară"
              onClick={() => setWeekDate(shiftDays(weekDate, -7))}
            >
              ‹
            </button>
            <span>Săptămâna curentă</span>
            <button type="button" aria-label="Săptămâna următoare" onClick={() => setWeekDate(shiftDays(weekDate, 7))}>
              ›
            </button>
          </div>
          {settings.settings && <Button onClick={() => setBookingOpen(true)}>+ Programare nouă</Button>}
        </>
      ) : (
        <MonthStepper
          value={monthKey}
          onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
          onNext={() => setMonthKey(shiftMonth(monthKey, 1))}
          tone="white"
        />
      )}
    </>,
  );

  if (!settings.loading && !settings.settings) {
    return (
      <div className={styles.notConfigured}>
        <p>Bazinul nu este configurat pentru această filială.</p>
        <p>Configurează-l în Backup și setări → Bazin.</p>
      </div>
    );
  }

  return (
    <>
      {mode === 'week' ? (
        <WeekView
          days={week.days}
          stats={week.stats}
          onCycle={(bookingId, date, next) => void week.markSession(bookingId, date, next)}
        />
      ) : (
        <MonthView
          month={monthKey}
          children={monthData.children}
          coaches={monthData.coaches}
          closing={monthData.closing}
          unmarked={monthData.unmarked}
          closingBusy={monthData.closingBusy}
          closeError={monthData.closeError}
          onCloseMonth={() => monthData.closeMonth('cash', today())}
        />
      )}
      {settings.settings && (
        <BookingDrawer
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onSaved={() => void week.reload()}
          settings={settings.settings}
          coaches={settings.coaches}
          today={today()}
        />
      )}
    </>
  );
}
