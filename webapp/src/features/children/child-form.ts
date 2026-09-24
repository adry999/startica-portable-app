import { normalizeRecord, CHILD_STATUSES, STATUS_HISTORY_VALUES } from '@domain/record-schema.mjs';
import { defaultSetupMonth } from '@domain/child-setup-month.mjs';
import type { Child } from '@contracts/record-types.mjs';

export { CHILD_STATUSES };

export interface ChildFormValues {
  name: string;
  birthDate: string;
  status: string;
  groupId: string;
  parent: string;
  phone: string;
  parent2: string;
  phone2: string;
  healthNotes: string;
  contractDate: string;
  attendanceDate: string;
  withdrawalDate: string;
  statusFrom: string;
  fee: string;
  feeFrom: string;
  dueDay: string;
  feeHistoryText: string;
  statusHistoryText: string;
  notes: string;
}

interface FeeHistoryEntry {
  from: string;
  amount: number;
}

interface StatusHistoryEntry {
  from: string;
  status: string;
}

// Fără istoric (adăugare), luna implicită e cea din care se calculează corect
// lunile trecute; cu istoric deja existent, luna curentă rămâne implicită.
function defaultHistoryMonth(child: Child | null, today: string): string {
  if (child && (child.feeHistory?.length || child.statusHistory?.length)) return today.slice(0, 7);
  return defaultSetupMonth(child ?? {}, today);
}

export function defaultChildFormValues(child: Child | null, today: string): ChildFormValues {
  const month = defaultHistoryMonth(child, today);
  return {
    name: child?.name ?? '',
    birthDate: child?.birthDate ?? '',
    status: child?.status ?? 'Activ',
    groupId: child?.groupId ?? '',
    parent: child?.parent ?? '',
    phone: child?.phone ?? '',
    parent2: child?.parent2 ?? '',
    phone2: child?.phone2 ?? '',
    healthNotes: child?.healthNotes ?? '',
    contractDate: child?.contractDate ?? '',
    attendanceDate: child?.attendanceDate ?? '',
    withdrawalDate: child?.withdrawalDate ?? '',
    statusFrom: month,
    fee: child?.fee != null ? String(child.fee) : '',
    feeFrom: month,
    dueDay: String(child?.dueDay || 10),
    feeHistoryText: (child?.feeHistory ?? []).map(entry => `${entry.from} = ${entry.amount}`).join('\n'),
    statusHistoryText: (child?.statusHistory ?? []).map(entry => `${entry.from} = ${entry.status}`).join('\n'),
    notes: child?.notes ?? '',
  };
}

function parseHistoryLines(value: string): { from: string; value: string }[] {
  return value
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const segments = line.split('=');
      if (segments.length !== 2) throw new Error('Istoric invalid. Folosește formatul lună = valoare.');
      return { from: segments[0].trim(), value: segments[1].trim() };
    });
}

function upsertHistory<T extends { from: string }>(rows: T[], from: string, entry: T): T[] {
  return [...rows.filter(row => row.from !== from), entry];
}

/**
 * Echivalentul child-editor-fields.mjs's `read()`: taxa/statutul schimbate
 * adaugă o intrare de istoric din luna aleasă, ca lunile trecute să păstreze
 * valoarea de atunci. `id` e folosit doar la creare (previous absent).
 */
export function buildChildRecord(previous: Child | null, id: string, values: ChildFormValues): Child {
  const fee = values.fee === '' ? null : Number(values.fee);
  const feeHistory: FeeHistoryEntry[] = parseHistoryLines(values.feeHistoryText).map(({ from, value }) => ({
    from,
    amount: Number(value),
  }));
  let statusHistory: StatusHistoryEntry[] = parseHistoryLines(values.statusHistoryText).map(({ from, value }) => ({
    from,
    status: value,
  }));

  const record: Partial<Child> & Record<string, unknown> = {
    ...previous,
    id: previous?.id ?? id,
    notes: values.notes,
    name: values.name.trim(),
    parent: values.parent.trim(),
    phone: values.phone.trim(),
    parent2: values.parent2.trim(),
    phone2: values.phone2.trim(),
    healthNotes: values.healthNotes,
    groupId: values.groupId || null,
    birthDate: values.birthDate,
    contractDate: values.contractDate,
    attendanceDate: values.attendanceDate,
    withdrawalDate: values.withdrawalDate,
    status: values.status as Child['status'],
    fee,
    dueDay: Number(values.dueDay),
    feeHistory,
  };

  let nextFeeHistory = feeHistory;
  if (fee !== null && values.feeFrom && (!nextFeeHistory.length || fee !== (previous?.fee ?? null)))
    nextFeeHistory = upsertHistory(nextFeeHistory, values.feeFrom, { from: values.feeFrom, amount: fee });
  record.feeHistory = nextFeeHistory;

  if (!statusHistory.length && (previous?.status || record.status) === 'Activ' && record.attendanceDate)
    statusHistory = [{ from: String(record.attendanceDate).slice(0, 7), status: 'Activ' }];
  if (
    STATUS_HISTORY_VALUES.includes(record.status as string) &&
    (!statusHistory.length || record.status !== (previous?.status ?? 'Activ'))
  )
    statusHistory = upsertHistory(statusHistory, values.statusFrom, {
      from: values.statusFrom,
      status: record.status as string,
    });
  record.statusHistory = statusHistory as Child['statusHistory'];

  return normalizeRecord('children', record) as Child;
}
