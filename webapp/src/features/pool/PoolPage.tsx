import { useState } from 'react';
import { Button, MonthStepper, SegmentedControl, useTopbarActions } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today, shiftDays } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { shiftMonth } from '@shared/format/month-shift';
import { usePoolWeek, usePoolMonth, usePoolSettings } from '@shared/pool/usePool';
import { weekOf } from '#features/pool/index.web.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { BookingDrawer } from './BookingDrawer';
import styles from './PoolPage.module.css';

export interface PoolPageProps {
  month: string;
}

const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** „28 sep – 2 oct” — eticheta din antetul săptămânii (22a), reflectă săptămâna afișată, nu una fixă. */
function weekRangeLabel(weekDate: string): string {
  const [from, , , , to] = weekOf(weekDate);
  const fromDay = Number(from.slice(8, 10));
  const toDay = Number(to.slice(8, 10));
  const fromMonth = MONTHS_SHORT[Number(from.slice(5, 7)) - 1] ?? '';
  const toMonth = MONTHS_SHORT[Number(to.slice(5, 7)) - 1] ?? '';
  return fromMonth === toMonth ? `${fromDay}–${toDay} ${toMonth}` : `${fromDay} ${fromMonth} – ${toDay} ${toMonth}`;
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
  const session = useAppSession();
  const groups = (session.state.state as RecordsSnapshot).groups;

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
            <span>{weekRangeLabel(weekDate)}</span>
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
          groups={groups}
          coaches={settings.coaches}
          onCycle={(bookingId, date, next) => void week.markSession(bookingId, date, next)}
        />
      ) : (
        <MonthView
          month={monthKey}
          children={monthData.children}
          groups={groups}
          coaches={monthData.coaches}
          closing={monthData.closing}
          unmarked={monthData.unmarked}
          closingBusy={monthData.closingBusy}
          closeError={monthData.closeError}
          onCloseMonth={() => monthData.closeMonth('cash', today())}
          onReload={() => void monthData.reload()}
        />
      )}
      {settings.settings && (
        <BookingDrawer
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onSaved={() => {
            void week.reload();
            void monthData.reload();
          }}
          settings={settings.settings}
          coaches={settings.coaches}
          today={today()}
          weekDays={week.days}
        />
      )}
    </>
  );
}
