import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  SearchInput,
  SegmentedControl,
  SmsConfirmDialog,
  useToast,
  type DataTableColumn,
  type SmsRecipientView,
} from '@shared/ui';
import {
  useSmsLog,
  useSmsSend,
  useSmsStatus,
  SmsStatusBadge,
  type SmsLogEntryView,
  type SmsLogSegment,
  type SmsLogPeriodDays,
  type SmsSendResultView,
  type SmsSource,
} from '@shared/sms';
import { formatDateTime, formatMonthLabel, formatMonthName } from '#shared/format/date-format.mjs';
import { downloadCsv } from '@shared/csv-export';
import { today as todayFn } from '@domain/calendar-month.mjs';
import styles from './SmsMessagesPanel.module.css';

const SEGMENT_LABEL: Record<SmsLogSegment, string> = {
  all: 'Toate',
  delivered: 'Livrate',
  inProgress: 'În curs',
  failed: 'Eșuate',
};

const SOURCE_LABEL: Record<SmsSource, string> = {
  'status-row': 'Situația plăților',
  'status-bulk': 'Situația plăților (lot)',
  notify: 'De notificat',
  resend: 'Retrimitere',
  test: 'Test',
};

const PERIOD_LABEL: Record<string, string> = {
  '7': 'Ultimele 7 zile',
  '30': 'Ultimele 30 de zile',
  '90': 'Ultimele 90 de zile',
  all: 'Toate lunile',
};

/** Doar prima parte a lui „2026 Sep" (formatMonthLabel) — pastilele „SMS pe luni" nu au an. */
function monthShortLabel(month: string): string {
  return formatMonthLabel(month).split(' ')[1] ?? month;
}

function periodValueOf(period: SmsLogPeriodDays): string {
  return period === null ? 'all' : String(period);
}

function periodFromValue(value: string): SmsLogPeriodDays {
  return value === 'all' ? null : (Number(value) as SmsLogPeriodDays);
}

function resendRecipient(entry: SmsLogEntryView): SmsRecipientView {
  return {
    id: entry.childId ?? String(entry.id),
    name: entry.recipientName || entry.childName || '—',
    phone: entry.phone || null,
    text: entry.text,
  };
}

