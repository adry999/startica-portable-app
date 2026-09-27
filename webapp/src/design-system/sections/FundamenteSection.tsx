import { COLOR_TOKEN_GROUPS, RADIUS_TOKENS, readCssVariable, SHADOW_TOKENS, SPACING_TOKENS } from '../tokens-reference';
import styles from './FundamenteSection.module.css';

/** Culori, tipografie, spațiere, raze și umbre — citite direct din `tokens.css`, nicio culoare nouă. */
export function FundamenteSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Fundamente</h2>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Culori</h3>
        {COLOR_TOKEN_GROUPS.map(group => (
          <div key={group.label} className={styles.colorGroup}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.swatchRow}>
              {group.tokens.map(token => (
                <div key={token} className={styles.swatch}>
                  <span className={styles.swatchColor} style={{ background: `var(${token})` }} />
                  <code className={styles.swatchName}>{token}</code>
                  <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Tipografie</h3>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30 }}>
          Titlu de pagină — Baloo 2 800, 30px
        </p>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>
          Titlu de card — Baloo 2 800, 18px
        </p>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
          Text — Nunito 400/700, 14px
        </p>
        <p
          className={styles.typeSample}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 'var(--text-eyebrow-letter-spacing)',
            color: 'var(--subtle)',
          }}
        >
          Eyebrow — Nunito 800, 12px, uppercase
        </p>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Spațiere</h3>
        <div className={styles.spacingRow}>
          {SPACING_TOKENS.map(token => (
            <div key={token} className={styles.spacingItem}>
              <span className={styles.spacingBar} style={{ width: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
              <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Raze</h3>
        <div className={styles.radiusRow}>
          {RADIUS_TOKENS.map(token => (
            <div key={token} className={styles.radiusItem}>
              <span className={styles.radiusBox} style={{ borderRadius: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
              <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Umbre</h3>
        <div className={styles.shadowRow}>
          {SHADOW_TOKENS.map(token => (
            <div key={token} className={styles.shadowItem}>
              <span className={styles.shadowBox} style={{ boxShadow: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
