import { Avatar } from './Avatar';
import styles from './AvatarGroup.module.css';

export interface AvatarGroupItem {
  name: string;
  src?: string;
}

export interface AvatarGroupProps {
  items: AvatarGroupItem[];
  /** Peste acest număr, restul se comprimă în "+N". Implicit 4. */
  maxVisible?: number;
  /** Mărimea `Avatar`-urilor individuale — vezi `AvatarProps.size` pentru valorile permise. */
  size?: 26 | 32 | 38 | 64 | 84;
  className?: string;
}

/** `Avatar`-uri suprapuse într-un rând, cu "+N" pentru rest (COMPONENTE.md §0e). */
export function AvatarGroup({ items, maxVisible = 4, size = 32, className }: AvatarGroupProps) {
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;
  const classes = className ? `${styles.row} ${className}` : styles.row;

  return (
    <div className={classes}>
      {visible.map((item, index) => (
        <span className={styles.ring} key={`${item.name}-${index}`}>
          <Avatar name={item.name} src={item.src} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span className={styles.ring}>
          <span className={styles.overflow} style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}>
            +{overflow}
          </span>
        </span>
      )}
    </div>
  );
}
