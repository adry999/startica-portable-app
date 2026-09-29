# Audit de cod — 29 septembrie 2026 (`master-v2`)

Branch `master-v2`, HEAD `e94c7e3` (arbore curat; auditul a rulat într-un worktree adus la același commit). Audit **read-only**, concentrat pe ce a intrat în ultimele două zile: modulul Bazin (`src/features/pool/`, `webapp/src/features/pool/`, `webapp/src/shared/pool/`), motorul de sincronizare + Task 9-12 (`src/features/sync/`, `webapp/src/features/conflicts/`, fila Sincronizare din `webapp/src/features/backup/`), migrarea `Child.notes` string → `ChildNote[]`, granițele între module, convențiile din `project-conventions/SKILL.md` și starea reală a suitelor.

Metodă: citirea integrală a fișierelor din scop (pool: toate cele 8 surse + hook-ul `usePool.ts`; sync: `sync-engine.service`, `sync-outbox.repository`, `change-applier`, `snapshot-io`, `sync-connect.service/routes`, `sync-conflicts.repository/routes`, `conflict-diff`, `sync.routes`, `outbox-recording-repository`; webapp: `useConflicts`, `ConflictsPage`, `ConflictDetail`, `useSyncSettings`, `SyncSettings`, `ConnectServerForm`, `DevicesList`, `PairingCodeCard`, `useSyncStatus`; plus `create-branch-context.mjs`, `record-schema.mjs` §children, `003-child-notes-list.mjs`, `record-snapshot-upgrade.mjs`, toți consumatorii `.notes` din `src/` și `webapp/src/`), apoi **scripturi de verificare** rulate din scratchpad (import prin URL absolut, baze temporare) pentru fiecare suspiciune care contează. Nu repetă ce e deja închis în `docs/design/COADA-DE-LUCRU.md` (seriile A-E din auditul de pe 28.09 sunt confirmate reparate; nu le-am regăsit).

Etichete: **[verificat]** = reprodus cu script sau test rulat; **[citire]** = dedus din cod, nereprodus.

## Contoare

| Severitate | Număr |
| ---------- | ----- |
| critic     | 2     |
| major      | 8     |
| minor      | 10    |

Cele două critice sunt fluxuri complet rupte azi, nu cazuri-limită: **C-1** (nicio vizită nu mai poate fi transformată în fișă de copil) și **B-1** (al doilea calculator nu se mai poate conecta după ce pe server a ajuns prezență sau bazin).

---

## A. Bazin (`src/features/pool/`, `webapp/src/features/pool/`)

Modulul e coerent în nucleu (capacitate, idempotența închiderii, aceeași formulă pentru antrenor pe card și la închidere — toate cu test), dar cusăturile dintre cele trei sesiuni (săptămâna, luna/închiderea, bonul) nu împart aceeași regulă pentru „ce e o ședință”.

### A-1 · major · Săptămâna arată și lasă marcate ședințe în zile de sărbătoare legală, pe care Luna și închiderea nu le numără [verificat]

`src/features/pool/server/pool.routes.mjs:76,100-123` (`getWeek`: `weekOf` + filtrare pe `weekday`/interval, fără `isWorkingDay`) vs `src/features/pool/domain/pool-schedule.mjs:18-25` (`expandBooking` exclude zilele nelucrătoare — comentariul: „nu produce o ședință fantomă de Anul Nou”), folosit de `childMonth`, `coachPayForMonth`, `countUnmarkedPastSessions` și de bon. Script: `weekOf('2026-12-25')` include 25 dec; `expandBooking` pentru vinerea din decembrie 2026 → `[04, 11, 18]`.

Scenariu: vineri 25 decembrie 2026 (Crăciun, sărbătoare legală): grila arată copiii programați, operatorul marchează „Prezent”, `postSessions` (`:174-188`) acceptă (validează doar data și „viitor doar anulare”), cardurile săptămânii numără prezența. La Luna: ședința nu apare la copil (nu e taxată), nu intră în plata antrenorului, bonul n-o listează. Bani pierduți dacă bazinul chiar lucrează de sărbători, prezență-fantomă dacă nu. Precedentul Prezenței e clar: `attendance-month.mjs:22` marchează zilele nelucrătoare `off`. Fix: o singură regulă, în domeniu — `getWeek` dă `entries: []` (sau `off: true`) când `!isWorkingDay(date)` și `postSessions` refuză; sau, dacă bazinul lucrează de sărbători, scoate filtrul din `expandBooking`. De decis cu utilizatorul, nu de ghicit.

