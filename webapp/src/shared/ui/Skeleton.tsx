import styles from './Skeleton.module.css';

/** Forma standard de încărcare pentru un ecran cu carduri, căutare și tabel (21b). */
export function Skeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Se încarcă…">
      <div className={styles.cards}>
        {[0, 1, 2, 3].map(index => (
          <div key={index} className={styles.card}>
            <span className={`${styles.block} ${styles.cardLabel}`} />
            <span className={`${styles.block} ${styles.cardValue}`} />
          </div>
        ))}
      </div>
      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <span className={`${styles.block} ${styles.search}`} />
          <span className={`${styles.block} ${styles.filter}`} />
          <span className={`${styles.block} ${styles.filter}`} />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={styles.row} data-testid="skeleton-row">
            <span className={`${styles.block} ${styles.cellNarrow}`} />
            <span className={`${styles.block} ${styles.cellWide}`} />
            <span className={`${styles.block} ${styles.cellMedium}`} />
            <span className={`${styles.block} ${styles.cellPill}`} />
            <span className={`${styles.block} ${styles.cellEnd}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
