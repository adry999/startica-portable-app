import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'white' | 'outline';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/** Pastilă orange/ghost/white/outline — un singur loc pentru butoanele de acțiune din toolbar-uri și formulare. */
export function Button({ variant = 'primary', className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = [styles.btn, styles[variant], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
