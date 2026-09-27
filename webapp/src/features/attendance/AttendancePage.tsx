import { useEffect, useState } from 'react';
import { Button, DayStepper, MonthStepper, SegmentedControl, useToast, useTopbarActions } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAttendanceDay } from './useAttendanceDay';
import { useAttendanceMonth } from './useAttendanceMonth';
import { DayView } from './DayView';
import { MonthView } from './MonthView';

export interface AttendancePageProps {
  month: string;
}

/** monthKey 'YYYY-MM' + delta luni. */
function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const CURRENT_MONTH = today().slice(0, 7);

/** Ecranul „Prezența" (spec 19): comutator Ziua/Luna în antet, Ziua (18a) și Luna (18b). */
export function AttendancePage({ month }: AttendancePageProps) {
  const [mode, setMode] = usePersistedState<'day' | 'month'>('view.attendance', 'day');
  const [date, setDate] = useState(() => today());
  const [monthKey, setMonthKey] = useState(month);
  const dayData = useAttendanceDay(date);
  const monthData = useAttendanceMonth(monthKey);
  const toast = useToast();

  const saveError = mode === 'day' ? dayData.saveError : monthData.saveError;
  useEffect(() => {
    if (saveError) toast.show({ message: saveError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);

  const modeSwitch = (
    <SegmentedControl
      ariaLabel="Mod de afișare"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'day', label: 'Ziua' },
        { value: 'month', label: 'Luna' },
      ]}
    />
  );

  useTopbarActions(
    mode === 'day' ? (
      <>
        {modeSwitch}
        <DayStepper value={date} max={today()} onChange={setDate} />
        <Button onClick={dayData.markAllUnmarkedPresent} disabled={dayData.counts.unmarked === 0}>
          Toți nemarcații → prezenți
        </Button>
      </>
    ) : (
      <>
        {modeSwitch}
        <MonthStepper
          value={monthKey}
          onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
          onNext={() => setMonthKey(current => (current >= CURRENT_MONTH ? current : shiftMonth(current, 1)))}
        />
      </>
    ),
  );

  if (mode === 'month') return <MonthView month={monthKey} data={monthData} />;

  return <DayView data={dayData} />;
}
