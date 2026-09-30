import type { ReactNode } from 'react';
import styles from './Notice.module.css';

export interface NoticeProps {
  tone?: 'info' | 'note' | 'error' | 'done';
  children: ReactNode;
  className?: string;
}

/** Casetă inline (nu la nivel de pagină, vezi viitorul `AppBanner`) — 4 tonuri, raza 14px (COMPONENTE.md §0c/28c). */
export function Notice({ tone = 'info', children, className }: NoticeProps) {
  const classes = className ? `${styles.notice} ${styles[tone]} ${className}` : `${styles.notice} ${styles[tone]}`;
  return (
    <div className={classes} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
