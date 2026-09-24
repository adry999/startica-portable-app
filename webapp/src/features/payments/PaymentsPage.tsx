import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, SegmentedControl, useToast, type BadgeTone, type CardTone } from '@shared/ui';
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
import { PaymentFormDrawer } from './PaymentFormDrawer';
import type { PaymentFormValues } from './payment-form';
import type { Payment } from '@contracts/record-types.mjs';
import styles from './PaymentsPage.module.css';

type ViewMode = 'table' | 'months';

const VIEW_MODE_OPTIONS = [
  { value: 'table' as ViewMode, label: 'Tabel' },
  { value: 'months' as ViewMode, label: 'Pe luni' },
];

const METHOD_TONE: Record<string, BadgeTone> = { Cash: 'orange', Card: 'yellow', Transfer: 'mint' };

export interface PaymentsPageProps {
  /** Setat de căutarea globală din topbar — deschide direct formularul achitării găsite. */
  focusPaymentId?: string | null;
  onFocusConsumed?: () => void;
}

export function PaymentsPage({ focusPaymentId, onFocusConsumed }: PaymentsPageProps = {}) {
  const data = usePayments();
  const toast = useToast();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('payments.viewMode', 'table');
  const [formTarget, setFormTarget] = useState<Payment | 'new' | null>(null);

  useEffect(() => {
    if (!focusPaymentId || data.status !== 'ready') return;
    const payment = data.records.payments.find(p => p.id === focusPaymentId);
    if (payment) setFormTarget(payment);
    onFocusConsumed?.();
  }, [focusPaymentId, data.status, onFocusConsumed]);

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function submitPaymentForm(values: PaymentFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      if (previous) {
        await data.updatePayment(previous, values);
        setFormTarget(null);
        toast.show({ message: 'Achitare actualizată.' });
        return;
      }
      const saved = await data.createPayment(values, () =>
        window.confirm(
          'Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?',
        ),
      );
      if (saved) {
        setFormTarget(null);
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
        <button type="button" className={styles.primaryButton} onClick={() => setFormTarget('new')}>
          + Achitare nouă
        </button>
      </div>

      <SummaryCards summary={data.summary} />
      <Filters data={data} />

      {viewMode === 'table' ? (
        <TableView data={data} toast={toast} onEdit={setFormTarget} />
      ) : (
        <MonthsView rows={data.rows} />
      )}

      <PaymentFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        records={data.records}
        onSubmit={submitPaymentForm}
        onClose={() => setFormTarget(null)}
      />
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

function TableView({
  data,
  toast,
  onEdit,
}: {
  data: PaymentsData;
  toast: ReturnType<typeof useToast>;
  onEdit: (payment: Payment) => void;
}) {
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

  async function deleteForever(row: PaymentRowView) {
    if (!window.confirm(`Ștergi definitiv achitarea ${row.id}? Nu poate fi anulată, spre deosebire de arhivare.`))
      return;
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
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    const payment = data.records.payments.find(p => p.id === row.id);
                    if (payment) onEdit(payment);
                  }}
                >
                  Editează
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!row.archived}
                  title={row.archived ? undefined : 'Arhivează întâi achitarea'}
                  onClick={() => void deleteForever(row)}
                >
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
