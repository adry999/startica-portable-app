import { useEffect, useState } from 'react';
import {
  Button,
  DayStepper,
  MonthStepper,
  SaveIndicator,
  SegmentedControl,
  UndoHistory,
  useTopbarActions,
} from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { usePersistedState } from '@shared/state/usePersistedState';
import { shiftMonth } from '@shared/format/month-shift';
import { exportAttendanceMonth } from './attendance-export';
import { useAttendanceDay } from './useAttendanceDay';
import { useAttendanceMonth } from './useAttendanceMonth';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { WeeklySheetDialog } from './WeeklySheetDialog';

/** Butonul „Foi pe săptămână” e principal doar lunea (26-foaie-saptamana.md §3). */
function isMonday(dateIso: string): boolean {
  return new Date(`${dateIso}T12:00:00`).getDay() === 1;
}

export interface AttendancePageProps {
  month: string;
}

const CURRENT_MONTH = today().slice(0, 7);

/** Ecranul „Prezența" (spec 19): comutator Ziua/Luna în antet, Ziua (18a) și Luna (18b). */
export function AttendancePage({ month }: AttendancePageProps) {
  const [mode, setMode] = usePersistedState<'day' | 'month'>('view.attendance', 'day');
  const [date, setDate] = useState(() => today());
  const [monthKey, setMonthKey] = useState(month);
  const [weeklySheetOpen, setWeeklySheetOpen] = useState(false);
  const isCurrentMonday = isMonday(today());
  const weeklySheetButtonStyle = isCurrentMonday
    ? undefined
    : { borderColor: 'var(--orange)', color: 'var(--orange-ink)' };
  const dayData = useAttendanceDay(date);
  const monthData = useAttendanceMonth(monthKey);
  const activeData = mode === 'day' ? dayData : monthData;

  // Ctrl+Z anulează ultima acțiune a filei active (A3c/A3e), indiferent unde e focusul pe pagină.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        activeData.undoLast();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeData.undoLast]);
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
        <UndoHistory
          history={dayData.history}
          canUndo={dayData.canUndo}
          onUndoLast={dayData.undoLast}
          onUndoUntil={dayData.undoUntil}
          onUndoAll={dayData.undoAll}
        />
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
        <UndoHistory
          history={monthData.history}
          canUndo={monthData.canUndo}
          onUndoLast={monthData.undoLast}
          onUndoUntil={monthData.undoUntil}
          onUndoAll={monthData.undoAll}
        />
        <Button
          variant={isCurrentMonday ? 'primary' : 'outline'}
          size="header"
          style={weeklySheetButtonStyle}
          onClick={() => setWeeklySheetOpen(true)}
        >
          Foi pe săptămână
        </Button>
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

  return (
    <>
      {mode === 'month' ? (
        <MonthView month={monthKey} data={monthData} />
      ) : (
        <DayView
          data={dayData}
          onOpenWeeklySheet={() => setWeeklySheetOpen(true)}
          weeklySheetIsMonday={isCurrentMonday}
        />
      )}
      {weeklySheetOpen && <WeeklySheetDialog onClose={() => setWeeklySheetOpen(false)} />}
    </>
  );
}
