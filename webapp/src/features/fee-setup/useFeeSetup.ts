import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { sortByGroupOrder } from '@shared/format/group-order';
import { hasMissingFee, defaultSetupMonth } from '#features/fee-setup/domain/child-fee-setup.mjs';
import { STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

export type FeeSetupStatus = 'loading' | 'ready' | 'failed';
export type FeeSetupFilter = 'missing' | 'all';

export type FeeCurrency = 'MDL' | 'EUR';

export interface FeeSetupRowView {
  id: string;
  name: string;
  ageLabel: string;
  /** Ce lipsește, gata de afișat în badge-ul „Lipsește” (ex. „Grupă, taxă”); gol dacă rândul e complet. */
  missingLabel: string;
  fee: string;
  currency: FeeCurrency;
  groupId: string;
  dueDayLabel: string;
  status: string;
  /** Include statutul curent al fișei chiar dacă e „De verificat” (nu e o valoare editabilă, dar trebuie să rămână vizibil). */
  statusOptions: string[];
  changed: boolean;
}

interface RowEdit {
  fee?: string;
  currency?: FeeCurrency;
  groupId?: string;
  status?: string;
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
  totalCount: number;
  search: string;
  setSearch: (value: string) => void;
  filter: FeeSetupFilter;
  setFilter: (value: FeeSetupFilter) => void;
  selectedRowKeys: ReadonlySet<string>;
  setSelectedRowKeys: (keys: ReadonlySet<string>) => void;
  bulkAmount: string;
  setBulkAmount: (value: string) => void;
  bulkCurrency: FeeCurrency | '';
  setBulkCurrency: (value: FeeCurrency | '') => void;
  bulkGroupId: string;
  setBulkGroupId: (value: string) => void;
  setFee: (id: string, value: string) => void;
  setCurrency: (id: string, value: FeeCurrency) => void;
  setGroupId: (id: string, value: string) => void;
  setStatus: (id: string, value: string) => void;
  /** Pune taxa/moneda/grupa completate în bara de selecție pe rândurile selectate (nu salvează). */
  applyBulkToSelection: () => void;
  hasPendingEdits: boolean;
  /** Fără `ids`, salvează toate rândurile modificate; cu `ids`, doar rândul/rândurile alese (Salvează de pe rând). */
  save: (ids?: string[]) => Promise<{ updatedCount: number }>;
  saving: boolean;
}

function currentFeeOf(child: Child): string {
  const amount = child.feeHistory?.at(-1)?.amount ?? child.fee;
  return amount === null || amount === undefined ? '' : String(amount);
}

function currentCurrencyOf(child: Child): FeeCurrency {
  return child.feeHistory?.at(-1)?.currency ?? 'MDL';
}

function missingLabelOf(groupId: string, fee: string): string {
  const parts: string[] = [];
  if (!groupId) parts.push('grupă');
  if (!fee) parts.push('taxă');
  if (!parts.length) return '';
  return parts.map((part, index) => (index === 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part)).join(', ');
}

/**
 * Completarea în masă rămâne aici, ca stare de hook (Map de editări per
 * copil) — sortarea/filtrarea din pagină nu mai poate pierde o completare
 * neatinsă, pentru că valoarea trăiește în React, nu în input.value.
 */
export function useFeeSetup(): FeeSetupData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FeeSetupFilter>('missing');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkCurrency, setBulkCurrency] = useState<FeeCurrency | ''>('');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof RowEdit>(id: string, field: K, value: RowEdit[K]) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const setFee = (id: string, value: string) => setField(id, 'fee', value);
  const setCurrency = (id: string, value: FeeCurrency) => setField(id, 'currency', value);
  const setGroupId = (id: string, value: string) => setField(id, 'groupId', value);
  const setStatus = (id: string, value: string) => setField(id, 'status', value);

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      groupOptions: [],
      statusOptions: STATUS_HISTORY_VALUES,
      missingCount: 0,
      totalCount: 0,
      search,
      setSearch,
      filter,
      setFilter,
      selectedRowKeys,
      setSelectedRowKeys,
      bulkAmount,
      setBulkAmount,
      bulkCurrency,
      setBulkCurrency,
      bulkGroupId,
      setBulkGroupId,
      setFee,
      setCurrency,
      setGroupId,
      setStatus,
      applyBulkToSelection: () => {},
      hasPendingEdits: false,
      save: async () => ({ updatedCount: 0 }),
      saving: false,
    };
  }

  const records = state as RecordsSnapshot;
  const groupOptions: GroupOption[] = sortByGroupOrder(records.groups).map(group => ({
    id: group.id,
    name: group.name,
  }));
  const activeChildren = records.children.filter((child: Child) => !child.archived);
  const missingCount = activeChildren.filter(child => hasMissingFee(child)).length;
  const totalCount = activeChildren.length;

  const normalizedSearch = normalizeSearchText(search);
  const visibleChildren = activeChildren
    .filter(
      (child: Child) =>
        (filter === 'all' || hasMissingFee(child)) &&
        matchesRecordListSearch('children', child, records, normalizedSearch),
    )
    .sort((a: Child, b: Child) => a.name.localeCompare(b.name, 'ro'));

  function isRowChanged(id: string): boolean {
    const child = records.children.find(c => c.id === id);
    if (!child) return false;
    const edit = edits[id];
    if (!edit) return false;
    const feeInitial = currentFeeOf(child);
    const feeValue = (edit.fee ?? feeInitial).trim();
    const feeChanged = feeValue !== '' && feeValue !== feeInitial;
    const currencyChanged = edit.currency !== undefined && edit.currency !== currentCurrencyOf(child);
    const groupChanged = edit.groupId !== undefined && edit.groupId !== (child.groupId || '');
    const statusChanged = edit.status !== undefined && edit.status !== (child.status || 'Activ');
    return feeChanged || currencyChanged || groupChanged || statusChanged;
  }

  const rows: FeeSetupRowView[] = visibleChildren.map(child => {
    const edit = edits[child.id];
    const currentStatus = child.status || 'Activ';
    const fee = edit?.fee ?? currentFeeOf(child);
    const groupId = edit?.groupId ?? (child.groupId || '');
    return {
      id: child.id,
      name: child.name,
      ageLabel: formatAge(child.birthDate),
      missingLabel: missingLabelOf(groupId, fee),
      fee,
      currency: edit?.currency ?? currentCurrencyOf(child),
      groupId,
      dueDayLabel: child.dueDay ? `ziua ${child.dueDay}` : '—',
      status: edit?.status ?? currentStatus,
      statusOptions: [...new Set([currentStatus, ...STATUS_HISTORY_VALUES])],
      changed: isRowChanged(child.id),
    };
  });

  const hasPendingEdits = Object.keys(edits).some(isRowChanged);

  function applyBulkToSelection() {
    if (selectedRowKeys.size === 0) return;
    if (!bulkAmount.trim() && !bulkCurrency && !bulkGroupId) return;
    setEdits(prev => {
      const next = { ...prev };
      for (const child of visibleChildren) {
        if (!selectedRowKeys.has(child.id)) continue;
        next[child.id] = {
          ...next[child.id],
          ...(bulkAmount.trim() ? { fee: bulkAmount.trim() } : {}),
          ...(bulkCurrency ? { currency: bulkCurrency } : {}),
          ...(bulkGroupId ? { groupId: bulkGroupId } : {}),
        };
      }
      return next;
    });
  }

  async function save(ids?: string[]): Promise<{ updatedCount: number }> {
    const targetIds = ids ? new Set(ids) : null;
    const updates: {
      id: string;
      from: string;
      fee?: number;
      currency?: FeeCurrency;
      groupId?: string | null;
      status?: string;
    }[] = [];
    for (const child of records.children) {
      if (targetIds && !targetIds.has(child.id)) continue;
      if (!isRowChanged(child.id)) continue;
      const edit = edits[child.id] as RowEdit;
      const from = defaultSetupMonth(child, todayStr);
      const update: (typeof updates)[number] = { id: child.id, from };
      const feeInitial = currentFeeOf(child);
      const feeValue = (edit.fee ?? feeInitial).trim();
      if (feeValue !== '' && feeValue !== feeInitial) update.fee = Number(feeValue);
      if (edit.currency !== undefined && edit.currency !== currentCurrencyOf(child)) update.currency = edit.currency;
      if (edit.groupId !== undefined && edit.groupId !== (child.groupId || '')) update.groupId = edit.groupId || null;
      if (edit.status !== undefined && edit.status !== (child.status || 'Activ')) update.status = edit.status;
      updates.push(update);
    }
    if (!updates.length) throw new Error('Nu ai completat nicio taxă.');
    setSaving(true);
    try {
      await session.mutate('/api/children-setup', { updates });
      const savedIds = new Set(updates.map(update => update.id));
      setEdits(prev => {
        const next = { ...prev };
        for (const id of savedIds) delete next[id];
        return next;
      });
      setSelectedRowKeys(prev => new Set([...prev].filter(id => !savedIds.has(id))));
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
    totalCount,
    search,
    setSearch,
    filter,
    setFilter,
    selectedRowKeys,
    setSelectedRowKeys,
    bulkAmount,
    setBulkAmount,
    bulkCurrency,
    setBulkCurrency,
    bulkGroupId,
    setBulkGroupId,
    setFee,
    setCurrency,
    setGroupId,
    setStatus,
    applyBulkToSelection,
    hasPendingEdits,
    save,
    saving,
  };
}