### A-2 · major · Bonul de 58 mm tipărește „N ședințe × preț = suma marcată până azi” — la început de lună, 0 lei [citire, confirmat de test]

`webapp/src/features/pool/PoolReceiptPage.tsx:48-56,80` (`sessions` = toate zilele din `expandBooking`, `monthlyTotal = row.amount`), `src/features/pool/domain/pool-month.mjs:33-34` (`amount` = doar prezențele (+ absențele) **deja marcate**), `PoolReceiptLabel.tsx:71`. Testul `PoolReceiptPage.test.tsx:94` fixează chiar egalitatea falsă: `5 ședințe × 150 lei = 600 lei`.

Scenariu: bonul e biletul lunii (zilele de venit, „ce aduce copilul”, spec 25 §24c), se dă părintelui la început de lună → „8 ședințe × 150 lei = 0 lei”; la mijloc de lună, suma e parțială și nu corespunde cu înmulțirea de pe același rând. Fix: total = (ședințe listate − punctate) × preț (aceeași previzualizare ca în 22b), eventual un al doilea rând „achitat până acum”.

### A-3 · major · Nu există nicio cale în interfață de a opri o programare; un copil plecat blochează închiderea lunii [citire]

`webapp/src/shared/pool/usePool.ts:188` (`endBooking` definit, **niciun apelant** — grep în tot `webapp/src`), `BookingDrawer.tsx:59` (mereu `endDate: null`), `MonthView.tsx:91-95` (meniul ⋯ are doar „Bon 58 mm”).

Scenariu: copilul renunță la bazin → programarea generează în fiecare săptămână ședințe „nemarcate” → `countUnmarkedPastSessions > 0` → „Închide luna” dezactivat (`MonthView.tsx:123`) până când operatorul marchează manual, săptămână de săptămână, Lipsă/Motivat pentru un copil care nu mai vine; „Lipsă” îl și taxează (`chargeUnexcusedAbsence` implicit `true`).

În plus, ruta de oprire de pe server are două defecte latente pentru când interfața va apărea: `pool.routes.mjs:135-141` setează `archivedAt` imediat, chiar cu `endDate` în viitor → `listBookings()` (fără arhivate, `pool.repository.mjs:57-60`) o ascunde din `getWeek` și din `seatsTaken` înainte de sfârșit: ședințele dintre azi și `endDate` nu se mai pot marca (iar `getMonth`/închiderea le numără în continuare ca nemarcate — `includeArchived: true`, `:197`), și locul din slot e eliberat prematur. Fix: „Oprește programarea” în meniul ⋯ din 22c sau pe placă în 22a; `archivedAt` doar când `endDate < today`; `getWeek` cu `includeArchived: true` (filtrarea pe interval există deja la `:106-110`).

### A-4 · major · La reînchiderea lunii, taxele copiilor se recalculează; salariul antrenorului, nu [citire]

`src/features/pool/server/pool-closing.service.mjs:8-10,89-116` (charges: rescrise/șterse după recalcul, „o reînchidere recalculează și suprascrie”) vs `src/features/personal/server/salaries.service.mjs:424-426` (`payCoach`: `validPayment` → `{ paid: false }`, fără să compare suma).

Scenariu: luna închisă; se descoperă o ședință marcată greșit (Prezent în loc de Motivat), se corectează, „Închide luna” din nou: taxa copilului scade, dar cheltuiala „Salariu bazin” și `salary_payments` rămân la suma veche; cardul antrenorului (`coachPayForMonth`, calculat live) arată noua sumă lângă o plată care nu se schimbă, fără niciun avertisment; răspunsul spune `coaches: 0`. Fix: `payCoach` compară `gross` cu plata existentă și, dacă diferă, arhivează cheltuiala veche și rescrie (sau închiderea refuză explicit: „salariul lui X e deja plătit cu Y lei; arhivează cheltuiala ca să reînchizi”).

### A-5 · minor · Capacitatea se verifică doar la data de început a programării noi [verificat]

`pool.routes.mjs:154-157` + `pool-schedule.mjs:59-69` (`seatsTaken(..., onDate = input.startDate)`). Script: A începe 2026-10-05; B nouă începe 09-28 → `taken` = 0 la 09-28, 1 la 10-09 → ambele acceptate pe un slot cu 1 loc, suprapuse din octombrie. Fix: suprapunere de intervale, nu un singur punct.

