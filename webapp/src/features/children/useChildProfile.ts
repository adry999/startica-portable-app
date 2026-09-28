import { useAppSession } from '@shared/api/session';
import { useSessionStatus } from '@shared/api/useSessionStatus';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { sortByGroupOrder } from '@shared/format/group-order';
import { obligation, feeEntryFor } from '#shared/domain/tuition-obligation.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import type { Child, Group, Payment } from '@contracts/record-types.mjs';

export type ChildProfileStatus = 'loading' | 'ready' | 'failed' | 'not-found';

export interface ChildProfileData {
  status: ChildProfileStatus;
  failureMessage: string;
  child: Child | null;
  groups: Group[];
  groupName: string;
  /** Grupa curentă a copilului, cu capacitate/educator — `null` dacă nu are grupă. */
  group: Group | null;
  /** Câți copii nearhivați sunt în grupa curentă — pentru „N/capacitate copii”. */
  groupMemberCount: number;
  contractLabel: string;
  age: string;
  obligation: ReturnType<typeof obligation> | null;
  feeEntry: ReturnType<typeof feeEntryFor> | null;
  payments: Payment[];
}

const NOT_FOUND: ChildProfileData = {
  status: 'not-found',
  failureMessage: '',
  child: null,
  groups: [],
  groupName: '',
  group: null,
  groupMemberCount: 0,
  contractLabel: '',
  age: '',
  obligation: null,
  feeEntry: null,
  payments: [],
};

/** Aceleași calcule ca fișa vanilla (child-profile.view.mjs), portate 1:1 pe date derivate. */
export function useChildProfile(childId: string, month: string): ChildProfileData {
  const session = useAppSession();
  const { rates } = useExchangeRates();
  const { state, ready } = session.state;
  const { status, failureMessage } = useSessionStatus(session.state);

  if (!ready) {
    return {
      ...NOT_FOUND,
      status,
      failureMessage,
    };
  }

  const records = state;
  const child = records.children.find((c: Child) => c.id === childId) || null;
  if (!child) return NOT_FOUND;

  const payments = records.payments.filter((payment: Payment) => payment.childId === childId);
  const group = records.groups.find((g: Group) => g.id === child.groupId) ?? null;
  const groupMemberCount = child.groupId
    ? records.children.filter((c: Child) => c.groupId === child.groupId && !c.archived).length
    : 0;

  return {
    status: 'ready',
    failureMessage: '',
    child,
    groups: sortByGroupOrder(records.groups),
    groupName: groupNameOf(child.groupId, records.groups) || 'nealocată',
    group,
    groupMemberCount,
    contractLabel: contractNumberOf(child),
    age: formatAge(child.birthDate),
    obligation: obligation(child, month, records.payments, undefined, null, rates),
    feeEntry: feeEntryFor(child, month),
    payments,
  };
}
