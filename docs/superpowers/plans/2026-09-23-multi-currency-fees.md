# Taxă și achitări în EUR sau MDL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a child's monthly fee and any payment be recorded in EUR or MDL, with `obligation()` and all money aggregates converting correctly using an exchange rate table fed by BNM (Banca Națională a Moldovei) plus manual entry.

**Architecture:** Currency lives per `feeHistory` entry and per `Payment`, defaulting to `'MDL'` for anything that doesn't specify it (no active migration needed). A new `exchangeRates` settings-backed map (date → EUR-to-MDL rate) is the single source of truth for conversion; `obligation()` and every cross-child aggregate resolve a rate through it instead of storing converted amounts. Paid amounts convert at their own payment date's rate (historical fact); unpaid/forward-looking sums convert at the latest known rate (a "what would this cost today" projection).

**Tech Stack:** Node 22 vanilla ESM, `node:sqlite`, `node --test`, no build step, no external npm dependency added (BNM fetch uses the platform `fetch`).

**Spec:** `docs/superpowers/specs/2026-09-23-multi-currency-fees-design.md`

## Global Constraints

- Only two currencies: `'MDL' | 'EUR'`. No other currency, no currency for `expenses`.
- All existing `feeHistory`/`Payment` records without a `currency` field read as `'MDL'` — no destructive migration, no rewritten rows.
- BNM endpoint: `GET https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=DD.MM.YYYY` (note: `DD.MM.YYYY`, not the app's internal `YYYY-MM-DD`). EUR rate is at `<Valute><CharCode>EUR</CharCode><Value>NN.NNNN</Value></Valute>` in the XML response.
- A payment's amount converts using the exchange rate **on the payment's own date** (historical), never "today's rate" — except cross-child sums of money **not yet paid** (e.g. "Sumă de încasat"), which use the **latest known rate** since there is no payment date yet.
- A single child's own row (Taxe și grupe, Situația plăților, De notificat, fișa copilului) always displays in **that child's own currency** — never converted. Only sums across multiple children convert to MDL.
- No rate known at all for a date (and none earlier either) → the affected calculation becomes "unknown" (`null`), same as an incomplete fee today — except Dashboard/aggregate totals, which must always render a number: they fall back to treating the amount as 1:1 (no conversion) rather than failing to display, since a KPI tile can't show "De verificat".
- Server startup fetches today's rate from BNM only if today's date isn't already in the stored map; a failed fetch never blocks startup.

---

## Phase 1 — Domain (pure, TDD)

### Task 1: Currency type and record shapes

**Files:**
- Modify: `src/shared/contracts/record-types.d.mts`

**Interfaces:**
- Produces: `Currency` type (`'MDL' | 'EUR'`), `Child.feeHistory[].currency?: Currency`, `Payment.currency?: Currency`.

- [ ] **Step 1: Add the type and extend the two interfaces**

In `src/shared/contracts/record-types.d.mts`, add near the top (after `export type ChildStatus = ...`):

```typescript
export type Currency = 'MDL' | 'EUR';
```

Change the `Child.feeHistory` field:

```typescript
  feeHistory: { from: MonthKey; amount: number; currency?: Currency }[];
```

Add a field to `Payment` (after `amount: number;`):

```typescript
  amount: number;
  /** Implicit 'MDL' dacă lipsește — vezi normalizeRecord(). */
  currency?: Currency;
  allocations: PaymentAllocation[];
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes (this file has no runtime code, nothing to break yet — other files that read `.currency` don't exist yet).

- [ ] **Step 3: Commit**

```bash
git add src/shared/contracts/record-types.d.mts
git commit -m "feat(types): add Currency and currency fields to feeHistory/Payment"
```

---

### Task 2: Exchange rate domain module

**Files:**
- Create: `src/shared/domain/exchange-rates.mjs`
- Test: `src/shared/domain/exchange-rates.test.mjs`

**Interfaces:**
- Consumes: nothing (pure domain, no imports beyond `cents` from `./money.mjs` for `convertAmount`).
- Produces:
  - `/** @typedef {Record<string, number>} ExchangeRates */` — map of `YYYY-MM-DD` → MDL per 1 EUR.
  - `DEFAULT_EXCHANGE_RATES` (`{}`)
  - `clampExchangeRates(overrides)` → `ExchangeRates`
  - `parseExchangeRates(json)` → `ExchangeRates`
  - `eurToMdlRate(rates, date)` → `number | undefined`
  - `latestKnownRate(rates)` → `number | undefined`
  - `convertAmount(amount, fromCurrency, toCurrency, rate)` → `number | null`
  - `parseBnmEurRate(xmlText)` → `number | null`
  - `bnmDateParam(dateKey)` → `string` (`YYYY-MM-DD` → `DD.MM.YYYY`)

- [ ] **Step 1: Write the failing tests**

Create `src/shared/domain/exchange-rates.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampExchangeRates,
  parseExchangeRates,
  eurToMdlRate,
  latestKnownRate,
  convertAmount,
  parseBnmEurRate,
  bnmDateParam,
} from './exchange-rates.mjs';

test('clampExchangeRates păstrează doar chei dată-validă cu valori numerice pozitive', () => {
  assert.deepEqual(
    clampExchangeRates({ '2026-09-20': 20.1, '2026-13-01': 5, bad: 'x', '2026-09-21': -1, '2026-09-22': 0 }),
    { '2026-09-20': 20.1 },
  );
});

test('clampExchangeRates pe intrare nevalidă întoarce harta goală', () => {
  assert.deepEqual(clampExchangeRates(null), {});
  assert.deepEqual(clampExchangeRates('nu-i obiect'), {});
});

test('parseExchangeRates citește JSON valid și cade pe harta goală la JSON stricat', () => {
  assert.deepEqual(parseExchangeRates('{"2026-09-20":20.1}'), { '2026-09-20': 20.1 });
  assert.deepEqual(parseExchangeRates('{stricat'), {});
  assert.deepEqual(parseExchangeRates(undefined), {});
});

test('eurToMdlRate întoarce cursul zilei exacte când există', () => {
  const rates = { '2026-09-20': 20.1, '2026-09-23': 20.1352 };
  assert.equal(eurToMdlRate(rates, '2026-09-23'), 20.1352);
});

test('eurToMdlRate cade pe cel mai recent curs anterior când ziua exactă lipsește', () => {
  const rates = { '2026-09-18': 19.9, '2026-09-20': 20.1 };
  assert.equal(eurToMdlRate(rates, '2026-09-23'), 20.1);
});

test('eurToMdlRate întoarce undefined când nu există niciun curs anterior', () => {
  const rates = { '2026-09-20': 20.1 };
  assert.equal(eurToMdlRate(rates, '2026-09-18'), undefined);
});

test('eurToMdlRate întoarce undefined pe hartă goală', () => {
  assert.equal(eurToMdlRate({}, '2026-09-23'), undefined);
});

test('latestKnownRate întoarce cursul celei mai recente date cunoscute, indiferent de argument', () => {
  const rates = { '2026-09-18': 19.9, '2026-09-23': 20.1352, '2026-09-20': 20.1 };
  assert.equal(latestKnownRate(rates), 20.1352);
});

test('latestKnownRate pe hartă goală întoarce undefined', () => {
  assert.equal(latestKnownRate({}), undefined);
});

test('convertAmount nu convertește când monedele coincid, indiferent de curs', () => {
  assert.equal(convertAmount(500, 'EUR', 'EUR', undefined), 500);
  assert.equal(convertAmount(500, 'MDL', 'MDL', 20.1), 500);
});

test('convertAmount convertește EUR în MDL cu cursul dat', () => {
  assert.equal(convertAmount(500, 'EUR', 'MDL', 20.1352), 10067.6);
});

test('convertAmount convertește MDL în EUR cu cursul dat', () => {
  assert.equal(convertAmount(10067.6, 'MDL', 'EUR', 20.1352), 500);
});

test('convertAmount întoarce null când monedele diferă și cursul lipsește', () => {
  assert.equal(convertAmount(500, 'EUR', 'MDL', undefined), null);
});

