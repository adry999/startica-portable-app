# children

Lista de copii, fișa copilului, câmpurile copilului din editor, importul din CSV și calendarul zilelor de naștere.

Modul **independent**: nu importă alt feature. Grupele și achitările vin din `RecordsSnapshot`, nu dintr-un import direct al feature-urilor `groups` sau `payments`. Numărul de contract (`contractNumberOf`) și numele grupei sunt în `#shared/domain/record-labels.mjs`, pentru că le folosesc și alte ecrane.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createChildrenRoutes({ recordRepository, auditTrail, runRevisionTransaction, readEnvelope })` | `POST /api/children-csv-preview`, `POST /api/children-csv`, corpuri neschimbate |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `buildBirthdayCalendar(children, todayStr)`, `listUpcomingBirthdays(children, days, todayStr)` | calendarul lunar și zilele de naștere apropiate (Dashboard) |
| `createChildrenListView({ elements, readRecords, submitMutation, showNotice })` | lista „Copii”: căutare, arhivare, sortare, arhivare în masă; întoarce `{ render }` |
| `createChildProfileView({ elements: { body, dialog }, readRecords, readSelectedMonth })` | întoarce `{ openChildProfile }` |
| `createChildrenCsvDialog({ elements, sessionState, requestJson, submitMutation, showNotice })` | butonul de import, alegerea fișierului, previzualizarea și confirmarea |
| `childEditorFields` | câmpurile copilului pentru dialogul generic din `record-editing` (injectate de `web/app.js`) |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Scriere în istoric la import | port `AuditTrail`, injectat de `app/` | `import … from '#features/audit-log/…'` |
| Revizie, idempotență, backup înainte | port `RunRevisionTransaction` din `core` | acces direct la SQLite |
| Grupa copilului, în profil | vine cu `RecordsSnapshot`, citit prin `readRecords` | `import … from '#features/groups/…'` |
| Suma și repartizarea unei achitări | `#shared/domain/payment-allocations.mjs`, `#shared/format/payment-tenders-format.mjs` | citire directă din alt feature |
| Datele curente, luna selectată, stare de sesiune | selectori/obiecte injectate: `readRecords`, `readSelectedMonth`, `sessionState` | citire din `session` global |
| Cerere HTTP simplă vs. cerere cu revizie | `requestJson` (previzualizare) vs. `submitMutation` (import confirmat) | apel `fetch` direct |

## Structură

```
children/
├── README.md
├── domain/
│   ├── birthdays.mjs                             # buildBirthdayCalendar, listUpcomingBirthdays
│   └── birthdays.test.mjs
├── server/
│   ├── children-csv-import.mjs                   # parseCsvRows, previewChildrenCsvImport
│   ├── children-csv-import.test.mjs              # parsare + previzualizare, din tests/children-csv.test.mjs
│   ├── children.routes.mjs                       # ★ POST /api/children-csv-preview, /api/children-csv
│   └── children.routes.integration.test.mjs      # din tests/children-csv.test.mjs
└── web/
    ├── children-list.view.mjs                    # ★ lista „Copii”
    ├── child-profile.view.mjs                    # ★ fișa copilului (dialog)
    ├── child-editor-fields.mjs                   # câmpurile copilului în editorul generic
    ├── child-labels.mjs (+test)                  # formatParentContacts, statusBadgeClass
    └── children-csv-dialog.mjs                   # ★ import CSV
```

Formatarea plăților pe metode (`formatPaymentTenders`) este în `#shared/format/payment-tenders-format.mjs`, pentru că o folosesc și fișa copilului, și lista de achitări.

## Garanții

- Previzualizarea (`/api/children-csv-preview`) nu scrie nimic; întoarce doar raportul și revizia curentă.
- Importul (`/api/children-csv`) cere confirmarea exactă `IMPORT COPII`, rulează într-o singură tranzacție cu backup înainte (acțiunea `import-copii`) și scrie câte o intrare de audit (`import copii CSV`) per copil adăugat.
- Un CSV fără copii noi de importat (toți deja există) oprește operațiunea (400), fără backup inutil.
- `buildBirthdayCalendar`/`listUpcomingBirthdays` ignoră copiii arhivați și potrivesc ziua de naștere după lună+zi, nu după an.

## Teste

```
node --test "src/features/children/**/*.test.mjs"
```

- Domeniu: `buildBirthdayCalendar`, `listUpcomingBirthdays`.
- Web: `child-labels.test.mjs` (contactele părinților, clasa badge-ului de statut).
- Server: parsarea și previzualizarea CSV (`children-csv-import.test.mjs`, inclusiv testul pe fișierul real, sărit dacă lipsește); integrare HTTP cu `startTestApplication` (`children.routes.integration.test.mjs`).
