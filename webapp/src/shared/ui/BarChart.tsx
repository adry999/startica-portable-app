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
  /** Coloană de scară (44px, 0/jumătate/max) + linii de referință punctate și axă de jos (F23,
   * PROMPT-11 §11) — implicit fără, ca să nu schimbe graficele simple existente. */
  showScale?: boolean;
  /** Valoarea afișată deasupra barei principale și pe scară — implicit un format compact K/M. */
  formatValue?: (value: number) => string;
  /** Text mic sub eticheta lunii curente (ex. „în curs”) — doar cu `showScale`. */
  currentLabelHint?: string;
  className?: string;
}

const SKELETON_HEIGHTS = [40, 55, 48, 62, 44, 35, 58, 50, 70, 30, 45, 52];

function defaultFormatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

/** Rotunjește maximul scării în sus la un pas „rotund” — 10k/50k/100k după mărimea valorii
 * (F23, PROMPT-11 §11: pragurile exacte nu sunt date în prompt, alese ca să dea o scară lizibilă). */
function niceScaleMax(rawMax: number): number {
  if (rawMax <= 0) return 10000;
  const step = rawMax > 500000 ? 100000 : rawMax > 100000 ? 50000 : 10000;
  return Math.ceil(rawMax / step) * step;
}

/** Grafic cu bare, 1-2 serii, luna curentă intensă (COMPONENTE.md §0e, 30d). Cu `showScale`, adaugă
 * coloana de scară (0/jumătate/max), linii de referință și valoarea deasupra barei principale
 * (F23, PROMPT-11 §11 — Dashboard „Evoluția încasărilor”). */
export function BarChart({
  series,
  secondarySeries,
  state = 'ready',
  ariaLabel,
  grouped,
  groupAriaLabel,
  groupTooltip,
  onGroupClick,
  showScale = false,
  formatValue = defaultFormatValue,
  currentLabelHint,
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

  const rawMax = Math.max(1, ...series.map(item => item.value), ...(secondarySeries ?? []).map(item => item.value));
  const scaleMax = showScale ? niceScaleMax(rawMax) : rawMax;

  // O lună fără nicio valoare (0) arată o bară neutră (nicio dată), nu una portocalie/mint minusculă.
  function barClass(item: BarChartSeries, currentClass: string, pastClass: string): string {
    return [styles.bar, item.value === 0 ? styles.barNoData : item.current ? currentClass : pastClass].join(' ');
  }

  function primaryBar(item: BarChartSeries) {
    const bar = (
      <span
        className={barClass(item, styles.barPrimaryCurrent, styles.barPrimary)}
        style={{ height: `${(item.value / scaleMax) * 100}%` }}
      />
    );
    if (!showScale) return bar;
    return (
      <span className={styles.barWrap} style={{ height: `${(item.value / scaleMax) * 100}%` }}>
        {item.value > 0 && (
          <span className={item.current ? `${styles.barValue} ${styles.barValueCurrent}` : styles.barValue}>
            {formatValue(item.value)}
          </span>
        )}
        <span
          className={barClass(item, styles.barPrimaryCurrent, styles.barPrimary)}
          style={{ height: '100%', width: '100%' }}
        />
      </span>
    );
  }

  function secondaryBar(item: BarChartSeries) {
    return (
      <span
        className={barClass(item, styles.barSecondaryCurrent, styles.barSecondary)}
        style={{ height: `${(item.value / scaleMax) * 100}%` }}
      />
    );
  }

  return (
    <div className={classes} role={grouped ? undefined : 'img'} aria-label={grouped ? undefined : ariaLabel}>
      <div className={styles.row}>
        {showScale && (
          <div className={styles.scaleCol} aria-hidden="true">
            <span>{formatValue(scaleMax)}</span>
            <span>{formatValue(scaleMax / 2)}</span>
            <span>0</span>
          </div>
        )}
        <div className={styles.plotArea}>
          {showScale && (
            <div className={styles.gridlines} aria-hidden="true">
              <span className={styles.gridline} style={{ top: 0 }} />
              <span className={styles.gridline} style={{ top: '50%' }} />
              <span className={styles.axisLine} />
            </div>
          )}
          <div className={showScale ? `${styles.bars} ${styles.barsScaled}` : styles.bars}>
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
                  <span
                    className={item.current ? `${styles.monthLabel} ${styles.monthLabelCurrent}` : styles.monthLabel}
                  >
                    {item.label}
                    {item.current && currentLabelHint && (
                      <small className={styles.monthLabelHint}>{currentLabelHint}</small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
