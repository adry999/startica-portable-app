import { matchesPhoneSuffixAny, normalizeMoldovanPhone, phoneQueryDigits } from '#shared/domain/phone-number.mjs';
import { arrears, feeEntryFor, obligation } from '#shared/domain/tuition-obligation.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { formatMonthAbbrev } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

/** 44a: cel mult atâtea potriviri directe (fără frați) — fiecare poate adăuga rânduri suplimentare. */
const MAX_PRIMARY_RESULTS = 5;

export interface QuickPayResultRow {
  childId: string;
  name: string;
  /** Frații apar sub copilul găsit (același telefon de părinte) — 44a. */
  isSibling: boolean;
  /** „Neptun · 500 lei" sau, pt. frate, „Marte · frate · 250 lei". */
  subtitle: string;
  statusLabel: string;
  statusTone: 'overdue' | 'ok';
  /** „Oct: 9.845,00 lei" — taxa așteptată a lunii curente (nu restul), ca în mockup (44a). */
  currentMonthLabel: string;
}

/** Cheia de comparare a două telefoane — normalizat E.164 pentru un mobil moldovenesc valid,
 * altfel textul brut (un „alt număr" se salvează exact cum a fost scris, §10). */
function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizeMoldovanPhone(raw) ?? raw.trim();
}

/** Copiii cu același telefon de părinte (1 sau 2) ca `child`, fără copilul însuși și fără arhivați. */
export function siblingsOf(child: Child, children: Child[]): Child[] {
  const keys = new Set([phoneKey(child.phone), phoneKey(child.phone2)].filter((k): k is string => k !== null));
  if (keys.size === 0) return [];
  return children.filter(
    candidate =>
      candidate.id !== child.id &&
      !candidate.archived &&
      (keys.has(phoneKey(candidate.phone) ?? '') || keys.has(phoneKey(candidate.phone2) ?? '')),
  );
}

function buildRow(
  child: Child,
  records: RecordsSnapshot,
  month: string,
  asOf: string,
  isSibling: boolean,
): QuickPayResultRow {
  const groupLabel = records.groups.find(group => group.id === child.groupId)?.name ?? 'Fără grupă';
  const feeEntry = feeEntryFor(child, month);
  const feeLabel = feeEntry ? formatMoney(feeEntry.amount, feeEntry.currency) : null;
  const subtitle = [groupLabel, isSibling ? 'frate' : null, feeLabel].filter(Boolean).join(' · ');

  const childArrears = arrears(child, records.payments, records.charges ?? [], month, asOf);
  const info = obligation(child, month, records.payments, records.charges ?? [], asOf);
  const oldestArrear = childArrears[0];
  const statusTone: 'overdue' | 'ok' = oldestArrear ? 'overdue' : 'ok';
  const statusLabel = oldestArrear
    ? `Restanță ${formatMonthAbbrev(oldestArrear.month)} · ${formatMoney(oldestArrear.rest, oldestArrear.currency)}`
    : 'La zi';
  const currentMonthLabel =
    info.expected != null ? `${formatMonthAbbrev(month)}: ${formatMoney(info.expected, info.currency)}` : '—';

  return { childId: child.id, name: child.name, isSibling, subtitle, statusLabel, statusTone, currentMonthLabel };
}

/**
 * 44a: încasare rapidă — caută după nume, telefon părinte (sufix, §10) sau nr. contract, printre
 * copiii activi. Fiecare potrivire directă aduce și frații ei (același telefon de părinte) imediat
 * sub ea, ca în mockup. `asOf` doar pentru teste — implicit azi.
 */
export function quickPaySearchResults(records: RecordsSnapshot, query: string, asOf = todayFn()): QuickPayResultRow[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return [];
  const month = asOf.slice(0, 7);
  const phoneDigits = phoneQueryDigits(normalizedQuery);

  const primaryMatches = records.children
    .filter(child => !child.archived)
    .filter(child => {
      const textMatch = normalizeSearchText(`${child.name} ${contractNumberOf(child)}`).includes(normalizedQuery);
      if (textMatch) return true;
      return phoneDigits !== null && matchesPhoneSuffixAny(child, phoneDigits);
    })
    .slice(0, MAX_PRIMARY_RESULTS);

  const rows: QuickPayResultRow[] = [];
  const seen = new Set<string>();
  for (const child of primaryMatches) {
    if (seen.has(child.id)) continue;
    seen.add(child.id);
    rows.push(buildRow(child, records, month, asOf, false));
    for (const sibling of siblingsOf(child, records.children)) {
      if (seen.has(sibling.id)) continue;
      seen.add(sibling.id);
      rows.push(buildRow(sibling, records, month, asOf, true));
    }
  }
  return rows;
}
