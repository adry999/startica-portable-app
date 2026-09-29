# record-editing

Dialogul generic de editare (`<dialog id="editor">`): deschidere, salvare, arhivare, ștergere definitivă a unei fișe arhivate și confirmarea unei verificări de import. Câmpurile specifice fiecărui tip (copil/achitare/cheltuială) NU sunt aici — sunt injectate din feature-urile lor, ca `record-editing` să nu depindă de `children`/`payments`/`expenses` și nici invers.

Grupele și categoriile nu trec prin acest dialog: au propriile formulare inline (`groups`, `expenses`).

Modul **independent**: nu depinde de `children`/`payments`/`expenses`; primește câmpurile lor deja compuse, prin `fieldsByType`, de la composition root-ul din `src/app/web/compose-screens.mjs`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditingRoutes({ recordRepository, auditTrail, runRevisionTransaction, attendanceRepository })` | `POST /api/record`, `POST /api/record-delete` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditorDialog(dependencies)` | întoarce `{ openEditor, archiveRecord, deleteRecord, confirmReview }` |

### `record-editing.types.d.mts`

Definește `RecordEditorFields` — interfața implementată **structural** (fără import) de fiecare `*-editor-fields.mjs` — și `RecordEditorContext`, ce primește un astfel de modul la randare și la citire: `records`, `today()`, `mode`, `previousRecord`, `markDirty()`, `renderSaveStatus()`, `confirm(message)` și, doar pt. `expenses`, `readExpenseCategoryNames()`.

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pt. mod invalid, id duplicat, fișă lipsă, tip nedeletabil |
| `#shared/domain/record-schema.mjs` | `normalizeRecord()` |
| `#shared/domain/record-integrity.mjs` | `assertRecordReferencesExist()`, `assertUniqueName()` — funcții pure, testate izolat |
| `#shared/domain/calendar-month.mjs` | `today()`, injectat în `RecordEditorContext` |
| `#shared/ui/form-fields.mjs` | `textareaFieldMarkup()` pt. câmpul „Observații”, comun tuturor tipurilor |
| `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs`, `#shared/contracts/record-types.mjs` | tipuri |
| `attendanceRepository` (`#features/attendance`), injectat de composition root | doar `removeAllForChild(childId)`, pt. cascada de la ștergerea definitivă a unui copil (B2) |

## Structură

```
record-editing/
├── README.md
├── record-editing.types.d.mts
├── server/
│   ├── record-editing.routes.mjs               # ★ /api/record, /api/record-delete
│   └── record-editing.routes.integration.test.mjs
└── web/
    └── record-editor-dialog.mjs                 # ★ dialogul generic
```

Câmpurile per tip stau în feature-urile lor, nu aici:

```
children/web/child-editor-fields.mjs      # childEditorFields
payments/web/payment-editor-fields.mjs    # paymentEditorFields
payments/web/allocation-rows.mjs          # repartizarea pe luni (rânduri, sold, +Lună)
expenses/web/expense-editor-fields.mjs    # expenseEditorFields
```

## Decizii

- **`RecordEditorFields` e o interfață structurală, nu un import.** Fiecare `*-editor-fields.mjs` din `children`/`payments`/`expenses` implementează `{ idPrefix, title(record, mode), markup(record, context), bind?(formElement, context), read(formData, formElement, context) }` fără să importe `record-editing` — regula „feature-urile nu se importă între ele” rămâne validă în ambele sensuri. Dialogul le primește deja compuse, prin `fieldsByType`, injectat de `src/app/web/compose-screens.mjs`.
- **Normalizarea e responsabilitatea fiecărui `read()`.** Fiecare `read()` întoarce direct fișa normalizată; dialogul nu normalizează separat.
- **`notes` rămâne generic.** Dialogul adaugă textarea „Observații” după `markup()`-ul specific tipului.
- **Integritatea referențială și unicitatea numelui sunt pure**, în `#shared/domain/record-integrity.mjs` — nu în rută — ca să fie testabile fără server sau bază de date.
- **Contractul HTTP al `/api/record` rămâne neschimbat.** `/api/record-delete` a primit lotul (B2, Formulare.dc.html#15h): `{ type, id }` (o singură fișă, forma originală, ex. dialogul vanilla) sau `{ type, ids }` (lot, folosit de `SelectionBar`/„Șterge definitiv” din webapp) — exact unul dintre `id`/`ids`. Orice id nearhivat respinge tot lotul (409), într-o singură tranzacție; nimic nu se șterge parțial. Ștergerea unui **copil** face și cascada: dezasociază achitările lui (`childId: ''`, rămân, apar în Asociere achitări), șterge plătitorii reținuți (`payerAliases`) și prezența lui; nu mai refuză ștergerea din cauza achitărilor existente (refuzurile pe vizită activă/taxe de bazin rămân neschimbate). Istoricul primește o intrare per fișă cerută la ștergere, nu per efect secundar al cascadei.
- **`/api/record` refuză `mode: 'update'` pentru `categories`.** Redenumirea unei categorii trebuie să propage noul nume la cheltuielile care o folosesc (fără FK) — doar `/api/category-rename` (feature `expenses`) face asta, în aceeași tranzacție. Fără acest refuz ar exista o a doua cale de redenumire, care ar lăsa cheltuielile cu numele vechi.

## Compunere

`src/app/server/create-application.mjs` înregistrează rutele. `src/app/web/compose-screens.mjs` creează dialogul cu `fieldsByType: { children: childEditorFields, payments: paymentEditorFields, expenses: expenseEditorFields }` și `readExpenseCategoryNames`, iar `src/app/web/global-actions.mjs` apelează `openEditor`, `archiveRecord`, `deleteRecord` și `confirmReview` din handler-ul global de click.

## Teste

```
node --test "src/features/record-editing/**/*.test.mjs" src/shared/domain/record-integrity.test.mjs
```

- Integrare: `record-editing.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs` — lovește `/api/record`/`/api/record-delete`.
- Domeniu: `src/shared/domain/record-integrity.test.mjs`, funcții pure.
