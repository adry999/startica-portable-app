import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  LoadingState,
  SegmentedControl,
  SmsConfirmDialog,
  useToast,
  useTopbarActions,
  type PillTone,
  type SmsRecipientView,
} from '@shared/ui';
import { initials } from '@shared/format/initials';
import { useSmsLastNotified, useSmsSend, useSmsStatus, type SmsSendResultView } from '@shared/sms';
import { formatMoney } from '#shared/format/money-format.mjs';
import { planSmsBatch } from '#features/sms-notify/index.web.mjs';
import { DEFAULT_SMS_TEMPLATE_BODY } from '@domain/sms-template.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useNotify, type NotifyRowView } from './useNotify';
import type { ViewKey } from '@shared/view-key';
import styles from './NotifyPage.module.css';

export interface NotifyPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
}

const SMS_DISABLED_TITLE = 'Conectează sms.md în Notificări';
// Ecranul nu are selector de șablon (P3): trimite cu diacritice eliminate, ca segmentele
// numărate în dialog să rămână GSM-7, cel mai ieftin encoding.
const STRIP_DIACRITICS = true;

type QueueTab = 'toSend' | 'sent' | 'failed';

function toneForLabel(label: string): PillTone {
  if (label === 'Restanță') return 'pink';
  if (label === 'Plată parțială') return 'yellow';
  if (label === 'Scadent în curând') return 'orange';
  return 'neutral';
}

