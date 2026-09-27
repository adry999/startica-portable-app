import { useEffect, useState } from 'react';
import { Button, DayStepper, SegmentedControl, useToast, useTopbarActions } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAttendanceDay } from './useAttendanceDay';
import { DayView } from './DayView';

export interface AttendancePageProps {
  month: string;
}

/** Ecranul „Prezența" (spec 19): comutator Ziua/Luna în antet, Ziua (18a) implementată aici, Luna în task-ul 10. */
export function AttendancePage({ month }: AttendancePageProps) {
  const [mode, setMode] = usePersistedState<'day' | 'month'>('view.attendance', 'day');
  const [date, setDate] = useState(() => today());
  const dayData = useAttendanceDay(date);
  const toast = useToast();

  useEffect(() => {
    if (dayData.saveError) toast.show({ message: dayData.saveError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayData.saveError]);

  useTopbarActions(
    mode === 'day' ? (
      <>
        <SegmentedControl
          ariaLabel="Mod de afișare"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'day', label: 'Ziua' },
            { value: 'month', label: 'Luna' },
          ]}
        />
        <DayStepper value={date} max={today()} onChange={setDate} />
        <Button onClick={dayData.markAllUnmarkedPresent} disabled={dayData.counts.unmarked === 0}>
          Toți nemarcații → prezenți
        </Button>
      </>
    ) : (
      <SegmentedControl
        ariaLabel="Mod de afișare"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: 'Ziua' },
          { value: 'month', label: 'Luna' },
        ]}
      />
    ),
  );

  if (mode === 'month') return <p>Vizualizarea pe lună ({month}) urmează.</p>;

  return <DayView data={dayData} />;
}
