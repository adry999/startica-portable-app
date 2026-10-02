import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  ConfirmDeleteDialog,
  DataTable,
  EmptyState,
  LoadingState,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { downloadCsv } from '@shared/csv-export';
import { formatNameList } from '@shared/format/name-list';
import { missingChildFields } from '#shared/domain/missing-child-fields.mjs';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [groupFilter, setGroupFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [completenessFilter, setCompletenessFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Child | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChildRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // „Copil nou" de pe Dashboard („Adaugă primii copii", dashboard.attention.first) trece direct
  // la formular, ca la Cheltuieli (08-dashboard.md #3) — fără să rămână în URL.
  useEffect(() => {
    if (searchParams.get('nou') !== '1') return;
    setFormTarget('new');
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        next.delete('nou');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      if (paymentFilter !== 'all' && row.payment?.label !== paymentFilter) return false;
      if (completenessFilter === 'incomplete' && missingChildFields(row.child).length === 0) return false;
      if (normalizedQuery) {
        // A8: căutarea găsește și după al doilea părinte (nume + telefon), nu doar contactul principal.
        const haystack = `${row.name} ${row.parent} ${row.phone} ${row.child.parent2 ?? ''} ${
          row.child.phone2 ?? ''
        } ${row.child.contractNumber ?? row.child.id}`.toLocaleLowerCase('ro-RO');
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [childrenData.rows, archiveFilter, groupFilter, paymentFilter, completenessFilter, query]);

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
        onAction: () => void undoArchiveSelected(targets),
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // M1: secvențial, nu Promise.all — session.mutate refuză o mutație pornită cât alta e
  // „pending”, deci un Promise.all lasă doar primul copil dezarhivat.
  async function undoArchiveSelected(targets: ChildRow[]) {
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, archived: false, archivedAt: null },
        });
      }
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
        row.payment?.label ?? '',
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

  // C1: mutația eșuată trebuie să ajungă înapoi la ChildFormDrawer (re-aruncată, după toast),
  // altfel handleSubmit crede că a salvat și „Salvează și schimbă” ar comuta filiala degeaba.
  async function submitChildForm(values: ChildFormValues) {
    const previous = formTarget && formTarget !== 'new' ? formTarget : null;
    const record = buildChildRecord(previous, `ID-${crypto.randomUUID()}`, values);
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: previous ? 'update' : 'create',
        record,
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
      throw error;
    }
    setFormTarget(null);
    toast.show({ message: previous ? 'Fișă actualizată.' : 'Copil adăugat.' });
  }

  async function deleteChildForever(row: ChildRow) {
    try {
      await session.mutate('/api/record-delete', { type: 'children', id: row.id });
      toast.show({ message: 'Fișă ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteSelectedForever() {
    const ids = [...selectedRowKeys];
    const targets = childrenData.rows.filter(row => ids.includes(row.id));
    if (targets.length === 0) return;
    try {
      await session.mutate('/api/record-delete', {
        type: 'children',
        ids: targets.map(row => row.id),
      });
      setSelectedRowKeys(new Set());
      toast.show({ message: `${targets.length} ${targets.length === 1 ? 'copil șters' : 'copii șterși'} definitiv.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (childrenData.status === 'loading') return <LoadingState />;
  if (childrenData.status === 'failed')
    return <p className={styles.notice}>{childrenData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns = buildChildrenColumns({
    groups: childrenData.groups,
    month,
    onEdit: row => setFormTarget(row.child),
    onToggleArchived: row => void toggleArchived(row),
    onRequestDelete: row => setDeleteTarget(row),
  });

  const activeFilterLabels: string[] = [];
  if (query.trim()) activeFilterLabels.push(`Căutare: „${query.trim()}”`);
  if (archiveFilter !== 'active') activeFilterLabels.push(archiveFilter === 'archived' ? 'Arhivați' : 'Toți');
  if (groupFilter !== 'all') {
    activeFilterLabels.push(
      groupFilter === 'none' ? 'Fără grupă' : (childrenData.groups.find(g => g.id === groupFilter)?.name ?? ''),
    );
  }
  if (paymentFilter !== 'all') activeFilterLabels.push(paymentFilter);
  if (completenessFilter === 'incomplete') activeFilterLabels.push('Date incomplete');

  const selectedRows = childrenData.rows.filter(row => selectedRowKeys.has(row.id));
  const allSelectedArchived = selectedRows.length > 0 && selectedRows.every(row => row.archived);

  function clearFilters() {
    setQuery('');
    setArchiveFilter('active');
    setGroupFilter('all');
    setPaymentFilter('all');
    setCompletenessFilter('all');
  }

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
          completenessFilter={completenessFilter}
          onCompletenessFilterChange={setCompletenessFilter}
        />

        {selectedRowKeys.size > 0 && (
          <ChildrenSelectionBar
            selectedCount={selectedRowKeys.size}
            onCancel={() => setSelectedRowKeys(new Set())}
            groups={childrenData.groups}
            onMove={groupId => void moveSelectedToGroup(groupId)}
            onExport={exportSelected}
            archiveFilter={archiveFilter}
            onArchive={() => void archiveSelected()}
            onUnarchive={() => void unarchiveSelected()}
            allSelectedArchived={allSelectedArchived}
            onDeleteForever={() => setBulkDeleteOpen(true)}
          />
        )}

        <DataTable
          key={`${archiveFilter}-${groupFilter}-${paymentFilter}-${completenessFilter}-${query}`}
          bare
          columns={columns}
          rows={filteredRows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          onRowClick={row => onOpenChild(row.id)}
          emptyState={
            <EmptyState
              title="Niciun copil nu corespunde filtrelor curente"
              activeFilters={activeFilterLabels}
              onClearFilters={clearFilters}
            />
          }
        />
      </div>

      {/* C2: 'closed' distinct de 'new' — altfel a doua „+ Adaugă copil” reia instanța
          (și valorile) primei, în loc să pornească de la un formular gol. */}
      <ChildFormDrawer
        key={formTarget === null ? 'closed' : formTarget === 'new' ? 'new' : formTarget.id}
        target={formTarget}
        groups={childrenData.groups}
        allChildren={childrenData.rows}
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

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Ștergi definitiv ${selectedRows.length} ${selectedRows.length === 1 ? 'copil' : 'copii'}?`}
        description={`${formatNameList(selectedRows.map(row => row.name))}. Se șterg prezența, plătitorii reținuți; achitările rămân, cu copil neasociat. Nu poate fi anulată.`}
        confirmLabel={`Șterge ${selectedRows.length} ${selectedRows.length === 1 ? 'copil' : 'copii'}`}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteSelectedForever();
          setBulkDeleteOpen(false);
        }}
      />
    </>
  );
}
