import { useEffect, useState } from 'react';
import { Button, IconButton, MonthStepper, SegmentedControl, useTopbarActions } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today, shiftDays } from '@domain/calendar-month.mjs';
import { formatDayLabel } from '#shared/format/date-format.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { shiftMonth } from '@shared/format/month-shift';
import { usePoolWeek, usePoolMonth, usePoolSettings } from '@shared/pool/usePool';
import { weekOf } from '#features/pool/index.web.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { TodayView } from './TodayView';
import { BookingDrawer } from './BookingDrawer';
import { buildTodaySessions, type TodaySession } from './today-sessions';
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

/** „Bazin · joi, 2 octombrie” — antetul paginii „Azi” (43b), literă mică pentru ziua săptămânii. */
function todayDateLabel(date: string): string {
  const label = formatDayLabel(date);
  return `Bazin · ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** Minutele de la miezul nopții, recalculate la fiecare minut — pentru ședința „în curs” (43b). */
function useMinutesNow(): number {
  const [minutes, setMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return minutes;
}

/** Ecranul „Bazin" (spec 23): comutator Săptămâna/Luna, ca la Prezența. */
export function PoolPage({ month }: PoolPageProps) {
  const [mode, setMode] = usePersistedState<'today' | 'week' | 'month'>('view.pool', 'week');
  const [weekDate, setWeekDate] = useState(() => today());
  const [monthKey, setMonthKey] = useState(month);
  const [bookingOpen, setBookingOpen] = useState(false);
  const settings = usePoolSettings();
  const week = usePoolWeek(weekDate);
  const monthData = usePoolMonth(monthKey);
  const session = useAppSession();
  const groups = (session.state.state as RecordsSnapshot).groups;
  const nowMinutes = useMinutesNow();
  const todayKey = today();

  /** 43b: „Marchează” deschide prezența la bazin pe ziua ședinței — reutilizează Săptămâna, fără UI de marcat nouă. */
  function markToday(_session: TodaySession) {
    setWeekDate(todayKey);
    setMode('week');
  }

  // „Azi” arată mereu ziua curentă — dacă utilizatorul a navigat în altă săptămână înainte să
  // comute pe „Azi”, readucem `weekDate` pe azi, altfel `week.days` n-ar conține ziua căutată.
  function changeMode(next: 'today' | 'week' | 'month') {
    if (next === 'today') setWeekDate(todayKey);
    setMode(next);
  }

  useTopbarActions(
    <>
      <SegmentedControl
        ariaLabel="Mod de afișare"
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'today', label: 'Azi' },
          { value: 'week', label: 'Săptămâna' },
          { value: 'month', label: 'Luna' },
        ]}
      />
      {mode === 'week' && (
        <>
          <div className={styles.weekNav}>
            <IconButton
              icon="chevron-left"
              ariaLabel="Săptămâna anterioară"
              className={styles.arrow}
              onClick={() => setWeekDate(shiftDays(weekDate, -7))}
            />
            <span>{weekRangeLabel(weekDate)}</span>
            <IconButton
              icon="chevron-right"
              ariaLabel="Săptămâna următoare"
              className={styles.arrow}
              onClick={() => setWeekDate(shiftDays(weekDate, 7))}
            />
          </div>
          {settings.settings && <Button onClick={() => setBookingOpen(true)}>+ Programare nouă</Button>}
        </>
      )}
      {mode === 'month' && (
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
      {mode === 'today' && (
        <TodayView
          status={week.loading ? 'loading' : 'ready'}
          dateLabel={todayDateLabel(todayKey)}
          sessions={buildTodaySessions(
            week.days.find(day => day.date === todayKey),
            settings.coaches,
            settings.settings?.durationMin ?? 0,
            nowMinutes,
          )}
          onMark={markToday}
        />
      )}
      {mode === 'week' && (
        <WeekView
          days={week.days}
          stats={week.stats}
          groups={groups}
          coaches={settings.coaches}
          onCycle={(bookingId, date, next) => void week.markSession(bookingId, date, next)}
        />
      )}
      {mode === 'month' && (
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
