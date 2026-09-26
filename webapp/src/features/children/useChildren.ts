import { useAppSession } from '@shared/api/session';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { buildReviewCenter } from '#features/review-center/index.web.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatAge, formatDate } from '#shared/format/date-format.mjs';
import type { Child, Group } from '@contracts/record-types.mjs';

export type ChildrenStatus = 'loading' | 'ready' | 'failed';
export type PaymentStatusTone = 'mint' | 'yellow' | 'pink' | 'neutral';

export interface PaymentStatus {
  tone: PaymentStatusTone;
  label: string;
}

export interface ChildRow {
  id: string;
  name: string;
  contractLabel: string;
  parent: string;
  phone: string;
  groupId: string | null;
  groupName: string;
  archived: boolean;
  status: string;
  dueDateLabel: string;
  payment: PaymentStatus;
  child: Child;
}

export interface ChildrenSummary {
  activeCount: number;
  occupiedGroupsCount: number;
  incompleteCount: number;
}

export interface ChildrenData {
  status: ChildrenStatus;
  failureMessage: string;
  rows: ChildRow[];
  groups: Group[];
  summary: ChildrenSummary;
  activeTotal: number;
  archivedTotal: number;
}

/**
 * Cele patru stări din spec (Achitat/Parțial/Neachitat/Scadent) nu acoperă
 * „De verificat”/„Fără obligație” din obligation() — fișe fără taxă completă
 * sau inactive rămân în neutru, cu propriul text, în loc să fie forțate
 * într-una din cele patru culori.
 */
function paymentStatusFor(label: string): PaymentStatus {
  switch (label) {
    case 'Plătit':
      return { tone: 'mint', label: 'Achitat' };
    case 'Plată parțială':
      return { tone: 'yellow', label: 'Parțial' };
    case 'Restanță':
      return { tone: 'pink', label: 'Neachitat' };
    case 'Scadent în curând':
    case 'Nescadent':
      return { tone: 'neutral', label: 'Scadent' };
    case 'Fără obligație':
      return { tone: 'neutral', label: 'Fără obligație' };
    default:
      return { tone: 'neutral', label: 'De verificat' };
  }
}

const EMPTY_SUMMARY: ChildrenSummary = { activeCount: 0, occupiedGroupsCount: 0, incompleteCount: 0 };

/**
 * Statisticile și logica de obligație sunt refolosite neschimbate din backend
 * (billing/month-evaluation.mjs, review-center) — vezi comentariile de import.
 */
export function useChildren(month: string): ChildrenData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      groups: [],
      summary: EMPTY_SUMMARY,
      activeTotal: 0,
      archivedTotal: 0,
    };
  }

  const records = state;
  const review = buildReviewCenter(records);
  const evaluations = evaluateChildrenForMonth(records, month);
  const obligationByChildId = new Map(evaluations.map(evaluation => [evaluation.child.id, evaluation.obligation]));

  const nonArchived = records.children.filter((child: Child) => !child.archived);
  const activeCount = nonArchived.filter((child: Child) => child.status === 'Activ').length;
  const occupiedGroupsCount = new Set(nonArchived.map((child: Child) => child.groupId).filter(Boolean)).size;
  const incompleteCount = new Set(
    review.items.filter(issue => issue.type === 'children' && !issue.record.archived).map(issue => issue.id),
  ).size;

  const rows: ChildRow[] = records.children.map((child: Child) => {
    const obligation = obligationByChildId.get(child.id)!;
    return {
      id: child.id,
      name: child.name,
      contractLabel: `Contract #${contractNumberOf(child)} · ${formatAge(child.birthDate)}`,
      parent: child.parent,
      phone: child.phone,
      groupId: child.groupId,
      groupName: groupNameOf(child.groupId, records.groups),
      archived: !!child.archived,
      status: child.status,
      dueDateLabel: formatDate(obligation.due),
      payment: paymentStatusFor(obligation.label),
      child,
    };
  });

  return {
    status: 'ready',
    failureMessage: '',
    rows,
    groups: records.groups,
    summary: { activeCount, occupiedGroupsCount, incompleteCount },
    activeTotal: nonArchived.length,
    archivedTotal: records.children.filter((child: Child) => child.archived).length,
  };
}
