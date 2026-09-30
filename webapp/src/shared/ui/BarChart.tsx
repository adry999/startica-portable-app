import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';
import styles from './BarChart.module.css';

export interface BarChartSeries {
  label: string;
  value: number;
  /** Luna curentă — bara e mai intensă (culoare plină vs. mai deschisă pentru restul). */
  current?: boolean;
}

export interface BarChartProps {
  series: BarChartSeries[];
  /** A doua serie, opțional (ex. cheltuieli suprapuse peste încasări) — aceleași etichete de lună. */
  secondarySeries?: BarChartSeries[];
  state?: 'ready' | 'loading' | 'empty';
  /** Pentru accesibilitate — un rezumat text al datelor, citit de screen reader în locul graficului vizual. */
  ariaLabel: string;
  className?: string;
}

const SKELETON_HEIGHTS = [40, 55, 48, 62, 44, 35, 58, 50, 70, 30, 45, 52];

/** Grafic cu bare de 13px, 1-2 serii, luna curentă intensă, fără axă Y (COMPONENTE.md §0e, 30d). */
export function BarChart({ series, secondarySeries, state = 'ready', ariaLabel, className }: BarChartProps) {
  const classes = [styles.chart, className].filter(Boolean).join(' ');

  if (state === 'loading') {
    return (
      <div className={classes} role="img" aria-label={ariaLabel}>
        <div className={styles.bars} aria-hidden="true">
          {SKELETON_HEIGHTS.map((height, index) => (
            <span key={index} className={styles.skeletonBar} style={{ height: `${height}%` }} />
          ))}
        </div>
        <Spinner size={16} className={styles.spinner} />
      </div>
    );
  }

  if (state === 'empty' || series.length === 0) {
    return (
      <div className={classes} role="img" aria-label={ariaLabel}>
        <p className={styles.emptyText}>Fără date</p>
      </div>
    );
  }

  const max = Math.max(1, ...series.map(item => item.value), ...(secondarySeries ?? []).map(item => item.value));

  return (
    <div className={classes} role="img" aria-label={ariaLabel}>
      <div className={styles.bars}>
        {series.map((item, index) => {
          const secondary = secondarySeries?.[index];
          return (
            <div key={item.label} className={styles.group}>
              <div className={styles.pair}>
                <Tooltip content={`${item.label}: ${item.value}`}>
                  <span
                    className={[styles.bar, item.current ? styles.barPrimaryCurrent : styles.barPrimary].join(' ')}
                    style={{ height: `${(item.value / max) * 100}%` }}
                  />
                </Tooltip>
                {secondary && (
                  <Tooltip content={`${secondary.label}: ${secondary.value}`}>
                    <span
                      className={[
                        styles.bar,
                        secondary.current ? styles.barSecondaryCurrent : styles.barSecondary,
                      ].join(' ')}
                      style={{ height: `${(secondary.value / max) * 100}%` }}
                    />
                  </Tooltip>
                )}
              </div>
              <span className={styles.monthLabel}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
