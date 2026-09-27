# sms-notify

Trimiterea manuală de SMS-uri de reamintire a restanțelor (și a altor notificări) prin sms.md, cu jurnal per mesaj, șabloane cu variabile și stare de livrare urmărită după trimitere. Nu există trimitere automată: fiecare lot pornește dintr-un ecran (situația plăților, în P1) unde operatorul alege destinatarii și apasă „Trimite”. Configurarea (token, expeditor, limită lunară) și starea contului (sold, ultima eroare) apar în ecranul „Notificări”, alături de Telegram.

Modulul **independent**: nu depinde de alt feature. Rândurile de jurnal folosite pentru un lot (copil, obligație, telefon) sunt pregătite de apelant (`planSmsBatch`, `domain/sms-batch.mjs`) din date deja citite de acesta; `sms-notify` nu importă `children`, `visits` sau `billing`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createSmsService({ fetch })` | `sendMessage`, `getMessage`, `getBalance`, `listActiveSenders`, `classifySmsFailure` — clientul sms.md |
| `createSmsSendService({ smsService, smsLogRepository, smsTemplateRepository, readConfig, auditTrail, now?, sleep? })` | `sendBatch`, `sendTest`, `refreshDeliveryStatuses` — orchestrarea unui lot: jurnal-înainte-de-trimitere, limită lunară, sold |
| `createSmsRoutes({ database, dataDirectory, smsService, auditTrail, now?, sleep? })` | cele 10 rute `/api/sms-*` din tabelul de mai jos; construiește intern repository-urile și serviciul de trimitere |
| `createSmsLogRepository(database)` | `insert`, `update`, `find`, `monthlyStats`, `lastUnitCost`, `lastNotifiedByChild`, `pendingDelivery`, `markUnknownOlderThan`, `expireOldEntries` |
| `createSmsTemplateRepository(database, { now? })` | `list`, `find`, `findDefault`, `save`, `setDefault`, `remove` — seedează șablonul implicit la prima deschidere |
| `readSmsConfig(dataDirectory)` / `writeSmsConfig(...)` / `removeSmsConfig(...)` | fișier `sms.json`: `{ token, sender, monthlyLimit } \| null` |

| Rută | Corp | 200 | 400 |
| --- | --- | --- | --- |
| `GET /api/sms-status` | — | `SmsStatus` | — |
| `POST /api/sms-connect` | `{ token?, sender, monthlyLimit }` | `{ ok, status }` | token/expeditor/limită invalide, eroare clasificată la verificare, expeditor inactiv |
| `POST /api/sms-disconnect` | `{}` | `{ ok, status }` | — |
| `POST /api/sms-test` | `{ phone }` | `{ ok, status, entry }` | neconectat, telefon invalid, eroare clasificată |
| `POST /api/sms-send` | `SmsSendRequest` | `SmsSendResult` | neconectat, mesaj invalid, limită lunară, sold insuficient |
| `GET /api/sms-last-notified` | — | `Record<childId, SmsLastNotified>` | — |
| `POST /api/sms-refresh-statuses` | `{}` | `{ updated, entries }` | neconectat |
| `GET /api/sms-templates` | — | `{ templates: SmsTemplate[] }` | — |
| `POST /api/sms-template-save` | `SmsTemplateInput` | `{ ok, template }` | nume/text invalide, variabilă necunoscută, `id` inexistent (409) |
| `POST /api/sms-template-delete` | `{ id }` | `{ ok }` | șablon implicit, `id` inexistent (409) |

`GET /api/sms-log` (istoric complet, filtrabil) e P3 — nu există încă.

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `planSmsBatch({ rows, body, stripDiacritics, month })` | pregătește un lot: alege destinatarul per copil (`chooseSmsRecipient`), randează șablonul și exclude copiii fără telefon valid |
| `finalizeSmsText(text, stripDiacriticsEnabled)` | aplică „fără diacritice” înainte de numărare, apoi `countSmsSegments` |
| `chooseSmsRecipient(child)` | părintele 1, cu cădere pe părintele 2, primul cu telefon normalizabil |
| `estimateSmsCost(totalSegments, unitCost)` | estimarea de cost afișată în dialogul de trimitere (webapp, Faza 5) |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru validare, conflict (409) și erori clasificate |
| `#core/server/files/json-file.mjs`, `#core/server/files/remove-file-if-present.mjs` | citire/scriere atomică pentru `sms.json` |
| `#shared/domain/phone-number.mjs` | `normalizeMoldovanPhone` — validarea telefoanelor moldovenești |
| `#shared/domain/sms-template.mjs` | variabilele șablonului, randare, `findUnknownSmsVariables`, textul implicit |
| `#shared/domain/sms-segments.mjs` | numărarea caracterelor/segmentelor GSM-7 vs UCS-2 |
| `#shared/domain/calendar-month.mjs` | `shiftDays` pentru cutoff-ul de retenție |
| `#shared/format/strip-diacritics.mjs` | opțiunea „fără diacritice” din șablon |
| `#shared/contracts/audit-trail.mjs` | audit `configurare sms` și `șablon sms` |
| `node:sqlite`, `node:crypto` | tabelele `sms_log`/`sms_templates` (în `SCHEMA` din core, nu `records`), UUID pentru id-ul șablonului |
| `globalThis.fetch` (parametru) | apeluri către API-ul sms.md |

