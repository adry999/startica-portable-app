import { useState } from 'react';
import { Button, DayStepper, MonthStepper, SegmentedControl, useTopbarActions } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { shiftMonth } from '@shared/format/month-shift';
import { exportAttendanceMonth } from './attendance-export';
import { useAttendanceDay } from './useAttendanceDay';
import { useAttendanceMonth } from './useAttendanceMonth';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { SaveIndicator } from './SaveIndicator';

export interface AttendancePageProps {
  month: string;
}

const CURRENT_MONTH = today().slice(0, 7);

/** Ecranul „Prezența" (spec 19): comutator Ziua/Luna în antet, Ziua (18a) și Luna (18b). */
export function AttendancePage({ month }: AttendancePageProps) {
  const [mode, setMode] = usePersistedState<'day' | 'month'>('view.attendance', 'day');
  const [date, setDate] = useState(() => today());
  const [monthKey, setMonthKey] = useState(month);
  const dayData = useAttendanceDay(date);
  const monthData = useAttendanceMonth(monthKey);
  const activeData = mode === 'day' ? dayData : monthData;
  const saveIndicator = (
    <SaveIndicator
      saving={activeData.saving}
      saveError={activeData.saveError}
      savedAt={activeData.savedAt}
      unsavedCount={activeData.unsavedCount}
      onRetry={activeData.retry}
    />
  );

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
        {saveIndicator}
        {modeSwitch}
        <DayStepper value={date} max={today()} onChange={setDate} />
        <Button onClick={dayData.markAllUnmarkedPresent} disabled={dayData.counts.unmarked === 0}>
          Nemarcații ({dayData.counts.unmarked}) → prezenți
        </Button>
      </>
    ) : (
      <>
        {saveIndicator}
        {modeSwitch}
        <MonthStepper
          value={monthKey}
          onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
          onNext={() => setMonthKey(current => (current >= CURRENT_MONTH ? current : shiftMonth(current, 1)))}
        />
        <Button variant="ghost" onClick={() => window.print()}>
          Tipărește luna
        </Button>
        <Button
          variant="ghost"
          disabled={monthData.rows.length === 0}
          onClick={() => void exportAttendanceMonth(monthData.rows, monthData.dates, monthData.groupName, monthKey)}
        >
          Exportă
        </Button>
      </>
    ),
  );

  if (mode === 'month') return <MonthView month={monthKey} data={monthData} />;

  return <DayView data={dayData} />;
}
