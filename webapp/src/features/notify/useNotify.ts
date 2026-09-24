import { evaluateChildrenForMonth, reminderMessage } from '#features/billing/index.web.mjs';
import { findUnassignedPaymentHintsByChild } from '#features/payment-assignment/domain/unassigned-payment-hints.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { cents } from '#shared/domain/money.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { copyToClipboard } from '#shared/ui/copy-to-clipboard.mjs';
import { useAppSession } from '@shared/api/session';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

export type NotifyStatus = 'loading' | 'ready' | 'failed';

export interface ContactLine {
  name: string;
  phone: string;
}

export interface NotifyRowView {
  id: string;
  contract: string;
  name: string;
  contacts: ContactLine[];
  groupLabel: string;
  dueLabel: string;
  termLabel: string;
  late: boolean;
  expected: number | null;
  paid: number;
  rest: number | null;
  label: string;
  hasUnassignedHint: boolean;
  message: string;
}

export interface NotifyStats {
  late: number;
  soon: number;
  owed: number;
  unknown: number;
}

export interface NotifyData {
  status: NotifyStatus;
  failureMessage: string;
  periodLabel: string;
  rows: NotifyRowView[];
  stats: NotifyStats;
  emptyMessage: string;
  copyAllMessages: () => Promise<{ ok: boolean; notice: string }>;
  copyMessage: (message: string) => Promise<{ ok: boolean; notice: string }>;
}

async function copyOne(text: string, successMessage: string): Promise<{ ok: boolean; notice: string }> {
  let outcome = { ok: true, notice: '' };
  await copyToClipboard(text, successMessage, (notice, isError) => {
    outcome = { ok: !isError, notice };
  });
  return outcome;
}

const EMPTY_STATS: NotifyStats = { late: 0, soon: 0, owed: 0, unknown: 0 };

// Textul din coloana „Termen”, formulat din perspectiva persoanei care sună.
function termLabelOf(days: number): string {
  if (days < 0) return `întârziere ${-days} ${-days === 1 ? 'zi' : 'zile'}`;
  if (days === 0) return 'scadent azi';
  return `în ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

function contactLinesOf(child: Child): ContactLine[] {
  const lines = (
    [
      [child.parent, child.phone],
      [child.parent2, child.phone2],
    ] as const
  )
    .filter(([name, phone]) => name || phone)
    .map(([name, phone]) => ({ name: name || 'Nume necompletat', phone: phone || '' }));
  return lines.length ? lines : [{ name: 'Necompletat', phone: '' }];
}

/**
 * Echivalentul notify-list.view.mjs: copiii cu rest de plată, sortați implicit
 * după întârzierea cea mai veche. Doar copiii nearhivați (ca `activeEvaluations`
 * din compose-screens.mjs/useDashboard) — spre deosebire de Situația plăților,
 * care arată toată lista, inclusiv arhivați.
 */
export function useNotify(month: string): NotifyData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      periodLabel: '',
      rows: [],
      stats: EMPTY_STATS,
      emptyMessage: '',
      copyAllMessages: async () => ({ ok: false, notice: '' }),
      copyMessage: async () => ({ ok: false, notice: '' }),
    };
  }

  const records = state as RecordsSnapshot;
  const evaluations = evaluateChildrenForMonth(records, month, todayStr).filter(e => !e.child.archived);
  const notified = [...evaluations]
    .filter(e => e.obligation.notify)
    .sort((a, b) => a.obligation.daysToDue - b.obligation.daysToDue || a.child.name.localeCompare(b.child.name, 'ro'));
  const hints = findUnassignedPaymentHintsByChild(records);

  const rows: NotifyRowView[] = notified.map(({ child, obligation }) => ({
    id: child.id,
    contract: contractNumberOf(child),
    name: child.name,
    contacts: contactLinesOf(child),
    groupLabel: groupNameOf(child.groupId, records.groups) || '—',
    dueLabel: formatDate(obligation.due),
    termLabel: termLabelOf(obligation.daysToDue),
    late: obligation.daysToDue < 0,
    expected: obligation.expected,
    paid: obligation.paid,
    rest: obligation.rest,
    label: obligation.label,
    hasUnassignedHint: hints.has(child.id),
    message: reminderMessage({ child, obligation, month }),
  }));

  const late = notified.filter(e => e.obligation.daysToDue < 0).length;
  const soon = notified.filter(e => e.obligation.daysToDue >= 0).length;
  const owed = notified.reduce((sum, e) => sum + cents(e.obligation.rest), 0) / 100;
  // Fișele fără taxă sau fără perioadă confirmată nu pot fi evaluate deloc;
  // fără cifra asta, un „0 de notificat” ar părea liniștitor pe nedrept.
  const unknown = evaluations.filter(e => e.obligation.label === 'De verificat').length;

  return {
    status: 'ready',
    failureMessage: '',
    periodLabel: `Luna ${month} · situație la ${formatDate(todayStr)}`,
    rows,
    stats: { late, soon, owed, unknown },
    emptyMessage: rows.length
      ? ''
      : unknown
        ? `Nimeni de notificat, dar ${unknown} fișe nu pot fi evaluate. Completează taxa și perioada.`
        : 'Nimeni de notificat pentru luna aceasta.',
    copyAllMessages: () =>
      copyOne(
        rows.map(row => row.message).join('\n\n'),
        rows.length ? `${rows.length} mesaje copiate.` : 'Nimic de copiat.',
      ),
    copyMessage: message => copyOne(message, 'Mesaj copiat.'),
  };
}
