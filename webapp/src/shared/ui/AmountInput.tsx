import type { ReactNode, Ref } from 'react';
import styles from './AmountInput.module.css';

export interface AmountInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** 44b: un câmp derivat (ex. „Total grup”) poate ține o valoare brută în timpul editării și
   * o resetează la ieșirea din câmp — fără asta, o valoare recalculată la fiecare literă ar
   * „sări” peste ce tocmai a tastat utilizatorul. */
  onBlur?: () => void;
  /** Moneda afișată după sumă, ex. „lei”. */
  currency?: ReactNode;
  min?: number;
  step?: number | string;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** `'dialog'` = Baloo 36 (în loc de 40), pentru formulare mai compacte (dialog de confirmare). */
  size?: 'default' | 'dialog';
  /** Pastile de scurtătură sub câmp, ex. „1 lună · 9.600”. */
  shortcuts?: ReactNode;
  className?: string;
  /** Acces direct la `<input>` — ex. refocus după „Salvează și adaugă alta” (FM-2). */
  inputRef?: Ref<HTMLInputElement>;
}

/** Suma mare a formularului (`COMPONENTE.md` §2, id 25d) — Baloo 40 (36 în dialog) + monedă, caset orange/cream. */
export function AmountInput({
  id,
  value,
  onChange,
  onBlur,
  currency,
  min,
  step = '0.01',
  required,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  autoFocus,
  size = 'default',
  shortcuts,
  className,
  inputRef,
}: AmountInputProps) {
  const classes = [styles.box, size === 'dialog' ? styles.dialog : '', invalid ? styles.invalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <div className={classes}>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={onBlur}
          min={min}
          step={step}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        {currency && <span className={styles.currency}>{currency}</span>}
      </div>
      {shortcuts && <div className={styles.shortcuts}>{shortcuts}</div>}
    </>
  );
}
