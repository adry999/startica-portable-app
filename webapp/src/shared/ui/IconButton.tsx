import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export type IconButtonSize = 'sm' | 'lg';

const ICON_SIZE: Record<IconButtonSize, 16 | 20> = { sm: 16, lg: 20 };

interface IconButtonShellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ariaLabel: string;
  /** `'lg'` = × 36 rotund (închiderea unui panou/dialog); `'sm'` (implicit) = ⋯/‹› 32 radius 10. */
  size?: IconButtonSize;
  children?: ReactNode;
}

function IconButtonShell({
  ariaLabel,
  size = 'sm',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonShellProps) {
  const classes = [styles.btn, styles[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} aria-label={ariaLabel} className={classes} {...rest}>
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<IconButtonShellProps, 'children'> {
  icon: IconName;
}

/** Buton doar-iconiță (28a, COMPONENTE.md §0c) — un singur loc pentru × / ⋯ / ‹ › din tot codul. */
export function IconButton({ icon, size = 'sm', ...rest }: IconButtonProps) {
  return (
    <IconButtonShell size={size} {...rest}>
      <Icon name={icon} size={ICON_SIZE[size]} />
    </IconButtonShell>
  );
}

export interface StatusIconButtonProps extends IconButtonShellProps {}

/**
 * Variantă rară pentru butoane al căror conținut e o stare vizuală proprie, nu o iconiță Lucide
 * (ex. `AttendanceDot` din grila lunii) — `IconButton` obișnuit rămâne strict pe `icon: IconName`.
 */
export function StatusIconButton(props: StatusIconButtonProps) {
  return <IconButtonShell {...props} />;
}
