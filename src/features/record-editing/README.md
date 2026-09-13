# record-editing

Dialogul generic de editare (`<dialog id="editor">`): deschidere, salvare, arhivare, ștergere definitivă a unei fișe arhivate și confirmarea unei verificări de import. Câmpurile specifice fiecărui tip (copil/achitare/cheltuială) NU sunt aici — sunt injectate din feature-urile lor, ca `record-editing` să nu depindă de `children`/`payments`/`expenses` și nici invers.

Grupele și categoriile nu trec prin acest dialog: au propriile formulare inline (`groups`, `expenses`).

Modul **independent**: nu depinde de `children`/`payments`/`expenses`; primește câmpurile lor deja compuse, prin `fieldsByType`, de la composition root-ul din `web/app.js`.

## Public API

Nu are încă `index.server.mjs`/`index.web.mjs` — integrarea (înlocuirea rutelor `/api/record`/`/api/record-delete` din `server/routes.mjs` și a lui `web/ui/editor.mjs`) e pasul următor din plan.

### `server/record-editing.routes.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditingRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/record`, `POST /api/record-delete`, cu corpurile neschimbate |

### `web/record-editor-dialog.mjs`

| Export | Rol |
| --- | --- |
| `createRecordEditorDialog({ elements, fieldsByType, sessionState, readRecords, submitMutation, showNotice, renderSaveStatus, readExpenseCategoryNames })` | întoarce `{ openEditor(type, id?), archiveRecord(type, id), deleteRecord(type, id), confirmReview(paymentId) }`; leagă `submit`-ul formularului o singură dată, la construire |

### `record-editing.types.d.mts`

Definește `RecordEditorFields` — interfața implementată **structural** (fără import) de fiecare `*-editor-fields.mjs` — și `RecordEditorContext`, ce primește un astfel de modul la randare și la citire: `records`, `today()`, `mode`, `previousRecord`, `markDirty()`, `renderSaveStatus()`, `confirm(message)` și, doar pt. `expenses`, `readExpenseCategoryNames()`.

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pt. mod invalid, id duplicat, fișă lipsă, tip nedeletabil |
| `#shared/domain/record-schema.mjs` | `normalizeRecord()` |
| `#shared/domain/record-integrity.mjs` | `assertRecordReferencesExist()`, `assertUniqueName()` — extrase din fostul `/api/record`, testate izolat |
| `#shared/domain/calendar-month.mjs` | `today()`, injectat în `RecordEditorContext` |
| `#shared/ui/form-fields.mjs` | `textareaFieldMarkup()` pt. câmpul „Observații”, comun tuturor tipurilor |
| `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs`, `#shared/contracts/record-types.mjs` | tipuri |

## Structură

```
record-editing/
├── README.md
├── record-editing.types.d.mts
├── server/
│   ├── record-editing.routes.mjs               # ★ /api/record, /api/record-delete
│   └── record-editing.routes.integration.test.mjs
└── web/
    └── record-editor-dialog.mjs                 # ★ portat din web/ui/editor.mjs (partea generică)
```

Câmpurile per tip stau în feature-urile lor, nu aici:

```
children/web/child-editor-fields.mjs      # childEditorFields
payments/web/payment-editor-fields.mjs    # paymentEditorFields
payments/web/allocation-rows.mjs          # repartizarea pe luni (rânduri, sold, +Lună)
expenses/web/expense-editor-fields.mjs    # expenseEditorFields
```

## Decizii

- **`RecordEditorFields` e o interfață structurală, nu un import.** Fiecare `*-editor-fields.mjs` din `children`/`payments`/`expenses` implementează `{ idPrefix, title(record, mode), markup(record, context), bind?(formElement, context), read(formData, formElement, context) }` fără să importe `record-editing` — regula „feature-urile nu se importă între ele” rămâne validă în ambele sensuri. Dialogul le primește deja compuse, prin `fieldsByType`, injectat de `web/app.js`.
- **Normalizarea e responsabilitatea fiecărui `read()`.** Legacy sărea re-normalizarea pt. `payments` (deja normalizat intern, pt. verificarea dublurii); acum fiecare `read()` întoarce direct fișa normalizată, iar dialogul nu mai normalizează separat — comportament identic, fără cazul special.
- **`notes` rămâne generic.** Dialogul adaugă textarea „Observații” după `markup()`-ul specific tipului, exact ca în legacy (`FIELDS[type](r) + textarea('notes', ...)`).
- **Integritatea referențială și unicitatea numelui sunt pure**, în `#shared/domain/record-integrity.mjs` — nu în rută — ca să fie testabile fără server sau bază de date.
- **Contractul HTTP al `/api/record` și `/api/record-delete` rămâne neschimbat** la migrare (aceleași mesaje, aceleași coduri de stare, același ordine a verificărilor).

## Ce trebuie să compună `web/app.js` la integrare

```js
createRecordEditorDialog({
  elements: {
    editor: $('editor'), editorForm: $('editorForm'), editorTitle: $('editorTitle'),
    editorFields: $('editorFields'), editorError: $('editorError'), editorSave: $('editorSave'),
  },
  fieldsByType: { children: childEditorFields, payments: paymentEditorFields, expenses: expenseEditorFields },
  sessionState: session,
  readRecords: () => session.state,
  submitMutation: mutate,
  showNotice: message,
  renderSaveStatus,
  readExpenseCategoryNames: () => listExpenseCategoryNames(session.state), // ca în web/ui/parts.mjs, expenseCategories()
});
```

`openEditor`/`archiveRecord`/`deleteRecord`/`confirmReview` înlocuiesc `openEditor`/`archive`/`deleteRecord`/`confirmReview` din `web/ui/editor.mjs`; `bindEditorForm()` dispare — legarea se face o singură dată, la `createRecordEditorDialog(...)`.

## Teste

```
node --test "src/features/record-editing/**/*.test.mjs" src/shared/domain/record-integrity.test.mjs
```

- Integrare: `record-editing.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs` — lovește `/api/record`/`/api/record-delete`, deocamdată încă rutate prin `server/routes.mjs`. Comportamentul verificat trebuie să rămână identic după integrare, deci testele rămân valabile ca plasă de siguranță.
- Domeniu: `src/shared/domain/record-integrity.test.mjs`, funcții pure.
