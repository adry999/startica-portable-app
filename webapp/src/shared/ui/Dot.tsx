import type { BadgeTone } from './Badge';
import styles from './Dot.module.css';

export interface DotProps {
  tone: BadgeTone;
}

/** Punct colorat 10px — folosit pentru a lega un rând de un ton (ex. departament în Funcții). */
export function Dot({ tone }: DotProps) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />;
}
