# payment-assignment

Coada „Asociere achitări” conține achitările importate fără copil. Fiecare are sugestii ordonate după indiciile din sursă, iar operatorul poate salva în masă asocierile alese. Nimic nu se asociază automat.

Modul **dependent**: are nevoie de istoric, de regula obligației lunare, de tranzacția cu revizie și de datele curente. Le primește prin shared kernel, porturi și evenimente, fără să importe alt feature.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createPaymentAssignmentService({ recordRepository, auditTrail, runRevisionTransaction })` | `assignPaymentsToChildren(request)` |
| `createPaymentAssignmentRoutes({ paymentAssignmentService })` | `POST /api/payments-assign`, cu corpul neschimbat: `{ assignments: [{ id, childId }], revision, requestId }` |

Ecranul „Asociere achitări” e randat de React, în `webapp/src/features/assign/` (`AssignPage.tsx`, `useAssign.ts`) — consumă direct `POST /api/payments-assign` și funcțiile din `domain/` (`listUnassignedPayments`, `measureAssignmentRisk`, `findUnassignedPaymentHintsByChild`), fără un strat `web/` propriu; vechiul `index.web.mjs`/`web/*` (controller, view, api DOM) a fost șters odată cu restul UI-ului vanilla, înlocuit de cutover-ul React din 24.09.2026.

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Scriere în istoric | port `AuditTrail`, injectat de `app/` și implementat de `audit-log` | `import … from '#features/audit-log/…'` |
| Obligația lunii, pentru risc | shared kernel `#shared/domain/tuition-obligation.mjs` | import din `billing` |
| Revizie, idempotență, backup înainte | port `RunRevisionTransaction` din `core` | acces direct la SQLite |
| Datele curente și luna selectată | selectori injectați: `readRecords`, `readSelectedMonth` | citire din `session` global |
| Anunț după salvare | eveniment `payments.assigned` | apel direct în `billing` sau `dashboard` |
| Reîmprospătare | React re-randează la orice schimbare de `records`/`month` din sesiune | listener global |
| Indiciu în „De notificat” | `webapp/src/features/notify/useNotify.ts` importă direct `findUnassignedPaymentHintsByChild` | port separat prin `app/` |

## Structură

```
payment-assignment/
├── README.md
├── payment-assignment.types.d.mts
├── index.server.mjs
├── domain/
│   ├── payment-name-matching.mjs            # suggestChildren
│   ├── unassigned-payment-queue.mjs         # listUnassignedPayments
│   ├── unassigned-payment-risk.mjs          # measureAssignmentRisk
│   ├── unassigned-payment-hints.mjs         # findUnassignedPaymentHintsByChild
│   └── *.test.mjs
├── server/
│   ├── payment-assignment.service.mjs       # ★ validare și scriere în tranzacție
│   ├── payment-assignment.service.test.mjs
│   └── payment-assignment.routes.mjs
└── test-support/
    └── assignment-fixtures.mjs
```

`src/app/server/create-application.mjs` creează service-ul cu `recordRepository`, `auditTrail` (din `audit-log`) și `runRevisionTransaction`, și înregistrează rutele. Ecranul React (`webapp/src/features/assign/`) le consumă prin `POST /api/payments-assign` și import direct din `domain/`.

## Garanții

- Verificările pe fiecare achitare rulează **în tranzacție, după controlul de reluare**. O cerere repetată după o cădere de rețea primește rezultatul inițial, nu eroarea „are deja un copil”.
- O achitare deja asociată nu se schimbă prin acest flux (409). Validarea listei se face înainte de tranzacție (400).
- Completarea automată alege doar un candidat **unic** cu nume potrivit și nu suprascrie o alegere manuală.
- La o cădere de rețea, selecțiile rămân pentru reluare. Un dublu click pe „Salvează” nu dublează cererea.
- Sugestiile se calculează doar pentru ecranul vizibil. Contorul din navigație se actualizează mereu.

## Teste

```
node --test "src/features/payment-assignment/**/*.test.mjs"
```

- Service: `createInMemoryRecordRepository`, `createRecordingAuditTrail`, `createImmediateRevisionTransaction` din `tests/support`.
- Controller: event bus real, fixture-uri din `test-support/` și `submitAssignments` fals.
