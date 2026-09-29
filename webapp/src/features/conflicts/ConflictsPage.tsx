import { useState } from 'react';
import { Card, EmptyState, LoadingState } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { kindLabel } from './field-labels';
import { useConflicts } from './useConflicts';
import styles from './ConflictsPage.module.css';
import { ConflictDetail } from './ConflictDetail';

export function ConflictsPage() {
  const { conflicts, loading, activeId, setActiveId, resolve } = useConflicts();
  const { state } = useAppSession();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (loading) return <LoadingState />;

  if (conflicts.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState variant="resolved" title="Nu există conflicte." />
      </div>
    );
  }

  const active = conflicts.find(c => c.id === activeId) ?? conflicts[0];

  async function handleResolve(choice: 'local' | 'remote') {
    setResolvingId(active.id);
    try {
      await resolve(active.id, choice);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <Card className={styles.list}>
        <p className={styles.listHeader}>
          {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicte'}
        </p>
        {conflicts.map(conflict => (
          <button
            key={conflict.id}
            type="button"
            className={conflict.id === active.id ? `${styles.row} ${styles.rowActive}` : styles.row}
            onClick={() => setActiveId(conflict.id)}
          >
            <span className={styles.rowTitle}>{conflict.title}</span>
            <span className={styles.rowSubtitle}>
              {kindLabel(conflict.kind)} · {conflict.subtitle}
              {conflict.dataset === 'comun' ? ' · Comun' : ''}
            </span>
          </button>
        ))}
      </Card>

      <Card className={styles.detailCard}>
        <ConflictDetail
          conflict={active}
          groups={state.state.groups}
          onResolve={handleResolve}
          resolving={resolvingId === active.id}
        />
      </Card>
    </div>
  );
}
