import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

export type StatusScreenStatus = 'loading' | 'ready' | 'failed';

export interface StatusRowView {
  id: string;
  contract: string;
  name: string;
  archived: boolean;
  groupId: string | null;
  groupName: string;
  expected: number | null;
  paid: number | null;
  rest: number | null;
  credit: number | null;
  due: string;
  label: string;
}

export interface StatusData {
  status: StatusScreenStatus;
  failureMessage: string;
  rows: StatusRowView[];
  groups: { id: string; name: string }[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  asOf: string;
}

const EMPTY: Omit<StatusData, 'status' | 'failureMessage' | 'groupFilter' | 'setGroupFilter'> = {
  rows: [],
  groups: [],
  asOf: '',
};

/**
 * Obligația fiecărui copil pe luna aleasă, inclusiv arhivați. Filtrul de grupă
 * restrânge doar tabelul — cardurile de sumar (când vor exista, vezi punctul
 * 10 din coadă) rămân mereu pe toată luna, la fel ca la Achitări.
 */
export function useStatus(month: string): StatusData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();
  const [groupFilter, setGroupFilter] = useState('all');

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      ...EMPTY,
      asOf: todayStr,
      groupFilter,
      setGroupFilter,
    };
  }

  const records = state as RecordsSnapshot;
  const evaluations = evaluateChildrenForMonth(records, month, todayStr);
  const allRows: StatusRowView[] = evaluations.map(({ child, obligation }) => ({
    id: child.id,
    contract: contractNumberOf(child),
    name: child.name,
    archived: Boolean(child.archived),
    groupId: child.groupId,
    groupName: groupNameOf(child.groupId, records.groups),
    expected: obligation.expected,
    paid: obligation.paid,
    rest: obligation.rest,
    credit: obligation.credit,
    due: obligation.due,
    label: obligation.label,
  }));
  const rows =
    groupFilter === 'all'
      ? allRows
      : allRows.filter(row => (groupFilter === 'none' ? !row.groupId : row.groupId === groupFilter));
  const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  return { status: 'ready', failureMessage: '', rows, groups, groupFilter, setGroupFilter, asOf: todayStr };
}
