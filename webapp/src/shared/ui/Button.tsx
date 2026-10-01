import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'white' | 'outline' | 'link' | 'danger' | 'danger-solid';
export type ButtonSize = 'md' | 'lg' | 'header';
export type ButtonTone = 'default' | 'inherit';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** `'lg'` = padding mai mare, pentru acțiunea principală a paginii (ex. Salvează asocierile din Asociere achitări).
   * `'header'` = dimensiunea butoanelor din antet (00-comun A): padding 8px 18px, font 15px, umbră mai mică. */
  size?: ButtonSize;
  /** `'inherit'` — culoarea textului vine de la părinte, în loc de `--orange-ink` (ex. `variant="link"`
   * într-un card cu ton dinamic: Dashboard „Vezi lista →”). Doar pentru `link`/`danger`. */
  tone?: ButtonTone;
  /** Spinner 14 înaintea textului, `aria-busy`, clicurile sunt ignorate (29b) — apelantul dă textul la
   * gerunziu (ex. „Salvez…”) ca `children`, `loading` nu schimbă singur textul. */
  loading?: boolean;
  children: ReactNode;
}

/** Pastilă orange/ghost/white/outline — un singur loc pentru butoanele de acțiune din toolbar-uri și formulare. */
export function Button({
  variant = 'primary',
  tone = 'default',
  size = 'md',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    size !== 'md' ? styles[size] : null,
    loading ? styles.loading : null,
    tone === 'inherit' ? styles.toneInherit : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size={14} className={styles.spinner} />}
      {children}
    </button>
  );
}
