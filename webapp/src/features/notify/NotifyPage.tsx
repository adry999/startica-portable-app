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
  type SmsSingleChoiceView,
} from '@shared/ui';
import { initials } from '@shared/format/initials';
import { useSmsLastNotified, useSmsSend, useSmsStatus, useSmsTemplates, type SmsSendResultView } from '@shared/sms';
import { formatMoney } from '#shared/format/money-format.mjs';
import { planSmsBatch } from '#features/sms-notify/index.web.mjs';
import { DEFAULT_SMS_TEMPLATE_BODY, renderSmsTemplate, smsVariablesFor } from '@domain/sms-template.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { useNotify, type NotifyRowView } from './useNotify';
import type { ViewKey } from '@shared/view-key';
import styles from './NotifyPage.module.css';

export interface NotifyPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
}

const SMS_DISABLED_TITLE = 'Conectează sms.md în Notificări';
// Lotul „Trimite tuturor” trimite mereu cu diacritice eliminate — dialogul unic (P3, 7c/7e)
// are propria bifă „Fără diacritice”, cu textul editat de acolo.
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
  const smsTemplates = useSmsTemplates();
  const [dialog, setDialog] = useState<{
    mode: 'single' | 'bulk';
    recipients: SmsRecipientView[];
    rowId?: string;
  } | null>(null);
  const [tab, setTab] = useState<QueueTab>('toSend');
  const [activeId, setActiveId] = useState<string | null>(null);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyData.status, rowIdsKey]);

  const recipientRowById = new Map(notifyData.recipients.map(recipient => [recipient.child.id, recipient]));

  function recipientView(row: NotifyRowView): SmsRecipientView {
    const planned = plannedByChildId.get(row.id);
    return {
      id: row.id,
      name: row.name,
      phone: planned?.phone ?? null,
      text: planned?.text ?? row.message,
      rest: row.rest ?? undefined,
      excludeReason: lastNotified.notifiedToday(row.id, todayStr) ? 'notificat azi' : undefined,
    };
  }

  /** Randează un șablon salvat pentru destinatarul unic al dialogului (7c/7e) — recipientRowById are {child, obligation}. */
  function renderTemplateForRow(rowId: string) {
    return (templateId: string) => {
      const template = smsTemplates.templates.find(candidate => candidate.id === templateId);
      const recipientRow = recipientRowById.get(rowId);
      if (!template || !recipientRow) return '';
      return renderSmsTemplate(
        template.body,
        smsVariablesFor({
          child: recipientRow.child,
          parentName: recipientRow.child.parent,
          obligation: recipientRow.obligation,
          month,
        }),
      );
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
      <Button
        variant="primary"
        size="header"
        disabled={!smsConfigured || batchPlan.messages.length === 0}
        title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
        onClick={() => setDialog({ mode: 'bulk', recipients: notifyData.rows.map(recipientView) })}
      >
        Trimite tuturor · {batchPlan.messages.length}
      </Button>
      <Button variant="ghost" onClick={() => void copyAll()}>
        Copiază toate mesajele
      </Button>
    </div>,
  );

  if (notifyData.status === 'loading') return <LoadingState />;
  if (notifyData.status === 'failed')
    return <p className={styles.notice}>{notifyData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  async function sendSelected(selectedIds: string[], singleChoice?: SmsSingleChoiceView): Promise<SmsSendResultView> {
    if (singleChoice) {
      const childId = selectedIds[0];
      const planned = plannedByChildId.get(childId);
      const row = notifyData.rows.find(candidate => candidate.id === childId);
      if (!planned || !row) throw new Error('Destinatar invalid.');
      return smsSend.send({
        source: 'notify',
        month,
        templateId: singleChoice.templateId,
        messages: [
          {
            childId,
            childName: row.name,
            recipientName: planned.recipientName,
            phone: planned.phone,
            text: singleChoice.text,
          },
        ],
      });
    }
    const selected = new Set(selectedIds);
    const messages = batchPlan.messages
      .filter(message => message.childId !== null && selected.has(message.childId))
      .map(message => ({
        childId: message.childId,
        childName: message.childName,
        recipientName: message.recipientName,
        phone: message.phone,
        text: message.text,
      }));
    return smsSend.send({ source: 'notify', month, templateId: null, messages });
  }

  function handleSent(result: SmsSendResultView) {
    const sentIds = result.results
      .filter(outcome => outcome.outcome === 'sent' && outcome.childId !== null)
      .map(outcome => outcome.childId as string);
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
              <Button variant="danger" className={styles.hintLink} onClick={() => onNavigate('notifications')}>
                Vezi jurnalul SMS
              </Button>
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
                      onClick={() => setActiveId(row.id)}
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
                  <Button variant="danger" className={styles.hintLink} onClick={() => onNavigate('assign')}>
                    posibilă plată neasociată
                  </Button>
                </p>
              )}

              <div className={styles.templates}>
                <span className={styles.templateChip}>Șablon: {activeRow.label}</span>
              </div>

              <p className={styles.bubble}>{activeRow.message}</p>
              <span className={styles.editHint}>Șablonul și textul se pot alege la trimitere.</span>

              <footer className={styles.previewFooter}>
                <Button variant="link" className={styles.linkGhost} onClick={() => setActiveId(null)}>
                  Nu trimite
                </Button>
                <div className={styles.previewActions}>
                  <Button
                    variant="primary"
                    size="lg"
                    className={styles.sendButton}
                    disabled={!smsConfigured}
                    title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
                    onClick={() =>
                      setDialog({ mode: 'single', recipients: [recipientView(activeRow)], rowId: activeRow.id })
                    }
                  >
                    Trimite SMS
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className={styles.copyButton}
                    onClick={() => void copyOne(activeRow.message)}
                  >
                    Copiază
                  </Button>
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
          templates={dialog.mode === 'single' ? smsTemplates.templates : undefined}
          defaultTemplateId={dialog.mode === 'single' ? (smsTemplates.defaultTemplate?.id ?? null) : null}
          renderTemplate={dialog.mode === 'single' && dialog.rowId ? renderTemplateForRow(dialog.rowId) : undefined}
          onSend={sendSelected}
          onRetry={sendSelected}
          onClose={() => setDialog(null)}
          onSent={handleSent}
        />
      )}
    </>
  );
}
