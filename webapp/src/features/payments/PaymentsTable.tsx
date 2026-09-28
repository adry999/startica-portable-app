import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Card,
  ConfirmDeleteDialog,
  DataTable,
  EmptyState,
  FilterPills,
  RowMenu,
  SearchInput,
  SegmentedControl,
  SelectionBar,
  groupTone,
  useToast,
  type BadgeTone,
  type PillTone,
} from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { exportPaymentsCsv } from './payments-export';
import { ARCHIVE_FILTER_OPTIONS, type ArchiveFilter, type PaymentRowView, type PaymentsData } from './usePayments';
import styles from './PaymentsTable.module.css';

const METHOD_TONE: Record<string, BadgeTone> = { Cash: 'orange', Card: 'yellow', Transfer: 'mint' };

export interface PaymentsTableProps {
  data: PaymentsData;
  onEdit: (id: string) => void;
  onOpenChild: (id: string) => void;
}

/** Mod Tabel (05-achitari.md §3) — carduri pe metodă + card-tabel cu toolbar, pastile, listă și selecție plutitoare. */
export function PaymentsTable({ data, onEdit, onOpenChild }: PaymentsTableProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<PaymentRowView | null>(null);

  const selectedRows = data.rows.filter(row => selectedRowKeys.has(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.total, 0);

  async function archiveSelected() {
    const targets = selectedRows;
    if (targets.length === 0) return;
    try {
      await data.archiveMany(targets.map(row => row.id));
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} achitări arhivate.`,
        actionLabel: 'Anulează',
        onAction: () => void undoArchiveMany(targets),
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // M1: secvențial, nu Promise.all — session.mutate refuză o mutație pornită cât alta e
  // „pending”, deci un Promise.all lasă doar prima dezarhivare să reușească.
  async function undoArchiveMany(targets: PaymentRowView[]) {
    try {
      for (const row of targets) await data.unarchivePayment(row.id);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function exportSelected() {
    exportPaymentsCsv(`achitari-selectate-${selectedRows.length}.csv`, selectedRows);
  }

  async function toggleArchived(row: PaymentRowView) {
    try {
      if (row.archived) {
        await data.unarchivePayment(row.id);
        toast.show({ message: 'Achitare dezarhivată.' });
      } else {
        await data.archivePayment(row.id);
        toast.show({
          message: 'Achitare arhivată.',
          actionLabel: 'Anulează',
          onAction: () => {
            void data.unarchivePayment(row.id);
          },
        });
      }
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteForever(row: PaymentRowView) {
    try {
      await data.deletePayment(row.id);
      toast.show({ message: 'Achitare ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const activeFilterChips: { key: string; label: string; onClear: () => void }[] = [];
  if (data.method)
    activeFilterChips.push({ key: 'method', label: `Metodă: ${data.method}`, onClear: () => data.setMethod('') });
  if (data.groupFilter !== 'all') {
    const groupLabel =
      data.groupFilter === 'none' ? 'Fără grupă' : (data.groups.find(g => g.id === data.groupFilter)?.name ?? '');
    activeFilterChips.push({ key: 'group', label: `Grupa: ${groupLabel}`, onClear: () => data.setGroupFilter('all') });
  }
  if (data.archiveFilter !== 'active') {
    activeFilterChips.push({
      key: 'archive',
      label: data.archiveFilter === 'archived' ? 'Arhivate' : 'Toate',
      onClear: () => data.setArchiveFilter('active'),
    });
  }
  if (data.monthFrom || data.monthTo) {
    activeFilterChips.push({
      key: 'period',
      label: `Perioadă: ${data.monthFrom || '…'} – ${data.monthTo || '…'}`,
      onClear: () => {
        data.setMonthFrom('');
        data.setMonthTo('');
      },
    });
  }

  function resetFilters() {
    data.setMethod('');
    data.setGroupFilter('all');
    data.setArchiveFilter('active');
    data.setMonthFrom('');
    data.setMonthTo('');
    data.setSearch('');
  }

  const activeFilterLabels = activeFilterChips.map(chip => chip.label);

  return (
    <>
      <SummaryCards summary={data.summary} method={data.method} />

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <SearchInput
            value={data.search}
            onChange={data.setSearch}
            placeholder="Caută copil, plătitor sau sumă"
            ariaLabel="Căutare achitări"
          />
          <label className={styles.periodField}>
            Perioadă
            <span className={styles.periodInputs}>
              <input
                type="month"
                value={data.monthFrom}
                onChange={event => data.setMonthFrom(event.target.value)}
                aria-label="Perioadă de la"
              />
              <span aria-hidden="true">–</span>
              <input
                type="month"
                value={data.monthTo}
                onChange={event => data.setMonthTo(event.target.value)}
                aria-label="Perioadă până la"
              />
            </span>
          </label>
          <SegmentedControl<ArchiveFilter>
            options={ARCHIVE_FILTER_OPTIONS}
            value={data.archiveFilter}
            onChange={data.setArchiveFilter}
            ariaLabel="Filtru arhivare"
          />
        </div>

        <FilterPills
          groups={[
            {
              label: 'Metodă',
              value: data.method,
              onChange: data.setMethod,
              options: [
                { value: '', label: 'Toate', tone: 'neutral' },
                { value: 'Cash', label: 'Cash', tone: METHOD_TONE.Cash as PillTone },
                { value: 'Card', label: 'Card', tone: METHOD_TONE.Card as PillTone },
                { value: 'Transfer', label: 'Transfer', tone: METHOD_TONE.Transfer as PillTone },
              ],
            },
            {
              label: 'Grupa',
              value: data.groupFilter,
              onChange: data.setGroupFilter,
              options: [
                { value: 'all', label: 'Toate', tone: 'neutral' },
                ...data.groups.map(group => ({
                  value: group.id,
                  label: group.name,
                  tone: groupTone(group.id, data.groups),
                })),
                { value: 'none', label: 'Fără grupă', tone: 'neutral' },
              ],
            },
          ]}
        />

        {activeFilterChips.length > 0 && (
          <div className={styles.activeFilters}>
            <span className={styles.activeFiltersLabel}>Filtre active:</span>
            {activeFilterChips.map(chip => (
              <button key={chip.key} type="button" className={styles.activeFilterChip} onClick={chip.onClear}>
                {chip.label} ×
              </button>
            ))}
            <button type="button" className={styles.resetFilters} onClick={resetFilters}>
              Resetează
            </button>
          </div>
        )}

        {selectedRows.length > 0 && (
          <SelectionBar
            floating
            label={
              <>
                {selectedRows.length} selectate · {formatMoney(selectedTotal)}
              </>
            }
            onCancel={() => setSelectedRowKeys(new Set())}
          >
            <button type="button" onClick={() => navigate('/asociere-achitari')}>
              Asociază în De rezolvat →
            </button>
            <button type="button" onClick={exportSelected}>
              Exportă
            </button>
            <button type="button" className={styles.selectionArchive} onClick={() => void archiveSelected()}>
              Arhivează
            </button>
          </SelectionBar>
        )}

        <DataTable<PaymentRowView>
          bare
          rows={data.rows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          onRowClick={row => !row.unassigned && onOpenChild(row.childId)}
          emptyState={
            <EmptyState
              title="Nu există achitări pentru filtrele alese."
              activeFilters={activeFilterLabels}
              onClearFilters={resetFilters}
            />
          }
          columns={[
            {
              key: 'date',
              header: 'Data',
              sortValue: row => row.date,
              render: row => row.dateLabel,
            },
            {
              key: 'child',
              header: 'Copil',
              sortValue: row => row.childLabel,
              render: row =>
                row.unassigned ? (
                  <span className={styles.unassignedCell}>
                    —{' '}
                    <button
                      type="button"
                      className={styles.unassignedLink}
                      onClick={event => {
                        event.stopPropagation();
                        navigate(`/asociere-achitari?id=${row.id}`);
                      }}
                    >
                      Neasociată →
                    </button>
                  </span>
                ) : (
                  row.childLabel
                ),
            },
            {
              key: 'sourceName',
              header: 'Plătitor',
              sortValue: row => row.sourceName,
              render: row => row.sourceName || '—',
            },
            {
              key: 'method',
              header: 'Metodă',
              render: row => (
                <span className={styles.badgeStack}>
                  {row.tenders.map(tender => (
                    <Badge key={tender.method} tone={METHOD_TONE[tender.method] ?? 'neutral'}>
                      {tender.method} {formatMoney(tender.amount)}
                    </Badge>
                  ))}
                </span>
              ),
            },
            {
              key: 'allocations',
              header: 'Luni acoperite',
              render: row =>
                row.allocations.length === 0 ? (
                  <span className={styles.notice}>Avans nerepartizat</span>
                ) : (
                  <span className={styles.badgeStack}>
                    {row.allocations.map(allocation => (
                      <Badge key={allocation.month} tone="yellow">
                        {allocation.label}
                      </Badge>
                    ))}
                  </span>
                ),
            },
            {
              key: 'total',
              header: 'Total',
              align: 'end',
              sortValue: row => row.total,
              render: row => <strong>{formatMoney(row.total)}</strong>,
            },
            {
              key: 'actions',
              header: '',
              align: 'end',
              render: row => (
                <RowMenu
                  items={[
                    { label: 'Editează', onClick: () => onEdit(row.id) },
                    { label: 'Tipărește confirmarea', onClick: () => navigate(`/achitari/${row.id}/confirmare`) },
                    { label: 'Schimbă copilul', onClick: () => navigate(`/asociere-achitari?id=${row.id}`) },
                    { label: row.archived ? 'Dezarhivează' : 'Arhivează', onClick: () => toggleArchived(row) },
                    {
                      label: 'Șterge definitiv',
                      danger: true,
                      disabled: !row.archived,
                      title: row.archived ? undefined : 'Arhivează întâi achitarea',
                      onClick: () => setDeleteTarget(row),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Ștergere definitivă"
        description={
          deleteTarget
            ? `Ștergi definitiv achitarea ${deleteTarget.id}? Nu poate fi anulată, spre deosebire de arhivare.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteForever(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

const METHOD_ACTIVE_CLASS: Record<string, string> = {
  Cash: 'summaryActiveCash',
  Card: 'summaryActiveCard',
  Transfer: 'summaryActiveTransfer',
};

function SummaryCards({ summary, method }: { summary: PaymentsData['summary']; method: string }) {
  const activeClass = (methodName: string) =>
    method === methodName ? ` ${styles.summaryActive} ${styles[METHOD_ACTIVE_CLASS[methodName]]}` : '';

  return (
    <div className={styles.summaryRow}>
      <Card tone="orange" decorative className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Total filtrat · {summary.count} achitări</p>
        <strong className={styles.summaryValueLg}>{formatMoney(summary.total)}</strong>
      </Card>
      <Card tone="white" className={styles.summaryCard + activeClass('Cash')}>
        <p className={styles.summaryLabel}>Cash · {summary.cashCount}</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.cash)}</strong>
      </Card>
      <Card tone="white" className={styles.summaryCard + activeClass('Card')}>
        <p className={styles.summaryLabel}>Card · {summary.cardCount}</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.card)}</strong>
      </Card>
      <Card tone="mint" className={styles.summaryCard + activeClass('Transfer')}>
        <p className={styles.summaryLabel}>Transfer · {summary.transferCount}</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.transfer)}</strong>
      </Card>
      {summary.other > 0 && (
        <Card tone="dashed" className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Altele</p>
          <strong className={styles.summaryValue}>{formatMoney(summary.other)}</strong>
        </Card>
      )}
    </div>
  );
}
