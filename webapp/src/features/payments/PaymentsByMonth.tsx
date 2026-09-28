import { useState } from 'react';
import { FilterPills, SearchInput, groupTone, useToast, type PillTone } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthName } from '#shared/format/date-format.mjs';
import { PaymentDetailPanel } from './PaymentDetailPanel';
import type { PaymentRowView, PaymentsData } from './usePayments';
import styles from './PaymentsByMonth.module.css';

type MonthFilter = 'all' | 'unassigned' | 'archived';

export interface PaymentsByMonthProps {
  data: PaymentsData;
  onEdit: (id: string) => void;
}

function dayOfMonth(date: string): string {
  return date.slice(8, 10);
}

function monthAbbrev(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
}

/** Mod Pe luni (05-achitari.md §4) — listă grupată pe lună + panou de detaliu (400px), fără formular de asociere. */
export function PaymentsByMonth({ data, onEdit }: PaymentsByMonthProps) {
  const toast = useToast();
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Toate/Neasociate operează pe achitările active; Arhivate comută filtrul de arhivare
  // partajat cu Modul Tabel (aceeași stare din usePayments).
  function selectMonthFilter(next: MonthFilter) {
    setMonthFilter(next);
    data.setArchiveFilter(next === 'archived' ? 'archived' : 'active');
  }

  const baseRows = monthFilter === 'unassigned' ? data.rows.filter(row => row.unassigned) : data.rows;
  const unassignedCount = data.rows.filter(row => row.unassigned).length;

  const groups = new Map<string, PaymentRowView[]>();
  for (const row of baseRows) {
    const monthKey = row.date.slice(0, 7);
    const group = groups.get(monthKey);
    if (group) group.push(row);
    else groups.set(monthKey, [row]);
  }
  const monthKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  const activeId = selectedId && baseRows.some(row => row.id === selectedId) ? selectedId : (baseRows[0]?.id ?? null);
  const activePayment = baseRows.find(row => row.id === activeId) ?? null;

  const activeFiltersCount = (data.method ? 1 : 0) + (data.groupFilter !== 'all' ? 1 : 0);

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
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.filterRow}>
          <div className={styles.pills}>
            <button
              type="button"
              className={monthFilter === 'all' ? styles.pillActive : styles.pillNeutral}
              onClick={() => selectMonthFilter('all')}
            >
              Toate · {data.rows.length}
            </button>
            <button
              type="button"
              className={monthFilter === 'unassigned' ? styles.pillActive : styles.pillPink}
              onClick={() => selectMonthFilter('unassigned')}
            >
              Neasociate · {unassignedCount}
            </button>
            <button
              type="button"
              className={monthFilter === 'archived' ? styles.pillActive : styles.pillNeutral}
              onClick={() => selectMonthFilter('archived')}
            >
              Arhivate
            </button>
          </div>
          <SearchInput
            className={styles.search}
            value={data.search}
            onChange={data.setSearch}
            placeholder="Caută"
            ariaLabel="Căutare achitări"
          />
          <button type="button" className={styles.filtersToggle} onClick={() => setFiltersOpen(open => !open)}>
            Filtre · {activeFiltersCount}
          </button>
        </div>

        {filtersOpen && (
          <FilterPills
            groups={[
              {
                label: 'Metodă',
                value: data.method,
                onChange: data.setMethod,
                options: [
                  { value: '', label: 'Toate', tone: 'neutral' },
                  { value: 'Cash', label: 'Cash', tone: 'orange' as PillTone },
                  { value: 'Card', label: 'Card', tone: 'yellow' as PillTone },
                  { value: 'Transfer', label: 'Transfer', tone: 'mint' as PillTone },
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
        )}

        <div className={styles.groups}>
          {monthKeys.length === 0 && <p className={styles.notice}>Nu există achitări pentru filtrele alese.</p>}
          {monthKeys.map(monthKey => {
            const rows = groups.get(monthKey) as PaymentRowView[];
            const subtotal = rows.reduce((sum, row) => sum + row.total, 0);
            return (
              <div key={monthKey} className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>{formatMonthName(monthKey)}</span>
                  <span className={styles.groupCount}>
                    {rows.length} {rows.length === 1 ? 'achitare' : 'achitări'}
                  </span>
                  <strong className={styles.groupTotal}>{formatMoney(subtotal)}</strong>
                </div>
                <div className={styles.card}>
                  {rows.map(row => (
                    <button
                      key={row.id}
                      type="button"
                      className={row.id === activeId ? `${styles.row} ${styles.rowActive}` : styles.row}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <span className={styles.rowDay}>
                        <strong>{dayOfMonth(row.date)}</strong>
                        <small>{monthAbbrev(row.date)}</small>
                      </span>
                      <span className={styles.rowChild}>
                        <strong>{row.unassigned ? '—' : row.childLabel}</strong>
                        {row.unassigned && <span className={styles.unassignedBadge}>Neasociată</span>}
                      </span>
                      <span className={styles.rowMeta}>
                        {row.sourceName || '—'} · {row.tenders.map(tender => tender.method).join(' + ')} ·{' '}
                        {row.allocations.map(allocation => allocation.label).join(', ') || '—'}
                      </span>
                      <span className={styles.rowSum}>{formatMoney(row.total)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activePayment && (
        <PaymentDetailPanel
          payment={activePayment}
          onClose={() => setSelectedId(null)}
          onEdit={onEdit}
          onToggleArchived={row => void toggleArchived(row)}
        />
      )}
    </div>
  );
}
