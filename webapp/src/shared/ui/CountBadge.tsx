import styles from './CountBadge.module.css';

export interface CountBadgeProps {
  count: number;
  /** `'action'` = necesită atenție (roșu), `'informative'` = doar informativ (neutru). */
  tone?: 'action' | 'informative';
  /** Peste `max`, arată `${max}+` în loc de numărul exact. */
  max?: number;
}

/** Pastilă numerică mică — două tonuri, fără text (COMPONENTE.md §0c/28b). Distinctă de `Badge` (etichete text). */
export function CountBadge({ count, tone = 'informative', max = 99 }: CountBadgeProps) {
  if (count === 0) return null;
  return <span className={`${styles.badge} ${styles[tone]}`}>{count > max ? `${max}+` : count}</span>;
}
