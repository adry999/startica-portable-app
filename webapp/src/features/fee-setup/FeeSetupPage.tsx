import {
  Button,
  Card,
  DataTable,
  LoadingState,
  SearchInput,
  SegmentedControl,
  useToast,
  type DataTableColumn,
} from '@shared/ui';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import {
  useFeeSetup,
  type FeeCurrency,
  type FeeSetupData,
  type FeeSetupFilter,
  type FeeSetupRowView,
} from './useFeeSetup';
import styles from './FeeSetupPage.module.css';

const CURRENCY_OPTIONS: { value: FeeCurrency; label: string }[] = [
  { value: 'MDL', label: 'MDL' },
  { value: 'EUR', label: 'EUR' },
];

const FILTER_OPTIONS: { value: FeeSetupFilter; label: string }[] = [
  { value: 'missing', label: 'Doar fără taxă' },
  { value: 'all', label: 'Toți copiii nearhivați' },
];

export function FeeSetupPage() {
  const feeSetupData = useFeeSetup();
  const toast = useToast();
  const { rates } = useExchangeRates();
  const todaysRate = latestKnownRate(rates);

  if (feeSetupData.status === 'loading') return <LoadingState />;
  if (feeSetupData.status === 'failed')
    return <p className={styles.notice}>{feeSetupData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function handleSave() {
    try {
      const { updatedCount } = await feeSetupData.save();
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
          onChange={event => feeSetupData.setGroupId(row.id, event.target.value)}
          aria-label={`Grupă pentru ${row.name}`}
        >
          <option value="">Fără grupă</option>
          {feeSetupData.groupOptions.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'currency',
      header: 'Monedă',
      render: row => (
        <select
          value={row.currency}
          onChange={event => feeSetupData.setCurrency(row.id, event.target.value as FeeCurrency)}
          aria-label={`Monedă pentru ${row.name}`}
        >
          {CURRENCY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'fee',
      header: 'Taxă lunară',
      render: row => {
        const amount = Number(row.fee);
        const showLeiEquivalent = row.currency === 'EUR' && row.fee !== '' && !Number.isNaN(amount) && todaysRate;
        return (
          <div className={styles.feeCell}>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="taxă"
              value={row.fee}
              onChange={event => feeSetupData.setFee(row.id, event.target.value)}
              aria-label={`Taxă lunară pentru ${row.name}`}
            />
            {showLeiEquivalent && (
              <span className={styles.feeEquivalent}>
                ≈ {formatMoney(convertAmount(amount, 'EUR', 'MDL', todaysRate as number))} azi
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'from',
      header: 'Din luna',
      render: row => (
        <input
          type="month"
          value={row.from}
          onChange={event => feeSetupData.setFrom(row.id, event.target.value)}
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
          onChange={event => feeSetupData.setStatus(row.id, event.target.value)}
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
        {feeSetupData.missingCount
          ? `${feeSetupData.missingCount} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
          : 'Toți copiii nearhivați au taxa completată.'}
      </p>

      <p className={styles.notice}>
        Fără taxă și fără statut confirmat, aplicația nu poate spune dacă un copil a achitat, deci nu apare pe lista de
        notificat. Completează aici, în masă. „Din luna” este luna din care se aplică; implicit luna începerii
        frecventării, ca și lunile trecute să fie calculate corect. Se salvează într-o singură operațiune, cu backup
        înainte și cu fiecare modificare trecută în Istoric.
      </p>

      <div className={styles.toolbar}>
        <SearchInput
          placeholder="Caută…"
          value={feeSetupData.search}
          onChange={feeSetupData.setSearch}
          ariaLabel="Caută copil"
        />
        <SegmentedControl<FeeSetupFilter>
          ariaLabel="Arată"
          value={feeSetupData.filter}
          onChange={feeSetupData.setFilter}
          options={FILTER_OPTIONS}
        />
      </div>

      <BulkRow data={feeSetupData} />

      <Card className={styles.tableCard}>
        <DataTable
          columns={columns}
          rows={feeSetupData.rows}
          rowKey={row => row.id}
          pageSize={feeSetupData.rows.length || 1}
          emptyState={<p>Nimic de completat pentru filtrul ales.</p>}
        />
      </Card>

      {feeSetupData.hasPendingEdits && (
        <div className={styles.saveBar}>
          <span>Ai completări nesalvate.</span>
          <Button onClick={() => void handleSave()}>Salvează completările</Button>
        </div>
      )}
    </>
  );
}

function BulkRow({ data }: { data: FeeSetupData }) {
  const toast = useToast();

  function applyAll() {
    if (!data.bulkAmount.trim() && !data.bulkCurrency && !data.bulkGroupId && !data.bulkStatus) {
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
        Monedă pentru toți
        <select
          value={data.bulkCurrency}
          onChange={event => data.setBulkCurrency(event.target.value as FeeCurrency | '')}
        >
          <option value="">Lasă neschimbată</option>
          {CURRENCY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
      <Button variant="ghost" onClick={applyAll}>
        Aplică la rândurile afișate
      </Button>
    </div>
  );
}
