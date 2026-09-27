import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'white' | 'outline';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** `'lg'` = padding mai mare, pentru acțiunea principală a paginii (ex. Salvează asocierile din Asociere achitări). */
  size?: ButtonSize;
  children: ReactNode;
}

/** Pastilă orange/ghost/white/outline — un singur loc pentru butoanele de acțiune din toolbar-uri și formulare. */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], size === 'lg' ? styles.lg : null, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
