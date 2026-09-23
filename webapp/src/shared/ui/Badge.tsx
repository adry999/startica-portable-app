import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'orange' | 'mint' | 'yellow' | 'pink' | 'neutral';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

/** Pastilă de status (Achitat/Parțial/Neachitat/Scadent, categorii) — un singur loc pentru culorile pe ton. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