export function NotifyPage({ month, onNavigate }: NotifyPageProps) {
  const notifyData = useNotify(month);
  const toast = useToast();
  const sms = useSmsStatus();
  const lastNotified = useSmsLastNotified();
  const smsSend = useSmsSend();
  const [dialog, setDialog] = useState<{ mode: 'single' | 'bulk'; recipients: SmsRecipientView[] } | null>(null);
  const [tab, setTab] = useState<QueueTab>('toSend');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const todayStr = todayFn();
  const batchPlan = planSmsBatch({
    rows: notifyData.recipients,
    body: DEFAULT_SMS_TEMPLATE_BODY,
    stripDiacritics: STRIP_DIACRITICS,
    month,
  });
  const plannedByChildId = new Map(batchPlan.messages.map(message => [message.childId, message]));
  const smsConfigured = sms.data?.configured ?? false;

  // Selectează primul rând o singură dată la încărcare; „Nu trimite” golește selecția
  // intenționat, deci nu re-selectăm automat decât dacă rândul activ chiar a dispărut din listă.
  const initializedRef = useRef(false);
  const rowIdsKey = notifyData.rows.map(row => row.id).join('|');
  useEffect(() => {
    if (notifyData.status !== 'ready') return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      setActiveId(notifyData.rows[0]?.id ?? null);
      return;
    }
    if (activeId !== null && !notifyData.rows.some(row => row.id === activeId)) {
      setActiveId(notifyData.rows[0]?.id ?? null);
      setEditingText(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyData.status, rowIdsKey]);

  function messageFor(row: NotifyRowView): string {
    return edits[row.id] ?? row.message;
  }

  function recipientView(row: NotifyRowView): SmsRecipientView {
    const planned = plannedByChildId.get(row.id);
    return {
      id: row.id,
      name: row.name,
      phone: planned?.phone ?? null,
      text: edits[row.id] ?? planned?.text ?? row.message,
      rest: row.rest ?? undefined,
      excludeReason: lastNotified.notifiedToday(row.id, todayStr) ? 'notificat azi' : undefined,
    };
  }

  async function copyAll() {
    const { notice } = await notifyData.copyAllMessages();
    toast.show({ message: notice });
  }

  // Butoanele antetului (10-de-notificat.md: „De notificat CONTABILITATE” · pastila de stare ·
  // „Trimite tuturor · N”). „Copiază toate mesajele” nu apare în mockup, dar rămâne accesibilă
  // aici — nu are alt loc în noul layout pe 2 coloane.
  useTopbarActions(
    <div className={styles.headerActions}>
      <span className={smsConfigured ? styles.statusPillOn : styles.statusPillOff}>
        <span className={styles.statusDot} />
        {smsConfigured ? 'SMS conectat' : 'sms.md neconectat'}
      </span>
      <button
        type="button"
        className={styles.btnPrimary}
        disabled={!smsConfigured || batchPlan.messages.length === 0}
        title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
        onClick={() => setDialog({ mode: 'bulk', recipients: notifyData.rows.map(recipientView) })}
      >
        Trimite tuturor · {batchPlan.messages.length}
      </button>
      <Button variant="ghost" onClick={() => void copyAll()}>
        Copiază toate mesajele
      </Button>
    </div>,
  );

  if (notifyData.status === 'loading') return <LoadingState />;
  if (notifyData.status === 'failed')
    return <p className={styles.notice}>{notifyData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function sendSelected(selectedIds: string[]): Promise<SmsSendResultView> {
    const selected = new Set(selectedIds);
    const messages = batchPlan.messages
      .filter(message => selected.has(message.childId))
      .map(message => ({
        childId: message.childId,
        childName: message.childName,
        recipientName: message.recipientName,
        phone: message.phone,
        text: edits[message.childId] ?? message.text,
      }));
    return smsSend.send({ source: 'notify', month, templateId: null, messages });
  }

  function handleSent(result: SmsSendResultView) {
    const sentIds = result.results.filter(outcome => outcome.outcome === 'sent').map(outcome => outcome.childId);
    if (sentIds.length === 1) {
      toast.show({ message: `SMS trimis către ${plannedByChildId.get(sentIds[0])?.recipientName ?? ''}` });
    } else if (sentIds.length > 1) {
      toast.show({ message: `${sentIds.length} SMS trimise` });
    }
    void lastNotified.refresh();
  }

  async function copyOne(message: string) {
    const { notice } = await notifyData.copyMessage(message);
    toast.show({ message: notice });
  }

  const activeRow = notifyData.rows.find(row => row.id === activeId) ?? null;
  const sentThisMonth = sms.data?.sentThisMonth ?? 0;
  const failedThisMonth = sms.data?.failedThisMonth ?? 0;

  return (
    <>
      <div className={styles.content}>
        <Card className={styles.queue}>
          <div className={styles.queueHead}>
            <SegmentedControl
              ariaLabel="Coadă notificări"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'toSend', label: `De trimis · ${notifyData.rows.length}` },
                { value: 'sent', label: `Trimise · ${sentThisMonth}` },
                { value: 'failed', label: `Eșuate · ${failedThisMonth}` },
              ]}
            />
          </div>

          {tab !== 'toSend' && (
            <p className={styles.tabNotice}>
              {tab === 'sent'
                ? `${sentThisMonth} mesaje trimise luna aceasta.`
                : `${failedThisMonth} mesaje eșuate luna aceasta.`}{' '}
              <button type="button" className={styles.hintLink} onClick={() => onNavigate('notifications')}>
                Vezi jurnalul SMS
              </button>
            </p>
          )}

          {tab === 'toSend' &&
            (notifyData.rows.length === 0 ? (
              <p className={styles.empty}>{notifyData.emptyMessage}</p>
            ) : (
              <div className={styles.rows}>
                {notifyData.rows.map(row => {
                  const notifiedToday = lastNotified.notifiedToday(row.id, todayStr);
                  const parentName = row.contacts[0]?.name ?? row.name;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={row.id === activeId ? `${styles.row} ${styles.rowActive}` : styles.row}
                      aria-pressed={row.id === activeId}
                      onClick={() => {
                        setActiveId(row.id);
                        setEditingText(false);
                      }}
                    >
                      {/* Bazin.dc.html#8a: avatar 40 în ton — mai mare decât PersonCell 'md' (30),
                          nesuportat de variantele existente (md/lg) — celulă proprie, ca la Echipa. */}
                      <span className={styles.parentCell}>
                        <span
                          className={styles.parentAvatar}
                          style={{
                            background: `var(--${toneForLabel(row.label)}-soft, var(--neutral-soft))`,
                            color: `var(--${toneForLabel(row.label)}-ink, var(--subtle))`,
                          }}
                        >
                          {initials(parentName)}
                        </span>
                        <span className={styles.parentText}>
                          <strong className={styles.parentName}>{parentName}</strong>
                          <small className={styles.parentSub}>
                            pentru <strong>{row.name}</strong> · {row.termLabel}
                          </small>
                        </span>
                      </span>
                      <span className={styles.rowMeta}>
                        <span className={row.late ? styles.sumLate : styles.sumNeutral}>{formatMoney(row.rest)}</span>
                        {notifiedToday && <Badge tone="mint">Notificat azi</Badge>}
                        {/* Semnal doar informativ aici (rândul întreg e deja un buton, nu poate
                            conține alt element clicabil) — link-ul spre Asociere e în panoul din
                            dreapta, când acest rând e activ. */}
                        {row.hasUnassignedHint && <Badge tone="pink">plată neasociată?</Badge>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
        </Card>

        <Card className={styles.preview}>
          {!activeRow ? (
            <p className={styles.empty}>Alege un părinte din listă pentru a vedea mesajul.</p>
          ) : (
            <>
              <div className={styles.previewHead}>
                <h2 className={styles.previewTitle}>Mesaj către {activeRow.contacts[0]?.name ?? activeRow.name}</h2>
                <Badge tone={toneForLabel(activeRow.label)}>{activeRow.label}</Badge>
              </div>
              {activeRow.hasUnassignedHint && (
                <p className={styles.tabNotice}>
                  Există o plată fără copil asociat care s-ar putea potrivi cu {activeRow.name}.{' '}
                  <button type="button" className={styles.hintLink} onClick={() => onNavigate('assign')}>
                    posibilă plată neasociată
                  </button>
                </p>
              )}

              <div className={styles.templates}>
                <span className={styles.templateChip}>Șablon: {activeRow.label}</span>
              </div>

              {editingText ? (
                <textarea
                  className={styles.bubbleEdit}
                  value={messageFor(activeRow)}
                  onChange={event => setEdits(current => ({ ...current, [activeRow.id]: event.target.value }))}
                />
              ) : (
                <p className={styles.bubble}>{messageFor(activeRow)}</p>
              )}
              <span className={styles.editHint}>Textul se poate edita înainte de trimitere.</span>

              <footer className={styles.previewFooter}>
                <button type="button" className={styles.linkGhost} onClick={() => setActiveId(null)}>
                  Nu trimite
                </button>
                <div className={styles.previewActions}>
                  <Button variant="outline" onClick={() => setEditingText(current => !current)}>
                    {editingText ? 'Gata' : 'Editează textul'}
                  </Button>
                  <button
                    type="button"
                    className={styles.btnPrimarySmall}
                    disabled={!smsConfigured}
                    title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
                    onClick={() => setDialog({ mode: 'single', recipients: [recipientView(activeRow)] })}
                  >
                    Trimite SMS
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhostSmall}
                    onClick={() => void copyOne(messageFor(activeRow))}
                  >
                    Copiază
                  </button>
                </div>
              </footer>
            </>
          )}
        </Card>
      </div>

      {dialog && (
        <SmsConfirmDialog
          open
          mode={dialog.mode}
          recipients={dialog.recipients}
          unitCostLei={sms.data?.unitCost ?? 0.3}
          balanceLei={sms.data?.balance ? Number(sms.data.balance) : null}
          onSend={sendSelected}
          onRetry={sendSelected}
          onClose={() => setDialog(null)}
          onSent={handleSent}
        />
      )}
    </>
  );
}
