import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmDeleteDialog, DataTable, useToast, useTopbarActions } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { downloadCsv } from '@shared/csv-export';
import { useChildren, type ChildRow } from './useChildren';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import { ChildProfileView } from './ChildProfileView';
import { ChildrenStatsRow } from './ChildrenStatsRow';
import { ChildrenToolbar, type ArchiveFilter } from './ChildrenToolbar';
import { ChildrenSelectionBar } from './ChildrenSelectionBar';
import { buildChildrenColumns } from './childrenColumns';
import type { Child } from '@contracts/record-types.mjs';
import type { ViewKey } from '@shared/view-key';
import styles from './ChildrenPage.module.css';

export interface ChildrenPageProps {
  month: string;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
  /** Sursa fișei deschise — controlată din URL (/copii/:childId) de ruta din App.tsx. */
  childId: string | null;
  onOpenChild: (id: string) => void;
  onCloseChild: () => void;
}

/** „Copii" (1c) + „Fișa copilului" (1e) — fișa e o rută imbricată (/copii/:childId), nu o intrare nouă în ViewKey. */
export function ChildrenPage({ month, onNavigate, childId, onOpenChild, onCloseChild }: ChildrenPageProps) {
  if (childId) {
    return <ChildProfileView childId={childId} month={month} onBack={onCloseChild} onNavigate={onNavigate} />;
  }
  return <ChildrenListView month={month} onNavigate={onNavigate} onOpenChild={onOpenChild} />;
}

