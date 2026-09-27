import { useState } from 'react';
import { Badge, Card, SmsConfirmDialog, useToast, type SmsRecipientView } from '@shared/ui';
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

export function NotifyPage({ month, onNavigate }: NotifyPageProps) {
  const notifyData = useNotify(month);
  const toast = useToast();
  const sms = useSmsStatus();
  const lastNotified = useSmsLastNotified();
  const smsSend = useSmsSend();
  const [dialog, setDialog] = useState<{ mode: 'single' | 'bulk'; recipients: SmsRecipientView[] } | null>(null);

  if (notifyData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (notifyData.status === 'failed')
    return <p className={styles.notice}>{notifyData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const todayStr = todayFn();
  const batchPlan = planSmsBatch({
    rows: notifyData.recipients,
    body: DEFAULT_SMS_TEMPLATE_BODY,
    stripDiacritics: STRIP_DIACRITICS,
    month,
  });
  const plannedByChildId = new Map(batchPlan.messages.map(message => [message.childId, message]));
  const smsConfigured = sms.data?.configured ?? false;

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

  async function sendSelected(selectedIds: string[]): Promise<SmsSendResultView> {
    const selected = new Set(selectedIds);
    const messages = batchPlan.messages
      .filter(message => selected.has(message.childId))
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
    const sentIds = result.results.filter(outcome => outcome.outcome === 'sent').map(outcome => outcome.childId);
    if (sentIds.length === 1) {
      toast.show({ message: `SMS trimis către ${plannedByChildId.get(sentIds[0])?.recipientName ?? ''}` });
    } else if (sentIds.length > 1) {
      toast.show({ message: `${sentIds.length} SMS trimise` });
    }
    void lastNotified.refresh();
  }

  async function copyAll() {
    const { notice } = await notifyData.copyAllMessages();
    toast.show({ message: notice });
  }

  async function copyOne(message: string) {
    const { notice } = await notifyData.copyMessage(message);
    toast.show({ message: notice });
  }

  return (
    <>
      <div className={styles.headerActions}>
        <p className={styles.period}>{notifyData.periodLabel}</p>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!smsConfigured || batchPlan.messages.length === 0}
            title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
            onClick={() => setDialog({ mode: 'bulk', recipients: notifyData.rows.map(recipientView) })}
          >
            Trimite tuturor · {batchPlan.messages.length}
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => void copyAll()}>
            Copiază toate mesajele
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
            Tipărește lista
          </button>
        </div>
      </div>

      <p className={styles.notice}>
        Copiii care au de achitat luna selectată, indiferent cât de aproape e scadența. Scadența este ziua din data
        contractului; cei cu scadența trecută apar evidențiați ca restanță. Cei fără taxă sau fără perioadă confirmată
        nu pot fi evaluați și apar la „De verificat".
      </p>

      <div className={styles.statsRow}>
        <Card tone="pink" className={styles.statCard}>
          <p className={styles.statLabel}>Cu întârziere</p>
          <strong className={styles.statValue}>{notifyData.stats.late}</strong>
          <small>scadența a trecut</small>
        </Card>
        <Card tone="yellow" className={styles.statCard}>
          <p className={styles.statLabel}>Nescadente încă</p>
          <strong className={styles.statValue}>{notifyData.stats.soon}</strong>
          <small>de plată, dar scadența n-a trecut</small>
        </Card>
        <Card tone="orange" className={styles.statCard}>
          <p className={styles.statLabel}>Sumă de încasat</p>
          <strong className={styles.statValue}>{formatMoney(notifyData.stats.owed)}</strong>
          <small>total pe lista de mai jos</small>
        </Card>
        <Card tone="mint" className={styles.statCard}>
          <p className={styles.statLabel}>Nu pot fi evaluați</p>
          <strong className={styles.statValue}>{notifyData.stats.unknown}</strong>
          <small>fără taxă sau perioadă confirmată</small>
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Copil</th>
              <th>Părinte / telefon</th>
              <th>Grupă</th>
              <th>Scadență</th>
              <th>Termen</th>
              <th className={styles.alignEnd}>Taxă</th>
              <th className={styles.alignEnd}>Achitat</th>
              <th className={styles.alignEnd}>Rest</th>
              <th>Situație</th>
              <th>Mesaj</th>
            </tr>
          </thead>
          <tbody>
            {notifyData.rows.length === 0 ? (
              <tr>
                <td colSpan={11} className={styles.empty}>
                  {notifyData.emptyMessage}
                </td>
              </tr>
            ) : (
              notifyData.rows.map(row => (
                <NotifyRow
                  key={row.id}
                  row={row}
                  onNavigate={onNavigate}
                  onCopy={copyOne}
                  smsConfigured={smsConfigured}
                  notifiedToday={lastNotified.notifiedToday(row.id, todayStr)}
                  onSendSms={() => setDialog({ mode: 'single', recipients: [recipientView(row)] })}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>

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

function NotifyRow({
  row,
  onNavigate,
  onCopy,
  smsConfigured,
  notifiedToday,
  onSendSms,
}: {
  row: NotifyRowView;
  onNavigate: (view: ViewKey) => void;
  onCopy: (message: string) => void;
  smsConfigured: boolean;
  notifiedToday: boolean;
  onSendSms: () => void;
}) {
  return (
    <tr className={row.late ? styles.lateRow : undefined}>
      <td>{row.contract}</td>
      <td>{row.name}</td>
      <td>
        {row.contacts.map((contact, index) => (
          <div key={index}>
            {contact.name}
            {contact.phone && <div>{contact.phone}</div>}
          </div>
        ))}
      </td>
      <td>{row.groupLabel}</td>
      <td>{row.dueLabel}</td>
      <td>{row.termLabel}</td>
      <td className={styles.alignEnd}>{formatMoney(row.expected)}</td>
      <td className={styles.alignEnd}>{formatMoney(row.paid)}</td>
      <td className={styles.alignEnd}>
        <strong>{formatMoney(row.rest)}</strong>
      </td>
      <td>
        {row.label}
        {row.hasUnassignedHint && (
          <>
            {' '}
            <button type="button" className={styles.hintLink} onClick={() => onNavigate('assign')}>
              posibilă plată neasociată
            </button>
          </>
        )}
      </td>
      <td>
        <div className={styles.messageActions}>
          <button
            type="button"
            className={styles.btnPrimarySmall}
            disabled={!smsConfigured}
            title={smsConfigured ? undefined : SMS_DISABLED_TITLE}
            onClick={onSendSms}
          >
            Trimite SMS
          </button>
          <button type="button" className={styles.btnGhostSmall} onClick={() => onCopy(row.message)}>
            Copiază
          </button>
          {notifiedToday && <Badge tone="mint">Notificat azi</Badge>}
        </div>
      </td>
    </tr>
  );
}
