import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { listUnassignedPayments } from '#features/payment-assignment/domain/unassigned-payment-queue.mjs';
import { measureAssignmentRisk } from '#features/payment-assignment/domain/unassigned-payment-risk.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Child, PaymentAllocation, RecordsSnapshot } from '@contracts/record-types.mjs';
import type { AssignmentRisk, ChildSuggestion } from '#features/payment-assignment/payment-assignment.types.d.mts';

const ASSIGNMENT_QUEUE_LIMIT = 200;

export type AssignStatus = 'loading' | 'ready' | 'failed';

export interface ChildOption {
  id: string;
  label: string;
  group: string;
}

export interface AssignRowView {
  paymentId: string;
  dateLabel: string;
  amountLabel: string;
  amount: number;
  method: string;
  monthLines: string[];
  source: string;
  selectedChildId: string;
  options: ChildOption[];
}

export interface AssignData {
  status: AssignStatus;
  failureMessage: string;
  risk: AssignmentRisk;
  rows: AssignRowView[];
  summary: string;
  selectedCount: number;
  selectChild: (paymentId: string, childId: string) => void;
  fillSuggested: () => number;
  clearSelections: () => void;
  save: () => Promise<{ saved: number }>;
  saving: boolean;
}

const EMPTY_RISK: AssignmentRisk = { unassigned: 0, coveringMonth: 0, amountCoveringMonth: 0, notified: 0 };

const suggestionLabel = (suggestion: ChildSuggestion) => `${suggestion.name} — ${suggestion.reasons.join('; ')}`;

// Grupuri separate: numele din sursă arată spre un copil anume, suma sau
// luna neachitată se potrivesc la zeci de copii deodată.
function childOptionsFor(suggestions: ChildSuggestion[], children: Child[]): ChildOption[] {
  const suggestedIds = new Set(suggestions.map(suggestion => suggestion.id));
  return [
    ...suggestions
      .filter(suggestion => suggestion.nameMatch)
      .map(suggestion => ({ id: suggestion.id, label: suggestionLabel(suggestion), group: 'Nume potrivit în sursă' })),
    ...suggestions
      .filter(suggestion => !suggestion.nameMatch)
      .map(suggestion => ({
        id: suggestion.id,
        label: suggestionLabel(suggestion),
        group: 'Doar sumă sau lună — verifică',
      })),
    ...children
      .filter(child => !child.archived && !suggestedIds.has(child.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
      .map(child => ({ id: child.id, label: child.name, group: 'Toți copiii' })),
  ];
}

type AssignBaseRow = Omit<AssignRowView, 'selectedChildId'>;

/**
 * Combobox-ul căutabil devine un <select> grupat — webapp nu are încă o
 * componentă de combobox în shared/ui.
 */
export function useAssign(month: string): AssignData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { risk, queue, queueIds, baseRows } = useMemo(() => {
    if (!ready) {
      return {
        risk: EMPTY_RISK,
        queue: [] as ReturnType<typeof listUnassignedPayments>,
        queueIds: new Set<string>(),
        baseRows: [] as AssignBaseRow[],
      };
    }
    const records = state as RecordsSnapshot;
    const risk = measureAssignmentRisk(records, month, todayStr);
    const queue = listUnassignedPayments(records, ASSIGNMENT_QUEUE_LIMIT);
    const queueIds = new Set(queue.map(entry => entry.payment.id));
    const baseRows: AssignBaseRow[] = queue.map(({ payment, suggestions }) => {
      const monthLines = allocations(payment).map(
        (allocation: PaymentAllocation) => `${allocation.month}: ${formatMoney(allocation.amount)}`,
      );
      return {
        paymentId: payment.id,
        dateLabel: formatDate(payment.date),
        amountLabel: formatMoney(payment.amount),
        amount: payment.amount,
        method: payment.method || '',
        monthLines,
        source: payment.sourceName || payment.childName || '',
        options: childOptionsFor(suggestions, records.children),
      };
    });
    return { risk, queue, queueIds, baseRows };
  }, [ready, state, month, todayStr]);

  // Selecțiile rămân în stare cât timp achitarea e în coadă; dacă un proces
  // concurent o asociază sau o arhivează, ies odată cu ea (nu se pierd la re-render).
  useEffect(() => {
    setSelections(prev => {
      const staleIds = Object.keys(prev).filter(id => !queueIds.has(id));
      if (!staleIds.length) return prev;
      const next = { ...prev };
      for (const id of staleIds) delete next[id];
      return next;
    });
  }, [queueIds]);

  const rows: AssignRowView[] = baseRows.map(row => ({
    ...row,
    selectedChildId: selections[row.paymentId] ?? '',
  }));

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      risk,
      rows,
      summary: '',
      selectedCount: 0,
      selectChild: () => {},
      fillSuggested: () => 0,
      clearSelections: () => {},
      save: async () => ({ saved: 0 }),
      saving: false,
    };
  }

  const summary = !risk.unassigned
    ? 'Toate achitările au un copil asociat.'
    : (() => {
        const nameMatchCounts = queue.map(
          ({ suggestions }) => suggestions.filter(suggestion => suggestion.nameMatch).length,
        );
        const unique = nameMatchCounts.filter(count => count === 1).length;
        const ambiguous = nameMatchCounts.filter(count => count > 1).length;
        return (
          `Se afișează cele mai recente ${queue.length} din ${risk.unassigned}. ` +
          `Din ele: ${unique} cu un singur nume potrivit, ${ambiguous} cu mai mulți candidați, ` +
          `${queue.length - unique - ambiguous} fără niciun nume în sursă — acelea cer documentul original.`
        );
      })();

  const selectedCount = Object.keys(selections).filter(id => queueIds.has(id)).length;

  function selectChild(paymentId: string, childId: string) {
    setSelections(prev => {
      const next = { ...prev };
      if (childId) next[paymentId] = childId;
      else delete next[paymentId];
      return next;
    });
  }

  // Se completează doar un candidat unic cu nume potrivit; suma și luna se potrivesc la zeci de copii.
  function fillSuggested(): number {
    const next = { ...selections };
    let count = 0;
    for (const { payment, suggestions } of queue) {
      const nameMatches = suggestions.filter(suggestion => suggestion.nameMatch);
      if (nameMatches.length !== 1 || next[payment.id]) continue;
      next[payment.id] = nameMatches[0].id;
      count++;
    }
    if (count) setSelections(next);
    return count;
  }

  function clearSelections() {
    setSelections({});
  }

  async function save(): Promise<{ saved: number }> {
    if (savingRef.current) throw new Error('O salvare este deja în curs.');
    const assignments = Object.entries(selections)
      .filter(([id]) => queueIds.has(id))
      .map(([id, childId]) => ({ id, childId }));
    if (!assignments.length) throw new Error('Nu ai ales niciun copil.');
    savingRef.current = true;
    setSaving(true);
    try {
      await session.mutate('/api/payments-assign', { assignments });
      setSelections(prev => {
        const next = { ...prev };
        for (const { id } of assignments) delete next[id];
        return next;
      });
      return { saved: assignments.length };
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return {
    status: 'ready',
    failureMessage: '',
    risk,
    rows,
    summary,
    selectedCount,
    selectChild,
    fillSuggested,
    clearSelections,
    save,
    saving,
  };
}