test('parseBnmEurRate citește Value din intrarea EUR a răspunsului XML real BNM', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ValCurs Date="23.09.2026" name="Cursul oficial de schimb">
  <Valute ID="46"><NumCode>840</NumCode><CharCode>USD</CharCode><Nominal>1</Nominal><Name>Dolar SUA</Name><Value>17.8000</Value></Valute>
  <Valute ID="47"><NumCode>978</NumCode><CharCode>EUR</CharCode><Nominal>1</Nominal><Name>Euro</Name><Value>20.1352</Value></Valute>
</ValCurs>`;
  assert.equal(parseBnmEurRate(xml), 20.1352);
});

test('parseBnmEurRate întoarce null când XML-ul nu are o intrare EUR', () => {
  const xml = `<ValCurs Date="23.09.2026"><Valute ID="46"><CharCode>USD</CharCode><Value>17.8</Value></Valute></ValCurs>`;
  assert.equal(parseBnmEurRate(xml), null);
});

test('parseBnmEurRate întoarce null pe text care nu e XML valid', () => {
  assert.equal(parseBnmEurRate('nu-i xml'), null);
  assert.equal(parseBnmEurRate(''), null);
});

test('bnmDateParam transformă YYYY-MM-DD în DD.MM.YYYY, cerut de BNM', () => {
  assert.equal(bnmDateParam('2026-09-23'), '23.09.2026');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/exchange-rates.test.mjs`
Expected: FAIL — `Cannot find module './exchange-rates.mjs'`.

- [ ] **Step 3: Implement**

Create `src/shared/domain/exchange-rates.mjs`:

```javascript
import { cents } from './money.mjs';

/** @typedef {'MDL' | 'EUR'} Currency */
/** @typedef {Record<string, number>} ExchangeRates cheie YYYY-MM-DD, valoare = câte MDL fac 1 EUR */

export const DEFAULT_EXCHANGE_RATES = /** @type {ExchangeRates} */ ({});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Completează și validează o hartă parțială/coruptă: orice cheie care nu e o
 * dată YYYY-MM-DD sau orice valoare care nu e un număr pozitiv finit se
 * elimină, fără să arunce — un curs stricat în settings nu trebuie să oprească
 * nimic, doar să lipsească (eurToMdlRate cade pe cel mai recent curs bun).
 * @param {unknown} overrides
 * @returns {ExchangeRates}
 */
export function clampExchangeRates(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  /** @type {ExchangeRates} */
  const result = {};
  for (const [key, value] of Object.entries(overrides)) {
    const rate = Number(value);
    if (DATE_KEY.test(key) && Number.isFinite(rate) && rate > 0) result[key] = rate;
  }
  return result;
}

/**
 * @param {string | undefined | null} json
 * @returns {ExchangeRates}
 */
export function parseExchangeRates(json) {
  if (!json) return {};
  try {
    return clampExchangeRates(JSON.parse(json));
  } catch {
    return {};
  }
}

/**
 * Cursul zilei exacte, sau al celei mai recente zile anterioare cunoscute —
 * niciodată al unei zile ulterioare (ar însemna să folosești un curs din
 * viitor pentru o plată din trecut).
 * @param {ExchangeRates} rates
 * @param {string} date YYYY-MM-DD
 * @returns {number | undefined}
 */
export function eurToMdlRate(rates, date) {
  if (Object.hasOwn(rates, date)) return rates[date];
  const earlierDates = Object.keys(rates)
    .filter(known => known <= date)
    .sort();
  return earlierDates.length ? rates[earlierDates.at(-1)] : undefined;
}

/**
 * Cursul celei mai recente zile cunoscute, indiferent de dată — folosit pentru
 * sume încă neîncasate (proiecție „cât ar costa azi”, nu un fapt istoric).
 * @param {ExchangeRates} rates
 * @returns {number | undefined}
 */
export function latestKnownRate(rates) {
  const dates = Object.keys(rates).sort();
  return dates.length ? rates[dates.at(-1)] : undefined;
}

/**
 * @param {number} amount
 * @param {Currency} fromCurrency
 * @param {Currency} toCurrency
 * @param {number | undefined} rate MDL per 1 EUR, deja rezolvat de apelant (eurToMdlRate sau latestKnownRate)
 * @returns {number | null} null când monedele diferă și n-a fost dat un curs
 */
export function convertAmount(amount, fromCurrency, toCurrency, rate) {
  if (fromCurrency === toCurrency) return amount;
  if (rate == null) return null;
  if (fromCurrency === 'EUR' && toCurrency === 'MDL') return cents(amount * rate) / 100;
  if (fromCurrency === 'MDL' && toCurrency === 'EUR') return cents(amount / rate) / 100;
  throw new Error(`Monedă nesuportată: ${fromCurrency} → ${toCurrency}`);
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {string} DD.MM.YYYY, formatul cerut de query-ul BNM
 */
export function bnmDateParam(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Citește valoarea EUR din răspunsul XML al BNM
 * (GET /ro/official_exchange_rates?get_xml=1&date=DD.MM.YYYY).
 * @param {string} xmlText
 * @returns {number | null}
 */
export function parseBnmEurRate(xmlText) {
  const match = /<Valute[^>]*>(?:(?!<\/Valute>)[\s\S])*?<CharCode>EUR<\/CharCode>[\s\S]*?<Value>([\d.,]+)<\/Value>[\s\S]*?<\/Valute>/.exec(
    xmlText || '',
  );
  if (!match) return null;
  const rate = Number(match[1].replace(',', '.'));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/exchange-rates.test.mjs`
Expected: PASS, all 17 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/exchange-rates.mjs src/shared/domain/exchange-rates.test.mjs
git commit -m "feat(domain): exchange rate map, conversion and BNM XML parsing"
```

---

### Task 3: `formatMoney` gets a currency parameter

**Files:**
- Modify: `src/shared/format/money-format.mjs`
- Test: `src/shared/format/money-format.test.mjs` (new)

**Interfaces:**
- Produces: `formatMoney(value, currency?: Currency)` — `currency` defaults to `'MDL'`; existing one-argument call sites keep behaving identically.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/format/money-format.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from './money-format.mjs';

test('formatMoney fără al doilea argument rămâne MDL, sufix "lei" — comportament neschimbat', () => {
  assert.equal(formatMoney(2000), '2.000,00 lei');
});

test('formatMoney(v, "MDL") e identic cu apelul fără argument', () => {
  assert.equal(formatMoney(2000, 'MDL'), formatMoney(2000));
});

test('formatMoney(v, "EUR") folosește simbolul €, nu "lei"', () => {
  assert.equal(formatMoney(500, 'EUR'), '500,00 €');
});

test('formatMoney(null, "EUR") rămâne "—", ca la MDL', () => {
  assert.equal(formatMoney(null, 'EUR'), '—');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/format/money-format.test.mjs`
Expected: FAIL — `formatMoney(500, 'EUR')` currently ignores the second argument and returns `'500,00 lei'`, not `'500,00 €'`.

- [ ] **Step 3: Implement**

Replace `src/shared/format/money-format.mjs`:

```javascript
// null = sumă necunoscută, diferit de zero. Vezi obligation() din #shared/domain/tuition-obligation.mjs.
/**
 * @param {number | null} v
 * @param {import('#shared/contracts/record-types.mjs').Currency} [currency]
 */
export const formatMoney = (v, currency = 'MDL') =>
  v === null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) +
      (currency === 'EUR' ? ' €' : ' lei');
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/format/money-format.test.mjs`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Run the full suite to confirm no existing caller broke**

Run: `npm test`
Expected: all existing tests still pass — every current call site calls `formatMoney(value)` with one argument, which now explicitly defaults to `'MDL'` and renders identically to before.

- [ ] **Step 6: Commit**

```bash
git add src/shared/format/money-format.mjs src/shared/format/money-format.test.mjs
git commit -m "feat(format): formatMoney accepts an optional currency (MDL default, EUR shows €)"
```

---

### Task 4: `record-schema.mjs` validates and defaults currency

**Files:**
- Modify: `src/shared/domain/record-schema.mjs`
- Modify: `src/shared/domain/record-schema.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeRecord('children', ...)` sets `currency` on every `feeHistory` entry (default `'MDL'`); `normalizeRecord('payments', ...)` sets `record.currency` (default `'MDL'`).

- [ ] **Step 1: Write the failing tests**

Find the existing children/payments tests in `src/shared/domain/record-schema.test.mjs` (search for `'feeHistory'` and `type === 'payments'` — or `normalizeRecord('payments'`) and add, in the same file:

```javascript
test('normalizeRecord(children) pune currency "MDL" pe o intrare feeHistory fără monedă', () => {
  const record = normalizeRecord('children', {
    id: 'C-1',
    name: 'Ana',
    parent: 'Maria',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 2000, currency: 'MDL' }]);
});

test('normalizeRecord(children) păstrează currency EUR când e trimisă explicit', () => {
  const record = normalizeRecord('children', {
    id: 'C-1',
    name: 'Ana',
    parent: 'Maria',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 500, currency: 'EUR' }]);
});

test('normalizeRecord(children) respinge o monedă necunoscută în feeHistory', () => {
  assert.throws(
    () =>
      normalizeRecord('children', {
        id: 'C-1',
        name: 'Ana',
        parent: 'Maria',
        feeHistory: [{ from: '2026-09', amount: 500, currency: 'USD' }],
      }),
    /monedă/i,
  );
});

test('normalizeRecord(payments) pune currency "MDL" implicit', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
  });
  assert.equal(record.currency, 'MDL');
});

test('normalizeRecord(payments) păstrează currency EUR când e trimisă explicit', () => {
  const record = normalizeRecord('payments', {
    id: 'P-1',
    date: '2026-09-15',
    amount: 500,
    method: 'Cash',
    currency: 'EUR',
  });
  assert.equal(record.currency, 'EUR');
});

test('normalizeRecord(payments) respinge o monedă necunoscută', () => {
  assert.throws(
    () =>
      normalizeRecord('payments', {
        id: 'P-1',
        date: '2026-09-15',
        amount: 500,
        method: 'Cash',
        currency: 'USD',
      }),
    /monedă/i,
  );
});
```

(`assert` and `normalizeRecord` are already imported at the top of this test file — no new import needed.)

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/record-schema.test.mjs`
Expected: FAIL — `feeHistory` entries don't get `currency`, `record.currency` is `undefined` for payments (assertion `equal(undefined, 'MDL')` fails), and no code throws on `currency: 'USD'`.

- [ ] **Step 3: Implement**

In `src/shared/domain/record-schema.mjs`, add near the top (after `STATUS_HISTORY_VALUES`):

```javascript
export const CURRENCIES = ['MDL', 'EUR'];
```

Add `'currency'` to `FIELDS.payments` (the `Set([...])` — insert alongside `'amount'`):

```javascript
    'amount',
    'currency',
    'allocations',
```

In the `feeHistory`/`statusHistory` loop inside the `type === 'children'` branch, change the `for (const historyEntry of record[field])` body — currently:

```javascript
      for (const historyEntry of record[field]) {
        requireThat(
          historyEntry && monthOK(historyEntry.from) && !seen.has(historyEntry.from),
          `${field}: lună invalidă sau repetată.`,
        );
        seen.add(historyEntry.from);
        if (valueKey === 'amount') requireAmount(historyEntry.amount, 'Taxa istorică', true);
        else requireThat(STATUS_HISTORY_VALUES.includes(historyEntry.status), 'Statut istoric invalid.');
      }
```

becomes:

```javascript
      for (const historyEntry of record[field]) {
        requireThat(
          historyEntry && monthOK(historyEntry.from) && !seen.has(historyEntry.from),
          `${field}: lună invalidă sau repetată.`,
        );
        seen.add(historyEntry.from);
        if (valueKey === 'amount') {
          requireAmount(historyEntry.amount, 'Taxa istorică', true);
          historyEntry.currency ??= 'MDL';
          requireThat(CURRENCIES.includes(historyEntry.currency), `${field}: monedă necunoscută.`);
        } else requireThat(STATUS_HISTORY_VALUES.includes(historyEntry.status), 'Statut istoric invalid.');
      }
```

In the `else` branch (non-children/groups/categories/visits, i.e. payments/expenses), right after `requireAmount(record.amount, 'Suma');` and before `if (type === 'payments') {`, this line already exists unchanged. Inside `if (type === 'payments') {`, add the currency default/check right after `record.childId ??= '';` / `text(record.childId, 'ID copil');` (before `record.method ||= 'Cash';` or right after — exact placement doesn't matter as long as it's inside the `if (type === 'payments')` block):

```javascript
    if (type === 'payments') {
      record.childId ??= '';
      text(record.childId, 'ID copil');
      record.currency ??= 'MDL';
      requireThat(CURRENCIES.includes(record.currency), 'Monedă necunoscută.');
      record.method ||= 'Cash';
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/record-schema.test.mjs`
Expected: PASS, including the 6 new tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all green — every existing fixture omits `currency` and now gets `'MDL'` by default, matching old behavior everywhere nothing reads `.currency` yet.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/record-schema.mjs src/shared/domain/record-schema.test.mjs
git commit -m "feat(domain): validate and default currency on feeHistory entries and payments"
```

---

### Task 5: `paymentIndex` groups entries instead of summing them

**Files:**
- Modify: `src/shared/domain/payment-allocations.mjs`
- Modify: `src/shared/domain/payment-allocations.test.mjs`

**Interfaces:**
- Produces: `paymentIndex(payments, asOf)` returns `Map<string, Map<string, { amount: number, currency: Currency, date: string }[]>>` (was `Map<string, Map<string, number>>` — the value is now a list of contributing entries, not a pre-summed cents total, because summing before conversion would discard the date each entry needs for its own historical rate).

- [ ] **Step 1: Write the failing test**

In `src/shared/domain/payment-allocations.test.mjs`, find the existing `paymentIndex` test(s) — search for `paymentIndex(`. Add:

```javascript
test('paymentIndex grupează intrările pe copil și lună fără să le adune, păstrând moneda și data fiecăreia', () => {
  const payments = [
    normalizeRecord('payments', {
      id: 'P-1',
      childId: 'C-1',
      date: '2026-09-05',
      amount: 500,
      currency: 'EUR',
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 500 }],
    }),
    normalizeRecord('payments', {
      id: 'P-2',
      childId: 'C-1',
      date: '2026-09-20',
      amount: 200,
      currency: 'MDL',
      method: 'Card',
      allocations: [{ month: '2026-09', amount: 200 }],
    }),
  ];

  const index = paymentIndex(payments, '2026-09-30');

  assert.deepEqual(index.get('C-1').get('2026-09'), [
    { amount: 500, currency: 'EUR', date: '2026-09-05' },
    { amount: 200, currency: 'MDL', date: '2026-09-20' },
  ]);
});
```

This requires `normalizeRecord` imported in the test file — check the top of `payment-allocations.test.mjs`; if it isn't already imported, add:

```javascript
import { normalizeRecord } from './record-schema.mjs';
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/payment-allocations.test.mjs`
Expected: FAIL — the current implementation returns `700` (a summed cents-derived number) at that key, not an array.

- [ ] **Step 3: Implement**

Replace `paymentIndex` in `src/shared/domain/payment-allocations.mjs`:

```javascript
// Cât s-a încasat, pe copil și pe lună, calculat o singură dată. Fiecare intrare
// își păstrează moneda și data — nu se adună aici, ca obligation() să poată
// converti fiecare la cursul zilei ei, nu la un curs unic pentru toată luna.
// Fără index, obligation() reciteşte toate plățile pentru fiecare copil, deci
// un tabel cu N copii și M plăți costă N×M. asOf nedefinit înseamnă „fără limită de dată”.
export function paymentIndex(payments, asOf) {
  const index = new Map();
  for (const p of payments) {
    if (p.archived || !p.childId || (asOf && p.date > asOf)) continue;
    let months = index.get(p.childId);
    if (!months) index.set(p.childId, (months = new Map()));
    for (const a of allocations(p)) {
      const list = months.get(a.month) ?? [];
      list.push({ amount: a.amount, currency: p.currency || 'MDL', date: p.date });
      months.set(a.month, list);
    }
  }
  return index;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/payment-allocations.test.mjs`
Expected: PASS.

- [ ] **Step 5: Do not run the full suite yet**

`obligation()` (Task 6) still expects the old cents-number shape from `paymentIndex` — the full suite will fail until Task 6 is done. That's expected; both tasks land in the same next commit boundary is fine since Task 6 follows immediately, but commit Task 5 on its own first so the history stays bisectable per-file.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/payment-allocations.mjs src/shared/domain/payment-allocations.test.mjs
git commit -m "feat(domain): paymentIndex groups entries by currency+date instead of pre-summing"
```

---

### Task 6: `obligation()` becomes currency-aware

**Files:**
- Modify: `src/shared/domain/tuition-obligation.mjs`
- Modify: `src/shared/domain/tuition-obligation.test.mjs`

**Interfaces:**
- Consumes: `eurToMdlRate`, `convertAmount` from `./exchange-rates.mjs` (Task 2); the new `paymentIndex` shape from Task 5.
- Produces: `obligation(child, month, payments, asOf, index, rates)` — new 6th parameter `rates` (`ExchangeRates`, defaults to `{}`). Return shape unchanged (`{ expected, paid, rest, credit, due, label, notify, daysToDue }`), except `expected`/`paid`/`rest`/`credit` can now be `null` when a cross-currency conversion has no rate to use (folds into the existing "De verificat" / unknown path). Amounts are in the **child's own fee currency** for that month, never converted to MDL.

- [ ] **Step 1: Write the failing tests**

In `src/shared/domain/tuition-obligation.test.mjs`, add (near the existing `child()`/`payment()` fixture helpers at the top, which the plan reuses):

```javascript
test('obligation: taxă EUR, achitare EUR — fără conversie, scade direct', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const eurPayment = normalizeRecord('payments', {
    id: 'P-EUR',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 300,
    currency: 'EUR',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 300 }],
  });

  const result = obligation(eurChild, '2026-09', [eurPayment], '2026-09-30');

  assert.equal(result.expected, 500);
  assert.equal(result.paid, 300);
  assert.equal(result.rest, 200);
});

test('obligation: taxă EUR, achitare MDL — convertește MDL în EUR cu cursul zilei achitării', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 2013.52,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2013.52 }],
  });
  const rates = { '2026-09-10': 20.1352 };

  const result = obligation(eurChild, '2026-09', [mdlPayment], '2026-09-30', null, rates);

  assert.equal(result.expected, 500);
  assert.equal(result.paid, 100);
  assert.equal(result.rest, 400);
});