### A-6 · minor · Luna listează toți copiii care au avut vreodată o programare, nu doar pe cei cu ședințe în lună [citire]

`pool.routes.mjs:197-215`: `childIds` din toate programările (inclusiv arhivate/încheiate), fără filtrare pe `expandBooking(…, month).length`. După prima lună, tabelul 22c acumulează rânduri 0/0/0 „Neînchis”, iar cardul „Copii cu programări” numără foști clienți. Fix: sari rândurile cu `scheduled === 0`.

### A-7 · minor · Sumele din Luna sunt afișate brut, nu prin `formatMoney` [citire]

`MonthView.tsx:30-31,51,55,86,117`: `children.reduce((sum, row) => sum + row.amount)` neînrotunjit; `validatePoolSettings` (`pool-settings.mjs:29-31`) acceptă orice `Number.isFinite` pentru preț (formularul are `step={1}`, dar nu impune întreg) → cu 99.9 lei/ședință apare `299.70000000000005 lei`; nici separator de mii, nici monedă din `formatMoney`. Fix: `formatMoney(...)` ca peste tot.

### A-8 · minor · Cusături între cele trei sesiuni [citire]

- `pool.routes.mjs:83-95` duplică `slotTimes()` din `pool-settings.mjs:86-99` (webapp-ul îl importă pe cel din `index.web.mjs`).
- `PoolPage.tsx:47`: eticheta „Săptămâna curentă” e fixă — după ‹/› arată altă săptămână cu același text.
- `PoolPage.tsx:98`: după o programare nouă se reîncarcă doar săptămâna; Luna rămâne veche până la schimbarea lunii.
- `WeekView.tsx:7-12,69-70`: nu există tranziție spre „Anulat” și `scheduled` nu e clicabil → ramura „ziua viitoare acceptă doar anularea” din `postSessions` și legenda bonului („linie punctată = ziua liberă”) nu pot fi produse din interfață.
- `PoolReceiptLabel.tsx:28-31`: comentariul „Nu are încă rută/hook de date (Bazin nu e implementat)” e fals de la `f0d40af`.
- `MonthView.tsx:34`: `window.confirm` la „Închide luna” (DESIGN.md îl interzice; R6 le-a înlocuit în restul aplicației); tabelul 22c e `<table>` brut, nu `DataTable`.

### Ce e în regulă aici

