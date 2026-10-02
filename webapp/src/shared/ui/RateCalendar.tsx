import { buildMonthGrid } from '#shared/domain/month-grid.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { eurToMdlRate } from '#shared/domain/exchange-rates.mjs';
import { today } from '@domain/calendar-month.mjs';
import { shiftMonth } from '@shared/format/month-shift';
import { formatRate } from '#shared/format/rate-format.mjs';
import { Button } from './Button';
import { MonthCalendar, type MonthCalendarDay } from './MonthCalendar';
import { MonthStepper } from './MonthStepper';
import styles from './RateCalendar.module.css';

const WEEKDAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

export interface RateCalendarProps {
  /** Luna afișată, AAAA-LL. */
  month: string;
  onMonthChange: (month: string) => void;
  rates: Record<string, number>;
  sources: Record<string, 'bnm' | 'manual'>;
  /** „Vezi încă N zile” (38e) — apelantul decide câte (implicit 10). */
  onBackfill: () => void;
  backfilling?: boolean;
}

/**
 * Calendarul lunii cu cursul fiecărei zile (F12, 38e) — peste `MonthCalendar`: weekendul și o
 * sărbătoare legală arată cursul ultimei zile lucrătoare (gri, COMPONENTE.md §213), o zi
 * corectată manual e galbenă, o zi lipsă rămâne goală.
 */
export function RateCalendar({ month, onMonthChange, rates, sources, onBackfill, backfilling }: RateCalendarProps) {
  const weeks = buildMonthGrid(month, today());
  const days: MonthCalendarDay[] = weeks.flat().map(day => ({
    date: day.date,
    dayNumber: day.day,
    isCurrentMonth: day.inMonth,
    isToday: day.isToday,
    events: [],
  }));

  function renderCell(day: MonthCalendarDay) {
    const hasOwnRate = Object.hasOwn(rates, day.date);
    const rate = eurToMdlRate(rates, day.date);
    const weekendFallback = !hasOwnRate && !isWorkingDay(day.date) && rate !== undefined;
    const cellClass = weekendFallback ? styles.weekendCell : sources[day.date] === 'manual' ? styles.manualCell : '';
    return (
      <div className={`${styles.cell} ${cellClass}`}>
        <span className={styles.cellDay}>{day.dayNumber}</span>
        <span className={styles.cellRate}>{rate === undefined ? '' : formatRate(rate)}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <MonthStepper
        value={month}
        tone="white"
        onPrev={() => onMonthChange(shiftMonth(month, -1))}
        onNext={() => onMonthChange(shiftMonth(month, 1))}
      />
      <MonthCalendar weekdayLabels={WEEKDAY_LABELS} days={days} renderCell={renderCell} cellHeight={46} />
      <div className={styles.legend}>
        <span>
          <span className={`${styles.swatch} ${styles.weekendCell}`} /> weekend/sărbătoare: cursul zilei dinainte
        </span>
        <span>
          <span className={`${styles.swatch} ${styles.manualCell}`} /> corectat manual
        </span>
      </div>
      <div className={styles.footer}>
        <span className={styles.footerNote}>Salvat local, intră în backup.</span>
        <Button type="button" variant="link" onClick={onBackfill} disabled={backfilling}>
          Vezi încă 10 zile
        </Button>
      </div>
    </div>
  );
}
