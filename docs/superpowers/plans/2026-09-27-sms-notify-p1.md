# Notificări SMS prin sms.md — P1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator send a paid SMS to a child's parent from „De notificat” (one row or the whole list), after a confirmation dialog that shows the exact text, segment count and estimated cost; configure the sms.md provider (token, sender, optional monthly limit, test SMS, balance) and edit the message template from „Notificări”. Every sent message is logged in SQLite before the network call so a paid SMS is never untracked.

**Architecture:** A new independent feature `src/features/sms-notify/` mirrors `telegram-notify` (fetch-injected service, `Startica_Date\sms.json` config repository, hyphenated `/api/sms-<verb>` routes, `fake-sms-api.mjs` in `test-support/`). Two new SQLite tables, `sms_log` and `sms_templates`, are added to `SCHEMA` in `core/server/database/schema.mjs` (not `records`). Rules used by both the browser and the server — phone normalization, segment counting, diacritics stripping, template rendering — live in `#shared/domain` / `#shared/format`; `billing/domain/reminder-message.mjs` moves there as `sms-template.mjs`. In `webapp/`, the pieces that both „De notificat” (P1) and „Situația plăților” (P2) will use — hooks, the confirmation dialog, the status badge — live under `webapp/src/shared/sms/`, because `webapp/src/architecture.test.ts` forbids one webapp feature from importing another; the provider card and template editor, used only by „Notificări”, live in `webapp/src/features/notifications/`.

**Tech Stack:** Node 22 vanilla ESM + `node:sqlite` + `node --test` on the server; React 19 + Vite + TypeScript + Vitest/RTL in `webapp/`. No new npm dependency. The real sms.md v3 API (`https://api.sms.md`, header `X-Api-Token`).

**Spec:** `docs/superpowers/specs/2026-09-26-sms-notify-design.md`, as settled by `docs/design/RASPUNSURI.md` §„Spec SMS” (answers 1–12). Where the two differ, RASPUNSURI wins; each such point is called out inline as **[RASPUNSURI n]**.

## Global Constraints

- **P1 only.** In scope: `#shared` domain modules, the `sms-notify` server feature, the „Furnizor SMS” card, the „Șabloane” tab, and „Trimite SMS” / „Trimite tuturor” from „De notificat”. **Out of scope** (spec §10.12, [RASPUNSURI 12]): P2 — dialogs 2a/2b in „Situația plăților” (waits for the full screen, queue point 10); P3 — the „Mesaje SMS” tab with the log table, filters, „Retrimite”, `GET /api/sms-log`. Do not add tasks for them.
- **No automatic sending, ever** (spec §6). Every send starts from an operator click and passes through the confirmation dialog.
- **Log-then-send-then-update.** A `sms_log` row is inserted with `status: 'failed'`, `providerId: null` *before* `POST /v3/messages`, and updated after the response (spec §3.5).
- **Monthly limit is optional and off by default** [RASPUNSURI 6]: `monthlyLimit: number | null`, `null` = no limit, max `5000`. The counter is one global number for this install — **no per-filială split** (filiale are excluded this whole session per `COADA-DE-LUCRU.md` and the closing line of RASPUNSURI.md); this is a deliberate simplification, not a gap.
- **„Fără diacritice la trimitere” defaults to `true`** [RASPUNSURI 3] on the seeded template, on a new template in the editor, and when the field is missing in `POST /api/sms-template-save`.
- **Only one seeded template**, „Reamintire restanță” (`TPL-restanta`) [RASPUNSURI 4]. No „Plată parțială”.
- **One SMS per child**: parent 1's phone, falling back to parent 2's [RASPUNSURI 5].
- **Rate limit handled reactively** [RASPUNSURI 10]: a `429` is an account-scoped transient failure that stops the batch (rest `skipped`, nothing debited). No `Retry-After` wait, no rate limiter. The spec's 1 s pause between sequential requests (§5.2 step 4, §4.6) stays — it is one injected `sleep`.
- **Retry is manual** [RASPUNSURI 11]: „Reîncearcă” in the dialog resends only `failed` + `skipped`. No queue.
- **Fourth status „Necunoscut”** [RASPUNSURI 7]: `SmsLogStatus = 'sent' | 'delivered' | 'failed' | 'unknown'`; a `sent` row older than 48 h becomes `unknown`. The badge mapping (all four tones/labels) is defined once in `webapp/src/shared/sms/sms-status-badge.tsx` so P3 reuses it.
- **Retention** [RASPUNSURI 8]: after 365 days `text` and `phone` are blanked on `sms_log` rows, using the same mechanism as `healthNotes` — a sweep at server start, wired in `main.mjs` next to `app.expireHealthNotes()`, not an on-read check.
- **„Copiază” stays** next to „Trimite SMS” in „De notificat”, as a secondary button [RASPUNSURI 9].
- **Sender name and sms.md account are the user's decisions** [RASPUNSURI 1–2]; the config has a free `sender` field (max 15) and no hardcoded default. Nothing in this plan blocks on them.
- The token never appears in HTTP responses, audit rows or logs; `SmsStatus.tokenMasked` = `'••••••••' + last 4`.
- Server error contract: `fail(message, status)` from `#core/server/errors/domain-error.mjs`; one local `catch` per route only to translate a classified network failure (SKILL.md §Erori).
- Import boundaries: `sms-notify` imports no other feature; `sms-notify/domain/*` imports only `#shared/*`; `webapp/src/features/notify` and `notifications` import SMS UI only from `@shared/sms`.
- After each phase: `npm run check` at the repo root, and `npm run typecheck && npm test` in `webapp/` whenever `webapp/` changed.

---

## Phase 1 — `#shared`: pure domain (TDD)

### Task 1: Moldovan phone normalization

**Files:**
- Create: `src/shared/domain/phone-number.mjs`
- Test: `src/shared/domain/phone-number.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `MOLDOVAN_MOBILE_PREFIXES` (`['60','61','62','67','68','69','76','78','79','80']`), `normalizeMoldovanPhone(raw: unknown): string | null` → `'+373XXXXXXXX'` or `null`.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/domain/phone-number.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoldovanPhone } from './phone-number.mjs';

test('fiecare formă acceptată devine E.164 +373 + 8 cifre', () => {
  for (const raw of ['+373 69123456', '373 69123456', '0 69123456', '069123456', '69123456', '0037369123456'])
    assert.equal(normalizeMoldovanPhone(raw), '+37369123456', raw);
});

test('spațiile, punctele, cratimele și parantezele sunt ignorate', () => {
  assert.equal(normalizeMoldovanPhone('(+373) 69-12.34 56'), '+37369123456');
});

test('prefixul mobil trebuie să fie unul din lista sms.md', () => {
  for (const prefix of ['60', '61', '62', '67', '68', '69', '76', '78', '79', '80'])
    assert.equal(normalizeMoldovanPhone(`0${prefix}123456`), `+373${prefix}123456`);
  assert.equal(normalizeMoldovanPhone('077123456'), null);
  assert.equal(normalizeMoldovanPhone('022123456'), null);
});

test('7 sau 9 cifre, numere străine, text gol sau non-șir → null', () => {
  assert.equal(normalizeMoldovanPhone('6912345'), null);
  assert.equal(normalizeMoldovanPhone('691234567'), null);
  assert.equal(normalizeMoldovanPhone('+40 721 000 000'), null);
  assert.equal(normalizeMoldovanPhone(''), null);
  assert.equal(normalizeMoldovanPhone('fără telefon'), null);
  assert.equal(normalizeMoldovanPhone(undefined), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/phone-number.test.mjs`
Expected: FAIL — `Cannot find module './phone-number.mjs'`.

- [ ] **Step 3: Implement**

Create `src/shared/domain/phone-number.mjs`:

```javascript
// Prefixele mobile acceptate de sms.md pentru destinația „moldova” (spec §4.2).
export const MOLDOVAN_MOBILE_PREFIXES = ['60', '61', '62', '67', '68', '69', '76', '78', '79', '80'];

/**
 * `+373XXXXXXXX` (E.164) sau null dacă textul nu e un număr mobil moldovenesc valid.
 * null înseamnă „fără telefon”: exclus din trimitere, marcat în dialog.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeMoldovanPhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('373')) digits = digits.slice(3);
  else if (digits.length === 9 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 8 || !MOLDOVAN_MOBILE_PREFIXES.includes(digits.slice(0, 2))) return null;
  return '+373' + digits;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/phone-number.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/phone-number.mjs src/shared/domain/phone-number.test.mjs
git commit -m "feat(shared): normalize Moldovan mobile numbers to E.164"
```

---

### Task 2: SMS segment counting (GSM-7 / UCS-2)

**Files:**
- Create: `src/shared/domain/sms-segments.mjs`
- Test: `src/shared/domain/sms-segments.test.mjs`

**Interfaces:**
- Produces: `countSmsSegments(text: string): { characters: number, segments: number, encoding: 'gsm-7' | 'ucs-2' }`. `characters` = septets for GSM-7 (extension chars count 2), UTF-16 code units for UCS-2. Empty text → `0` segments.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/domain/sms-segments.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { countSmsSegments } from './sms-segments.mjs';

const ascii = length => 'a'.repeat(length);

test('text GSM-7: 160 caractere = 1 segment, 161 = 2, 306 = 2, 307 = 3', () => {
  assert.deepEqual(countSmsSegments(ascii(160)), { characters: 160, segments: 1, encoding: 'gsm-7' });
  assert.equal(countSmsSegments(ascii(161)).segments, 2);
  assert.equal(countSmsSegments(ascii(306)).segments, 2);
  assert.equal(countSmsSegments(ascii(307)).segments, 3);
});

test('un singur „ă” comută tot mesajul pe UCS-2: 100 caractere devin 2 segmente', () => {
  const result = countSmsSegments('ă' + ascii(99));
  assert.equal(result.encoding, 'ucs-2');
  assert.equal(result.characters, 100);
  assert.equal(result.segments, 2);
});

test('UCS-2: 70 caractere = 1 segment, 71 = 2', () => {
  assert.equal(countSmsSegments('ș' + ascii(69)).segments, 1);
  assert.equal(countSmsSegments('ș' + ascii(70)).segments, 2);
});

test('caracterele din extensia GSM-7 (€ { } [ ] ~ \\ | ^) numără dublu, fără să comute pe UCS-2', () => {
  const result = countSmsSegments('€{}');
  assert.deepEqual(result, { characters: 6, segments: 1, encoding: 'gsm-7' });
  assert.equal(countSmsSegments(ascii(158) + '€').segments, 1);
  assert.equal(countSmsSegments(ascii(159) + '€').segments, 2);
});

