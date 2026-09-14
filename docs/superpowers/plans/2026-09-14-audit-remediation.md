# Remedierea auditului de cod Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediază constatările auditului din 14 septembrie 2026, în ordinea severității, fără să schimbe comportamentul aplicației.

**Architecture:** Aplicația e deja feature-driven (`src/app`, `src/core`, `src/shared`, `src/features/<feature>/{domain,server,web}`). Remedierile nu mută granițe: repară un script rupt, corectează documentația, unifică trei duplicări în `src/shared`, curăță exporturile moarte, mută testele rămase la rădăcină lângă modulele lor și împarte `src/app/web/main.mjs`.

**Tech Stack:** Node 22.17 (ESM `.mjs`, `node:sqlite`, `node:test`), browser fără build, JSDoc + `*.d.mts` verificate cu `tsc`, Prettier.

**Spec:** `docs/superpowers/specs/2026-09-14-code-audit.md` (ID-urile constatărilor din spec apar în fiecare task).

## Global Constraints

- Comportament neschimbat: aceleași mesaje, statusuri HTTP, markup, id-uri DOM și corpuri de cerere. Singura excepție acceptată e notată explicit în Task 3.
- Fără dependențe noi; `package.json` rămâne cu `@types/node`, `prettier`, `typescript`.
- Importuri: aliasuri `#app/`, `#config/`, `#core/`, `#shared/`, `#features/`, `#test-support/`, cu extensia `.mjs`; relativ doar în aceeași zonă, maxim un `../`; niciun feature nu importă alt feature; `app` importă feature-uri doar prin `index.*.mjs` (verificat de `tests/architecture/import-boundaries.test.mjs`).
- Tipuri: `tsconfig` strict cu `noImplicitAny: false`, lib `es2024` + `dom` fără `dom.iterable` (`Array.from(nodeList)`); tipurile din `*.d.mts` se importă cu extensia `.mjs`; `*.integration.test.mjs` sunt excluse din `tsc`.
- Comentarii în română, doar DE CE neevident, 1–2 linii; fără istorie de migrare („fost”, „portat din”, „Înlocuiește …”, „Port 1:1”).
- Nume explicite; fără `r`, `s`, `o`, `b`, `p`, `c`, `item`, `data` în afara lambda-urilor de o linie.
- Poarta fiecărui task: `npm run check` verde (Prettier, `tsc`, `node --test`); pentru task-urile care ating browserul sau pornirea: `node tests/browser-smoke.mjs` rulat singur (în paralel cu alte teste Chrome închide cu 1006) și `powershell -NoProfile -ExecutionPolicy Bypass -File tests/desktop-lifecycle.ps1`.
- Baseline înainte de Task 1: `npm run check` = 211 teste, 210 trec, 1 sărit (CSV real lipsă), 0 eșuate.
- Commit-uri Conventional Commits, la imperativ, scurte, fără referințe la AI sau agenți, fără trailer `Co-Authored-By`. Un task = un commit.
- Nu se schimbă (decizii din spec): O1 (`payment-assignment.api.mjs`), U5 (comparatorul `localeCompare`), E4 (`health()`).

---

### Task 1: Repară scriptul de import istoric V5 (X1, critic)

**Files:**
- Modify: `scripts/import-v5-history.mjs:13-16,36,43,60,103`
- Create: `tests/import-v5-history-script.test.mjs`

**Interfaces:**
- Consumes: `readWorkbook(workbook, XLSX, findRecordIssues)` din `#features/data-transfer/domain/excel-workbook.mjs`; `planFinancialHistoryImport(input, currentRecords)` din `#features/data-transfer/server/financial-history-import.mjs`; `findRecordIssues(records)` din `#features/review-center/index.server.mjs`; `createApplication(options)` din `#app/server/create-application.mjs`; `emptyState()` din `#shared/domain/record-schema.mjs`; `total(rows)` din `#shared/domain/money.mjs`.
- Produces: scriptul se încarcă din nou; niciun export.

- [ ] **Step 1: Scrie testul care încarcă scriptul**

`tests/import-v5-history-script.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../scripts/import-v5-history.mjs', import.meta.url));

// Importurile statice se rezolvă înaintea verificării fișierului sursă: un modul șters apare aici, nu la client.
test('scriptul de import V5 își încarcă modulele și cere un fișier sursă existent', () => {
  const result = spawnSync(process.execPath, [scriptPath, 'fisier-care-nu-exista.xlsx'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  assert.match(result.stderr, /Fișierul sursă lipsește/);
});
```

- [ ] **Step 2: Rulează testul și verifică faptul că pică**

Run: `node --test tests/import-v5-history-script.test.mjs`
Expected: FAIL — `stderr` conține `ERR_MODULE_NOT_FOUND` pentru `shared/excel.mjs`.

- [ ] **Step 3: Înlocuiește importurile rupte**

În `scripts/import-v5-history.mjs`, liniile 13–16:

```js
import { readWorkbook } from '#features/data-transfer/domain/excel-workbook.mjs';
import { planFinancialHistoryImport } from '#features/data-transfer/server/financial-history-import.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';
import { createApplication } from '#app/server/create-application.mjs';
import { emptyState } from '#shared/domain/record-schema.mjs';
import { total } from '#shared/domain/money.mjs';
```

- [ ] **Step 4: Adaptează apelurile la noile semnături**

Linia 36:

```js
const report = readWorkbook(XLSX.read(bytes, { type: 'buffer' }), XLSX, findRecordIssues);
```

Liniile 41–45 (raportul de import conține acum și grupele și categoriile; valorile sunt cele din `src/features/data-transfer/domain/excel-workbook.test.mjs`, testul „V5 original”):

```js
  assert.deepEqual(
    report.summary,
    {
      children: 105,
      payments: 810,
      expenses: 1201,
      groups: 10,
      categories: 0,
      paymentTotal: 10105096,
      expenseTotal: 1564059,
    },
    'V5 diferă de fișierul analizat; este necesară o nouă verificare.',
  );
```

Liniile 60 și 103: înlocuiește `financialImportPlan(` cu `planFinancialHistoryImport(`.

- [ ] **Step 5: Rulează testul și verifică faptul că trece**

Run: `node --test tests/import-v5-history-script.test.mjs`
Expected: PASS (1 test).

Verificare suplimentară, doar dacă `../Fisiere_Excel/Evidenta_Achitari_corectata v5.xlsx` există: `node scripts/import-v5-history.mjs` afișează JSON cu `"phase": "preview"` (fără `--apply`, deci fără scrieri).

- [ ] **Step 6: Poarta**

