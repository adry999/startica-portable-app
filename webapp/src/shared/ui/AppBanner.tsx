import { Button } from './Button';
import { IconButton } from './IconButton';
import styles from './AppBanner.module.css';

export type AppBannerTone = 'error' | 'offline' | 'warning' | 'info';

export interface AppBannerProps {
  tone: AppBannerTone;
  message: string;
  /** Acțiune opțională (ex. "Reîncearcă") — arată `loading` cât timp `actionLoading` e adevărat. */
  action?: { label: string; onClick: () => void };
  actionLoading?: boolean;
  /** Lipsă (implicit) pe error/offline — acelea nu se pot închide (spec). Poate fi dat pe warning/info. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Bară la nivel de pagină — eroare/offline/avertizare/info, un singur ton vizibil deodată
 * (COMPONENTE.md §0i, 34a). Alegerea tonului activ, după prioritate, e treaba apelantului:
 * `AppBanner` doar randează bara primită, nu decide între mai multe condiții simultane.
 */
export function AppBanner({ tone, message, action, actionLoading = false, onDismiss, className }: AppBannerProps) {
  const classes = [styles.banner, styles[tone], className].filter(Boolean).join(' ');

  return (
    <div className={classes} role={tone === 'error' ? 'alert' : 'status'}>
      <span className={styles.message}>{message}</span>
      {action && (
        <Button variant="outline" size="md" loading={actionLoading} onClick={action.onClick} className={styles.action}>
          {action.label}
        </Button>
      )}
      {onDismiss && <IconButton icon="close" ariaLabel="Închide" onClick={onDismiss} className={styles.dismiss} />}
    </div>
  );
}
