import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterPills,
  LoadingState,
  MonthPicker,
  SegmentedControl,
  groupTone,
  useTopbarActions,
  type BadgeTone,
  type DataTableColumn,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import type { ViewKey } from '@shared/view-key';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { schoolYearLabel, schoolYearStartOf } from '#features/billing/index.web.mjs';
import { useStatus, type StatusData, type StatusRowView, type StatusSegment } from './useStatus';
import { useSchoolYearStatus, type SchoolYearData } from './useSchoolYearStatus';
import { PaymentHeatmap } from './PaymentHeatmap';
import { PrintOptionsDialog, type PrintOptions } from './PrintOptionsDialog';
import { StatusPrint } from './StatusPrint';
import styles from './StatusPage.module.css';

const STATUS_TONE: Record<string, BadgeTone> = {
  Restanță: 'pink',
  'Plată parțială': 'yellow',
  Plătit: 'mint',
  'Scadent în curând': 'orange',
};

const NOTIFY_LABELS = new Set(['Restanță', 'Plată parțială']);
const SMS_TITLE = 'Trimiterea SMS vine odată cu integrarea SMS (P2)';

const SEGMENT_LABEL: Record<StatusSegment, string | null> = {
  all: null,
  overdue: 'Restanțieri',
  partial: 'Parțial',
  paid: 'Achitat',
  upcoming: 'Urmează',
};

