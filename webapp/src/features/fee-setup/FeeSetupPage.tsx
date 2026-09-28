import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
  RowMenu,
  SearchInput,
  SegmentedControl,
  SelectionBar,
  groupTone,
  useToast,
  useTopbarActions,
  type DataTableColumn,
  type PillTone,
} from '@shared/ui';
import { initials } from '@shared/format/initials';
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
  { value: 'all', label: 'Toți' },
];

const AVATAR_TONE_CLASS: Record<PillTone, string> = {
  orange: 'toneOrange',
  mint: 'toneMint',
  yellow: 'toneYellow',
  pink: 'tonePink',
  teal: 'toneTeal',
  blue: 'toneBlue',
  purple: 'tonePurple',
  coral: 'toneCoral',
  neutral: 'toneOrange',
};

export function FeeSetupPage() {
  const feeSetupData = useFeeSetup();
  const toast = useToast();
  const navigate = useNavigate();
  const { rates } = useExchangeRates();
  const todaysRate = latestKnownRate(rates);

  const completedCount = feeSetupData.totalCount - feeSetupData.missingCount;
  const progressPct = feeSetupData.totalCount > 0 ? Math.round((completedCount / feeSetupData.totalCount) * 100) : 0;

  useTopbarActions(
    <div className={styles.headerProgress}>
      <div className={styles.headerProgressRow}>
        <span className={styles.headerProgressCount}>
          {completedCount} din {feeSetupData.totalCount} completate
        </span>
        <span className={styles.headerProgressRemaining}>{feeSetupData.missingCount} rămase</span>
      </div>
      <div
        className={styles.headerProgressBar}
        role="progressbar"
        aria-label="Progres completare taxe"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
      >
        <span style={{ width: `${progressPct}%` }} />
      </div>
    </div>,
  );

  if (feeSetupData.status === 'loading') return <LoadingState />;
  if (feeSetupData.status === 'failed')
    return <p className={styles.notice}>{feeSetupData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function handleSaveRow(row: FeeSetupRowView) {
    try {
      await feeSetupData.save([row.id]);
      toast.show({ message: `${row.name}: fișă completată.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  const columns: DataTableColumn<FeeSetupRowView>[] = [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (
        <div className={styles.childCell}>
          <span
            className={`${styles.avatar} ${styles[AVATAR_TONE_CLASS[groupTone(row.groupId, feeSetupData.groupOptions)]]}`}
          >
            {initials(row.name)}
          </span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.ageLabel}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'missing',
      header: 'Lipsește',
      render: row =>
        row.missingLabel ? (
          <Badge tone="pink">{row.missingLabel}</Badge>
        ) : (
          <span className={styles.noneMissing}>—</span>
        ),
    },
    {
      key: 'group',
      header: 'Grupă',
      render: row => (
        <select
          className={row.groupId ? undefined : styles.missing}
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
              className={row.fee === '' ? styles.missing : undefined}
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
      key: 'due',
      header: 'Scadență',
      render: row => <span className={styles.dueDay}>{row.dueDayLabel}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: row => (
        <div className={styles.rowActions}>
          <Button
            variant={row.changed ? 'primary' : 'outline'}
            disabled={!row.changed || feeSetupData.saving}
            onClick={() => void handleSaveRow(row)}
          >
            Salvează
          </Button>
          <RowMenu
            ariaLabel={`Statut pentru ${row.name}`}
            items={row.statusOptions
              .filter(status => status !== row.status)
              .map(status => ({ label: `Marchează ${status}`, onClick: () => feeSetupData.setStatus(row.id, status) }))}
          />
        </div>
      ),
    },
  ];

  const selectedCount = feeSetupData.selectedRowKeys.size;

  return (
    <>
      <div className={styles.notice}>
        {feeSetupData.missingCount > 0 ? (
          <>
            Fără taxă și grupă, achitările acestor copii nu pot fi calculate în{' '}
            <button type="button" className={styles.noticeLink} onClick={() => navigate('/situatia-platilor')}>
              Situația plăților
            </button>
            . Completează rândurile de mai jos sau selectează mai mulți copii și aplică aceleași valori.
          </>
        ) : (
          'Toți copiii nearhivați au taxa completată.'
        )}
      </div>

      <Card className={styles.tableCard}>
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

        {selectedCount > 0 && (
          <SelectionBar
            label={`${selectedCount} selectați`}
            onCancel={() => feeSetupData.setSelectedRowKeys(new Set())}
          >
            <span className={styles.bulkLabel}>Aplică:</span>
            <select
              className={styles.bulkPill}
              aria-label="Grupă de aplicat pe selecție"
              value={feeSetupData.bulkGroupId}
              onChange={event => feeSetupData.setBulkGroupId(event.target.value)}
            >
              <option value="">Grupă ▾</option>
              {feeSetupData.groupOptions.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <input
              className={styles.bulkPill}
              type="number"
              min={0}
              step="0.01"
              placeholder="Taxă"
              aria-label="Taxă de aplicat pe selecție"
              value={feeSetupData.bulkAmount}
              onChange={event => feeSetupData.setBulkAmount(event.target.value)}
            />
            <select
              className={styles.bulkPill}
              aria-label="Monedă de aplicat pe selecție"
              value={feeSetupData.bulkCurrency}
              onChange={event => feeSetupData.setBulkCurrency(event.target.value as FeeCurrency | '')}
            >
              <option value="">Monedă ▾</option>
              {CURRENCY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button size="md" onClick={() => applyBulk(feeSetupData, toast)}>
              Aplică la {selectedCount}
            </Button>
          </SelectionBar>
        )}

        <DataTable
          bare
          selectable
          selectedRowKeys={feeSetupData.selectedRowKeys}
          onSelectedRowKeysChange={feeSetupData.setSelectedRowKeys}
          columns={columns}
          rows={feeSetupData.rows}
          rowKey={row => row.id}
          pageSize={feeSetupData.rows.length || 1}
          emptyState={
            feeSetupData.filter === 'missing' ? (
              <EmptyState
                variant="resolved"
                title="Totul e completat"
                description="Toți copiii nearhivați au taxă și grupă."
              />
            ) : (
              <EmptyState
                variant="no-results"
                title="Niciun copil"
                activeFilters={feeSetupData.search ? [`Căutare „${feeSetupData.search}”`] : undefined}
                onClearFilters={feeSetupData.search ? () => feeSetupData.setSearch('') : undefined}
              />
            )
          }
        />
      </Card>
    </>
  );
}

function applyBulk(data: FeeSetupData, toast: ReturnType<typeof useToast>) {
  if (!data.bulkAmount.trim() && !data.bulkCurrency && !data.bulkGroupId) {
    toast.show({ message: 'Completează o taxă, o monedă sau o grupă de aplicat.' });
    return;
  }
  data.applyBulkToSelection();
  toast.show({
    message: 'Valorile au fost puse pe rândurile selectate. Verifică excepțiile, apoi salvează fiecare rând.',
  });
}
