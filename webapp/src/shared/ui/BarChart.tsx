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
  /** Combină fiecare lună (bara principală + secundară) într-un singur `<button>` focusabil, cu un
   * singur tooltip de grup — pentru un grafic interactiv (ex. Dashboard „Evoluția încasărilor”),
   * în loc de tooltipuri separate pe fiecare bară. Cere `groupAriaLabel`/`groupTooltip`. */
  grouped?: boolean;
  /** Doar cu `grouped` — eticheta ARIA a butonului unei luni (apelantul știe ce reprezintă fiecare serie). */
  groupAriaLabel?: (item: BarChartSeries, secondary: BarChartSeries | undefined, index: number) => string;
  /** Doar cu `grouped` — textul tooltip-ului unei luni (ex. diferența dintre cele două serii). */
  groupTooltip?: (item: BarChartSeries, secondary: BarChartSeries | undefined, index: number) => string;
  onGroupClick?: (item: BarChartSeries, secondary: BarChartSeries | undefined, index: number) => void;
  className?: string;
}

const SKELETON_HEIGHTS = [40, 55, 48, 62, 44, 35, 58, 50, 70, 30, 45, 52];

/** Grafic cu bare de 13px, 1-2 serii, luna curentă intensă, fără axă Y (COMPONENTE.md §0e, 30d). */
export function BarChart({
  series,
  secondarySeries,
  state = 'ready',
  ariaLabel,
  grouped,
  groupAriaLabel,
  groupTooltip,
  onGroupClick,
  className,
}: BarChartProps) {
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

  // O lună fără nicio valoare (0) arată o bară neutră (nicio dată), nu una portocalie/mint minusculă.
  function barClass(item: BarChartSeries, currentClass: string, pastClass: string): string {
    return [styles.bar, item.value === 0 ? styles.barNoData : item.current ? currentClass : pastClass].join(' ');
  }

  function primaryBar(item: BarChartSeries) {
    return (
      <span
        className={barClass(item, styles.barPrimaryCurrent, styles.barPrimary)}
        style={{ height: `${(item.value / max) * 100}%` }}
      />
    );
  }

  function secondaryBar(item: BarChartSeries) {
    return (
      <span
        className={barClass(item, styles.barSecondaryCurrent, styles.barSecondary)}
        style={{ height: `${(item.value / max) * 100}%` }}
      />
    );
  }

  return (
    <div className={classes} role={grouped ? undefined : 'img'} aria-label={grouped ? undefined : ariaLabel}>
      <div className={styles.bars}>
        {series.map((item, index) => {
          const secondary = secondarySeries?.[index];
          return (
            <div key={item.label} className={styles.group}>
              {grouped ? (
                <Tooltip content={groupTooltip?.(item, secondary, index) ?? `${item.label}: ${item.value}`}>
                  <button
                    type="button"
                    className={styles.pair}
                    aria-label={groupAriaLabel?.(item, secondary, index) ?? `${item.label}: ${item.value}`}
                    onClick={onGroupClick ? () => onGroupClick(item, secondary, index) : undefined}
                  >
                    {primaryBar(item)}
                    {secondary && secondaryBar(secondary)}
                  </button>
                </Tooltip>
              ) : (
                <div className={styles.pair}>
                  <Tooltip content={`${item.label}: ${item.value}`}>{primaryBar(item)}</Tooltip>
                  {secondary && (
                    <Tooltip content={`${secondary.label}: ${secondary.value}`}>{secondaryBar(secondary)}</Tooltip>
                  )}
                </div>
              )}
              <span className={styles.monthLabel}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
