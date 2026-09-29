# attendance

Evidența prezenței (spec `docs/design/screens/19-prezenta.md`): pentru fiecare copil și zi, un marcaj `present`/`absent`/`excused`, cu motiv doar pentru `excused`. Prezența e doar evidență — nu modifică taxa, `obligation()` sau „Situația plăților”. Ecranul web are două moduri: **Ziua** (18a, plăci per copil, ciclu Prezent → Absent → Motivat → nemarcat) și **Luna** (18b, grilă copil × zi pentru o singură grupă, tipărire A4 și export .xlsx). Fișa copilului are o secțiune „Prezența”, doar afișare.

Modulul **independent**: nu importă alt feature. Regulile de zi lucrătoare vin din `#shared/domain/holidays-md.mjs`, singura dependență de domeniu partajat.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createAttendanceRoutes({ database, recordRepository, now?, today? })` | cele două rute din tabelul de mai jos |
| `createAttendanceRepository(database, { now? })` | `listByDate`, `listByMonth`, `applyChanges` — o singură tranzacție SQLite per lot |

| Rută | Corp | 200 | 400 |
| --- | --- | --- | --- |
| `GET /api/attendance?date=` | — | `{ entries }` | zi invalidă |
| `GET /api/attendance?month=[&groupId=][&childId=]` | — | `{ entries }` | lună invalidă; nici `date`, nici `month` |
| `POST /api/attendance` | `{ changes: AttendanceChange[] }` | `{ ok, saved, removed }` | copil inexistent, zi viitoare, stare necunoscută, prea multe schimbări — nimic din lot nu se salvează |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `nextAttendanceStatus(current)` | ciclul prezent → absent → motivat → nemarcat → prezent |
| `isChildEnrolledOn(child, date)` | neafirmat, arhivat, înscris după zi sau retras înainte de ea |
| `summarizeDay(childIds, entriesByChild)` | `{ present, absent, excused, unmarked }` — hartă cheie=`childId`, o singură zi |
| `normalizeAttendanceChange(change)` | golește/taie motivul (200 caractere), doar pentru `excused` |
| `attendanceKey(childId, date)` | `${childId}|${date}` — cheia folosită de hook-ul web (multi-zi) |
| `monthDates(month)`, `summarizeMonth({ children, month, entries, todayStr })` | grila lunii: `dates`, `rows` (cu `cells`, `presentDays`, `workingDays`), `presentPerDay`, `workingDays` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru validare |
| `#shared/domain/calendar-month.mjs` | `dateOK`, `monthOK`, `today()` |
| `#shared/domain/holidays-md.mjs` | `isWorkingDay` — weekend + sărbători legale MD |
| `node:sqlite` | tabelul `attendance` (în `SCHEMA` din core, nu `records`) |

Niciun import din `tuition-obligation.mjs`, `billing` sau `fee-setup` (criteriul de acceptare 4 al spec-ului; verificat prin grep, vezi „Teste”).

## Consumatori

`create-application.mjs` conectează `createAttendanceRoutes({ database, recordRepository })`. În `webapp/`: `webapp/src/shared/attendance/` ține hook-ul partajat (`useAttendance`) și componenta `AttendanceDot`, consumate de `webapp/src/features/attendance/` (ecranul „Prezența”) și de `webapp/src/features/children/ChildAttendanceSection.tsx` (fișa copilului) — nicio graniță de feature încălcată, ambele importă doar din `@shared/attendance` și din `#features/attendance/index.web.mjs`.

## Structură

```
attendance/
├── README.md
├── attendance.types.d.mts              # AttendanceStatus, AttendanceEntry, AttendanceChange, DayCellKind…
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── attendance-rules.mjs (+ .test.mjs)   # ciclul, înscrierea, summarizeDay, normalizare
│   └── attendance-month.mjs (+ .test.mjs)   # monthDates, summarizeMonth
└── server/
    ├── attendance.repository.mjs (+ .test.mjs)              # tabelul attendance
    ├── attendance.routes.mjs                                 # /api/attendance
    └── attendance.routes.integration.test.mjs
```

