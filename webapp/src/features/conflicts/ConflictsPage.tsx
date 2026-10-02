import { useState } from 'react';
import {
  Card,
  EMPTY_STATES,
  EmptyState,
  LoadingState,
  resolveEmptyStateText,
  resolveEmptyStateTitle,
  SelectableRow,
  useToast,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { kindLabel } from './field-labels';
import { useConflicts } from './useConflicts';
import styles from './ConflictsPage.module.css';
import { ConflictDetail } from './ConflictDetail';
import { toUserError } from '@shared/api/to-user-error';

export function ConflictsPage() {
  const { conflicts, loading, activeId, setActiveId, resolve } = useConflicts();
  const { state } = useAppSession();
  const toast = useToast();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (loading) return <LoadingState />;

  if (conflicts.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState
          variant={EMPTY_STATES['conflicte.done'].variant}
          title={resolveEmptyStateTitle(EMPTY_STATES['conflicte.done'])}
          description={resolveEmptyStateText(EMPTY_STATES['conflicte.done'])}
        />
      </div>
    );
  }

  const active = conflicts.find(c => c.id === activeId) ?? conflicts[0];

  async function handleResolve(choice: 'local' | 'remote') {
    setResolvingId(active.id);
    try {
      await resolve(active.id, choice);
    } catch (error) {
      // B-6: fără acest catch, un 404 („conflictul nu mai există” — rezolvat din altă
      // filă) sau un 500 dispăreau doar în consolă; butonul părea că nu face nimic.
      toast.show({ message: toUserError(error) });
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
          <SelectableRow
            key={conflict.id}
            className={conflict.id === active.id ? `${styles.row} ${styles.rowActive}` : styles.row}
            onClick={() => setActiveId(conflict.id)}
          >
            <span className={styles.rowTitle}>{conflict.title}</span>
            <span className={styles.rowSubtitle}>
              {kindLabel(conflict.kind)} · {conflict.subtitle}
              {conflict.dataset === 'comun' ? ' · Comun' : ''}
            </span>
          </SelectableRow>
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