test('textul gol are 0 segmente', () => {
  assert.deepEqual(countSmsSegments(''), { characters: 0, segments: 0, encoding: 'gsm-7' });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/domain/sms-segments.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/shared/domain/sms-segments.mjs`:

```javascript
// Setul de bază GSM 03.38 (fără ESC) și extensia lui; orice alt caracter — chirilice,
// ă â î ș ț, emoji — comută tot mesajul pe UCS-2 (regulile din documentația sms.md, §Billing).
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '\f^{}\\[~]|€';

const GSM7_SINGLE = 160;
const GSM7_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

/** @typedef {{ characters: number, segments: number, encoding: 'gsm-7' | 'ucs-2' }} SmsSegmentCount */

/**
 * @param {string} text
 * @returns {SmsSegmentCount}
 */
export function countSmsSegments(text) {
  if (!text) return { characters: 0, segments: 0, encoding: 'gsm-7' };
  let septets = 0;
  for (const character of text) {
    if (GSM7_BASIC.includes(character)) septets += 1;
    else if (GSM7_EXTENDED.includes(character)) septets += 2;
    else {
      const units = text.length;
      return { characters: units, segments: units <= UCS2_SINGLE ? 1 : Math.ceil(units / UCS2_MULTI), encoding: 'ucs-2' };
    }
  }
  return { characters: septets, segments: septets <= GSM7_SINGLE ? 1 : Math.ceil(septets / GSM7_MULTI), encoding: 'gsm-7' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/shared/domain/sms-segments.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/sms-segments.mjs src/shared/domain/sms-segments.test.mjs
git commit -m "feat(shared): count SMS segments for GSM-7 and UCS-2"
```

---

### Task 3: `stripDiacritics`

**Files:**
- Create: `src/shared/format/strip-diacritics.mjs`
- Test: `src/shared/format/strip-diacritics.test.mjs`

**Interfaces:**
- Produces: `stripDiacritics(text: string): string` — NFD + removal of combining marks; covers ă â î ș ț and the cedilla variants ş ţ.

- [ ] **Step 1: Write the failing tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDiacritics } from './strip-diacritics.mjs';

test('elimină diacriticele românești, inclusiv variantele cu sedilă', () => {
  assert.equal(stripDiacritics('Bună ziua, Ștefan! Ţară, şoaptă, împărat, mâine'), 'Buna ziua, Stefan! Tara, soapta, imparat, maine');
});

test('lasă neschimbat un text fără diacritice și textul gol', () => {
  assert.equal(stripDiacritics('Rest de plata: 200,00 lei'), 'Rest de plata: 200,00 lei');
  assert.equal(stripDiacritics(''), '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/shared/format/strip-diacritics.test.mjs` — FAIL, module missing.

- [ ] **Step 3: Implement**

```javascript
/**
 * Fără diacritice: NFD desface ă/â/î/ș/ț (și ş/ţ cu sedilă) în litera de bază
 * plus semnul combinat, pe care îl eliminăm.
 * @param {string} text
 */
export const stripDiacritics = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
```

- [ ] **Step 4: Run to verify pass** — `node --test src/shared/format/strip-diacritics.test.mjs`, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/format/strip-diacritics.mjs src/shared/format/strip-diacritics.test.mjs
git commit -m "feat(shared): stripDiacritics for SMS text"
```

---

### Task 4: `sms-template.mjs` replaces `billing/domain/reminder-message.mjs`

**Decision:** `reminderMessage` is imported only by `webapp/src/features/notify/useNotify.ts` (through `#features/billing/index.web.mjs`) and its own test — verified by grep on 2026-09-27; `src/app/server/telegram-digest.mjs` and `telegram-notify` do **not** use it (the digest builds its own text in `daily-digest.mjs`). Moving it breaks nothing on the Telegram side, so the file is deleted outright, no compatibility re-export.

**Files:**
- Create: `src/shared/domain/sms-template.mjs`
- Test: `src/shared/domain/sms-template.test.mjs`
- Delete: `src/features/billing/domain/reminder-message.mjs`, `src/features/billing/domain/reminder-message.test.mjs`
- Modify: `src/features/billing/index.web.mjs` (drop the `reminderMessage` export), `src/features/billing/README.md` (drop the mention, if any, and note the move)
- Modify: `webapp/src/features/notify/useNotify.ts`

**Interfaces:**
- Produces:
  - `SMS_TEMPLATE_VARIABLES: readonly ['părinte','copil','luna','taxa','rest','achitat','zi']`
  - `DEFAULT_SMS_TEMPLATE_BODY: string`
  - `SMS_TEMPLATE_MAX_LENGTH = 800`
  - `renderSmsTemplate(body: string, variables: Record<string, string>): string` — unknown variables stay literal; an empty `{părinte}` also removes the preceding `, `.
  - `smsVariablesFor({ child, parentName, obligation, month }): Record<string, string>`
  - `findUnknownSmsVariables(body: string): string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/domain/sms-template.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SMS_TEMPLATE_BODY,
  SMS_TEMPLATE_VARIABLES,
  renderSmsTemplate,
  smsVariablesFor,
  findUnknownSmsVariables,
} from './sms-template.mjs';

const child = (overrides = {}) => /** @type {any} */ ({ id: 'c1', name: 'Ion', parent: 'Maria', ...overrides });
const obligation = { expected: 500, paid: 300, rest: 200, due: '2026-09-10' };

test('șablonul implicit randat e identic caracter cu caracter cu vechiul reminderMessage', () => {
  const text = renderSmsTemplate(
    DEFAULT_SMS_TEMPLATE_BODY,
    smsVariablesFor({ child: child(), parentName: 'Maria', obligation, month: '2026-09' }),
  );
  assert.equal(
    text,
    'Bună ziua, Maria! Vă reamintim că taxa pentru septembrie 2026 pentru Ion este de 500,00 lei, cu scadența la ' +
      '10.09.2026. Rest de plată: 200,00 lei. Vă mulțumim! Startica',
  );
});

test('{părinte} gol elimină și virgula din față', () => {
  const text = renderSmsTemplate(
    DEFAULT_SMS_TEMPLATE_BODY,
    smsVariablesFor({ child: child({ parent: '' }), parentName: '', obligation, month: '2026-09' }),
  );
  assert.match(text, /^Bună ziua! Vă reamintim/);
});

test('o variabilă necunoscută rămâne literal în text', () => {
  assert.equal(renderSmsTemplate('Salut {copil} {xyz}', { copil: 'Ion' }), 'Salut Ion {xyz}');
});

test('smsVariablesFor completează toate cele 7 variabile', () => {
  const variables = smsVariablesFor({ child: child(), parentName: 'Maria', obligation, month: '2026-09' });
  assert.deepEqual(Object.keys(variables).sort(), [...SMS_TEMPLATE_VARIABLES].sort());
  assert.equal(variables.achitat, '300,00 lei');
});

test('findUnknownSmsVariables întoarce doar numele care nu sunt în listă', () => {
  assert.deepEqual(findUnknownSmsVariables('{copil} {rest} {suma} {zi}'), ['suma']);
  assert.deepEqual(findUnknownSmsVariables('fără variabile'), []);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test src/shared/domain/sms-template.test.mjs`, FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/shared/domain/sms-template.mjs`:

```javascript
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate, formatMonthName } from '#shared/format/date-format.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {{ expected: number | null, paid: number | null, rest: number | null, due: string }} SmsObligation */

export const SMS_TEMPLATE_VARIABLES = Object.freeze(['părinte', 'copil', 'luna', 'taxa', 'rest', 'achitat', 'zi']);
export const SMS_TEMPLATE_MAX_LENGTH = 800;

// Textul fix de dinainte de șabloane, rescris cu variabile; e și seed-ul din sms_templates.
export const DEFAULT_SMS_TEMPLATE_BODY =
  'Bună ziua, {părinte}! Vă reamintim că taxa pentru {luna} pentru {copil} este de {taxa}, cu scadența la {zi}. ' +
  'Rest de plată: {rest}. Vă mulțumim! Startica';

/**
 * Înlocuiește variabilele; cele necunoscute rămân ca atare (vizibile în previzualizare, nu ascunse).
 * @param {string} body
 * @param {Record<string, string>} variables
 */
export function renderSmsTemplate(body, variables) {
  return body
    .replace(/, \{părinte\}/g, variables['părinte'] ? `, ${variables['părinte']}` : '')
    .replace(/\{([^{}]+)\}/g, (match, name) => (Object.hasOwn(variables, name) ? variables[name] : match));
}

/**
 * @param {{ child: Child, parentName: string, obligation: SmsObligation, month: string }} params
 * @returns {Record<string, string>}
 */
export function smsVariablesFor({ child, parentName, obligation, month }) {
  return {
    părinte: parentName,
    copil: child.name,
    luna: formatMonthName(month),
    taxa: formatMoney(obligation.expected),
    rest: formatMoney(obligation.rest),
    achitat: formatMoney(obligation.paid),
    zi: formatDate(obligation.due),
  };
}

/** @param {string} body */
export function findUnknownSmsVariables(body) {
  return [...body.matchAll(/\{([^{}]+)\}/g)]
    .map(match => match[1])
    .filter(name => !SMS_TEMPLATE_VARIABLES.includes(name));
}
```

(`formatMoney` is called without a currency, exactly as `reminderMessage` did; when queue point 8's UI adds `obligation.currency`, this is the single place to pass it.)

- [ ] **Step 4: Run to verify pass** — 5 tests green.

- [ ] **Step 5: Delete the old module and switch its consumers**

Delete `src/features/billing/domain/reminder-message.mjs` and `.test.mjs`. `src/features/billing/index.web.mjs` becomes:

```javascript
export { evaluateChildrenForMonth } from './domain/month-evaluation.mjs';
```

In `webapp/src/features/notify/useNotify.ts`, change the first import to `import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';`, add `import { DEFAULT_SMS_TEMPLATE_BODY, renderSmsTemplate, smsVariablesFor } from '@domain/sms-template.mjs';`, and replace the `message:` line with:

```typescript
    message: renderSmsTemplate(
      DEFAULT_SMS_TEMPLATE_BODY,
      smsVariablesFor({ child, parentName: child.parent, obligation, month }),
    ),
```

(The clipboard text stays byte-identical — Task 4 Step 1's regression test guarantees it. The dialog in Phase 5 will use the template from the database; „Copiază” keeps the constant, as spec §3.3 allows.)

Update `src/features/billing/README.md`: remove any `reminderMessage` row and add under „Cum rămâne decuplat”: `| Mesajul de reamintire | \`#shared/domain/sms-template.mjs\` (folosit și de sms-notify) | șablon propriu în billing |`.

- [ ] **Step 6: Run both suites**

Run: `npm run check` and, in `webapp/`, `npm run typecheck && npm test`.
Expected: green; `NotifyPage.test.tsx` „Copiază toate mesajele” still passes.

- [ ] **Step 7: Commit**

```bash
git add src/shared/domain/sms-template.mjs src/shared/domain/sms-template.test.mjs src/features/billing webapp/src/features/notify/useNotify.ts
git commit -m "refactor(billing): move reminderMessage to #shared/domain/sms-template"
```

---

## Phase 2 — Storage: schema, types, repositories

### Task 5: `sms_log` and `sms_templates` tables in the core schema

**Decision:** The two tables go into `SCHEMA` in `src/core/server/database/schema.mjs` as `CREATE TABLE IF NOT EXISTS`, exactly like `audit_changes` and `settings`. `openDatabase()` runs `applySchema()` on every start, so an existing `startica.db` gets the tables on the next launch; `src/core/server/database/migrations/` (`001-app-state-to-records`, `002-groups-entity`) is for *data transformations* with a backup first, which this is not. `openDatabaseReadOnly()` (the `--telegram` process) never touches these tables.

**Files:**
- Modify: `src/core/server/database/schema.mjs`
- Modify: `src/core/server/database/sqlite-connection.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `src/core/server/database/sqlite-connection.test.mjs` (reuse its existing `createTemporaryHome(t)` helper, which returns `{ dataDir, backupDir }`):

```javascript
test('schema creează sms_log și sms_templates cu indexurile lor, idempotent', t => {
  const { db } = openDatabase(createTemporaryHome(t));
  applySchema(db);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sms_%' ORDER BY name").all();
  assert.deepEqual(tables.map(row => row.name), ['sms_log', 'sms_templates']);
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sms_log' ORDER BY name").all();
  assert.deepEqual(indexes.map(row => row.name), ['sms_log_child_created', 'sms_log_status']);
  db.close();
});
```

(Add `import { applySchema } from './schema.mjs';` at the top of the test file.)

- [ ] **Step 2: Run to verify failure** — `node --test src/core/server/database/sqlite-connection.test.mjs`, FAIL (no `sms_*` tables).

- [ ] **Step 3: Implement**

Append to the `SCHEMA` template string in `schema.mjs`, after the `settings` line:

```sql
  CREATE TABLE IF NOT EXISTS sms_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,body TEXT NOT NULL,strip_diacritics INTEGER NOT NULL DEFAULT 1,is_default INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sms_log(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,child_id TEXT,recipient_name TEXT NOT NULL,child_name TEXT NOT NULL,phone TEXT NOT NULL,text TEXT NOT NULL,template_id TEXT,template_name TEXT NOT NULL,month TEXT,source TEXT NOT NULL,characters INTEGER NOT NULL,segments INTEGER NOT NULL,encoding TEXT NOT NULL,cost TEXT,status TEXT NOT NULL,provider_id TEXT,provider_status TEXT NOT NULL DEFAULT '',provider_error TEXT NOT NULL DEFAULT '',status_checked_at TEXT NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS sms_log_child_created ON sms_log(child_id,created_at);
  CREATE INDEX IF NOT EXISTS sms_log_status ON sms_log(status);
```

- [ ] **Step 4: Run to verify pass**, then `npm test` (nothing else reads the schema string).

- [ ] **Step 5: Commit**

```bash
git add src/core/server/database/schema.mjs src/core/server/database/sqlite-connection.test.mjs
git commit -m "feat(core): sms_log and sms_templates tables"
```

---

### Task 6: Feature types

**Files:**
- Create: `src/features/sms-notify/sms-notify.types.d.mts`

**Interfaces:** all of the below; later tasks import them with `/** @typedef {import('../sms-notify.types.mjs').X} X */`.

- [ ] **Step 1: Write the file**

```typescript
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { SmsSegmentCount } from '#shared/domain/sms-segments.mjs';

/** Conținutul `Startica_Date\sms.json`, scris doar de server. Tokenul nu iese niciodată din server. */
export interface SmsConfig {
  token: string;
  /** Numele de expeditor aprobat în dashboard-ul sms.md, max 15 caractere. */
  sender: string;
  /** null = fără limită (implicit); altfel 1..5000. Contor global pe instalare, nu per filială. */
  monthlyLimit: number | null;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  stripDiacritics: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsTemplateInput {
  id?: string;
  name: string;
  body: string;
  stripDiacritics: boolean;
  isDefault: boolean;
}

export type SmsLogStatus = 'sent' | 'delivered' | 'failed' | 'unknown';
export type SmsSource = 'status-row' | 'status-bulk' | 'notify' | 'resend' | 'test';
export type SmsEncoding = 'gsm-7' | 'ucs-2';

export interface SmsLogEntry {
  id: number;
  createdAt: string;
  childId: string | null;
  recipientName: string;
  childName: string;
  phone: string;
  text: string;
  templateId: string | null;
  templateName: string;
  month: string | null;
  source: SmsSource;
  characters: number;
  segments: number;
  encoding: SmsEncoding;
  cost: string | null;
  status: SmsLogStatus;
  providerId: string | null;
  providerStatus: string;
  providerError: string;
  statusCheckedAt: string;
}

export type NewSmsLogEntry = Omit<SmsLogEntry, 'id'>;

export interface SmsMonthlyStats {
  sentThisMonth: number;
  failedThisMonth: number;
  segmentsThisMonth: number;
}

export interface SmsLastNotified {
  at: string;
  status: SmsLogStatus;
  month: string | null;
  templateName: string;
}

export interface SmsFailure {
  kind: 'transient' | 'permanent';
  scope: 'recipient' | 'account';
  /** Codul sms.md sau 'NETWORK' / 'TIMEOUT'. */
  code: string;
  message: string;
}

/** `data` din răspunsul 200 al POST /v3/messages. */
export interface SmsSendData {
  id: string;
  to: string;
  text: string;
  characters: number;
  segments: number;
  encoding: SmsEncoding;
  cost: string;
  currency: string;
}

export interface SmsService {
  sendMessage(options: { token: string; from: string; to: string; text: string }): Promise<SmsSendData>;
  getMessage(options: { token: string; id: string }): Promise<{ id: string; status: { id: number; name: string } }>;
  getBalance(options: { token: string }): Promise<{ balance: string; currency: string }>;
  listActiveSenders(options: { token: string }): Promise<string[]>;
  classifySmsFailure(error: unknown): SmsFailure;
}

export interface SmsStatus {
  configured: boolean;
  sender: string;
  tokenMasked: string;
  monthlyLimit: number | null;
  sentThisMonth: number;
  failedThisMonth: number;
  segmentsThisMonth: number;
  balance: string | null;
  balanceCheckedAt: string;
  /** Ultimul cost/segment observat în jurnal (MDL), sau 0.30 dacă jurnalul e gol — pentru estimarea din dialog. */
  unitCost: number;
  lastError: string;
}

export interface SmsSendMessage {
  childId: string;
  childName: string;
  recipientName: string;
  phone: string;
  text: string;
}

export interface SmsSendRequest {
  source: Exclude<SmsSource, 'test'>;
  month: string | null;
  templateId: string | null;
  messages: SmsSendMessage[];
}

export interface SmsSendOutcome {
  childId: string;
  outcome: 'sent' | 'failed' | 'skipped';
  logId: number | null;
  segments: number;
  cost: string | null;
  error: string;
}

export interface SmsBatchResult {
  ok: boolean;
  results: SmsSendOutcome[];
  stopped: { code: string; message: string } | null;
}

export type SmsSendResult = SmsBatchResult & { status: SmsStatus };

export interface SmsSendServiceDependencies {
  smsService: SmsService;
  smsLogRepository: import('./server/sms-log.repository.mjs').SmsLogRepository;
  smsTemplateRepository: import('./server/sms-template.repository.mjs').SmsTemplateRepository;
  readConfig: () => SmsConfig | null;
  auditTrail: AuditTrail;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface SmsRoutesDependencies {
  database: import('node:sqlite').DatabaseSync;
  dataDirectory: string;
  smsService: SmsService;
  auditTrail: AuditTrail;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

/** Un rând pregătit de ecranul apelant: copilul și obligația lui pe luna selectată. */
export interface SmsRecipientRow {
  child: import('#shared/contracts/record-types.mjs').Child;
  obligation: import('#shared/domain/sms-template.mjs').SmsObligation;
}

export interface PlannedSmsMessage extends SmsSendMessage, SmsSegmentCount {
  parentLabel: string;
}

export interface SmsBatchPlan {
  messages: PlannedSmsMessage[];
  excluded: { childId: string; childName: string; reason: string }[];
  totalSegments: number;
}
```

(`SmsLogRepository` / `SmsTemplateRepository` are the `ReturnType`s exported as `@typedef` from the two repository modules in Tasks 8–9.)

- [ ] **Step 2: Typecheck** — `npm run typecheck`. Expected: passes once Tasks 8–9 exist; until then `tsc` reports the two unresolved imports — acceptable mid-phase, or temporarily comment the two `import()` lines and restore them in Task 9. Prefer the second.

- [ ] **Step 3: Commit** (together with Task 7 below, or alone):

```bash
git add src/features/sms-notify/sms-notify.types.d.mts
git commit -m "feat(sms-notify): feature types"
```

---

### Task 7: Config repository (`sms.json`)

**Files:**
- Create: `src/features/sms-notify/server/sms-config.repository.mjs`
- Test: `src/features/sms-notify/server/sms-config.repository.test.mjs`

**Interfaces:**
- Consumes: `#core/server/files/json-file.mjs`, `#core/server/files/remove-file-if-present.mjs`.
- Produces: `smsConfigFilePath(dataDir)`, `readSmsConfig(dataDir): SmsConfig | null`, `writeSmsConfig(dataDir, config)`, `removeSmsConfig(dataDir)`, `maskSmsToken(token): string`.

- [ ] **Step 1: Write the failing tests** — copy `telegram-config.repository.test.mjs` structure (temp dir with `mkdtempSync`, `t.after` cleanup) and cover: missing file → `null`; corrupt JSON → `null` + one `console.error`; write/read round-trip of `{ token: 'tok-1234abcd', sender: 'Startica', monthlyLimit: null }` and of `monthlyLimit: 500`; atomic write leaves only `sms.json`; remove existing / remove missing does not throw; `maskSmsToken('tok-1234abcd')` → `'••••••••abcd'`, `maskSmsToken('')` → `''`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — same shape as `telegram-config.repository.mjs` with `CONFIG_FILE_NAME = 'sms.json'`, plus:

```javascript
/** @param {string} token */
export const maskSmsToken = token => (token ? '••••••••' + token.slice(-4) : '');
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/server/sms-config.repository.mjs src/features/sms-notify/server/sms-config.repository.test.mjs
git commit -m "feat(sms-notify): sms.json config repository"
```

---

### Task 8: Template repository (`sms_templates`)

**Files:**
- Create: `src/features/sms-notify/server/sms-template.repository.mjs`
- Test: `src/features/sms-notify/server/sms-template.repository.test.mjs`

**Interfaces:**
- Consumes: `node:crypto` (`randomUUID`), `DEFAULT_SMS_TEMPLATE_BODY` from `#shared/domain/sms-template.mjs`, `applySchema` only in tests.
- Produces: `DEFAULT_SMS_TEMPLATE_ID = 'TPL-restanta'`, `createSmsTemplateRepository(database, { now = () => new Date() })` → `{ list(): SmsTemplate[], find(id): SmsTemplate | null, findDefault(): SmsTemplate, save(input: SmsTemplateInput): SmsTemplate, remove(id): boolean, setDefault(id): void }`. Construction seeds the default template with `INSERT OR IGNORE`. `@typedef {ReturnType<typeof createSmsTemplateRepository>} SmsTemplateRepository`.

- [ ] **Step 1: Write the failing tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { DEFAULT_SMS_TEMPLATE_BODY } from '#shared/domain/sms-template.mjs';
import { createSmsTemplateRepository, DEFAULT_SMS_TEMPLATE_ID } from './sms-template.repository.mjs';

const fixedNow = () => new Date('2026-09-27T10:00:00.000Z');

function openRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return { database, repository: createSmsTemplateRepository(database, { now: fixedNow }) };
}

test('seed-ul creează „Reamintire restanță” implicit, fără diacritice pornit, o singură dată', t => {
  const { database, repository } = openRepository(t);
  createSmsTemplateRepository(database, { now: fixedNow });
  const templates = repository.list();
  assert.equal(templates.length, 1);
  assert.deepEqual(templates[0], {
    id: DEFAULT_SMS_TEMPLATE_ID,
    name: 'Reamintire restanță',
    body: DEFAULT_SMS_TEMPLATE_BODY,
    stripDiacritics: true,
    isDefault: true,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
  });
});

test('save fără id creează un șablon nou cu id TPL-<uuid>; cu id actualizează și updatedAt', t => {
  const { repository } = openRepository(t);
  const created = repository.save({ name: 'Nou', body: 'Salut {copil}', stripDiacritics: false, isDefault: false });
  assert.match(created.id, /^TPL-[0-9a-f-]{36}$/);
  const updated = repository.save({ ...created, name: 'Nou 2' });
  assert.equal(updated.id, created.id);
  assert.equal(repository.find(created.id)?.name, 'Nou 2');
});

test('setDefault mută flagul atomic: exact unul e implicit', t => {
  const { repository } = openRepository(t);
  const second = repository.save({ name: 'Al doilea', body: 'x', stripDiacritics: true, isDefault: false });
  repository.setDefault(second.id);
  assert.deepEqual(repository.list().map(template => [template.id, template.isDefault]), [
    [DEFAULT_SMS_TEMPLATE_ID, false],
    [second.id, true],
  ]);
  assert.equal(repository.findDefault().id, second.id);
});

test('save cu isDefault true face celelalte ne-implicite', t => {
  const { repository } = openRepository(t);
  repository.save({ name: 'Al doilea', body: 'x', stripDiacritics: true, isDefault: true });
  assert.equal(repository.list().filter(template => template.isDefault).length, 1);
});

test('remove întoarce true pentru un id existent și false pentru unul inexistent', t => {
  const { repository } = openRepository(t);
  const created = repository.save({ name: 'De șters', body: 'x', stripDiacritics: true, isDefault: false });
  assert.equal(repository.remove(created.id), true);
  assert.equal(repository.remove('TPL-nu-exista'), false);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```javascript
import { randomUUID } from 'node:crypto';
import { DEFAULT_SMS_TEMPLATE_BODY } from '#shared/domain/sms-template.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsTemplate} SmsTemplate */
/** @typedef {import('../sms-notify.types.mjs').SmsTemplateInput} SmsTemplateInput */

export const DEFAULT_SMS_TEMPLATE_ID = 'TPL-restanta';
const COLUMNS = 'id,name,body,strip_diacritics,is_default,created_at,updated_at';

/** @returns {SmsTemplate} */
const toTemplate = row => ({
  id: row.id,
  name: row.name,
  body: row.body,
  stripDiacritics: row.strip_diacritics === 1,
  isDefault: row.is_default === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now?: () => Date }} [options]
 */
export function createSmsTemplateRepository(database, { now = () => new Date() } = {}) {
  const seededAt = now().toISOString();
  // Seed la prima deschidere; a doua deschidere nu dublează (INSERT OR IGNORE pe cheia primară).
  database
    .prepare(`INSERT OR IGNORE INTO sms_templates(${COLUMNS}) VALUES(?,?,?,1,1,?,?)`)
    .run(DEFAULT_SMS_TEMPLATE_ID, 'Reamintire restanță', DEFAULT_SMS_TEMPLATE_BODY, seededAt, seededAt);

  const selectAll = database.prepare(`SELECT ${COLUMNS} FROM sms_templates ORDER BY created_at, id`);
  const selectOne = database.prepare(`SELECT ${COLUMNS} FROM sms_templates WHERE id=?`);
  const selectDefault = database.prepare(`SELECT ${COLUMNS} FROM sms_templates WHERE is_default=1 LIMIT 1`);
  const insert = database.prepare(`INSERT INTO sms_templates(${COLUMNS}) VALUES(?,?,?,?,?,?,?)`);
  const update = database.prepare(
    'UPDATE sms_templates SET name=?,body=?,strip_diacritics=?,is_default=?,updated_at=? WHERE id=?',
  );
  // O singură instrucțiune: nu există moment în care zero sau două șabloane să fie implicite.
  const moveDefault = database.prepare('UPDATE sms_templates SET is_default=(id=?)');
  const remove = database.prepare('DELETE FROM sms_templates WHERE id=?');

  const list = () => selectAll.all().map(toTemplate);
  const find = id => {
    const row = selectOne.get(id);
    return row ? toTemplate(row) : null;
  };
  const findDefault = () => toTemplate(selectDefault.get());

  /** @param {SmsTemplateInput} input @returns {SmsTemplate} */
  function save({ id, name, body, stripDiacritics, isDefault }) {
    const timestamp = now().toISOString();
    const existing = id ? selectOne.get(id) : null;
    const templateId = existing ? id : `TPL-${randomUUID()}`;
    if (existing) update.run(name, body, stripDiacritics ? 1 : 0, isDefault ? 1 : 0, timestamp, templateId);
    else insert.run(templateId, name, body, stripDiacritics ? 1 : 0, isDefault ? 1 : 0, timestamp, timestamp);
    if (isDefault) moveDefault.run(templateId);
    return /** @type {SmsTemplate} */ (find(templateId));
  }

  return {
    list,
    find,
    findDefault,
    save,
    /** @param {string} id */ setDefault: id => void moveDefault.run(id),
    /** @param {string} id */ remove: id => remove.run(id).changes > 0,
  };
}

/** @typedef {ReturnType<typeof createSmsTemplateRepository>} SmsTemplateRepository */
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/server/sms-template.repository.mjs src/features/sms-notify/server/sms-template.repository.test.mjs
git commit -m "feat(sms-notify): sms_templates repository with seeded default"
```

---

### Task 9: Log repository (`sms_log`), counters, retention

**Files:**
- Create: `src/features/sms-notify/server/sms-log.repository.mjs`
- Test: `src/features/sms-notify/server/sms-log.repository.test.mjs`

**Interfaces:**
- Produces: `createSmsLogRepository(database)` → 
  - `insert(entry: NewSmsLogEntry): number` (new id)
  - `update(id: number, patch: Partial<NewSmsLogEntry>): void`
  - `find(id): SmsLogEntry | null`
  - `monthlyStats(now: Date): SmsMonthlyStats` — rows in the *local* calendar month of `now` (`sentThisMonth` = `status != 'failed'`, `failedThisMonth`, `segmentsThisMonth` = Σ segments of non-failed).
  - `lastUnitCost(): number` — last row with `cost` not null and `segments > 0`: `Number(cost) / segments`; else `0.3`.
  - `lastNotifiedByChild(): Record<string, SmsLastNotified>` — newest non-failed, non-test row per `child_id`.
  - `pendingDelivery(limit = 50): SmsLogEntry[]` — `status='sent' AND provider_id IS NOT NULL`, newest first.
  - `markUnknownOlderThan(cutoffIso: string): number` — `sent` rows with `created_at < cutoff` → `unknown`.
  - `expireOldEntries(todayStr: string): { expired: number }` — blanks `text` and `phone` on rows with `created_at < todayStr - 365 days` and non-empty text or phone.
  - `SMS_LOG_RETENTION_DAYS = 365`. `@typedef {ReturnType<typeof createSmsLogRepository>} SmsLogRepository`.

- [ ] **Step 1: Write the failing tests** (same `openRepository` helper as Task 8, with an `entry(overrides)` fixture that returns a fresh `NewSmsLogEntry` each call: `createdAt: '2026-09-27T10:00:00.000Z'`, `childId: 'c1'`, `recipientName: 'Maria'`, `childName: 'Ion'`, `phone: '+37369123456'`, `text: 'Buna ziua'`, `templateId: 'TPL-restanta'`, `templateName: 'Reamintire restanță'`, `month: '2026-09'`, `source: 'notify'`, `characters: 9`, `segments: 1`, `encoding: 'gsm-7'`, `cost: null`, `status: 'failed'`, `providerId: null`, `providerStatus: ''`, `providerError: ''`, `statusCheckedAt: ''`). Tests:

  1. `insert` then `update({ status: 'sent', providerId: 'uuid-1', segments: 2, cost: '0.60' })` → `find` returns the merged row with `id`.
  2. `monthlyStats(new Date('2026-09-27T12:00'))` ignores `failed` rows and rows from another month; sums segments only on non-failed.
  3. `lastUnitCost()` → `0.3` on empty log; after a `sent` row with `cost: '0.60', segments: 2` → `0.3`; after `cost: '0.90', segments: 2` → `0.45`.
  4. `lastNotifiedByChild()` ignores `failed` and `source: 'test'` rows, returns the newest per child with `{ at, status, month, templateName }`.
  5. `pendingDelivery()` returns only `sent` rows with `providerId`, newest first, capped at the limit.
  6. `markUnknownOlderThan('2026-09-25T10:00:00.000Z')` flips only `sent` rows created before the cutoff.
  7. `expireOldEntries('2026-09-27')`: a row from `2025-09-27` (exactly 365 days) gets `text: ''`, `phone: ''`; a row from `2025-09-28` is untouched; the return is `{ expired: 1 }`; calling again returns `{ expired: 0 }`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — columns map `camelCase ↔ snake_case` through one `COLUMN_BY_FIELD` table; `update` builds `SET a=?,b=?` from the patch's keys (all keys validated against the table — a stray key is a programming error, throw). For the month bounds:

```javascript
function localMonthBounds(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}
```

`expireOldEntries`:

```javascript
export const SMS_LOG_RETENTION_DAYS = 365;
// Aceeași politică ca healthNotes (visits/domain/visit-health-notes.mjs): datele
// personale se golesc după 12 luni; rândul rămâne pentru contoare și „Notificat”.
function expireOldEntries(todayStr) {
  const cutoff = shiftDays(todayStr, -SMS_LOG_RETENTION_DAYS) + 'T00:00:00.000Z';
  const { changes } = expire.run(cutoff); // UPDATE sms_log SET text='',phone='' WHERE created_at<? AND (text!='' OR phone!='')
  return { expired: changes };
}
```

(`shiftDays` from `#shared/domain/calendar-month.mjs`.)

- [ ] **Step 4: Run to verify pass**, then restore the two `import()` lines in `sms-notify.types.d.mts` if Task 6 commented them, and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/server/sms-log.repository.mjs src/features/sms-notify/server/sms-log.repository.test.mjs src/features/sms-notify/sms-notify.types.d.mts
git commit -m "feat(sms-notify): sms_log repository with monthly counters and 12-month retention"
```

---

## Phase 3 — Provider client, batch planning, send orchestration

### Task 10: `fake-sms-api.mjs` (test support)

**Files:**
- Create: `src/features/sms-notify/test-support/fake-sms-api.mjs`

**Interfaces:**
- Produces: `createFakeSmsApi(responses?)` → `{ fetch, calls: Array<{ method, url, headers, body }> }`, routing on `new URL(url)` (`host` must be `api.sms.md`, otherwise throw `Cale sms.md neașteptată în test`): `POST /v3/messages` (array-per-call like `sendMessage` in the Telegram fake), `GET /v3/messages/{id}`, `GET /v3/account/balance`, `GET /v3/sender-aliases`. Defaults: send → `200 { status:'success', httpCode:200, data:{ id:'msg-1', to, text, characters, segments, encoding, cost, currency:'MDL', destination:'moldova' } }` computed with `countSmsSegments(body.text)` and `cost = (segments*0.3).toFixed(2)`; message → `{ data: { id, status: { id: 3, name: 'Delivered' } } }`; balance → `{ data: { balance: '100.00', currency: 'MDL' } }`; senders → `{ data: [{ name: 'Startica', status: { id: 1, name: 'Active' } }] }`.
- `SMS_RESPONSES`: `unauthorized` (401 `INVALID_API_TOKEN`), `scopeForbidden` (403 `SCOPE_FORBIDDEN`, message mentions `messages:send`), `insufficientBalance` (402 `INSUFFICIENT_BALANCE`), `invalidTo` (422 `VALIDATION_ERROR`, `errors: { to: ['Invalid number'] }`), `invalidFrom` (422, `errors: { from: [...] }`), `invalidText` (422, `errors: { text: [...] }`), `rateLimited` (429 `RATE_LIMIT_EXCEEDED`), `serverError` (502 `INTERNAL_ERROR`). All as `{ status, body: { status:'error', httpCode, code, message, errors? } }`.

- [ ] **Step 1: Write it** following `fake-telegram-api.mjs` (`jsonResponse`, `resolveResponse`, per-call index for `messages`). Record `headers` from `init.headers` so tests can assert `X-Api-Token`.

- [ ] **Step 2: Commit** with Task 11.

---

### Task 11: `sms.service.mjs` — sms.md client and `classifySmsFailure`

**Files:**
- Create: `src/features/sms-notify/server/sms.service.mjs`
- Test: `src/features/sms-notify/server/sms.service.test.mjs`

**Interfaces:**
- Produces: `createSmsService({ fetch })` → `SmsService`; `classifySmsFailure(error): SmsFailure` also exported standalone; `SMS_API_ROOT = 'https://api.sms.md'`; `SMS_REQUIRED_SCOPES = ['messages:send','messages:read','account:read','senders:read']`.
- Thrown error shape from `callSmsApi`: `Object.assign(new Error(message), { status, code, errors })` where `code` is the envelope's `code` (or `'HTTP_' + status` when the body is not JSON).

- [ ] **Step 1: Write the failing tests** — one `classifySmsFailure` test per row of spec §4.3 (**minus** the `Retry-After` wait: 429 is simply `{ kind:'transient', scope:'account', code:'RATE_LIMIT_EXCEEDED' }`), asserting `kind`, `scope`, `code` and the operator message:

| error | kind | scope | message |
| --- | --- | --- | --- |
| `TypeError('fetch failed')`, `AbortError`, status 5xx / `INTERNAL_ERROR` | transient | account | `Fără internet sau sms.md indisponibil.` |
| 429 | transient | account | idem |
| 401 `INVALID_API_TOKEN` / `AUTHENTICATION_REQUIRED` | permanent | account | `Token sms.md invalid sau dezactivat. Reconectează din Notificări.` |
| 403 `SCOPE_FORBIDDEN` | permanent | account | `Tokenul nu are permisiunea necesară. Creează un token cu messages:send, messages:read, account:read, senders:read.` |
| 402 `INSUFFICIENT_BALANCE` | permanent | account | `Sold insuficient la sms.md. Alimentează contul și reia eșuatele.` |
| 422 with `errors.from` | permanent | account | `Expeditorul nu e aprobat la sms.md.` |
| 422 with `errors.to` or `errors._` | permanent | recipient | `Număr invalid pentru sms.md.` |
| 422 with `errors.text` | permanent | recipient | `sms.md a refuzat textul: <primul mesaj>.` |
| any other code | permanent | recipient | `sms.md a refuzat mesajul (<code>).` |

Plus, with `createFakeSmsApi()`: `sendMessage` sends `POST https://api.sms.md/v3/messages` with headers `X-Api-Token` and `Content-Type: application/json`, body `{ from, to, text }`, and returns `data`; `getMessage` returns `{ id, status }`; `getBalance` returns `{ balance, currency }`; `listActiveSenders` calls `GET /v3/sender-aliases?status=1` and returns `['Startica']`; an error envelope becomes a thrown error with `code` = envelope code.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — mirror `telegram.service.mjs`: `REQUEST_TIMEOUT_MS = 15000`, `AbortSignal.timeout`, `isNetworkError`. `callSmsApi(fetchImpl, token, method, path, body?)` builds `SMS_API_ROOT + path`, always sets `X-Api-Token`, parses JSON, and throws on `!response.ok || json?.status !== 'success'`. `listActiveSenders` maps `data.filter(alias => alias.status?.id === 1 || alias.status === 1).map(alias => alias.name)` — the exact alias shape is not in the OpenAPI excerpt read on 2026-09-26; keep the mapping in this one function so the first real connect can fix it in one place (note this in the README „Nedocumentat”).

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/test-support/fake-sms-api.mjs src/features/sms-notify/server/sms.service.mjs src/features/sms-notify/server/sms.service.test.mjs
git commit -m "feat(sms-notify): sms.md client with failure classification"
```

---

### Task 12: `domain/sms-batch.mjs` — `planSmsBatch`, `finalizeSmsText`

**Files:**
- Create: `src/features/sms-notify/domain/sms-batch.mjs`
- Test: `src/features/sms-notify/domain/sms-batch.test.mjs`
- Create: `src/features/sms-notify/index.web.mjs`

**Interfaces:**
- Consumes only `#shared/domain/phone-number.mjs`, `#shared/domain/sms-template.mjs`, `#shared/domain/sms-segments.mjs`, `#shared/format/strip-diacritics.mjs`.
- Produces:
  - `chooseSmsRecipient(child): { parentLabel: string, phone: string } | null` — parent 1's normalized phone, else parent 2's, else `null`.
  - `finalizeSmsText(text: string, stripDiacriticsEnabled: boolean): { text: string } & SmsSegmentCount` — strips (if enabled) **then** counts, so the counter shows what is paid.
  - `planSmsBatch({ rows: SmsRecipientRow[], body: string, stripDiacritics: boolean, month: string }): SmsBatchPlan` — one message per child, `excluded` with `reason: 'Fără telefon valid'`, `totalSegments`.
  - `estimateSmsCost(totalSegments: number, unitCost: number): number` — `Math.round(totalSegments * unitCost * 100) / 100`.
- `index.web.mjs` re-exports `planSmsBatch`, `finalizeSmsText`, `chooseSmsRecipient`, `estimateSmsCost` — the only path `webapp/` may import.

- [ ] **Step 1: Write the failing tests** (spec §9 „sms-batch”): recipient is parent 1; falls back to parent 2 with `parentLabel` = `parent2`; a child with neither valid phone is excluded with reason; one message per child; text rendered with variables then stripped when `stripDiacritics: true` (assert no `ă` in `text`, `encoding: 'gsm-7'`); with `stripDiacritics: false` the same text is `ucs-2`; `totalSegments` sums; `estimateSmsCost(3, 0.3)` → `0.9`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```javascript
import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { renderSmsTemplate, smsVariablesFor } from '#shared/domain/sms-template.mjs';
import { countSmsSegments } from '#shared/domain/sms-segments.mjs';
import { stripDiacritics } from '#shared/format/strip-diacritics.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsRecipientRow} SmsRecipientRow */
/** @typedef {import('../sms-notify.types.mjs').SmsBatchPlan} SmsBatchPlan */

export const NO_VALID_PHONE_REASON = 'Fără telefon valid';

// Părintele 1, cu cădere pe părintele 2 — un singur SMS per copil (RASPUNSURI 5).
/** @param {import('#shared/contracts/record-types.mjs').Child} child */
export function chooseSmsRecipient(child) {
  const candidates = [
    [child.parent, child.phone],
    [child.parent2 || '', child.phone2 || ''],
  ];
  for (const [name, rawPhone] of candidates) {
    const phone = normalizeMoldovanPhone(rawPhone);
    if (phone) return { parentLabel: name, phone };
  }
  return null;
}

// Fără diacritice se aplică ÎNAINTE de numărare: contorul arată exact ce se plătește (spec §3.4).
/** @param {string} text @param {boolean} stripDiacriticsEnabled */
export function finalizeSmsText(text, stripDiacriticsEnabled) {
  const finalText = stripDiacriticsEnabled ? stripDiacritics(text) : text;
  return { text: finalText, ...countSmsSegments(finalText) };
}

/** @param {number} totalSegments @param {number} unitCost */
export const estimateSmsCost = (totalSegments, unitCost) => Math.round(totalSegments * unitCost * 100) / 100;

/**
 * @param {{ rows: SmsRecipientRow[], body: string, stripDiacritics: boolean, month: string }} input
 * @returns {SmsBatchPlan}
 */
export function planSmsBatch({ rows, body, stripDiacritics: stripDiacriticsEnabled, month }) {
  const messages = [];
  const excluded = [];
  for (const { child, obligation } of rows) {
    const recipient = chooseSmsRecipient(child);
    if (!recipient) {
      excluded.push({ childId: child.id, childName: child.name, reason: NO_VALID_PHONE_REASON });
      continue;
    }
    const rendered = renderSmsTemplate(body, smsVariablesFor({ child, parentName: recipient.parentLabel, obligation, month }));
    messages.push({
      childId: child.id,
      childName: child.name,
      recipientName: recipient.parentLabel,
      parentLabel: recipient.parentLabel,
      phone: recipient.phone,
      ...finalizeSmsText(rendered, stripDiacriticsEnabled),
    });
  }
  return { messages, excluded, totalSegments: messages.reduce((sum, message) => sum + message.segments, 0) };
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/domain src/features/sms-notify/index.web.mjs
git commit -m "feat(sms-notify): planSmsBatch domain and web barrel"
```

---

### Task 13: `sms-send.service.mjs` — batch orchestration, test SMS, delivery refresh

**Files:**
- Create: `src/features/sms-notify/server/sms-send.service.mjs`
- Test: `src/features/sms-notify/server/sms-send.service.test.mjs`

**Interfaces:**
- Consumes: `fail`, `normalizeMoldovanPhone`, `countSmsSegments`, `SMS_TEMPLATE_MAX_LENGTH`, `estimateSmsCost` (from `../domain/sms-batch.mjs`), the two repositories, `SmsService`.
- Produces: `createSmsSendService({ smsService, smsLogRepository, smsTemplateRepository, readConfig, auditTrail, now, sleep })` →
  - `sendBatch(request: SmsSendRequest): Promise<SmsBatchResult>`
  - `sendTest(phone: string): Promise<SmsLogEntry>`
  - `refreshDeliveryStatuses(): Promise<{ updated: number, entries: SmsLogEntry[] }>`
- Constants: `SEND_PAUSE_MS = 1000`, `DELIVERY_UNKNOWN_AFTER_MS = 48 * 60 * 60 * 1000`, `TEST_MESSAGE_TEXT = 'Startica: SMS-urile functioneaza. Acesta e un mesaj de test.'` (already without diacritics → 1 GSM-7 segment), messages `NOT_CONNECTED_MESSAGE = 'Conectează întâi sms.md din Notificări.'`.

- [ ] **Step 1: Write the failing tests** (in-memory DB + `applySchema`, `createRecordingAuditTrail`, `createFakeSmsApi`, `now` fixed, `sleep` recording its calls, `readConfig = () => ({ token:'tok-1234abcd', sender:'Startica', monthlyLimit:null })`):

  1. Batch of 3 → 3 `POST /v3/messages` in order, 1 s `sleep` between them (2 sleeps), 3 log rows `sent` with `segments`/`cost`/`providerId` from the response, `ok: true`, one audit row `{ action:'trimitere sms', after:{ source:'notify', month:'2026-09', templateName:'Reamintire restanță', requested:3, sent:3, failed:0, skipped:0, cost:'0.90' } }` whose JSON contains neither a phone nor the token.
  2. Second response `SMS_RESPONSES.invalidTo` → row 2 `failed` with `providerError` starting `VALIDATION_ERROR`, row 3 `sent`, `ok: false`, `stopped: null`.
  3. Second response `insufficientBalance` → row 2 `failed`, row 3 `skipped` with `logId: null` and **no** log row, `stopped.code === 'INSUFFICIENT_BALANCE'`, only 2 network calls.
  4. Second response `rateLimited` → same shape as 3 with `stopped.code === 'RATE_LIMIT_EXCEEDED'` and no extra sleep [RASPUNSURI 10].
  5. `monthlyLimit: 2` with 1 already sent this month and a batch of 2 → rejected with status 400 and message matching `/Limita lunară de 2 SMS/`, zero network calls.
  6. Balance `'0.30'` with a batch estimated at `0.60` → 400 `/Sold sms.md insuficient/`, zero send calls; when `GET /v3/account/balance` fails (network), the batch proceeds.
  7. Invalid message (phone not normalizable / text > 800 / empty `childId`) → 400 before any call.
  8. `readConfig` returns `null` → 400 `NOT_CONNECTED_MESSAGE`.
  9. `sendTest('069123456')` → one row with `source:'test'`, `childId:null`, `recipientName:'Test'`, `status:'sent'`.
  10. `refreshDeliveryStatuses()`: a `sent` row with `providerId` → fake returns `Delivered` → `delivered`, `providerStatus:'Delivered'`, `statusCheckedAt` set; `Undelivered` → `failed` with `providerError:'Undelivered'`; `Queued` stays `sent`; a `sent` row older than 48 h becomes `unknown` and is not queried; a network failure on the first query leaves rows unchanged and returns `updated: 0`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — `sendBatch` in the order of spec §5.2 (config → validate every message → monthly limit → balance → loop). Loop body:

```javascript
for (const [index, message] of messages.entries()) {
  if (stopped) {
    results.push({ childId: message.childId, outcome: 'skipped', logId: null, segments: 0, cost: null, error: stopped.message });
    continue;
  }
  const local = countSmsSegments(message.text);
  const logId = smsLogRepository.insert({ ...message, createdAt: now().toISOString(), templateId, templateName, month, source,
    characters: local.characters, segments: local.segments, encoding: local.encoding,
    cost: null, status: 'failed', providerId: null, providerStatus: '', providerError: '', statusCheckedAt: '' });
  try {
    const data = await smsService.sendMessage({ token: config.token, from: config.sender, to: message.phone, text: message.text });
    smsLogRepository.update(logId, { status: 'sent', providerId: data.id, providerStatus: 'Queued',
      characters: data.characters, segments: data.segments, encoding: data.encoding, cost: data.cost });
    results.push({ childId: message.childId, outcome: 'sent', logId, segments: data.segments, cost: data.cost, error: '' });
  } catch (error) {
    const failure = smsService.classifySmsFailure(error);
    smsLogRepository.update(logId, { providerError: `${failure.code}: ${failure.message}` });
    results.push({ childId: message.childId, outcome: 'failed', logId, segments: 0, cost: null, error: failure.message });
    if (failure.scope === 'account') stopped = { code: failure.code, message: failure.message };
  }
  if (!stopped && index < messages.length - 1) await sleep(SEND_PAUSE_MS);
}
```

`templateName` = `smsTemplateRepository.find(templateId)?.name ?? 'Personalizat'` (snapshot; the template may be renamed later). The batch audit row is written once, after the loop, with `cost` = Σ of `data.cost` formatted to 2 decimals. `refreshDeliveryStatuses` first runs `markUnknownOlderThan(new Date(now() - 48h).toISOString())`, then queries `pendingDelivery(50)` sequentially; a `transient` failure breaks the loop silently (state stays as it was, per spec §4.4).

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/server/sms-send.service.mjs src/features/sms-notify/server/sms-send.service.test.mjs
git commit -m "feat(sms-notify): batch send with log-before-send, limit and balance guards"
```

---

## Phase 4 — Routes, composition root, startup retention, README

### Task 14: `sms.routes.mjs` + integration test

**Files:**
- Create: `src/features/sms-notify/server/sms.routes.mjs`
- Test: `src/features/sms-notify/server/sms.routes.integration.test.mjs`
- Create: `src/features/sms-notify/index.server.mjs`

**Interfaces:**
- `createSmsRoutes({ database, dataDirectory, smsService, auditTrail, now, sleep })` builds the two repositories and the send service internally (like `createTelegramRoutes` reads its own config) and returns the route list. Also returns nothing else; `expireSmsLog` is exposed separately (Task 15).
- Routes (P1 set; `GET /api/sms-log` is P3):

| Route | Body | 200 | 400 |
| --- | --- | --- | --- |
| `GET /api/sms-status` | — | `SmsStatus` | — |
| `POST /api/sms-connect` | `{ token?, sender, monthlyLimit }` — `token` may be empty **only** when already configured (keeps the stored token; lets the operator change sender/limit without re-pasting) | `{ ok, status }` | token empty and not configured; token with whitespace; sender empty or > 15; `monthlyLimit` not `null` and not an integer 1..5000; `getBalance` classified failure; sender not in `listActiveSenders` → `Expeditorul „X” nu e activ la sms.md. Expeditori activi: A, B.` |
| `POST /api/sms-disconnect` | `{}` | `{ ok, status }` | — |
| `POST /api/sms-test` | `{ phone }` | `{ ok, status, entry }` | not connected; invalid phone; classified failure |
| `POST /api/sms-send` | `SmsSendRequest` | `SmsSendResult` | see Task 13 |
| `GET /api/sms-last-notified` | — | `Record<childId, SmsLastNotified>` | — |
| `POST /api/sms-refresh-statuses` | `{}` | `{ updated, entries }` | not connected |
| `GET /api/sms-templates` | — | `{ templates: SmsTemplate[] }` | — |
| `POST /api/sms-template-save` | `SmsTemplateInput` (`stripDiacritics` missing → `true`) | `{ ok, template }` | name empty / > 60; body empty / > 800; unknown variable `{xyz}`; unknown `id` → 409 |
| `POST /api/sms-template-delete` | `{ id }` | `{ ok }` | default template → `Șablonul implicit nu se poate șterge. Alege alt implicit mai întâi.`; unknown id → 409 |

- `buildStatus()` calls `getBalance` when configured (one request; failure → `balance: null`, `lastError` unchanged). `lastError` (last account-scoped failure, cleared on the next successful send/connect), `balance` and `balanceCheckedAt` are kept **in memory** in the routes closure — they are display-only and refreshed on the next `GET /api/sms-status`; no `sms-stare.json` (the Telegram state file exists because a *second process* writes it; here there is one writer).
- Audit: `configurare sms` on connect/disconnect (`before/after: { sender, monthlyLimit }`, never the token); `șablon sms` on save/delete (`before/after: SmsTemplate | null`).

- [ ] **Step 1: Write the failing integration tests** — copy `startTelegramServer` from `telegram.routes.integration.test.mjs` into `startSmsServer(t, { fetch, auditTrail })` using `new DatabaseSync(':memory:')` + `applySchema` and a temp `dataDirectory`. Cases (spec §9 „routes”): connect with empty token → 400, zero calls, no file; 401 → 400 and no file; sender not active → 400 with the active list; success → `sms.json` written, audit without the token, `status.tokenMasked` ends with the last 4 chars and starts with `••••••••`, `status.monthlyLimit === null`; connect again with empty token and `monthlyLimit: 300` keeps the token and updates the limit; `send` unconnected → 400; `send` happy path returns `SmsSendResult` with `status.sentThisMonth === n`; `template-save` with `{necunoscut}` → 400; `template-save` without `stripDiacritics` stores `true`; `template-delete` on the default → 400; `refresh-statuses` updates a `sent` row to `delivered`; `last-notified` after a batch contains the child; `sms-test` writes a `test` row.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** with a single `callSmsOrFail(action)` helper identical in shape to `callTelegramOrFail` (the one permitted local `catch`). `index.server.mjs`:

```javascript
export { createSmsRoutes } from './server/sms.routes.mjs';
export { createSmsService, classifySmsFailure } from './server/sms.service.mjs';
export { createSmsSendService } from './server/sms-send.service.mjs';
export { createSmsLogRepository } from './server/sms-log.repository.mjs';
export { createSmsTemplateRepository } from './server/sms-template.repository.mjs';
export { readSmsConfig, writeSmsConfig, removeSmsConfig } from './server/sms-config.repository.mjs';
```

- [ ] **Step 4: Run to verify pass**, then `npm run check`.

- [ ] **Step 5: Commit**

```bash
git add src/features/sms-notify/server/sms.routes.mjs src/features/sms-notify/server/sms.routes.integration.test.mjs src/features/sms-notify/index.server.mjs
git commit -m "feat(sms-notify): /api/sms-* routes"
```

---

### Task 15: Composition root, startup retention sweep, architecture cases, README

**Files:**
- Modify: `src/app/server/create-application.mjs`
- Modify: `src/app/server/main.mjs`
- Modify: `tests/architecture/import-boundaries.test.mjs`
- Create: `src/features/sms-notify/README.md`
- Test: `src/features/sms-notify/server/sms.routes.integration.test.mjs` (one app-level case)

- [ ] **Step 1: Write the failing app-level test** — in the integration test file, add one case through `startTestApplication(t, { fetch: createFakeSmsApi().fetch })`: `GET /api/sms-status` returns `configured: false` and makes **zero** sms.md calls; `app.expireSmsLog('2026-09-27')` exists and returns `{ expired: 0 }`.

- [ ] **Step 2: Wire the feature in `create-application.mjs`**

```javascript
import { createSmsRoutes, createSmsLogRepository } from '#features/sms-notify/index.server.mjs';
import { createSmsService } from '#features/sms-notify/index.server.mjs';
```

In `routes`, after `createTelegramRoutes(...)`:

```javascript
    ...createSmsRoutes({
      database: db,
      dataDirectory: dataDir,
      smsService: createSmsService({ fetch: options.fetch ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
```

And in the returned object, next to `expireHealthNotes`:

```javascript
    expireSmsLog: createSmsLogRepository(db).expireOldEntries,
```

(`createSmsLogRepository` only prepares statements; a second instance for the sweep is cheaper than threading the routes' instance out.)

- [ ] **Step 3: Call the sweep at startup in `main.mjs`**, inside the existing `setTimeout` after the `expireHealthNotes` block, same shape:

```javascript
      try {
        app.expireSmsLog();
      } catch (e) {
        console.error('Expirare jurnal SMS: ' + /** @type {Error} */ (e).message);
      }
```

- [ ] **Step 4: Architecture cases** — in `import-boundaries.test.mjs` add to „permite dependențele din arhitectura țintă” a `sourceFile('src/features/sms-notify/domain/sms-batch.mjs', '#shared/domain/phone-number.mjs', '#shared/domain/sms-template.mjs')` and `sourceFile('src/app/server/create-application.mjs', '#features/sms-notify/index.server.mjs')`; add to the violations table `[sourceFile('src/features/sms-notify/server/sms-send.service.mjs', '#features/billing/index.server.mjs'), 'feature-imports-feature']`.

- [ ] **Step 5: README** — write `src/features/sms-notify/README.md` in the same sections as `telegram-notify/README.md` (Public API table for `index.server.mjs` and `index.web.mjs`, Dependențe, Consumatori, Structură, Decizii, Teste). Decizii must include: token in `sms.json` not settings (backups); tables in core `SCHEMA` not `records`; log-before-send; no automatic sending; monthly limit optional and global (no per-filială); 429 stops the batch; retention 365 days via `expireSmsLog` at startup; `lastError`/balance in memory; „Nedocumentat” list from spec §4.6 plus the sender-alias shape.

- [ ] **Step 6: Run** `npm run check`. Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/app/server/create-application.mjs src/app/server/main.mjs tests/architecture/import-boundaries.test.mjs src/features/sms-notify/README.md src/features/sms-notify/server/sms.routes.integration.test.mjs
git commit -m "feat(app): wire sms-notify routes and startup log retention"
```

---

## Phase 5 — `webapp/`

Before touching any screen, per `CLAUDE.md`: read `docs/design/screens/README.md`, `00-comun.md`, `14-sms.md` (4b for the templates/provider tab), `12-administrare.md` §2g (the `Canale · Mesaje SMS · Șabloane` switch), `10-de-notificat.md` and `docs/design/README.md` §„Situația plăților — notificare SMS” (dialogs 2a/2b/2c), and open `Sms.dc.html#4b`, `Situatia.dc.html#2a`/`#2b` with `npx serve docs/design`. Use only `@shared/ui` components and `tokens.css` variables; no new hex colors. Note: `10-de-notificat.md` describes a full queue/preview redesign of the screen — that redesign is **not** part of this plan; P1 adds the send buttons and dialog to the current table page only.

### Task 16: `webapp/src/shared/sms/` — types, hooks, counter, status badge

**Decision:** `webapp/src/architecture.test.ts` (Faza 2, 2026-09-26) forbids `features/notify` from importing `features/sms`. Everything the dialog needs in both P1 (`notify`) and P2 (`status`) therefore lives in `webapp/src/shared/sms/` — the webapp analogue of the backend's `#shared/domain` rule. `@shared/ui` stays purely presentational; `shared/sms` may call `requestJson`.

**Files:**
- Create: `webapp/src/shared/sms/sms-types.ts` — `SmsStatusView` (= `SmsStatus`), `SmsTemplateView`, `SmsSendRequestView`, `SmsSendResultView`, `SmsLastNotifiedView` (TS mirrors of the `.d.mts` types; import the `.d.mts` types directly where `tsc` resolves them — `import type { SmsStatus } from '#features/sms-notify/sms-notify.types.mjs'` works through the `#features/*` path alias in `webapp/tsconfig.json`; prefer that and keep `sms-types.ts` to re-exports).
- Create: `webapp/src/shared/sms/useSmsStatus.ts` (+ `.test.ts`) — `GET /api/sms-status`; `connect({ token, sender, monthlyLimit })`, `disconnect()`, `sendTest(phone)`; same shape as `useTelegramStatus`.
- Create: `webapp/src/shared/sms/useSmsTemplates.ts` (+ `.test.ts`) — `templates`, `defaultTemplate`, `save(input)`, `remove(id)`, `refresh()`.
- Create: `webapp/src/shared/sms/useSmsLastNotified.ts` (+ `.test.ts`) — `byChild: Record<string, SmsLastNotifiedView>`, `refresh()`, `notifiedToday(childId, todayStr): boolean`.
- Create: `webapp/src/shared/sms/useSmsSend.ts` (+ `.test.ts`) — `send(request): Promise<SmsSendResultView>`, `sending`, `lastResult`; after a result with any `sent`, schedules **one** `POST /api/sms-refresh-statuses` 30 s later (`setTimeout`, cleared on unmount).
- Create: `webapp/src/shared/sms/SmsSegmentCounter.tsx` (+ `.module.css`, `.test.tsx`) — props `{ text: string, unitCost: number, count?: number }` → „N caractere · N SMS · ≈ X lei”, class `ucs2` (`color: var(--pink-ink)`) when `encoding === 'ucs-2'`; uses `countSmsSegments` from `@domain/sms-segments.mjs` and `formatMoney`.
- Create: `webapp/src/shared/sms/sms-status-badge.tsx` — `smsStatusBadge(status: SmsLogStatus): { tone: BadgeTone, label: string }` = `sent → yellow „În curs”`, `delivered → mint „Livrat”`, `failed → pink „Eșuat”`, `unknown → neutral „Necunoscut”` [RASPUNSURI 7]; `SmsStatusBadge` component wrapping `Badge`.
- Create: `webapp/src/shared/sms/index.ts` re-exporting all of the above.

- [ ] **Step 1: Write the failing hook tests** with `vi.stubGlobal('fetch', ...)` exactly as `useTelegramStatus.test.ts` does: status loads and exposes `unitCost`; `connect` POSTs `{ token, sender, monthlyLimit }` then refreshes; `useSmsSend.send` POSTs `/api/sms-send` and, with fake timers, fires `/api/sms-refresh-statuses` once after 30 s only when something was sent; `useSmsLastNotified.notifiedToday` is true only for `at` on today's local date; `SmsSegmentCounter` renders „12 caractere · 1 SMS · ≈ 0,30 lei” and gets the `ucs2` class on „ă”.

- [ ] **Step 2: Run to verify failure** — `cd webapp && npm test -- shared/sms`.

- [ ] **Step 3: Implement** — follow `useTelegramStatus.ts` / `useNotificationPreferences.ts` line by line for state/refresh/cancelled patterns.

- [ ] **Step 4: Run to verify pass**; `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/shared/sms
git commit -m "feat(webapp): shared SMS hooks, segment counter and status badge"
```

---

### Task 17: `SmsConfirmDialog` (single + bulk) in `webapp/src/shared/sms/`

**Files:**
- Create: `webapp/src/shared/sms/SmsConfirmDialog.tsx`, `SmsConfirmDialog.module.css`, `SmsConfirmDialog.test.tsx`
- Modify: `webapp/src/shared/sms/index.ts`

**Interfaces:**

```typescript
export interface SmsConfirmDialogProps {
  open: boolean;
  mode: 'single' | 'bulk';
  source: 'notify' | 'status-row' | 'status-bulk';
  month: string;
  rows: SmsRecipientRow[];            // one row in 'single', all notified rows in 'bulk'
  onClose: () => void;
  onSent: (result: SmsSendResultView) => void;   // caller refreshes badges / shows toast
}
```

Behaviour (spec §6–§8, README §SMS 2a/2b/2c, RASPUNSURI 4/5/7/9/11):
- Reads `useSmsStatus`, `useSmsTemplates`, `useSmsLastNotified`, `useSmsSend`. Modal 560 px (single) / 860 px (bulk), overlay + `role="dialog"` + Esc like `ConfirmDeleteDialog`; background `var(--cream)` per README 2a (use the token, not `#fffaf0`).
- **single**: recipient card (parent label, phone, child, rest in `--pink-ink`); tabs `Reamintire restanță` (the default template) · `Personalizat` (empty textarea, placeholder „Scrie mesajul pentru părinte…”); editable textarea prefilled with `planSmsBatch(...).messages[0].text` computed with `stripDiacritics: false` (so the operator sees the raw text) — the „Fără diacritice” switch (default = template's flag) is applied at send via `finalizeSmsText`; `SmsSegmentCounter` on the finalized text; „Ultima notificare: <formatDateTime(at)> · <templateName>” from `useSmsLastNotified`; recipient without a valid phone → the dialog shows „Fără telefon valid” and a link „Corectează telefonul” (`/copii/:id`, via `useNavigate`), send disabled. Button „Trimite SMS (≈ X lei)”, disabled while text is empty or `!status.configured`.
- **bulk**: template = default (only one in P1) or `Personalizat`; `planSmsBatch` per recipient; list with checkboxes (a child `notifiedToday` is **unchecked by default**, re-checkable); excluded rows listed with reason; preview „k din N” with prev/next; button „Trimite N SMS (≈ X lei)” disabled when zero checked.
- Guards from spec §7 that live here: balance line „Sold sms.md: X lei” (yellow warning when `balance < 20 × unitCost`), monthly-limit note when `monthlyLimit !== null` and `sentThisMonth + N > monthlyLimit` (button disabled with the reason).
- Result state after `send`: „N trimise · M eșuate · K netrimise”, per-row errors, `stopped.message` in red, and „Reîncearcă” (resends only rows whose outcome was `failed`/`skipped`, same `source`) [RASPUNSURI 11]; „Închide” calls `onSent(result)` then `onClose()`.

- [ ] **Step 1: Write the failing RTL tests** (spec §9 „webapp”): counter turns red on UCS-2; „Trimite” disabled on empty text and on zero checked; a child notified today is unchecked by default; partial result shows „2 trimise · 1 eșuate · 1 netrimise” and „Reîncearcă” POSTs only the 2 failed/skipped `childId`s; without a valid phone the dialog shows „Corectează telefonul”; POST body has `source`, `month`, `templateId` and each message's `phone` in E.164.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Keep all text math in `planSmsBatch` / `finalizeSmsText` (imported from `#features/sms-notify/index.web.mjs`); the component only holds UI state.

- [ ] **Step 4: Run to verify pass**; `npm run typecheck && npm test`.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/shared/sms
git commit -m "feat(webapp): SMS confirmation dialog (single and bulk)"
```

---

### Task 18: „Notificări” — tab switch, card „Furnizor SMS”, tab „Șabloane”

**Files:**
- Modify: `webapp/src/features/notifications/NotificationsPage.tsx`, `NotificationsPage.module.css`, `NotificationsPage.test.tsx`
- Create: `webapp/src/features/notifications/SmsProviderCard.tsx` (+ `.module.css`, `.test.tsx`)
- Create: `webapp/src/features/notifications/SmsTemplatesPanel.tsx` (+ `.module.css`, `.test.tsx`)

**Interfaces / behaviour** (`14-sms.md` 4b, `12-administrare.md` 2g, spec §8):
- `NotificationsPage`: `SegmentedControl` with options `canale` („Canale”) and `sabloane` („Șabloane”), value in `usePersistedState('notifications.tab', 'canale')`. „Canale” = today's `TelegramSection` + `PreferencesSection`, unchanged. The third option „Mesaje SMS” is **P3** — do not add it now (a tab that mounts nothing is an element not in scope).
- `SmsTemplatesPanel` (grid `320px 1fr`): left = template list (row `Implicit` badge mint; `+ Șablon nou`) + `SmsProviderCard`; right = editor: `Nume`, textarea `Text` with variable pills (`părinte copil luna taxa rest achitat zi`, inserted at cursor as `{copil}`), switches „Fără diacritice la trimitere” (default **on** for a new template [RASPUNSURI 3]) and „Implicit pentru Notifică”, preview rendered with the first notified child of the current month (`evaluateChildrenForMonth(state, today().slice(0,7))` filtered by `obligation.notify`, else sample data `{ părinte:'Maria', copil:'Ion', … }`), `SmsSegmentCounter` on the finalized preview, yellow warning when the preview exceeds 2 segments; footer `Renunță` · `Salvează șablonul`; „Șterge șablonul” (red text) → `ConfirmDeleteDialog`, hidden for the default template (14-sms.md acceptance criterion). „Folosit de N ori” needs the log stats — **P3**; omit.
- `SmsProviderCard`: „Serviciu: sms.md” (fixed text, no select — only one provider exists), `Expeditor` (maxLength 15, help text: „numele aprobat în dashboard-ul sms.md”), `Cheie API` (`type="password"`, shown only when not configured or after „Schimbă”; help text lists the 4 scopes), `Limită lunară` = checkbox „Activează limita lunară” + number input 1..5000 shown only when checked (unchecked → `monthlyLimit: null`) [RASPUNSURI 6]; counter line „N trimise luna aceasta · M segmente” always visible, plus the 8 px bar with „N / limită” only when a limit is set (`--orange` from 80 %, `--pink-ink` at 100 %); badge `Conectat` (mint) / `Neconectat` (neutral); „Sold sms.md: X lei” or „—”; buttons `Conectează`/`Salvează`, `Trimite SMS de test` (prompts for a phone in a small inline field, confirms „costă 1 SMS (≈ 0,30 lei)”), `Deconectează`; `lastError` in red.

- [ ] **Step 1: Write the failing tests** — `NotificationsPage.test.tsx`: stub `/api/telegram-status`, `/api/notification-settings`, `/api/sms-status`, `/api/sms-templates`, `/api/session`, `/api/state`; switching to „Șabloane” shows „Reamintire restanță” and the provider card; the API key field is absent when `configured: true` (only `tokenMasked` text is shown) and appears after „Schimbă”; the default template has no „Șterge șablonul”; a new template starts with „Fără diacritice la trimitere” checked; saving POSTs `/api/sms-template-save` with `stripDiacritics` and `isDefault`; enabling the limit and saving POSTs `monthlyLimit: 500`, disabling posts `null`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**, reusing the CSS patterns already in `NotificationsPage.module.css` (`.panel`, `.field`, `.btnPrimary`, `.btnGhost`).

- [ ] **Step 4: Run to verify pass**; `npm run typecheck && npm test`; compare against `Sms.dc.html#4b` at 1440 px.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/features/notifications
git commit -m "feat(notifications): SMS provider card and templates tab"
```

---

### Task 19: „De notificat” — „Trimite SMS” per row, „Trimite tuturor”, „Notificat azi”

**Files:**
- Modify: `webapp/src/features/notify/useNotify.ts` (+ `.test.ts`), `NotifyPage.tsx`, `NotifyPage.module.css`, `NotifyPage.test.tsx`

**Interfaces / behaviour:**
- `useNotify` additionally returns `recipients: SmsRecipientRow[]` (the same `notified` evaluations, same order as `rows`, as `{ child, obligation }`) so the page can hand the dialog either one row or all of them.
- `NotifyPage`: `useSmsStatus` + `useSmsLastNotified`. Header toolbar gains a **primary** „Trimite tuturor · N” (N = rows with a valid recipient, from `planSmsBatch(...).messages.length`) opening the dialog in `bulk` mode; „Copiază toate mesajele” and „Tipărește lista” stay as ghost buttons. Each row's „Mesaj” cell: primary-small „Trimite SMS” (opens `single` mode for that row) + ghost „Copiază” [RASPUNSURI 9]; a `SmsStatusBadge`-toned badge „Notificat azi” when `notifiedToday(child.id)`. When `!status.configured`, both send buttons are disabled with `title="Conectează sms.md în Notificări"`. `onSent` → toast „SMS trimis către <părinte>” / „N SMS trimise” (README §SMS) and `lastNotified.refresh()`.

- [ ] **Step 1: Write the failing tests** — `useNotify.test.ts`: `recipients` has one entry per notified row with `child.id` matching `rows[i].id`. `NotifyPage.test.tsx` (add `/api/sms-status`, `/api/sms-templates`, `/api/sms-last-notified` stubs): „Trimite SMS” opens a dialog containing the child's name and „Trimite SMS (≈”; a successful send shows the toast and the row gets „Notificat azi”; with `configured: false` the buttons are disabled; „Copiază” still copies (existing test stays green); „Trimite tuturor · 1” is present.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Import only from `@shared/sms`, `@shared/ui`, `#features/sms-notify/index.web.mjs`, `@domain/*`.

- [ ] **Step 4: Run to verify pass**; `npm run typecheck && npm test` — `architecture.test.ts` must stay green (no `@features/` import in `notify/` or `notifications/` beyond their own folder).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/features/notify
git commit -m "feat(notify): send SMS from De notificat with confirmation"
```

---

## Phase 6 — Verification

### Task 20: Automated gates

- [ ] **Step 1:** `npm run check` at the repo root (prettier, `tsc`, full `node --test`). Expected: green.
- [ ] **Step 2:** `cd webapp && npm run typecheck && npm test`. Expected: green, including `architecture.test.ts`.
- [ ] **Step 3:** `npm run test:e2e` (browser smoke + desktop lifecycle) — the server now creates two more tables at start; the smoke must still pass on a fresh home.
- [ ] **Step 4:** Tick the acceptance criteria in `docs/design/screens/14-sms.md` that P1 covers: „Contorul de segmente e corect pentru GSM-7 și UCS-2 (există test)” (Task 2), „Cheia API nu ajunge niciodată în frontend” (Task 14 + 18), „Șablonul implicit nu are „Șterge”” (Task 18). Report anything left unticked.

### Task 21: Manual verification with a real sms.md account (not automated — it costs money)

Blocked on [RASPUNSURI 1–2] (account opened, sender approved). Until then the whole feature is usable up to the „Conectează” step and fully tested against `fake-sms-api`.

- [ ] **Step 1:** Start the app on a throwaway port (`STARTICA_NO_BROWSER=1 STARTICA_PORT=<port> node --disable-warning=ExperimentalWarning startica_server.mjs`), open „Notificări › Șabloane”, paste the token, enter the approved sender, „Conectează” → badge „Conectat”, balance shown; verify `Startica_Date\sms.json` exists and `Istoric` has a „configurare sms” row without the token.
- [ ] **Step 2:** „Trimite SMS de test” to the operator's phone → SMS received, `Istoric` unchanged (test rows are only in `sms_log`).
- [ ] **Step 3:** „De notificat” → „Trimite SMS” on one row: the counter's `segments` equals the `segments` sms.md returns (check the `sms_log` row) for a text with and without „Fără diacritice”. Then „Trimite tuturor” on 2 rows; after ~30 s reload the page — the badge tone follows the delivery status; if a `429` appears, confirm the batch stopped cleanly with the rest `skipped` and „Reîncearcă” works.
- [ ] **Step 4:** Confirm the sender-alias mapping in `listActiveSenders` matched the real response (Task 11 note); fix in that one function if not.
- [ ] **Step 5:** Stop the throwaway server. Fix anything found as small follow-up commits referencing the step.

---

## Out of scope — to be planned separately

- **P2** — dialogs 2a/2b in „Situația plăților” („Notifică” per row, „Notifică toți”, `source: 'status-row' | 'status-bulk'`, badge „Notificat azi” on that table). Prerequisite: the full Situația plăților screen (queue point 10). The dialog and hooks from Tasks 16–17 are already in `@shared/sms` for it.
- **P3** — the „Mesaje SMS” tab (4a): `GET /api/sms-log?after=`, filters, detail panel, „Retrimite” (`source: 'resend'`), „Corectează telefonul”, refresh on tab open, „Folosit de N ori” in the template editor.
- DLR webhook (rejected by the spec for a local app), automatic sending, a second seeded template, per-filială counters, sms.md `estimate`/`bulk` endpoints.

## Self-review notes (from writing this plan)

- **Spec coverage:** every P1 item of spec §10.12 has a task; §3 (data model), §4 (API + classification + delivery status), §5 (structure, config, routes), §6 (manual trigger), §7 (cost guards 1–8), §8 (UI) are each implemented exactly once. Guards live where the spec puts them: limit/balance server-side (Task 13), visual guards in the dialog (Task 17).
- **Deviations, all sourced:** `monthlyLimit: number | null` default `null` [RASPUNSURI 6] instead of the spec's `1..5000, implicit 500`; 429 stops the batch with no `Retry-After` wait [RASPUNSURI 10]; `SmsStatus.unitCost` added so the browser can estimate cost (spec §4.6 says the estimate uses the last `cost/segments` from the log, which only the server can read); `POST /api/sms-connect` accepts an empty `token` when already configured (otherwise sender/limit can't be changed without re-pasting — the spec's single „Furnizor” form implies this); `webapp/src/shared/sms/` instead of `webapp/src/features/sms/` (spec §8 asked to confirm with the webapp guard, which now forbids the sketched import); `lastError`/balance in memory rather than a state file; `composeFakeFetch` not needed because the routes integration test builds its own dispatcher like the Telegram one; `GET /api/sms-log` deferred to P3 with its only consumer.
- **Type consistency:** `SmsStatus`, `SmsSendRequest`, `SmsSendResult`, `SmsLogEntry`, `SmsTemplate`, `SmsRecipientRow`, `SmsBatchPlan` are defined once in Task 6 and reused by name in Tasks 9, 12–14, 16–19.
- **Dependency order:** Phase 1 has no dependencies; Task 6's two `import()` types point at Tasks 8–9 (handled by the comment-then-restore note); Task 13 needs Tasks 8–12; Task 14 needs 13; Task 15 needs 14; Task 17 needs 16 and Task 12's `index.web.mjs`; Tasks 18–19 need 16–17. Nothing depends on a later task.