Run: `npm run check`
Expected: 212 teste, 211 trec, 1 sărit, 0 eșuate.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-v5-history.mjs tests/import-v5-history-script.test.mjs
git commit -m "fix(data-transfer): repair V5 history import script after module moves"
```

---

### Task 2: Corectează documentația falsă și scoate istoria migrării din comentarii (C1–C6)

**Files:**
- Modify: `src/features/record-editing/server/record-editing.routes.integration.test.mjs:9-12`
- Modify: `src/features/record-editing/README.md`, `src/features/expenses/README.md`, `src/features/payment-assignment/README.md`, `src/features/fee-setup/README.md`, `src/features/payments/README.md`, `src/features/groups/README.md`, `src/features/review-center/README.md`, `src/features/billing/README.md`, `src/features/dashboard/README.md`, `src/features/children/README.md`
- Modify (comentarii): `src/features/record-editing/web/record-editor-dialog.mjs:8-10`, `src/features/record-editing/record-editing.types.d.mts:47-52`, `src/features/payments/web/payment-editor-fields.mjs:10-12`, `src/features/payments/web/allocation-rows.mjs:5-6`, `src/features/payments/web/payments-list.view.mjs:38-43`, `src/features/children/web/child-editor-fields.mjs:6-8`, `src/features/children/web/children-list.view.mjs:37-41`, `src/features/expenses/web/expense-editor-fields.mjs:5-8`, `src/features/expenses/web/expenses-list.view.mjs:26-30`, `src/features/billing/web/notify-list.view.mjs:36-38`, `src/features/billing/web/payment-status.view.mjs:30-32`, `src/features/dashboard/domain/cash-summary.mjs:7`, `src/features/dashboard/web/children-summary.view.mjs:5-7`, `src/features/dashboard/web/dashboard.view.mjs:54-56`, `src/features/data-transfer/web/excel-transfer.controller.mjs:32`, `src/features/data-transfer/server/financial-history-import.mjs:84`, `src/features/backup/server/backup.routes.mjs:12`, `src/features/backup/server/backup.service.mjs:103`, `src/shared/ui/form-fields.mjs:3-4`, `src/shared/ui/child-picker.mjs:1-4`

**Interfaces:**
- Consumes: nimic.
- Produces: nimic executabil; doar text.

- [ ] **Step 1: Verifică tiparele interzise înainte de modificare**

Run:

```bash
grep -rnE "Port 1:1|Înlocuiește \`|portat din|fostul |\(fost |Fost \`|ca la legacy|\) legacy|înainte de migrare|web/ui/|web/app\.js|server/routes\.mjs|Până la (pasul|rewire)|Nu are încă \`index" src --include=*.mjs --include=*.md --include=*.d.mts
```

Expected: ~45 de linii (lista de lucru pentru pașii 2–4).

- [ ] **Step 2: Rescrie comentariul fals din testul record-editing**

În `src/features/record-editing/server/record-editing.routes.integration.test.mjs`, liniile 9–12 devin:

```js
// Testele lovesc rutele HTTP, nu funcția: acoperă și înregistrarea lor în createApplication.
```

- [ ] **Step 3: Scoate istoria din comentariile de cod**

Pentru fiecare fișier din lista „Modify (comentarii)”:
- șterge propozițiile care conțin „Port 1:1 …”, „Înlocuiește `…` din …”, „Fost `…`”, „ca la legacy”, „la fel ca înainte de migrare”, „legacy”;
- păstrează restul comentariului doar dacă spune un DE CE neevident (ex. în `payment-editor-fields.mjs` rămâne „Implementează structural RecordEditorFields, fără să importe record-editing, ca feature-urile să rămână izolate.”);
- un JSDoc care rămâne doar cu `@param` își păstrează tag-urile.

Formulări țintă pentru cele care păstrează un DE CE:

```js
// src/features/data-transfer/web/excel-transfer.controller.mjs:32
// Previzualizarea locală și cea revalidată de server au forme diferite; se afișează ce a venit ultima.

// src/features/backup/server/backup.routes.mjs:12
// [] dacă snapshot-ul e o stare validă, altfel primul mesaj de eroare al validării.

// src/features/backup/server/backup.service.mjs:103
// sha256Hex() e tipat pentru text, dar hash-uiește corect și conținutul binar al bazei.

// src/features/data-transfer/server/financial-history-import.mjs:84 (păstrează începutul propoziției, taie finalul)
// … verificată de normalizeRecord() mai jos.

// src/shared/ui/form-fields.mjs:3-4
// Markup comun pentru dialogul de editare generic și câmpurile fiecărui tip de înregistrare.

// src/shared/ui/child-picker.mjs:1-4
// Combobox căutabil (fără diacritice) pentru alegerea unui copil, în locul unui <select> lung.
```

- [ ] **Step 4: Corectează README-urile**

`src/features/record-editing/README.md`:
- șterge afirmația „Nu are încă `index.server.mjs`/`index.web.mjs`” și pune în secțiunea Public API:

```markdown
### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditingRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/record`, `POST /api/record-delete` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditorDialog(dependencies)` | întoarce `{ openEditor, archiveRecord, deleteRecord, confirmReview }` |
```

- înlocuiește secțiunea „Ce trebuie să compună `web/app.js` la integrare” cu:

```markdown
## Compunere

`src/app/server/create-application.mjs` înregistrează rutele. `src/app/web/main.mjs` creează dialogul cu `fieldsByType: { children: childEditorFields, payments: paymentEditorFields, expenses: expenseEditorFields }` și `readExpenseCategoryNames`, iar handler-ul global de click apelează `openEditor`, `archiveRecord`, `deleteRecord` și `confirmReview`.
```

`src/features/expenses/README.md`: șterge fraza despre mutarea „la pasul următor” și pune tabelul:

```markdown
### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesRoutes(dependencies)` | `POST /api/category-delete` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesController(dependencies)` | chips-urile de categorii și filtrul de categorie; `{ render }` |
| `createExpensesListView(dependencies)` | lista „Cheltuieli”; `{ render }` |
| `expenseEditorFields` | câmpurile cheltuielii în dialogul generic |
| `listExpenseCategoryNames(records)` | sugestiile de categorie (implicite, salvate, folosite) |
```

`src/features/payment-assignment/README.md:73`, `src/features/fee-setup/README.md:51`, `src/features/payments/README.md:5`: orice mențiune a compunerii în `web/app.js` sau `server/routes.mjs` devine „`src/app/web/main.mjs`” respectiv „`src/app/server/create-application.mjs`”; frazele „Până la pasul 10 …” / „Până la rewire …” se șterg.

README-urile `groups`, `review-center`, `payment-assignment`, `billing`, `dashboard`, `children`: șterge adnotările „(fost …)”, „portat din …”, „mutat din …”, „din tests/…test.mjs” și referințele la fișiere șterse din `web/ui/`, `server/`, `shared/`; structura de fișiere rămâne.

- [ ] **Step 5: Verifică faptul că tiparele au dispărut**

Run: comanda din Step 1.
Expected: nicio linie.

- [ ] **Step 6: Poarta**

Run: `npm run check`
Expected: 212 teste, 211 trec, 1 sărit.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "docs(app): correct stale feature docs and drop migration history from comments"
```

---

### Task 3: Unifică confirmarea în doi pași (U1)

**Files:**
- Create: `src/shared/ui/confirm-twice-button.mjs`
- Create: `src/shared/ui/confirm-twice-button.test.mjs`
- Modify: `src/shared/ui/bulk-selection.mjs:1-3,72-101,129-165`
- Modify: `src/app/web/main.mjs` (handler-ul global de click, ramura `action === 'archive'`)

**Interfaces:**
- Produces: `CONFIRMATION_WINDOW_MS = 4000`; `confirmOnSecondClick(button: HTMLElement, pendingText: string): boolean` (true = apăsarea confirmă); `cancelPendingConfirmation(button: HTMLElement): void`.

