import type { ReactNode } from 'react';
import { initials } from '@shared/format/initials';
import type { PillTone } from './FilterPills';
import styles from './PersonCell.module.css';

export interface PersonCellProps {
  name: string;
  /** Al doilea rând, mic — contract, „ambele filiale”, etc. */
  sub?: ReactNode;
  tone?: PillTone;
  /** `lg` (64px) — varianta pentru banda fișei (`ProfileLayout`). */
  size?: 'md' | 'lg';
}

/** Celula avatar + nume folosită în tabelele de persoane (Copii, Personal, Candidați) și în banda fișei. */
export function PersonCell({ name, sub, tone = 'neutral', size = 'md' }: PersonCellProps) {
  return (
    <div className={styles.cell}>
      <span className={`${styles.avatar} ${styles[tone]} ${size === 'lg' ? styles.lg : ''}`}>{initials(name)}</span>
      <span className={styles.text}>
        <strong className={styles.name}>{name}</strong>
        {sub != null && sub !== '' && <small className={styles.sub}>{sub}</small>}
      </span>
    </div>
  );
}
