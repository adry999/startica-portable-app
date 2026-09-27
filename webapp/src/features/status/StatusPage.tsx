import { useState } from 'react';
import {
  Card,
  DataTable,
  FilterPills,
  MonthPicker,
  SegmentedControl,
  groupTone,
  useTopbarActions,
  type DataTableColumn,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import type { ViewKey } from '@shared/view-key';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { schoolYearLabel, schoolYearStartOf } from '#features/billing/index.web.mjs';
import { useStatus, type StatusData, type StatusRowView } from './useStatus';
import { useSchoolYearStatus, type SchoolYearData } from './useSchoolYearStatus';
import styles from './StatusPage.module.css';

export interface StatusPageProps {
  month: string;
  onMonthChange: (month: string) => void;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
}

type StatusMode = 'month' | 'year';
const MODE_OPTIONS = [
  { value: 'month', label: 'Lună' },
  { value: 'year', label: 'An școlar' },
] as const;

export function StatusPage({ month, onMonthChange, onNavigate, onOpenChild }: StatusPageProps) {
  const [mode, setMode] = usePersistedState<StatusMode>('view.status', 'month');
  const [startYear, setStartYear] = useState(() => schoolYearStartOf(month));
  const statusData = useStatus(month);
  const yearData = useSchoolYearStatus(mode === 'year' ? startYear : null);

  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl<StatusMode> ariaLabel="Mod de afișare" value={mode} onChange={setMode} options={MODE_OPTIONS} />
      {mode === 'month' ? (
        <MonthPicker value={month} onChange={onMonthChange} />
      ) : (
        <select
          className={styles.yearSelect}
          aria-label="Anul școlar"
          value={startYear}
          onChange={event => setStartYear(Number(event.target.value))}
        >
          {yearData.schoolYearOptions.map(year => (
            <option key={year} value={year}>
              {schoolYearLabel(year)}
            </option>
          ))}
        </select>
      )}
      <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
        Tipărește
      </button>
    </div>,
  );

  const data = mode === 'month' ? statusData : yearData;
  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  return mode === 'month' ? (
    <MonthView data={statusData} onNavigate={onNavigate} onOpenChild={onOpenChild} />
  ) : (
    <YearView data={yearData} />
  );
}

function MonthView({
  data,
}: {
  data: StatusData;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
}) {
  const columns: DataTableColumn<StatusRowView>[] = [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (row.archived ? `${row.name} (arhivat)` : row.name),
    },
    {
      key: 'expected',
      header: 'Taxă',
      align: 'end',
      sortValue: row => row.expected ?? -1,
      render: row => formatMoney(row.expected, row.currency),
    },
    {
      key: 'paid',
      header: 'Achitat',
      align: 'end',
      sortValue: row => row.paid ?? -1,
      render: row => formatMoney(row.paid, row.currency),
    },
    {
      key: 'rest',
      header: 'Rest',
      align: 'end',
      sortValue: row => row.rest ?? -1,
      render: row => formatMoney(row.rest, row.currency),
    },
    { key: 'due', header: 'Scadență', sortValue: row => row.due, render: row => formatDate(row.due) },
    { key: 'label', header: 'Situație', sortValue: row => row.label, render: row => row.label },
  ];

  return (
    <>
      <FilterPills
        groups={[
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

      <Card className={styles.tableCard}>
        <DataTable columns={columns} rows={data.rows} rowKey={row => row.id} emptyState={<p>Nu sunt copii.</p>} />
      </Card>
    </>
  );
}

function YearView({ data: _data }: { data: SchoolYearData }) {
  return <p className={styles.notice}>Harta anului școlar vine într-un task următor.</p>;
}
