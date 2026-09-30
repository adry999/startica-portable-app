import { Icon, type IconName } from './Icon';
import styles from './NavRail.module.css';

export interface NavRailItem {
  key: string;
  label: string;
  icon: IconName;
  active?: boolean;
  onClick: () => void;
}

export interface NavRailProps {
  items: NavRailItem[];
  className?: string;
}

/**
 * Navigația principală a aplicației, listă verticală icon + etichetă (31g/DS-IMPLEMENTARE.md §8).
 * V1: doar bara — varianta responsivă (colaps la 72px + meniu în Drawer) rămâne de făcut separat.
 */
export function NavRail({ items, className }: NavRailProps) {
  const classes = className ? `${styles.rail} ${className}` : styles.rail;
  return (
    <nav className={classes} aria-label="Navigație principală">
      <ul className={styles.list}>
        {items.map(item => (
          <li key={item.key}>
            <button
              type="button"
              className={item.active ? `${styles.item} ${styles.active}` : styles.item}
              aria-current={item.active ? 'page' : undefined}
              onClick={item.onClick}
            >
              <Icon name={item.icon} size={20} />
              <span className={styles.label}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
