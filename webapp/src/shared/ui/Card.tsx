import type { ReactNode } from 'react';
import styles from './Card.module.css';

export type CardTone = 'white' | 'orange' | 'mint' | 'yellow' | 'pink' | 'dashed';

export interface CardProps {
  tone?: CardTone;
  /** Cerc decorativ jos-dreapta, ca pe cardurile KPI din Dashboard. `'lg'` = cardul Încasări. */
  decorative?: boolean | 'lg';
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

/** Container radius 20-24 folosit pentru KPI-uri, statistici și grupări de conținut. */
export function Card({ tone = 'white', decorative = false, onClick, className, children }: CardProps) {
  const classes = [
    styles.card,
    styles[tone],
    decorative ? styles.decorative : null,
    decorative === 'lg' ? styles.decorativeLarge : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={classes}>{children}</div>;
}
