import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterPills,
  LoadingState,
  MonthPicker,
  SearchInput,
  Select,
  SegmentedControl,
  SmsConfirmDialog,
  groupTone,
  useToast,
  useTopbarActions,
  type BadgeTone,
  type DataTableColumn,
  type SmsRecipientView,
  type SmsSingleChoiceView,
} from '@shared/ui';
import {
  useSmsLastNotified,
  useSmsSend,
  useSmsStatus,
  useSmsTemplates,
  type SmsRecipientRow,
  type SmsSendResultView,
} from '@shared/sms';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useKindergarten } from '@shared/api/useKindergarten';
import type { ViewKey } from '@shared/view-key';
import type { ToneableGroup } from '@shared/ui/group-tone';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { schoolYearLabel, schoolYearStartOf } from '#features/billing/index.web.mjs';
import { planSmsBatch } from '#features/sms-notify/index.web.mjs';
import { DEFAULT_SMS_TEMPLATE_BODY, renderSmsTemplate, smsVariablesFor } from '@domain/sms-template.mjs';
import { useStatus, NOTIFIABLE_LABELS, type StatusData, type StatusRowView, type StatusSegment } from './useStatus';
import { useSchoolYearStatus, type SchoolYearData, type YearRecipientRow } from './useSchoolYearStatus';
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

const SMS_DISABLED_TITLE = 'Conectează sms.md în Notificări';

type PlannedSmsMessage = ReturnType<typeof planSmsBatch>['messages'][number];

// planSmsBatch produce mereu childId dintr-un Child real (`chooseSmsRecipient`); nullul din tipul
// SmsSendMessage e doar pentru sursa 'manual' (neatinsă aici) — filtrul de mai jos e doar pentru tipuri.
function nonNullChildId<T extends { childId: string | null }>(messages: T[]): (T & { childId: string })[] {
  return messages.filter((message): message is T & { childId: string } => message.childId !== null);
}

/** Textul mesajului când destinatarul n-are telefon valid (nu se trimite, dar previzualizarea trebuie să arate ceva). */
function fallbackSmsText(recipient: SmsRecipientRow, month: string): string {
  return renderSmsTemplate(
    DEFAULT_SMS_TEMPLATE_BODY,
    smsVariablesFor({
      child: recipient.child,
      parentName: recipient.child.parent,
      obligation: recipient.obligation,
      month,
    }),
  );
}

function toSmsRecipientView(
  recipient: SmsRecipientRow,
  plannedByChildId: Map<string, PlannedSmsMessage>,
  month: string,
  isNotifiedToday: (id: string) => boolean,
): SmsRecipientView {
  const planned = plannedByChildId.get(recipient.child.id);
  return {
    id: recipient.child.id,
    name: recipient.child.name,
    phone: planned?.phone ?? null,
    text: planned?.text ?? fallbackSmsText(recipient, month),
    rest: recipient.obligation.rest ?? undefined,
    excludeReason: isNotifiedToday(recipient.child.id) ? 'notificat azi' : undefined,
  };
}

/** Trimite doar rândurile bifate/alese din `plannedMessages`; folosit atât pentru „Notifică” unic cât și pentru loturi. */
function createSendHandler(
  sendBatch: (request: {
    source: 'status-row' | 'status-bulk';
    month: string | null;
    templateId: string | null;
    messages: { childId: string; childName: string; recipientName: string; phone: string; text: string }[];
  }) => Promise<SmsSendResultView>,
  source: 'status-row' | 'status-bulk',
  requestMonth: string | null,
  plannedMessages: PlannedSmsMessage[],
) {
  return async (selectedIds: string[], singleChoice?: SmsSingleChoiceView): Promise<SmsSendResultView> => {
    if (singleChoice) {
      const message = plannedMessages.find(candidate => candidate.childId === selectedIds[0]);
      if (!message) throw new Error('Destinatar invalid.');
      return sendBatch({
        source,
        month: requestMonth,
        templateId: singleChoice.templateId,
        messages: [
          {
            childId: selectedIds[0],
            childName: message.childName,
            recipientName: message.recipientName,
            phone: message.phone,
            text: singleChoice.text,
          },
        ],
      });
    }
    const selected = new Set(selectedIds);
    const messages = plannedMessages
      .filter(
        (message): message is PlannedSmsMessage & { childId: string } =>
          message.childId !== null && selected.has(message.childId),
      )
      .map(message => ({
        childId: message.childId,
        childName: message.childName,
        recipientName: message.recipientName,
        phone: message.phone,
        text: message.text,
      }));
    return sendBatch({ source, month: requestMonth, templateId: null, messages });
  };
}

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
  /** 40a: „Plată +” pe rând — deschide `PaymentFormDrawer` cu restanța bifată; randat de App.tsx
   * (nu de `StatusPage`), ca granița dintre module (features/status ↔ features/payments) să rămână. */
  onOpenPayment: (childId: string) => void;
}

