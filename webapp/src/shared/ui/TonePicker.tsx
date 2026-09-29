import styles from './TonePicker.module.css';

// Culoarea „bar” / „ink” per ton (TOKENS.md „Tonuri de grupă (8)") — pătratul plin, respectiv
// border-ul lui când e selectat.
const TONE_BAR: Record<string, string> = {
  orange: 'var(--orange)',
  mint: 'var(--mint-bar)',
  yellow: 'var(--yellow-bar)',
  pink: 'var(--pink-bar)',
  teal: 'var(--teal-bar)',
  blue: 'var(--blue-bar)',
  purple: 'var(--purple-bar)',
  coral: 'var(--coral-bar)',
};

const TONE_INK: Record<string, string> = {
  orange: 'var(--orange-ink)',
  mint: 'var(--mint-ink)',
  yellow: 'var(--yellow-ink)',
  pink: 'var(--pink-ink)',
  teal: 'var(--teal-ink)',
  blue: 'var(--blue-ink)',
  purple: 'var(--purple-ink)',
  coral: 'var(--coral-ink)',
};

export interface TonePickerProps {
  /** De regulă `SERVICE_TONES`/`BOARD_TONE_PALETTE` — cele 8 chei de ton. */
  tones: readonly string[];
  value: string;
  onChange: (tone: string) => void;
  ariaLabel: string;
}

/** 8 pătrate de ton, selectat = border 2px `-ink` (B3, COMPONENTE.md „TonePicker" — Grupă nouă, Serviciu nou). */
export function TonePicker({ tones, value, onChange, ariaLabel }: TonePickerProps) {
  return (
    <div className={styles.row} role="radiogroup" aria-label={ariaLabel}>
      {tones.map(tone => (
        <button
          key={tone}
          type="button"
          role="radio"
          aria-checked={value === tone}
          aria-label={tone}
          className={`${styles.swatch} ${value === tone ? styles.active : ''}`}
          style={{
            background: TONE_BAR[tone] ?? tone,
            borderColor: value === tone ? (TONE_INK[tone] ?? tone) : 'transparent',
          }}
          onClick={() => onChange(tone)}
        />
      ))}
    </div>
  );
}