## Consumatori

Composition root-ul serverului (`create-application.mjs`) creează `smsService` cu `fetch` și îl injectează în `createSmsRoutes`, alături de `database` și `auditTrail`; expune și `expireSmsLog` (o a doua instanță de `createSmsLogRepository`, doar pentru sweep). `main.mjs` apelează `expireSmsLog()` la pornire, în același bloc `try` ca `expireHealthNotes`. Ecranul „Situația plăților” (webapp, Faza 5) va folosi `planSmsBatch` pentru a pregăti lotul din rândurile lui proprii (copil + obligație) și rutele `/api/sms-*` pentru trimitere; ecranul „Notificări” va folosi rutele de conectare/stare, iar tab-ul „Șabloane” din „Administrare” pe cele de șabloane.

## Structură

```
sms-notify/
├── README.md
├── sms-notify.types.d.mts              # SmsConfig, SmsTemplate, SmsLogEntry, SmsStatus, SmsSendRequest/Result, SmsBatchPlan…
├── index.server.mjs                    # barrel-ul server-ului
├── index.web.mjs                       # barrel-ul web-ului (domeniu, izomorf)
├── domain/
│   └── sms-batch.mjs (+ .test.mjs)     # chooseSmsRecipient, finalizeSmsText, estimateSmsCost, planSmsBatch
├── server/
│   ├── sms-config.repository.mjs (+ .test.mjs)     # sms.json, pe #core/server/files/json-file.mjs
│   ├── sms-log.repository.mjs (+ .test.mjs)        # tabelul sms_log
│   ├── sms-template.repository.mjs (+ .test.mjs)   # tabelul sms_templates, seed la deschidere
│   ├── sms.service.mjs (+ .test.mjs)               # clientul sms.md, classifySmsFailure
│   ├── sms-send.service.mjs (+ .test.mjs)          # sendBatch, sendTest, refreshDeliveryStatuses
│   └── sms.routes.mjs (+ .integration.test.mjs)    # cele 10 rute /api/sms-*
└── test-support/
    └── fake-sms-api.mjs                # fetch fals: /v3/messages, /v3/messages/:id, /v3/account/balance, /v3/sender-aliases
```

## Decizii