type StatusMode = 'month' | 'year';
const MODE_OPTIONS = [
  { value: 'month', label: 'Lună' },
  { value: 'year', label: 'An școlar' },
] as const;

export function StatusPage({ month, onMonthChange, onNavigate, onOpenChild, onOpenPayment }: StatusPageProps) {
  const [mode, setMode] = usePersistedState<StatusMode>('view.status', 'month');
  const [startYear, setStartYear] = useState(() => schoolYearStartOf(month));
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const statusData = useStatus(month);
  const yearData = useSchoolYearStatus(mode === 'year' ? startYear : null);
  // Montat aici (nu în StatusPrint) ca cererea /api/kindergarten să pornească la intrarea pe
  // ecran, nu la apăsarea „Tipărește” — vezi gardă kindergarten.ready din efectul de tipărire (M4).
  const kindergarten = useKindergarten();
  const sms = useSmsStatus();
  const lastNotified = useSmsLastNotified();
  const smsSend = useSmsSend();
  const smsTemplates = useSmsTemplates();
  const toast = useToast();
  const [smsDialog, setSmsDialog] = useState<{
    mode: 'single' | 'bulk';
    recipients: SmsRecipientView[];
    send: (ids: string[], singleChoice?: SmsSingleChoiceView) => Promise<SmsSendResultView>;
    namesByChildId: Map<string, string>;
    rowId?: string;
  } | null>(null);

  const smsConfigured = sms.data?.configured ?? false;
  const isNotifiedToday = (id: string) => lastNotified.notifiedToday(id, statusData.asOf);

  // Lot Lună: rândurile cu Restanță/Plată parțială (buton pe rând); bannerul „Notifică toți” alege
  // doar restanțierii dintre acestea (aceeași populație ca summary.overdueChildren).
  const monthBatchPlan = planSmsBatch({
    rows: statusData.notifiableRecipients,
    body: DEFAULT_SMS_TEMPLATE_BODY,
    stripDiacritics: true,
    month,
  });
  const monthMessages = nonNullChildId(monthBatchPlan.messages);
  const monthPlannedByChildId = new Map(monthMessages.map(message => [message.childId, message]));
  const monthRecipientByChildId = new Map(
    statusData.notifiableRecipients.map(recipient => [recipient.child.id, recipient]),
  );
  const monthNameByChildId = new Map(monthMessages.map(message => [message.childId, message.recipientName]));

  // Lot An școlar: fiecare copil cu sold > 0 are propria lună reprezentativă (cea mai veche restanță
  // neachitată) — planSmsBatch cere o singură lună per apel, deci grupăm destinatarii pe lună.
  const yearRecipientsByMonth = new Map<string, YearRecipientRow[]>();
  for (const recipient of yearData.recipients) {
    const group = yearRecipientsByMonth.get(recipient.month) ?? [];
    group.push(recipient);
    yearRecipientsByMonth.set(recipient.month, group);
  }
  const yearBatchMessages = nonNullChildId(
    [...yearRecipientsByMonth.entries()].flatMap(
      ([groupMonth, rows]) =>
        planSmsBatch({ rows, body: DEFAULT_SMS_TEMPLATE_BODY, stripDiacritics: true, month: groupMonth }).messages,
    ),
  );
  const yearPlannedByChildId = new Map(yearBatchMessages.map(message => [message.childId, message]));
  const yearNameByChildId = new Map(yearBatchMessages.map(message => [message.childId, message.recipientName]));

  /** Randează un șablon salvat pentru destinatarul unic al dialogului (7c/7e) — luna e fixă (mod Lună). */
  function renderTemplateForRow(rowId: string) {
    return (templateId: string) => {
      const recipient = monthRecipientByChildId.get(rowId);
      const template = smsTemplates.templates.find(candidate => candidate.id === templateId);
      if (!recipient || !template) return '';
      return renderSmsTemplate(
        template.body,
        smsVariablesFor({
          child: recipient.child,
          parentName: recipient.child.parent,
          obligation: recipient.obligation,
          month,
        }),
      );
    };
  }

  function openRowNotify(row: StatusRowView) {
    const recipient = monthRecipientByChildId.get(row.id);
    if (!recipient) return;
    setSmsDialog({
      mode: 'single',
      recipients: [toSmsRecipientView(recipient, monthPlannedByChildId, month, isNotifiedToday)],
      send: createSendHandler(smsSend.send, 'status-row', month, monthMessages),
      namesByChildId: monthNameByChildId,
      rowId: row.id,
    });
  }

  function openBannerNotify() {
    setSmsDialog({
      mode: 'bulk',
      recipients: statusData.overdueRecipients.map(recipient =>
        toSmsRecipientView(recipient, monthPlannedByChildId, month, isNotifiedToday),
      ),
      send: createSendHandler(smsSend.send, 'status-bulk', month, monthMessages),
      namesByChildId: monthNameByChildId,
    });
  }

  function openYearNotify() {
    setSmsDialog({
      mode: 'bulk',
      recipients: yearData.recipients.map(recipient =>
        toSmsRecipientView(recipient, yearPlannedByChildId, recipient.month, isNotifiedToday),
      ),
      send: createSendHandler(smsSend.send, 'status-bulk', null, yearBatchMessages),
      namesByChildId: yearNameByChildId,
    });
  }

  function handleSmsSent(result: SmsSendResultView, namesByChildId: Map<string, string>) {
    const sentIds = result.results
      .filter(outcome => outcome.outcome === 'sent' && outcome.childId !== null)
      .map(outcome => outcome.childId as string);
    if (sentIds.length === 1) {
      toast.show({ message: `SMS trimis către ${namesByChildId.get(sentIds[0]) ?? ''}` });
    } else if (sentIds.length > 1) {
      toast.show({ message: `${sentIds.length} SMS trimise` });
    }
    void lastNotified.refresh();
  }

  // Randarea confirmării tipărite trebuie să apară în DOM înainte de window.print();
  // afterprint golește starea, ca situația tipărită să nu rămână montată pe ecran.
  // Așteaptă kindergarten.ready (M4) — altfel foaia tipărită iese cu „Startica” generic,
  // pentru că /api/kindergarten nu a răspuns încă la momentul window.print().
  useEffect(() => {
    if (!printOptions || !kindergarten.ready) return;
    const timer = setTimeout(() => window.print(), 0);
    const onAfterPrint = () => setPrintOptions(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printOptions, kindergarten.ready]);

  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl<StatusMode> ariaLabel="Mod de afișare" value={mode} onChange={setMode} options={MODE_OPTIONS} />
      {mode === 'month' ? (
        <MonthPicker value={month} onChange={onMonthChange} />
      ) : (
        <Select
          ariaLabel="Anul școlar"
          value={String(startYear)}
          onChange={value => setStartYear(Number(value))}
          options={yearData.schoolYearOptions.map(year => ({ value: String(year), label: schoolYearLabel(year) }))}
        />
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
          <MonthView
            data={statusData}
            smsConfigured={smsConfigured}
            isNotifiedToday={isNotifiedToday}
            onNavigate={onNavigate}
            onOpenChild={onOpenChild}
            onOpenPayment={onOpenPayment}
            onNotifyRow={openRowNotify}
            onNotifyAll={openBannerNotify}
          />
        ) : (
          <YearView
            data={yearData}
            groups={statusData.groups}
            yearLabel={`${startYear}–${startYear + 1}`}
            smsConfigured={smsConfigured}
            onNotifyYear={openYearNotify}
          />
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
          kindergarten={kindergarten.settings}
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

      {smsDialog && (
        <SmsConfirmDialog
          open
          mode={smsDialog.mode}
          recipients={smsDialog.recipients}
          unitCostLei={sms.data?.unitCost ?? 0.3}
          balanceLei={sms.data?.balance ? Number(sms.data.balance) : null}
          templates={smsDialog.mode === 'single' ? smsTemplates.templates : undefined}
          defaultTemplateId={smsDialog.mode === 'single' ? (smsTemplates.defaultTemplate?.id ?? null) : null}
          renderTemplate={
            smsDialog.mode === 'single' && smsDialog.rowId ? renderTemplateForRow(smsDialog.rowId) : undefined
          }
          onSend={smsDialog.send}
          onRetry={smsDialog.send}
          onClose={() => setSmsDialog(null)}
          onSent={result => handleSmsSent(result, smsDialog.namesByChildId)}
        />
      )}
    </>
  );
}

function MonthView({
  data,
  smsConfigured,
  isNotifiedToday,
  onNavigate,
  onOpenChild,
  onOpenPayment,
  onNotifyRow,
  onNotifyAll,
}: {
  data: StatusData;
  smsConfigured: boolean;
  isNotifiedToday: (id: string) => boolean;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
  onOpenPayment: (childId: string) => void;
  onNotifyRow: (row: StatusRowView) => void;
  onNotifyAll: () => void;
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
      render: row => (
        <>
          {formatMoney(row.expected, row.currency)}
          {row.extraCharges.map(charge => (
            <span key={charge.label} className={styles.extraCharge}>
              incl. {charge.label}
            </span>
          ))}
        </>
      ),
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
        NOTIFIABLE_LABELS.has(row.label) ? (
          <div className={styles.ctaCell}>
            {/* 40a: apar la hover și la focus de la tastatură (styles.rowActions) — „Plată +” cu
                restanța deja bifată, „SMS” = Notifică (SmsConfirmDialog mode="single", șablon implicit). */}
            <div className={styles.rowActions}>
              <Button variant="outline" className={styles.ctaButton} onClick={() => onOpenPayment(row.id)}>
                Plată +
              </Button>
              <Button
                variant="outline"
                className={styles.ctaButton}
                disabled={!smsConfigured}
                title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
                onClick={() => onNotifyRow(row)}
              >
                Notifică
              </Button>
            </div>
            {isNotifiedToday(row.id) && <Badge tone="mint">Notificat azi</Badge>}
          </div>
        ) : (
          <Button variant="outline" className={styles.ctaButton} onClick={() => onOpenChild(row.id)}>
            Vezi fișa
          </Button>
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
            <Button variant="link" className={styles.cardLink} onClick={() => onNavigate('fees')}>
              Completează →
            </Button>
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
          <SearchInput
            value={data.search}
            onChange={data.setSearch}
            placeholder="Caută copil"
            ariaLabel="Caută copil"
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
            <Button
              disabled={!smsConfigured}
              title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
              onClick={onNotifyAll}
            >
              Notifică toți
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function YearView({
  data,
  groups,
  yearLabel,
  smsConfigured,
  onNotifyYear,
}: {
  data: SchoolYearData;
  groups: ToneableGroup[];
  yearLabel: string;
  smsConfigured: boolean;
  onNotifyYear: () => void;
}) {
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
            <Button
              variant="outline"
              className={styles.ctaButton}
              disabled={!smsConfigured || data.recipients.length === 0}
              title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
              onClick={onNotifyYear}
            >
              Notifică
            </Button>
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
          <SearchInput
            value={data.search}
            onChange={data.setSearch}
            placeholder="Caută copil"
            ariaLabel="Caută copil"
          />
        </div>
        <PaymentHeatmap
          rows={data.rows}
          groups={groups}
          monthLabels={data.monthLabels}
          currentMonth={data.currentMonth}
          yearLabel={yearLabel}
        />
      </Card>
    </>
  );
}