## Decizii

1. **Tabel dedicat `attendance` în `SCHEMA` din core, nu un nou tip de `records`.** Volumul (copii × zile lucrătoare × ani) ar încărca `readSnapshot()` și fiecare `RevisionEnvelope` cu tot istoricul; `sms_log` a stabilit precedentul unui tabel de feature în afara `records`.
2. **Scrierile nu trec prin `runRevisionTransaction`.** Spec-ul cere „la conflict pe aceeași zi câștigă ultima modificare, fără dialog” — opusul reviziei versionate. Un clic e idempotent (upsert spre o stare țintă), deci reluarea cu `requestId` e inutilă, iar `backupBefore` e irelevant (nimic ireversibil — următorul clic anulează). Repository-ul rulează propriul `BEGIN IMMEDIATE … COMMIT`.
3. **Niciun rând de audit per clic.** ~100 clicuri/zi ar îneca istoricul real din „Istoric”. `attendance.updated_at` e traseul. O intrare `auditTrail.recordChange(...)` per lot `POST` e adăugată ulterior, dacă e nevoie.
4. **Backup-urile includ `attendance`, restaurarea nu o modifică.** `backup()` e `VACUUM INTO` a întregului fișier; `/api/restore` apelează `replaceAllRecords`, care rescrie doar `records` — `attendance` rămâne neschimbată, ca `sms_log`.
5. **Nicio legătură cu taxa.** Modulul importă doar `#shared/domain/calendar-month.mjs`, `#shared/domain/holidays-md.mjs`, `#core/server/errors/domain-error.mjs`; niciodată `tuition-obligation.mjs`, `billing` sau `fee-setup`. `obligation()` nu e modificat.
6. **Filiale și sincronizare, în afara scopului acestei livrări** (decizie provizorie, `docs/design/RASPUNSURI.md` punctul 13): fără `branch_id`, fără coloane de sincronizare sau metadate de conflict, deși spec-ul textual menționează „per filială” — deferat la pașii 12–15 din plan.
7. **Rândurile orfane sunt tolerate.** Un copil șters definitiv își lasă rândurile din `attendance`; interfața randează doar copiii prezenți în `records`, deci rândurile orfane nu se văd și nu se numără. Nicio ștergere periodică în această livrare.

## Teste

```
node --test "src/features/attendance/**/*.test.mjs"
cd webapp && npx vitest run src/features/attendance src/shared/attendance src/features/children/ChildAttendanceSection.test.tsx
```

- **Domeniu (`attendance-rules`):** ciclul stării; înscrierea (arhivat/după zi/retras înainte de ea/necunoscut=înscris); `summarizeDay` numără nemarcații; normalizarea motivului.
- **Domeniu (`attendance-month`):** off/future/none per celulă; `workingDays`/`presentDays` per copil; `presentPerDay` null în zilele off/viitoare.
- **Repository:** upsert fără duplicare; `status:null` șterge; `listByMonth` filtrat pe copii; o eroare la mijlocul lotului anulează totul (tranzacție atomică).
- **Rute (integrare):** POST + GET pe zi, ultimul scris câștigă; `status:null` șterge; motivul doar pentru `excused`; zi viitoare/copil inexistent/stare necunoscută → 400, nimic din lot nu se salvează; `GET` pe lună cu `groupId`/`childId`/`groupId=none`; `GET` fără `date` și fără `month` → 400.
- **Webapp (`useAttendance`):** încărcare indexată după `childId|date`; debounce de 400 ms cu ultima schimbare per copil·zi; un POST eșuat reîncarcă de la server; `query: null` nu face nicio cerere.
- **Webapp (`AttendancePage`):** ciclul din 18a trimite POST-ul debounce-uit; popover-ul „Motivat” trimite motivul în același POST; istoricul zilei + „↶ Anulează”/„Anulează până aici”/„Anulează tot” (A3c, fără marcare în masă — decizia 29.09); cardurile numără pe toate grupele; copiii arhivați/înscriși după zi nu apar; ziua viitoare e blocată; modul Luna arată grila și clic pe celulă schimbă starea.
