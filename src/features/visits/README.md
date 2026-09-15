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
| `createVisitsController({ elements, readRecords, readNow, submitMutation, showNotice, openEditor, enrolChild, openProfile, renderVisitsCount })` | controller: filtru, lună, zi selectată, butoane rapide de statut, pornirea înscrierii |
| `createVisitsListView({ elements: { head, table } })` | randare listă (antet sortabil, rânduri, acțiuni) |
| `createVisitsCalendarView({ elements: { calendar } })` | randare calendar (cip-uri pe statut, selecție de zi) |
| `visitEditorFields` | secțiuni editor: copil, părinți, vizita, dorințe, date medicale, post-vizită |
| `applyParsedVisitFields(formElement, parsed)` | scrie în formular câmpurile deja parsate din șablonul lipit din clipboard |
| `createVisitsApi({ submitMutation })` | `enrolChild(visitId, child)` → `POST /api/visits-enrol` |
| `buildChildPrefill(visit)` | precompletarea fișei copilului la „Înscrie copilul” (pur, din `domain/`) |

`createVisitRemindersController` (memento-uri, permisiuni de notificare) vine din task S5.

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` |
| `#shared/domain/record-schema.mjs` | `normalizeRecord`, `validateState`, `stripSensitiveFields`, `VISIT_STATUSES` |
| `#shared/contracts/record-types.mjs` | `RecordsSnapshot`, `RecordByType`, `Visit` |
| `domain/visit-status.mjs` (pur) | `allowedNextStatuses`, `applyVisitStatus`, `rescheduleVisit` |
| `domain/visit-statistics.mjs` (pur) | `summarizeVisitFunnel`, `countVisitsForDays` |
| `domain/visit-child-prefill.mjs` (pur) | `buildChildPrefill` |
| `domain/visit-paste-template.mjs` (pur) | `parseVisitPasteTemplate` — șablonul lipit din clipboard la creare |
| `#shared/format/text-search.mjs` | `normalizeSearchText` — potrivire etichete/grupă fără diacritice |
| `#shared/domain/month-grid.mjs` (pur, S0) | `buildMonthGrid` |
| `#shared/ui/month-calendar.mjs` (UI, S0) | `monthCalendarMarkup` |
| `#shared/ui/record-list-sort.mjs`, `#shared/ui/record-list-search.mjs`, `#shared/ui/record-actions.mjs` | listă: antet, sortare, căutare, acțiuni |

## Consumatori

Server: `createApplication` în `create-application.mjs`, la pornire; `app/` compose-features.

Client: `app/web/compose-features.mjs` leagă controller-ul, view-urile și memoria reminders.

## Structură

```
visits/
├── README.md
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── visit-status.mjs             # ★ tranzițiile permise și aplicarea unui statut
│   ├── visit-status.test.mjs
│   ├── visit-statistics.mjs         # ★ pâlnie (summarizeVisitFunnel) și vizitele de azi/mâine
│   ├── visit-statistics.test.mjs
│   ├── visit-reminders.mjs          # ★ memento-uri de notificat (S5)
│   ├── visit-reminders.test.mjs
│   ├── visit-health-notes.mjs       # ★ expirarea datelor medicale la 12 luni
│   ├── visit-health-notes.test.mjs
│   ├── visit-child-prefill.mjs      # ★ precompletarea fișei copilului la înscriere
│   ├── visit-child-prefill.test.mjs
│   ├── visit-paste-template.mjs     # ★ parsarea șablonului lipit din clipboard (creare vizită)
│   └── visit-paste-template.test.mjs
├── server/                          # task S3
└── web/
    ├── visits.api.mjs               # `enrolChild`
    ├── visits.controller.mjs        # ★ stare, filtre, deschidere editor, butoane rapide
    ├── visits.controller.test.mjs
    ├── visits-list.view.mjs         # randare cu `recordActions`
    ├── visits-calendar.view.mjs     # randare calendar + cip-uri
    ├── visit-labels.mjs             # clasele de badge/cip după statut
    ├── visit-editor-fields.mjs      # ★ secțiuni editor (pur; precompletat la înrolare)
    └── visit-reminders.controller.mjs # memento-uri și permisiuni notificări (S5)
```

## Decizii

Conform designului din `docs/superpowers/specs/2026-09-15-visits-module-design.md`, §2–8.
