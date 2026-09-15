# visits

Clinică de admisii: calendar al vizitelor, urmărire statut (programată → efectuată → înscris/renunțat), înrolare directă copil din vizită, notificări pe zi și pe oră.

Modul **dependent** de `children` (la înrolare, copilul creat se salvează), de `audit-log` (tranzacție și istoric), și folosește portul `runRevisionTransaction` din `core`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createVisitsService({ recordRepository, runRevisionTransaction })` | `enrolChild` |
| `createVisitsRoutes({ visitsService, runRevisionTransaction })` | `POST /api/visits-enrol` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createVisitsController({ readRecords, readNow, readSelectedMonth, eventBus, renderCycle, sessionState, submitMutation, showNotice, openEditor, openProfile, elements })` | controller: filtru, lună, zi selectată, editor, notificări |
| `createVisitsListView({ container })` | randare listă |
| `createVisitsCalendarView({ container })` | randare calendar |
| `visitEditorFields` | secțiuni editor: copil, părinți, vizita, dorințe, date medicale, post-vizită |
| `createVisitRemindersController({ readRecords, readNow, notifications, rememberedKeys, eventBus, elements, goToVisits })` | memento pe zi și oră |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` |
| `#shared/domain/record-schema.mjs` | `normalizeRecord`, `validateState`, `stripSensitiveFields` |
| `#shared/contracts/record-types.mjs` | `RecordsSnapshot`, `RecordByType` |
| `#shared/domain/visit-status.mjs` (pur) | `allowedNextStatuses`, `applyVisitStatus`, `rescheduleVisit` |
| `#shared/domain/visit-summary.mjs` (pur) | `summarizeVisitFunnel`, `countVisitsForDays`, `selectDueReminders`, `selectExpiredHealthNotes` |
| `#shared/domain/month-grid.mjs` (pur, S0) | `buildMonthGrid` |
| `#shared/ui/month-calendar.mjs` (UI, S0) | `monthCalendarMarkup` |

## Consumatori

Server: `createApplication` în `create-application.mjs`, la pornire; `app/` compose-features.

Client: `app/web/compose-features.mjs` leagă controller-ul, view-urile și memoria reminders.

## Structură

```
visits/
├── README.md
├── visits.types.d.mts             # Visit, VisitStatus, VisitsSnapshot, dependențele rutelor și controllerului
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── visit-status.mjs           # ★ tranzițiile permise și aplicarea unui statut
│   ├── visit-status.test.mjs
│   ├── visit-summary.mjs          # ★ pâlnie, memento-uri, expirsare date medicale
│   └── visit-summary.test.mjs
├── server/
│   ├── visits.service.mjs         # ★ înrolare copil, expirare date medicale
│   ├── visits.service.test.mjs
│   ├── visits.routes.mjs
│   └── visits.routes.integration.test.mjs
└── web/
    ├── visits.api.mjs             # `enrolChild`
    ├── visits.controller.mjs       # ★ stare, filtre, deschidere editor, butoane rapide
    ├── visits.controller.test.mjs
    ├── visits-list.view.mjs        # randare cu `recordActions`
    ├── visits-calendar.view.mjs    # randare calendar + cip-uri
    ├── visit-editor-fields.mjs     # ★ secțiuni editor (pur; precompletat la înrolare)
    ├── visit-reminders.controller.mjs # ★ memento-uri și permisiuni notificări
    ├── visit-reminders.controller.test.mjs
    └── test-support/
        └── visit-fixtures.mjs
```

## Decizii

Conform designului din `docs/superpowers/specs/2026-09-15-visits-module-design.md`, §2–8.
