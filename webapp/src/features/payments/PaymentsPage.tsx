import { useState } from 'react';
import {
  Badge,
  Card,
  ConfirmDeleteDialog,
  DataTable,
  FilterPills,
  SegmentedControl,
  SelectionBar,
  groupTone,
  useToast,
  type BadgeTone,
  type CardTone,
  type PillTone,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import {
  usePayments,
  ARCHIVE_FILTER_OPTIONS,
  type ArchiveFilter,
  type PaymentRowView,
  type PaymentsData,
} from './usePayments';
import { PaymentFormDrawer } from './PaymentFormDrawer';
import type { PaymentFormValues } from './payment-form';
import type { Payment } from '@contracts/record-types.mjs';
import styles from './PaymentsPage.module.css';

type ViewMode = 'table' | 'months';

const VIEW_MODE_OPTIONS = [
  { value: 'table' as ViewMode, label: 'Tabel' },
  { value: 'months' as ViewMode, label: 'Pe luna încasării' },
];

const METHOD_TONE: Record<string, BadgeTone> = { Cash: 'orange', Card: 'yellow', Transfer: 'mint' };

export interface PaymentsPageProps {
  /** Sursa formularului deschis — controlată din URL (/achitari/nou sau /achitari/:paymentId) de ruta din App.tsx. */
  formTargetId: string | null;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onCloseForm: () => void;
  /** Click pe un rând cu copil asociat — deschide fișa copilului (/copii/:id). */
  onOpenChild: (id: string) => void;
  /** Presetează filtrul „Copil" — venit din ?copil= (link „Toate achitările" din fișa copilului). */
  initialChildId?: string;
}

export function PaymentsPage({
  formTargetId,
  onOpenCreate,
  onOpenEdit,
  onCloseForm,
  onOpenChild,
  initialChildId,
}: PaymentsPageProps) {
  const paymentsData = usePayments(initialChildId);
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('payments.viewMode', 'table');

  if (paymentsData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (paymentsData.status === 'failed')
    return <p className={styles.notice}>{paymentsData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const formTarget: Payment | 'new' | null =
    formTargetId === 'nou'
      ? 'new'
      : formTargetId
        ? (paymentsData.records.payments.find(p => p.id === formTargetId) ?? null)
        : null;

  async function submitPaymentForm(values: PaymentFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      if (previous) {
        await paymentsData.updatePayment(previous, values);
        onCloseForm();
        toast.show({ message: 'Achitare actualizată.' });
        return;
      }
      const saved = await paymentsData.createPayment(values, () =>
        window.confirm(
          'Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?',
        ),
      );
      if (saved) {
        onCloseForm();
        toast.show({ message: 'Achitare adăugată.' });
      }
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <div className={styles.header}>
        <SegmentedControl
          options={VIEW_MODE_OPTIONS}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Mod de afișare"
        />
        <button type="button" className={styles.primaryButton} onClick={onOpenCreate}>
          + Achitare nouă
        </button>
      </div>

      <SummaryCards summary={paymentsData.summary} method={paymentsData.method} />
      <Filters data={paymentsData} />

      <FilterPills
        groups={[
          {
            label: 'Metodă',
            value: paymentsData.method,
            onChange: paymentsData.setMethod,
            options: [
              { value: '', label: 'Toate', tone: 'neutral' },
              { value: 'Cash', label: 'Cash', tone: METHOD_TONE.Cash as PillTone },
              { value: 'Card', label: 'Card', tone: METHOD_TONE.Card as PillTone },
              { value: 'Transfer', label: 'Transfer', tone: METHOD_TONE.Transfer as PillTone },
            ],
          },
          {
            label: 'Grupă',
            value: paymentsData.groupFilter,
            onChange: paymentsData.setGroupFilter,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              ...paymentsData.groups.map(group => ({
                value: group.id,
                label: group.name,
                tone: groupTone(group.id, paymentsData.groups),
              })),
              { value: 'none', label: 'Fără grupă', tone: 'neutral' },
            ],
          },
        ]}
      />

      {viewMode === 'table' ? (
        <TableView data={paymentsData} onEdit={onOpenEdit} onOpenChild={onOpenChild} />
      ) : (
        <MonthsView rows={paymentsData.rows} onEdit={onOpenEdit} />
      )}

      <PaymentFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        records={paymentsData.records}
        onSubmit={submitPaymentForm}
        onClose={onCloseForm}
      />
    </>
  );
}

function SummaryCards({ summary, method }: { summary: PaymentsData['summary']; method: string }) {
  const cardTone = (value: number, tone: CardTone): CardTone => (value > 0 ? tone : 'white');
  const activeClass = (active: boolean) => (active ? ` ${styles.summaryCardActive}` : '');
  return (
    <div className={styles.summaryRow}>
      <Card tone="orange" decorative className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Total filtrat</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.total)}</strong>
        <small>{summary.count} achitări</small>
      </Card>
      <Card tone={cardTone(summary.cash, 'mint')} className={styles.summaryCard + activeClass(method === 'Cash')}>
        <p className={styles.summaryLabel}>Cash</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.cash)}</strong>
      </Card>
      <Card tone={cardTone(summary.card, 'yellow')} className={styles.summaryCard + activeClass(method === 'Card')}>
        <p className={styles.summaryLabel}>Card</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.card)}</strong>
      </Card>
      <Card
        tone={cardTone(summary.transfer, 'pink')}
        className={styles.summaryCard + activeClass(method === 'Transfer')}
      >
        <p className={styles.summaryLabel}>Transfer</p>
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

