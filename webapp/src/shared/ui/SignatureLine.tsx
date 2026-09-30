import type { ReactNode } from 'react';
import styles from './SignatureLine.module.css';

export interface SignatureLineProps {
  children: ReactNode;
  className?: string;
}

/** Linie de semnătură pe tipărituri (32f, COMPONENTE.md §0g) — bară + etichetă dedesubt. */
export function SignatureLine({ children, className }: SignatureLineProps) {
  const classes = className ? `${styles.line} ${className}` : styles.line;
  return (
    <div className={classes}>
      <span className={styles.rule} />
      <span>{children}</span>
    </div>
  );
}
