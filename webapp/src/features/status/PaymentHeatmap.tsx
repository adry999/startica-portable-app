import { formatMoney } from '#shared/format/money-format.mjs';
import { initials } from '@shared/format/initials';
import { EMPTY_STATES, EmptyState, groupTone, resolveEmptyStateText, resolveEmptyStateTitle } from '@shared/ui';
import type { ToneableGroup } from '@shared/ui/group-tone';
import type { HeatCellKind, HeatRowView } from './useSchoolYearStatus';
import styles from './PaymentHeatmap.module.css';

const KIND_LABEL: Record<HeatCellKind, string> = {
  paid: 'Achitat',
  partial: 'Parțial',
  unpaid: 'Neachitat',
  upcoming: 'Urmează',
  none: 'Fără obligație',
};

const LEGEND_KINDS: HeatCellKind[] = ['paid', 'partial', 'unpaid', 'upcoming'];

export interface PaymentHeatmapProps {
  rows: HeatRowView[];
  groups?: ToneableGroup[];
  monthLabels: string[];
  currentMonth: string | null;
  /** Anul școlar afișat (ex. „2025–2026”), pentru textul stării goale (situatia.year.period). */
  yearLabel?: string;
}

/** Harta copil × 12 luni pentru An școlar — pură, fără sesiune, folosită doar de `YearView`. */
export function PaymentHeatmap({ rows, groups = [], monthLabels, currentMonth, yearLabel }: PaymentHeatmapProps) {
  const gridStyle = { gridTemplateColumns: `230px repeat(${monthLabels.length}, minmax(0, 1fr)) 130px` };
  const currentMonthIndex = rows[0]?.cells.findIndex(cell => cell.month === currentMonth) ?? -1;

  return (
    <div>
      <div className={styles.legend}>
        {LEGEND_KINDS.map(kind => (
          <span key={kind} className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles[kind]}`} aria-hidden="true" />
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="period"
          title={resolveEmptyStateTitle(
            EMPTY_STATES['situatia.year.period'],
            yearLabel ? { an: yearLabel } : undefined,
          )}
          description={resolveEmptyStateText(
            EMPTY_STATES['situatia.year.period'],
            yearLabel ? { an: yearLabel } : undefined,
          )}
        />
      ) : (
        <div className={styles.table}>
          <div className={styles.headRow} style={gridStyle}>
            <span>Copil</span>
            {monthLabels.map((label, index) => (
              <span key={label} className={index === currentMonthIndex ? styles.currentLabel : undefined}>
                {label}
              </span>
            ))}
            <span className={styles.soldHeader}>Sold</span>
          </div>
          {rows.map(row => {
            const tone = groupTone(row.groupId, groups);
            return (
              <div key={row.id} className={styles.row} style={gridStyle}>
                <span className={styles.nameCell}>
                  <span
                    className={styles.avatar}
                    style={{
                      background: `var(--${tone}-soft, var(--neutral-soft))`,
                      color: `var(--${tone}-ink, var(--subtle))`,
                    }}
                  >
                    {initials(row.name)}
                  </span>
                  <span className={styles.name}>{row.name}</span>
                </span>
                {row.cells.map((cell, index) => (
                  <span
                    key={cell.month}
                    role="img"
                    aria-label={`${monthLabels[index]}: ${KIND_LABEL[cell.kind]}`}
                    title={`${monthLabels[index]}: ${KIND_LABEL[cell.kind]}`}
                    className={[styles.cell, styles[cell.kind], cell.month === currentMonth ? styles.current : '']
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
                <span className={row.sold > 0 ? styles.soldPositive : styles.soldZero}>
                  {formatMoney(row.sold, row.soldCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
