import { Card, DataTable, SegmentedControl, useToast, type DataTableColumn } from '@shared/ui';
import { useFeeSetup, type FeeSetupData, type FeeSetupFilter, type FeeSetupRowView } from './useFeeSetup';
import styles from './FeeSetupPage.module.css';

const FILTER_OPTIONS: { value: FeeSetupFilter; label: string }[] = [
  { value: 'missing', label: 'Doar fără taxă' },
  { value: 'all', label: 'Toți copiii nearhivați' },
];

export function FeeSetupPage() {
  const data = useFeeSetup();
  const toast = useToast();

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function handleSave() {
    try {
      const { updatedCount } = await data.save();
      toast.show({ message: `${updatedCount} fișe completate. Verifică lista „De notificat”.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const columns: DataTableColumn<FeeSetupRowView>[] = [
    { key: 'contract', header: 'Contract', sortValue: row => row.contract, render: row => row.contract },
    { key: 'name', header: 'Copil', sortValue: row => row.name, render: row => row.name },
    {
      key: 'attendance',
      header: 'Frecventare',
      sortValue: row => row.attendanceLabel,
      render: row => row.attendanceLabel,
    },
    {
      key: 'group',
      header: 'Grupă',
      render: row => (
        <select
          value={row.groupId}
          onChange={event => data.setGroupId(row.id, event.target.value)}
          aria-label={`Grupă pentru ${row.name}`}
        >
          <option value="">Fără grupă</option>
          {data.groupOptions.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'fee',
      header: 'Taxă lunară',
      render: row => (
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="taxă"
          value={row.fee}
          onChange={event => data.setFee(row.id, event.target.value)}
          aria-label={`Taxă lunară pentru ${row.name}`}
        />
      ),
    },
    {
      key: 'from',
      header: 'Din luna',
      render: row => (
        <input
          type="month"
          value={row.from}
          onChange={event => data.setFrom(row.id, event.target.value)}
          aria-label={`Din luna pentru ${row.name}`}
        />
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: row => (
        <select
          value={row.status}
          onChange={event => data.setStatus(row.id, event.target.value)}
          aria-label={`Statut pentru ${row.name}`}
        >
          {row.statusOptions.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <>
      <p className={styles.info}>
        {data.missingCount
          ? `${data.missingCount} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
          : 'Toți copiii nearhivați au taxa completată.'}
      </p>

      <p className={styles.notice}>
        Fără taxă și fără statut confirmat, aplicația nu poate spune dacă un copil a achitat, deci nu apare pe lista de
        notificat. Completează aici, în masă. „Din luna” este luna din care se aplică; implicit luna începerii
        frecventării, ca și lunile trecute să fie calculate corect. Se salvează într-o singură operațiune, cu backup
        înainte și cu fiecare modificare trecută în Istoric.
      </p>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Caută…"
          value={data.search}
          onChange={event => data.setSearch(event.target.value)}
          aria-label="Caută copil"
        />
        <SegmentedControl<FeeSetupFilter>
          ariaLabel="Arată"
          value={data.filter}
          onChange={data.setFilter}
          options={FILTER_OPTIONS}
        />
      </div>

      <BulkRow data={data} />

      <Card className={styles.tableCard}>
        <DataTable
          columns={columns}
          rows={data.rows}
          rowKey={row => row.id}
          pageSize={data.rows.length || 1}
          emptyState={<p>Nimic de completat pentru filtrul ales.</p>}
        />
      </Card>

      {data.hasPendingEdits && (
        <div className={styles.saveBar}>
          <span>Ai completări nesalvate.</span>
          <button type="button" className={styles.btnPrimary} onClick={() => void handleSave()}>
            Salvează completările
          </button>
        </div>
      )}
    </>
  );
}

function BulkRow({ data }: { data: FeeSetupData }) {
  const toast = useToast();

  function applyAll() {
    if (!data.bulkAmount.trim() && !data.bulkGroupId && !data.bulkStatus) {
      toast.show({ message: 'Completează o taxă, o grupă sau un statut de aplicat.' });
      return;
    }
    data.applyBulkToVisible();
    toast.show({ message: 'Valorile au fost puse pe rândurile afișate. Verifică excepțiile, apoi salvează.' });
  }

  return (
    <div className={styles.bulkRow}>
      <label className={styles.bulkField}>
        Taxă pentru toți
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="2000"
          value={data.bulkAmount}
          onChange={event => data.setBulkAmount(event.target.value)}
        />
      </label>
      <label className={styles.bulkField}>
        Grupă pentru toți
        <select value={data.bulkGroupId} onChange={event => data.setBulkGroupId(event.target.value)}>
          <option value="">Fără grupă</option>
          {data.groupOptions.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.bulkField}>
        Statut pentru toți
        <select value={data.bulkStatus} onChange={event => data.setBulkStatus(event.target.value)}>
          <option value="">Lasă neschimbat</option>
          {data.statusOptions.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={styles.btnGhost} onClick={applyAll}>
        Aplică la rândurile afișate
      </button>
    </div>
  );
}
