import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { useSessionStatus } from '@shared/api/useSessionStatus';
import { usePersistedSort } from '@shared/state/usePersistedSort';
import { useUrlParams } from '@shared/state/useUrlParams';
import { sortByGroupOrder } from '@shared/format/group-order';
import { total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { childNameOf, serviceOf } from '#shared/domain/record-labels.mjs';
import { DEFAULT_SERVICE_ID, DEFAULT_SERVICE_SEEDS } from '#shared/domain/record-schema.mjs';
import { summarizePaymentsByMethod } from '#shared/ui/record-list-summary.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import type { DataTableSort, PeriodPreset } from '@shared/ui';
import { buildPaymentRecord, findDuplicatePayment, type PaymentFormValues } from './payment-form';
import type { Payment, PaymentAllocation, PaymentTender, RecordsSnapshot, Service } from '@contracts/record-types.mjs';

export type PaymentsStatus = 'loading' | 'ready' | 'failed';
export type ArchiveFilter = 'active' | 'archived' | 'all';

export const ARCHIVE_FILTER_OPTIONS: { value: ArchiveFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Arhivate' },
  { value: 'all', label: 'Toate' },
];

export interface PaymentTenderView {
  method: string;
  amount: number;
}

export interface PaymentAllocationView {
  month: string;
  label: string;
  amount: number;
}

export interface PaymentRowView {
  id: string;
  date: string;
  dateLabel: string;
  childId: string;
  childLabel: string;
  sourceName: string;
  unassigned: boolean;
  tenders: PaymentTenderView[];
  allocations: PaymentAllocationView[];
  total: number;
  archived: boolean;
  /** Id-ul serviciului (B3) — 'gradinita' implicit; folosit la comparația cu filtrul Serviciu. */
  serviceId: string;
  serviceLabel: string;
  /** Unul din cele 8 tonuri (`SERVICE_TONES`) — Bazin e 'blue', ca să pice exact pe `Badge tone="blue"`. */
  serviceTone: string;
}

export interface PaymentsSummary {
  count: number;
  total: number;
  cash: number;
  card: number;
  transfer: number;
  /** Numărul de achitări cu un tender pe metoda respectivă — pentru eticheta cardului
   * („Cash · 9”), neafectat de filtrul Metodă, la fel ca suma (05-achitari.md §3). */
  cashCount: number;
  cardCount: number;
  transferCount: number;
}

export interface PaymentsData {
  status: PaymentsStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  rows: PaymentRowView[];
  summary: PaymentsSummary;
  groups: { id: string; name: string }[];
  search: string;
  setSearch: (value: string) => void;
  childId: string;
  setChildId: (value: string) => void;
  method: string;
  setMethod: (value: string) => void;
  service: string;
  setService: (value: string) => void;
  /** Serviciile vizibile (nu `hidden`), sortate ca la Grupe — pentru grupul FilterPills „Serviciu”. */
  services: Service[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  /** Presetarea + interval pe zi (`YYYY-MM-DD`) ale `PeriodFilter` (§5.1) — `PeriodFilter` calculează
   * singur `periodFrom`/`periodTo` la schimbarea presetării; hook-ul doar ține cele 3 valori. */
  periodPreset: PeriodPreset;
  setPeriodPreset: (value: PeriodPreset) => void;
  periodFrom: string;
  setPeriodFrom: (value: string) => void;
  periodTo: string;
  setPeriodTo: (value: string) => void;
  archiveFilter: ArchiveFilter;
  setArchiveFilter: (value: ArchiveFilter) => void;
  /** Resetează căutarea + pastilele (metodă/serviciu/grupă/arhivare) într-un singur apel — vezi
   * useUrlParams: resetFilters() din PaymentsTable nu poate apela cele 5 setteri individual,
   * fiindcă toate ating URL-ul și s-ar suprascrie reciproc în același tur de evenimente. */
  resetUrlFilters: () => void;
  /** §13.1: cele mai noi primele implicit, alegerea utilizatorului persistă pe pagină. */
  sort: DataTableSort;
  setSort: (sort: DataTableSort | null) => void;
  archivePayment: (id: string) => Promise<void>;
  unarchivePayment: (id: string) => Promise<void>;
  archiveMany: (ids: string[]) => Promise<void>;
  unarchiveMany: (ids: string[]) => Promise<void>;
  createPayment: (values: PaymentFormValues, confirmDuplicate: () => boolean) => Promise<boolean>;
  updatePayment: (previous: Payment, values: PaymentFormValues) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  deleteManyForever: (ids: string[]) => Promise<void>;
}

const EMPTY_SUMMARY: PaymentsSummary = {
  count: 0,
  total: 0,
  cash: 0,
  card: 0,
  transfer: 0,
  cashCount: 0,
  cardCount: 0,
  transferCount: 0,
};

function countByMethod(payments: Payment[], method: string): number {
  return payments.filter(payment => paymentTenders(payment).some((tender: PaymentTender) => tender.method === method))
    .length;
}

function buildRow(payment: Payment, records: RecordsSnapshot): PaymentRowView {
  const service = serviceOf(payment, records.services ?? []);
  return {
    id: payment.id,
    date: payment.date,
    dateLabel: formatDate(payment.date),
    childId: payment.childId,
    childLabel: childNameOf(payment, records.children),
    sourceName: payment.sourceName || '',
    unassigned: !payment.childId,
    tenders: paymentTenders(payment),
    allocations: allocations(payment).map((allocation: PaymentAllocation) => ({
      month: allocation.month,
      label: formatMonthLabel(allocation.month),
      amount: allocation.amount,
    })),
    total: payment.amount,
    archived: Boolean(payment.archived),
    serviceId: service.id,
    serviceLabel: service.name,
    serviceTone: service.tone,
  };
}

/** Serviciile vizibile ale filialei, sortate ca la Grupe — cade pe Grădiniță+Bazin dacă
 * instalarea/fixtura nu declară încă `services` (vezi `serviceOf`). */
function visibleServices(services: Service[] | undefined): Service[] {
  const list = services && services.length > 0 ? services : DEFAULT_SERVICE_SEEDS;
  return sortByGroupOrder(list.filter(service => !service.hidden));
}

/**
 * Filtrare (căutare, copil, metodă, perioadă pe zi, arhivare) + sumar pe
 * metodă, aici ca stare de hook. Filtrele trăiesc aici, nu în pagină, ca
 * PaymentsPage să rămână randare pură — la fel ca openGroupId în useGroups.
 */
export function usePayments(initialChildId = ''): PaymentsData {
  const session = useAppSession();
  const { state, ready } = session.state;
  const { status, failureMessage } = useSessionStatus(session.state);
  const records = state as RecordsSnapshot;

  // §13.2 PROMPT-8 („același lucru în Achitări"): căutarea și pastilele de filtru rămân la
  // întoarcerea din fișa copilului — stare în URL (useUrlParams), nu useState. Perioada rămâne
  // useState (nu e listată explicit în §13.2, iar cele 3 câmpuri legate ar complica inutil URL-ul).
  const [urlFilters, setUrlFilters] = useUrlParams({
    q: '',
    metoda: '',
    serviciu: '',
    grupa: 'all',
    arhivare: 'active',
  });
  const search = urlFilters.q;
  const method = urlFilters.metoda;
  const service = urlFilters.serviciu;
  const groupFilter = urlFilters.grupa;
  const archiveFilter = urlFilters.arhivare as ArchiveFilter;
  const setSearch = (value: string) => setUrlFilters({ q: value });
  const setMethod = (value: string) => setUrlFilters({ metoda: value });
  const setService = (value: string) => setUrlFilters({ serviciu: value });
  const setGroupFilter = (value: string) => setUrlFilters({ grupa: value });
  const setArchiveFilter = (value: ArchiveFilter) => setUrlFilters({ arhivare: value });
  const resetUrlFilters = () => setUrlFilters({ q: '', metoda: '', serviciu: '', grupa: 'all', arhivare: 'active' });

  const [childId, setChildId] = useState(initialChildId);
  // Implicit 'tot' (fără limite) — comportamentul de azi, și eticheta din mockup (05-achitari.md
  // „Perioadă: oricând”).
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('tot');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [sort, setSort] = usePersistedSort('sort.payments', { key: 'date', direction: 'desc' });

  // m8: citesc `session.state.state` la momentul apelului, nu `records` din closure-ul randării în
  // care a fost capturată funcția — o referință ținută de un toast „Anulează” (arhivare/dezarhivare)
  // poate fi apelată după ce starea s-a schimbat (ex. un receiptNumber atribuit între timp).
  async function archivePayment(id: string) {
    const current = session.state.state as RecordsSnapshot;
    const payment = current.payments.find(p => p.id === id);
    if (!payment) throw new Error('Achitarea nu mai există.');
    await session.mutate('/api/record', {
      type: 'payments',
      mode: 'update',
      record: { ...payment, archived: true, archivedAt: new Date().toISOString() },
    });
  }

  async function unarchivePayment(id: string) {
    const current = session.state.state as RecordsSnapshot;
    const payment = current.payments.find(p => p.id === id);
    if (!payment) throw new Error('Achitarea nu mai există.');
    await session.mutate('/api/record', {
      type: 'payments',
      mode: 'update',
      record: { ...payment, archived: false, archivedAt: null },
    });
  }

  async function archiveMany(ids: string[]) {
    for (const id of ids) await archivePayment(id);
  }

  async function unarchiveMany(ids: string[]) {
    for (const id of ids) await unarchivePayment(id);
  }

  // `confirmDuplicate` e injectat de pagină (window.confirm), ca hook-ul să
  // rămână testabil fără un dialog real de browser — la fel ca `context.confirm`
  // din record-editor-dialog.mjs.
  async function createPayment(values: PaymentFormValues, confirmDuplicate: () => boolean): Promise<boolean> {
    const record = buildPaymentRecord(null, `PAY-${crypto.randomUUID()}`, values);
    const duplicate = findDuplicatePayment(records, record);
    if (duplicate && !confirmDuplicate()) return false;
    await session.mutate('/api/record', { type: 'payments', mode: 'create', record });
    return true;
  }

  async function updatePayment(previous: Payment, values: PaymentFormValues) {
    const record = buildPaymentRecord(previous, previous.id, values);
    await session.mutate('/api/record', { type: 'payments', mode: 'update', record });
  }

  async function deletePayment(id: string) {
    await session.mutate('/api/record-delete', { type: 'payments', id });
  }

  async function deleteManyForever(ids: string[]) {
    await session.mutate('/api/record-delete', { type: 'payments', ids });
  }

  const actions = {
    search,
    setSearch,
    childId,
    setChildId,
    method,
    setMethod,
    service,
    setService,
    groupFilter,
    setGroupFilter,
    periodPreset,
    setPeriodPreset,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    archiveFilter,
    setArchiveFilter,
    resetUrlFilters,
    sort,
    setSort,
    archivePayment,
    unarchivePayment,
    archiveMany,
    unarchiveMany,
    createPayment,
    updatePayment,
    deletePayment,
    deleteManyForever,
  };

  if (!ready) {
    return {
      status,
      failureMessage,
      records,
      rows: [],
      summary: EMPTY_SUMMARY,
      groups: [],
      services: [],
      ...actions,
    };
  }

  function paymentGroupId(payment: Payment): string | null {
    const child = payment.childId ? records.children.find(c => c.id === payment.childId) : undefined;
    return child?.groupId ?? null;
  }

  function matchesGroupFilter(payment: Payment): boolean {
    if (groupFilter === 'all') return true;
    const paymentGroup = paymentGroupId(payment);
    return groupFilter === 'none' ? !paymentGroup : paymentGroup === groupFilter;
  }

  const normalizedSearch = normalizeSearchText(search);

  function matchesFilters(payment: Payment, includeMethod: boolean): boolean {
    return (
      (archiveFilter === 'all' || (archiveFilter === 'archived' ? payment.archived : !payment.archived)) &&
      (!periodFrom || payment.date >= periodFrom) &&
      (!periodTo || payment.date <= periodTo) &&
      (!childId || payment.childId === childId) &&
      (!includeMethod ||
        !method ||
        paymentTenders(payment).some((tender: PaymentTender) => tender.method === method)) &&
      // Spre deosebire de Metodă (exclus din sumar, ca toate cele 3 carduri să rămână
      // vizibile deodată), Serviciu filtrează și cardurile Cash/Card/Transfer (05-achitari.md §B3).
      (!service || (payment.service || DEFAULT_SERVICE_ID) === service) &&
      matchesGroupFilter(payment) &&
      matchesRecordListSearch('payments', payment, records, normalizedSearch)
    );
  }

  const filteredPayments = records.payments.filter(payment => matchesFilters(payment, true));
  const paymentsForSummary = records.payments.filter(payment => matchesFilters(payment, false));

  const rows = filteredPayments.map(payment => buildRow(payment, records));
  const byMethod = summarizePaymentsByMethod(paymentsForSummary);
  const groups = sortByGroupOrder(records.groups);
  const services = visibleServices(records.services);

  return {
    status: 'ready',
    failureMessage: '',
    records,
    rows,
    groups,
    services,
    summary: {
      count: rows.length,
      total: total(filteredPayments),
      cash: byMethod.Cash,
      card: byMethod.Card,
      transfer: byMethod.Transfer,
      cashCount: countByMethod(paymentsForSummary, 'Cash'),
      cardCount: countByMethod(paymentsForSummary, 'Card'),
      transferCount: countByMethod(paymentsForSummary, 'Transfer'),
    },
    ...actions,
  };
}
