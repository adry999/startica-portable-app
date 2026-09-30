import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export type IconButtonSize = 'sm' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  ariaLabel: string;
  /** `'lg'` = × 36 rotund (închiderea unui panou/dialog); `'sm'` (implicit) = ⋯/‹› 32 radius 10. */
  size?: IconButtonSize;
}

/** Buton doar-iconiță (28a, COMPONENTE.md §0c) — un singur loc pentru × / ⋯ / ‹ › din tot codul. */
export function IconButton({ icon, ariaLabel, size = 'sm', className, type = 'button', ...rest }: IconButtonProps) {
  const classes = [styles.btn, styles[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} aria-label={ariaLabel} className={classes} {...rest}>
      {icon}
    </button>
  );
}
