import { useState } from 'react';
import { Button, FilterPills, MasterDetail, SearchInput, groupTone, useToast, type PillTone } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatMonthAbbrev, formatMonthName } from '#shared/format/date-format.mjs';
import { PaymentDetailPanel } from './PaymentDetailPanel';
import type { PaymentRowView, PaymentsData } from './usePayments';
import styles from './PaymentsByMonth.module.css';
import { toUserError } from '@shared/api/to-user-error';

type MonthFilter = 'all' | 'unassigned' | 'archived';

export interface PaymentsByMonthProps {
  data: PaymentsData;
  onEdit: (id: string) => void;
}

function dayOfMonth(date: string): string {
  return date.slice(8, 10);
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
      toast.show({ message: toUserError(error) });
    }
  }

  return (
    <MasterDetail
      detailWidth={400}
      master={
        <div className={styles.main}>
          <div className={styles.filterRow}>
            <FilterPills
              className={styles.pills}
              groups={[
                {
                  label: '',
                  value: monthFilter,
                  onChange: value => selectMonthFilter(value as MonthFilter),
                  options: [
                    { value: 'all', label: `Toate · ${data.rows.length}`, tone: 'neutral' },
                    { value: 'unassigned', label: `Neasociate · ${unassignedCount}`, tone: 'pink' },
                    { value: 'archived', label: 'Arhivate', tone: 'neutral' },
                  ],
                },
              ]}
            />
            <SearchInput
              className={styles.search}
              value={data.search}
              onChange={data.setSearch}
              placeholder="Caută"
              ariaLabel="Căutare achitări"
            />
            <Button variant="outline" onClick={() => setFiltersOpen(open => !open)}>
              Filtre · {activeFiltersCount}
            </Button>
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
                      <div
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        className={row.id === activeId ? `${styles.row} ${styles.rowActive}` : styles.row}
                        onClick={() => setSelectedId(row.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedId(row.id);
                          }
                        }}
                      >
                        <span className={styles.rowDay}>
                          <strong>{dayOfMonth(row.date)}</strong>
                          <small>{formatMonthAbbrev(row.date)}</small>
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
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
      detail={
        activePayment && (
          <PaymentDetailPanel
            payment={activePayment}
            onClose={() => setSelectedId(null)}
            onEdit={onEdit}
            onToggleArchived={row => void toggleArchived(row)}
          />
        )
      }
    />
  );
}