Schimbare de comportament acceptată: după confirmarea arhivării unui rând, clasa `confirm-pending` se scoate imediat (înainte rămânea). Dacă arhivarea eșuează, următorul click cere din nou confirmare, ca la butonul de arhivare în masă.

- [ ] **Step 1: Scrie testele**

`src/shared/ui/confirm-twice-button.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRMATION_WINDOW_MS, cancelPendingConfirmation, confirmOnSecondClick } from './confirm-twice-button.mjs';

/** @param {string} text */
function createFakeButton(text) {
  const classes = new Set();
  return /** @type {any} */ ({
    textContent: text,
    dataset: {},
    classList: {
      contains: name => classes.has(name),
      add: name => void classes.add(name),
      remove: name => void classes.delete(name),
    },
  });
}

test('primul click cere confirmarea, al doilea o confirmă', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează');

  assert.equal(confirmOnSecondClick(button, 'Sigur?'), false);
  assert.equal(button.textContent, 'Sigur?');
  assert.equal(button.classList.contains('confirm-pending'), true);

  assert.equal(confirmOnSecondClick(button, 'Sigur?'), true);
  assert.equal(button.classList.contains('confirm-pending'), false);
});

test('fără al doilea click în fereastră, butonul revine la textul inițial', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează');

  confirmOnSecondClick(button, 'Sigur?');
  t.mock.timers.tick(CONFIRMATION_WINDOW_MS);

  assert.equal(button.textContent, 'Arhivează');
  assert.equal(confirmOnSecondClick(button, 'Sigur?'), false);
});

test('anularea oprește confirmarea în așteptare', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează selectate (2)');

  confirmOnSecondClick(button, 'Sigur? Arhivează selectate (2)');
  cancelPendingConfirmation(button);
  t.mock.timers.tick(CONFIRMATION_WINDOW_MS);

  assert.equal(button.classList.contains('confirm-pending'), false);
  assert.equal(button.textContent, 'Sigur? Arhivează selectate (2)');
});
```

- [ ] **Step 2: Rulează testele și verifică faptul că pică**

Run: `node --test src/shared/ui/confirm-twice-button.test.mjs`
Expected: FAIL — `Cannot find module …/confirm-twice-button.mjs`.

- [ ] **Step 3: Implementează helper-ul**

`src/shared/ui/confirm-twice-button.mjs`:

```js
export const CONFIRMATION_WINDOW_MS = 4000;

/** @type {WeakMap<HTMLElement, ReturnType<typeof setTimeout>>} */
const pendingTimers = new WeakMap();

// Fără fereastră de confirmare: primul click cere confirmarea chiar pe buton, al doilea, în 4 secunde, execută.
/**
 * @param {HTMLElement} button
 * @param {string} pendingText
 * @returns {boolean} true când apăsarea confirmă acțiunea
 */
export function confirmOnSecondClick(button, pendingText) {
  if (button.classList.contains('confirm-pending')) {
    cancelPendingConfirmation(button);
    return true;
  }
  button.classList.add('confirm-pending');
  button.dataset.label = button.textContent ?? '';
  button.textContent = pendingText;
  pendingTimers.set(
    button,
    setTimeout(() => {
      pendingTimers.delete(button);
      button.classList.remove('confirm-pending');
      button.textContent = button.dataset.label ?? '';
    }, CONFIRMATION_WINDOW_MS),
  );
  return false;
}

/** @param {HTMLElement} button */
export function cancelPendingConfirmation(button) {
  clearTimeout(pendingTimers.get(button));
  pendingTimers.delete(button);
  button.classList.remove('confirm-pending');
}
```

- [ ] **Step 4: Rulează testele și verifică faptul că trec**

Run: `node --test src/shared/ui/confirm-twice-button.test.mjs`
Expected: PASS (3 teste).

- [ ] **Step 5: Folosește helper-ul în `bulk-selection.mjs`**

- import: `import { cancelPendingConfirmation, confirmOnSecondClick } from './confirm-twice-button.mjs';`
- în semnătura `createBulkSelectionController`, `bulkButton: bulkButtonElement` redevine `bulkButton`; șterge liniile 82–86 (comentariul despre `_confirmTimer` și castul `bulkButton`).
- în `updateBulkActionButton()`, liniile `clearTimeout(bulkButton._confirmTimer);` și `bulkButton.classList.remove('confirm-pending');` devin `cancelPendingConfirmation(bulkButton);`.
- în `bindBulkActionButton()`, comentariul de deasupra rămâne doar cu primele două linii (butonul e static, legat o dată); corpul `onclick` începe cu:

```js
    bulkButton.onclick = async () => {
      if (!confirmOnSecondClick(bulkButton, `Sigur? ${bulkButton.textContent}`)) return;
      bulkButton.disabled = true;
```

urmat de restul neschimbat (de la `const ids = [...selectedIds];`); se șterg ramura `if (!bulkButton.classList.contains('confirm-pending')) { … return; }`, `clearTimeout(bulkButton._confirmTimer);` și `bulkButton.classList.remove('confirm-pending');`.

- [ ] **Step 6: Folosește helper-ul în `src/app/web/main.mjs`**

- import: `import { confirmOnSecondClick } from '#shared/ui/confirm-twice-button.mjs';`
- castul butonului din handler-ul de click devine `/** @type {HTMLButtonElement | null} */`;
- ramura de arhivare devine:

```js
    if (action === 'archive' && confirmOnSecondClick(button, 'Sigur?')) await recordEditor.archiveRecord(type, id);
```

- [ ] **Step 7: Poarta + verificarea în browser**

Run: `npm run check`
Expected: 215 teste, 214 trec, 1 sărit.

Run (singur): `node tests/browser-smoke.mjs`
Expected: `PASS: …`

- [ ] **Step 8: Commit**

```bash
git add src/shared/ui/confirm-twice-button.mjs src/shared/ui/confirm-twice-button.test.mjs src/shared/ui/bulk-selection.mjs src/app/web/main.mjs
git commit -m "refactor(shared): share the confirm-on-second-click button behavior"
```

---

### Task 4: Mută `section()` în `form-fields` (U2)

**Files:**
- Modify: `src/shared/ui/form-fields.mjs`
- Create: `src/shared/ui/form-fields.test.mjs`
- Modify: `src/features/children/web/child-editor-fields.mjs:4,10-13` și apelurile `section(`
- Modify: `src/features/payments/web/payment-editor-fields.mjs:6,14-17` și apelurile `section(`

**Interfaces:**
- Produces: `formSectionMarkup(title: string, html: string): string` în `#shared/ui/form-fields.mjs`.

- [ ] **Step 1: Scrie testul**

`src/shared/ui/form-fields.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formSectionMarkup } from './form-fields.mjs';

test('formSectionMarkup escapează titlul și păstrează conținutul', () => {
  assert.equal(
    formSectionMarkup('Părinți & contacte', '<input name="parent">'),
    '<fieldset class="form-section"><legend>Părinți &amp; contacte</legend><div class="form-section-grid"><input name="parent"></div></fieldset>',
  );
});
```

- [ ] **Step 2: Rulează testul și verifică faptul că pică**

Run: `node --test src/shared/ui/form-fields.test.mjs`
Expected: FAIL — `formSectionMarkup` nu e exportat.

- [ ] **Step 3: Adaugă funcția**

La finalul `src/shared/ui/form-fields.mjs`:

