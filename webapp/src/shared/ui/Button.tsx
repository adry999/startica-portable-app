import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'white' | 'outline' | 'link' | 'danger' | 'danger-solid';
export type ButtonSize = 'md' | 'lg' | 'header';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** `'lg'` = padding mai mare, pentru acțiunea principală a paginii (ex. Salvează asocierile din Asociere achitări).
   * `'header'` = dimensiunea butoanelor din antet (00-comun A): padding 8px 18px, font 15px, umbră mai mică. */
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
  const classes = [styles.btn, styles[variant], size !== 'md' ? styles[size] : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
