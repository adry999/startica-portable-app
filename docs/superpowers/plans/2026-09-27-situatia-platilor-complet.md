# Situația plăților — ecranul complet (Lună / An școlar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `webapp/src/features/status/` from a flat table into the two-mode screen in `docs/design/screens/07-situatia.md`: **Lună** (4 summary cards over the whole month + a status/search toolbar + the spec's column set + the „N restanțieri" banner) and **An școlar** (3 cards + a copil × 12 luni heat-map with a Sold column), behind one compact header shared by both modes. SMS sending is **not** built here — see *Out of scope*.

**Architecture:** The screen keeps the existing split: a pure-domain evaluation in `src/features/billing/domain/` (already `evaluateChildrenForMonth`), a thin React hook per mode in `webapp/src/features/status/` that owns filter state and maps evaluations to view rows, and a page that only renders. Two additions in the domain layer: (1) `school-year-evaluation.mjs` — evaluates every child for the 12 months of a school year with **one** `paymentIndex`, reusing `obligation()` unchanged; (2) `status-summary.mjs` — the card math and heat-map cell classification, so both hooks stay orchestration-only and the rules are tested with `node --test` like `cash-summary.mjs`. Money aggregated across children converts EUR → MDL at the latest known rate (the „≈ lei azi" projection from `16-planuri-eur.md` rule 9), exactly the way `cash-summary.mjs` already handles Dashboard totals; per-row cells stay in the child's own currency. The header follows the `useTopbarActions` pattern (Grupe, Vizite, Zile de naștere): the page pushes `[Lună | An școlar] · MonthPicker | Anul școlar ▾ · Tipărește` into the Topbar slot in both modes, so there is no second header in the content (spec acceptance criterion 1).

**Tech Stack:** Domain: Node 22 vanilla ESM, `node --test`. UI: `webapp/` React 19 + Vite + TypeScript + Vitest/RTL; components from `@shared/ui` (`Card`, `SegmentedControl`, `FilterPills`, `DataTable`, `Badge`, `MonthPicker`, `useTopbarActions`), tokens from `webapp/src/shared/tokens/tokens.css`.

**Spec:** `docs/design/screens/07-situatia.md` (§2–§5), `docs/design/screens/00-comun.md` (A, B, D, E), `docs/design/RASPUNSURI.md` §„Situația plăților", `docs/design/Situatia.dc.html#1m` / `#1n` (visual reference only — spec wins on conflict).

## Starting point (already shipped on `master-v2`, do not re-plan)

- `webapp/src/features/status/useStatus.ts` — `evaluateChildrenForMonth(records, month, todayStr)` → `StatusRowView[]` (`id, contract, name, archived, groupId, groupName, expected, paid, rest, credit, due, label`), `groupFilter` state, returns only the **filtered** `rows` (an `allRows` local exists but is not exposed).
- `webapp/src/features/status/StatusPage.tsx` — period line + „Tipărește raportul" button in content, a long explanatory `.notice`, `FilterPills` Grupă (queue point 7, done), a `DataTable` with columns Contract · Copil · Taxă · Achitat · Rest · Credit · Scadență · Situație.
- Domain: `obligation()` (`src/shared/domain/tuition-obligation.mjs`) is currency-aware and returns `{ expected, paid, rest, credit, due, label, notify, daysToDue }` in the **child's fee currency** — but does not return which currency that is. `label` ∈ `'De verificat' | 'Fără obligație' | 'Plătit' | 'Restanță' | 'Plată parțială' | 'Scadent în curând' | 'Nescadent'`.
- Server: `GET /api/exchange-rates` → `{ rates: Record<'YYYY-MM-DD', number>, sources }` (commit `d18f9fc`). **Nothing in `webapp/` reads it yet** — queue point 8's UI („Curs valutar") is a separate session.
- Routing: `App.tsx` renders `<StatusPage month={month} />`; `Topbar.tsx` shows `MonthPicker` **only** for `view === 'dashboard'`.

## Out of scope (explicit)

- **SMS.** Spec §3's „Notifică" (row CTA → `#2a`) and „Notifică toți" (banner → `#2b`) and §4's „Notifică" on the restanțe card are **SMS P2** per `docs/superpowers/specs/2026-09-26-sms-notify-design.md` §10.12 („P2: dialogurile 2a/2b în Situația plăților — depinde de ecranul 07"). At the time of writing, `docs/superpowers/plans/2026-09-27-sms-notify-p1.md` does not exist yet and P1 by definition ships only „Trimite SMS" from De notificat, so no bulk-send UI or `SmsConfirmDialog` can be assumed. This plan renders those three buttons **visually per spec but `disabled`**, with a `title` explaining why; the wiring is a later plan (see *Handoff to SMS P2* at the end). No fake dialog, no navigation stand-in.
- **7c „€ cu echivalentul lei dedesubt"** (`16-planuri-eur.md`) — the second „≈ lei" line under EUR cells is queue point 8 UI. This plan shows each row in its own currency via `formatMoney(value, row.currency)` and leaves the ≈ line to point 8.
- The `SmsConfirmDialog.tsx` file named in spec §1 — created by SMS P2, not here.

## Global Constraints