- **Token în `sms.json`, nu în setări.** Ca la Telegram: secretul nu intră în backupuri, iar restaurarea pe un calculator nou cere re-lipirea lui.
- **Tabelele `sms_log`/`sms_templates` în `SCHEMA` din core, nu în `records`.** Nu sunt entități versionate prin `runRevisionTransaction` (nu au revizie, nu apar în export/import V5); jurnalul de trimiteri și șabloanele au propriile tabele SQLite, cu propriile migrații.
- **Jurnal-înainte-de-trimitere (log-before-send).** Rândul se inserează cu `status:'failed'` chiar înainte de apelul către sms.md, apoi se actualizează la succes; un eșec de proces între cele două nu lasă un mesaj trimis fără urmă în jurnal.
- **Fără trimitere automată.** Fiecare lot pornește explicit dintr-un ecran; nu există sarcină programată sau proces de fond care trimite SMS-uri, spre diferență de rezumatul zilnic Telegram.
- **Limita lunară e opțională și globală.** `monthlyLimit: null` = fără limită; altfel un număr întreg 1..5000, contor pe toată instalarea, nu per filială — nu există concept de filială separată în acest modul.
- **Un 429 (rate limit) sau altă eroare de cont oprește lotul.** Restul mesajelor rămân `skipped`, fără rând nou în jurnal (nu s-a încercat trimiterea); un eșec de destinatar (telefon/text refuzat) marchează doar rândul lui `failed` și lotul continuă.
- **Retenție de 365 de zile prin `expireSmsLog` la pornire.** `expireOldEntries` golește `text`/`phone` pe rândurile mai vechi (păstrează statisticile lunare și starea de livrare), apelat din `main.mjs` la fiecare pornire a serverului, ca la `expireHealthNotes`.
- **`lastError` și soldul, doar în memorie.** Afișare-only, cu un singur scriitor (acest proces server); nu există fișier de stare separat ca la Telegram (acolo un al doilea proces — sarcina programată — scrie starea). `GET /api/sms-status` reîmprospătează soldul cu un apel `getBalance`; celelalte rute refolosesc valoarea din memorie.
- **Nedocumentat (spec §4.6), plus forma exact a expeditorilor.** Cazuri neconfirmate din documentația OpenAPI a sms.md citită pe 2026-09-26: formatul exact al câmpului `status` per expeditor (obiect `{id,name}` sau numeric — `listActiveSenders` acceptă ambele forme); comportamentul exact la revocarea unui token folosit deja într-un lot în curs; paginarea `GET /v3/sender-aliases` peste numărul implicit de rezultate.

## Teste

```
node --test "src/features/sms-notify/**/*.test.mjs"
```

- **Domeniu (`sms-batch`):** `chooseSmsRecipient` cu cădere pe părintele 2; `finalizeSmsText` aplică „fără diacritice” înainte de numărare; `planSmsBatch` exclude copiii fără telefon valid și însumează segmentele.
- **Repository-uri:** `sms-config` — fișier lipsă → `null`, scriere atomică, mascarea tokenului; `sms-log` — insert/update pe câmp necunoscut aruncă, statistici lunare pe interval local, `lastNotifiedByChild` ia primul rând per copil, `pendingDelivery`/`markUnknownOlderThan`/`expireOldEntries` pe cutoff; `sms-template` — seed o singură dată (INSERT OR IGNORE), un singur șablon implicit după `save({isDefault:true})`.
- **Serviciu (`sms.service`):** `classifySmsFailure` pe toate codurile din §4.3 (token invalid, scope, sold, validare telefon/text/expeditor, 429, 5xx, rețea, timeout); `sendMessage`/`getBalance`/`listActiveSenders` peste `fake-sms-api`.
- **Orchestrare (`sms-send.service`):** lot de 3 cu pauză între cereri și audit fără telefon/token; eroare de destinatar marchează rândul și continuă; 402/429 opresc lotul, restul `skipped` fără rând nou; limită lunară și sold insuficient resping cu 400 fără apel; eșecul rețelei la `getBalance` nu blochează lotul; `sendTest` scrie un rând `source:'test'`; `refreshDeliveryStatuses` mapează `Delivered`/`Undelivered`/`Queued`, ignoră rândurile mai vechi de 48h, eșecul rețelei la prima interogare lasă rândurile neschimbate.
- **Rute (`sms.routes`):** integrare cu `fake-sms-api` — conectare cu token gol/eronat/expeditor inactiv → 400 fără fișier; conectare reușită scrie `sms.json` și auditează fără token; reconectare cu token gol păstrează tokenul; trimitere fără conectare → 400; lot reușit actualizează `sentThisMonth`; `sms-test` scrie rândul; `last-notified` conține copilul; `refresh-statuses` actualizează la `delivered`; validarea șabloanelor (variabilă necunoscută, `stripDiacritics` implicit `true`); ștergerea șablonului implicit → 400.
- **Compoziție (`create-application`/`main`):** `GET /api/sms-status` neconfigurat nu face niciun apel de rețea; `app.expireSmsLog` expiră rândurile vechi.
