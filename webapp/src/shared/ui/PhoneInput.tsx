import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { Icon } from './Icon';
import styles from './PhoneInput.module.css';

export interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/** Telefon (25b, `COMPONENTE.md` §0) — validează cu `normalizeMoldovanPhone`; sub câmp arată
 * confirmarea E.164 sau eroarea, doar cât timp există text introdus (câmpul rămâne opțional). */
export function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  disabled,
  autoFocus,
  className,
}: PhoneInputProps) {
  const trimmed = value.trim();
  const normalized = trimmed ? normalizeMoldovanPhone(trimmed) : null;
  const invalid = trimmed !== '' && !normalized;
  const statusId = trimmed !== '' && id ? `${id}-status` : undefined;
  const describedBy = [ariaDescribedBy, statusId].filter(Boolean).join(' ') || undefined;

  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <div className={classes}>
        <input
          id={id}
          className={styles.input}
          type="tel"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
        />
      </div>
      {trimmed !== '' && (
        <p id={statusId} className={normalized ? styles.success : styles.error}>
          {normalized ? (
            <>
              <Icon name="check" size={14} /> {normalized}
            </>
          ) : (
            'Numărul nu e un mobil moldovenesc valid.'
          )}
        </p>
      )}
    </div>
  );
}
