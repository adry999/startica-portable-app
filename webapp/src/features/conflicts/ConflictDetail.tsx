import { Button } from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import type { Group } from '@contracts/record-types.mjs';
import { fieldLabel, fieldValueLabel, kindLabel } from './field-labels';
import type { ConflictSummary } from './useConflicts';
import styles from './ConflictsPage.module.css';

export interface ConflictDetailProps {
  conflict: ConflictSummary;
  groups: Group[];
  onResolve: (choice: 'local' | 'remote') => void;
  resolving: boolean;
}

const DELETED = '(ștearsă)';

export function ConflictDetail({ conflict, groups, onResolve, resolving }: ConflictDetailProps) {
  return (
    <div className={styles.detail}>
      <p className={styles.eyebrow}>{kindLabel(conflict.kind)}</p>
      <h2 className={styles.detailTitle}>{conflict.title}</h2>

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span />
          <span>
            Pe acest calculator{conflict.localUpdatedAt ? ` · ${formatDateTime(conflict.localUpdatedAt)}` : ''}
          </span>
          <span>
            Pe {conflict.remoteDeviceName}
            {conflict.remoteUpdatedAt ? ` · ${formatDateTime(conflict.remoteUpdatedAt)}` : ''}
          </span>
        </div>
        {conflict.fields.map(f => (
          <div key={f.field} className={f.differs ? `${styles.tableRow} ${styles.tableRowDiffers}` : styles.tableRow}>
            <span className={styles.fieldName}>{fieldLabel(f.field)}</span>
            <span>{f.local === null ? DELETED : fieldValueLabel(f.field, f.local, groups)}</span>
            <span>{f.remote === null ? DELETED : fieldValueLabel(f.field, f.remote, groups)}</span>
          </div>
        ))}
      </div>

      <p className={styles.diffNote}>Rândurile galbene diferă. Celelalte câmpuri sunt identice.</p>

      <div className={styles.actions}>
        <Button variant="outline" disabled={resolving} onClick={() => onResolve('local')}>
          Păstrează varianta de pe acest calculator
        </Button>
        <Button disabled={resolving} onClick={() => onResolve('remote')}>
          Păstrează varianta de pe {conflict.remoteDeviceName}
        </Button>
      </div>
    </div>
  );
}
