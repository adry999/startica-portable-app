# visits

Vizitele de admitere ale familiilor înainte de a deveni copii înscriși: calendar lunar, listă filtrabilă, pâlnie de statistici (programate → efectuate → înscriși/renunțat), reprogramare, șablon lipit din clipboard la creare, memento-uri de notificare pe zi și pe oră, și înrolarea directă a unui copil dintr-o vizită.

Modul **dependent** de `children` (la înscriere, fișa copilului nou se salvează), de `audit-log` (tranzacție și istoric), și folosește portul `runRevisionTransaction` din `core`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createVisitsService({ recordRepository, auditTrail, runRevisionTransaction })` | `{ enrolChild, expireHealthNotes }` |
| `createVisitsRoutes({ visitsService })` | `POST /api/visits-enrol` |
| `countVisitsForDays(visits, todayStr, horizonDays?)` | vizitele programate de azi + un orizont (implicit 1 = azi și mâine), pur, din `domain/` — folosit și de digest-ul Telegram |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `countVisitsForDays(visits, todayStr, horizonDays?)` | folosit și de Dashboard (`summarizeUpcomingVisits`) |
| `VISIT_PASTE_TEMPLATE` | textul gol al șablonului de copiat pentru operator |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` |
| `#shared/domain/record-schema.mjs` | `normalizeRecord`, `VISIT_STATUSES` |
| `#shared/domain/record-integrity.mjs` | `assertRecordReferencesExist` la înscriere |
| `#shared/domain/calendar-month.mjs` | `today`, `daysBetween`, `shiftDays`, `isoDateOf` |
| `#shared/domain/notification-preferences.mjs` | `DEFAULT_NOTIFICATION_PREFERENCES` — implicit pentru `selectDueReminders`/`createVisitRemindersController` când nimeni nu injectează `readPreferences` |
| `#shared/domain/month-grid.mjs` | `buildMonthGrid` pentru calendar |
| `#shared/domain/record-labels.mjs` | `groupNameOf` |
| `#shared/contracts/record-types.mjs` | `Visit`, `VisitStatus`, `RecordsSnapshot`, `Child`, `Group` (tipuri) |
| `#shared/contracts/domain-events.mjs` | `DomainEvent.RecordsReloaded` (re-verifică memento-urile) |
| `#shared/format/html-escape.mjs`, `date-format.mjs`, `parent-contacts-format.mjs`, `text-search.mjs` | randare listă/calendar/detaliu, potrivire etichete/nume fără diacritice |
| `#shared/ui/form-fields.mjs` | `textFieldMarkup`, `selectFieldMarkup`, `textareaFieldMarkup`, `formSectionMarkup`, `groupOptionsMarkup` |
| `#shared/ui/copy-to-clipboard.mjs` | copierea șablonului |
| `#shared/ui/month-calendar.mjs` | `monthCalendarMarkup` |
| `#shared/ui/record-actions.mjs`, `record-list-sort.mjs`, `record-list-search.mjs` | listă: acțiuni, antet sortabil, căutare |

## Consumatori

Server: `createApplication` din `create-application.mjs` (rute și serviciu); `main.mjs` apelează `expireHealthNotes` la pornire; `telegram-digest.mjs` folosește `countVisitsForDays` pentru rezumatul zilnic.

## Structură

```
visits/
├── README.md
├── index.server.mjs
├── index.web.mjs
├── visits.types.d.mts               # tipurile contractului serviciului și rutei
├── domain/
│   ├── visit-status.mjs             # ★ tranzițiile permise, aplicarea unui statut, reprogramarea
│   ├── visit-status.test.mjs
│   ├── visit-statistics.mjs         # ★ pâlnie (summarizeVisitFunnel) și vizitele de azi/mâine
│   ├── visit-statistics.test.mjs
│   ├── visit-reminders.mjs          # ★ memento-uri de notificat
│   ├── visit-reminders.test.mjs
│   ├── visit-health-notes.mjs       # ★ expirarea datelor medicale la 12 luni
│   ├── visit-health-notes.test.mjs
│   ├── visit-child-prefill.mjs      # ★ precompletarea fișei copilului la înscriere
│   ├── visit-child-prefill.test.mjs
│   ├── visit-paste-template.mjs     # ★ parsarea/generarea șablonului lipit din clipboard
│   └── visit-paste-template.test.mjs
├── server/
│   ├── visits.service.mjs           # enrolChild, expireHealthNotes
│   ├── visits.service.test.mjs
│   ├── visits.routes.mjs            # POST /api/visits-enrol
│   └── visits.routes.integration.test.mjs
└── test-support/
    └── visit-record-fixtures.mjs    # scheduledVisit, newChildInput, createVisitsRecords
```

## Decizii

Conform designului din `docs/superpowers/specs/2026-09-15-visits-module-design.md`.

- Statutul „Înscris” este pus doar de ruta de înscriere (`enrolChild`); editorul de vizite nu îl oferă niciodată ca opțiune.
- Reprogramarea (schimbarea datei sau orei) readuce vizita la statutul „Programată” și scrie o intrare nouă în `history`, din orice statut în afară de „Înscris”.
- Datele medicale (`healthNotes`) ale vizitelor și ale copiilor arhivați expiră automat la 12 luni de la ultima schimbare de statut, respectiv de la arhivare; verificarea rulează o dată, la pornirea serverului.
- Calendarul lunii afișate ignoră întotdeauna filtrele listei de mai jos (căutare, statut, arhivare) — arată toate vizitele nearhivate ale lunii.
- Șablonul lipit din clipboard este disponibil doar la crearea unei vizite noi, nu și la editare.