/** Descrierea filtrului activ, pentru antetul situației tipărite (16c). */
function describeFilter(data: StatusData): string {
  const parts = [
    SEGMENT_LABEL[data.segment],
    data.groupFilter === 'all'
      ? null
      : data.groupFilter === 'none'
        ? 'fără grupă'
        : data.groups.find(g => g.id === data.groupFilter)?.name,
    data.search ? `căutare „${data.search}”` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : 'toate grupele';
}

function segmentOptions(counts: StatusData['segmentCounts']) {
  return [
    { value: 'all' as const, label: `Toți · ${counts.all}` },
    { value: 'overdue' as const, label: `Restanțieri · ${counts.overdue}` },
    { value: 'partial' as const, label: `Parțial · ${counts.partial}` },
    { value: 'paid' as const, label: `Achitat · ${counts.paid}` },
    { value: 'upcoming' as const, label: `Urmează · ${counts.upcoming}` },
  ];
}

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
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const statusData = useStatus(month);
  const yearData = useSchoolYearStatus(mode === 'year' ? startYear : null);

  // Randarea confirmării tipărite trebuie să apară în DOM înainte de window.print();
  // afterprint golește starea, ca situația tipărită să nu rămână montată pe ecran.
  useEffect(() => {
    if (!printOptions) return;
    const timer = setTimeout(() => window.print(), 0);
    const onAfterPrint = () => setPrintOptions(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printOptions]);

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
      <Button variant="ghost" disabled={mode !== 'month'} onClick={() => setPrintDialogOpen(true)}>
        Tipărește
      </Button>
    </div>,
  );

  const activeData = mode === 'month' ? statusData : yearData;
  if (activeData.status === 'loading') return <LoadingState />;
  if (activeData.status === 'failed')
    return <p className={styles.notice}>{activeData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  return (
    <>
      <div className={styles.screenOnly}>
        {mode === 'month' ? (
          <MonthView data={statusData} onNavigate={onNavigate} onOpenChild={onOpenChild} />
        ) : (
          <YearView data={yearData} />
        )}
      </div>

      {printOptions && (
        <StatusPrint
          month={month}
          asOf={statusData.asOf}
          filterLabel={printOptions.scope === 'all' ? 'toți copiii' : describeFilter(statusData)}
          rows={printOptions.scope === 'all' ? statusData.allRows : statusData.rows}
          showPhone={printOptions.showPhone}
          orientation={printOptions.orientation}
        />
      )}

      <PrintOptionsDialog
        open={printDialogOpen}
        onCancel={() => setPrintDialogOpen(false)}
        onConfirm={options => {
          setPrintDialogOpen(false);
          setPrintOptions(options);
        }}
      />
    </>
  );
}

function MonthView({
  data,
  onNavigate,
  onOpenChild,
}: {
  data: StatusData;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
}) {
  const { summary } = data;
  const pct = Math.round(summary.paidShare * 100);

  const columns: DataTableColumn<StatusRowView>[] = [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (row.archived ? `${row.name} (arhivat)` : row.name),
    },
    { key: 'due', header: 'Scadență', sortValue: row => row.due, render: row => formatDate(row.due) },
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
      render: row => (
        <span className={row.rest && row.rest > 0 ? styles.restDue : undefined}>
          {formatMoney(row.rest, row.currency)}
        </span>
      ),
    },
    {
      key: 'label',
      header: 'Statut',
      sortValue: row => row.label,
      render: row => <Badge tone={STATUS_TONE[row.label] ?? 'neutral'}>{row.label}</Badge>,
    },
    {
      key: 'cta',
      header: '',
      align: 'end',
      render: row =>
        NOTIFY_LABELS.has(row.label) ? (
          <button type="button" className={styles.ctaButton} disabled title={SMS_TITLE}>
            Notifică
          </button>
        ) : (
          <button type="button" className={styles.ctaButton} onClick={() => onOpenChild(row.id)}>
            Vezi fișa
          </button>
        ),
    },
  ];

  return (
    <>
      <div className={styles.summaryRow}>
        <Card className={styles.summaryCard}>
          <p className={styles.summaryLabel}>De încasat</p>
          <strong className={styles.summaryValue}>{formatMoney(summary.expected)}</strong>
          <small className={styles.summaryMeta}>{summary.owingChildren} copii activi</small>
        </Card>
        <Card tone="mint" className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.mintInk}`}>Încasat</p>
          <strong className={styles.summaryValue}>{formatMoney(summary.paid)}</strong>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Încasat din de încasat"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card tone={summary.overdueChildren > 0 ? 'pink' : 'white'} className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.pinkInk}`}>Restanțe</p>
          <strong className={summary.overdueChildren > 0 ? styles.summaryValue : styles.summaryValueZero}>
            {summary.overdueChildren} {summary.overdueChildren === 1 ? 'copil' : 'copii'}
          </strong>
          <small className={`${styles.summaryMeta} ${styles.pinkInk}`}>
            scadența a trecut · {formatMoney(summary.overdue)}
          </small>
        </Card>
        <Card tone={data.missingFeeCount > 0 ? 'yellow' : 'white'} className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.yellowInk}`}>Fără taxă setată</p>
          <strong className={data.missingFeeCount > 0 ? styles.summaryValue : styles.summaryValueZero}>
            {data.missingFeeCount}
          </strong>
          {data.missingFeeCount > 0 && (
            <button type="button" className={styles.cardLink} onClick={() => onNavigate('fees')}>
              Completează →
            </button>
          )}
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.toolbar}>
          <SegmentedControl<StatusSegment>
            ariaLabel="Statut"
            value={data.segment}
            onChange={data.setSegment}
            options={segmentOptions(data.segmentCounts)}
          />
          <input
            className={styles.search}
            type="search"
            placeholder="Caută copil"
            aria-label="Caută copil"
            value={data.search}
            onChange={event => data.setSearch(event.target.value)}
          />
        </div>

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

        <DataTable
          bare
          columns={columns}
          rows={data.rows}
          rowKey={row => row.id}
          emptyState={<p>Nu sunt copii pentru filtrele alese.</p>}
        />

        {summary.overdueChildren > 0 && (
          <div className={styles.banner}>
            <strong>
              {summary.overdueChildren} {summary.overdueChildren === 1 ? 'restanțier' : 'restanțieri'}
            </strong>
            <span>Trimite o notificare tuturor părinților cu restanță</span>
            <Button disabled title={SMS_TITLE}>
              Notifică toți
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function YearView({ data }: { data: SchoolYearData }) {
  return (
    <>
      <div className={styles.yearCards}>
        <Card tone={data.summary.overdueChildren > 0 ? 'pink' : 'white'} className={styles.yearCard}>
          <strong className={styles.yearCardValue}>{data.summary.overdueChildren}</strong>
          <div>
            <p className={styles.yearCardTitle}>copii cu restanță</p>
            <small>{formatMoney(data.summary.unrecovered)} nerecuperați</small>
          </div>
          {data.summary.overdueChildren > 0 && (
            <button type="button" className={styles.ctaButton} disabled title={SMS_TITLE}>
              Notifică
            </button>
          )}
        </Card>
        <Card tone="mint" className={styles.yearCard}>
          <strong className={styles.yearCardValue}>
            {data.summary.collectionRate === null ? '—' : `${Math.round(data.summary.collectionRate * 100)}%`}
          </strong>
          <div>
            <p className={styles.yearCardTitle}>rată de încasare</p>
            <small>pe anul școlar, până azi</small>
          </div>
        </Card>
        <Card tone="yellow" className={styles.yearCard}>
          <strong className={styles.yearCardValue}>{data.summary.partialThisMonth}</strong>
          <div>
            <p className={styles.yearCardTitle}>plăți parțiale</p>
            <small>luna aceasta</small>
          </div>
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Caută copil"
            aria-label="Caută copil"
            value={data.search}
            onChange={event => data.setSearch(event.target.value)}
          />
        </div>
        <PaymentHeatmap rows={data.rows} monthLabels={data.monthLabels} currentMonth={data.currentMonth} />
      </Card>
    </>
  );
}