```js
export const formSectionMarkup = (title, html) =>
  `<fieldset class="form-section"><legend>${escapeHtml(title)}</legend><div class="form-section-grid">${html}</div></fieldset>`;
```

- [ ] **Step 4: Rulează testul și verifică faptul că trece**

Run: `node --test src/shared/ui/form-fields.test.mjs`
Expected: PASS.

- [ ] **Step 5: Înlocuiește copiile**

În `child-editor-fields.mjs` și `payment-editor-fields.mjs`:
- șterge comentariul „Fieldset-ul e identic …” și constanta `section`;
- adaugă `formSectionMarkup` la importul din `#shared/ui/form-fields.mjs`;
- înlocuiește toate apelurile `section(` cu `formSectionMarkup(`;
- dacă `escapeHtml` nu mai e folosit în fișier, șterge-l din importuri (`grep -n escapeHtml <fișier>`).

- [ ] **Step 6: Poarta + browser**

Run: `npm run check`, apoi singur `node tests/browser-smoke.mjs` (acoperă formularele copilului și achitării).
Expected: 216 teste, 215 trec, 1 sărit; `PASS: …`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/form-fields.mjs src/shared/ui/form-fields.test.mjs src/features/children/web/child-editor-fields.mjs src/features/payments/web/payment-editor-fields.mjs
git commit -m "refactor(shared): share the form section fieldset markup"
```

---

### Task 5: Un singur loc pentru tipurile importului CSV de copii (U3, S3)

**Files:**
- Create: `src/features/children/children.types.d.mts`
- Modify: `src/features/children/server/children-csv-import.mjs:4-15`
- Modify: `src/features/children/web/children-csv-dialog.mjs:5-29`
- Modify: `src/features/children/README.md` (structura: adaugă `children.types.d.mts`)

**Interfaces:**
- Produces: `ChildrenCsvPreviewRow`, `ChildrenCsvPreviewReport` (cu `revision?: number`).

- [ ] **Step 1: Creează fișierul de tipuri**

`src/features/children/children.types.d.mts`:

```ts
import type { Child } from '#shared/contracts/record-types.mjs';

export interface ChildrenCsvPreviewRow {
  line: number;
  id: string;
  name: string;
  contractNumber: string;
  parent: string;
  phone: string;
  parent2: string;
  phone2: string;
  birthDate: string;
  attendanceDate: string;
  action: string;
  reason: string;
  warnings: string[];
}

export interface ChildrenCsvPreviewReport {
  total: number;
  additions: Child[];
  rows: ChildrenCsvPreviewRow[];
  errors: string[];
  warnings: string[];
  skipped: number;
  conflicts: number;
  /** Doar în răspunsul rutei de previzualizare; importul confirmat o trimite înapoi. */
  revision?: number;
}
```

- [ ] **Step 2: Folosește tipurile în server și în dialog**

`children-csv-import.mjs`: liniile 5–15 (blocul `@typedef` pentru rând și raport) devin:

```js
/** @typedef {import('../children.types.mjs').ChildrenCsvPreviewRow} ChildrenCsvPreviewRow */
/** @typedef {import('../children.types.mjs').ChildrenCsvPreviewReport} ChildrenCsvPreviewReport */
```

`children-csv-dialog.mjs`: liniile 5–29 devin aceleași două rânduri.

- [ ] **Step 3: Poarta**

Run: `npm run check`
Expected: verde; `tsc` fără erori (dialogul citește doar câmpuri prezente în tipul complet).

- [ ] **Step 4: Commit**

```bash
git add src/features/children/children.types.d.mts src/features/children/server/children-csv-import.mjs src/features/children/web/children-csv-dialog.mjs src/features/children/README.md
git commit -m "refactor(children): declare CSV preview types once"
```

---

### Task 6: Fără `catch` gol și fără `try/catch` inutil (D1, D2)

**Files:**
- Modify: `src/core/server/files/remove-file-if-present.mjs`
- Create: `src/core/server/files/remove-file-if-present.test.mjs`
- Modify: `src/features/backup/server/backup.service.mjs:51-53,116-118`
- Modify: `src/features/children/server/children-csv-import.mjs:123-127`

**Interfaces:**
- Consumes/Produces: `removeFileIfPresent(file: string): void` (semnătură neschimbată).

- [ ] **Step 1: Scrie testele**

`src/core/server/files/remove-file-if-present.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeFileIfPresent } from './remove-file-if-present.mjs';

function createTemporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'startica-remove-file-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('șterge fișierul existent și ignoră unul lipsă', t => {
  const file = join(createTemporaryDirectory(t), 'copie.db.tmp');
  writeFileSync(file, 'conținut parțial');

  removeFileIfPresent(file);
  removeFileIfPresent(file);

  assert.equal(existsSync(file), false);
});

test('o ștergere eșuată lasă un avertisment, fără să arunce', t => {
  const directory = createTemporaryDirectory(t);
  const warn = t.mock.method(console, 'warn', () => {});

  removeFileIfPresent(directory);

  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /nu a putut fi șters/);
});
```

- [ ] **Step 2: Rulează testele și verifică faptul că al doilea pică**

Run: `node --test src/core/server/files/remove-file-if-present.test.mjs`
Expected: primul PASS, al doilea FAIL (`callCount` 0).

- [ ] **Step 3: Adaugă avertismentul**

`src/core/server/files/remove-file-if-present.mjs`:

```js
import { existsSync, unlinkSync } from 'node:fs';

// Ștergere best-effort a unui fișier intermediar; nu are voie să ascundă eroarea originală.
/** @param {string} file */
export const removeFileIfPresent = file => {
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch (error) {
    console.warn(`Fișierul temporar ${file} nu a putut fi șters: ${/** @type {Error} */ (error).message}`);
  }
};
```

- [ ] **Step 4: Rulează testele și verifică faptul că trec**

Run: `node --test src/core/server/files/remove-file-if-present.test.mjs`
Expected: PASS (2 teste).

- [ ] **Step 5: Avertismente în serviciul de backup**

`backup.service.mjs`, în `pruneTemporary` (liniile 51–53):

```js
    try {
      if (statSync(file).mtimeMs < cutoff) unlinkSync(file);
    } catch (error) {
      console.warn(`Backupul temporar ${file} nu a putut fi curățat: ${/** @type {Error} */ (error).message}`);
    }
```

În `copyExternally` (liniile 116–118):

```js
    try {
      pruneTemporary(external);
    } catch (error) {
      console.warn(`Curățarea folderului extern ${external} a eșuat: ${/** @type {Error} */ (error).message}`);
    }
```

- [ ] **Step 6: Scoate `try/catch` din `csvDate`**

`children-csv-import.mjs`, liniile 123–127 (`let valid = false; try { valid = dateOK(result); } catch {}`) devin:

```js
  const valid = dateOK(result);
