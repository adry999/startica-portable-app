import type { ReactNode } from 'react';
import { Card, type CardTone } from './Card';
import styles from './Kpi.module.css';

export type KpiState = 'ready' | 'loading' | 'refreshing' | 'error';

export interface KpiProps {
  tone?: CardTone;
  decorative?: boolean | 'lg';
  /** Mărimea valorii — `'lg'` pentru KPI-ul principal (ex. Încasări), `'sm'` pentru celelalte. */
  size?: 'sm' | 'lg';
  label: string;
  value: ReactNode;
  state?: KpiState;
  /** Folosit doar când `state === 'error'`. */
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}

export function Kpi({
  tone = 'white',
  decorative = false,
  size = 'sm',
  label,
  value,
  state = 'ready',
  onRetry,
  className,
  children,
}: KpiProps) {
  if (state === 'loading') {
    return (
      <Card tone={tone} decorative={decorative} className={className}>
        <div className={styles.loading} role="status" aria-label="Se încarcă…">
          <span className={`${styles.block} ${styles.blockLabel}`} />
          <span
            className={[styles.block, styles.blockValue, size === 'lg' ? styles.blockValueLg : null]
              .filter(Boolean)
              .join(' ')}
          />
        </div>
      </Card>
    );
  }

  if (state === 'error') {
    return (
      <Card tone={tone} decorative={decorative} className={[styles.error, className].filter(Boolean).join(' ')}>
        <p className={styles.label}>{label}</p>
        <strong className={[styles.value, size === 'lg' ? styles.valueLg : null].filter(Boolean).join(' ')}>—</strong>
        {onRetry && (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Reîncearcă
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card tone={tone} decorative={decorative} className={className}>
      <div className={[styles.content, state === 'refreshing' ? styles.refreshing : null].filter(Boolean).join(' ')}>
        <p className={styles.label}>{label}</p>
        <strong className={[styles.value, size === 'lg' ? styles.valueLg : null].filter(Boolean).join(' ')}>
          {value}
        </strong>
        {children}
      </div>
    </Card>
  );
}