function ChildrenListView({
  month,
  onNavigate,
  onOpenChild,
}: {
  month: string;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
  onOpenChild: (id: string) => void;
}) {
  const childrenData = useChildren(month);
  const session = useAppSession();
  const toast = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [groupFilter, setGroupFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Child | 'new' | null>(null);
  const [moveGroupId, setMoveGroupId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChildRow | null>(null);

  useTopbarActions(
    <div className={styles.headerActions}>
      <Button variant="outline" onClick={() => navigate('/copii/zile-de-nastere')}>
        Zile de naștere
      </Button>
      <Button onClick={() => setFormTarget('new')}>+ Adaugă copil</Button>
    </div>,
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ro-RO');
    return childrenData.rows.filter(row => {
      if (archiveFilter === 'active' && row.archived) return false;
      if (archiveFilter === 'archived' && !row.archived) return false;
      if (groupFilter === 'none' && row.groupId) return false;
      if (groupFilter !== 'all' && groupFilter !== 'none' && row.groupId !== groupFilter) return false;
      if (paymentFilter !== 'all' && row.payment.label !== paymentFilter) return false;
      if (normalizedQuery) {
        const haystack = `${row.name} ${row.child.contractNumber ?? row.child.id}`.toLocaleLowerCase('ro-RO');
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [childrenData.rows, archiveFilter, groupFilter, paymentFilter, query]);

  async function archiveSelected() {
    const ids = [...selectedRowKeys];
    const targets = childrenData.rows.filter(row => ids.includes(row.id) && !row.archived);
    if (targets.length === 0) return;
    const archivedAt = new Date().toISOString();
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, archived: true, archivedAt },
        });
      }
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} ${targets.length === 1 ? 'copil arhivat' : 'copii arhivați'}`,
        actionLabel: 'Anulează',
        onAction: () => {
          void Promise.all(
            targets.map(row =>
              session.mutate('/api/record', {
                type: 'children',
                mode: 'update',
                record: { ...row.child, archived: false, archivedAt: null },
              }),
            ),
          );
        },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function unarchiveSelected() {
    const ids = [...selectedRowKeys];
    const targets = childrenData.rows.filter(row => ids.includes(row.id) && row.archived);
    if (targets.length === 0) return;
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, archived: false, archivedAt: null },
        });
      }
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} ${targets.length === 1 ? 'copil dezarhivat' : 'copii dezarhivați'}`,
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function moveSelectedToGroup(groupId: string) {
    const ids = [...selectedRowKeys];
    const targets = childrenData.rows.filter(row => ids.includes(row.id));
    if (targets.length === 0) return;
    const nextGroupId = groupId === '__none__' ? null : groupId;
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, groupId: nextGroupId },
        });
      }
      setSelectedRowKeys(new Set());
      setMoveGroupId('');
      toast.show({ message: `${targets.length} ${targets.length === 1 ? 'copil mutat' : 'copii mutați'} în grupă.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function exportSelected() {
    const ids = [...selectedRowKeys];
    const targets = childrenData.rows.filter(row => ids.includes(row.id));
    if (targets.length === 0) return;
    downloadCsv(
      `copii-${month}.csv`,
      ['Nume', 'Contract', 'Părinte', 'Telefon', 'Grupă', 'Scadență', 'Plată lună curentă'],
      targets.map(row => [
        row.name,
        row.contractLabel,
        row.parent,
        row.phone,
        row.groupName,
        row.dueDateLabel,
        row.payment.label,
      ]),
    );
  }

  async function toggleArchived(row: ChildRow) {
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: { ...row.child, archived: !row.archived, archivedAt: row.archived ? null : new Date().toISOString() },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitChildForm(values: ChildFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      const record = buildChildRecord(previous, `ID-${crypto.randomUUID()}`, values);
      await session.mutate('/api/record', {
        type: 'children',
        mode: previous ? 'update' : 'create',
        record,
      });
      setFormTarget(null);
      toast.show({ message: previous ? 'Fișă actualizată.' : 'Copil adăugat.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteChildForever(row: ChildRow) {
    try {
      await session.mutate('/api/record-delete', { type: 'children', id: row.id });
      toast.show({ message: 'Fișă ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (childrenData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (childrenData.status === 'failed')
    return <p className={styles.notice}>{childrenData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns = buildChildrenColumns({
    groups: childrenData.groups,
    onEdit: row => setFormTarget(row.child),
    onToggleArchived: row => void toggleArchived(row),
    onRequestDelete: row => setDeleteTarget(row),
  });

  return (
    <>
      <ChildrenStatsRow
        activeCount={childrenData.summary.activeCount}
        occupiedGroupsCount={childrenData.summary.occupiedGroupsCount}
        groupsCount={childrenData.groups.length}
        incompleteCount={childrenData.summary.incompleteCount}
        onReview={() => onNavigate('review')}
      />

      <div className={styles.tableCard}>
        <ChildrenToolbar
          query={query}
          onQueryChange={setQuery}
          archiveFilter={archiveFilter}
          onArchiveFilterChange={value => {
            setArchiveFilter(value);
            setSelectedRowKeys(new Set());
          }}
          activeTotal={childrenData.activeTotal}
          archivedTotal={childrenData.archivedTotal}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          groups={childrenData.groups}
          paymentFilter={paymentFilter}
          onPaymentFilterChange={setPaymentFilter}
        />

        {selectedRowKeys.size > 0 && (
          <ChildrenSelectionBar
            selectedCount={selectedRowKeys.size}
            onCancel={() => setSelectedRowKeys(new Set())}
            moveGroupId={moveGroupId}
            onMoveGroupIdChange={setMoveGroupId}
            groups={childrenData.groups}
            onMove={() => void moveSelectedToGroup(moveGroupId)}
            onExport={exportSelected}
            archiveFilter={archiveFilter}
            onArchive={() => void archiveSelected()}
            onUnarchive={() => void unarchiveSelected()}
          />
        )}

        <DataTable
          bare
          columns={columns}
          rows={filteredRows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          onRowClick={row => onOpenChild(row.id)}
          emptyState={<p>Niciun copil nu corespunde filtrelor curente.</p>}
        />
      </div>

      <ChildFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        groups={childrenData.groups}
        onSubmit={submitChildForm}
        onClose={() => setFormTarget(null)}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Ștergere definitivă"
        description={
          deleteTarget
            ? `Ștergi definitiv fișa ${deleteTarget.name}? Nu poate fi anulată, spre deosebire de arhivare.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteChildForever(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
