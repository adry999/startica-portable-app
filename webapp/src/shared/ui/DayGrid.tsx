import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './DayGrid.module.css';

export type DayGridCellKind = 'dot' | 'code' | 'bar';

export interface DayGridCell {
  key: string;
  /** 'dot': ignorat, arată un punct colorat din `tone`. 'code': text scurt (ex. "CO"). 'bar': culoare de fundal din `tone`. */
  content?: string;
  tone?: 'mint' | 'raspberry' | 'yellow' | 'neutral' | 'transparent';
  isWeekend?: boolean;
  isToday?: boolean;
  saving?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export interface DayGridRow {
  key: string;
  label: string;
  cells: DayGridCell[];
  /** Rândul întreg apare stins și fără interacțiune. */
  loading?: boolean;
}

export interface DayGridProps {
  kind: DayGridCellKind;
  columnLabels: string[];
  rows: DayGridRow[];
  footer?: ReactNode[];
  className?: string;
}

function renderCellContent(kind: DayGridCellKind, cell: DayGridCell) {
  if (cell.saving) return <Spinner size={12} ariaLabel="Se salvează…" />;
  if (kind === 'dot') {
    if (!cell.tone || cell.tone === 'transparent') return null;
    return <span className={`${styles.dot} ${styles[`tone-${cell.tone}`]}`} aria-hidden="true" />;
  }
  if (kind === 'code') {
    return cell.content;
  }
  return null;
}

/**
 * O singură componentă pentru Prezența Lunii, Pontaj și Concedii (COMPONENTE.md §0e, 30f).
 * V1: navigare cu săgeți pe grilă nu e implementată (follow-up de accesibilitate) — celulele
 * sunt totuși `<button>` focusabile individual, ordinea de tab acoperă navigarea de bază.
 * `kind="bar"` e o variantă simplificată (doar fundal colorat pe celulă) pentru Concedii.
 */
export function DayGrid({ kind, columnLabels, rows, footer, className }: DayGridProps) {
  const gridTemplateColumns = `160px repeat(${columnLabels.length}, minmax(28px, 1fr))`;
  const classes = className ? `${styles.grid} ${className}` : styles.grid;

  return (
    <div className={classes} role="table" style={{ ['--day-grid-columns' as string]: gridTemplateColumns }}>
      <div className={styles.row} role="row" style={{ gridTemplateColumns }}>
        <span className={styles.headerCell} role="columnheader">
          <span className={styles.srOnly}>Persoană</span>
        </span>
        {columnLabels.map((label, index) => (
          <span
            key={index}
            className={styles.headerCell}
            role="columnheader"
            data-weekend={rows.some(row => row.cells[index]?.isWeekend) || undefined}
          >
            {label}
          </span>
        ))}
      </div>

      {rows.map(row => (
        <div
          key={row.key}
          className={styles.row}
          role="row"
          data-loading={row.loading || undefined}
          style={{ gridTemplateColumns }}
        >
          <span className={styles.rowLabel} role="rowheader">
            {row.label}
          </span>
          {row.cells.map(cell => (
            <span
              key={cell.key}
              className={styles.cell}
              role="cell"
              data-weekend={cell.isWeekend || undefined}
              data-today={cell.isToday || undefined}
            >
              <button
                type="button"
                className={
                  kind === 'bar'
                    ? `${styles.cellButton} ${styles.barButton} ${cell.tone ? styles[`tone-bg-${cell.tone}`] : ''}`
                    : styles.cellButton
                }
                onClick={cell.onClick}
                disabled={!cell.onClick || row.loading}
                aria-label={cell.ariaLabel}
                aria-busy={cell.saving || undefined}
              >
                {renderCellContent(kind, cell)}
              </button>
            </span>
          ))}
        </div>
      ))}

      {footer && (
        <div className={styles.row} role="row" style={{ gridTemplateColumns }}>
          <span className={styles.footerLabel} role="cell" />
          {footer.map((value, index) => (
            <span key={index} className={styles.footerCell} role="cell">
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
