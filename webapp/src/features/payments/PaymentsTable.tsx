import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActiveFilters,
  Badge,
  Button,
  ConfirmDeleteDialog,
  DataTable,
  EmptyState,
  FilterPills,
  Kpi,
  ListToolbar,
  PeriodFilter,
  PERIOD_PRESET_OPTIONS,
  RowMenu,
  SegmentedControl,
  SelectionBar,
  ServiceBadge,
  groupTone,
  useToast,
  type BadgeTone,
  type CardTone,
  type PillTone,
} from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatNameList } from '@shared/format/name-list';
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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedRows = data.rows.filter(row => selectedRowKeys.has(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.total, 0);
  const allSelectedArchived = selectedRows.length > 0 && selectedRows.every(row => row.archived);
  const showDeleteForever = data.archiveFilter === 'archived' || (data.archiveFilter === 'all' && allSelectedArchived);

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

  async function unarchiveSelected() {
    const targets = selectedRows;
    if (targets.length === 0) return;
    try {
      await data.unarchiveMany(targets.map(row => row.id));
      setSelectedRowKeys(new Set());
      toast.show({ message: `${targets.length} achitări dezarhivate.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteSelectedForever() {
    const targets = selectedRows;
    if (targets.length === 0) return;
    try {
      await data.deleteManyForever(targets.map(row => row.id));
      setSelectedRowKeys(new Set());
      toast.show({ message: `${targets.length} achitări șterse definitiv.` });
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
  if (data.service) {
    const serviceLabel = data.services.find(service => service.id === data.service)?.name ?? data.service;
    activeFilterChips.push({
      key: 'service',
      label: `Serviciu: ${serviceLabel}`,
      onClear: () => data.setService(''),
    });
  }
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
  if (data.periodPreset !== 'tot') {
    const presetLabel = PERIOD_PRESET_OPTIONS.find(option => option.value === data.periodPreset)?.label ?? '';
    activeFilterChips.push({
      key: 'period',
      label:
        data.periodPreset === 'interval'
          ? `Perioadă: ${data.periodFrom ? formatDate(data.periodFrom) : '…'} – ${data.periodTo ? formatDate(data.periodTo) : '…'}`
          : `Perioadă: ${presetLabel}`,
      onClear: () => {
        data.setPeriodPreset('tot');
        data.setPeriodFrom('');
        data.setPeriodTo('');
      },
    });
  }

  function resetFilters() {
    // Căutarea + pastilele trec printr-un singur apel (vezi resetUrlFilters) — toate ating URL-ul
    // și s-ar suprascrie reciproc dacă ar fi cinci apeluri separate în același tur de evenimente.
    data.resetUrlFilters();
    data.setPeriodPreset('tot');
    data.setPeriodFrom('');
    data.setPeriodTo('');
  }

  const activeFilterLabels = activeFilterChips.map(chip => chip.label);

  return (
    <>
      <SummaryCards summary={data.summary} method={data.method} />

      <div className={styles.tableCard}>
        <ListToolbar
          className={styles.toolbar}
          search={{
            value: data.search,
            onChange: data.setSearch,
            placeholder: 'Caută copil, plătitor sau sumă',
            ariaLabel: 'Căutare achitări',
          }}
        >
          <PeriodFilter
            preset={data.periodPreset}
            onPresetChange={data.setPeriodPreset}
            from={data.periodFrom}
            onFromChange={data.setPeriodFrom}
            to={data.periodTo}
            onToChange={data.setPeriodTo}
          />
          <SegmentedControl<ArchiveFilter>
            options={ARCHIVE_FILTER_OPTIONS}
            value={data.archiveFilter}
            onChange={data.setArchiveFilter}
            ariaLabel="Filtru arhivare"
          />
        </ListToolbar>

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
              label: 'Serviciu',
              value: data.service,
              onChange: data.setService,
              options: [
                { value: '', label: 'Toate', tone: 'neutral' },
                ...data.services.map(service => ({
                  value: service.id,
                  label: service.name,
                  tone: service.tone as PillTone,
                })),
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

        {activeFilterChips.length > 0 && <ActiveFilters filters={activeFilterChips} onReset={resetFilters} />}

        {selectedRows.length > 0 && (
          <SelectionBar
            floating
            label={
              <>
                {selectedRows.length} selectate · {formatMoney(selectedTotal)}
              </>
            }
            onCancel={() => setSelectedRowKeys(new Set())}
            actions={[
              { label: 'Asociază în De rezolvat →', onClick: () => navigate('/asociere-achitari') },
              { label: 'Exportă', onClick: exportSelected },
              data.archiveFilter === 'archived'
                ? { label: 'Dezarhivează', onClick: () => void unarchiveSelected(), tone: 'accent' }
                : { label: 'Arhivează', onClick: () => void archiveSelected(), tone: 'accent' },
            ]}
            danger={
              showDeleteForever ? { label: 'Șterge definitiv', onClick: () => setBulkDeleteOpen(true) } : undefined
            }
          />
        )}

        <DataTable<PaymentRowView>
          bare
          rows={data.rows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          sort={data.sort}
          onSortChange={data.setSort}
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
                    <Button
                      className={styles.unassignedLink}
                      onClick={event => {
                        event.stopPropagation();
                        navigate(`/asociere-achitari?id=${row.id}`);
                      }}
                    >
                      Neasociată →
                    </Button>
                  </span>
                ) : (
                  row.childLabel
                ),
            },
            {
              key: 'service',
              header: 'Serviciu',
              sortValue: row => row.serviceLabel,
              render: row => <ServiceBadge service={{ name: row.serviceLabel, tone: row.serviceTone }} />,
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
                      {row.tenders.length > 1 ? `${tender.method} ${formatMoney(tender.amount)}` : tender.method}
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

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Ștergi definitiv ${selectedRows.length} ${selectedRows.length === 1 ? 'achitare' : 'achitări'}?`}
        description={`${formatNameList(selectedRows.map(row => row.childLabel))}. Se șterg repartizările; obligația lunii se recalculează. Nu poate fi anulată.`}
        confirmLabel={`Șterge ${selectedRows.length} ${selectedRows.length === 1 ? 'achitare' : 'achitări'}`}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteSelectedForever();
          setBulkDeleteOpen(false);
        }}
      />
    </>
  );
}

function SummaryCards({ summary, method }: { summary: PaymentsData['summary']; method: string }) {
  const activeTone = (methodName: string): CardTone | undefined =>
    method === methodName ? (METHOD_TONE[methodName] as CardTone) : undefined;

  return (
    <div className={styles.summaryRow}>
      <Kpi
        tone="orange"
        decorative
        size="lg"
        className={styles.summaryCard}
        label={`Total filtrat · ${summary.count} achitări`}
        value={formatMoney(summary.total)}
      />
      <Kpi
        tone="white"
        activeTone={activeTone('Cash')}
        className={styles.summaryCard}
        label={`Cash · ${summary.cashCount}`}
        value={formatMoney(summary.cash)}
      />
      <Kpi
        tone="white"
        activeTone={activeTone('Card')}
        className={styles.summaryCard}
        label={`Card · ${summary.cardCount}`}
        value={formatMoney(summary.card)}
      />
      <Kpi
        tone="mint"
        activeTone={activeTone('Transfer')}
        className={styles.summaryCard}
        label={`Transfer · ${summary.transferCount}`}
        value={formatMoney(summary.transfer)}
      />
    </div>
  );
}
