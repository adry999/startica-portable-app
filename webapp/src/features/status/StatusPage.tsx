import { Card, DataTable, FilterPills, groupTone, type DataTableColumn } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { useStatus, type StatusRowView } from './useStatus';
import styles from './StatusPage.module.css';

export interface StatusPageProps {
  month: string;
}

export function StatusPage({ month }: StatusPageProps) {
  const statusData = useStatus(month);

  if (statusData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (statusData.status === 'failed')
    return <p className={styles.notice}>{statusData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

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
      render: row => formatMoney(row.expected),
    },
    {
      key: 'paid',
      header: 'Achitat',
      align: 'end',
      sortValue: row => row.paid ?? -1,
      render: row => formatMoney(row.paid),
    },
    {
      key: 'rest',
      header: 'Rest',
      align: 'end',
      sortValue: row => row.rest ?? -1,
      render: row => formatMoney(row.rest),
    },
    { key: 'due', header: 'Scadență', sortValue: row => row.due, render: row => formatDate(row.due) },
    { key: 'label', header: 'Situație', sortValue: row => row.label, render: row => row.label },
  ];

  return (
    <>
      <div className={styles.headerActions}>
        <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
          Tipărește raportul
        </button>
      </div>

      <FilterPills
        groups={[
          {
            label: 'Grupa',
            value: statusData.groupFilter,
            onChange: statusData.setGroupFilter,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              ...statusData.groups.map(group => ({
                value: group.id,
                label: group.name,
                tone: groupTone(group.id, statusData.groups),
              })),
              { value: 'none', label: 'Fără grupă', tone: 'neutral' },
            ],
          },
        ]}
      />

      <Card className={styles.tableCard}>
        <DataTable columns={columns} rows={statusData.rows} rowKey={row => row.id} emptyState={<p>Nu sunt copii.</p>} />
        <p className={styles.tableFootnote}>
          Taxă integrală pentru luna începută; suspendările și modificările de taxă se aplică din luna aleasă. Lunile
          fără perioadă sau taxă confirmată rămân „De verificat”. Plățile cu dată viitoare nu intră în soldul de azi.
        </p>
      </Card>
    </>
  );
}