test('obligation: conversie folosește cursul zilei achitării, nu al zilei "asOf"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-05',
    amount: 1000,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 1000 }],
  });
  // Curs diferit la data plății față de curs "azi" — trebuie folosit cel de la 09-05.
  const rates = { '2026-09-05': 20, '2026-09-30': 25 };

  const result = obligation(eurChild, '2026-09', [mdlPayment], '2026-09-30', null, rates);

  assert.equal(result.paid, 50); // 1000 / 20, nu 1000 / 25
});

test('obligation: fără niciun curs cunoscut pentru o conversie necesară, obligația devine "De verificat"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 1000,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 1000 }],
  });

  const result = obligation(eurChild, '2026-09', [mdlPayment], '2026-09-30', null, {});

  assert.equal(result.expected, null);
  assert.equal(result.paid, null);
  assert.equal(result.rest, null);
  assert.equal(result.label, 'De verificat');
});

test('obligation cu index (calea rapidă) dă același rezultat ca fără index, cu conversie', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 2013.52,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2013.52 }],
  });
  const rates = { '2026-09-10': 20.1352 };
  const index = paymentIndex([mdlPayment], '2026-09-30');

  const withIndex = obligation(eurChild, '2026-09', [mdlPayment], '2026-09-30', index, rates);
  const withoutIndex = obligation(eurChild, '2026-09', [mdlPayment], '2026-09-30', null, rates);

  assert.equal(withIndex.paid, withoutIndex.paid);
  assert.equal(withIndex.paid, 100);
});

test('obligation: fișă existentă fără currency (date vechi) se comportă ca MDL, neschimbat', () => {
  const legacyChild = normalizeRecord('children', {
    id: 'C-OLD',
    name: 'Maria',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  const legacyPayment = normalizeRecord('payments', {
    id: 'P-OLD',
    childId: 'C-OLD',
    date: '2026-09-10',
    amount: 2000,
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2000 }],
  });

  const result = obligation(legacyChild, '2026-09', [legacyPayment], '2026-09-30');

  assert.equal(result.expected, 2000);
  assert.equal(result.paid, 2000);
  assert.equal(result.rest, 0);
  assert.equal(result.label, 'Plătit');
});
```

Add the two new imports at the top of the test file alongside the existing ones:

```javascript
import { paymentIndex } from './payment-allocations.mjs';
```

(`normalizeRecord`, `obligation` are already imported in this file per the existing header.)

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/tuition-obligation.test.mjs`
Expected: FAIL on the new tests — `obligation()` doesn't accept a `rates` argument yet and still treats `index`'s per-month value as a number (`(index.get(...)?.get(...) || 0) / 100`), which after Task 5 is now an array and would produce `NaN`/wrong results.

- [ ] **Step 3: Implement**

Replace the top imports and the `paid`/`unknown`/`expected` section of `src/shared/domain/tuition-obligation.mjs`:

```javascript
import { today, shiftDays, daysBetween } from './calendar-month.mjs';
import { cents } from './money.mjs';
import { allocations } from './payment-allocations.mjs';
import { eurToMdlRate, convertAmount } from './exchange-rates.mjs';
```

Add this helper above `obligation` (after the `dueDayFor` function, before the `obligation` JSDoc):

```javascript
// Sumează o listă de intrări (din paymentIndex, sau construită direct din
// `payments` când nu există index) în moneda taxei, convertind fiecare la
// cursul zilei EI, nu la un curs unic pentru toată suma — altfel două plăți
// din zile cu curs diferit s-ar aduna greșit.
/**
 * @param {{ amount: number, currency: import('#shared/contracts/record-types.mjs').Currency, date: string }[]} entries
 * @param {import('#shared/contracts/record-types.mjs').Currency} targetCurrency
 * @param {import('./exchange-rates.mjs').ExchangeRates} rates
 * @returns {number | null}
 */
function sumEntriesInCurrency(entries, targetCurrency, rates) {
  let sumCents = 0;
  for (const entry of entries) {
    const converted =
      entry.currency === targetCurrency
        ? entry.amount
        : convertAmount(entry.amount, entry.currency, targetCurrency, eurToMdlRate(rates, entry.date));
    if (converted === null) return null;
    sumCents += cents(converted);
  }
  return sumCents / 100;
}
```

Change the `obligation` function signature and body. Current:

```javascript
export function obligation(child, month, payments, asOf = today(), index = null) {
  const start = child.attendanceDate?.slice(0, 7),
    end = child.withdrawalDate?.slice(0, 7);
  const history = [...(child.statusHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(r => r.from <= month);
  const status = history.at(-1)?.status || (!child.statusHistory?.length && child.status === 'Activ' ? 'Activ' : null);
  const paid = index
    ? (index.get(child.id)?.get(month) || 0) / 100
    : payments
        .filter(p => !p.archived && p.childId === child.id && p.date <= asOf)
        .reduce(
          (sum, p) =>
            sum +
            allocations(p)
              .filter(a => a.month === month)
              .reduce((n, a) => n + cents(a.amount), 0),
          0,
        ) / 100;
  const inactive = (start && month < start) || (end && month > end) || status === 'Suspendat' || status === 'Retras';
  const fees = [...(child.feeHistory || [])].sort((a, b) => a.from.localeCompare(b.from));
  // O taxă curentă fără dată de aplicare nu se aplică niciodată lunilor trecute.
  const fee = fees.filter(f => f.from <= month).at(-1)?.amount ?? null;
  const unknown = !inactive && (!start || !status || fee === null);
```

Becomes:

```javascript
export function obligation(child, month, payments, asOf = today(), index = null, rates = {}) {
  const start = child.attendanceDate?.slice(0, 7),
    end = child.withdrawalDate?.slice(0, 7);
  const history = [...(child.statusHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(r => r.from <= month);
  const status = history.at(-1)?.status || (!child.statusHistory?.length && child.status === 'Activ' ? 'Activ' : null);
  const inactive = (start && month < start) || (end && month > end) || status === 'Suspendat' || status === 'Retras';
  const fees = [...(child.feeHistory || [])].sort((a, b) => a.from.localeCompare(b.from));
  // O taxă curentă fără dată de aplicare nu se aplică niciodată lunilor trecute.
  const feeEntry = fees.filter(f => f.from <= month).at(-1) ?? null;
  const fee = feeEntry?.amount ?? null;
  const feeCurrency = feeEntry?.currency ?? 'MDL';
  const paidEntries = index
    ? (index.get(child.id)?.get(month) ?? [])
    : payments
        .filter(p => !p.archived && p.childId === child.id && p.date <= asOf)
        .flatMap(p =>
          allocations(p)
            .filter(a => a.month === month)
            .map(a => ({ amount: a.amount, currency: p.currency || 'MDL', date: p.date })),
        );
  const paid = sumEntriesInCurrency(paidEntries, feeCurrency, rates);
  const unknown = !inactive && (!start || !status || fee === null || paid === null);
```

The rest of the function (from `const expected = inactive ? 0 : unknown ? null : fee;` down to the `return` statement) is unchanged — it already treats `expected`/`rest`/`credit`/`label` correctly as soon as `unknown` is `true`, and `paid === null` now feeds into `unknown` exactly like `fee === null` already did.

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/tuition-obligation.test.mjs`
Expected: PASS, all tests green including the 6 new ones and every pre-existing test (they all use MDL-implicit fixtures with no `rates` argument, so `rates = {}` default plus `feeCurrency === paidEntries[].currency === 'MDL'` never needs a real rate — identical numbers to before).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: FAIL only in `month-evaluation.test.mjs` (Task 7 fixes it) and any file that calls `obligation()`/`paymentIndex()` directly with the old assumptions — note exactly which files fail, they're the remaining tasks in this plan (`cash-summary`, `child-profile.view`, `payment-status.view`/`notify-list.view` integration paths). This is expected mid-plan breakage; each subsequent task fixes its slice.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/tuition-obligation.mjs src/shared/domain/tuition-obligation.test.mjs
git commit -m "feat(domain): obligation() converts paid amounts using the payment date's rate"
```

---

### Task 7: Thread `rates` through `evaluateChildrenForMonth`

**Files:**
- Modify: `src/features/billing/domain/month-evaluation.mjs`
- Modify: `src/features/billing/domain/month-evaluation.test.mjs`

**Interfaces:**
- Consumes: `obligation()` new signature (Task 6).
- Produces: `evaluateChildrenForMonth(records, month, asOf, rates)` — new 4th parameter, defaults to `{}`.

- [ ] **Step 1: Write the failing test**