function Filters({ data }: { data: PaymentsData }) {
  return (
    <Card className={styles.filtersCard}>
      <div className={styles.filtersRow}>
        <input
          className={styles.searchInput}
          value={data.search}
          onChange={event => data.setSearch(event.target.value)}
          placeholder="Caută după nume, notițe…"
          aria-label="Căutare achitări"
        />
        <label className={styles.filterField}>
          De la
          <input
            type="month"
            value={data.monthFrom}
            onChange={event => data.setMonthFrom(event.target.value)}
            aria-label="Perioadă de la"
          />
        </label>
        <label className={styles.filterField}>
          Până la
          <input
            type="month"
            value={data.monthTo}
            onChange={event => data.setMonthTo(event.target.value)}
            aria-label="Perioadă până la"
          />
        </label>
        <SegmentedControl<ArchiveFilter>
          options={ARCHIVE_FILTER_OPTIONS}
          value={data.archiveFilter}
          onChange={data.setArchiveFilter}
          ariaLabel="Filtru arhivare"
        />
      </div>
    </Card>
  );
}

function TableView({
  data,
  onEdit,
  onOpenChild,
}: {
  data: PaymentsData;
  onEdit: (id: string) => void;
  onOpenChild: (id: string) => void;
}) {
  const toast = useToast();
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
        onAction: () => {
          void Promise.all(targets.map(row => data.unarchivePayment(row.id)));
        },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
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

  return (
    <>
      {selectedRows.length > 0 && (
        <SelectionBar
          label={
            <>
              {selectedRows.length} selectate · {formatMoney(selectedTotal)}
            </>
          }
        >
          <button type="button" className={styles.primaryButton} onClick={archiveSelected}>
            Arhivează selectate
          </button>
        </SelectionBar>
      )}
      <DataTable<PaymentRowView>
        rows={data.rows}
        rowKey={row => row.id}
        selectable
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onRowClick={row => !row.unassigned && onOpenChild(row.childId)}
        emptyState={<span>Nu există achitări pentru filtrele alese.</span>}
        columns={[
          {
            key: 'date',
            header: 'Data',
            sortValue: row => row.date,
            render: row => row.dateLabel,
          },
          {
            key: 'child',
            header: 'Copil / sursă',
            sortValue: row => row.childLabel,
            render: row => (
              <>
                {row.childLabel}
                {row.unassigned && (
                  <>
                    {' '}
                    <Badge tone="pink">Neasociată</Badge>
                  </>
                )}
              </>
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
              <div className={styles.rowActions} onClick={event => event.stopPropagation()}>
                <button type="button" className={styles.linkButton} onClick={() => toggleArchived(row)}>
                  {row.archived ? 'Dezarhivează' : 'Arhivează'}
                </button>
                <button type="button" className={styles.linkButton} onClick={() => onEdit(row.id)}>
                  Editează
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!row.archived}
                  title={row.archived ? undefined : 'Arhivează întâi achitarea'}
                  onClick={() => setDeleteTarget(row)}
                >
                  Șterge
                </button>
              </div>
            ),
          },
        ]}
      />

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

function MonthsView({ rows, onEdit }: { rows: PaymentRowView[]; onEdit: (id: string) => void }) {
  const groups = new Map<string, PaymentRowView[]>();
  for (const row of rows) {
    const monthKey = row.date.slice(0, 7);
    const group = groups.get(monthKey);
    if (group) group.push(row);
    else groups.set(monthKey, [row]);
  }
  const months = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  if (months.length === 0) return <p className={styles.notice}>Nu există achitări pentru filtrele alese.</p>;

  return (
    <div className={styles.monthsStack}>
      {months.map(month => {
        const monthRows = groups.get(month) as PaymentRowView[];
        const subtotal = monthRows.reduce((sum, row) => sum + row.total, 0);
        return (
          <div key={month} className={styles.monthGroup}>
            <div className={styles.monthHead}>
              <p className={styles.monthTitle}>{formatMonthLabel(month)}</p>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <DataTable<PaymentRowView>
              rows={monthRows}
              rowKey={row => row.id}
              pageSize={monthRows.length || 1}
              onRowClick={row => onEdit(row.id)}
              columns={[
                { key: 'date', header: 'Data', render: row => row.dateLabel },
                { key: 'child', header: 'Copil / sursă', render: row => row.childLabel },
                { key: 'total', header: 'Total', align: 'end', render: row => formatMoney(row.total) },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}
