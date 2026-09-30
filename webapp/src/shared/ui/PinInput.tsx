import { useRef, type KeyboardEvent } from 'react';
import styles from './PinInput.module.css';

export interface PinInputProps {
  /** Numărul de casete. Implicit 4. */
  length?: number;
  /** Cifrele tastate până acum, ex. `'12'`. */
  value: string;
  onChange: (value: string) => void;
  /** Comportament „greșit" — tremurat + bordură roz; numărul de încercări rămase e afișat de apelant. */
  invalid?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Cod PIN din casete individuale, cu avans automat al focusului (COMPONENTE.md §0i, 34f). */
export function PinInput({
  length = 4,
  value,
  onChange,
  invalid,
  disabled,
  ariaLabel = 'Cod PIN',
  className,
}: PinInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1);
    if (!digit) return;
    const chars = value.split('');
    chars[index] = digit;
    onChange(chars.join('').slice(0, length));
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault();
      const chars = value.split('');
      chars[index - 1] = '';
      onChange(chars.join(''));
      inputsRef.current[index - 1]?.focus();
    }
  }

  const classes = [styles.group, invalid ? styles.invalid : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={element => {
            inputsRef.current[index] = element;
          }}
          className={styles.box}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[index] ?? ''}
          disabled={disabled}
          aria-label={`${ariaLabel} — cifra ${index + 1} din ${length}`}
          aria-invalid={invalid || undefined}
          onChange={event => handleChange(index, event.target.value)}
          onKeyDown={event => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
