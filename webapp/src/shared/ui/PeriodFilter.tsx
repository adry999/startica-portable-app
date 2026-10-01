import { useState } from 'react';
import { shiftDays, monthDates, today } from '#shared/domain/calendar-month.mjs';
import { schoolYearStartOf, schoolYearDayBounds } from '#shared/domain/school-year.mjs';
import { shiftMonth } from '@shared/format/month-shift';
import { Button } from './Button';
import { DateInput } from './DateInput';
import { Icon } from './Icon';
import { Popover } from './Popover';
import styles from './PeriodFilter.module.css';

export type PeriodPreset = 'luna' | 'luna-trecuta' | '30z' | 'an-scolar' | 'tot' | 'interval';

export interface PeriodFilterOption {
  value: PeriodPreset;
  label: string;
}

/** Etichetele exacte din spec (PROMPT-CLAUDE-CODE-7.md §2 / COMPONENTE.md §27e). */
export const PERIOD_PRESET_OPTIONS: readonly PeriodFilterOption[] = [
  { value: 'luna', label: 'Luna aceasta' },
  { value: 'luna-trecuta', label: 'Luna trecută' },
  { value: '30z', label: 'Ultimele 30 de zile' },
  { value: 'an-scolar', label: 'Anul școlar curent' },
  { value: 'tot', label: 'Tot' },
  { value: 'interval', label: 'Interval personalizat' },
];

const PRESET_LABEL = Object.fromEntries(PERIOD_PRESET_OPTIONS.map(option => [option.value, option.label])) as Record<
  PeriodPreset,
  string
>;

/** Prima și ultima zi a unei luni (`YYYY-MM`) — exportată separat de `periodPresetBounds`, pentru
 * ecranele cu propria lună (ex. Cheltuieli/`MonthStepper`, E-1), care au nevoie de limitele acelei
 * luni exact, nu ale lunii calendaristice reale („azi”). */
export function monthDayBounds(monthKey: string): { from: string; to: string } {
  const days = monthDates(monthKey);
  return { from: days[0], to: days[days.length - 1] };
}

/**
 * Limitele `from`/`to` (zi, `YYYY-MM-DD`) pentru fiecare presetare, față de `todayIso` (implicit azi)
 * — funcție pură, cu data injectabilă pentru teste. La `interval` nu calculează nimic: alegerea e
 * manuală, prin cele 2 `DateInput` (vezi `PeriodFilter`).
 */
export function periodPresetBounds(preset: PeriodPreset, todayIso: string = today()): { from: string; to: string } {
  switch (preset) {
    case 'luna':
      return monthDayBounds(todayIso.slice(0, 7));
    case 'luna-trecuta':
      return monthDayBounds(shiftMonth(todayIso.slice(0, 7), -1));
    case '30z':
      // 30 de zile inclusiv azi, nu 30 de zile înainte de azi.
      return { from: shiftDays(todayIso, -29), to: todayIso };
    case 'an-scolar':
      return schoolYearDayBounds(schoolYearStartOf(todayIso.slice(0, 7)));
    case 'tot':
    case 'interval':
      return { from: '', to: '' };
  }
}

export interface PeriodFilterProps {
  label?: string;
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  /** YYYY-MM-DD; gol la `tot` sau la `interval` cât timp nu s-a ales încă nimic manual. */
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  ariaLabel?: string;
  fromAriaLabel?: string;
  toAriaLabel?: string;
  className?: string;
}

/**
 * Filtru de perioadă cu presetări (27e, `COMPONENTE.md` §27e) — buton + `Popover` cu cele 6 opțiuni
 * din spec; la `interval` arată 2 `DateInput` pentru alegerea manuală, pe zi. Componenta calculează
 * singură `from`/`to` la schimbarea presetării (`periodPresetBounds`) — apelantul ține doar cele 3
 * valori în stare și le dă mai departe filtrării (ca `ArchiveFilterDropdown` din Cheltuieli).
 */
export function PeriodFilter({
  label = 'Perioadă',
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  ariaLabel,
  fromAriaLabel = `${label} de la`,
  toAriaLabel = `${label} până la`,
  className,
}: PeriodFilterProps) {
  const [open, setOpen] = useState(false);

  function selectPreset(next: PeriodPreset) {
    onPresetChange(next);
    if (next === 'interval') return;
    const bounds = periodPresetBounds(next);
    onFromChange(bounds.from);
    onToChange(bounds.to);
    setOpen(false);
  }

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <Button
        variant="outline"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {label}: {PRESET_LABEL[preset]} <Icon name="chevron-down" size={14} />
      </Button>

      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel={ariaLabel ?? label} className={styles.popover}>
          <div role="menu" className={styles.list}>
            {PERIOD_PRESET_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant="ghost"
                className={styles.option}
                role="menuitemradio"
                aria-checked={option.value === preset}
                onClick={() => selectPreset(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {preset === 'interval' && (
            <div className={styles.interval}>
              <label className={styles.intervalField}>
                <span>De la</span>
                <DateInput value={from} onChange={onFromChange} ariaLabel={fromAriaLabel} max={to || undefined} />
              </label>
              <label className={styles.intervalField}>
                <span>Până la</span>
                <DateInput value={to} onChange={onToChange} ariaLabel={toAriaLabel} min={from || undefined} />
              </label>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
