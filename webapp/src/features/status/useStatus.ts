import { useAppSession } from '@shared/api/session';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

export type StatusScreenStatus = 'loading' | 'ready' | 'failed';

export interface StatusRowView {
  id: string;
  contract: string;
  name: string;
  archived: boolean;
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
  asOf: string;
}

/**
 * Obligația fiecărui copil pe luna aleasă, inclusiv arhivați (spre deosebire
 * de Achitări/Cheltuieli, aici nu există filtru — situația unei luni trebuie
 * să rămână completă).
 */
export function useStatus(month: string): StatusData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      asOf: todayStr,
    };
  }

  const records = state as RecordsSnapshot;
  const evaluations = evaluateChildrenForMonth(records, month, todayStr);
  const rows: StatusRowView[] = evaluations.map(({ child, obligation }) => ({
    id: child.id,
    contract: contractNumberOf(child),
    name: child.name,
    archived: Boolean(child.archived),
    expected: obligation.expected,
    paid: obligation.paid,
    rest: obligation.rest,
    credit: obligation.credit,
    due: obligation.due,
    label: obligation.label,
  }));

  return { status: 'ready', failureMessage: '', rows, asOf: todayStr };
}