`saveBooking`/`applySessionChanges` țin `onChange` în aceeași tranzacție cu scrierea; `saveClosing` fără tranzacție proprie e corect documentat; închiderea e idempotentă pe charges (id determinist, comparație JSON, fără intrare falsă în outbox); `payCoach` scrie în `Comun\` ca **ultim** pas al lotului (regula E-2) și se auto-repară la o cădere între cele două baze (`validPayment` cere și cheltuiala); rotunjirea la 2 zecimale în domeniu; setările per filială, `itemsNote` opțional pentru setări salvate înainte de Task 11; sincronizarea `pool_*` folosește exact tiparul prezenței (writer brut, fără `onChange`, în tranzacția motorului); `create-branch-context.mjs:238-268` respectă granița (Pool nu importă Personal; porturile `listCoaches`/`payCoach`/`readCoachPayForMonth`).

---

## B. Sincronizare — Task 9-12 peste motorul reparat

Motorul (C-1…C-9 din auditul precedent) e reparat corect: gardă pe `change_id`, tranzacție pe lot, C-3 la pull, `applySnapshotEntry` la 410, backoff pe orice eroare. Nicio regresie găsită acolo. Problemele noi sunt la **cusătura** dintre Task 11 (`snapshot-io`) și tipurile care nu sunt fișe, și la interacțiunea Task 9 (rezolvare) cu outbox-ul.

### B-1 · critic · Al doilea calculator nu se mai poate conecta după ce pe server a ajuns prezență sau date de bazin [verificat]

`src/features/sync/server/snapshot-io.mjs:43-46` (`writeLocalSnapshot`: `raw.save(kind, payload)` pentru **orice** `kind` din snapshot) vs `change-applier.mjs:101-127` (`applySnapshotEntry`, care știe `attendance`/`pool_*` — folosit doar la 410, `sync-engine.service.mjs:262`). Serverul (`sync-server/src/changes.service.mjs:305-320`) întoarce în snapshot toate kind-urile din `records`, inclusiv `attendance` și `pool_*` (exact ce a documentat C-5).

Reprodus: snapshot cu o intrare `attendance` → `writeLocalSnapshot` aruncă `Provided value cannot be bound to SQLite parameter 2` (payload-ul prezenței n-are `id`; `records.id NOT NULL`, `schema.mjs:4`). Scenariu: A e conectat și marchează prezența (pushed, kind `attendance`). B se conectează („Am deja o grădiniță pe alt calculator”) → `connect()` → `downloadSnapshot` → excepție → 500; tranzacția face ROLLBACK, `sync.json` nu se scrie, dar codul de asociere e deja consumat și B apare pe server ca dispozitiv (`pair` a reușit, `sync-connect.service.mjs:50-52`). Reîncercările eșuează identic. Verificarea live din 28.09 a trecut pentru că între pași nu se marcase prezență. Fix (1 fișier + 1 test): `writeLocalSnapshot` să treacă prin `applySnapshotEntry` cu `createSyncAttendanceWriter`/`createSyncPoolWriter` pe aceeași bază — exact ca resincronizarea la 410; test cu un snapshot care conține `attendance` + `pool_sessions`. `snapshot-io.test.mjs` și `sync-connect.service.integration.test.mjs` nu au niciun rând de prezență (grep `attendance` → 0).

### B-2 · major · Prima încărcare a unei filiale omite prezența și datele de bazin [verificat]

`snapshot-io.mjs:23-24` (`readLocalSnapshot` iterează doar `TYPES`). Reprodus: bază cu o prezență → `entries` fără niciun `attendance`. Scenariu: primul calculator se conectează cu luni de prezență și programări la bazin → serverul primește doar fișele/plățile/cheltuielile; al doilea calculator nu va avea niciodată istoricul (outbox-ul captează doar scrierile de după conectare); Prezența, Raportul contabil pe prezență și „Închide luna” la bazin pe B pornesc de la zero, fără niciun mesaj. Fix: `readLocalSnapshot` adaugă `attendance` (`child_id|date`) și `pool_bookings`/`pool_sessions` (`booking_id|date`)/`pool_closings` (`month`), cu aceleași id-uri ca outbox-ul (`attendance.repository`, `pool.repository.mjs:114`).

### B-3 · major · O editare locală peste o fișă cu conflict parcat face conflictul de nerezolvat („local”) sau retrimite payload-ul vechi [verificat]

`sync-outbox.repository.mjs:26-27,54-80` (`enqueue` caută doar `status='pending'` → o fișă parcată primește un **al doilea** rând, pending), `src/core/server/database/schema.mjs:18` (index unic `(kind, record_id) WHERE status='pending'`), `sync-conflicts.routes.mjs:85` (`unpark` → parcat devine pending). Reprodus: enqueue → park → enqueue → `unpark` aruncă `UNIQUE constraint failed: sync_outbox.kind, sync_outbox.record_id`.

Scenariu: A primește conflict pe fișa Anei; până ajunge cineva la 14c, se mai corectează telefonul Anei (rând pending nou, P2). (1) „Păstrează varianta de pe acest calculator” → 500 din `runRevisionTransaction`; `ConflictsPage.tsx:26-33` n-are `catch` → butonul pare că nu face nimic. (2) Dacă între timp P2 s-a trimis și rândul a dispărut, `unpark` reușește, dar retrimite payload-ul din momentul conflictului (P1, `row.payload`), cu `base_revision = remoteRevision` → serverul răspunde iar conflict (P1 vs P2, amândouă ale lui A). (3) „Păstrează varianta de pe B” → `records` primește varianta lui B (`:68-69`), dar P2 rămâne pending și pleacă la următorul push cu `base_revision` vechi → conflict nou, în care „local” e P2, deși fișa locală arată varianta lui B. În plus, 14c arată în coloana „Pe acest calculator” P1 din `sync_conflicts`, nu ce e acum în fișă. Fix: `enqueue` actualizează rândul parcat (payload nou, rămâne parcat) în loc să insereze; la „local” trimite `rawRecordRepository.find(kind, id)` curent, nu `row.payload`; la „remote” șterge și rândul pending. Test: „o editare după conflict nu blochează rezolvarea”.

### B-4 · major · O conectare întreruptă între înregistrarea filialei și încărcarea ei blochează definitiv reconectarea [citire]

`sync-connect.service.mjs:68-76,89-105`: `registerBranch` apoi `uploadSnapshot`; la reluare, filiala există pe server și local nu e goală → 409 „există deja pe server — poate fi doar un filiale.json copiat”. Scenariu: rețeaua cade după `POST /v1/branches` (sau snapshot-ul depășește limita de corp a serverului) → orice reîncercare din 14b dă 409; nu există nicio cale din aplicație de a relua. Același 409 după `disconnect()` + reconectare pe același server (`:148-153` șterge doar `sync.json`, nu `sync_state`/`sync.since`/outbox) — deci „Deconectează acest calculator” e ireversibil fără intervenție pe server; iar reconectarea pe **alt** server pornește cu `sync.since` și `base_revision` de pe serverul vechi. Fix: filială existentă pe server **fără snapshot** (`headSeq` 0) → reia încărcarea; filială existentă + `sync_state` local nevid → „același calculator revenit”, nu 409; `disconnect` golește `sync_state`, `sync_conflicts`, `sync.since` și arhivează outbox-ul.

### B-5 · major · Fila Sincronizare offline: „Calculatoare conectate” se încarcă la nesfârșit, cu respingere netratată [citire]

`webapp/src/features/backup/useSyncSettings.ts:81-87`: `Promise.all([/api/sync/server, /api/sync/devices])`. La rețea căzută `/api/sync/server` întoarce `{ connection: 'offline' }` (`sync-connect.routes.mjs:92`), dar `/api/sync/devices` aruncă 503 (`:64-66` → `translatingNetworkErrors`) → `Promise.all` respinge → `setDevicesReady(true)` nu rulează → `SyncSettings.tsx:111` arată `<LoadingState/>` permanent, `server` rămâne `null` (fără contoare), iar `useEffect(() => void load())` lasă o respingere netratată. Exact scenariul „Fără internet” pe care cardul de deasupra îl afișează corect. Fix: `Promise.allSettled` + stare „lista nu e disponibilă offline”.

### B-6 · minor · Rezolvarea conflictului nu raportează erorile [citire]

`ConflictsPage.tsx:26-33`: `try/finally` fără `catch` → 404 „Conflictul nu mai există” (rezolvat din altă filă) sau 500 (B-3) ajung doar în consolă; lista nu se reîncarcă. Fix: toast + `load()`.

### B-7 · minor · „Păstrează varianta de pe alt calculator” scrie payload-ul fără `normalizeRecord` [citire]

`sync-conflicts.routes.mjs:69` vs `change-applier.mjs:20-26` (pull-ul normalizează și traduce în `SyncApplyError`). O variantă venită de la o versiune mai veche a aplicației (ex. `notes` text) intră în `records` nevalidată; următorul `validateState`/export/restaurare o respinge. Fix: `normalizeRecord` + 409 cu mesaj.

### B-8 · minor · Marcajele de bazin/prezență primite prin pull nu reîmprospătează ecranul Bazin [citire]

`webapp/src/shared/api/useSyncStatus.ts:106-109` → `reloadRecords()` (doar `/api/state`); `usePoolWeek`/`usePoolMonth` (`usePool.ts:47-60,111-122`) nu ascultă `records-changed`. Marcajele făcute pe alt calculator apar abia la schimbarea săptămânii sau F5. Fix: `reload()` la eveniment (un `useSyncRecordsChanged(callback)` comun ar servi și Prezența).

### B-9 · minor · Codul de asociere e consumat chiar dacă `connect()` eșuează după `pair` [citire]

`sync-connect.service.mjs:50-52` urmat de orice `fail`/excepție (B-1, B-4): dispozitivul rămâne înregistrat pe server (rând fantomă în „Calculatoare conectate” pe A), codul de unică folosință e ars, `sync.json` lipsește. Fix: la eșec după `pair`, revocă propriul dispozitiv; sau `pair` abia după reconcilierea filialelor.

### Ce e în regulă aici

Task 9: rezolvarea trece prin `runRevisionTransaction` (idempotență + revizie), scrie audit pe ambele ramuri, notele medicale sunt redactate în diff (`conflict-diff.mjs`), `noteLocalChange()` grăbește retrimiterea. Task 11: reconcilierea filialelor urmează decizia 9 (goală → adoptă, cu date → urcă), `replaceEmpty`/`adopt` sunt reluabile, bazele se deschid una câte una și se închid în `finally`, `reopenActiveBranch()` reconstruiește motorul cu noul `sync.json`. Task 12: `/api/session.sync` e uniune discriminată pe `configured`, SSE-ul e unul per pagină cu polling de rezervă, `DevicesList` cere confirmare „DECONECTEAZĂ” și ascunde butonul pe rândul propriu.

---

## C. Modelul copilului — `notes: ChildNote[]` (`24b1584`, `816af1d`, `608135e`)

### C-1 · critic · „Înscrie copilul” din vizită eșuează întotdeauna cu „Note: listă invalidă.” [verificat]

`src/features/visits/domain/visit-child-prefill.mjs:10-12,23` (`notes: noteLines.join('\n')` — string, `''` când nu e nimic de spus), `webapp/src/features/visits/useVisits.ts:119-135` (fișa trimisă la `/api/visits-enrol` = `{ ...prefill, ... }`, `notes` netratat), `src/features/visits/server/visits.service.mjs:31` (`normalizeRecord('children', child)`), `src/shared/domain/record-schema.mjs:270-271` (`''` nu e nullish → `??=` nu intervine → `Array.isArray('')` fals → aruncă).

Reprodus: `normalizeRecord('children', { ...buildChildPrefill(visit), ... })` → `Note: listă invalidă.`; la fel cu `notes: ''`. Scenariu: orice vizită „Efectuată” → „Înscrie copilul” → 400, copilul nu se creează, vizita rămâne neînscrisă. Nedetectat pentru că `visits.routes.integration.test.mjs:40-49` trimite un copil **fără** `notes`, `useVisits.test.ts:255` verifică doar că payload-ul conține `notes: ''`, iar `visit-child-prefill.test.mjs:56-80` fixează string-ul. Commit-ul `816af1d` („adaptează consumatorii notes-urilor la noul format listă”) a atins CSV, Excel, review-center — dar nu și acest consumator, care e singurul ce **creează** fișe cu `notes` în afara formularului. Fix (1 fișier + 2 teste): `buildChildPrefill(visit, todayStr)` întoarce `notes: text ? [{ id: 'NOTE-<uuid>', text, date: todayStr }] : []` (data injectată — regula `clock-in-domain`); testul de integrare al înscrierii trimite fișa cu `notes` din prefill.

### C-2 · minor · Căutarea din liste potrivește și id-urile/datele notelor [citire]

`src/shared/ui/record-list-search.mjs:30` (`row.notes` → `JSON.stringify` al listei, adică `"id":"NOTE-…","date":"2026-09-28"`), folosit de `useStatus.ts:171`, `useSchoolYearStatus.ts:126`, `useFeeSetup.ts:168`: căutarea „2026” sau „note” potrivește toți copiii cu vreo notă. Fix: `Array.isArray(row.notes) ? row.notes.map(note => note.text) : row.notes` — cum face deja `review-center.mjs:22`.

### C-3 · minor · Migrarea 003 datează notele în UTC, `upgradeSnapshot` în ora locală [citire]

`src/core/server/database/migrations/003-child-notes-list.mjs:8` (`new Date().toISOString().slice(0, 10)`) vs `src/shared/domain/record-snapshot-upgrade.mjs:54` (`today()`). Între 00:00 și 02:00/03:00 ora Chișinăului migrarea scrie ziua precedentă. Fix: `today()` și aici. (Migrarea rescrie `records` fără outbox — corect, fiecare calculator își convertește copia; două calculatoare vor avea id-uri de notă diferite pentru aceeași notă până la prima editare a fișei, fără pierdere.)

### Ce e în regulă aici

`record-schema.mjs:267-282` (id unic, text nevid, dată validă, sortare recentă-întâi), `ChildProfileView.tsx:96-110` (adaugă cu `today()` local, `satisfies Child`), `children-csv-import.mjs:186-212`, `excel-workbook.mjs:150` (V5 produce string, dar `buildImportReport` — `import-report.mjs:17-19` — trece prin `upgradeSnapshot` înainte de `validateState`, deci importul Excel merge), `review-center.mjs:22`, `ChildFormDrawer`/`child-form.ts` nu mai ating `notes`, `search-records.ts` (Topbar) nu caută în note, `personal-schema.mjs` are propriile `notes` (listă la `staff`, text la `candidates`) — neafectate.

---

## D. Convenții și calitate (observații, nu bug-uri)

- **Granițe.** `tests/architecture/import-boundaries.test.mjs` și `webapp/src/architecture.test.ts` trec; `grep "from '#features/" src/features/*/` → zero importuri între feature-uri (potrivirile sunt doar în README-uri, în coloana „interzis”). Webapp-ul importă în continuare căi interne backend (`#features/visits/domain/visit-child-prefill.mjs` în `useVisits.ts:10`, `#features/pool/pool.types.d.mts` în `WeekView.tsx:3`/`usePool.ts:4-10`) — S2 din auditul de pe 26.09, neschimbat; `architecture.test.ts` nu acoperă aliasul `#features`.
- **Hex în afara `tokens.css`.** 68 de apariții `#fff`/`#000`/`#5b666e` în 22 de fișiere `.module.css`, deși `--white` există (`tokens.css:60`). `PaymentDetailPanel.module.css:70: color: #5b666e` e exact hex-ul înlocuit cu `--muted` la D-3/Modulul 1 — scăpat. `#000` din bonurile termice (`PaymentReceiptThermal`, `DayClosingReceipt`) e argumentabil (tipar), restul nu.
- **Comentarii.** Codul nou din sync/pool are multe blocuri de 3-6 linii (`sync-engine.service.mjs:63-66,157-160,178-182`, `pool.repository.mjs:21-24,142-144`, `change-applier.mjs:129-135`) — DE CE legitim, peste regula „1-2 linii”; unul fals (`PoolReceiptLabel.tsx:28-31`). Referințele la findings („C-1”, „A-2”, „D-2”) sunt acum parte din proces (`COADA-DE-LUCRU.md:195` cere grep pe ele) — utile, dar sunt istoric de task, nu regulă de business; de decis dacă rămân.
- **Reutilizare `@shared/ui`.** `MonthView.tsx`: `<table>` brut + `window.confirm`; `PoolPage.tsx:39-51`: navigare de săptămână cu `<button>` bruți (există `DayStepper`/`MonthStepper`); `BookingDrawer.tsx:95,123,136`: `<select>`/`<input type=date>` bruți — la fel ca alte drawere, nu e regres, dar spec 22b cere „sloturi cu locuri rămase”, care nu se afișează.
- **Teste cu ceasul real.** 17 fișiere folosesc `today()`/`new Date()` fără ceas fix; cele citite (`useVisits.test.ts:11-17`, `VisitsPage.test.tsx:19-22`, `AttendancePage.test.tsx:16-22`, `useBirthdays.test.ts:81`, `useSchoolYearStatus.test.ts:106`, `useDashboard.test.ts:10-17`, `ChildFormDrawer.test.tsx:144`, `salaries.routes.integration.test.mjs:138-143`, `exchange-rates.routes.integration.test.mjs:93-111`) derivă datele din ceas, nu presupun o zi anume — **nicio „azi e 2026-09-2x” rămasă** după `597bef0`. Nou de urmărit: `PoolReceiptPage.test.tsx:92` presupune calendarul lui septembrie 2026 pentru `?month=2026-09` — corect (luna e explicită), nu depinde de azi.

---

## E. Starea suitelor (rulate, nu presupuse)

| Verificare | Rezultat |
| --- | --- |
| `npm run check` (rădăcină) — prettier | verde |
| `npm run check` — `tsc -p .` | verde |
| `npm test` (rădăcină), rularea 1 (din `check`) | `# tests 1104 · pass 1101 · fail 1 · skipped 2` — **un test picat**, numele pierdut (ieșirea a fost trunchiată de `tail`, iar codul de ieșire raportat era al lui `tail`, nu al lui `npm`) |
| `npm test`, rulările 2-4 (ieșire capturată integral) | `# tests 1111 · pass 1109 · fail 0 · skipped 2`, exit 0, de trei ori |
| `cd webapp && npm run typecheck` | verde |
| `cd webapp && npm test` (vitest) | 152 fișiere, **823 teste, toate trec**, 90 s |
| `npm run test:e2e` | nerulat |

Flake observat o singură dată în rădăcină: diferența de 7 teste între rulări (1104 vs 1111) arată un fișier întrerupt după primul eșec (timeout sau port ocupat), nu un test care pică deterministic. Nereprodus în trei rulări consecutive; neidentificat. Flake-ul `VisitsPage.test.tsx` menționat în coadă nu a apărut.

---

## Top 8 (ordinea în care le-aș repara)

1. **C-1** — înscrierea din vizită e ruptă complet. 1 fișier de domeniu + 2 teste. Zero risc.
2. **B-1** — al doilea calculator nu se mai poate conecta după prima prezență de pe A. 1 fișier (`snapshot-io.mjs`) + 1 test; refolosește `applySnapshotEntry`.
3. **B-2** — prezența și bazinul nu se urcă la prima conectare. Același fișier ca B-1; de făcut împreună, înainte ca vreo instalare reală să se conecteze (după aceea istoricul lipsă nu mai poate fi recuperat decât prin reconectare — vezi B-4).
4. **B-3** — editare peste conflict parcat → rezolvare imposibilă / payload vechi. 2 fișiere (`sync-outbox.repository`, `sync-conflicts.routes`) + teste.
5. **A-1** — sărbători: săptămâna vs luna. 1 fișier după decizia de business (lucrează bazinul de sărbători?).
6. **A-3** — oprirea programării: UI lipsă + `archivedAt` prematur. 2-3 fișiere (`MonthView`/`WeekView`, `pool.routes`).
7. **A-2** — bonul cu total 0 la început de lună. 1 fișier + testul care fixează egalitatea falsă.
8. **B-4 + B-5** — reluarea conectării și fila offline. `sync-connect.service` (mediu), `useSyncSettings` (1 fișier).

Apoi: A-4 (reînchidere vs salariu antrenor — cere o decizie: rescrie sau refuză), restul minorelor.

---

## Loturi de reparat (fișiere disjuncte, se pot lucra în paralel)

**Lot 1 — vizite → copil.** `src/features/visits/domain/visit-child-prefill.mjs` (+ `.test.mjs`), `visits.routes.integration.test.mjs`, `webapp/src/features/visits/useVisits.test.ts`. Acoperă C-1. Test nou: „înscrierea din vizită cu sursă și note post-vizită creează fișa cu o notă datată”.

**Lot 2 — snapshot-io.** `src/features/sync/server/snapshot-io.mjs` (+ `.test.mjs`), `sync-connect.service.integration.test.mjs`. Acoperă B-1, B-2. Teste noi: „descărcarea unei filiale cu prezență și bazin nu aruncă și scrie tabelele proprii”, „încărcarea inițială include prezența și bazinul”.

**Lot 3 — conflicte.** `sync-outbox.repository.mjs`, `sync-conflicts.routes.mjs` (+ testele), `webapp/src/features/conflicts/ConflictsPage.tsx`. Acoperă B-3, B-6, B-7. Test nou: „o editare locală după parcare nu blochează rezolvarea și trimite fișa curentă”.

**Lot 4 — conectare.** `sync-connect.service.mjs`, `webapp/src/features/backup/useSyncSettings.ts` (+ testele). Acoperă B-4, B-5, B-9.

**Lot 5 — Bazin server.** `pool.routes.mjs`, `pool-schedule.mjs`, `pool-closing.service.mjs`, `salaries.service.mjs` (`payCoach`) (+ testele). Acoperă A-1, A-3 (partea de server), A-4, A-5, A-6. Necesită decizia de la A-1.

**Lot 6 — Bazin webapp.** `PoolReceiptPage.tsx` (+ test), `MonthView.tsx`, `WeekView.tsx`, `PoolPage.tsx`, `usePool.ts`. Acoperă A-2, A-3 (UI), A-7, A-8, B-8.

**Lot 7 — mărunțișuri.** `record-list-search.mjs` (C-2), `003-child-notes-list.mjs` (C-3), `PaymentDetailPanel.module.css:70` (D).

---

## Goluri de testare observate

- Niciun test de sincronizare nu descarcă sau încarcă un snapshot cu `attendance`/`pool_*` (B-1, B-2) — `snapshot-io.test.mjs` și `sync-connect.service.integration.test.mjs` lucrează doar cu `TYPES`.
- `sync-conflicts.routes.test.mjs` testează rezolvarea doar cu un singur rând în outbox; lipsește cazul „a doua editare după parcare” (B-3).
- Testul de înscriere din vizită trimite un copil construit manual, nu prefill-ul real (C-1) — testul de webapp și cel de server au fiecare jumătatea lor de contract și nu se întâlnesc niciodată.
- `PoolReceiptPage.test.tsx:94` fixează un total care nu iese din înmulțirea de pe același rând (A-2).
- Nu există test pentru o zi de sărbătoare în săptămâna Bazinului (A-1), nici pentru două programări suprapuse cu date de început diferite (A-5).
- `useSyncSettings.test.ts` nu are cazul „server offline / 503 la `/api/sync/devices`” (B-5).

## Scripturile de verificare

Rulate din scratchpad-ul sesiunii, cu import prin `file:///…/agent-a8981bce1972078a5/src/...` (nimic în repo): `v1-notes-snapshot.mjs` (C-1, B-1, B-2, A-1, A-5), `v2-parked-edit.mjs` (B-3). Suitele: `npm run check` + `npm test` ×3 în rădăcină, `npm run typecheck` + `vitest run` în `webapp/` — rezultatele exacte în §E.
