import { Button, Card } from '@shared/ui';
import styles from './ChildrenPage.module.css';

export interface ChildrenStatsRowProps {
  activeCount: number;
  occupiedGroupsCount: number;
  groupsCount: number;
  incompleteCount: number;
  onReview: () => void;
}

export function ChildrenStatsRow({
  activeCount,
  occupiedGroupsCount,
  groupsCount,
  incompleteCount,
  onReview,
}: ChildrenStatsRowProps) {
  return (
    <div className={styles.statsRow}>
      <Card tone="orange" className={styles.statCard}>
        <strong className={styles.statValueOrange}>{activeCount}</strong>
        <div>
          <span>Copii activi</span>
          <small>statut curent din fișă</small>
        </div>
      </Card>
      <Card tone="mint" className={styles.statCard}>
        <strong className={styles.statValueMint}>{occupiedGroupsCount}</strong>
        <div>
          <span>Grupe ocupate</span>
          <small>din {groupsCount} grupe</small>
        </div>
      </Card>
      <Card tone="yellow" className={styles.statCard}>
        <strong className={styles.statValueYellow}>{incompleteCount}</strong>
        <div className={styles.statMain}>
          <span>Fișe de verificat</span>
          <small>în centrul de verificare</small>
        </div>
        <Button variant="link" className={styles.statLink} onClick={onReview}>
          Verifică →
        </Button>
      </Card>
    </div>
  );
}
