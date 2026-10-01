import { Fragment, type ReactNode } from 'react';
import styles from './FilterPills.module.css';

export type PillTone = 'orange' | 'mint' | 'yellow' | 'pink' | 'teal' | 'blue' | 'purple' | 'coral' | 'neutral';

export interface FilterPillGroup<T extends string> {
  label: string;
  options: { value: T; label: string; tone: PillTone }[];
  value: T;
  onChange: (value: T) => void;
}

export interface FilterPillsProps {
  /** Orice număr de grupuri, separate vizual printr-un despărțitor; bara trece pe al doilea rând
   * dacă nu încap (`flex-wrap: wrap`, ca în artboard — Achitări are 3: Metodă, Grupa, Serviciu). */
  groups: FilterPillGroup<string>[];
  /** Contor la capătul barei, ex. „12 zile de naștere". */
  trailing?: ReactNode;
  /** Ecranul apelant poate anula bordura/padding-ul barei (ex. Personal 23a — pastile pe același rând cu căutarea). */
  className?: string;
}

/** Bara de filtre cu pastile colorate — sub bara de căutare, în Copii, Vizite, Achitări, Cheltuieli, Situația și Zile de naștere. */
export function FilterPills({ groups, trailing, className }: FilterPillsProps) {
  return (
    <div className={className ? `${styles.bar} ${className}` : styles.bar} role="toolbar">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <span className={styles.sep} aria-hidden="true" />}
          <span className={styles.label}>{group.label}</span>
          <div role="radiogroup" aria-label={group.label} className={styles.group}>
            {group.options.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === group.value}
                className={`${styles.pill} ${styles[option.tone]} ${option.value === group.value ? styles.active : ''}`}
                onClick={() => group.onChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
