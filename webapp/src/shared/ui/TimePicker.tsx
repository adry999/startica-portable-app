import { useState } from 'react';
import { IconButton } from './IconButton';
import { Popover } from './Popover';
import { Spinner } from './Spinner';
import { TimeInput } from './TimeInput';
import styles from './TimePicker.module.css';

export interface TimeSlot {
  /** `HH:MM`. */
  value: string;
  /** Capacitate — lipsă = fără informație de capacitate (slot simplu). */
  capacity?: { taken: number; total: number };
  /** Acest slot își încarcă încă disponibilitatea. */
  loading?: boolean;
}

export interface TimePickerProps {
  /** `HH:MM`. */
  value: string;
  onChange: (value: string) => void;
  /** Dacă e dat, arată popover cu sloturi predefinite pe lângă tastarea liberă. */
  slots?: TimeSlot[];
  ariaLabel?: string;
  className?: string;
}

/** Câmp de oră cu tastare directă (`TimeInput`) + listă de sloturi cu capacitate (COMPONENTE.md §0e, 30c). */
export function TimePicker({ value, onChange, slots, ariaLabel, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  function selectSlot(slot: TimeSlot) {
    onChange(slot.value);
    setOpen(false);
  }

  const classes = [styles.root, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className={styles.field}>
        <TimeInput value={value} onChange={onChange} ariaLabel={ariaLabel} className={styles.input} />
        {slots && slots.length > 0 && (
          <IconButton icon="chevron-down" ariaLabel="Deschide sloturile" onClick={() => setOpen(current => !current)} />
        )}
      </div>
      {open && slots && (
        <Popover onClose={() => setOpen(false)} ariaLabel="Sloturi disponibile" className={styles.popover}>
          <ul className={styles.list}>
            {slots.map(slot => {
              const full = Boolean(slot.capacity && slot.capacity.taken >= slot.capacity.total);
              const disabled = full || slot.loading;
              return (
                <li key={slot.value}>
                  <button
                    type="button"
                    className={[styles.row, full ? styles.full : '', disabled ? styles.disabled : '']
                      .filter(Boolean)
                      .join(' ')}
                    disabled={disabled}
                    onClick={() => selectSlot(slot)}
                  >
                    <span>{slot.value}</span>
                    {slot.loading ? (
                      <Spinner size={12} ariaLabel="Se încarcă disponibilitatea" />
                    ) : slot.capacity ? (
                      <span className={styles.capacity}>
                        {slot.capacity.taken}/{slot.capacity.total} locuri
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover>
      )}
    </div>
  );
}
