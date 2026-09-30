import { IconButton } from './IconButton';
import styles from './NumberStepper.module.css';

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Implicit 1. */
  step?: number;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

/**
 * Pastilă numerică cu − / +, nu un input liber — v1 nu editează valoarea prin tastare direct în
 * afișaj (COMPONENTE.md §0g/32g — „locuri pe oră”).
 */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
  disabled = false,
  className,
}: NumberStepperProps) {
  const classes = className ? `${styles.stepper} ${className}` : styles.stepper;
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div className={classes}>
      <IconButton
        icon="minus"
        size="sm"
        ariaLabel={`Scade ${ariaLabel}`}
        disabled={disabled || atMin}
        onClick={() => onChange(clamp(value - step, min, max))}
      />
      <span
        className={styles.value}
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {value}
      </span>
      <IconButton
        icon="plus"
        size="sm"
        ariaLabel={`Crește ${ariaLabel}`}
        disabled={disabled || atMax}
        onClick={() => onChange(clamp(value + step, min, max))}
      />
    </div>
  );
}
