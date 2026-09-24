import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { hasMissingFee, defaultSetupMonth } from '#features/fee-setup/domain/child-fee-setup.mjs';
import { STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';

export type FeeSetupStatus = 'loading' | 'ready' | 'failed';
export type FeeSetupFilter = 'missing' | 'all';

export interface FeeSetupRowView {
  id: string;
  contract: string;
  name: string;
  attendanceLabel: string;
  fee: string;
  groupId: string;
  from: string;
  status: string;
  /** Include statutul curent al fișei chiar dacă e „De verificat” (nu e o valoare editabilă, dar trebuie să rămână vizibil). */
  statusOptions: string[];
}

interface RowEdit {
  fee?: string;
  groupId?: string;
  status?: string;
  from?: string;
}

export interface GroupOption {
  id: string;
  name: string;
}

export interface FeeSetupData {
  status: FeeSetupStatus;
  failureMessage: string;
  rows: FeeSetupRowView[];
  groupOptions: GroupOption[];
  statusOptions: readonly string[];
  missingCount: number;
  search: string;
  setSearch: (value: string) => void;
  filter: FeeSetupFilter;
  setFilter: (value: FeeSetupFilter) => void;
  bulkAmount: string;
  setBulkAmount: (value: string) => void;
  bulkGroupId: string;
  setBulkGroupId: (value: string) => void;
  bulkStatus: string;
  setBulkStatus: (value: string) => void;
  setFee: (id: string, value: string) => void;
  setGroupId: (id: string, value: string) => void;
  setStatus: (id: string, value: string) => void;
  setFrom: (id: string, value: string) => void;
  applyBulkToVisible: () => void;
  hasPendingEdits: boolean;
  save: () => Promise<{ updatedCount: number }>;
  saving: boolean;
}

function currentFeeOf(child: Child): string {
  const amount = child.feeHistory?.at(-1)?.amount ?? child.fee;
  return amount === null || amount === undefined ? '' : String(amount);
}

/**
 * Echivalentul fee-setup.controller.mjs: completarea în masă rămâne aici, ca
 * stare de hook (Map de editări per copil) în loc de citiri/scrieri directe
 * din DOM — sortarea/filtrarea din pagină nu mai poate pierde o completare
 * neatinsă, pentru că valoarea trăiește în React, nu în input.value.
 */
export function useFeeSetup(): FeeSetupData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FeeSetupFilter>('missing');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [saving, setSaving] = useState(false);

  function setField(id: string, field: keyof RowEdit, value: string) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const setFee = (id: string, value: string) => setField(id, 'fee', value);
  const setGroupId = (id: string, value: string) => setField(id, 'groupId', value);
  const setStatus = (id: string, value: string) => setField(id, 'status', value);
  const setFrom = (id: string, value: string) => setField(id, 'from', value);

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      groupOptions: [],
      statusOptions: STATUS_HISTORY_VALUES,
      missingCount: 0,
      search,
      setSearch,
      filter,
      setFilter,
      bulkAmount,
      setBulkAmount,
      bulkGroupId,
      setBulkGroupId,
      bulkStatus,
      setBulkStatus,
      setFee,
      setGroupId,
      setStatus,
      setFrom,
      applyBulkToVisible: () => {},
      hasPendingEdits: false,
      save: async () => ({ updatedCount: 0 }),
      saving: false,
    };
  }

  const records = state as RecordsSnapshot;
  const groupOptions: GroupOption[] = [...records.groups]
    .sort((a: Group, b: Group) => a.name.localeCompare(b.name, 'ro'))
    .map(group => ({ id: group.id, name: group.name }));
  const missingCount = records.children.filter(child => !child.archived && hasMissingFee(child)).length;

  const normalizedSearch = normalizeSearchText(search);
  const visibleChildren = records.children
    .filter(
      (child: Child) =>
        !child.archived &&
        (filter === 'all' || hasMissingFee(child)) &&
        matchesRecordListSearch('children', child, records, normalizedSearch),
    )
    .sort((a: Child, b: Child) => a.name.localeCompare(b.name, 'ro'));

  const rows: FeeSetupRowView[] = visibleChildren.map(child => {
    const edit = edits[child.id];
    const currentStatus = child.status || 'Activ';
    return {
      id: child.id,
      contract: contractNumberOf(child),
      name: child.name,
      attendanceLabel: child.attendanceDate ?? '',
      fee: edit?.fee ?? currentFeeOf(child),
      groupId: edit?.groupId ?? (child.groupId || ''),
      from: edit?.from ?? defaultSetupMonth(child, todayStr),
      status: edit?.status ?? currentStatus,
      statusOptions: [...new Set([currentStatus, ...STATUS_HISTORY_VALUES])],
    };
  });

  function isRowChanged(id: string): boolean {
    const child = records.children.find(c => c.id === id);
    if (!child) return false;
    const edit = edits[id];
    if (!edit) return false;
    const feeInitial = currentFeeOf(child);
    const feeValue = (edit.fee ?? feeInitial).trim();
    const feeChanged = feeValue !== '' && feeValue !== feeInitial;
    const groupChanged = edit.groupId !== undefined && edit.groupId !== (child.groupId || '');
    const statusChanged = edit.status !== undefined && edit.status !== (child.status || 'Activ');
    return feeChanged || groupChanged || statusChanged;
  }

  const hasPendingEdits = Object.keys(edits).some(isRowChanged);

  function applyBulkToVisible() {
    if (!bulkAmount.trim() && !bulkGroupId && !bulkStatus) return;
    setEdits(prev => {
      const next = { ...prev };
      for (const child of visibleChildren) {
        next[child.id] = {
          ...next[child.id],
          ...(bulkAmount.trim() ? { fee: bulkAmount.trim() } : {}),
          ...(bulkGroupId ? { groupId: bulkGroupId } : {}),
          ...(bulkStatus ? { status: bulkStatus } : {}),
        };
      }
      return next;
    });
  }

  async function save(): Promise<{ updatedCount: number }> {
    const updates: { id: string; from: string; fee?: number; groupId?: string | null; status?: string }[] = [];
    for (const child of records.children) {
      if (!isRowChanged(child.id)) continue;
      const edit = edits[child.id] as RowEdit;
      const from = edit.from ?? defaultSetupMonth(child, todayStr);
      const update: (typeof updates)[number] = { id: child.id, from };
      const feeInitial = currentFeeOf(child);
      const feeValue = (edit.fee ?? feeInitial).trim();
      if (feeValue !== '' && feeValue !== feeInitial) update.fee = Number(feeValue);
      if (edit.groupId !== undefined && edit.groupId !== (child.groupId || '')) update.groupId = edit.groupId || null;
      if (edit.status !== undefined && edit.status !== (child.status || 'Activ')) update.status = edit.status;
      updates.push(update);
    }
    if (!updates.length) throw new Error('Nu ai completat nicio taxă.');
    setSaving(true);
    try {
      await session.mutate('/api/children-setup', { updates });
      setEdits({});
      return { updatedCount: updates.length };
    } finally {
      setSaving(false);
    }
  }

  return {
    status: 'ready',
    failureMessage: '',
    rows,
    groupOptions,
    statusOptions: STATUS_HISTORY_VALUES,
    missingCount,
    search,
    setSearch,
    filter,
    setFilter,
    bulkAmount,
    setBulkAmount,
    bulkGroupId,
    setBulkGroupId,
    bulkStatus,
    setBulkStatus,
    setFee,
    setGroupId,
    setStatus,
    setFrom,
    applyBulkToVisible,
    hasPendingEdits,
    save,
    saving,
  };
}
