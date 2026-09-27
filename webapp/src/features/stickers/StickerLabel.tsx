import { bigTextFontSizePx, type StickerLabelSize } from './sticker-text-fit';
import type { StickerDecor } from './sticker-templates';
import styles from './StickerLabel.module.css';

export interface StickerLabelProps {
  size: StickerLabelSize;
  decor: StickerDecor;
  line1: string;
  line2: string;
  line3: string;
  badge: string;
  /** Ignorată la 58×30 — pictograma nu apare la această mărime (25-bon-stickere.md). */
  showIcon: boolean;
}

const HEIGHT_MM: Record<StickerLabelSize, number> = { '58x30': 30, '58x40': 40, '58x60': 60 };
const ICON_SIZE_MM: Record<StickerLabelSize, number> = { '58x30': 0, '58x40': 8, '58x60': 11 };

/**
 * Randarea unei singure etichete (24d), 58 mm lățime × 30/40/60 mm înălțime — alb-negru, ca bonul.
 * Componentă pură de tip layout, refolosită în previzualizare și în tipărire (una sau mai multe copii).
 */
export function StickerLabel({ size, decor, line1, line2, line3, badge, showIcon }: StickerLabelProps) {
  const iconVisible = showIcon && size !== '58x30';
  const fontSizePx = bigTextFontSizePx(line1, size);
  const alignEnd = iconVisible;

  return (
    <div
      className={`${styles.label} ${styles[decor]}`}
      style={{ height: `${HEIGHT_MM[size]}mm` }}
      data-testid="sticker-label"
    >
      {decor === 'cercuri' && (
        <>
          <span className={styles.dotSolidBig} aria-hidden />
          <span className={styles.dotSolidSmall} aria-hidden />
          <span className={styles.dotDashed} aria-hidden />
        </>
      )}
      {iconVisible && (
        <img
          src="/assets/startica-icon.svg"
          alt=""
          className={styles.icon}
          style={{ width: `${ICON_SIZE_MM[size]}mm`, height: `${ICON_SIZE_MM[size]}mm` }}
        />
      )}
      <div
        className={styles.text}
        style={{ alignItems: alignEnd ? 'flex-start' : 'center', textAlign: alignEnd ? 'left' : 'center' }}
      >
        {badge && <span className={styles.badge}>{badge}</span>}
        <span className={styles.line1} style={{ fontSize: `${fontSizePx}px` }}>
          {line1}
        </span>
        {line2 && <span className={styles.line2}>{line2}</span>}
        {line3 && <span className={styles.line3}>{line3}</span>}
      </div>
    </div>
  );
}
