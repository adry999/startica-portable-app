import { Card, DataTable, type DataTableColumn } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { useStatus, type StatusRowView } from './useStatus';
import styles from './StatusPage.module.css';

export interface StatusPageProps {
  month: string;
}

/** Echivalentul ecranului „Situația plăților” — doar citire, fără filtre (vezi useStatus). */
export function StatusPage({ month }: StatusPageProps) {
  const statusData = useStatus(month);

  if (statusData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (statusData.status === 'failed')
    return <p className={styles.notice}>{statusData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns: DataTableColumn<StatusRowView>[] = [
    { key: 'contract', header: 'Contract', sortValue: row => row.contract, render: row => row.contract },
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
    {
      key: 'credit',
      header: 'Credit',
      align: 'end',
      sortValue: row => row.credit ?? -1,
      render: row => formatMoney(row.credit),
    },
    { key: 'due', header: 'Scadență', sortValue: row => row.due, render: row => formatDate(row.due) },
    { key: 'label', header: 'Situație', sortValue: row => row.label, render: row => row.label },
  ];

  return (
    <>
      <div className={styles.headerActions}>
        <p className={styles.period}>
          Luna {month} · situație la {formatDate(statusData.asOf)}
        </p>
        <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
          Tipărește raportul
        </button>
      </div>

      <p className={styles.notice}>
        Taxă integrală pentru luna începută; suspendările și modificările de taxă se aplică din luna aleasă. Lunile fără
        perioadă sau taxă confirmată rămân „De verificat”. Plățile cu dată viitoare nu intră în soldul de azi.
      </p>

      <Card className={styles.tableCard}>
        <DataTable columns={columns} rows={statusData.rows} rowKey={row => row.id} emptyState={<p>Nu sunt copii.</p>} />
      </Card>
    </>
  );
}
