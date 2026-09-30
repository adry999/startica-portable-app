import { Tooltip } from './Tooltip';
import styles from './Heatmap.module.css';

export type HeatmapCellState = 'paid' | 'partial' | 'overdue' | 'future' | 'no-contract';

export interface HeatmapCell {
  key: string;
  /** Afișat în `Tooltip`-ul celulei. */
  label: string;
  state: HeatmapCellState;
  /** Inel slate — de obicei luna/ziua curentă. */
  current?: boolean;
}

export interface HeatmapProps {
  cells: HeatmapCell[];
  /** Câte celule pe rând (`grid-template-columns: repeat(columns, ...)`). */
  columns: number;
  ariaLabel: string;
  className?: string;
}

/** Grilă de celule colorate pe stare de plată, cu `Tooltip` per celulă (COMPONENTE.md §0e, 30e). */
export function Heatmap({ cells, columns, ariaLabel, className }: HeatmapProps) {
  const classes = [styles.grid, className].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      style={{ gridTemplateColumns: `repeat(${columns}, 26px)` }}
      role="img"
      aria-label={ariaLabel}
    >
      {cells.map(cell => (
        <Tooltip key={cell.key} content={cell.label}>
          <span
            className={[styles.cell, styles[cell.state], cell.current ? styles.current : ''].filter(Boolean).join(' ')}
          />
        </Tooltip>
      ))}
    </div>
  );
}
