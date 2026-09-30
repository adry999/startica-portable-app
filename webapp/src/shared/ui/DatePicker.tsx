import { useState } from 'react';
import { DateInput } from './DateInput';
import { IconButton } from './IconButton';
import { Popover } from './Popover';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  /** ISO `aaaa-ll-zz`, poate fi `''`. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  isDateDisabled?: (date: string) => boolean;
  ariaLabel?: string;
  className?: string;
}

const WEEKDAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

const MONTH_LABELS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

function parseISODate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // luni = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

/**
 * Câmp de dată cu tastare directă (`DateInput`) + calendar popup (COMPONENTE.md §0e, 30a).
 * Simplificat pentru v1: doar selecție unică (fără `mode: 'range'`) și fără navigare completă
 * cu tastatura în grila de zile — vezi raportul de livrare al lotului pentru detalii.
 */
export function DatePicker({ value, onChange, min, max, isDateDisabled, ariaLabel, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  function toggle() {
    if (!open) {
      const base = selected ?? today;
      setView({ year: base.getFullYear(), month: base.getMonth() });
    }
    setOpen(current => !current);
  }

  function goToPrevMonth() {
    setView(current =>
      current.month === 0 ? { year: current.year - 1, month: 11 } : { year: current.year, month: current.month - 1 },
    );
  }

  function goToNextMonth() {
    setView(current =>
      current.month === 11 ? { year: current.year + 1, month: 0 } : { year: current.year, month: current.month + 1 },
    );
  }

  function selectDay(date: Date) {
    onChange(toISODate(date));
    setOpen(false);
  }

  const cells = buildMonthGrid(view.year, view.month);
  const todayISO = toISODate(today);
  const classes = [styles.root, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className={styles.field}>
        <DateInput
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          ariaLabel={ariaLabel}
          className={styles.input}
        />
        <IconButton icon="chevron-down" ariaLabel="Deschide calendarul" onClick={toggle} />
      </div>
      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel="Calendar" className={styles.popover}>
          <div className={styles.header}>
            <IconButton icon="chevron-left" ariaLabel="Luna precedentă" onClick={goToPrevMonth} />
            <span className={styles.monthLabel}>
              {MONTH_LABELS[view.month]} {view.year}
            </span>
            <IconButton icon="chevron-right" ariaLabel="Luna următoare" onClick={goToNextMonth} />
          </div>
          <div className={styles.weekdays}>
            {WEEKDAY_LABELS.map(label => (
              <span key={label} className={styles.weekday}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.days}>
            {cells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className={styles.dayEmpty} />;
              const iso = toISODate(date);
              const disabled =
                (min !== undefined && iso < min) || (max !== undefined && iso > max) || Boolean(isDateDisabled?.(iso));
              const isSelected = iso === value;
              const isToday = iso === todayISO;
              const dayClasses = [
                styles.day,
                isSelected ? styles.selected : '',
                isToday ? styles.today : '',
                disabled ? styles.disabled : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={iso}
                  type="button"
                  className={dayClasses}
                  disabled={disabled}
                  onClick={() => selectDay(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </Popover>
      )}
    </div>
  );
}
