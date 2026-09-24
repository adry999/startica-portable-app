import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Child, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

const MAX_RESULTS_PER_GROUP = 5;

export interface ChildSearchResult {
  type: 'children';
  id: string;
  label: string;
  detail: string;
}

export interface PaymentSearchResult {
  type: 'payments';
  id: string;
  label: string;
  detail: string;
}

export type SearchResult = ChildSearchResult | PaymentSearchResult;

function childLabel(child: Child): string {
  return `Contract ${contractNumberOf(child)} · ${child.parent || 'fără părinte'}`;
}

function paymentLabel(payment: Payment, children: Child[]): { label: string; detail: string } {
  const child = children.find(c => c.id === payment.childId);
  return {
    label: child?.name || payment.sourceName || payment.childName || 'Achitare neasociată',
    detail: `${formatDate(payment.date)} · ${formatMoney(payment.amount)}`,
  };
}

/** Căutarea globală din topbar: copii (nume/contract/părinte) + achitări (nume din sursă sau al copilului asociat). */
export function searchRecords(records: RecordsSnapshot, query: string): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return [];

  const children: ChildSearchResult[] = records.children
    .filter((child: Child) => !child.archived)
    .filter((child: Child) =>
      normalizeSearchText(`${child.name} ${child.parent} ${contractNumberOf(child)}`).includes(normalizedQuery),
    )
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map((child: Child) => ({ type: 'children', id: child.id, label: child.name, detail: childLabel(child) }));

  const payments: PaymentSearchResult[] = records.payments
    .filter((payment: Payment) => !payment.archived)
    .filter((payment: Payment) => {
      const child = records.children.find((c: Child) => c.id === payment.childId);
      return normalizeSearchText(
        `${payment.sourceName ?? ''} ${payment.childName ?? ''} ${child?.name ?? ''}`,
      ).includes(normalizedQuery);
    })
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map((payment: Payment) => {
      const { label, detail } = paymentLabel(payment, records.children);
      return { type: 'payments', id: payment.id, label, detail };
    });

  return [...children, ...payments];
}
