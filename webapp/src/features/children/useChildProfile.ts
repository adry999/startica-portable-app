import { useAppSession } from '@shared/api/session';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
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
  contractLabel: string;
  age: string;
  obligation: ReturnType<typeof obligation> | null;
  payments: Payment[];
}

const NOT_FOUND: ChildProfileData = {
  status: 'not-found',
  failureMessage: '',
  child: null,
  groups: [],
  groupName: '',
  contractLabel: '',
  age: '',
  obligation: null,
  payments: [],
};

/** Aceleași calcule ca fișa vanilla (child-profile.view.mjs), portate 1:1 pe date derivate. */
export function useChildProfile(childId: string, month: string): ChildProfileData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;

  if (!ready) {
    return {
      ...NOT_FOUND,
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
    };
  }

  const records = state;
  const child = records.children.find((c: Child) => c.id === childId) || null;
  if (!child) return NOT_FOUND;

  const payments = records.payments.filter((payment: Payment) => payment.childId === childId);

  return {
    status: 'ready',
    failureMessage: '',
    child,
    groups: records.groups,
    groupName: groupNameOf(child.groupId, records.groups) || 'nealocată',
    contractLabel: contractNumberOf(child),
    age: formatAge(child.birthDate),
    obligation: obligation(child, month, records.payments),
    payments,
  };
}
