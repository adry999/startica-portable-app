import { useState } from 'react';
import { Badge, Card, DataTable, Drawer, SegmentedControl, useToast, type BadgeTone, type CardTone } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import {
  usePayments,
  ARCHIVE_FILTER_OPTIONS,
  METHOD_FILTER_OPTIONS,
  type ArchiveFilter,
  type PaymentRowView,
  type PaymentsData,
} from './usePayments';
import styles from './PaymentsPage.module.css';

type ViewMode = 'table' | 'months';

const VIEW_MODE_OPTIONS = [
  { value: 'table' as ViewMode, label: 'Tabel' },
  { value: 'months' as ViewMode, label: 'Pe luni' },
];

const METHOD_TONE: Record<string, BadgeTone> = { Cash: 'orange', Card: 'yellow', Transfer: 'mint' };

export function PaymentsPage() {
  const data = usePayments();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('payments.viewMode', 'table');
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  return (
    <>
      <div className={styles.header}>
        <SegmentedControl
          options={VIEW_MODE_OPTIONS}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Mod de afișare"
        />
        <button type="button" className={styles.primaryButton} onClick={() => setNewPaymentOpen(true)}>
          + Achitare nouă
        </button>
      </div>

      <SummaryCards summary={data.summary} />
      <Filters data={data} />

      {viewMode === 'table' ? <TableView data={data} toast={toast} /> : <MonthsView rows={data.rows} />}

      <Drawer open={newPaymentOpen} title="Achitare nouă" width={560} onClose={() => setNewPaymentOpen(false)}>
        {/* TODO(pasul următor din plan): formularul complet de achitare (3b). */}
        <p className={styles.notice}>Formular complet — pasul următor din plan.</p>
      </Drawer>
    </>
  );
}

function SummaryCards({ summary }: { summary: PaymentsData['summary'] }) {
  const cardTone = (value: number, tone: CardTone): CardTone => (value > 0 ? tone : 'white');
  return (
    <div className={styles.summaryRow}>
      <Card tone="orange" decorative className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Total filtrat</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.total)}</strong>
        <small>{summary.count} achitări</small>
      </Card>
      <Card tone={cardTone(summary.cash, 'mint')} className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Cash</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.cash)}</strong>
      </Card>
      <Card tone={cardTone(summary.card, 'yellow')} className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Card</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.card)}</strong>
      </Card>
      <Card tone={cardTone(summary.transfer, 'pink')} className={styles.summaryCard}>
        <p className={styles.summaryLabel}>Transfer</p>
        <strong className={styles.summaryValue}>{formatMoney(summary.transfer)}</strong>
      </Card>
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
          Copil
          <select
            value={data.childId}
            onChange={event => data.setChildId(event.target.value)}
            aria-label="Filtru copil"
          >
            <option value="">Toți</option>
            {data.childOptions.map(child => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </label>
        <SegmentedControl
          options={METHOD_FILTER_OPTIONS}
          value={data.method}
          onChange={data.setMethod}
          ariaLabel="Filtru metodă"
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

function TableView({ data, toast }: { data: PaymentsData; toast: ReturnType<typeof useToast> }) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set());

  const selectedRows = data.rows.filter(row => selectedRowKeys.has(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.total, 0);

  async function archiveSelected() {
    try {
      await data.archiveMany(selectedRows.map(row => row.id));
      toast.show({ message: `${selectedRows.length} achitări arhivate.` });
      setSelectedRowKeys(new Set());
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
        toast.show({ message: 'Achitare arhivată.' });
      }
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      {selectedRows.length > 0 && (
        <div className={styles.selectionBar}>
          <span>
            {selectedRows.length} selectate · {formatMoney(selectedTotal)}
          </span>
          <button type="button" className={styles.primaryButton} onClick={archiveSelected}>
            Arhivează selectate
          </button>
        </div>
      )}
      <DataTable<PaymentRowView>
        rows={data.rows}
        rowKey={row => row.id}
        selectable
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
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
            key: 'method',
            header: 'Metodă',
            render: row => (
              <span className={styles.badgeStack}>
                {row.tenders.map(tender => (
                  <Badge key={tender.method} tone={METHOD_TONE[tender.method] ?? 'neutral'}>
                    {tender.method}
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
            render: row => (
              <div className={styles.rowActions}>
                <button type="button" className={styles.linkButton} onClick={() => toggleArchived(row)}>
                  {row.archived ? 'Dezarhivează' : 'Arhivează'}
                </button>
                {/* TODO(pasul următor din plan): formular de editare + confirmare de ștergere. */}
                <button type="button" className={styles.linkButton} disabled title="Vine în pasul următor">
                  Editează
                </button>
                <button type="button" className={styles.linkButton} disabled title="Vine în pasul următor">
                  Șterge
                </button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

function MonthsView({ rows }: { rows: PaymentRowView[] }) {
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
            {/* TODO(pasul următor din plan): panou de detaliu lateral de 400px la click pe rând. */}
            <DataTable<PaymentRowView>
              rows={monthRows}
              rowKey={row => row.id}
              pageSize={monthRows.length || 1}
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