```

- [ ] **Step 7: Poarta**

Run: `npm run check`
Expected: 218 teste, 217 trec, 1 sărit (testele CSV de copii și de backup trec neschimbat).

- [ ] **Step 8: Commit**

```bash
git add src/core/server/files src/features/backup/server/backup.service.mjs src/features/children/server/children-csv-import.mjs
git commit -m "fix(backup): warn when best-effort temporary file cleanup fails"
```

---

### Task 7: Șterge exporturile, tipurile și fișierele moarte (X2–X6, U4, O2)

**Files:**
- Modify: `src/features/backup/index.server.mjs`, `src/features/dashboard/index.web.mjs`, `src/features/fee-setup/index.server.mjs`, `src/features/fee-setup/index.web.mjs`, `src/features/payment-assignment/index.web.mjs`, `src/features/review-center/index.server.mjs`, `src/features/review-center/index.web.mjs`
- Modify: README-urile acestor cinci feature-uri (tabelele Public API)
- Modify: `src/app/web/month-picker.mjs:46-47`, `src/core/server/database/migration-runner.mjs:12,20`, `src/core/server/http/static-assets.mjs:22,38`, `src/shared/ui/child-picker.mjs:8` și apelurile `normalizeSearch(`, `src/shared/ui/pagination.mjs:3`, `src/features/data-transfer/test-support/financial-history-fixtures.mjs:7`
- Modify: `src/features/backup/backup.types.d.mts:73-82`, `src/features/data-transfer/data-transfer.types.d.mts:1`
- Modify: `src/features/record-editing/record-editing.types.d.mts:15-20`, `src/features/record-editing/server/record-editing.routes.mjs:11-13`
- Delete: `shared/text.mjs`
- Modify: `shared/domain.mjs:36-39`

**Interfaces:**
- Produces: API-urile publice de mai jos (singurele exporturi rămase în index).

- [ ] **Step 1: Restrânge fișierele index**

```js
// src/features/backup/index.server.mjs
export { createBackupService } from './server/backup.service.mjs';
export { createBackupRoutes } from './server/backup.routes.mjs';

// src/features/dashboard/index.web.mjs
export { createDashboardView } from './web/dashboard.view.mjs';
export { createChildrenSummaryView } from './web/children-summary.view.mjs';

// src/features/fee-setup/index.server.mjs
export { createFeeSetupRoutes } from './server/fee-setup.routes.mjs';

// src/features/fee-setup/index.web.mjs
export { createFeeSetupController } from './web/fee-setup.controller.mjs';

// src/features/payment-assignment/index.web.mjs — linia cu ASSIGNMENT_QUEUE_LIMIT devine:
export { createPaymentAssignmentController } from './web/payment-assignment.controller.mjs';

// src/features/review-center/index.server.mjs
export { findRecordIssues } from './domain/record-issues.mjs';

// src/features/review-center/index.web.mjs — prima linie devine:
export { buildReviewCenter } from './domain/review-center.mjs';
```

Scoate aceleași nume din tabelele Public API ale README-urilor respective.

- [ ] **Step 2: Scoate `export` de pe simbolurile folosite doar intern**

- `month-picker.mjs`: `export function closeMonthPicker()` → `function closeMonthPicker()`; șterge comentariul „Exportată separat: …” de deasupra.
- `migration-runner.mjs`: `export const MIGRATIONS` → `const MIGRATIONS`; `export function schemaVersion` (sau `export const`) → fără `export`.
- `static-assets.mjs`: `export const mimeFor` → `const mimeFor`; `export const importMapHashes` → `const importMapHashes`.
- `pagination.mjs`: `export const PAGE_SIZE` → `const PAGE_SIZE`.
- `financial-history-fixtures.mjs`: `export function v5SourceChild` → `function v5SourceChild`.
- `child-picker.mjs`: șterge `export const normalizeSearch = normalizeSearchText;` și înlocuiește în fișier `normalizeSearch(` cu `normalizeSearchText(`.

- [ ] **Step 3: Tipuri și fișiere moarte**

- `backup.types.d.mts`: șterge `interface BackupPreview` (liniile 73–82).
- `data-transfer.types.d.mts:1`: scoate `RecordType` din importul de tipuri (dacă rămâne un import gol, șterge linia).
- `record-editing.types.d.mts`: în `RecordDeleteRequest`, `type: 'children' | 'payments' | 'expenses';` devine `type: EditableRecordType;`.
- `record-editing.routes.mjs:11-13`:

```js
// Grupele și categoriile au rute proprii de ștergere; aici doar tipurile cu arhivare.
/** @type {import('../record-editing.types.mjs').EditableRecordType[]} */
const DELETABLE_TYPES = ['children', 'payments', 'expenses'];
```

- `git rm shared/text.mjs`
- `shared/domain.mjs`: șterge blocul `export { buildBirthdayCalendar as monthCalendar, listUpcomingBirthdays as upcomingBirthdays } from '#features/children/domain/birthdays.mjs';`.

- [ ] **Step 4: Verifică faptul că nimic nu mai folosește numele scoase**

Run:

```bash
grep -rnE "readBackupSnapshot|selectBackupsToKeep|summarizeCashForMonth|applyChildFeeSetup|hasMissingFee|ASSIGNMENT_QUEUE_LIMIT|REVIEW_FILTERS|filterReviewItems|closeMonthPicker|MIGRATIONS|schemaVersion|mimeFor|importMapHashes|normalizeSearch\b|PAGE_SIZE|v5SourceChild|BackupPreview|monthCalendar|upcomingBirthdays|shared/text" src tests scripts --include=*.mjs --include=*.mts
```

Expected: doar definițiile interne (fișierul propriu al fiecărui nume) și importuri directe din fișierul-sursă (nu din `index.*.mjs`).

- [ ] **Step 5: Poarta**

Run: `npm run check`
Expected: 218 teste, 217 trec, 1 sărit.

- [ ] **Step 6: Commit**

```bash
git add -A src shared
git commit -m "refactor(app): remove unused exports, types and files"
```

---

### Task 8: Nume explicite în validare și import (N1–N6)

**Files:**
- Modify: `src/shared/domain/record-schema.mjs:98-229`
- Modify: `src/features/children/server/children-csv-import.mjs:229-270`
- Modify: `src/features/data-transfer/domain/excel-workbook.mjs:213,233,261`
- Modify: `src/features/data-transfer/server/financial-history-import.mjs:85-111`
- Modify: `src/features/children/web/child-editor-fields.mjs:15-26`
- Modify: `src/features/fee-setup/server/fee-setup.routes.integration.test.mjs:27-80`

**Interfaces:** semnăturile exportate rămân identice.

- [ ] **Step 1: Redenumește în `record-schema.mjs`**

- `normalizeRecord`: `const r = structuredClone(input);` → `const record = structuredClone(input);` și toate aparițiile `r.`/`r[` din funcție; în bucla de istoric `item` → `historyEntry`; în bucla `r.tenders.map(p => p.method)` → `tender => tender.method`; în bucla repartizărilor `const a of r.allocations` → `const allocation of record.allocations`; `return r;` → `return record;`.
- `validateState`: `const s = emptyState();` → `const state = emptyState();`; `input[type].map(r => …)` → `rawRecord => …`; `const clean` → `const normalized`; `for (const p of s.payments)` → `for (const payment of state.payments)`; `for (const c of s.children)` → `for (const child of state.children)`; `new Set(s.children.map(r => r.id))` → `new Set(state.children.map(child => child.id))`; `new Set(s.groups.map(g => g.id))` → `new Set(state.groups.map(group => group.id))`; `return s;` → `return state;`.

- [ ] **Step 2: Redenumește în celelalte fișiere**

- `children-csv-import.mjs:229-270`: `item` → `candidate`, `const r = item.record` → `const record = candidate.record`.
- `excel-workbook.mjs`: în cele trei `.map(r => ({ … }))` de export, `r` → `child` (213), `payment` (233), `expense` (261).
- `financial-history-import.mjs:85-111`: `r` → `addition`.
- `child-editor-fields.mjs`: în `parseHistory`, `s` → `line`, `parts` → `segments`; în `upsertHistory`, `r` → `row`.
- `fee-setup.routes.integration.test.mjs`: `r` → `response`.

- [ ] **Step 3: Poarta**

Run: `npm run check`
Expected: 218 teste, 217 trec, 1 sărit.

Run: `grep -nE "\b(const|let) (r|s|p|c|a|item)\b" src/shared/domain/record-schema.mjs src/features/children/server/children-csv-import.mjs src/features/data-transfer/server/financial-history-import.mjs src/features/fee-setup/server/fee-setup.routes.integration.test.mjs`
Expected: nicio linie.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "refactor(shared): use explicit names in record validation and imports"
```

---

### Task 9: Mută testele rămase la rădăcină lângă modulele lor (S2)

**Files:**
- Modify: `tests/support/start-test-application.mjs` (reexportă `createApplication`, alias în loc de `../../`)
- Create: `src/shared/domain/record-schema.test.mjs`
- Create: `src/shared/domain/tuition-obligation.test.mjs`
- Create: `src/shared/domain/payment-allocations.test.mjs`
- Modify: `src/features/dashboard/domain/cash-summary.test.mjs`
- Modify: `src/features/data-transfer/domain/excel-workbook.test.mjs`
- Create: `src/features/backup/server/backup-lifecycle.integration.test.mjs`
- Create: `src/features/payment-assignment/server/payment-assignment.routes.integration.test.mjs`
- Create: `src/app/server/create-application.integration.test.mjs`
- Modify: `src/app/server/session.routes.integration.test.mjs`
- Delete: `tests/fixes.test.mjs`, `tests/application.test.mjs`, `tests/children-csv.test.mjs`

**Interfaces:**
- Produces: `tests/support/start-test-application.mjs` exportă `startTestApplication(t, options)` și `createApplication(options)`.

Regula: testele se mută cu aceleași nume și aserțiuni; se schimbă doar importurile. Testele de domeniu importă din `#shared/domain/*`; cele de integrare din `#test-support/start-test-application.mjs` (inclusiv `createApplication`, ca un feature să nu importe `#app`).

- [ ] **Step 1: Pregătește suportul de test**

`tests/support/start-test-application.mjs`, linia 4:

```js
import { createApplication } from '#app/server/create-application.mjs';

export { createApplication };
```

- [ ] **Step 2: Mută testele de domeniu**

| Test (fișier:linie) | Destinație | Importuri |
|---|---|---|
| `tests/fixes.test.mjs:41` „Statutul copilului este restrâns…” | `src/shared/domain/record-schema.test.mjs` | `normalizeRecord`, `CHILD_STATUSES`, `STATUS_HISTORY_VALUES` din `./record-schema.mjs` |
| `tests/fixes.test.mjs:302` „Normalizarea păstrează fiecare câmp real…” | idem | idem |
| `tests/application.test.mjs:58` „Validare monetară, dată, identificatori…” | idem | `normalizeRecord`, `validateState` + fixture-urile `child()`/`payment()` copiate din `tests/application.test.mjs:11-31` |
| `tests/fixes.test.mjs:162` „Scadența vine din data contractului…” | `src/shared/domain/tuition-obligation.test.mjs` | `obligation`, `dueDayFor` din `./tuition-obligation.mjs`; `normalizeRecord` din `./record-schema.mjs` |
| `tests/application.test.mjs:33` „Încasări după data reală…”, fără cele două aserțiuni `cashSummary` (liniile 48–49) | idem | `obligation` + fixture-urile `child()`/`payment()` |
| aserțiunile `cashSummary` din `tests/application.test.mjs:48-49` | `src/features/dashboard/domain/cash-summary.test.mjs`, test nou „Încasările lunii după data reală a plății” | `summarizeCashForMonth` din `./cash-summary.mjs` (înlocuiește `cashSummary`) |
| `tests/children-csv.test.mjs:8`, partea `normalizeRecord` + `tenders` (liniile 9–31, 38–48, 51) | `src/shared/domain/record-schema.test.mjs`, test „Doi părinți opționali și achitare mixtă se normalizează” | `normalizeRecord` |
| idem, `paymentTenders(legacy)` (linia 50) | `src/shared/domain/payment-allocations.test.mjs`, test „O achitare veche fără componente are o singură metodă” | `paymentTenders` din `./payment-allocations.mjs` |
| idem, `cashSummary` (liniile 32–36, 52) | `src/features/dashboard/domain/cash-summary.test.mjs`, test „Achitarea mixtă se împarte pe metode, cea arhivată nu contează” | `summarizeCashForMonth`, `obligation` din `#shared/domain/tuition-obligation.mjs` |
| idem, round-trip Excel (liniile 53–60) | `src/features/data-transfer/domain/excel-workbook.test.mjs`, test „Doi părinți și achitarea mixtă trec prin export și import” | `exportWorkbook`, `readWorkbook` (cu `() => []` ca `findRecordIssues`, ca restul testelor din fișier), încărcarea `XLSX` deja existentă în fișier |

- [ ] **Step 3: Mută testele de integrare**

| Test | Destinație |
|---|---|
| `tests/fixes.test.mjs:21,61,95,111,135` (curățarea `.tmp`, rărirea backupului automat, folder extern dispărut, reîncercarea după eșec, copia amânată) | `src/features/backup/server/backup-lifecycle.integration.test.mjs`, cu helper-ul `startApplication` și constanta `CHILD` din `tests/fixes.test.mjs:54-59` |
| `tests/fixes.test.mjs:234` „Asocierea în masă leagă achitările…” | `src/features/payment-assignment/server/payment-assignment.routes.integration.test.mjs` |
| `tests/application.test.mjs:68` „API: conflicte, reîncercări, backup, restaurare, jurnal și securitate” și `:182` „Migrarea bazei vechi păstrează datele…” | `src/app/server/create-application.integration.test.mjs` |
| `tests/application.test.mjs:200` „Oprire desktop autentificată…” | `src/app/server/session.routes.integration.test.mjs` (adăugat la final) |

- [ ] **Step 4: Șterge fișierele goale**

```bash
git rm tests/fixes.test.mjs tests/application.test.mjs tests/children-csv.test.mjs
```

- [ ] **Step 5: Poarta**

Run: `npm run check`
Expected: 222 de teste (4 în plus din împărțirea a două teste combinate), 221 trec, 1 sărit, 0 eșuate; `node --test tests/architecture/import-boundaries.test.mjs` verde.

Run: `grep -rn "shared/domain.mjs" src tests scripts --include=*.mjs`
Expected: nicio linie.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "test(app): colocate remaining root tests with their modules"
```

---

### Task 10: Șterge fațada `shared/domain.mjs` și ramura legacy din lista albă (X3, S4, S5)

**Files:**
- Delete: `shared/domain.mjs`
- Modify: `src/core/server/http/static-assets.mjs:43-46,67-71`
- Modify: `src/core/server/http/static-assets.test.mjs:5-35`

**Interfaces:**
- Produces: `isBrowserModule(path: string): boolean` acceptă doar module din `src/`.

- [ ] **Step 1: Actualizează testul listei albe**

În `static-assets.test.mjs`, mută `'/ui/views.mjs'` și `'/shared/domain.mjs'` din `BROWSER_MODULES` în `PRIVATE_PATHS`.

- [ ] **Step 2: Rulează testul și verifică faptul că pică**

Run: `node --test src/core/server/http/static-assets.test.mjs`
Expected: FAIL pe `/ui/views.mjs`.

- [ ] **Step 3: Scoate ramura legacy**

În `static-assets.mjs`:
- șterge comentariul și constanta `LEGACY_MODULE_PATH` (liniile 43–46);
- `export const isBrowserModule = path => LEGACY_MODULE_PATH.test(path) || isBrowserSourceModule(path);` devine `export const isBrowserModule = isBrowserSourceModule;`;
- în `sendBrowserModule`, șterge comentariul „/ui/... trăiește sub web/ …” și linia cu ramura `/ui/`, înlocuind-o cu `const file = join(root, path);`.

- [ ] **Step 4: Rulează testul și verifică faptul că trece**

Run: `node --test src/core/server/http/static-assets.test.mjs tests/http-modules.test.mjs`
Expected: PASS.

- [ ] **Step 5: Șterge fațada**

```bash
git rm shared/domain.mjs
```

Run: `grep -rn "shared/" --include=*.mjs --include=*.js --include=*.ps1 --include=*.html . | grep -v "src/shared\|#shared\|node_modules\|docs/\|Livrare/\|runtime/"`
Expected: nicio linie (folderul `shared/` de la rădăcină e gol și dispare din git).

- [ ] **Step 6: Poarta + pornire**

Run: `npm run check`, apoi singur `node tests/browser-smoke.mjs`, apoi `powershell -NoProfile -ExecutionPolicy Bypass -File tests/desktop-lifecycle.ps1`.
Expected: verde; `PASS: …`; `PASS: lansatorul VBS …`.

- [ ] **Step 7: Commit**

```bash
git add -A shared src
git commit -m "refactor(core): serve browser modules only from src"
```

---

### Task 11: Împarte `src/app/web/main.mjs` (M1, S1, D3)

**Files:**
- Create: `src/app/web/compose-screens.mjs`
- Create: `src/app/web/global-actions.mjs`
- Modify: `src/app/web/main.mjs` (rămâne bootstrap, sub ~120 de linii)

**Interfaces:**
- Produces:
  - `composeScreens(dependencies)` → `{ recordEditor, childProfile }`, cu `dependencies = { element, sessionState, readRecords, requestJson, submitMutation, acceptResult, showNotice, renderSaveStatus, setRenderers, eventBus, renderCycle, navigation, readSelectedMonth }`. Conține, mutate fără modificări, toate blocurile din `main.mjs` de la `createBackupHealthView` până la ultimul `renderCycle.addScreen(...)`, plus importurile de feature-uri pe care le folosesc.
  - `bindGlobalActions(dependencies)` → `void`, cu `dependencies = { element, sessionState, navigation, renderCycle, recordEditor, childProfile, showNotice, loadSession, renderSaveStatus }`. Conține, mutate fără modificări: handler-ul `document.addEventListener('click', …)`, filtrele „De verificat” (`refreshReview`, `reviewFilter`, `reviewSearch`, `reviewReset`), butonul de reîncărcare, tipărirea (`printView`, `afterprint`, `printButton`, `printNotify`) și ascultătorii de stare a formularelor (`editorForm` input/invalid, `editor` close, `externalDir` input).
- Consumes: `confirmOnSecondClick` din Task 3.

- [ ] **Step 1: Creează `compose-screens.mjs`**

```js
import { setNavCount } from '#shared/ui/nav-count-badge.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
// + importurile de feature-uri mutate din main.mjs (audit-log, backup, billing, children, dashboard,
//   data-transfer, expenses, fee-setup, groups, payment-assignment, payments, record-editing, review-center)

/**
 * Leagă id-urile din index.html de ecranele fiecărui feature și le înregistrează în ciclul de randare.
 * @param {{
 *   element: (id: string) => any,
 *   sessionState: any,
 *   readRecords: () => any,
 *   requestJson: (path: string, body?: unknown) => Promise<any>,
 *   submitMutation: (path: string, body: any, base?: number) => Promise<any>,
 *   acceptResult: (result: any) => void,
 *   showNotice: (text: string, isError?: boolean) => void,
 *   renderSaveStatus: () => void,
 *   setRenderers: (renderers: { render: () => void, health: () => void }) => void,
 *   eventBus: any,
 *   renderCycle: ReturnType<typeof import('./render-cycle.mjs').createRenderCycle>,
 *   navigation: ReturnType<typeof import('./navigation.mjs').createNavigation>,
 *   readSelectedMonth: () => string,
 * }} dependencies
 */
export function composeScreens(dependencies) {
  const { element, sessionState, readRecords, requestJson, submitMutation, acceptResult, showNotice } = dependencies;
  const { renderSaveStatus, setRenderers, eventBus, renderCycle, navigation, readSelectedMonth } = dependencies;
  // blocurile mutate din main.mjs, în aceeași ordine, de la createBackupHealthView la ultimul renderCycle.addScreen
  return { recordEditor, childProfile };
}
```

Mută blocurile verbatim (inclusiv comentariul despre ordinea listelor și a categoriilor). Liniile de tipul „+ importurile …” și „blocurile mutate …” de mai sus sunt locul unde se lipesc importurile și blocurile existente; nu rămân în fișier.

- [ ] **Step 2: Creează `global-actions.mjs`**

```js
import { pageIndexByList } from '#shared/ui/pagination.mjs';
import { confirmOnSecondClick } from '#shared/ui/confirm-twice-button.mjs';

/**
 * @param {{
 *   element: (id: string) => any,
 *   sessionState: any,
 *   navigation: ReturnType<typeof import('./navigation.mjs').createNavigation>,
 *   renderCycle: ReturnType<typeof import('./render-cycle.mjs').createRenderCycle>,
 *   recordEditor: any,
 *   childProfile: { openChildProfile: (childId: string) => void },
 *   showNotice: (text: string, isError?: boolean) => void,
 *   loadSession: () => Promise<void>,
 *   renderSaveStatus: () => void,
 * }} dependencies
 */
export function bindGlobalActions({
  element,
  sessionState,
  navigation,
  renderCycle,
  recordEditor,
  childProfile,
  showNotice,
  loadSession,
  renderSaveStatus,
}) {
  // blocurile mutate din main.mjs: handler-ul de click, filtrele „De verificat”, reîncărcarea, tipărirea, starea formularelor
}
```

Comentariul „blocurile mutate …” marchează locul lipirii și nu rămâne în fișier.

- [ ] **Step 3: Reduce `main.mjs` la bootstrap**

`src/app/web/main.mjs` rămâne cu, în ordine:
1. importurile din `#shared/ui/element-lookup.mjs`, `#shared/domain/calendar-month.mjs`, `#shared/contracts/domain-events.mjs`, `buildReviewCenter` (`#features/review-center/index.web.mjs`), `evaluateChildrenForMonth` (`#features/billing/index.web.mjs`), `findUnassignedPaymentHintsByChild` (`#features/payment-assignment/index.web.mjs`), `./app-session.mjs`, `./navigation.mjs`, `./render-cycle.mjs`, `./month-picker.mjs`, `./mobile-navigation.mjs`, `./unsaved-changes-guard.mjs`, `./compose-screens.mjs`, `./global-actions.mjs`;
2. `HEALTH_POLL_MS`, `element`, `readRecords`, `submitMutation`, `navigation`, `renderCycle` și cele două `eventBus.subscribe` (neschimbate);
3. `const { recordEditor, childProfile } = composeScreens({ … })`;
4. `bindMonthPicker(…)` și `bindMobileNavigation(…)` (ordinea și comentariul despre Escape rămân);
5. `bindGlobalActions({ … })`;
6. `bindUnsavedChangesGuard(…)`;
7. blocul „Pornire” (`setInterval`, `focus`, `loadSession().catch(…)`).

- [ ] **Step 4: Verifică dimensiunile și granițele**

Run: `wc -l src/app/web/main.mjs src/app/web/compose-screens.mjs src/app/web/global-actions.mjs`
Expected: `main.mjs` < 120; niciun fișier nu depășește dimensiunea totală a vechiului `main.mjs`.

Run: `node --test tests/architecture/import-boundaries.test.mjs`
Expected: PASS (`app` importă feature-uri doar prin `index.*.mjs`).

- [ ] **Step 5: Poarta + browser + pornire**

Run: `npm run check`, apoi singur `node tests/browser-smoke.mjs`, apoi `powershell -NoProfile -ExecutionPolicy Bypass -File tests/desktop-lifecycle.ps1`.
Expected: verde; `PASS: …`; `PASS: lansatorul VBS …`.

- [ ] **Step 6: Commit**

```bash
git add src/app/web
git commit -m "refactor(app): split the browser composition root"
```

---

### Task 12: Calcule repetate la randare (E1–E3) și închiderea auditului

**Files:**
- Modify: `src/features/fee-setup/web/fee-setup.view.mjs:9-24,26-48`
- Create or Modify: `src/features/fee-setup/web/fee-setup.view.test.mjs`
- Modify: `src/features/fee-setup/web/fee-setup.controller.mjs` (funcția `render`)
- Modify: `src/features/dashboard/web/dashboard.view.mjs:92-116`
- Modify: `src/features/children/web/children-list.view.mjs:74-86,104-110`
- Modify: `docs/arhitectura/README.md` (antet)
- Modify: `docs/superpowers/specs/2026-09-14-code-audit.md` (stare la final)

**Interfaces:**
- Produces: `groupOptionsMarkup(groupsSortedByName: Group[], selectedGroupId: string): string` — nu mai sortează; `feeSetupRowMarkup(child, groupsSortedByName, today)`.

- [ ] **Step 1: Scrie testul pentru ordinea grupelor**

`src/features/fee-setup/web/fee-setup.view.test.mjs` (dacă fișierul există, adaugă testul):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOptionsMarkup } from './fee-setup.view.mjs';

test('opțiunile de grupă păstrează ordinea primită și marchează grupa aleasă', () => {
  const groups = /** @type {any} */ ([
    { id: 'GRP-B', name: 'Zmeie' },
    { id: 'GRP-A', name: 'Albine' },
  ]);

  assert.equal(
    groupOptionsMarkup(groups, 'GRP-A'),
    '<option value="">Fără grupă</option><option value="GRP-B" >Zmeie</option><option value="GRP-A" selected>Albine</option>',
  );
});
```

- [ ] **Step 2: Rulează testul și verifică faptul că pică**

Run: `node --test src/features/fee-setup/web/fee-setup.view.test.mjs`
Expected: FAIL — funcția sortează încă (Albine înaintea Zmeie).

- [ ] **Step 3: Sortează o singură dată pe randare**

`fee-setup.view.mjs`, `groupOptionsMarkup`:

```js
/**
 * @param {Group[]} groupsSortedByName
 * @param {string} selectedGroupId
 */
export function groupOptionsMarkup(groupsSortedByName, selectedGroupId) {
  return (
    `<option value="">Fără grupă</option>` +
    groupsSortedByName
      .map(
        group =>
          `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`,
      )
      .join('')
  );
}
```

În `feeSetupRowMarkup`, parametrul `groups` devine `groupsSortedByName` (JSDoc și apelul `groupOptionsMarkup(groupsSortedByName, child.groupId || '')`).

În `fee-setup.controller.mjs`, la începutul `render()`, după `const records = readRecords();`:

```js
    const groupsSortedByName = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
```

și apelurile devin `feeSetupRowMarkup(child, groupsSortedByName, today)` și `groupOptionsMarkup(groupsSortedByName, '')`.

- [ ] **Step 4: Rulează testul și verifică faptul că trece**

Run: `node --test src/features/fee-setup/web/fee-setup.view.test.mjs`
Expected: PASS.

- [ ] **Step 5: Zilele de naștere o singură dată în Dashboard**

`dashboard.view.mjs`:
- `function renderBirthdays(children)` devine `function renderBirthdays(children, upcomingBirthdayRows)` și prima linie `const upcoming = listUpcomingBirthdays(children, 5);` se șterge; `upcoming.map(` devine `upcomingBirthdayRows.map(`;
- apelul existent `renderBirthdays(records.children)` devine `renderBirthdays(records.children, upcomingBirthdayRows)`.

- [ ] **Step 6: O singură citire a datelor în lista de copii**

`children-list.view.mjs`:
- `function rowCellsFor(child)` devine `function rowCellsFor(child, records)` (JSDoc `@param {RecordsSnapshot} records`) și linia `const records = readRecords();` din ea se șterge;
- în `render()`, `rowCellsFor(child)` devine `rowCellsFor(child, records)`.

- [ ] **Step 7: Poarta + browser**

Run: `npm run check`, apoi singur `node tests/browser-smoke.mjs`.
Expected: 223 de teste, 222 trec, 1 sărit; `PASS: …`.

- [ ] **Step 8: Închide auditul în documentație**

`docs/arhitectura/README.md`, după paragraful „Pasul 10 a mutat …”, înlocuiește fraza despre audit cu:

```markdown
Auditul din 14 septembrie a fost remediat după `docs/superpowers/plans/2026-09-14-audit-remediation.md`: scriptul V5 repară, documentația și comentariile fără istorie, confirmarea în doi pași, fieldset-ul și tipurile CSV unificate, exporturi și fațade moarte șterse, testele de la rădăcină mutate lângă module, `src/app/web/main.mjs` împărțit. Pașii 11–12 pornesc de aici.
```

`docs/superpowers/specs/2026-09-14-code-audit.md`: adaugă la final:

```markdown
## Stare

Remediat conform `docs/superpowers/plans/2026-09-14-audit-remediation.md`. Nerezolvate intenționat: O1, U5, E4.
```

- [ ] **Step 9: Commit**

```bash
git add src/features/fee-setup src/features/dashboard/web/dashboard.view.mjs src/features/children/web/children-list.view.mjs docs/arhitectura/README.md docs/superpowers/specs/2026-09-14-code-audit.md
git commit -m "perf(app): avoid repeated work while rendering screens"
```
