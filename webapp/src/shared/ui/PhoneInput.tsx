import { useEffect, useState } from 'react';
import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { formatMoldovanPhone } from '#shared/format/phone-format.mjs';
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

/** E.164 moldovenesc → cifrele cu care s-a scris numărul ("069123456"), ca la focus omul să-și
 * regăsească tastatura, nu „+373…”. Orice altceva (gol, invalid, alt număr) rămâne neschimbat. */
function toEditableText(stored: string): string {
  const trimmed = stored.trim();
  const normalized = trimmed ? normalizeMoldovanPhone(trimmed) : null;
  return normalized ? '0' + normalized.slice(4) : stored;
}

/** Cât timp câmpul nu e focalizat: „069 123 456” pentru un mobil moldovenesc valid sau un
 * număr străin, altfel textul brut salvat (inclusiv unul invalid — nu avem ce formata). */
function toDisplayText(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return stored;
  if (normalizeMoldovanPhone(trimmed) || trimmed.startsWith('+')) return formatMoldovanPhone(trimmed);
  return stored;
}

/** Text, fără separatoare, mai scurt decât un mobil moldovenesc complet (8 cifre după „0”) —
 * mesajul „Număr incomplet” din spec, ca utilizatorul să știe că nu a terminat de scris, nu
 * că a greșit prefixul. */
function isIncompleteMoldovanPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('+')) return false;
  const digits = trimmed.replace(/[\s.\-()]/g, '');
  if (!/^\d+$/.test(digits)) return false;
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return local.length < 8;
}

/**
 * Telefon (25b, `COMPONENTE.md` §10) — decizia 02.10: baza salvează E.164 (`+373XXXXXXXX`),
 * ecranul arată „069 123 456”. Cât se tastează, câmpul e controlat local (`draft`), ca textul
 * să nu sară la fiecare cifră; abia la blur devine definitiv ce urcă prin `onChange`:
 *  - mobil moldovenesc valid → normalizat la E.164;
 *  - începe cu „+”, dar nu e moldovenesc → „Alt număr”, urcat exact cum a fost scris;
 *  - orice altceva → urcat tot cum a fost scris (serverul marchează `phoneInvalid` la salvare).
 * Cât e focalizat, `onChange` urcă și textul brut, la fiecare apăsare, ca `dirty`-ul formularului
 * să vadă imediat o schimbare — doar forma finală (E.164/alt număr) ajunge abia la blur.
 */
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Sincronizează din exterior (încărcarea fișei, resetarea formularului) cât timp omul nu
  // editează activ — altfel o re-randare din părinte i-ar rescrie textul sub cursor.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const shownRaw = editing ? draft : value;
  const trimmed = shownRaw.trim();
  const normalized = trimmed ? normalizeMoldovanPhone(trimmed) : null;
  const foreign = trimmed !== '' && trimmed.startsWith('+') && !normalized;
  const incomplete = !normalized && !foreign && isIncompleteMoldovanPhone(trimmed);
  const invalid = trimmed !== '' && !normalized && !foreign;

  const statusId = trimmed !== '' && id ? `${id}-status` : undefined;
  const describedBy = [ariaDescribedBy, statusId].filter(Boolean).join(' ') || undefined;
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  const inputValue = editing ? draft : toDisplayText(value);

  return (
    <div className={styles.field}>
      <div className={classes}>
        <input
          id={id}
          className={styles.input}
          type="tel"
          value={inputValue}
          onFocus={() => {
            setDraft(toEditableText(value));
            setEditing(true);
          }}
          onChange={event => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          onBlur={() => {
            setEditing(false);
            const text = draft.trim();
            if (!text) onChange('');
            else {
              const normalizedOnBlur = normalizeMoldovanPhone(text);
              if (normalizedOnBlur) onChange(normalizedOnBlur);
              else if (text.startsWith('+')) onChange(text);
              else onChange(draft);
            }
          }}
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
        <p id={statusId} className={normalized || foreign ? styles.success : styles.error}>
          {normalized ? (
            <>
              <Icon name="check" size={14} /> {formatMoldovanPhone(normalized)}
            </>
          ) : foreign ? (
            <>
              <Icon name="check" size={14} /> {formatMoldovanPhone(trimmed)}
            </>
          ) : incomplete ? (
            'Număr incomplet: 8 cifre după 0.'
          ) : (
            'Numărul nu e un mobil moldovenesc valid.'
          )}
        </p>
      )}
    </div>
  );
}
