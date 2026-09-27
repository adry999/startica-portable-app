import { Skeleton } from './Skeleton';
import { useDelayedLoading } from './useDelayedLoading';
import styles from './LoadingState.module.css';

const THRESHOLD_MS = 300;

/**
 * Înlocuiește placeholder-ul text „Se încarcă datele…" în ecrane (21b): bară subțire
 * indeterminată + schelet, dar doar dacă încărcarea trece de 300 ms — sub prag nu clipește nimic.
 */
export function LoadingState() {
  const show = useDelayedLoading(true, THRESHOLD_MS);
  if (!show) return null;

  return (
    <div className={styles.container}>
      <span className={styles.bar} aria-hidden />
      <Skeleton />
    </div>
  );
}