In `src/features/billing/domain/month-evaluation.test.mjs`, add a test alongside the existing ones (reuse whatever child/payment fixture helpers already exist in that file — if none, build inline with `normalizeRecord` like Task 6's tests):

```javascript
test('evaluateChildrenForMonth trece cursul mai departe la obligation() pentru conversie', () => {
  const records = {
    children: [
      normalizeRecord('children', {
        id: 'C-EUR',
        name: 'Ion',
        status: 'Activ',
        attendanceDate: '2026-09-01',
        feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
      }),
    ],
    payments: [
      normalizeRecord('payments', {
        id: 'P-MDL',
        childId: 'C-EUR',
        date: '2026-09-10',
        amount: 2013.52,
        currency: 'MDL',
        method: 'Cash',
        allocations: [{ month: '2026-09', amount: 2013.52 }],
      }),
    ],
  };
  const rates = { '2026-09-10': 20.1352 };

  const [evaluation] = evaluateChildrenForMonth(records, '2026-09', '2026-09-30', rates);

  assert.equal(evaluation.obligation.paid, 100);
});
```

Add `import { normalizeRecord } from '#shared/domain/record-schema.mjs';` at the top if not already present.

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/billing/domain/month-evaluation.test.mjs`
Expected: FAIL — `evaluateChildrenForMonth` doesn't accept a 4th argument, `paid` comes back `null` (no rate reaches `obligation()`).

- [ ] **Step 3: Implement**

Replace `src/features/billing/domain/month-evaluation.mjs`:

```javascript
import { today } from '#shared/domain/calendar-month.mjs';
import { paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */
/** @typedef {ReturnType<typeof obligation>} ChildObligation */
/** @typedef {{ child: Child, obligation: ChildObligation }} ChildMonthEvaluation */

// Dashboard, Situația plăților și De notificat au nevoie de aceiași copii
// evaluați pe aceeași lună; indexul de încasări e calculat o singură dată aici,
// altfel obligation() ar reciti toate plățile pentru fiecare copil (N×M).
/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 * @param {string} [asOf]
 * @param {ExchangeRates} [rates]
 * @returns {ChildMonthEvaluation[]}
 */
export function evaluateChildrenForMonth(records, month, asOf = today(), rates = {}) {
  const index = paymentIndex(records.payments, asOf);
  return records.children.map(child => ({
    child,
    obligation: obligation(child, month, records.payments, asOf, index, rates),
  }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/billing/domain/month-evaluation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/domain/month-evaluation.mjs src/features/billing/domain/month-evaluation.test.mjs
git commit -m "feat(billing): thread exchange rates through evaluateChildrenForMonth"
```

---

### Task 8: `cash-summary.mjs` converts to MDL for Dashboard totals

**Files:**
- Modify: `src/features/dashboard/domain/cash-summary.mjs`
- Modify: `src/features/dashboard/domain/cash-summary.test.mjs`

**Interfaces:**
- Consumes: `eurToMdlRate`, `convertAmount` from `#shared/domain/exchange-rates.mjs`.
- Produces: `summarizeCashForMonth(records, month, rates)` and `sumUnallocatedAdvance(payments, asOf, rates)` — new 3rd parameter each, defaults to `{}`. A payment's amount converts using **its own date's** rate (these are actual receipts, a historical fact — same rule as `obligation()`'s `paid`). If no rate is ever known for that date, the amount is used unconverted (1:1) rather than dropped, since a Dashboard total must always show a number — this only matters in the narrow window before the very first rate is ever recorded.

- [ ] **Step 1: Write the failing tests**

In `src/features/dashboard/domain/cash-summary.test.mjs`, add (reuse existing import style — check the file's top for how it currently builds fixtures, likely `normalizeRecord` from `#shared/domain/record-schema.mjs`; add that import if missing):

```javascript
test('summarizeCashForMonth convertește o plată EUR în MDL cu cursul zilei ei', () => {
  const records = {
    payments: [
      normalizeRecord('payments', {
        id: 'P-EUR',
        childId: 'C-1',
        date: '2026-09-10',
        amount: 100,
        currency: 'EUR',
        method: 'Cash',
        allocations: [{ month: '2026-09', amount: 100 }],
      }),
    ],
    expenses: [],
  };
  const rates = { '2026-09-10': 20 };

  const summary = summarizeCashForMonth(records, '2026-09', rates);

  assert.equal(summary.income, 2000); // 100 EUR * 20
});

test('summarizeCashForMonth fără curs cunoscut nu convertește (1:1), nu exclude plata', () => {
  const records = {
    payments: [
      normalizeRecord('payments', {
        id: 'P-EUR',
        childId: 'C-1',
        date: '2026-09-10',
        amount: 100,
        currency: 'EUR',
        method: 'Cash',
        allocations: [{ month: '2026-09', amount: 100 }],
      }),
    ],
    expenses: [],
  };

  const summary = summarizeCashForMonth(records, '2026-09', {});

  assert.equal(summary.income, 100);
});

test('summarizeCashForMonth pe plăți MDL rămâne exact ca înainte, fără rates', () => {
  const records = {
    payments: [
      normalizeRecord('payments', {
        id: 'P-MDL',
        childId: 'C-1',
        date: '2026-09-10',
        amount: 2000,
        method: 'Cash',
        allocations: [{ month: '2026-09', amount: 2000 }],
      }),
    ],
    expenses: [],
  };

  const summary = summarizeCashForMonth(records, '2026-09');

  assert.equal(summary.income, 2000);
});

test('sumUnallocatedAdvance convertește avansul unei plăți EUR cu cursul zilei ei', () => {
  const payments = [
    normalizeRecord('payments', {
      id: 'P-EUR',
      childId: 'C-1',
      date: '2026-09-10',
      amount: 100,
      currency: 'EUR',
      method: 'Cash',
      allocations: [],
    }),
  ];
  const rates = { '2026-09-10': 20 };

  assert.equal(sumUnallocatedAdvance(payments, '2026-09-30', rates), 2000);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/dashboard/domain/cash-summary.test.mjs`
Expected: FAIL — `income`/advance come back as raw EUR numbers (100), not converted.

- [ ] **Step 3: Implement**

Replace `src/features/dashboard/domain/cash-summary.mjs`:

```javascript
import { cents, total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { eurToMdlRate, convertAmount } from '#shared/domain/exchange-rates.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */

// O plată deja încasată e un fapt istoric: convertită cu cursul zilei EI, nu al
// azi. Fără niciun curs cunoscut vreodată pentru acea zi, suma nu se convertește
// (rămâne 1:1) — un total de dashboard trebuie să arate mereu un număr, nu poate
// cădea pe „De verificat” ca fișa unui singur copil.
/**
 * @param {number} amount
 * @param {import('#shared/contracts/record-types.mjs').Currency} currency
 * @param {string} date
 * @param {ExchangeRates} rates
 */
function toMdl(amount, currency, date, rates) {
  if (currency === 'MDL') return amount;
  const converted = convertAmount(amount, currency, 'MDL', eurToMdlRate(rates, date));
  return converted ?? amount;
}

/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 * @param {ExchangeRates} [rates]
 */
export function summarizeCashForMonth(records, month, rates = {}) {
  const payments = records.payments.filter(p => !p.archived && p.date.startsWith(month));
  const income =
    total(
      payments.map(p => ({ amount: toMdl(p.amount, /** @type {any} */ (p).currency || 'MDL', p.date, rates) })),
    );
  const byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
  for (const p of payments) {
    const paymentCurrency = /** @type {any} */ (p).currency || 'MDL';
    for (const part of paymentTenders(p)) {
      const method = Object.hasOwn(byMethod, part.method) ? part.method : 'Altele';
      byMethod[method] += cents(toMdl(part.amount, paymentCurrency, p.date, rates));
    }
  }
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  const expense = total(records.expenses.filter(p => !p.archived && p.date.startsWith(month)));
  return { income, expense, net: (cents(income) - cents(expense)) / 100, byMethod };
}

// Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
/**
 * @param {Payment[]} payments
 * @param {string} asOf
 * @param {ExchangeRates} [rates]
 */
export function sumUnallocatedAdvance(payments, asOf, rates = {}) {
  return (
    payments
      // Fără copil asociat, plata nu e a nimănui — nu e un avans de scăzut din obligația cuiva.
      .filter(p => !p.archived && p.childId && p.date <= asOf)
      .reduce((sum, p) => {
        const currency = /** @type {any} */ (p).currency || 'MDL';
        const unallocated = cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0);
        return sum + cents(toMdl(unallocated / 100, currency, p.date, rates));
      }, 0) / 100
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/dashboard/domain/cash-summary.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/domain/cash-summary.mjs src/features/dashboard/domain/cash-summary.test.mjs
git commit -m "feat(dashboard): convert EUR payments to MDL for aggregate totals"
```

---

## Phase 2 — Server: exchange rate storage and BNM fetch

### Task 9: BNM fetch service (server-side, fetch-injected)

**Files:**
- Create: `src/app/server/bnm-exchange-rate.mjs`
- Test: `src/app/server/bnm-exchange-rate.test.mjs`

**Interfaces:**
- Consumes: `bnmDateParam`, `parseBnmEurRate` from `#shared/domain/exchange-rates.mjs` (Task 2).
- Produces: `fetchBnmEurRate({ fetch, date })` → `Promise<{ rate: number } | { error: string }>` — never throws.

- [ ] **Step 1: Write the failing tests**

Create `src/app/server/bnm-exchange-rate.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

test('fetchBnmEurRate cere URL-ul BNM cu data în format DD.MM.YYYY și întoarce cursul', async () => {
  const calls = [];
  const fetch = async url => {
    calls.push(String(url));
    return { ok: true, text: async () => XML_WITH_EUR };
  };

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.deepEqual(result, { rate: 20.1352 });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /get_xml=1/);
  assert.match(calls[0], /date=23\.09\.2026/);
});

test('fetchBnmEurRate întoarce eroare când fetch aruncă (fără internet)', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});

test('fetchBnmEurRate întoarce eroare pe răspuns HTTP nereușit', async () => {
  const fetch = async () => ({ ok: false, status: 503, text: async () => '' });

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});

test('fetchBnmEurRate întoarce eroare când XML-ul nu are o intrare EUR', async () => {
  const fetch = async () => ({ ok: true, text: async () => '<ValCurs></ValCurs>' });

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/app/server/bnm-exchange-rate.test.mjs`
Expected: FAIL — `Cannot find module './bnm-exchange-rate.mjs'`.

- [ ] **Step 3: Implement**

Create `src/app/server/bnm-exchange-rate.mjs`:

```javascript
import { bnmDateParam, parseBnmEurRate } from '#shared/domain/exchange-rates.mjs';

const BNM_ROOT = 'https://www.bnm.md/ro/official_exchange_rates';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Cere cursul EUR→MDL oficial al BNM pentru o zi. Nu aruncă niciodată — orice
 * eșec (rețea, HTTP, XML fără EUR) întoarce `{ error }`, ca pornirea
 * serverului sau apăsarea „Reîmprospătează" să nu se blocheze.
 * @param {{ fetch: typeof fetch, date: string }} args YYYY-MM-DD
 * @returns {Promise<{ rate: number } | { error: string }>}
 */
export async function fetchBnmEurRate({ fetch: fetchImpl, date }) {
  const url = `${BNM_ROOT}?get_xml=1&date=${bnmDateParam(date)}`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return { error: `BNM a răspuns cu eroare HTTP ${response.status}.` };
    const xml = await response.text();
    const rate = parseBnmEurRate(xml);
    if (rate === null) return { error: 'Răspunsul BNM nu conține un curs EUR valid.' };
    return { rate };
  } catch (error) {
    return { error: 'Fără internet sau BNM indisponibil: ' + (/** @type {Error} */ (error).message || 'eroare necunoscută') };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/app/server/bnm-exchange-rate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/server/bnm-exchange-rate.mjs src/app/server/bnm-exchange-rate.test.mjs
git commit -m "feat(server): BNM exchange rate fetch, fetch-injected and error-safe"
```

---

### Task 10: Exchange rate routes (GET, manual POST, refresh)

**Files:**
- Create: `src/app/server/exchange-rates.routes.mjs`
- Test: `src/app/server/exchange-rates.routes.integration.test.mjs`

**Interfaces:**
- Consumes: `readSetting`, `writeSetting` (same shape as `notification-settings.routes.mjs`); `fetchBnmEurRate` (Task 9); `parseExchangeRates`, `clampExchangeRates` (Task 2); `today` from `#shared/domain/calendar-month.mjs`.
- Produces: three routes — `GET /api/exchange-rates`, `POST /api/exchange-rates` (body `{ date, rate }`, upserts one entry), `POST /api/exchange-rates/refresh` (fetches today's rate from BNM and stores it).

- [ ] **Step 1: Write the failing tests**

Create `src/app/server/exchange-rates.routes.integration.test.mjs`, mirroring the pattern used across the codebase's route integration tests (`startTestApplication`):

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '../../../tests/support/start-test-application.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

test('GET /api/exchange-rates întoarce harta goală când nu există nimic salvat', async t => {
  const { get } = await startTestApplication(t);

  const rates = await get('/api/exchange-rates');

  assert.deepEqual(rates, {});
});

test('POST /api/exchange-rates adaugă manual cursul unei zile', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  assert.equal(status, 200);
  assert.deepEqual(body, { '2026-09-20': 20.1 });
  assert.deepEqual(await get('/api/exchange-rates'), { '2026-09-20': 20.1 });
});

test('POST /api/exchange-rates suprascrie cursul unei zile deja existente', async t => {
  const { post } = await startTestApplication(t);
  await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  const { body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.5 });

  assert.deepEqual(body, { '2026-09-20': 20.5 });
});

test('POST /api/exchange-rates respinge o dată sau un curs invalid', async t => {
  const { post } = await startTestApplication(t);

  const badDate = await post('/api/exchange-rates', { date: 'nu-i dată', rate: 20.1 });
  const badRate = await post('/api/exchange-rates', { date: '2026-09-20', rate: -5 });

  assert.equal(badDate.status, 400);
  assert.equal(badRate.status, 400);
});

test('POST /api/exchange-rates/refresh cere BNM și salvează cursul de azi', async t => {
  const fetch = async () => ({ ok: true, text: async () => XML_WITH_EUR });
  const { post, get } = await startTestApplication(t, { fetch });

  const { status, body } = await post('/api/exchange-rates/refresh', {});

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  const rates = await get('/api/exchange-rates');
  assert.equal(Object.keys(rates).length, 1);
  assert.equal(Object.values(rates)[0], 20.1352);
});

test('POST /api/exchange-rates/refresh întoarce eroare fără să blocheze serverul, când BNM e indisponibil', async t => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const { post } = await startTestApplication(t, { fetch });

  const { status, body } = await post('/api/exchange-rates/refresh', {});

  assert.equal(status, 200); // ruta răspunde normal, doar ok:false — nu 500
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, 'string');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/app/server/exchange-rates.routes.integration.test.mjs`
Expected: FAIL — `404` on every request (route doesn't exist, isn't wired into `create-application.mjs` yet).

- [ ] **Step 3: Implement the routes file**

Create `src/app/server/exchange-rates.routes.mjs`:

```javascript
import { fail } from '#core/server/errors/domain-error.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { parseExchangeRates, clampExchangeRates } from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {{ readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void, fetch: typeof fetch }} dependencies
 */
export function createExchangeRatesRoutes({ readSetting, writeSetting, fetch: fetchImpl }) {
  const readRates = () => parseExchangeRates(readSetting('exchangeRates'));
  const saveRates = rates => writeSetting('exchangeRates', JSON.stringify(rates));

  return [
    { method: 'GET', path: '/api/exchange-rates', handle: () => readRates() },
    {
      method: 'POST',
      path: '/api/exchange-rates',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const date = body?.date;
        const rate = Number(body?.rate);
        if (!DATE_KEY.test(date)) fail('Dată invalidă. Folosește AAAA-LL-ZZ.');
        if (!Number.isFinite(rate) || rate <= 0) fail('Curs invalid. Folosește un număr pozitiv.');
        const after = clampExchangeRates({ ...readRates(), [date]: rate });
        saveRates(after);
        return after;
      },
    },
    {
      method: 'POST',
      path: '/api/exchange-rates/refresh',
      handle: async () => {
        const date = today();
        const result = await fetchBnmEurRate({ fetch: fetchImpl, date });
        if ('error' in result) return { ok: false, error: result.error };
        const after = clampExchangeRates({ ...readRates(), [date]: result.rate });
        saveRates(after);
        return { ok: true, rates: after };
      },
    },
  ];
}
```

- [ ] **Step 4: Wire the routes into `create-application.mjs`**

Add the import near the other route imports (alphabetically close to `notification-settings.routes.mjs`):

```javascript
import { createExchangeRatesRoutes } from './exchange-rates.routes.mjs';
```

Add to the `routes` array, after the `createNotificationSettingsRoutes({...})` block (before the closing `];`):

```javascript
    ...createExchangeRatesRoutes({
      readSetting,
      writeSetting: settings.setSetting,
      fetch: options.fetch ?? globalThis.fetch,
    }),
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test src/app/server/exchange-rates.routes.integration.test.mjs`
Expected: PASS, all 6 tests green.

- [ ] **Step 6: Run the full suite**

Run: `npm run check`
Expected: green (format, typecheck, full test suite).

- [ ] **Step 7: Commit**

```bash
git add src/app/server/exchange-rates.routes.mjs src/app/server/exchange-rates.routes.integration.test.mjs src/app/server/create-application.mjs
git commit -m "feat(server): exchange rate routes (read, manual entry, BNM refresh)"
```

---

### Task 11: Fetch today's rate automatically at server startup

**Files:**
- Modify: `src/app/server/main.mjs`
- Test: manual verification only (this is a startup side-effect on a real `createApplication()`; the underlying `fetchBnmEurRate` and route are already unit/integration-tested in Tasks 9–10 — a startup-timing test would mostly duplicate those without adding real coverage, so this task is verified by reading the code path and the existing test suite staying green, not a new automated test).

**Interfaces:**
- Consumes: `parseExchangeRates` (Task 2), `fetchBnmEurRate` (Task 9).

- [ ] **Step 1: Read the current startup block**

Open `src/app/server/main.mjs` — actual file is `src/app/server/main.mjs`? No: re-check — the deferred-startup block (backup + expireHealthNotes) lives in `startServer()`, which this plan's Task 1 recon found in `src/app/server/main.mjs`. Locate:

```javascript
    setTimeout(() => {
      try {
        app.backup('pornire');
      } catch (e) {
        console.error('Backup la pornire: ' + /** @type {Error} */ (e).message);
      }
      try {
        app.expireHealthNotes();
      } catch (e) {
        console.error('Expirare date medicale: ' + /** @type {Error} */ (e).message);
      }
    }, 0);
```

- [ ] **Step 2: Add the exchange rate refresh, only when today's rate is missing**

This needs `readSetting`/`writeSetting` and `fetch`, which `startServer()` doesn't currently have in scope — they're built inside `createApplication()`. Add a new method to the object `createApplication()` returns, so `startServer()` can call it without reaching into internals.

In `src/app/server/create-application.mjs`, add the import (if not already added by Task 10):

```javascript
import { parseExchangeRates, clampExchangeRates } from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
```

Add a function near the bottom of `createApplication`, before the `return { server, db, ... }` statement:

```javascript
  // Apelat o dată la pornire (main.mjs): dacă ziua curentă n-are deja un curs
  // salvat, îl cere de la BNM. Nu aruncă niciodată — un eșec doar lasă cursul
  // lipsă, tratat de eurToMdlRate() prin căderea pe ultima zi cunoscută.
  async function refreshExchangeRateIfMissing() {
    const date = today();
    const current = parseExchangeRates(readSetting('exchangeRates'));
    if (Object.hasOwn(current, date)) return;
    const result = await fetchBnmEurRate({ fetch: options.fetch ?? globalThis.fetch, date });
    if ('error' in result) {
      console.error('Curs BNM la pornire: ' + result.error);
      return;
    }
    settings.setSetting('exchangeRates', JSON.stringify(clampExchangeRates({ ...current, [date]: result.rate })));
  }
```

Add `refreshExchangeRateIfMissing` to the returned object:

```javascript
  return {
    server,
    db,
    database: dbFile,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    health: backups.health,
    expireHealthNotes: visitsService.expireHealthNotes,
    refreshExchangeRateIfMissing,
    envelope: recordRepository.readEnvelope,
    close: () => ...
```

- [ ] **Step 3: Call it from the startup block in `main.mjs`**

In the `setTimeout(() => { ... }, 0)` block, add alongside the existing two `try`/`catch` blocks:

```javascript
      try {
        app.refreshExchangeRateIfMissing();
      } catch (e) {
        console.error('Curs BNM la pornire: ' + /** @type {Error} */ (e).message);
      }
```

(This is fire-and-forget like the surrounding calls — `refreshExchangeRateIfMissing` is `async` and already catches its own errors internally, so the outer `try`/`catch` here only guards against a synchronous throw before the first `await`, matching the defensive style already used for `app.backup`/`app.expireHealthNotes`.)

- [ ] **Step 4: Run the full suite**

Run: `npm run check`
Expected: green — nothing existing calls `refreshExchangeRateIfMissing`, so no test needs updating; `createApplication()`'s new return field is purely additive.

- [ ] **Step 5: Commit**

```bash
git add src/app/server/create-application.mjs src/app/server/main.mjs
git commit -m "feat(server): fetch today's exchange rate at startup when missing"
```

---

## Phase 3 — Client: store, settings screen, and screen-by-screen currency support

### Task 12: Exchange rates client store

**Files:**
- Create: `src/app/web/exchange-rates-store.mjs`

**Interfaces:**
- Consumes: `requestJson` (already used by every other store in `app/web`).
- Produces: `createExchangeRatesStore({ requestJson })` → `{ get rates(), load(), save({ date, rate }), refresh() }`, mirroring `notification-preferences-store.mjs` exactly.

- [ ] **Step 1: Implement (no test — this is a thin fetch wrapper with no branching logic, same as `notification-preferences-store.mjs`, which also has no test file; behavior is covered end-to-end by the routes integration tests in Task 10 plus manual browser verification in Task 16)**

Create `src/app/web/exchange-rates-store.mjs`:

```javascript
/** @typedef {import('#shared/domain/exchange-rates.mjs').ExchangeRates} ExchangeRates */

/**
 * Cache client al cursurilor de schimb (`/api/exchange-rates`), citit de
 * ecranul „Curs valutar” și de orice calcul care are nevoie de conversie
 * EUR↔MDL (Dashboard, Situația plăților, De notificat, fișa copilului).
 * @param {{ requestJson: (path: string, body?: unknown) => Promise<any> }} dependencies
 */
export function createExchangeRatesStore({ requestJson }) {
  /** @type {ExchangeRates} */
  let rates = {};

  return {
    get rates() {
      return rates;
    },
    async load() {
      rates = await requestJson('/api/exchange-rates');
      return rates;
    },
    /** @param {{ date: string, rate: number }} entry */
    async save(entry) {
      rates = await requestJson('/api/exchange-rates', entry);
      return rates;
    },
    async refresh() {
      const result = await requestJson('/api/exchange-rates/refresh', {});
      if (result.ok) rates = result.rates;
      return result;
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/web/exchange-rates-store.mjs
git commit -m "feat(app): exchange rates client store"
```

---

### Task 13: "Curs valutar" settings screen

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles/layout.css` (reuse `.save-bar` — already exists from the Notificări/Taxe și grupe work; no new CSS needed for the bar itself)
- Create: `src/app/web/exchange-rate-settings.controller.mjs`
- Test: `src/app/web/exchange-rate-settings.controller.test.mjs`
- Modify: `src/app/web/compose-screens.mjs`
- Modify: `src/app/web/main.mjs`

**Interfaces:**
- Consumes: `createExchangeRatesStore` (Task 12), the existing `.save-bar` CSS pattern and `navigation.registerScreen`/`go` convention.
- Produces: `createExchangeRateSettingsController({ elements, store, showNotice })` → `{ activate }`, following the exact shape of `createNotificationPreferencesController` (Task from the earlier Notificări save-bar work already in this repo — read `src/app/web/notification-preferences.controller.mjs` before writing this, it is the direct template).

- [ ] **Step 1: Add the screen markup to `web/index.html`**

Find the `<section class="view" id="notifications">...</section>` block (Notificări screen). Add a new sibling section right after its closing `</section>`, before `<section class="view" id="audit">` (or wherever it best fits among the ADMINISTRARE-group screens; exact position among siblings doesn't matter, `.view`/`.view.active` visibility is class-driven, not order-driven):

```html
<section class="view" id="exchangeRates"><h2>Curs valutar</h2><p class="notice">Cursul EUR→MDL folosit la conversia taxelor și achitărilor în altă monedă. Se cere automat de la BNM la pornirea aplicației; adaugă sau corectează manual aici, sau reîmprospătează la cerere.</p>
  <div class="toolbar"><button class="btn btn-ghost" id="exchangeRateRefresh" type="button">Reîmprospătează cursul</button><span id="exchangeRateRefreshStatus"></span></div>
  <form id="exchangeRateForm">
    <div class="settings-list">
      <div class="setting-row">
        <label class="field">Dată<input type="date" id="exchangeRateDate" required></label>
        <label class="field">Curs (MDL pentru 1 EUR)<input type="number" id="exchangeRateValue" min="0" step="0.0001" required></label>
      </div>
    </div>
    <div class="save-bar" id="exchangeRateSaveBar" hidden><span id="exchangeRatePending"></span><button class="btn btn-primary" id="exchangeRateSave" type="submit">Salvează cursul</button></div>
  </form>
  <article class="panel table-wrap"><table><thead><tr><th>Dată</th><th>Curs (MDL / EUR)</th></tr></thead><tbody id="exchangeRateTable"></tbody></table></article>
</section>
```

Add a sidebar nav entry — find the `ADMINISTRARE` nav group (`<p class="nav-group-title">Administrare</p>` — the same `<div class="nav-group">` that has `Notificări`/`Backup și setări`). Add a button after `Notificări`'s:

```html
<button class="nav" data-view="exchangeRates"><span class="dot"></span>Curs valutar</button>
```

- [ ] **Step 2: Write the failing controller tests**

Create `src/app/web/exchange-rate-settings.controller.test.mjs`, modeled directly on `src/app/web/notification-preferences.controller.test.mjs` (read that file first — the fake-element/fake-form harness pattern is reused verbatim):

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExchangeRateSettingsController } from './exchange-rate-settings.controller.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

function createElement(extra = {}) {
  return asAny({ value: '', textContent: '', innerHTML: '', onclick: null, ...extra });
}

/**
 * @param {{ ratesResponse?: Record<string, number>, saveResponse?: Record<string, number>,
 *   refreshResponse?: any, saveError?: Error }} [args]
 */
function createHarness({ ratesResponse = {}, saveResponse, refreshResponse, saveError } = {}) {
  const notices = [];
  const saveCalls = [];
  const refreshCalls = [];
  const submitButton = { disabled: false };
  const formListeners = {};
  const saveBar = { hidden: true };
  const table = { innerHTML: '' };
  const elements = {
    form: {
      onsubmit: null,
      querySelector: () => submitButton,
      addEventListener: (type, handler) => {
        formListeners[type] = handler;
      },
    },
    date: createElement(),
    rate: createElement(),
    table,
    pending: createElement(),
    saveBar,
    refreshButton: createElement(),
    refreshStatus: createElement(),
  };
  const store = {
    get rates() {
      return ratesResponse;
    },
    load: async () => ratesResponse,
    save: async entry => {
      saveCalls.push(entry);
      if (saveError) throw saveError;
      return saveResponse ?? ratesResponse;
    },
    refresh: async () => {
      refreshCalls.push(true);
      return refreshResponse ?? { ok: true, rates: ratesResponse };
    },
  };
  const showNotice = (...args) => notices.push(args);
  const controller = createExchangeRateSettingsController({ elements: asAny(elements), store, showNotice });
  return { elements, notices, saveCalls, refreshCalls, controller, submitButton, saveBar, table };
}

const submitForm = async elements => elements.form.onsubmit(asAny({ preventDefault: () => {} }));

test('activate() umple tabelul cu cursurile din store, sortate descrescător', async () => {
  const { controller, table } = createHarness({ ratesResponse: { '2026-09-18': 19.9, '2026-09-23': 20.1352 } });

  await controller.activate();

  const firstRowIndex = table.innerHTML.indexOf('2026-09-23');
  const secondRowIndex = table.innerHTML.indexOf('2026-09-18');
  assert.ok(firstRowIndex >= 0 && secondRowIndex > firstRowIndex);
});

test('trimiterea formularului salvează data și cursul introduse', async () => {
  const { elements, saveCalls } = createHarness();
  elements.date.value = '2026-09-23';
  elements.rate.value = '20.1352';

  await submitForm(elements);

  assert.deepEqual(saveCalls, [{ date: '2026-09-23', rate: 20.1352 }]);
});

test('salvarea reușită arată notificarea și golește câmpurile', async () => {
  const { elements, notices } = createHarness({ saveResponse: { '2026-09-23': 20.1352 } });
  elements.date.value = '2026-09-23';
  elements.rate.value = '20.1352';

  await submitForm(elements);

  assert.deepEqual(notices, [['Cursul a fost salvat.']]);
  assert.equal(elements.rate.value, '');
});

test('salvarea eșuată arată eroarea', async () => {
  const { elements, notices } = createHarness({ saveError: new Error('Curs invalid.') });
  elements.date.value = '2026-09-23';
  elements.rate.value = '-5';

  await submitForm(elements);

  assert.deepEqual(notices, [['Curs invalid.', true]]);
});

test('butonul de reîmprospătare cere store.refresh() și arată rezultatul', async () => {
  const { elements, refreshCalls, notices } = createHarness({ refreshResponse: { ok: true, rates: { '2026-09-23': 20.1352 } } });

  await elements.refreshButton.onclick();

  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(notices, [['Curs actualizat: 2026-09-23.']]);
});

test('butonul de reîmprospătare arată eroarea BNM fără să arunce', async () => {
  const { elements, notices } = createHarness({ refreshResponse: { ok: false, error: 'Fără internet.' } });

  await elements.refreshButton.onclick();

  assert.deepEqual(notices, [['Fără internet.', true]]);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `node --test src/app/web/exchange-rate-settings.controller.test.mjs`
Expected: FAIL — `Cannot find module './exchange-rate-settings.controller.mjs'`.

- [ ] **Step 4: Implement the controller**

Create `src/app/web/exchange-rate-settings.controller.mjs`:

```javascript
import { escapeHtml } from '#shared/format/html-escape.mjs';

/**
 * @typedef {{
 *   form: HTMLFormElement,
 *   date: HTMLInputElement,
 *   rate: HTMLInputElement,
 *   table: HTMLTableSectionElement,
 *   pending: HTMLElement,
 *   saveBar: HTMLElement,
 *   refreshButton: HTMLButtonElement,
 *   refreshStatus: HTMLElement,
 * }} ExchangeRateSettingsFields
 */

/**
 * Ecranul „Curs valutar”: listă de cursuri (dată → MDL per 1 EUR), un formular
 * de adăugare/corecție manuală și un buton de reîmprospătare de la BNM.
 * @param {{
 *   elements: ExchangeRateSettingsFields,
 *   store: {
 *     rates: Record<string, number>,
 *     load(): Promise<Record<string, number>>,
 *     save(entry: { date: string, rate: number }): Promise<Record<string, number>>,
 *     refresh(): Promise<{ ok: boolean, rates?: Record<string, number>, error?: string }>,
 *   },
 *   showNotice: (text: string, isError?: boolean) => void,
 * }} dependencies
 */
export function createExchangeRateSettingsController({ elements, store, showNotice }) {
  function renderTable(rates) {
    const rows = Object.entries(rates).sort(([a], [b]) => b.localeCompare(a));
    elements.table.innerHTML =
      rows.map(([date, rate]) => `<tr><td>${escapeHtml(date)}</td><td>${rate}</td></tr>`).join('') ||
      '<tr><td colspan="2" class="empty">Niciun curs salvat încă.</td></tr>';
    elements.pending.textContent = `${rows.length} ${rows.length === 1 ? 'curs salvat' : 'cursuri salvate'}`;
  }

  async function refresh() {
    renderTable(await store.load());
    elements.saveBar.hidden = true;
  }

  elements.form.addEventListener('input', () => {
    elements.saveBar.hidden = false;
  });

  elements.form.onsubmit = async event => {
    event.preventDefault();
    const submitButton = /** @type {HTMLButtonElement} */ (elements.form.querySelector('button'));
    submitButton.disabled = true;
    try {
      const date = elements.date.value;
      const rate = Number(elements.rate.value);
      const after = await store.save({ date, rate });
      renderTable(after);
      elements.date.value = '';
      elements.rate.value = '';
      elements.saveBar.hidden = true;
      showNotice('Cursul a fost salvat.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      submitButton.disabled = false;
    }
  };

  elements.refreshButton.onclick = async () => {
    elements.refreshButton.disabled = true;
    elements.refreshStatus.textContent = 'Se cere cursul de la BNM…';
    try {
      const result = await store.refresh();
      if (result.ok) {
        renderTable(/** @type {Record<string, number>} */ (result.rates));
        const [latestDate] = Object.entries(/** @type {Record<string, number>} */ (result.rates)).sort(
          ([a], [b]) => b.localeCompare(a),
        )[0];
        showNotice(`Curs actualizat: ${latestDate}.`);
      } else {
        showNotice(/** @type {string} */ (result.error), true);
      }
    } finally {
      elements.refreshButton.disabled = false;
      elements.refreshStatus.textContent = '';
    }
  };

  return {
    activate: () => void refresh().catch(error => showNotice(/** @type {Error} */ (error).message, true)),
  };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test src/app/web/exchange-rate-settings.controller.test.mjs`
Expected: PASS, all 6 tests green.

- [ ] **Step 6: Construct the store in `main.mjs`, pass it into `compose-screens.mjs`**

`main.mjs` is where `exchangeRatesStore` must live, not `compose-screens.mjs` — Task 14 needs a `readRates()` closure available *before* `composeScreens()` runs (to build `renderCycle`, which is constructed before `composeScreens()` is called), so the store has to be constructed at that same top level. Building it here now, instead of inside `compose-screens.mjs`, avoids redoing this wiring in Task 14.

In `src/app/web/main.mjs`, near where `readRecords`/`submitMutation` closures are already defined (before `const renderCycle = createRenderCycle({...})`), add:

```javascript
import { createExchangeRatesStore } from './exchange-rates-store.mjs';
```

```javascript
const exchangeRatesStore = createExchangeRatesStore({ requestJson });
void exchangeRatesStore.load().catch(() => {});
```

Pass `exchangeRatesStore` into `composeScreens({...})`'s argument object (find the call in `main.mjs`, add `exchangeRatesStore` to the object literal — leave `readRates` out of this call for now, Task 14 adds it there and to `render-cycle.mjs`).

In `src/app/web/compose-screens.mjs`, add `exchangeRatesStore` to the function's destructured parameters and JSDoc (alongside `navigation`, `readSelectedMonth`, etc. — do **not** construct a store inside this file):

```javascript
import { createExchangeRateSettingsController } from './exchange-rate-settings.controller.mjs';
```

```javascript
export function composeScreens({
  element,
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
  setRenderers,
  eventBus,
  renderCycle,
  navigation,
  readSelectedMonth,
  exchangeRatesStore,
}) {
```

Then register the screen (find `navigation.registerScreen('notifications', {...})` in `compose-screens.mjs` and add right after it):

```javascript
  const exchangeRateSettings = createExchangeRateSettingsController({
    elements: {
      form: element('exchangeRateForm'),
      date: element('exchangeRateDate'),
      rate: element('exchangeRateValue'),
      table: element('exchangeRateTable'),
      pending: element('exchangeRatePending'),
      saveBar: element('exchangeRateSaveBar'),
      refreshButton: element('exchangeRateRefresh'),
      refreshStatus: element('exchangeRateRefreshStatus'),
    },
    store: exchangeRatesStore,
    showNotice,
  });
  navigation.registerScreen('exchangeRates', {
    activate: () => exchangeRateSettings.activate(),
  });
```

`main.mjs` already holds `exchangeRatesStore` directly (Step 6) — Task 14 builds `readRates` there and threads it into `createRenderCycle` and back into `composeScreens({...})` for Task 17's views, without `compose-screens.mjs` needing to expose anything extra.

- [ ] **Step 7: Run the full suite**

Run: `npm run check`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add web/index.html src/app/web/exchange-rate-settings.controller.mjs src/app/web/exchange-rate-settings.controller.test.mjs src/app/web/compose-screens.mjs src/app/web/main.mjs
git commit -m "feat(app): Curs valutar settings screen (manual entry + BNM refresh)"
```

---

### Task 14: Thread `readRates` through the render cycle

**Files:**
- Modify: `src/app/web/render-cycle.mjs`
- Modify: `src/app/web/main.mjs`

**Interfaces:**
- Consumes: `exchangeRatesStore` (constructed in `main.mjs` by Task 13, Step 6).
- Produces: `RenderContext` gains a `rates: ExchangeRates` field; `createRenderCycle` gains a `readRates` dependency; `readRates` becomes available to `compose-screens.mjs` for Task 17.

- [ ] **Step 1: Modify `render-cycle.mjs`**

Update the JSDoc `@typedef RenderContext` (add `@property {import('#shared/domain/exchange-rates.mjs').ExchangeRates} rates`), the `dependencies` JSDoc (add `readRates: () => any,`), the destructured parameters, and the `render()` body:

```javascript
export function createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday,
  readRates,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure,
}) {
  /** @type {Array<{ screenName: string, renderScreen: (context: RenderContext) => void }>} */
  const screens = [];

  function addScreen(screenName, renderScreen) {
    screens.push({ screenName, renderScreen });
  }

  function render() {
    const records = readRecords();
    const month = readSelectedMonth();
    const rates = readRates();
    const evaluations = evaluateChildrenForMonth(records, month, readToday(), rates);
    /** @type {RenderContext} */
    const context = {
      month,
      rates,
      review: buildReviewCenter(records),
      evaluations,
      activeEvaluations: evaluations.filter(evaluation => !evaluation.child.archived),
      unassignedPaymentHintsByChild: findUnassignedPaymentHintsByChild(records),
    };
    for (const { screenName, renderScreen } of screens)
      renderGuarded(screenName, () => renderScreen(context), reportRenderFailure);
  }

  return { addScreen, render };
}
```

- [ ] **Step 2: Build `readRates` and pass it into `createRenderCycle`**

Task 13 already constructs `exchangeRatesStore` in `main.mjs`, before `renderCycle` is built — this step only adds the `readRates` accessor and wires it in. In `main.mjs`, right after the `exchangeRatesStore` construction from Task 13:

```javascript
const readRates = () => exchangeRatesStore.rates;
```

Then, in the existing `const renderCycle = createRenderCycle({...})` call:

```javascript
const renderCycle = createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday: today,
  readRates,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure: (_screenName, failure) => showNotice(failure.message, true),
});
```

```javascript
const renderCycle = createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday: today,
  readRates,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure: (_screenName, failure) => showNotice(failure.message, true),
});
```

- [ ] **Step 3: Pass `readRates` into `composeScreens({...})` too**

Task 17's views (`createNotifyListView`, `createChildProfileView`) need `readRates` directly, not just `renderCycle`. Add it to the existing `composeScreens({...})` call in `main.mjs` (which already passes `exchangeRatesStore` per Task 13):

```javascript
const { recordEditor, childProfile } = composeScreens({
  element,
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
  setRenderers,
  eventBus,
  renderCycle,
  navigation,
  readSelectedMonth,
  exchangeRatesStore,
  readRates,
});
```

And add `readRates` to `compose-screens.mjs`'s destructured parameters (alongside `exchangeRatesStore` from Task 13):

```javascript
export function composeScreens({
  element,
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
  setRenderers,
  eventBus,
  renderCycle,
  navigation,
  readSelectedMonth,
  exchangeRatesStore,
  readRates,
}) {
```

(`readRates` isn't used inside `compose-screens.mjs` itself until Task 17 wires it into `createNotifyListView`/`createChildProfileView` — this step only makes it available as a parameter.)

- [ ] **Step 4: Run the full suite**

Run: `npm run check`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/app/web/render-cycle.mjs src/app/web/main.mjs src/app/web/compose-screens.mjs
git commit -m "feat(app): thread exchange rates through the render cycle"
```

---

### Task 15: Currency selector on the child fee (Copii editor + Taxe și grupe)

**Files:**
- Modify: `src/features/children/web/child-editor-fields.mjs`
- Modify: `src/features/children/web/child-editor-fields.test.mjs`
- Modify: `src/features/fee-setup/domain/child-fee-setup.mjs`
- Modify: `src/features/fee-setup/domain/child-fee-setup.test.mjs`
- Modify: `src/features/fee-setup/web/fee-setup.view.mjs`
- Modify: `src/features/fee-setup/web/fee-setup.controller.mjs`
- Modify: `src/features/fee-setup/web/fee-setup.controller.test.mjs`
- Modify: `web/index.html` (Taxe și grupe table header)

**Interfaces:**
- Produces: both editors write `currency` on the `feeHistory` entry they create/update.

- [ ] **Step 1: Child editor fields — write the failing test**

In `src/features/children/web/child-editor-fields.test.mjs`, find the test(s) covering `read()`'s fee handling (search for `feeFrom` or `record.fee`). Add:

```javascript
test('read() scrie currency pe intrarea feeHistory nou creată, implicit MDL', () => {
  const formData = { name: 'Ana', parent: 'Maria', fee: '2000', feeFrom: '2026-09', dueDay: '10', statusFrom: '2026-09', status: 'Activ' };
  const context = { previousRecord: { fee: null, feeHistory: [] }, today: () => '2026-09-15' };

  const record = read(asAny(formData), asAny({}), asAny(context));

  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 2000, currency: 'MDL' }]);
});

test('read() scrie currency EUR când e selectată în formular', () => {
  const formData = { name: 'Ana', parent: 'Maria', fee: '500', feeCurrency: 'EUR', feeFrom: '2026-09', dueDay: '10', statusFrom: '2026-09', status: 'Activ' };
  const context = { previousRecord: { fee: null, feeHistory: [] }, today: () => '2026-09-15' };

  const record = read(asAny(formData), asAny({}), asAny(context));

  assert.deepEqual(record.feeHistory, [{ from: '2026-09', amount: 500, currency: 'EUR' }]);
});
```

Check the top of `child-editor-fields.test.mjs` for how `read`/`asAny` are already imported/defined (this module isn't exported by name currently per the earlier read — `read` is a private function used only internally by the exported `childEditorFields.read`). If `read` isn't exported, import `childEditorFields` instead and call `childEditorFields.read(...)` — match whatever the existing tests in this file already do (read the file's current test bodies before writing these two; adjust the call shape to match, the assertions above are correct regardless of which form the call takes).

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/children/web/child-editor-fields.test.mjs`
Expected: FAIL — current `feeHistory` entries have no `currency` key.

- [ ] **Step 3: Implement**

In `src/features/children/web/child-editor-fields.mjs`, add a currency selector next to the fee field. Change:

```javascript
        textFieldMarkup('fee', 'Taxa lunară (gol = necunoscută)', record.fee ?? '', 'number', 'min="0" step="0.01"') +
        textFieldMarkup('feeFrom', 'Taxa aplicabilă din luna', defaultMonth, 'month') +
```

to:

```javascript
        textFieldMarkup('fee', 'Taxa lunară (gol = necunoscută)', record.fee ?? '', 'number', 'min="0" step="0.01"') +
        selectFieldMarkup('feeCurrency', 'Monedă', currentFeeCurrency(record), ['MDL', 'EUR']) +
        textFieldMarkup('feeFrom', 'Taxa aplicabilă din luna', defaultMonth, 'month') +
```

Add `selectFieldMarkup` to the existing `import { textFieldMarkup, selectFieldMarkup, textareaFieldMarkup, formSectionMarkup, groupOptionsMarkup } from '#shared/ui/form-fields.mjs';` (it's already imported per the earlier read of this file — verify, add only if missing).

Add a small helper above `markup()`:

```javascript
/** @param {any} record */
const currentFeeCurrency = record => record.feeHistory?.at(-1)?.currency ?? 'MDL';
```

In `read()`, change:

```javascript
  if (record.fee !== null && formData.feeFrom && (!record.feeHistory.length || record.fee !== previous.fee))
    record.feeHistory = upsertHistory(record.feeHistory, formData.feeFrom, 'amount', record.fee);
```

to:

```javascript
  if (record.fee !== null && formData.feeFrom && (!record.feeHistory.length || record.fee !== previous.fee))
    record.feeHistory = upsertHistory(record.feeHistory, formData.feeFrom, 'amount', record.fee, {
      currency: formData.feeCurrency === 'EUR' ? 'EUR' : 'MDL',
    });
```

`upsertHistory` currently has signature `(rows, from, key, value) => [...rows.filter(row => row.from !== from), { from, [key]: value }]` — it discards every field except `from` and the one `key`. Change it to accept an optional extra-fields object:

```javascript
const upsertHistory = (rows, from, key, value, extra = {}) => [
  ...rows.filter(row => row.from !== from),
  { from, [key]: value, ...extra },
];
```

The other call site in this same file, `upsertHistory(record.statusHistory, formData.statusFrom, 'status', record.status)`, keeps working unchanged (its 5th argument is simply omitted, defaulting to `{}`).

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/children/web/child-editor-fields.test.mjs`
Expected: PASS.

- [ ] **Step 5: `applyChildFeeSetup` (Taxe și grupe) — write the failing test**

In `src/features/fee-setup/domain/child-fee-setup.test.mjs`, find the existing test(s) for `applyChildFeeSetup` with a `fee` in the setup object. Add:

```javascript
test('applyChildFeeSetup scrie currency pe intrarea feeHistory, implicit MDL', () => {
  const child = normalizeRecord('children', { id: 'C-1', name: 'Ana', parent: 'Maria', feeHistory: [] });

  const updated = applyChildFeeSetup(child, { from: '2026-09', fee: 2000 });

  assert.deepEqual(updated.feeHistory, [{ from: '2026-09', amount: 2000, currency: 'MDL' }]);
});

test('applyChildFeeSetup scrie currency EUR când e trimisă', () => {
  const child = normalizeRecord('children', { id: 'C-1', name: 'Ana', parent: 'Maria', feeHistory: [] });

  const updated = applyChildFeeSetup(child, { from: '2026-09', fee: 500, currency: 'EUR' });

  assert.deepEqual(updated.feeHistory, [{ from: '2026-09', amount: 500, currency: 'EUR' }]);
});
```

- [ ] **Step 6: Run to verify failure**

Run: `node --test src/features/fee-setup/domain/child-fee-setup.test.mjs`
Expected: FAIL.

- [ ] **Step 7: Implement**

In `src/features/fee-setup/domain/child-fee-setup.mjs`, change `upsertMonth` to accept a fields object instead of a single key/value, matching Task 15 Step 3's `upsertHistory` change:

```javascript
// O intrare de istoric pe lună: rescrie luna dacă există deja.
const upsertMonth = (rows, from, fields) => [...(rows || []).filter(row => row.from !== from), { from, ...fields }];
```

Update both call sites and the `ChildFeeSetup` typedef:

```javascript
/** @typedef {{ from: string, groupId?: string | null, fee?: number | null, currency?: 'MDL' | 'EUR', status?: string }} ChildFeeSetup */
```

```javascript
  if (setup.fee !== undefined && setup.fee !== null) {
    requireAmount(setup.fee, `${child.name}: taxa`, true);
    updated.fee = setup.fee;
    updated.feeHistory = upsertMonth(updated.feeHistory, setup.from, {
      amount: setup.fee,
      currency: setup.currency === 'EUR' ? 'EUR' : 'MDL',
    });
  }
  if (setup.status !== undefined && setup.status !== '') {
    requireThat(STATUS_HISTORY_VALUES.includes(setup.status), `${child.name}: statut invalid.`);
    updated.status = /** @type {import('#shared/contracts/record-types.mjs').ChildStatus} */ (setup.status);
    updated.statusHistory = upsertMonth(updated.statusHistory, setup.from, { status: setup.status });
  }
```

- [ ] **Step 8: Run to verify pass**

Run: `node --test src/features/fee-setup/domain/child-fee-setup.test.mjs`
Expected: PASS.

- [ ] **Step 9: Taxe și grupe UI — add the currency column**

In `web/index.html`, find the `#fees` section's table header (the one with `data-sort="contract"`, `data-sort="name"`, etc. — added in the earlier Taxe și grupe search/sort work). Add a `Monedă` header between `Taxă lunară` and `Din luna`:

```html
<th aria-sort="none"><button type="button" class="table-sort" data-sort="currency">Monedă<span aria-hidden="true">↕</span></button></th>
```

Also add a bulk "Monedă pentru toți" selector next to the existing "Taxă pentru toți" input in the same toolbar:

```html
<label>Monedă pentru toți<select id="feesBulkCurrency"><option value="">Lasă neschimbată</option><option value="MDL">MDL</option><option value="EUR">EUR</option></select></label>
```

In `src/features/fee-setup/web/fee-setup.view.mjs`, add a currency `<select>` next to the fee `<input>` in `feeSetupRowMarkup`:

```javascript
  const currentFeeCurrency = child.feeHistory?.at(-1)?.currency ?? 'MDL';
  return (
    `<tr data-child="${escapeHtml(child.id)}"><td>${escapeHtml(child.contractNumber || child.id)}</td><td>${escapeHtml(child.name)}</td>` +
    `<td>${formatDate(child.attendanceDate)}</td>` +
    `<td><select data-group data-group-initial="${escapeHtml(child.groupId || '')}">${groupOptionsMarkup(groupsSortedByName, child.groupId || '')}</select></td>` +
    `<td><input data-fee type="number" min="0" step="0.01" value="${escapeHtml(currentFee)}" data-fee-initial="${escapeHtml(currentFee)}" placeholder="taxă"></td>` +
    `<td><select data-currency data-currency-initial="${currentFeeCurrency}"><option value="MDL" ${currentFeeCurrency === 'MDL' ? 'selected' : ''}>MDL</option><option value="EUR" ${currentFeeCurrency === 'EUR' ? 'selected' : ''}>EUR</option></select></td>` +
    `<td><input data-from type="month" value="${escapeHtml(defaultSetupMonth(child, today))}"></td>` +
    `<td><select data-status data-status-initial="${escapeHtml(currentStatus)}">${statusOptions}</select></td></tr>`
  );
```

Update the table's `colspan` for the empty-state row in `fee-setup.controller.mjs` from `7` to `8` (one more column) — find `'<tr><td colspan="7" class="empty">Nimic de completat pentru filtrul ales.</td></tr>'` and change to `colspan="8"`.

- [ ] **Step 10: `fee-setup.controller.mjs` — write the failing test for currency handling**

In `src/features/fee-setup/web/fee-setup.controller.test.mjs`, extend `createFeeRow` to accept and wire a currency select (mirroring how `group`/`status` are already wired):

```javascript
function createFeeRow({ id, name, fee, feeInitial, currency, currencyInitial, group, groupInitial, status, statusInitial, from }) {
  const feeInput = asAny({ value: fee, dataset: { feeInitial } });
  const currencyInput = asAny({ value: currency, dataset: { currencyInitial } });
  const groupInput = asAny({ value: group, dataset: { groupInitial } });
  const statusInput = asAny({ value: status, dataset: { statusInitial } });
  const fromInput = asAny({ value: from });
  return asAny({
    dataset: { child: id },
    cells: [{}, { textContent: name }],
    querySelector: selector => {
      if (selector === '[data-fee]') return feeInput;
      if (selector === '[data-currency]') return currencyInput;
      if (selector === '[data-group]') return groupInput;
      if (selector === '[data-status]') return statusInput;
      if (selector === '[data-from]') return fromInput;
      return null;
    },
  });
}
```

This changes the fixture helper's required arguments — update every existing call to `createFeeRow({...})` in this test file to add `currency: 'MDL', currencyInitial: 'MDL',` (matching the pattern of the existing `group`/`groupInitial` pair, defaulting both to `'MDL'` for every pre-existing test so their behavior is unchanged).

Add one new test:

```javascript
test('save.onclick trimite currency doar când diferă de valoarea inițială', async () => {
  const rows = [
    createFeeRow({
      id: 'C-1',
      name: 'Ana',
      fee: '500',
      feeInitial: '500',
      currency: 'EUR',
      currencyInitial: 'MDL',
      group: '',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
  ];
  const { elements, submittedRequests } = createHarness({ table: createFakeTable(rows) });

  await elements.save.onclick();

  assert.equal(submittedRequests.length, 1);
  assert.deepEqual(submittedRequests[0][1].updates, [{ id: 'C-1', from: '2026-09', currency: 'EUR' }]);
});
```

- [ ] **Step 11: Run to verify failure**

Run: `node --test src/features/fee-setup/web/fee-setup.controller.test.mjs`
Expected: FAIL — `collect()` doesn't read `[data-currency]` yet, and the new test's `submittedRequests` won't include `currency`.

- [ ] **Step 12: Implement in `fee-setup.controller.mjs`**

Add `currency` handling to `collect()`, mirroring the existing `group`/`status` diff pattern. Find:

```javascript
      const feeInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]'));
      const groupInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]'));
      const statusInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]'));
      const fromInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-from]'));
      const fee = feeInput.value.trim();
      const group = groupInput.value;
      const status = statusInput.value;
```

Change to:

```javascript
      const feeInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]'));
      const currencyInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-currency]'));
      const groupInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]'));
      const statusInput = /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]'));
      const fromInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-from]'));
      const fee = feeInput.value.trim();
      const currency = currencyInput.value;
      const group = groupInput.value;
      const status = statusInput.value;
```

Add the diff check right after the existing `group`/`groupInitial` block:

```javascript
      if (currency !== currencyInput.dataset.currencyInitial) {
        update.currency = currency;
        changed = true;
      }
```

Add `currency` to `hasPendingEdits()`'s comparison (find the function from the earlier save-bar work) — add a fourth check alongside `fee`/`group`/`status`:

```javascript
  function hasPendingEdits() {
    return editableRows().some(row => {
      const fee = /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]'));
      const currency = /** @type {HTMLSelectElement} */ (row.querySelector('[data-currency]'));
      const group = /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]'));
      const status = /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]'));
      return (
        (fee.value.trim() !== '' && fee.value.trim() !== fee.dataset.feeInitial) ||
        currency.value !== currency.dataset.currencyInitial ||
        group.value !== group.dataset.groupInitial ||
        status.value !== status.dataset.statusInitial
      );
    });
  }
```

Add `currency` to `capturePendingEdits()`/`applyPendingEdits()` the same way (each already loops the four other fields — add `currency` as a fifth tracked field in the captured object shape `{ fee, currency, group, status, from }` and in both functions' bodies, reading/writing `row.querySelector('[data-currency]').value`).

Add a `currency` column to the `FEES_COLUMNS`-equivalent sort map (the inline object passed to `sortTable('fees', ...)` inside `render()`):

```javascript
        currency: child => child.feeHistory?.at(-1)?.currency ?? 'MDL',
```

Wire the bulk "Monedă pentru toți" select: add `bulkCurrency` to the destructured `elements` parameter, and inside `applyAll.onclick`, alongside the existing `amount`/`group`/`status` handling:

```javascript
    const currency = bulkCurrency.value;
    if (!amount && !currency && !group && !status) {
      showNotice('Completează o taxă, o monedă, o grupă sau un statut de aplicat.', true);
      return;
    }
    for (const row of editableRows()) {
      if (amount) /** @type {HTMLInputElement} */ (row.querySelector('[data-fee]')).value = amount;
      if (currency) /** @type {HTMLSelectElement} */ (row.querySelector('[data-currency]')).value = currency;
      if (group) /** @type {HTMLSelectElement} */ (row.querySelector('[data-group]')).value = group;
      if (status) /** @type {HTMLSelectElement} */ (row.querySelector('[data-status]')).value = status;
    }
```

- [ ] **Step 13: Wire `bulkCurrency` in `compose-screens.mjs`**

Find the `createFeeSetupController({ elements: {...} })` call and add `bulkCurrency: element('feesBulkCurrency'),` alongside the existing `bulkAmount`/`bulkGroup`/`bulkStatus`.

- [ ] **Step 14: Run to verify pass**

Run: `node --test src/features/fee-setup/web/fee-setup.controller.test.mjs`
Expected: PASS, all tests green (existing + the new one).

- [ ] **Step 15: Run the full suite**

Run: `npm run check`
Expected: green.

- [ ] **Step 16: Commit**

```bash
git add src/features/children/web/child-editor-fields.mjs src/features/children/web/child-editor-fields.test.mjs src/features/fee-setup/domain/child-fee-setup.mjs src/features/fee-setup/domain/child-fee-setup.test.mjs src/features/fee-setup/web/fee-setup.view.mjs src/features/fee-setup/web/fee-setup.controller.mjs src/features/fee-setup/web/fee-setup.controller.test.mjs web/index.html src/app/web/compose-screens.mjs
git commit -m "feat(fee-setup): currency selector on child fee (Copii editor and Taxe și grupe)"
```

---

### Task 16: Currency selector on payments

**Files:**
- Modify: `src/features/payments/web/payment-editor-fields.mjs`
- Modify: `src/features/payments/web/payment-editor-fields.test.mjs`

**Interfaces:**
- Produces: `read()` includes `currency: formData.currency` in the normalized record.

- [ ] **Step 1: Write the failing test**

In `src/features/payments/web/payment-editor-fields.test.mjs`, find the existing test(s) for `paymentEditorFields.read`. Add:

```javascript
test('read() scrie currency, implicit MDL când formularul n-o trimite', () => {
  const formData = { childId: '', date: '2026-09-15', sourceName: '' };
  const formElement = /** minimal fake matching what existing tests in this file already build for readTenders()/readAllocationRows() */;
  // Refolosește exact harness-ul (formElement fals) pe care testele existente din acest fișier
  // îl construiesc deja pentru `read()` — vezi un test existent care apelează
  // `paymentEditorFields.read(formData, formElement, context)` și copiază acel formElement.
  const context = { previousRecord: {}, records: { children: [] }, confirm: () => true };

  const record = paymentEditorFields.read(asAny(formData), formElement, asAny(context));

  assert.equal(record.currency, 'MDL');
});
```

(This test's exact `formElement` construction must copy whatever fake DOM the file's existing `read()` tests already use for `formElement.querySelectorAll('[data-tender]')` and `#allocationRows` — read the existing tests in this file first and reuse that harness function verbatim, only changing the assertion. Do not invent a new fake shape.)

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/features/payments/web/payment-editor-fields.test.mjs`
Expected: FAIL — `record.currency` is `undefined`.

- [ ] **Step 3: Implement**

Add a currency selector to the markup — in the `'Sumă și metodă'` section of `markup()`, after the `amount` field:

```javascript
    formSectionMarkup(
      'Sumă și metodă',
      textFieldMarkup(
        'amount',
        'Total achitare (calculat automat)',
        record.amount ?? 0,
        'number',
        'readonly step="0.01"',
      ) +
        selectFieldMarkup('currency', 'Monedă', record.currency || 'MDL', ['MDL', 'EUR']) +
        `<div class="full tender-fields">...` /* unchanged */,
```

Add `selectFieldMarkup` to the file's import from `#shared/ui/form-fields.mjs` (currently only imports `textFieldMarkup, formSectionMarkup` per the earlier read — add `selectFieldMarkup` to that import list).

In `read()`, add `currency: formData.currency,` to the object passed into `normalizeRecord('payments', {...})`:

```javascript
  const record = normalizeRecord('payments', {
    ...context.previousRecord,
    notes: formData.notes,
    childId: formData.childId,
    date: formData.date,
    currency: formData.currency,
    // Totalul se recalculează din metode; valoarea din câmp e doar afișaj.
    amount: undefined,
    tenders: readTenders(formElement),
    sourceName: formData.sourceName,
    reviewed: formData.reviewed === 'on',
    allocations: readAllocationRows(/** @type {HTMLElement} */ (formElement.querySelector('#allocationRows'))),
  });
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/features/payments/web/payment-editor-fields.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm run check`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/features/payments/web/payment-editor-fields.mjs src/features/payments/web/payment-editor-fields.test.mjs
git commit -m "feat(payments): currency selector when recording a payment"
```

---

### Task 17: Per-row currency display — Situația plăților, De notificat, fișa copilului

**Files:**
- Modify: `src/features/billing/web/payment-status.view.mjs`
- Modify: `src/features/billing/web/notify-list.view.mjs`
- Modify: `src/features/children/web/child-profile.view.mjs`
- Modify: `src/app/web/compose-screens.mjs`

**Interfaces:**
- Consumes: `RenderContext.rates` (Task 14); `obligation.currency` — **new field needed**: `obligation()` (Task 6) doesn't currently return the currency it computed in. Add it.

- [ ] **Step 1: Add `currency` to `obligation()`'s return value**

Revisit `src/shared/domain/tuition-obligation.mjs` (Task 6's file) — the row-level views need to know *which* currency `expected`/`paid`/`rest`/`credit` are expressed in, to call `formatMoney(value, currency)` correctly. Add one field to the return object:

```javascript
  return { expected, paid, rest, credit, due, label, notify, daysToDue, currency: feeCurrency };
```

Add a test in `src/shared/domain/tuition-obligation.test.mjs`:

```javascript
test('obligation() întoarce moneda taxei, chiar și pentru un copil MDL', () => {
  const result = obligation(child(), '2026-09', [payment()]);
  assert.equal(result.currency, 'MDL');
});

test('obligation() întoarce EUR când taxa e în EUR', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const result = obligation(eurChild, '2026-09', []);
  assert.equal(result.currency, 'EUR');
});
```

Run: `node --test src/shared/domain/tuition-obligation.test.mjs` — expect PASS after the one-line change (both new tests and everything from Task 6 still green; `currency` is purely additive on the return object).

- [ ] **Step 2: `payment-status.view.mjs` — update the row markup**

Find `statusRowMarkup` in `src/features/billing/web/payment-status.view.mjs`. Change:

```javascript
function statusRowMarkup({ child, obligation }) {
  return (
    `<tr><td>${escapeHtml(contractNumberOf(child))}</td><td>${escapeHtml(child.name)}${child.archived ? ' (arhivat)' : ''}</td>` +
    `<td class="amount">${formatMoney(obligation.expected)}</td><td class="amount">${formatMoney(obligation.paid)}</td><td class="amount">${formatMoney(obligation.rest)}</td><td class="amount">${formatMoney(obligation.credit)}</td>` +
    `<td>${formatDate(obligation.due)}</td><td>${escapeHtml(obligation.label)}</td></tr>`
  );
}
```

to:

```javascript
function statusRowMarkup({ child, obligation }) {
  return (
    `<tr><td>${escapeHtml(contractNumberOf(child))}</td><td>${escapeHtml(child.name)}${child.archived ? ' (arhivat)' : ''}</td>` +
    `<td class="amount">${formatMoney(obligation.expected, obligation.currency)}</td><td class="amount">${formatMoney(obligation.paid, obligation.currency)}</td><td class="amount">${formatMoney(obligation.rest, obligation.currency)}</td><td class="amount">${formatMoney(obligation.credit, obligation.currency)}</td>` +
    `<td>${formatDate(obligation.due)}</td><td>${escapeHtml(obligation.label)}</td></tr>`
  );
}
```

This view has no test file (confirmed absent earlier) — verified via manual browser check in Task 18, consistent with how this view was already untested before this plan.

- [ ] **Step 3: `notify-list.view.mjs` — per-row currency, plus the MDL-converted aggregate**

This file needs `rates` (new parameter) for the "Sumă de încasat" aggregate, which uses the **latest known rate** (forward-looking, per the spec amendment), not the per-payment historical rate. Update the dependencies and the `owed` calculation.

Add `latestKnownRate`, `convertAmount` imports:

```javascript
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';
```

Change the function signature's dependencies to accept `readRates` (matching the `readRecords`/`readToday` pattern already used in this file):

```javascript
export function createNotifyListView({
  elements: { period, stats, table, copyAllButton },
  readRecords,
  readToday,
  readRates,
  requestRender,
  renderNotifyCount,
  showNotice,
}) {
```

Change the `owed` calculation. Current:

```javascript
    const owed = notified.reduce((sum, r) => sum + cents(r.obligation.rest), 0) / 100;
```

Becomes:

```javascript
    const rates = readRates();
    const currentRate = latestKnownRate(rates);
    const owed =
      notified.reduce((sum, r) => {
        const converted = convertAmount(r.obligation.rest, r.obligation.currency, 'MDL', currentRate);
        // Fără niciun curs cunoscut vreodată, tratăm ca 1:1 — un total nu poate rămâne necalculat.
        return sum + cents(converted ?? r.obligation.rest);
      }, 0) / 100;
```

Update the two per-row `formatMoney` calls to pass currency:

```javascript
            `<td class="amount">${formatMoney(obligation.expected, obligation.currency)}</td><td class="amount">${formatMoney(obligation.paid, obligation.currency)}</td><td class="amount"><strong>${formatMoney(obligation.rest, obligation.currency)}</strong></td>` +
```

And the `owed` display stays `formatMoney(owed)` unchanged — `owed` is now always MDL after conversion, so the implicit-MDL default is correct.

- [ ] **Step 4: Wire `readRates` into `createNotifyListView` at the call site**

In `src/app/web/compose-screens.mjs`, find `createNotifyListView({...})` and add `readRates,` to its dependencies object — `readRates` must be available in `compose-screens.mjs`'s scope. Since Task 14 moved the `readRates` closure into `main.mjs` (not `compose-screens.mjs`), add `readRates` to `composeScreens`'s parameter list (alongside `exchangeRatesStore` from Task 14) and pass it from `main.mjs`'s call to `composeScreens({..., readRates, ...})`.

- [ ] **Step 5: `child-profile.view.mjs` — thread rates, currency-aware formatting**

Add `readRates` to the dependencies:

```javascript
export function createChildProfileView({ elements: { body, dialog }, readRecords, readSelectedMonth, readRates }) {
```

Change the `obligation()` call:

```javascript
    const childObligation = obligation(child, month, payments, undefined, null, readRates());
```

(`asOf` stays at its default `today()` by passing `undefined` explicitly, since `index` — the 5th positional arg — must be `null` to reach the 6th `rates` slot.)

Update every `formatMoney` call in this file to pass the right currency:
- `formatMoney(childObligation.expected)` → `formatMoney(childObligation.expected, childObligation.currency)`
- `formatMoney(childObligation.rest)` / `formatMoney(childObligation.credit)` → same, `childObligation.currency`
- `formatMoney(p.amount)` (per-payment row) → `formatMoney(p.amount, p.currency)`
- `formatMoney(a.amount)` (per-allocation) → `formatMoney(a.amount, p.currency)` (an allocation is a slice of its parent payment `p`, same currency)
- `formatMoney(f.amount)` (fee history list) → `formatMoney(f.amount, f.currency)`

Wire `readRates` into the `createChildProfileView({...})` call site in `compose-screens.mjs`, same as Step 4.

- [ ] **Step 6: Run the full suite**

Run: `npm run check`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/shared/domain/tuition-obligation.mjs src/shared/domain/tuition-obligation.test.mjs src/features/billing/web/payment-status.view.mjs src/features/billing/web/notify-list.view.mjs src/features/children/web/child-profile.view.mjs src/app/web/compose-screens.mjs
git commit -m "feat(billing): show each child's obligation in their own currency"
```

---

### Task 18: Manual end-to-end browser verification

**Files:** none (verification only).

- [ ] **Step 1: Run `npm run check`**

Expected: green (format, typecheck, full suite — this should already be true after Task 17, this step is a final gate before manual testing).

- [ ] **Step 2: Start the app on a throwaway port**

Run (background): `STARTICA_NO_BROWSER=1 STARTICA_PORT=<free-port> node --disable-warning=ExperimentalWarning startica_server.mjs`

- [ ] **Step 3: Walk the full flow in a browser**

1. **Curs valutar** screen: confirm it loaded (possibly already has today's rate from the automatic startup fetch, if the machine has internet — check the table). Add a manual entry for an earlier date (e.g. yesterday) with a made-up rate; confirm it appears in the table, sorted newest-first. Click "Reîmprospătează cursul"; confirm either a fresh row for today appears, or a clear error notice if offline.
2. **Copii → Editează** a child: set "Taxa lunară" to `500`, "Monedă" to `EUR`, save. Reopen the editor; confirm the currency selector still shows EUR.
3. **Taxe și grupe**: switch filter to "Toți copiii nearhivați", find that same child, confirm the "Monedă" column shows EUR for their row and the Monedă select works independently per row (edit another child's currency without affecting this one).
4. **Achitări → + Adaugă**: record a payment for the EUR child, with currency MDL, amount roughly `500 × <today's rate>`. Save.
5. **Situația plăților**: find the child's row — confirm `Taxă`/`Achitat`/`Rest`/`Credit` show with `€`, and the rest is close to zero (the MDL payment converted correctly against the EUR fee).
6. **De notificat**: if the child still owes something, confirm their row shows `€`; confirm "Sumă de încasat" (top stat card) shows `lei` and is a believable MDL-converted number if there are other notified children too.
7. **Dashboard**: confirm "Încasări" includes the EUR-fee child's MDL payment without visibly wrong totals (the converted amount should show up in the monthly income figure).
8. **Copii → fișa copilului** (profile) for the EUR child: confirm "Taxă curentă", "Rest", "Credit", and the payments list all show `€`/correct currency per row.

- [ ] **Step 4: Stop the throwaway server**

Find and stop the process listening on the chosen port (same pattern used throughout this session: `Get-NetTCPConnection -LocalPort <port> -State Listen` → `Stop-Process`).

- [ ] **Step 5: Report findings**

If every check in Step 3 passes, the feature is done — no commit needed for this task (verification only). If anything looks wrong, fix it as a small follow-up commit referencing which Step 3 check failed, then re-verify that specific check.

---

## Self-review notes (from writing this plan)

- **Spec coverage:** every section of the spec (data model, exchange rate source/fallback, `obligation()` conversion rule, display rule including the amendment on cross-child aggregates, migration-by-default) has a task. The two exchange-rate directions (historical-for-paid vs. current-for-owed) are each implemented exactly once and reused (Task 6 for paid, Task 17 for owed) rather than duplicated per screen.
- **Placeholder scan:** no TBD/TODO; every step has real code or an explicit "no test needed, verified by X" justification (Tasks 11, 12, 18).
- **Type consistency:** `ExchangeRates`, `Currency`, `obligation()`'s new `rates` (6th positional) and `currency` (return field) parameters are named identically everywhere they're introduced and consumed across Tasks 2, 6, 7, 8, 9, 10, 17.
- **Dependency-order check:** `exchangeRatesStore` is constructed once, in `main.mjs`, before `renderCycle` — Task 13 places it there directly (not inside `compose-screens.mjs`) precisely because Task 14 needs a `readRates()` closure available before `createRenderCycle()` runs. Both tasks were re-checked against each other after first drafting Task 14 to make sure the placement is consistent from Task 13 onward, with no later task undoing earlier work.