/** Fila „Mesaje SMS" din Notificări (14-sms.md §11a): jurnal + statistici + panou de detaliu. */
export function SmsMessagesPanel() {
  const log = useSmsLog();
  const sms = useSmsStatus();
  const smsSend = useSmsSend();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resendOpen, setResendOpen] = useState(false);
  const [monthsOpen, setMonthsOpen] = useState(false);

  const selectedEntry = log.entries.find(entry => entry.id === selectedId) ?? null;
  const currentMonthKey = todayFn().slice(0, 7);
  const recentMonths = log.monthly.slice(0, 3);

  const segmentOptions = (['all', 'delivered', 'inProgress', 'failed'] as const).map(value => ({
    value,
    label: `${SEGMENT_LABEL[value]} · ${log.segmentCounts[value]}`,
  }));

  const columns: DataTableColumn<SmsLogEntryView>[] = [
    {
      key: 'createdAt',
      header: 'Trimis',
      sortValue: entry => entry.createdAt,
      render: entry => formatDateTime(entry.createdAt),
    },
    {
      key: 'recipient',
      header: 'Destinatar',
      sortValue: entry => entry.recipientName,
      render: entry => (
        <>
          <div>{entry.recipientName || '—'}</div>
          <small className={styles.childName}>{entry.childName}</small>
        </>
      ),
    },
    {
      key: 'text',
      header: 'Mesaj',
      render: entry => <span className={styles.messagePreview}>{entry.text || '—'}</span>,
    },
    {
      key: 'template',
      header: 'Șablon',
      render: entry => <Badge tone="neutral">{entry.templateName || 'Personalizat'}</Badge>,
    },
    {
      key: 'status',
      header: 'Stare',
      sortValue: entry => entry.status,
      render: entry => <SmsStatusBadge status={entry.status} />,
    },
  ];

  async function resend(): Promise<SmsSendResultView> {
    if (!selectedEntry?.childId) throw new Error('Retrimiterea are nevoie de un copil valid.');
    return smsSend.send({
      source: 'resend',
      month: selectedEntry.month,
      templateId: selectedEntry.templateId,
      messages: [
        {
          childId: selectedEntry.childId,
          childName: selectedEntry.childName,
          recipientName: selectedEntry.recipientName,
          phone: selectedEntry.phone,
          text: selectedEntry.text,
        },
      ],
    });
  }

  function handleResent(result: SmsSendResultView) {
    const sent = result.results.some(outcome => outcome.outcome === 'sent');
    toast.show({ message: sent ? 'SMS retrimis.' : 'Retrimiterea a eșuat.' });
    void log.refresh();
  }

  function exportMonthlyCsv() {
    downloadCsv(
      'sms-pe-luni.csv',
      ['Lună', 'Mesaje', 'SMS', 'Eșuate'],
      log.monthly.map(row => [formatMonthName(row.month), row.sent, row.segments, row.failed]),
    );
  }

  return (
    <>
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>Trimise luna aceasta</p>
          <strong className={styles.statValue}>{log.stats.sentThisMonth}</strong>
        </Card>
        <Card tone="pink" className={styles.statCard}>
          <p className={styles.statLabel}>Eșuate</p>
          <strong className={styles.statValue}>{log.stats.failedThisMonth}</strong>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>SMS consumate luna aceasta</p>
          <strong className={styles.statValue}>{log.stats.segmentsThisMonth}</strong>
        </Card>
        <Card className={styles.monthlyCard}>
          <p className={styles.statLabel}>SMS pe luni</p>
          <div className={styles.monthPills}>
            {recentMonths.map(row => (
              <Badge key={row.month} tone={row.month === currentMonthKey ? 'orange' : 'neutral'}>
                {monthShortLabel(row.month)} {row.sent}
              </Badge>
            ))}
          </div>
          <button type="button" className={styles.allMonthsLink} onClick={() => setMonthsOpen(true)}>
            Toate lunile →
          </button>
        </Card>
      </div>

      <div className={styles.grid}>
        <Card className={styles.tableCard}>
          <div className={styles.toolbar}>
            <SegmentedControl
              ariaLabel="Stare SMS"
              value={log.segment}
              onChange={log.setSegment}
              options={segmentOptions}
            />
            <SearchInput
              value={log.search}
              onChange={log.setSearch}
              placeholder="Caută destinatar sau telefon"
              ariaLabel="Caută în jurnalul SMS"
            />
            <select
              className={styles.select}
              aria-label="Șablon"
              value={log.templateId ?? ''}
              onChange={event => log.setTemplateId(event.target.value || null)}
            >
              <option value="">Toate șabloanele</option>
              {log.templateOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              aria-label="Perioadă"
              value={periodValueOf(log.period)}
              onChange={event => log.setPeriod(periodFromValue(event.target.value))}
            >
              {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <DataTable
            bare
            columns={columns}
            rows={log.entries}
            rowKey={entry => String(entry.id)}
            onRowClick={entry => setSelectedId(entry.id)}
            rowClassName={entry => (entry.id === selectedId ? styles.rowSelected : undefined)}
            emptyState={<p>Niciun SMS pentru filtrele alese.</p>}
          />
        </Card>

        {selectedEntry ? (
          <SmsDetailPanel entry={selectedEntry} onResend={() => setResendOpen(true)} />
        ) : (
          <Card className={styles.emptyDetail}>
            <p>Alege un mesaj din tabel pentru detalii.</p>
          </Card>
        )}
      </div>

      {resendOpen && selectedEntry && (
        <SmsConfirmDialog
          open
          mode="single"
          recipients={[resendRecipient(selectedEntry)]}
          unitCostLei={sms.data?.unitCost ?? 0.3}
          balanceLei={sms.data?.balance ? Number(sms.data.balance) : null}
          onSend={resend}
          onClose={() => setResendOpen(false)}
          onSent={handleResent}
        />
      )}

      <Drawer
        open={monthsOpen}
        title="SMS pe luni"
        width={480}
        onClose={() => setMonthsOpen(false)}
        footer={
          <Button variant="ghost" onClick={exportMonthlyCsv}>
            Exportă CSV
          </Button>
        }
      >
        <table className={styles.monthlyTable}>
          <thead>
            <tr>
              <th>Lună</th>
              <th>Mesaje</th>
              <th>SMS</th>
              <th>Eșuate</th>
            </tr>
          </thead>
          <tbody>
            {log.monthly.map(row => (
              <tr key={row.month}>
                <td>{formatMonthName(row.month)}</td>
                <td>{row.sent}</td>
                <td>{row.segments}</td>
                <td>{row.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Drawer>
    </>
  );
}

function SmsDetailPanel({ entry, onResend }: { entry: SmsLogEntryView; onResend: () => void }) {
  const phoneBlanked = entry.phone === '';
  const textBlanked = entry.text === '';
  const canResend = !!entry.childId && !phoneBlanked && !textBlanked;
  const resendTitle = canResend
    ? undefined
    : 'Textul și telefonul au fost șterse după 365 de zile (retenție) sau mesajul nu are un copil asociat.';

  return (
    <Card className={styles.detailCard}>
      <div className={`${styles.detailHeader} ${styles[`tone_${entry.status}`]}`}>
        <SmsStatusBadge status={entry.status} />
        <span className={styles.detailRecipient}>{entry.recipientName || '—'}</span>
      </div>

      <p className={styles.bubble}>{textBlanked ? '—' : entry.text}</p>

      <dl className={styles.metaList}>
        <div className={styles.metaRow}>
          <dt>Trimis</dt>
          <dd>{formatDateTime(entry.createdAt)}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Șablon</dt>
          <dd>{entry.templateName || 'Personalizat'}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Lungime</dt>
          <dd>
            {entry.characters} caractere · {entry.segments} SMS ({entry.encoding === 'ucs-2' ? 'UCS-2' : 'GSM-7'})
          </dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Sursă</dt>
          <dd>{SOURCE_LABEL[entry.source]}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Telefon</dt>
          <dd>{phoneBlanked ? '—' : entry.phone}</dd>
        </div>
      </dl>

      {entry.status === 'failed' && entry.providerError && (
        <p className={styles.providerError}>Răspuns furnizor: {entry.providerError}</p>
      )}

      <div className={styles.detailActions}>
        <Button variant="primary" disabled={!canResend} title={resendTitle} onClick={onResend}>
          Retrimite
        </Button>
        {entry.childId && (
          <Link className={styles.fixLink} to={`/copii/${entry.childId}`}>
            Corectează telefonul
          </Link>
        )}
      </div>
    </Card>
  );
}
