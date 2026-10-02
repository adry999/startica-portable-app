import { useEffect, useRef, useState, type ReactNode } from 'react';
import { today } from '@domain/calendar-month.mjs';
import { Icon } from './Icon';
import styles from './MonthInput.module.css';

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

export type MonthMarker = 'paid' | 'debt' | 'used';

export interface MonthInputProps {
  id?: string;
  /** ISO `aaaa-ll`. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  trailing?: ReactNode;
  className?: string;
  /** §3 (PROMPT-11 F17): punct de stare pe lună — achitată/restanță/deja aleasă pe alt rând. */
  markers?: Record<string, MonthMarker>;
  /** Lună dezactivată independent de `min`/`max` (ex. deja aleasă pe alt rând de repartizare). */
  isDisabled?: (month: string) => boolean;
}

function monthParts(value: string) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function formatMonthFull(value: string): string {
  const { year, month } = monthParts(value);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Câmp de lună (25b, `COMPONENTE.md` §0 · PROMPT-11 §3) — popover propriu (an cu ‹ ›, grilă 4×3),
 * în loc de `<input type="month">` nativ (popover-ul browserului, în engleză, fără `markers`/
 * `isDisabled`). `required` nu are o versiune nativă pe un buton — un câmp text vizual-ascuns (NU
 * `type="hidden"`, care e scutit de validare) ține browserul blocând trimiterea formularului la fel
 * ca înainte, fără să apară pe ecran.
 */
export function MonthInput({
  id,
  value,
  onChange,
  min,
  max,
  required,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  autoFocus,
  trailing,
  className,
  markers,
  isDisabled,
}: MonthInputProps) {
  const [open, setOpen] = useState(false);
  const { year: initialYear } = monthParts(value || today().slice(0, 7));
  const [menuYear, setMenuYear] = useState(initialYear);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (open) setMenuYear(monthParts(value || today().slice(0, 7)).year);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  function monthDisabled(month: string): boolean {
    if (min && month < min) return true;
    if (max && month > max) return true;
    return Boolean(isDisabled?.(month));
  }

  function pick(month: string) {
    if (monthDisabled(month)) return;
    onChange(month);
    setOpen(false);
    triggerRef.current?.focus();
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
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes} ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={styles.input}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => setOpen(current => !current)}
      >
        {value ? formatMonthFull(value) : 'Alege luna'}
      </button>
      {required && (
        // Vizual ascuns, dar NU `type="hidden"` (scutit de constrângeri) — blochează trimiterea
        // formularului cât timp nu s-a ales nicio lună, la fel ca `<input type="month" required>`.
        <input
          type="text"
          value={value}
          required
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className={styles.validityMirror}
          onChange={() => {}}
        />
      )}
      {trailing && <span className={styles.affix}>{trailing}</span>}

      {open && (
        <div className={styles.menu} role="dialog" aria-label="Alege luna">
          <div className={styles.menuHead}>
            <button type="button" aria-label="Anul precedent" onClick={() => setMenuYear(y => y - 1)}>
              <Icon name="chevron-left" />
            </button>
            <strong>{menuYear}</strong>
            <button type="button" aria-label="Anul următor" onClick={() => setMenuYear(y => y + 1)}>
              <Icon name="chevron-right" />
            </button>
          </div>
          <div className={styles.grid} role="grid" aria-label="Alege luna">
            {MONTH_NAMES.map((name, index) => {
              const optionValue = options[index];
              const selected = optionValue === value;
              const marker = markers?.[optionValue];
              const cellDisabled = monthDisabled(optionValue);
              return (
                <button
                  key={optionValue}
                  ref={el => {
                    optionRefs.current[optionValue] = el;
                  }}
                  type="button"
                  role="gridcell"
                  aria-label={`${name} ${menuYear}`}
                  aria-selected={selected}
                  disabled={cellDisabled}
                  className={[styles.option, selected ? styles.optionSelected : '', marker ? styles[marker] : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pick(optionValue)}
                  onKeyDown={event => onOptionKeyDown(event, index, options)}
                >
                  {name.slice(0, 3)}
                  {marker && <span className={styles.dot} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button type="button" className={styles.currentMonth} onClick={() => pick(today().slice(0, 7))}>
            Luna curentă
          </button>
        </div>
      )}
    </div>
  );
}
