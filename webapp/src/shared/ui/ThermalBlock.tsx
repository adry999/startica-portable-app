import type { ReactNode } from 'react';
import styles from './ThermalBlock.module.css';

export interface ThermalBlockProps {
  /** Butoanele din bara de sus (Înapoi/Tipărește) — ascunse automat la print. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Schela unui bon 58mm (32f, COMPONENTE.md §0g) — `@page`, bara de acțiuni, cutia albă a bonului. */
export function ThermalBlock({ actions, children, className }: ThermalBlockProps) {
  const classes = className ? `${styles.bon} ${className}` : styles.bon;
  return (
    <div className={styles.page}>
      <style>{'@page { size: 58mm auto; margin: 0; }'}</style>
      {actions && <div className={styles.toolbar}>{actions}</div>}
      <div className={classes}>{children}</div>
    </div>
  );
}

export interface ThermalRuleProps {
  variant?: 'solid' | 'dashed';
}

/** Linie despărțitoare pe bonul 58mm — plină (secțiuni) sau punctată (rânduri secundare). */
export function ThermalRule({ variant = 'solid' }: ThermalRuleProps) {
  return <div className={variant === 'dashed' ? styles.ruleDashed : styles.ruleSolid} />;
}
