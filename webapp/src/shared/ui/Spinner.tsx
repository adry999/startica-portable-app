import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 12 | 16 | 24 | 40;
  ariaLabel?: string;
  className?: string;
}

/** Indicator de încărcare rotativ, `currentColor` — moștenește culoarea din container (COMPONENTE.md §0d, 29a). */
export function Spinner({ size = 24, ariaLabel = 'Se încarcă…', className }: SpinnerProps) {
  const classes = [styles.spinner, styles[`size${size}`], className].filter(Boolean).join(' ');
  return <span className={classes} role="status" aria-label={ariaLabel} />;
}
