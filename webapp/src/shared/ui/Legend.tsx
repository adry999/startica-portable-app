import styles from './Legend.module.css';

export type LegendTone = 'orange' | 'mint' | 'yellow' | 'teal' | 'pink' | 'neutral';

export interface LegendItem {
  tone: LegendTone;
  label: string;
}

export interface LegendProps {
  items: LegendItem[];
  className?: string;
}

/** Listă orizontală punct-colorat + etichetă, explică tonurile unui grafic/ProgressBar (COMPONENTE.md §0e/28e). */
export function Legend({ items, className }: LegendProps) {
  const classes = className ? `${styles.legend} ${className}` : styles.legend;
  return (
    <div className={classes}>
      {items.map((item, index) => (
        <span key={index} className={styles.item}>
          <span className={`${styles.dot} ${styles[item.tone]}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