- **Cards and counters are always over the whole month, unaffected by any filter** (group pills, status segment, search) — `RASPUNSURI.md`: „filtrul restrânge doar tabelul, iar cardurile de sus rămân mereu pe toată luna, la fel ca la Achitări". Same rule for the An școlar cards vs. the heat-map search.
- **One population for table, cards and counters:** all children in the snapshot, including archived (the existing behavior and test „include toți copiii, inclusiv arhivați" stay). Archived children with a withdrawal date evaluate to `'Fără obligație'` and therefore contribute nothing to sums; an archived child *without* a withdrawal date and with a rest is a data problem the operator must see, which is why they are not hidden. `'De verificat'` rows (`expected === null`) never enter a sum.
- **Currency:** a single child's row shows amounts in that child's fee currency (`obligation().currency`, Task 1). Sums across children are in MDL: EUR amounts convert at `latestKnownRate(rates)` (projection „cât ar costa azi", `16-planuri-eur.md` rule 9); with no rate known at all they enter 1:1 — the same fallback `cash-summary.mjs#toMdl` uses for Dashboard KPIs, because a card must always show a number. Rates come from the read-only client hook in Task 2.
- **`obligation()` semantics do not change.** The only domain edit outside `src/features/billing/` is the additive `currency` field on its return value (Task 1).
- **One `paymentIndex` per evaluation.** The school-year evaluation builds the index once and calls `obligation()` 12× per child; it never calls `evaluateChildrenForMonth` 12× (that would rebuild the index 12×).
- **Module boundaries:** `webapp/src/features/status/` imports only `@shared/*`, `#shared/*`, `#features/billing/index.web.mjs`, `#features/fee-setup/index.web.mjs`, `@domain/*`, `@contracts/*`. Never `@features/*` or `@app/*` (`webapp/src/architecture.test.ts` fails otherwise).
- **Design:** only `@shared/ui` components and `tokens.css` variables. Exactly two new tokens are allowed (Task 9: `--sand: #f1ece2`, `--sand-soft: #faf7f1`, both hex values dictated by spec §4); no other hex literal. Big numbers are `var(--slate)`, ink colors only on labels/links, zero values are `--subtle` with no CTA (`.claude/skills/project-conventions/DESIGN.md`).
- **Mode persistence key:** `usePersistedState('view.status', 'month')` per `00-comun.md` §D (`ExpensesPage` uses `view.expenses`; the `payments.viewMode` key in `PaymentsPage` predates the rule — do not copy it).
- **Tests before commit, every task:** domain → `npm test` at repo root; webapp → `cd webapp && npm run typecheck && npm test`. `npm run check` at the end of each phase.
- Commit messages: Conventional Commits, `type(scope): subject`, scopes `shared`, `billing`, `status`, `app`, `docs`.

---

## Phase 0 — Seams (domain currency + client rates)

### Task 1: `obligation()` returns the currency it computed in

**Files:**
- Modify: `src/shared/domain/tuition-obligation.mjs`
- Modify: `src/shared/domain/tuition-obligation.test.mjs`

**Interfaces:**
- Produces: `obligation(...)` return gains `currency: Currency` (`'MDL' | 'EUR'`) — the fee currency in force for that month (`feeEntry.currency ?? 'MDL'`). Additive; `ChildObligation` in `month-evaluation.mjs` is `ReturnType<typeof obligation>`, so it flows to `evaluateChildrenForMonth` without edits. This is what the multi-currency plan's Task 17 intended and never landed on `master-v2`.

- [ ] **Step 1: Write the failing tests**

Append to `src/shared/domain/tuition-obligation.test.mjs` (fixtures `child()` / `payment()` already exist at the top; `normalizeRecord` is imported):

```javascript
test('obligation expune moneda taxei: MDL implicit pentru fișele vechi', () => {
  assert.equal(obligation(child(), '2026-09', [payment()], '2026-09-30').currency, 'MDL');
});

test('obligation expune moneda taxei: EUR când intrarea din feeHistory e în EUR', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  assert.equal(obligation(eurChild, '2026-09', [], '2026-09-30').currency, 'EUR');
});

test('obligation: moneda urmează intrarea din feeHistory valabilă în luna cerută, nu pe cea mai nouă', () => {
  const switchedChild = normalizeRecord('children', {
    id: 'C-SW',
    name: 'Ana',
    status: 'Activ',
    attendanceDate: '2026-01-01',
    feeHistory: [
      { from: '2026-01', amount: 2000 },
      { from: '2026-09', amount: 100, currency: 'EUR' },
    ],
  });
  assert.equal(obligation(switchedChild, '2026-08', [], '2026-09-30').currency, 'MDL');
  assert.equal(obligation(switchedChild, '2026-09', [], '2026-09-30').currency, 'EUR');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/tuition-obligation.test.mjs`
Expected: FAIL — `.currency` is `undefined` on all three.

- [ ] **Step 3: Implement**

In `src/shared/domain/tuition-obligation.mjs`, change the last line of `obligation`:

```javascript
  return { expected, paid, rest, credit, due, label, notify, daysToDue, currency: feeCurrency };
```

`feeCurrency` already exists a few lines above (`const feeCurrency = feeEntry?.currency ?? 'MDL';`). No other change.

- [ ] **Step 4: Run to verify pass, then the whole suite**

Run: `node --test src/shared/domain/tuition-obligation.test.mjs` → PASS.
Run: `npm test` → PASS. (No existing test does a `deepEqual` on the full `obligation()` object — verified with grep; if one appears, add `currency` to the expected object rather than loosening the assertion.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/tuition-obligation.mjs src/shared/domain/tuition-obligation.test.mjs
git commit -m "feat(shared): obligation() exposes the fee currency it computed in"
```

---

### Task 2: Read-only exchange-rates hook for `webapp/`

> **Check first.** Queue point 8's UI session (ecranul „Curs valutar") may already have added a hook for `/api/exchange-rates` under `webapp/src/shared/api/`. Run `Glob webapp/src/**/*xchange*`. If a hook exists that returns the rates map, reuse it and skip this task — the only contract the rest of this plan needs is `useExchangeRates(): Record<string, number>`. If it exists under a different name, adapt the imports in Tasks 5–6, don't add a second store.

**Files:**
- Create: `webapp/src/shared/api/exchange-rates.ts`
- Test: `webapp/src/shared/api/exchange-rates.test.ts`

**Interfaces:**
- Consumes: `requestJson` from `webapp/src/shared/api/session.ts` (GET when called without a body); `clampExchangeRates` from `#shared/domain/exchange-rates.mjs`.
- Produces: `useExchangeRates(): ExchangeRates` (`Record<string, number>`), a module-level singleton store (same shape as `session.ts`: `useSyncExternalStore` + listeners), loaded once on first use, `{}` until then and on failure. Read-only: saving/refresh belong to the „Curs valutar" screen (point 8).

- [ ] **Step 1: Write the failing test**

Create `webapp/src/shared/api/exchange-rates.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('useExchangeRates', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pornește cu harta goală și se umple cu cursurile de la server, curățate de intrări stricate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/exchange-rates')
          return jsonResponse({ rates: { '2026-09-25': 19.62, bad: 'x' }, sources: { '2026-09-25': 'bnm' } });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const { useExchangeRates } = await import('./exchange-rates');

    const { result } = renderHook(() => useExchangeRates());

    expect(result.current).toEqual({});
    await waitFor(() => expect(result.current).toEqual({ '2026-09-25': 19.62 }));
  });

  it('o cerere eșuată lasă harta goală, fără să arunce în componentă', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const { useExchangeRates } = await import('./exchange-rates');

    const { result } = renderHook(() => useExchangeRates());

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npx vitest run src/shared/api/exchange-rates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `webapp/src/shared/api/exchange-rates.ts`:

```typescript
import { useEffect, useSyncExternalStore } from 'react';
import { clampExchangeRates } from '#shared/domain/exchange-rates.mjs';
import { requestJson } from './session';

/** Cheie YYYY-MM-DD → câte lei face 1 EUR (vezi #shared/domain/exchange-rates.mjs). */
export type ExchangeRates = Record<string, number>;

type Listener = () => void;
const listeners = new Set<Listener>();
let rates: ExchangeRates = {};
let requested = false;

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readRates() {
  return rates;
}

function loadOnce() {
  if (requested) return;
  requested = true;
  requestJson('/api/exchange-rates')
    .then((response: { rates?: unknown }) => {
      rates = clampExchangeRates(response.rates);
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Fără curs, sumele în EUR intră 1:1 în agregate (vezi status-summary.mjs); ecranul nu se blochează.
      requested = false;
    });
}

/** Cursurile EUR→MDL, citite o singură dată per sesiune și partajate de toate ecranele care agregă bani. */
export function useExchangeRates(): ExchangeRates {
  useEffect(loadOnce, []);
  return useSyncExternalStore(subscribe, readRates, readRates);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd webapp && npx vitest run src/shared/api/exchange-rates.test.ts` → PASS.
Run: `cd webapp && npm run typecheck` → PASS. If `tsc` complains about the `.mjs` import's parameter type, the existing `@domain/*`/`#shared/*` aliases in `webapp/tsconfig.json` already resolve JSDoc'd `.mjs` modules (see `useStatus.ts`) — cast the `response` as shown rather than adding a new alias.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/shared/api/exchange-rates.ts webapp/src/shared/api/exchange-rates.test.ts
git commit -m "feat(app): read-only useExchangeRates hook over GET /api/exchange-rates"
```

---

## Phase 1 — Domain (billing, pure, TDD)

### Task 3: School-year calendar + one-pass evaluation

**Files:**
- Create: `src/features/billing/domain/school-year-evaluation.mjs`
- Test: `src/features/billing/domain/school-year-evaluation.test.mjs`
- Modify: `src/features/billing/index.web.mjs`

**Interfaces:**
- Consumes: `paymentIndex` (`#shared/domain/payment-allocations.mjs`), `obligation` (`#shared/domain/tuition-obligation.mjs`), `today` (`#shared/domain/calendar-month.mjs`).
- Produces:
  - `SCHOOL_YEAR_START_MONTH = 9` — the school year starts in September (`docs/design/Administrare.dc.html`: „An școlar — începe în septembrie"). Note: `Situatia.dc.html#1n` draws Oct…Sep; that is a mockup artifact, spec §4 only says „12 coloane de lună" — we go Sep→Aug.
  - `schoolYearStartOf(monthKey: 'YYYY-MM') → number` (start year: `'2026-09'` → 2026, `'2026-08'` → 2025).
  - `schoolYearMonths(startYear) → string[12]` (`['2026-09', …, '2027-08']`).
  - `schoolYearLabel(startYear) → 'Anul școlar 2026–2027'` (en dash, as in spec §2).
  - `evaluateChildrenForSchoolYear(records, startYear, asOf = today(), rates = {}) → { child, months: { month, obligation }[12] }[]` — same population as `evaluateChildrenForMonth` (all children), one `paymentIndex(records.payments, asOf)` for all 12 × N `obligation()` calls.

- [ ] **Step 1: Write the failing tests**

Create `src/features/billing/domain/school-year-evaluation.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import {
  schoolYearStartOf,
  schoolYearMonths,
  schoolYearLabel,
  evaluateChildrenForSchoolYear,
} from './school-year-evaluation.mjs';

const child = (overrides = {}) =>
  normalizeRecord('children', {
    id: 'C-1',
    name: 'Copil Test',
    status: 'Activ',
    attendanceDate: '2026-01-10',
    feeHistory: [{ from: '2026-01', amount: 1000 }],
    ...overrides,
  });

test('schoolYearStartOf: septembrie deschide anul școlar, august îl închide', () => {
  assert.equal(schoolYearStartOf('2026-09'), 2026);
  assert.equal(schoolYearStartOf('2027-08'), 2026);
  assert.equal(schoolYearStartOf('2026-08'), 2025);
});

test('schoolYearMonths: 12 luni, din septembrie în august, cu trecerea de an', () => {
  const months = schoolYearMonths(2026);
  assert.equal(months.length, 12);
  assert.equal(months[0], '2026-09');
  assert.equal(months[3], '2026-12');
  assert.equal(months[4], '2027-01');
  assert.equal(months[11], '2027-08');
});

test('schoolYearLabel folosește linia de dialog, ca în antetul din spec', () => {
  assert.equal(schoolYearLabel(2025), 'Anul școlar 2025–2026');
});

test('evaluateChildrenForSchoolYear întoarce 12 obligații per copil, în ordinea lunilor', () => {
  const records = /** @type {any} */ ({ children: [child()], payments: [] });
  const [row] = evaluateChildrenForSchoolYear(records, 2026, '2026-09-27');
  assert.equal(row.child.id, 'C-1');
  assert.deepEqual(
    row.months.map(m => m.month),
    schoolYearMonths(2026),
  );
  assert.equal(row.months[0].obligation.expected, 1000);
});

test('evaluateChildrenForSchoolYear vede achitările la luna lor și ignoră plățile de după asOf', () => {
  const payments = [
    normalizeRecord('payments', {
      id: 'P-1',
      childId: 'C-1',
      date: '2026-10-05',
      amount: 1000,
      method: 'Cash',
      allocations: [{ month: '2026-10', amount: 1000 }],
    }),
    normalizeRecord('payments', {
      id: 'P-2',
      childId: 'C-1',
      date: '2026-12-01',
      amount: 1000,
      method: 'Cash',
      allocations: [{ month: '2026-11', amount: 1000 }],
    }),
  ];
  const records = /** @type {any} */ ({ children: [child()], payments });
  const [row] = evaluateChildrenForSchoolYear(records, 2026, '2026-11-15');
  assert.equal(row.months[1].obligation.label, 'Plătit'); // 2026-10
  assert.equal(row.months[2].obligation.paid, 0); // 2026-11: plata din decembrie e după asOf
});

test('evaluateChildrenForSchoolYear include toți copiii, arhivați inclusiv', () => {
  const records = /** @type {any} */ ({ children: [child(), child({ id: 'C-2', archived: true })], payments: [] });
  assert.deepEqual(
    evaluateChildrenForSchoolYear(records, 2026, '2026-09-27').map(r => r.child.id),
    ['C-1', 'C-2'],
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/billing/domain/school-year-evaluation.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/billing/domain/school-year-evaluation.mjs`:

```javascript
import { today } from '#shared/domain/calendar-month.mjs';
import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {import('./month-evaluation.mjs').ChildObligation} ChildObligation */
/** @typedef {{ child: Child, months: { month: string, obligation: ChildObligation }[] }} ChildSchoolYearEvaluation */

// Anul școlar începe în septembrie (Backup și setări → Grădinița, „An școlar: începe în septembrie").
export const SCHOOL_YEAR_START_MONTH = 9;

/** @param {string} monthKey YYYY-MM */
export function schoolYearStartOf(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return month >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
}

/** @param {number} startYear */
export function schoolYearMonths(startYear) {
  return Array.from({ length: 12 }, (_, index) => {
    const offset = SCHOOL_YEAR_START_MONTH - 1 + index;
    return `${startYear + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
  });
}

/** @param {number} startYear */
export const schoolYearLabel = startYear => `Anul școlar ${startYear}–${startYear + 1}`;

// Harta anului școlar are nevoie de fiecare copil pe fiecare din cele 12 luni.
// Indexul de încasări se construiește o singură dată aici — 12 apeluri de
// evaluateChildrenForMonth l-ar reconstrui de 12 ori.
/**
 * @param {RecordsSnapshot} records
 * @param {number} startYear
 * @param {string} [asOf]
 * @param {ExchangeRates} [rates]
 * @returns {ChildSchoolYearEvaluation[]}
 */
export function evaluateChildrenForSchoolYear(records, startYear, asOf = today(), rates = {}) {
  const months = schoolYearMonths(startYear);
  const index = paymentIndex(records.payments, asOf);
  return records.children.map(child => ({
    child,
    months: months.map(month => ({
      month,
      obligation: obligation(child, month, records.payments, asOf, index, rates),
    })),
  }));
}
```

Add to `src/features/billing/index.web.mjs`:

```javascript
export {
  schoolYearStartOf,
  schoolYearMonths,
  schoolYearLabel,
  evaluateChildrenForSchoolYear,
} from './domain/school-year-evaluation.mjs';
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/billing/domain/school-year-evaluation.test.mjs` → PASS (6 tests).
Run: `node --test tests/architecture/import-boundaries.test.mjs` → PASS (billing still imports only `#shared`).

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/domain/school-year-evaluation.mjs src/features/billing/domain/school-year-evaluation.test.mjs src/features/billing/index.web.mjs
git commit -m "feat(billing): school-year calendar and one-pass 12-month evaluation"
```

---

### Task 4: Card math and heat-map cell classification

**Files:**
- Create: `src/features/billing/domain/status-summary.mjs`
- Test: `src/features/billing/domain/status-summary.test.mjs`
- Modify: `src/features/billing/index.web.mjs`, `src/features/billing/README.md`

**Interfaces:**
- Consumes: `cents` (`#shared/domain/money.mjs`), `latestKnownRate`, `convertAmount` (`#shared/domain/exchange-rates.mjs`); the `ChildMonthEvaluation` / `ChildSchoolYearEvaluation` shapes.
- Produces:
  - `toMdlToday(amount, currency, rates) → number` — MDL unchanged; EUR × `latestKnownRate`, or 1:1 when no rate exists (the `cash-summary.mjs#toMdl` fallback, cited in its comment).
  - `summarizeMonthStatus(evaluations, rates = {}) → MonthStatusSummary`:
    `{ expected, paid, paidShare, owingChildren, overdueChildren, overdue }` — all money in MDL; `paidShare` ∈ [0, 1] for the Încasat bar; `owingChildren` = rows with `expected > 0` (the „N copii activi" subtitle); `overdueChildren`/`overdue` = rows with `label === 'Restanță'` and their `rest`. Rows with `expected === null` are skipped.
  - `heatCellKind(obligation, asOf) → 'paid' | 'partial' | 'unpaid' | 'upcoming' | 'none'`:
    `none` when `expected` is `null` or `0` (De verificat, Fără obligație — before contract, after withdrawal, suspended: spec §4 gives the same neutral cell to all of them); `paid` when `rest === 0`; `partial` when `paid > 0`; otherwise `unpaid` if `asOf > due` else `upcoming`. Note `'Restanță'` with a partial payment maps to `partial` (yellow), matching the mockup's „Avram Maria" row.
  - `summarizeSchoolYear(yearEvaluations, asOf, referenceMonth, rates = {}) → SchoolYearSummary`:
    `{ rows: { child, cells: { month, kind }[12], sold: { amount, currency }, hasObligation }[], overdueChildren, unrecovered, collectionRate, partialThisMonth }`.
    `sold` = Σ `rest` over months with `asOf > due` and `rest > 0`, in the child's currency when all those months share one, else converted to MDL (a fee currency can change mid-year through `feeHistory`; that is the only case a per-child figure converts). `hasObligation` = some cell ≠ `none` (the hook hides rows that are fully outside the contract). `unrecovered` = Σ `toMdlToday(sold)`; `overdueChildren` = rows with `sold.amount > 0`; `collectionRate` = Σ paid / Σ expected over months with `due <= asOf` (spec: „pe anul școlar, până azi"), `null` when nothing was due yet; `partialThisMonth` = rows whose cell for `referenceMonth` is `partial` (spec card 3: „luna aceasta").

- [ ] **Step 1: Write the failing tests**

Create `src/features/billing/domain/status-summary.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { evaluateChildrenForMonth } from './month-evaluation.mjs';
import { evaluateChildrenForSchoolYear } from './school-year-evaluation.mjs';
import { toMdlToday, summarizeMonthStatus, heatCellKind, summarizeSchoolYear } from './status-summary.mjs';

const child = (overrides = {}) =>
  normalizeRecord('children', {
    id: 'C-1',
    name: 'Copil Test',
    status: 'Activ',
    attendanceDate: '2026-01-10',
    contractDate: '2026-01-10',
    feeHistory: [{ from: '2026-01', amount: 1000 }],
    ...overrides,
  });

const payment = (overrides = {}) =>
  normalizeRecord('payments', {
    id: 'P-1',
    childId: 'C-1',
    date: '2026-09-05',
    amount: 400,
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 400 }],
    ...overrides,
  });

test('toMdlToday: lei neschimbat, EUR la cel mai recent curs, 1:1 fără niciun curs', () => {
  assert.equal(toMdlToday(100, 'MDL', { '2026-09-01': 20 }), 100);
  assert.equal(toMdlToday(100, 'EUR', { '2026-08-01': 19, '2026-09-01': 20 }), 2000);
  assert.equal(toMdlToday(100, 'EUR', {}), 100);
});

test('summarizeMonthStatus: de încasat, încasat, restanțe și numărul copiilor cu taxă, pe toată luna', () => {
  const records = /** @type {any} */ ({
    children: [
      child(), // restanță 600 (scadent pe 10, asOf 27)
      child({ id: 'C-2', feeHistory: [{ from: '2026-01', amount: 500 }] }), // restanță 500
      child({ id: 'C-3', feeHistory: [] }), // De verificat — nu intră
      child({ id: 'C-4', withdrawalDate: '2026-06-30', status: 'Retras' }), // Fără obligație
    ],
    payments: [payment()],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'));
  assert.equal(summary.expected, 1500);
  assert.equal(summary.paid, 400);
  assert.equal(summary.paidShare, 400 / 1500);
  assert.equal(summary.owingChildren, 2);
  assert.equal(summary.overdueChildren, 2);
  assert.equal(summary.overdue, 1100);
});

test('summarizeMonthStatus convertește copiii cu taxă EUR la cursul cel mai recent', () => {
  const records = /** @type {any} */ ({
    children: [child({ feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] })],
    payments: [],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'), {
    '2026-09-25': 20,
  });
  assert.equal(summary.expected, 2000);
  assert.equal(summary.overdue, 2000);
});

test('summarizeMonthStatus: bara Încasat se oprește la 100% când s-a plătit peste taxă', () => {
  const records = /** @type {any} */ ({
    children: [child()],
    payments: [payment({ amount: 1200, allocations: [{ month: '2026-09', amount: 1200 }] })],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'));
  assert.equal(summary.paidShare, 1);
});

test('heatCellKind clasifică o lună după rest, achitat și scadență', () => {
  const base = { expected: 1000, due: '2026-09-10', currency: 'MDL' };
  assert.equal(heatCellKind({ ...base, paid: 1000, rest: 0 }, '2026-09-27'), 'paid');
  assert.equal(heatCellKind({ ...base, paid: 300, rest: 700 }, '2026-09-27'), 'partial');
  assert.equal(heatCellKind({ ...base, paid: 0, rest: 1000 }, '2026-09-27'), 'unpaid');
  assert.equal(heatCellKind({ ...base, paid: 0, rest: 1000 }, '2026-09-03'), 'upcoming');
  assert.equal(heatCellKind({ ...base, expected: 0, paid: 0, rest: 0 }, '2026-09-27'), 'none');
  assert.equal(heatCellKind({ ...base, expected: null, paid: null, rest: null }, '2026-09-27'), 'none');
});

test('summarizeSchoolYear: sold = restanțele scadente, celule pe luni, rata de încasare până azi', () => {
  const records = /** @type {any} */ ({
    children: [child({ attendanceDate: '2026-10-01', contractDate: '2026-10-01', feeHistory: [{ from: '2026-10', amount: 1000 }] })],
    payments: [payment({ date: '2026-10-03', allocations: [{ month: '2026-10', amount: 400 }] })],
  });
  const year = evaluateChildrenForSchoolYear(records, 2026, '2026-12-15');
  const summary = summarizeSchoolYear(year, '2026-12-15', '2026-12');
  const [row] = summary.rows;
  assert.equal(row.hasObligation, true);
  assert.equal(row.cells[0].kind, 'none'); // 2026-09, înainte de contract
  assert.equal(row.cells[1].kind, 'partial'); // 2026-10
  assert.equal(row.cells[2].kind, 'unpaid'); // 2026-11
  assert.equal(row.cells[3].kind, 'unpaid'); // 2026-12, scadent pe 1, asOf 15
  assert.equal(row.cells[4].kind, 'upcoming'); // 2027-01
  assert.deepEqual(row.sold, { amount: 2600, currency: 'MDL' });
  assert.equal(summary.overdueChildren, 1);
  assert.equal(summary.unrecovered, 2600);
  assert.equal(summary.collectionRate, 400 / 3000);
  assert.equal(summary.partialThisMonth, 0);
});

test('summarizeSchoolYear: un copil complet în afara anului nu are obligație, rata e null fără scadențe', () => {
  const records = /** @type {any} */ ({
    children: [child({ attendanceDate: '2027-09-01', contractDate: '2027-09-01', feeHistory: [{ from: '2027-09', amount: 1000 }] })],
    payments: [],
  });
  const summary = summarizeSchoolYear(evaluateChildrenForSchoolYear(records, 2026, '2026-09-27'), '2026-09-27', '2026-09');
  assert.equal(summary.rows[0].hasObligation, false);
  assert.equal(summary.collectionRate, null);
});

test('summarizeSchoolYear: soldul rămâne în moneda copilului când toate lunile scadente sunt în EUR', () => {
  const records = /** @type {any} */ ({
    children: [child({ feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] })],
    payments: [],
  });
  const summary = summarizeSchoolYear(evaluateChildrenForSchoolYear(records, 2026, '2026-10-27'), '2026-10-27', '2026-10', {
    '2026-10-01': 20,
  });
  assert.deepEqual(summary.rows[0].sold, { amount: 200, currency: 'EUR' });
  assert.equal(summary.unrecovered, 4000);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/billing/domain/status-summary.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/billing/domain/status-summary.mjs`:

```javascript
import { cents } from '#shared/domain/money.mjs';
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Currency} Currency */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {import('./month-evaluation.mjs').ChildMonthEvaluation} ChildMonthEvaluation */
/** @typedef {import('./month-evaluation.mjs').ChildObligation} ChildObligation */
/** @typedef {import('./school-year-evaluation.mjs').ChildSchoolYearEvaluation} ChildSchoolYearEvaluation */
/** @typedef {'paid' | 'partial' | 'unpaid' | 'upcoming' | 'none'} HeatCellKind */

// Sumele pe mai mulți copii se arată în lei. Taxa unui copil în EUR intră cu
// cel mai recent curs cunoscut („≈ lei azi", regula 9 din 16-planuri-eur.md):
// cardurile de aici sunt datoria lunii, nu lei încasați efectiv (aceia sunt la
// Achitări/Dashboard). Fără niciun curs, 1:1 — ca toMdl din cash-summary.mjs,
// un card trebuie să arate un număr.
/**
 * @param {number} amount
 * @param {Currency} currency
 * @param {ExchangeRates} rates
 */
export function toMdlToday(amount, currency, rates) {
  if (currency === 'MDL') return amount;
  return convertAmount(amount, currency, 'MDL', latestKnownRate(rates)) ?? amount;
}

/**
 * @param {ChildMonthEvaluation[]} evaluations
 * @param {ExchangeRates} [rates]
 */
export function summarizeMonthStatus(evaluations, rates = {}) {
  let expectedCents = 0;
  let paidCents = 0;
  let overdueCents = 0;
  let owingChildren = 0;
  let overdueChildren = 0;
  for (const { obligation } of evaluations) {
    if (obligation.expected === null) continue;
    if (obligation.expected > 0) owingChildren += 1;
    expectedCents += cents(toMdlToday(obligation.expected, obligation.currency, rates));
    paidCents += cents(toMdlToday(obligation.paid, obligation.currency, rates));
    if (obligation.label === 'Restanță') {
      overdueChildren += 1;
      overdueCents += cents(toMdlToday(obligation.rest, obligation.currency, rates));
    }
  }
  return {
    expected: expectedCents / 100,
    paid: paidCents / 100,
    paidShare: expectedCents ? Math.min(1, paidCents / expectedCents) : 0,
    owingChildren,
    overdueChildren,
    overdue: overdueCents / 100,
  };
}

/**
 * @param {Pick<ChildObligation, 'expected' | 'paid' | 'rest' | 'due'>} obligation
 * @param {string} asOf
 * @returns {HeatCellKind}
 */
export function heatCellKind(obligation, asOf) {
  if (!obligation.expected) return 'none';
  if (obligation.rest === 0) return 'paid';
  if (obligation.paid > 0) return 'partial';
  return asOf > obligation.due ? 'unpaid' : 'upcoming';
}

/**
 * @param {ChildSchoolYearEvaluation[]} yearEvaluations
 * @param {string} asOf
 * @param {string} referenceMonth luna „aceasta" pentru cardul plăților parțiale
 * @param {ExchangeRates} [rates]
 */
export function summarizeSchoolYear(yearEvaluations, asOf, referenceMonth, rates = {}) {
  let dueExpectedCents = 0;
  let duePaidCents = 0;
  let unrecoveredCents = 0;
  let overdueChildren = 0;
  let partialThisMonth = 0;

  const rows = yearEvaluations.map(({ child, months }) => {
    const cells = months.map(({ month, obligation }) => ({ month, kind: heatCellKind(obligation, asOf) }));
    const overdueMonths = months.filter(
      ({ obligation }) => obligation.expected !== null && obligation.rest > 0 && asOf > obligation.due,
    );
    for (const { obligation } of months) {
      if (obligation.expected === null || obligation.due > asOf) continue;
      dueExpectedCents += cents(toMdlToday(obligation.expected, obligation.currency, rates));
      duePaidCents += cents(toMdlToday(obligation.paid, obligation.currency, rates));
    }
    // Moneda taxei se poate schimba în cursul anului (feeHistory); doar atunci soldul se convertește.
    const currencies = new Set(overdueMonths.map(({ obligation }) => obligation.currency));
    const singleCurrency = currencies.size <= 1;
    const soldCents = overdueMonths.reduce(
      (sum, { obligation }) =>
        sum + cents(singleCurrency ? obligation.rest : toMdlToday(obligation.rest, obligation.currency, rates)),
      0,
    );
    const sold = { amount: soldCents / 100, currency: singleCurrency ? ([...currencies][0] ?? 'MDL') : 'MDL' };
    unrecoveredCents += cents(toMdlToday(sold.amount, sold.currency, rates));
    if (sold.amount > 0) overdueChildren += 1;
    if (cells.find(cell => cell.month === referenceMonth)?.kind === 'partial') partialThisMonth += 1;
    return { child, cells, sold, hasObligation: cells.some(cell => cell.kind !== 'none') };
  });

  return {
    rows,
    overdueChildren,
    unrecovered: unrecoveredCents / 100,
    collectionRate: dueExpectedCents ? duePaidCents / dueExpectedCents : null,
    partialThisMonth,
  };
}
```

Add to `src/features/billing/index.web.mjs`:

```javascript
export { toMdlToday, summarizeMonthStatus, heatCellKind, summarizeSchoolYear } from './domain/status-summary.mjs';
```

Update `src/features/billing/README.md`: add the four new exports to the `index.web.mjs` table (one line each: „calendarul anului școlar + evaluarea pe 12 luni cu un singur index", „cardurile Situației plăților și celulele hărții"), add both files to the *Structură* tree, and a bullet under *Decizii*: „Sumele pe mai mulți copii se convertesc în lei la cel mai recent curs (proiecție), per `16-planuri-eur.md` regula 9; un rând de copil rămâne în moneda lui."

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/billing/domain/status-summary.test.mjs` → PASS (8 tests).
Run: `npm run check` → green.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/domain/status-summary.mjs src/features/billing/domain/status-summary.test.mjs src/features/billing/index.web.mjs src/features/billing/README.md
git commit -m "feat(billing): month status cards math and school-year heat-map classification"
```

---

## Phase 2 — Hooks (`webapp/`, Vitest)

### Task 5: `useStatus` — cards over the whole month, status segment, search, sorted rows

**Files:**
- Modify: `webapp/src/features/status/useStatus.ts`
- Modify: `webapp/src/features/status/useStatus.test.ts`

**Interfaces:**
- Consumes: `evaluateChildrenForMonth`, `summarizeMonthStatus` (`#features/billing/index.web.mjs`), `hasMissingFee` (`#features/fee-setup/index.web.mjs`), `useExchangeRates` (Task 2), `matchesRecordListSearch` + `normalizeSearchText` (as in `useFeeSetup.ts`).
- Produces (replaces the current `StatusData`):

```typescript
export type StatusSegment = 'all' | 'overdue' | 'partial' | 'paid' | 'upcoming';

export interface StatusRowView {
  id: string;
  name: string;
  archived: boolean;
  groupId: string | null;
  groupName: string;
  currency: Currency;
  expected: number | null;
  paid: number | null;
  rest: number | null;
  due: string;
  label: string;
}

export interface MonthStatusSummary {
  expected: number;        // MDL
  paid: number;            // MDL
  paidShare: number;       // 0..1
  owingChildren: number;
  overdueChildren: number;
  overdue: number;         // MDL
}

export interface StatusData {
  status: StatusScreenStatus;
  failureMessage: string;
  /** Tabelul: după grupă, statut și căutare. */
  rows: StatusRowView[];
  /** Cardurile și contoarele: toată luna, indiferent de filtre (RASPUNSURI.md). */
  summary: MonthStatusSummary;
  missingFeeCount: number;
  segmentCounts: Record<StatusSegment, number>;
  groups: { id: string; name: string }[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  segment: StatusSegment;
  setSegment: (value: StatusSegment) => void;
  search: string;
  setSearch: (value: string) => void;
  asOf: string;
}
```

  Dropped from `StatusRowView`: `contract` (column removed per spec; contract numbers stay searchable because `matchesRecordListSearch('children', …)` already matches `contractNumber`) and `credit` (column removed per spec §3 and `CORECTII-master-v2.md` §12 „Coloana Credit → în fișa copilului"; nothing else consumed the field). See the judgment note in *Column reconciliation* under Task 8.

  Segment ↔ `obligation.label` mapping (real values from `tuition-obligation.mjs`):
  `overdue` ← `'Restanță'` · `partial` ← `'Plată parțială'` · `paid` ← `'Plătit'` · `upcoming` ← `'Scadent în curând' | 'Nescadent'` · `all` ← everything, which is the only place `'De verificat'` and `'Fără obligație'` rows appear. `'Restanță'` with a partial payment counts as `overdue`, not `partial` — the label already decides that (`asOf > due` is checked before `paid > 0`), and the plan follows the label rather than inventing a second rule.

  Row order (the table has no default sort; `Situatia.dc.html` intro: „restanțierii grupați primii"): by label priority `Restanță, Plată parțială, Scadent în curând, Nescadent, Plătit, De verificat, Fără obligație`, then name (`localeCompare(…, 'ro')`).

- [ ] **Step 1: Write the failing tests**

In `webapp/src/features/status/useStatus.test.ts`, extend `fixtureState.children` with a fourth child who is paid in full and belongs to a group, and add the group:

```typescript
    {
      id: 'c4',
      name: 'Elena Marin',
      contractDate: '2026-01-15',
      attendanceDate: '2026-01-15',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      groupId: 'g1',
      archived: false,
    },
```

`payments`: add `{ id: 'p2', date: '2026-09-02', childId: 'c4', amount: 1000, tenders: [{ method: 'Card', amount: 1000 }], allocations: [{ month: '2026-09', amount: 1000 }], archived: false }`. `groups`: `[{ id: 'g1', name: 'Fluturași', capacity: null }]`. Also stub `/api/exchange-rates` in the `fetch` mock: `if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });`.

Then add tests:

```typescript
  it('cardurile sunt pe toată luna și nu se schimbă cu filtrul de grupă', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    expect(result.current.summary).toEqual({
      expected: 2500,
      paid: 1500,
      paidShare: 0.6,
      owingChildren: 2,
      overdueChildren: 1,
      overdue: 1000,
    });
    expect(result.current.missingFeeCount).toBe(1);

    act(() => result.current.setGroupFilter('g1'));
    expect(result.current.rows.map(row => row.id)).toEqual(['c4']);
    expect(result.current.summary.expected).toBe(2500);
  });

  it('contoarele pe statut sunt pe toată luna, iar segmentul restrânge doar tabelul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    expect(result.current.segmentCounts).toEqual({ all: 4, overdue: 1, partial: 0, paid: 1, upcoming: 0 });

    act(() => result.current.setSegment('overdue'));
    expect(result.current.rows.map(row => row.id)).toEqual(['c1']);
    expect(result.current.segmentCounts.all).toBe(4);
  });

  it('căutarea restrânge tabelul după nume, fără să atingă cardurile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    act(() => result.current.setSearch('elena'));
    expect(result.current.rows.map(row => row.id)).toEqual(['c4']);
    expect(result.current.summary.owingChildren).toBe(2);
  });

  it('rândurile vin cu restanțele primele, apoi după nume', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    expect(result.current.rows.map(row => row.label)).toEqual(['Restanță', 'Plătit', 'De verificat', 'Fără obligație']);
  });

  it('fiecare rând poartă moneda taxei copilului', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    expect(result.current.rows.every(row => row.currency === 'MDL')).toBe(true);
  });
```

Update the existing test „include toți copiii, inclusiv arhivați" to expect `['c1', 'c2', 'c3', 'c4']`.

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npx vitest run src/features/status/useStatus.test.ts`
Expected: FAIL — `summary`, `segmentCounts`, `setSegment`, `setSearch`, `currency` don't exist.

- [ ] **Step 3: Implement**

Rewrite `webapp/src/features/status/useStatus.ts`:

```typescript
import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/exchange-rates';
import { evaluateChildrenForMonth, summarizeMonthStatus } from '#features/billing/index.web.mjs';
import { hasMissingFee } from '#features/fee-setup/index.web.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Currency, RecordsSnapshot } from '@contracts/record-types.mjs';

export type StatusScreenStatus = 'loading' | 'ready' | 'failed';
export type StatusSegment = 'all' | 'overdue' | 'partial' | 'paid' | 'upcoming';

// … StatusRowView / MonthStatusSummary / StatusData exactly as in the Interfaces block above …

const SEGMENT_BY_LABEL: Record<string, Exclude<StatusSegment, 'all'>> = {
  Restanță: 'overdue',
  'Plată parțială': 'partial',
  Plătit: 'paid',
  'Scadent în curând': 'upcoming',
  Nescadent: 'upcoming',
};

const LABEL_ORDER = ['Restanță', 'Plată parțială', 'Scadent în curând', 'Nescadent', 'Plătit', 'De verificat', 'Fără obligație'];

const EMPTY_SUMMARY: MonthStatusSummary = { expected: 0, paid: 0, paidShare: 0, owingChildren: 0, overdueChildren: 0, overdue: 0 };
const EMPTY_COUNTS: Record<StatusSegment, number> = { all: 0, overdue: 0, partial: 0, paid: 0, upcoming: 0 };

/**
 * Obligația fiecărui copil pe luna aleasă, inclusiv arhivați. Grupa, statutul
 * și căutarea restrâng doar tabelul; cardurile și contoarele rămân pe toată
 * luna, la fel ca la Achitări (RASPUNSURI.md).
 */
export function useStatus(month: string): StatusData {
  const session = useAppSession();
  const rates = useExchangeRates();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();
  const [groupFilter, setGroupFilter] = useState('all');
  const [segment, setSegment] = useState<StatusSegment>('all');
  const [search, setSearch] = useState('');
  const filters = { groupFilter, setGroupFilter, segment, setSegment, search, setSearch };

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      summary: EMPTY_SUMMARY,
      missingFeeCount: 0,
      segmentCounts: EMPTY_COUNTS,
      groups: [],
      asOf: todayStr,
      ...filters,
    };
  }

  const records = state as RecordsSnapshot;
  const evaluations = evaluateChildrenForMonth(records, month, todayStr, rates);
  const summary = summarizeMonthStatus(evaluations, rates);
  const missingFeeCount = records.children.filter(child => !child.archived && hasMissingFee(child)).length;

  const segmentCounts = { ...EMPTY_COUNTS };
  for (const { obligation } of evaluations) {
    segmentCounts.all += 1;
    const rowSegment = SEGMENT_BY_LABEL[obligation.label];
    if (rowSegment) segmentCounts[rowSegment] += 1;
  }

  const normalizedSearch = normalizeSearchText(search);
  const rows: StatusRowView[] = evaluations
    .filter(({ child, obligation }) =>
      (groupFilter === 'all' || (groupFilter === 'none' ? !child.groupId : child.groupId === groupFilter)) &&
      (segment === 'all' || SEGMENT_BY_LABEL[obligation.label] === segment) &&
      matchesRecordListSearch('children', child, records, normalizedSearch),
    )
    .sort(
      (a, b) =>
        LABEL_ORDER.indexOf(a.obligation.label) - LABEL_ORDER.indexOf(b.obligation.label) ||
        a.child.name.localeCompare(b.child.name, 'ro'),
    )
    .map(({ child, obligation }) => ({
      id: child.id,
      name: child.name,
      archived: Boolean(child.archived),
      groupId: child.groupId,
      groupName: groupNameOf(child.groupId, records.groups),
      currency: obligation.currency as Currency,
      expected: obligation.expected,
      paid: obligation.paid,
      rest: obligation.rest,
      due: obligation.due,
      label: obligation.label,
    }));
  const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  return { status: 'ready', failureMessage: '', rows, summary, missingFeeCount, segmentCounts, groups, asOf: todayStr, ...filters };
}
```

Remove the old `EMPTY` constant and the `contractNumberOf` import.

- [ ] **Step 4: Run to verify pass**

Run: `cd webapp && npx vitest run src/features/status/useStatus.test.ts` → PASS.
Run: `cd webapp && npm run typecheck` → **expected to FAIL** in `StatusPage.tsx` (`row.contract`, `row.credit`, `statusData.rows` shape) — that is Task 7/8's job. Do not patch `StatusPage.tsx` here beyond the minimum to make `tsc` pass: delete the `contract` and `credit` column entries and the `period` paragraph now, keep everything else. `npm test` in `webapp/` must still be green (`StatusPage.test.tsx` doesn't assert those columns).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/features/status/useStatus.ts webapp/src/features/status/useStatus.test.ts webapp/src/features/status/StatusPage.tsx
git commit -m "feat(status): month summary, status segment and search in useStatus; drop Contract/Credit columns"
```

---

### Task 6: `useSchoolYearStatus` — heat-map rows and the 3 year cards

**Files:**
- Create: `webapp/src/features/status/useSchoolYearStatus.ts`
- Test: `webapp/src/features/status/useSchoolYearStatus.test.ts`

**Interfaces:**
- Consumes: `evaluateChildrenForSchoolYear`, `schoolYearStartOf`, `schoolYearMonths`, `summarizeSchoolYear` (`#features/billing/index.web.mjs`), `useExchangeRates`.
- Produces:

```typescript
export type HeatCellKind = 'paid' | 'partial' | 'unpaid' | 'upcoming' | 'none';

export interface HeatRowView {
  id: string;
  name: string;
  archived: boolean;
  cells: { month: string; kind: HeatCellKind }[];
  sold: number;
  soldCurrency: Currency;
}

export interface SchoolYearSummaryView {
  overdueChildren: number;
  unrecovered: number;          // MDL
  collectionRate: number | null; // 0..1
  partialThisMonth: number;
}

export interface SchoolYearData {
  status: StatusScreenStatus;
  failureMessage: string;
  /** Harta: după căutare, fără copiii complet în afara anului; sortată după sold descrescător, apoi nume. */
  rows: HeatRowView[];
  /** Cardurile: tot anul, indiferent de căutare. */
  summary: SchoolYearSummaryView;
  months: string[];             // 12 chei YYYY-MM
  monthLabels: string[];        // Sep, Oct, Noi, … Aug
  /** Luna de azi, dacă e în anul ales — celula cu contur. */
  currentMonth: string | null;
  /** Anii școlari cu date: de la cel mai vechi attendanceDate/contractDate până la anul curent. */
  schoolYearOptions: number[];
  search: string;
  setSearch: (value: string) => void;
}

/** `startYear === null` = modul An școlar nu e activ: nimic nu se evaluează (nu 12×N obligații degeaba). */
export function useSchoolYearStatus(startYear: number | null): SchoolYearData
```

  `referenceMonth` for `partialThisMonth` = today's month clamped into the selected year (`months[0]` ≤ m ≤ `months[11]`) — for a past year that is its last month, for a future year its first. `monthLabels` use the `MONTHS_RO` spelling from `#shared/format/date-format.mjs` (`Sep, Oct, Noi, Dec, Ian, …`); since that array isn't exported, derive them with `formatMonthLabel(month).slice(5)` (it returns `'2026 Sep'`).

- [ ] **Step 1: Write the failing tests**

Create `webapp/src/features/status/useSchoolYearStatus.test.ts` with the same session harness as `useStatus.test.ts` (copy `jsonResponse`, `loadedSession`, the `fetch` stub incl. `/api/exchange-rates`). Fixture: `c1` active from `2026-01-10` with fee 1000, one payment of 1000 on `2026-09-02` allocated to `2026-09`; `c2` starting `2027-09-01` (outside the 2026 year). Tests:

```typescript
  it('nu evaluează nimic când modul nu e activ', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(null));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows).toEqual([]);
  });

  it('dă 12 luni din septembrie în august, cu etichete scurte și luna curentă marcată', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    expect(result.current.months[0]).toBe('2026-09');
    expect(result.current.months[11]).toBe('2027-08');
    expect(result.current.monthLabels.slice(0, 3)).toEqual(['Sep', 'Oct', 'Noi']);
    expect(result.current.currentMonth).toBe(new Date().toISOString().slice(0, 7));
  });

  it('ascunde copiii complet în afara anului și sortează după sold', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    expect(result.current.rows.map(row => row.id)).toEqual(['c1']);
    expect(result.current.rows[0].cells[0].kind).toBe('paid');
  });

  it('opțiunile de an pornesc de la primul contract și ajung la anul curent', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    expect(result.current.schoolYearOptions[0]).toBe(2025); // 2026-01 e în anul școlar 2025–2026
    expect(result.current.schoolYearOptions.at(-1)).toBe(2027); // c2 începe în 2027-09
  });

  it('căutarea restrânge harta, nu cardurile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    act(() => result.current.setSearch('nimeni'));
    expect(result.current.rows).toEqual([]);
    expect(result.current.summary.overdueChildren).toBe(result.current.summary.overdueChildren);
  });
```

(For the last test assert a concrete number once the fixture's overdue months are known under today's date; the point is that `summary` is computed before the search filter.)

- [ ] **Step 2: Run to verify failure**

Run: `cd webapp && npx vitest run src/features/status/useSchoolYearStatus.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

Create `webapp/src/features/status/useSchoolYearStatus.ts` following `useStatus.ts` line by line: session + rates + `useState('')` for search; early return when `!ready`; early `ready` return with empty rows/summary when `startYear === null`; otherwise:

```typescript
  const months = schoolYearMonths(startYear);
  const todayMonth = todayStr.slice(0, 7);
  const referenceMonth = todayMonth < months[0] ? months[0] : todayMonth > months[11] ? months[11] : todayMonth;
  const yearSummary = summarizeSchoolYear(evaluateChildrenForSchoolYear(records, startYear, todayStr, rates), todayStr, referenceMonth, rates);
  const normalizedSearch = normalizeSearchText(search);
  const rows: HeatRowView[] = yearSummary.rows
    .filter(row => row.hasObligation && matchesRecordListSearch('children', row.child, records, normalizedSearch))
    .sort((a, b) => b.sold.amount - a.sold.amount || a.child.name.localeCompare(b.child.name, 'ro'))
    .map(row => ({ id: row.child.id, name: row.child.name, archived: Boolean(row.child.archived), cells: row.cells, sold: row.sold.amount, soldCurrency: row.sold.currency as Currency }));
  const firstMonth = records.children
    .map(child => (child.attendanceDate ?? child.contractDate ?? '').slice(0, 7))
    .filter(Boolean)
    .sort()[0];
  const firstYear = firstMonth ? schoolYearStartOf(firstMonth) : schoolYearStartOf(todayMonth);
  const lastYear = Math.max(schoolYearStartOf(todayMonth), ...records.children.map(c => schoolYearStartOf((c.attendanceDate ?? c.contractDate ?? todayStr).slice(0, 7))));
  const schoolYearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
```

`monthLabels = months.map(month => formatMonthLabel(month).slice(5))`; `currentMonth = months.includes(todayMonth) ? todayMonth : null`; `summary` = the four scalar fields of `yearSummary`.

- [ ] **Step 4: Run to verify pass**

Run: `cd webapp && npx vitest run src/features/status` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/features/status/useSchoolYearStatus.ts webapp/src/features/status/useSchoolYearStatus.test.ts
git commit -m "feat(status): useSchoolYearStatus hook for the heat-map and year cards"
```

---

## Phase 3 — Mod Lună (UI)

### Task 7: Shared compact header + mode switch + routing props

**Files:**
- Modify: `webapp/src/app/App.tsx`
- Modify: `webapp/src/features/status/StatusPage.tsx`
- Modify: `webapp/src/features/status/StatusPage.module.css`
- Modify: `webapp/src/features/status/StatusPage.test.tsx`

**Interfaces:**
- `StatusPageProps` becomes `{ month: string; onMonthChange: (month: string) => void; onNavigate: (view: ViewKey) => void; onOpenChild: (id: string) => void }` (`ViewKey` from `@shared/view-key`, as `NotifyPage` does). `App.tsx`: `<StatusPage month={month} onMonthChange={setMonth} onNavigate={onNavigate} onOpenChild={id => navigate(`/copii/${id}`)} />` (inline, like `PaymentsRoute`'s `onOpenChild`; `navigate` is already in `App()` scope).
- Mode: `type StatusMode = 'month' | 'year'`, `usePersistedState<StatusMode>('view.status', 'month')`.
- Header (spec §2), pushed with `useTopbarActions` **before** the loading/failed early returns (hooks order — see `VisitsPage.tsx:103`):

```tsx
  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl<StatusMode> ariaLabel="Mod de afișare" value={mode} onChange={setMode} options={MODE_OPTIONS} />
      {mode === 'month' ? (
        <MonthPicker value={month} onChange={onMonthChange} />
      ) : (
        <select className={styles.yearSelect} aria-label="Anul școlar" value={startYear} onChange={event => setStartYear(Number(event.target.value))}>
          {yearData.schoolYearOptions.map(year => <option key={year} value={year}>{schoolYearLabel(year)}</option>)}
        </select>
      )}
      <button type="button" className={styles.btnGhost} onClick={() => window.print()}>Tipărește</button>
    </div>,
  );
```

  `MODE_OPTIONS = [{ value: 'month', label: 'Lună' }, { value: 'year', label: 'An școlar' }]`. `startYear` is `useState(() => schoolYearStartOf(month))` — the year containing the month the operator was looking at. Both hooks are called at the top of `StatusPage`: `useStatus(month)` and `useSchoolYearStatus(mode === 'year' ? startYear : null)`.
- Content: `mode === 'month' ? <MonthView … /> : <YearView … />` — two function components in the same file (the `PaymentsPage` `TableView`/`MonthsView` pattern). This task lands `MonthView` as the *current* table body (minus the removed columns) and `YearView` as a placeholder `<p className={styles.notice}>` — Tasks 8–9 fill them in.
- Removed from content: the „Luna … · situație la …" period line (the MonthPicker in the header replaces it), the „Tipărește raportul" button (moved to the header as „Tipărește"), and the long explanatory `.notice` paragraph — spec §2–3 has no such element and `CLAUDE.md` forbids adding what isn't in the spec. If the owner wants the text back, `CORECTII-master-v2.md` §12 proposes an „ⓘ Cum se calculează" tooltip next to the title; that needs a Topbar title slot and is out of this plan.

- [ ] **Step 1: Update the page test harness**

In `StatusPage.test.tsx`, wrap like `GroupsPage.test.tsx`: `TopbarActionsProvider` + a `TopbarActionsSlot` component rendering `useTopbarActionsSlot()`, and `ToastProvider` (not needed yet, harmless). Pass the four props (`onMonthChange`, `onNavigate`, `onOpenChild` as `vi.fn()`), stub `/api/exchange-rates`, and `localStorage.clear()` in `beforeEach` (already there). Change the print test to click `'Tipărește'`. Add:

```typescript
  it('antetul are comutatorul Lună | An școlar și selectorul de lună în modul Lună', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByRole('radio', { name: 'Lună' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Luna următoare' })).toBeInTheDocument();
  });

  it('An școlar înlocuiește selectorul de lună cu anul școlar, fără un al doilea titlu în conținut', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));
    expect(screen.getByRole('combobox', { name: 'Anul școlar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Luna următoare' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(localStorage.getItem('view.status')).toBe('year');
  });
```

- [ ] **Step 2: Run to verify failure** — `cd webapp && npx vitest run src/features/status/StatusPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement** `App.tsx` props, the `StatusPage` skeleton described above, `.headerActions { display:flex; align-items:center; gap:var(--space-12) }` and `.yearSelect` (pill: `border:1.5px solid var(--border); background:var(--white); border-radius:var(--radius-pill); padding:var(--space-8) var(--space-16); font:800 14px var(--font-body); color:var(--slate)`) in the module CSS. Delete the now-unused `.period` rule.

- [ ] **Step 4: Verify** — `cd webapp && npm run typecheck && npm test` → green (the `App.tsx` change compiles because `navigate` and `onNavigate` exist in scope).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/App.tsx webapp/src/features/status/StatusPage.tsx webapp/src/features/status/StatusPage.module.css webapp/src/features/status/StatusPage.test.tsx
git commit -m "feat(status): compact shared header with Lună | An școlar switch, month picker and print"
```

---

### Task 8: `MonthView` — 4 cards, toolbar, spec columns, banner

**Files:**
- Modify: `webapp/src/features/status/StatusPage.tsx`, `StatusPage.module.css`, `StatusPage.test.tsx`

**Interfaces:**
- Consumes `StatusData` (Task 5), `Card`, `SegmentedControl`, `FilterPills`, `DataTable`, `Badge`, `groupTone` from `@shared/ui`, `formatMoney(value, currency)`, `formatDate`.

**Column reconciliation (spec §3 vs. current table):**

| Current | Spec | Decision |
| --- | --- | --- |
| Contract | — | **Dropped.** Not in spec; the value stays reachable through search (`contractNumber` is indexed) and in fișa copilului. |
| Copil | Copil | Kept; „(arhivat)" suffix kept (the table still lists archived children). No avatar/parent line — the mockup draws one, spec §3 lists only „Copil", and spec wins. |
| Taxă · Achitat · Rest | Taxă · Achitat · Rest (roșu dacă > 0) | Kept, now `formatMoney(v, row.currency)`; Rest gets `.restDue` (`color: var(--pink-ink); font-weight: 800`) when `> 0`. |
| Credit | — | **Dropped** (spec, and `CORECTII-master-v2.md` §12: „Coloana Credit → în fișa copilului"). Caveat, stated so nobody is surprised: fișa copilului does not show a per-month over-allocation today (grep `credit` in `features/children` → nothing), so this figure becomes invisible until that screen is redesigned. It is rare (a payment allocated above the month's fee) and the Dashboard „Avans" KPI still covers unallocated surplus. |
| Scadență (after Credit) | Scadență (2nd column) | Moved to 2nd position; keeps `formatDate(row.due)` (spec gives no format; the mockup's „ziua 20" is not in the spec). |
| Situație | Statut | Renamed; rendered as `<Badge>` with tone `Restanță → pink`, `Plată parțială → yellow`, `Plătit → mint`, `Scadent în curând → orange`, everything else `neutral`. |
| — | CTA | **Added:** „Notifică" for `Restanță` / `Plată parțială` rows (**disabled**, `title="Trimiterea SMS vine odată cu integrarea SMS (P2)"`), „Vezi fișa" otherwise (`onOpenChild(row.id)`). |
| — | grid `2fr 0.9fr 1fr 1fr 1fr 1.2fr 150px` | Not reproducible: `DataTable` is a `<table>` without column widths and `CLAUDE.md` mandates `@shared/ui` components. Kept `DataTable`; noted as the one deliberate deviation from spec §3 in the commit message. |

- [ ] **Step 1: Write the failing tests** (in `StatusPage.test.tsx`, fixture as extended in Task 5 plus the group):

```typescript
  it('cele 4 carduri arată toată luna: de încasat, încasat cu bară, restanțe, fără taxă', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByText('De încasat').closest('div')).toHaveTextContent('2.500,00 lei');
    expect(screen.getByText('Încasat').closest('div')).toHaveTextContent('1.500,00 lei');
    expect(screen.getByRole('progressbar', { name: 'Încasat din de încasat' })).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('Restanțe').closest('div')).toHaveTextContent('1 copil');
    expect(screen.getByText('Fără taxă setată').closest('div')).toHaveTextContent('1');
  });

  it('„Completează →" duce la Taxe și grupe', async () => {
    await loadedSession();
    const { onNavigate } = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Completează →' }));
    expect(onNavigate).toHaveBeenCalledWith('fees');
  });

  it('segmentul de statut restrânge tabelul, cardurile rămân', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'Achitat · 1' }));
    expect(screen.getByText('Elena Marin')).toBeInTheDocument();
    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
    expect(screen.getByText('De încasat').closest('div')).toHaveTextContent('2.500,00 lei');
  });

  it('Rest > 0 e roșu, Statut e badge, CTA depinde de statut', async () => {
    await loadedSession();
    const { onOpenChild } = renderPage();
    const overdueRow = screen.getByText('Andrei Popescu').closest('tr') as HTMLElement;
    expect(within(overdueRow).getByText('1.000,00 lei')).toHaveClass(/restDue/);
    expect(within(overdueRow).getByRole('button', { name: 'Notifică' })).toBeDisabled();
    const paidRow = screen.getByText('Elena Marin').closest('tr') as HTMLElement;
    await userEvent.click(within(paidRow).getByRole('button', { name: 'Vezi fișa' }));
    expect(onOpenChild).toHaveBeenCalledWith('c4');
  });

  it('bannerul de restanțieri apare cu „Notifică toți" dezactivat până la integrarea SMS', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByText('1 restanțier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifică toți' })).toBeDisabled();
  });
```

(`renderPage` returns the three `vi.fn()` props; `within` from RTL.)

- [ ] **Step 2: Run to verify failure** → FAIL (no cards, no segments).

- [ ] **Step 3: Implement `MonthView`**

```tsx
function MonthView({ data, onNavigate, onOpenChild }: { data: StatusData; onNavigate: (view: ViewKey) => void; onOpenChild: (id: string) => void }) {
  const { summary } = data;
  const pct = Math.round(summary.paidShare * 100);
  return (
    <>
      <div className={styles.summaryRow}>
        <Card className={styles.summaryCard}>
          <p className={styles.summaryLabel}>De încasat</p>
          <strong className={styles.summaryValue}>{formatMoney(summary.expected)}</strong>
          <small className={styles.summaryMeta}>{summary.owingChildren} copii activi</small>
        </Card>
        <Card tone="mint" className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.mintInk}`}>Încasat</p>
          <strong className={styles.summaryValue}>{formatMoney(summary.paid)}</strong>
          <div className={styles.progress} role="progressbar" aria-label="Încasat din de încasat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card tone={summary.overdueChildren > 0 ? 'pink' : 'white'} className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.pinkInk}`}>Restanțe</p>
          <strong className={summary.overdueChildren > 0 ? styles.summaryValue : styles.summaryValueZero}>
            {summary.overdueChildren} {summary.overdueChildren === 1 ? 'copil' : 'copii'}
          </strong>
          <small className={`${styles.summaryMeta} ${styles.pinkInk}`}>scadența a trecut · {formatMoney(summary.overdue)}</small>
        </Card>
        <Card tone={data.missingFeeCount > 0 ? 'yellow' : 'white'} className={styles.summaryCard}>
          <p className={`${styles.summaryLabel} ${styles.yellowInk}`}>Fără taxă setată</p>
          <strong className={data.missingFeeCount > 0 ? styles.summaryValue : styles.summaryValueZero}>{data.missingFeeCount}</strong>
          {data.missingFeeCount > 0 && (
            <button type="button" className={styles.cardLink} onClick={() => onNavigate('fees')}>Completează →</button>
          )}
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.toolbar}>
          <SegmentedControl<StatusSegment> ariaLabel="Statut" value={data.segment} onChange={data.setSegment} options={segmentOptions(data.segmentCounts)} />
          <input className={styles.search} type="search" placeholder="Caută copil" aria-label="Caută copil" value={data.search} onChange={event => data.setSearch(event.target.value)} />
        </div>
        <FilterPills groups={[/* Grupă — unchanged from today */]} />
        <DataTable columns={columns} rows={data.rows} rowKey={row => row.id} bare emptyState={<p>Nu sunt copii pentru filtrele alese.</p>} />
        {summary.overdueChildren > 0 && (
          <div className={styles.banner}>
            <strong>{summary.overdueChildren} {summary.overdueChildren === 1 ? 'restanțier' : 'restanțieri'}</strong>
            <span>Trimite o notificare tuturor părinților cu restanță</span>
            <button type="button" className={styles.btnPrimary} disabled title="Trimiterea SMS vine odată cu integrarea SMS (P2)">Notifică toți</button>
          </div>
        )}
      </Card>
    </>
  );
}
```

`segmentOptions(counts)` → `[{ value: 'all', label: `Toți · ${counts.all}` }, { value: 'overdue', label: `Restanțieri · ${counts.overdue}` }, { value: 'partial', label: `Parțial · ${counts.partial}` }, { value: 'paid', label: `Achitat · ${counts.paid}` }, { value: 'upcoming', label: `Urmează · ${counts.upcoming}` }]` — same „label · N" convention as `ExpensesPage`'s archive segment. The `missingFeeCount` card uses exactly the sidebar's definition (`useFeeSetup.missingCount`: non-archived children with `hasMissingFee`), so the two numbers never disagree.

CSS (all tokens): `.summaryRow` (grid `repeat(4, minmax(0, 1fr))`, gap 14px, margin-bottom 18px — spec §F content gap), `.summaryCard { min-height: 108px }`, `.summaryLabel` (12px/800 uppercase `.08em`, `--muted`), `.summaryValue` (Baloo 28/800 `--slate`, `white-space: nowrap`), `.summaryValueZero` (same, `color: var(--subtle)`), `.summaryMeta` (12px `--muted`), `.mintInk/.pinkInk/.yellowInk` (`color: var(--*-ink)`), `.progress` (height 6px, `--white` bg, pill radius, overflow hidden; `> span { display:block; height:100%; background: var(--success-dot) }` — the Dashboard `.methodBar` pattern), `.cardLink` (borderless, `--yellow-ink`, 12px/800), `.toolbar` (`00-comun.md` §E: flex, gap 10, padding 14px 16px, border-bottom `--border`), `.search` (`flex:1; min-width:0; background: var(--cream); border:1px solid var(--border); border-radius: var(--radius-input); padding: 10px 14px; font-size: 14px`), `.restDue`, `.banner` (`margin: 14px 16px; padding: 12px 18px; border-radius: var(--radius-md-lg); background: var(--yellow-soft); display:flex; align-items:center; gap:14px; font-size:13px; > button { margin-left:auto }`), `.btnPrimary` (as `ExpensesPage.module.css`; add `:disabled { opacity:.5; box-shadow:none; cursor:not-allowed }`), `.ctaButton` (pill, `1.5px solid var(--border)`, 12px/800, `:disabled` same). Every button/pill/badge: `white-space: nowrap` (DESIGN.md).

- [ ] **Step 4: Verify** — `cd webapp && npm run typecheck && npm test` → green. Then `npm run dev` in `webapp/` (server: `npm start` at root) and compare `/situatia-platilor` at 1280 and 1440 px with `Situatia.dc.html#1m`: 4 cards on one row, toolbar → pills → table → banner order, nothing overflowing the card.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/features/status/StatusPage.tsx webapp/src/features/status/StatusPage.module.css webapp/src/features/status/StatusPage.test.tsx
git commit -m "feat(status): Lună mode - 4 month cards, status segment + search, spec columns, restanțieri banner"
```

(Commit body: „Deviere de la spec §3: coloanele folosesc DataTable, nu grid-ul 2fr 0.9fr…; Notifică / Notifică toți sunt dezactivate până la SMS P2.")

---

## Phase 4 — Mod An școlar (UI)

### Task 9: Two tokens, `PaymentHeatmap`, 3 year cards, `YearView`

**Files:**
- Modify: `webapp/src/shared/tokens/tokens.css`
- Create: `webapp/src/features/status/PaymentHeatmap.tsx`, `PaymentHeatmap.module.css`, `PaymentHeatmap.test.tsx`
- Modify: `webapp/src/features/status/StatusPage.tsx`, `StatusPage.module.css`, `StatusPage.test.tsx`

**Interfaces:**
- `tokens.css`, in the „Adăugate pentru redesign" block: `--sand: #f1ece2;` (spec: „urmează"; the same value already appears as a literal in `SegmentedControl.module.css` and `DashboardPage.module.css` — leave those files alone, one screen per session) and `--sand-soft: #faf7f1;` (spec: „înainte de contract").
- `PaymentHeatmap({ rows, monthLabels, currentMonth }: { rows: HeatRowView[]; monthLabels: string[]; currentMonth: string | null })` — legend on top (Achitat / Parțial / Neachitat / Urmează, spec §4 „Legenda sus"), head row `Copil · 12 luni · Sold`, one grid row per child: `grid-template-columns: 230px repeat(12, minmax(0, 1fr)) 130px; gap: 6px`. Cell: `height: 30px; border-radius: var(--radius-xs)`, background by kind — `paid → var(--mint)`, `partial → var(--yellow)`, `unpaid → var(--raspberry)`, `upcoming → var(--sand)`, `none → var(--sand-soft)`; the `currentMonth` cell adds `outline: 2px solid var(--orange-soft); outline-offset: 2px`. Each cell is a `<span role="img" aria-label={`${monthLabel}: ${KIND_LABEL[kind]}`} title={…}>` so tests and screen readers can read it. Sold: right-aligned, 14px/800, `formatMoney(row.sold, row.soldCurrency)`, `--pink-ink` when `> 0` else `--subtle`. Month header label of `currentMonth` in `--orange-ink`. Empty state: „Niciun copil cu obligație în anul ales."
- `YearView({ data }: { data: SchoolYearData })` — 3 cards then the heat-map card with the search input in the legend row (mockup) :

```tsx
      <div className={styles.yearCards}>
        <Card tone={data.summary.overdueChildren > 0 ? 'pink' : 'white'} className={styles.yearCard}>
          <strong className={styles.yearCardValue}>{data.summary.overdueChildren}</strong>
          <div><p className={styles.yearCardTitle}>copii cu restanță</p><small>{formatMoney(data.summary.unrecovered)} nerecuperați</small></div>
          {data.summary.overdueChildren > 0 && <button type="button" className={styles.ctaButton} disabled title="Trimiterea SMS vine odată cu integrarea SMS (P2)">Notifică</button>}
        </Card>
        <Card tone="mint" className={styles.yearCard}>
          <strong className={styles.yearCardValue}>{data.summary.collectionRate === null ? '—' : `${Math.round(data.summary.collectionRate * 100)}%`}</strong>
          <div><p className={styles.yearCardTitle}>rată de încasare</p><small>pe anul școlar, până azi</small></div>
        </Card>
        <Card tone="yellow" className={styles.yearCard}>
          <strong className={styles.yearCardValue}>{data.summary.partialThisMonth}</strong>
          <div><p className={styles.yearCardTitle}>plăți parțiale</p><small>luna aceasta</small></div>
        </Card>
      </div>
```

  `.yearCards` grid `repeat(3, minmax(0, 1fr))`, gap 14; `.yearCard` `flex-direction: row; align-items: center; gap: 16px`; `.yearCardValue` Baloo 36/800 `--slate` (DESIGN.md KPI size; the mockup's 44 is not in the spec); `.yearCardTitle` 15px/800.

- [ ] **Step 1: Write the failing tests**

`PaymentHeatmap.test.tsx` (pure component, no session): render two rows with hand-built cells; assert `getAllByRole('img', { name: /Oct: Achitat/ })`, the `currentMonth` cell has class `/current/`, `Sold` shows `formatMoney` with the row currency (`'200,00 €'` for an EUR row), the legend has four entries, and the empty state renders with `rows=[]`.

`StatusPage.test.tsx`: add a test that switches to An școlar (click the radio), then asserts the three cards' titles (`copii cu restanță`, `rată de încasare`, `plăți parțiale`), that the `Notifică` card button is disabled, that the heat-map lists `Andrei Popescu` and not `Elena Marin` when searching „andrei" in the heat-map search (`aria-label="Caută copil"` — note both modes have a search box, only one is mounted at a time), and that changing the year `<select>` to another option re-renders without error.

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement** the token lines, `PaymentHeatmap.tsx` + CSS, `YearView`, and CSS additions in `StatusPage.module.css`. `KIND_LABEL = { paid: 'Achitat', partial: 'Parțial', unpaid: 'Neachitat', upcoming: 'Urmează', none: 'Fără obligație' }` lives in `PaymentHeatmap.tsx`.

- [ ] **Step 4: Verify** — `cd webapp && npm run typecheck && npm test` → green. Browser at 1440 px vs `Situatia.dc.html#1n`: header identical to Lună except the year pill in place of the month picker; legend, 12 columns, Sold; current month outlined; switching years keeps the header height.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/shared/tokens/tokens.css webapp/src/features/status/PaymentHeatmap.tsx webapp/src/features/status/PaymentHeatmap.module.css webapp/src/features/status/PaymentHeatmap.test.tsx webapp/src/features/status/StatusPage.tsx webapp/src/features/status/StatusPage.module.css webapp/src/features/status/StatusPage.test.tsx
git commit -m "feat(status): An școlar mode - 3 year cards and copil × 12 luni heat-map"
```

---

## Phase 5 — Verification, acceptance, docs

### Task 10: Full gate, acceptance criteria, queue update

**Files:**
- Modify: `docs/design/screens/07-situatia.md` (tick §5), `docs/design/COADA-DE-LUCRU.md` (point 10 status)

- [ ] **Step 1: Full gates**

Run at repo root: `npm run check` → green. Run: `cd webapp && npm run typecheck && npm test` → green (incl. `architecture.test.ts` — `status/` imports nothing from `@features/*`).

- [ ] **Step 2: Manual browser pass** (`npm start` at root, `npm run dev` in `webapp/`)

1. Lună: pick a month with restanțe — cards, „Toți · N" equals the row count under Toți with Grupă = Toate, switching group pills changes only the table, search narrows, Rest red, badges, „Vezi fișa" opens `/copii/:id`, „Completează →" opens `/taxe-si-grupe`, banner present, both „Notifică" buttons disabled with the tooltip.
2. If any child has an EUR fee: their row shows `€`, the cards show lei; open „Curs valutar" (if point 8 UI has shipped) and confirm the card total moves with the latest rate.
3. An școlar: header stays ~60 px with no H2 in content; heat-map colors; today's month outlined; Sold; year select lists every year with data.
4. `Tipărește` prints the current mode.
5. Reload: the mode persists (`view.status`).

- [ ] **Step 3: Tick the spec**

In `docs/design/screens/07-situatia.md` §5: check „Antetul An școlar e compact, identic cu Lună" and „Filtrul de grupă e cu pastile"; leave „«Notifică» pe un rând → #2a; «Notifică toți» → #2b" **unchecked** with the note „→ SMS P2, vezi `2026-09-27-situatia-platilor-complet.md` §Handoff". In `COADA-DE-LUCRU.md` mark point 10 DONE with the date and the same SMS note.

- [ ] **Step 4: Commit**

```bash
git add docs/design/screens/07-situatia.md docs/design/COADA-DE-LUCRU.md
git commit -m "docs: Situația plăților - criterii bifate, SMS P2 rămâne"
```

---

## Handoff to SMS P2 (separate plan, not part of this one)

What this plan leaves for the SMS P2 plan (`2a`/`2b` dialogs in Situația plăților), so it can be written against real seams:

- Three disabled buttons to wire: row „Notifică" (`MonthView` CTA, rows with `label ∈ {Restanță, Plată parțială}`) → `SmsConfirmDialog` mode `single` (`source: 'status-row'`); banner „Notifică toți" → mode `bulk` (`source: 'status-bulk'`); year card „Notifică" → mode `bulk` over `HeatRowView`s with `sold > 0`.
- `StatusRowView` carries `id`, `name`, `rest`, `currency`, `label`; P2 will need parent name + phone per row — add `parent`/`phone` to `StatusRowView` in `useStatus.ts` then (`contactLinesOf` in `useNotify.ts` is the precedent), not now.
- **Boundary finding:** `webapp/src/architecture.test.ts` forbids a feature importing another feature, so `status/` cannot `import { SmsConfirmDialog } from '@features/sms'` as the SMS spec §8 assumed. P2 must either place the dialog in `@shared/ui` (it is generic: recipients in, batch plan out) or have `App.tsx` inject it through a prop. The SMS spec's own „de confirmat cu `arch-guard-webapp`" note is answered: the rule exists.
- „Notificat azi" badge on rows (`GET /api/sms-last-notified`) — also P2.

## Self-review notes

- **Spec coverage:** §2 header (Task 7), §3 cards/toolbar/columns/banner (Tasks 5, 8), §4 cards/heat-map/colors/legend/outline (Tasks 3, 4, 6, 9), §5 criteria 1–2 (Tasks 7, 8; 3 deferred to SMS P2 by RASPUNSURI's ordering).
- **Hard constraint honored:** cards and counters read `evaluations` before any filter (`summarizeMonthStatus(evaluations)`, `segmentCounts` loop), the table reads the filtered list — one function, no second code path.
- **Nothing invented beyond spec:** no avatars, no parent line, no „ziua N", no ⓘ tooltip, no interim navigation for the SMS buttons.
- **Cost:** An școlar evaluates 12 × N obligations with one index only while that mode is active (`useSchoolYearStatus(null)` short-circuits).
