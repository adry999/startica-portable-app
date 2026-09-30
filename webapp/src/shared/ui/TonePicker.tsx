import styles from './TonePicker.module.css';

// Culoarea „soft" (fundal, mereu) / „ink" (border la selectat, ✓) per ton — TOKENS.md
// „Tonuri de grupă (8)", aliniat la 32c: DS Componente.dc.html.
const TONE_SOFT: Record<string, string> = {
  orange: 'var(--orange-soft)',
  mint: 'var(--mint-soft)',
  yellow: 'var(--yellow-soft)',
  pink: 'var(--pink-soft)',
  teal: 'var(--teal-soft)',
  blue: 'var(--blue-soft)',
  purple: 'var(--purple-soft)',
  coral: 'var(--coral-soft)',
  // `green` (BOARD_TONE_PALETTE, Grupe) refolosește tokenii `--mint-*` — vezi groupBoardTone.ts.
  green: 'var(--mint-soft)',
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
  green: 'var(--mint-ink)',
};

const TONE_NAME_RO: Record<string, string> = {
  orange: 'Portocaliu',
  mint: 'Mentă',
  yellow: 'Galben',
  pink: 'Roz',
  teal: 'Turcoaz',
  blue: 'Albastru',
  purple: 'Mov',
  coral: 'Corai',
  green: 'Verde',
};

export interface TonePickerProps {
  /** De regulă `SERVICE_TONES`/`BOARD_TONE_PALETTE` — cele 8 chei de ton. */
  tones: readonly string[];
  value: string;
  onChange: (tone: string) => void;
  ariaLabel: string;
  /** `title` per pătrat — ex. „folosită de Ursuleți” / „liberă” (Grupă nouă, 03-grupe.md §5b.3). */
  titleFor?: (tone: string) => string | undefined;
}

/** 8 pătrate de ton, 32×32 (32c, COMPONENTE.md „TonePicker" — Grupă nouă, Serviciu nou):
 * fundal `-soft` mereu, selectat = border 2px `-ink` + ✓. */
export function TonePicker({ tones, value, onChange, ariaLabel, titleFor }: TonePickerProps) {
  return (
    <div className={styles.row} role="radiogroup" aria-label={ariaLabel}>
      {tones.map(tone => {
        const selected = value === tone;
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={TONE_NAME_RO[tone] ?? tone}
            title={titleFor?.(tone)}
            className={styles.swatch}
            style={{
              background: TONE_SOFT[tone] ?? tone,
              borderColor: selected ? (TONE_INK[tone] ?? tone) : 'transparent',
              color: TONE_INK[tone] ?? tone,
            }}
            onClick={() => onChange(tone)}
          >
            {selected && (
              <svg className={styles.check} viewBox="0 0 12 10" aria-hidden="true">
                <path
                  d="M1 5L4.5 8.5L11 1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
