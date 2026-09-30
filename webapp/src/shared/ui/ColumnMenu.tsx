import { useRef } from 'react';
import { Checkbox } from './Checkbox';
import { Icon } from './Icon';
import styles from './ColumnMenu.module.css';

export interface ColumnMenuOption {
  key: string;
  label: string;
  /** Coloanele obligatorii (ex. numele) pot fi needebifabile — dați `locked: true`. */
  locked?: boolean;
}

export interface ColumnMenuProps {
  columns: ColumnMenuOption[];
  visibleKeys: string[];
  onChange: (visibleKeys: string[]) => void;
  ariaLabel?: string;
  className?: string;
}

/** Meniul „coloane vizibile” de lângă un `DataTable` — pe același tipar `<details>`/`<summary>` ca `RowMenu`. */
export function ColumnMenu({ columns, visibleKeys, onChange, ariaLabel = 'Coloane', className }: ColumnMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function toggleColumn(column: ColumnMenuOption) {
    if (column.locked) return;
    const next = visibleKeys.includes(column.key)
      ? visibleKeys.filter(key => key !== column.key)
      : [...visibleKeys, column.key];
    onChange(next);
  }

  const classes = className ? `${styles.columnMenu} ${className}` : styles.columnMenu;

  return (
    <details ref={detailsRef} className={classes} onClick={event => event.stopPropagation()}>
      <summary aria-label={ariaLabel}>
        <Icon name="menu" />
      </summary>
      <div className={styles.panel}>
        {columns.map(column => (
          <label key={column.key} className={styles.option}>
            <Checkbox
              checked={column.locked || visibleKeys.includes(column.key)}
              onChange={() => toggleColumn(column)}
              ariaLabel={column.label}
              disabled={column.locked}
            />
            <span className={styles.optionLabel}>{column.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
