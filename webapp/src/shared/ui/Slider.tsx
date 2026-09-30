import type { ChangeEvent, CSSProperties } from 'react';
import styles from './Slider.module.css';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Implicit 0. */
  min?: number;
  /** Implicit 100. */
  max?: number;
  /** Implicit 1. */
  step?: number;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Wrapper peste `<input type="range">` nativ — nu există un precedent Slider în codebase, inputul
 * nativ e alegerea pragmatică pentru v1 (COMPONENTE.md §0g/32g — „mărimea interfeței”). Track/thumb
 * stilizate prin pseudo-elemente `::-webkit-slider-*`/`::-moz-range-*` (singura cale de a stiliza
 * un range input nativ — excepție acceptată de la regula „fără pseudo-elemente specifice browser”).
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  disabled = false,
  className,
}: SliderProps) {
  const classes = className ? `${styles.slider} ${className}` : styles.slider;
  const percent = ((value - min) / (max - min)) * 100;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Number(event.target.value));
  }

  return (
    <input
      type="range"
      className={classes}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={handleChange}
      style={{ '--slider-percent': `${percent}%` } as CSSProperties}
    />
  );
}
