import { useEffect, useRef, useState } from 'react';
import { today } from '@domain/calendar-month.mjs';
import styles from './MonthPicker.module.css';

const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

const ARROW_OFFSETS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };

export interface MonthPickerProps {
  /** YYYY-MM. Lipsă/gol pică pe luna curentă, la fel ca readSelectedMonth() din vanilla. */
  value: string;
  onChange: (value: string) => void;
}

function monthParts(value: string) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/** Pill „‹ Luna Anul ›" — deschide un meniu cu navigare pe an și grilă de luni. */
export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const resolvedValue = value || today().slice(0, 7);
  const { year, month } = monthParts(resolvedValue);
  const [open, setOpen] = useState(false);
  const [menuYear, setMenuYear] = useState(year);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    // Anul din meniu pornește mereu de la anul selectat curent, la fiecare deschidere.
    if (open) setMenuYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  function pick(monthValue: string) {
    onChange(monthValue);
    setOpen(false);
  }

  function onOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number, options: string[]) {
    let nextIndex: number | null = null;
    if (event.key in ARROW_OFFSETS) nextIndex = (index + ARROW_OFFSETS[event.key] + options.length) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    optionRefs.current[options[nextIndex]]?.focus();
  }

  const options = MONTH_NAMES.map((_, index) => `${menuYear}-${String(index + 1).padStart(2, '0')}`);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        aria-label="Luna anterioară"
        className={styles.arrow}
        onClick={() =>
          pick(`${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`)
        }
      >
        ‹
      </button>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {MONTH_NAMES[month - 1]} {year}
      </button>
      <button
        type="button"
        aria-label="Luna următoare"
        className={styles.arrow}
        onClick={() =>
          pick(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`)
        }
      >
        ›
      </button>

      {open && (
        <div className={styles.menu} role="dialog" aria-label="Alege luna">
          <div className={styles.menuHead}>
            <button type="button" aria-label="Anul precedent" onClick={() => setMenuYear(y => y - 1)}>
              ‹
            </button>
            <strong>{menuYear}</strong>
            <button type="button" aria-label="Anul următor" onClick={() => setMenuYear(y => y + 1)}>
              ›
            </button>
          </div>
          <div className={styles.options} role="listbox" aria-label="Alege luna">
            {MONTH_NAMES.map((name, index) => {
              const optionValue = options[index];
              const selected = optionValue === resolvedValue;
              return (
                <button
                  key={optionValue}
                  ref={el => {
                    optionRefs.current[optionValue] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? `${styles.option} ${styles.optionSelected}` : styles.option}
                  onClick={() => pick(optionValue)}
                  onKeyDown={event => onOptionKeyDown(event, index, options)}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
