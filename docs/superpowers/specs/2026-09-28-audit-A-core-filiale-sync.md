# Audit A — core, filiale, sincronizare (2026-09-28)

Branch `master-v2`, HEAD `314a879`. Audit **read-only** al codului scris în ultimele ~2 zile de mai mulți agenți în paralel, cu accent pe cusăturile de integrare dintre ei: `src/core/`, filialele (Faza 6), `src/features/sync/` + `sync-server/`, semințele categoriilor de cheltuieli și baza `Comun\` (Personal).

Metodă: citirea integrală a fișierelor din scop, planurile `2026-09-27-filiale.md` și `2026-09-27-sincronizare.md` (inclusiv „Decided by the user” și „Contract reconciliation”), `project-conventions/SKILL.md`, apoi **scripturi de verificare** rulate în afara repo-ului (import prin URL absolut, baze `:memory:`/temporare) pentru fiecare suspiciune importantă. Suitele `src/features/sync/**`, `src/app/server/{branches,create-application,create-common-context}*`, `sync-server/src/**` trec (106/106) — bug-urile de mai jos sunt în afara a ceea ce testează ele.

Etichete: **[verificat]** = reprodus cu script sau test rulat; **[citire]** = dedus din cod, nereprodus.

## Contoare

| Severitate | Număr |
| ---------- | ----- |
| critic     | 3     |
| major      | 11    |
| minor      | 14    |

Notă de context: Faza 5 a sincronizării (`POST /api/sync/connect`, scrierea `sync.json` din aplicație) **nu e construită**; în producție nimeni nu are `sync.json`, deci motorul nu pornește. Severitățile de la secțiunea C/D descriu impactul din momentul în care conectarea devine posibilă — dar A-3 (filiale) și E (Comun) sunt active **azi**, în orice instalare.

---

## A. Core și filiale (active azi)

### A-1 · critic · O filă rămasă pe filiala veche scrie în filiala nouă [verificat]

`src/app/server/create-application.mjs:58` (token per proces, comentariul explică intenția inversă), `src/core/server/persistence/revision-transaction.mjs:48,66` (singura gardă e `request.revision === meta.revision`).

Scenariu: două file deschise pe filiala A (revizia 1). În fila 1 utilizatorul schimbă pe filiala B (`POST /api/branches/select`); B e nouă, primește o scriere → revizia B = 1. Fila 2, rămasă pe UI-ul lui A, salvează o fișă cu `revision: 1` și tokenul procesului → **200**, fișa copilului intră în baza lui B. Reprodus cu script: `copiii din B acum: ["Copil din B","Salvat din fila veche a lui A"]`. Reviziile sunt contoare independente per fișier, deci egalitatea e frecventă (filiale tinere, sau după restaurări). Contrazice criteriul spec „nicio dată a unei filiale nu apare în cealaltă” — testul de izolare existent nu acoperă a doua filă.

Fix (o linie + un test): tokenul de sesiune devine **per context de filială** (`randomUUID()` în `createBranchContext`, nu în `createApplication`) — o filă veche primește 403 „Reîncarcă aplicația înainte de a salva”, exact mesajul dorit și pentru filele din rulări anterioare. Alternativ: `X-Startica-Branch` verificat în `assertAuthorizedWrite`.

### A-2 · major · `app.close()` / `/api/shutdown` se blochează cât timp există un flux SSE deschis [verificat]

`src/app/server/create-application.mjs:89-95,268-277` (`server.close(cb)` + `closeIdleConnections()`; `active.close()` — care e singurul loc ce închide fluxurile SSE, `sync.routes.mjs:91-94` — rulează **în** callback). `closeIdleConnections()` nu atinge un răspuns SSE activ, iar callback-ul așteaptă tocmai închiderea lui: blocaj circular. Reprodus: `app.close()` cu un `GET /api/sync/events` deschis → `BLOCAT după 3 s`. Ruta există și fără `sync.json` (răspunde `configured:false`), deci e reproductibil azi cu `fetch`; webapp-ul deschide `EventSource` doar cu sincronizare configurată.

Consecințe: baza rămâne deschisă, timerele și motorul de sincronizare ale filialei vechi rulează în continuare; lansatorul primește 200 la `/api/shutdown`, așteaptă 60 s ieșirea procesului (`launcher/Startica.cs:585`), apoi renunță fără `Kill`; o pornire ulterioară deschide **al doilea proces** pe aceleași fișiere. `sync-server/src/create-sync-server.mjs:74-82` face corect (`closeAllConnections()` după `close()`) — cusătură între agenți.

Fix: în `shutdownServer` și `close`: `active.closeStreams()` (sau `syncRoutes.close()`) **înainte** de `server.close`, plus `server.closeAllConnections()` după `server.close(...)`.

### A-3 · major · `selectBranch`: contextul vechi poate rămâne deschis, iar închiderea lui e neprotejată [citire, parțial verificat]

`src/app/server/create-application.mjs:211-218`.

- `registry.setLastBranchId(id)` (scriere `filiale.json`) rulează după `active = next`, dar înainte de `setTimeout`: dacă aruncă (disc plin, EPERM), răspunsul e 500, dar serverul **a comutat deja**, iar `previous` (bază, timere, motor de sincronizare, SSE) nu se închide niciodată.
- `previous.close()` rulează într-un `setTimeout` fără `try/catch`: orice aruncare acolo e `uncaughtException` → `main.mjs:34-45` face `process.exit(1)`; și `next.runStartupSweeps()`/`next.startSync()` nu mai rulează.
- Cererile async încă în zbor pe contextul vechi (`/api/sync/now`, `/api/exchange-rates` refresh, sweep-ul BNM) continuă după `db.close()` → „database is not open”. Observat în scriptul A-1: `Curs BNM la pornire: database is not open` ×2.

Fix: `setLastBranchId` înainte de `active = next` (eșec = filiala nu s-a schimbat); `try { previous.close() } catch (e) { console.error(...) } finally { sweeps + startSync }`; `close()` al contextului să aștepte/anuleze lucrul în curs (motorul: `stop()` să aștepte `running`).

### A-4 · minor · Registru valid structural, dar cu `branches: []`, crapă cu `TypeError` [verificat]

`src/core/server/branches/branch-registry.mjs:45-53` acceptă lista goală; `create-application.mjs:157-161` face `openBranchContext(undefined)` → `TypeError: Cannot read properties of undefined (reading 'folder')`. Planul cere „un registru corupt oprește pornirea cu mesaj clar”. Fix: în `readBranchRegistry`, `branches.length === 0` → aceeași eroare „corupt”; opțional, validează că `folder` nu conține separatori de cale (`/`, `\`, `..`) — azi e de încredere doar pentru că îl scrie `branchSlug`.

### A-5 · minor · Căile de eroare din `main.mjs` închid doar baza filialei active

`src/app/server/main.mjs:40,65`: `app.db.close()` ocolește garda `databaseClosed` și lasă `Comun\` deschisă. Fix: `app.closeSync()` în ambele locuri.

### Ce e în regulă aici

Migrarea instalării existente (filiala #1 rămâne pe folderele vechi, registrul e marcatorul, nimic mutat) e corectă și testată; `openDatabase` închide handlerul la eșec; `common` se închide dacă prima filială nu se deschide; `filiale.json`/`sync.json` se scriu atomic; numele de backup și slug-urile de folder sunt validate (fără traversare de cale); backup înainte de restaurare/import/ștergere; dispatcher-ul cu `RESPONSE_SENT` + `headersSent` e corect.

---

## B. Semințe categorii de cheltuieli (activ azi, cu efect după Faza 5)

### B-1 · major · Semințele se scriu prin depozitul cu outbox, în afara oricărei tranzacții, la fiecare deschidere

`src/features/expenses/server/expense-categories.routes.mjs:27` → `expense-category-seeding.mjs:20-25` primește `recordRepository` = cel împachetat de `createOutboxRecordingRepository` (`create-branch-context.mjs:138,183,233`). Fiecare `save` = `INSERT records` + `INSERT sync_outbox` în autocommit-uri separate (fără `BEGIN`) și fără `meta.revision`.

Scenariu (Faza 5, „calculator nou”): contextul filialei se deschide **înainte** ca snapshot-ul de pe server să fie descărcat; seeding-ul scrie cele 8 categorii implicite (id fix) și le pune în outbox cu `base_revision 0`; serverul le are deja la revizia ≥ 1; `categories` e tip cu conflict → **8 conflicte false** la prima sincronizare. Fix: seeding-ul primește `rawRecordRepository` (nu trece prin outbox — ideea id-urilor fixe e tocmai să nu se sincronizeze ca modificări) și rulează într-o singură tranzacție `BEGIN IMMEDIATE`.

### B-2 · minor · Categoriile create din nume „orfane” au id aleator pe fiecare calculator [citire]

`src/shared/domain/expense-categories.mjs:61-71` (+ `record-snapshot-upgrade.mjs:57`). După sincronizare pot exista două înregistrări „Transport” cu id-uri diferite. Când se întâmplă: un pull în două loturi (limita 500) cu cheltuielile în lotul 1 și categoriile în lotul 2, iar aplicația repornește între ele (seeding-ul rulează la deschidere) — sau două instalări cu date vechi conectate pe rând (a doua e refuzată cu 409 în planul Fazei 5, deci rar). `assertUniqueName` nu rulează la pull, deci duplicatul nu e detectat. Fix: id determinist din nume (`CAT-<slug(nume)>`, același în `upgradeSnapshot` și în seeding), ca două calculatoare să producă aceeași înregistrare.

---

## C. Sincronizare — aplicația (`src/features/sync/`)

### C-1 · critic · O modificare locală făcută în timpul unui push în zbor e ștearsă din outbox la „applied” [verificat]

`src/features/sync/server/sync-outbox.repository.mjs:64-70` (a doua modificare **actualizează același rând** `seq`, cu `change_id` nou) + `sync-engine.service.mjs:139-145` (`outbox.remove(row.seq)` după răspuns). Push-ul durează până la 10 s; utilizatorul salvează între timp aceeași fișă → rândul (acum cu payload-ul nou) e șters la „applied” pentru payload-ul vechi. Reprodus: `payload trimis: Ana`, salvare locală „Ana Popescu” în zbor, `pending după „applied”: 0`. Modificarea nu mai ajunge niciodată pe server; următoarea editare a fișei pe alt calculator o suprascrie local la pull → **pierdere silențioasă** de date. Același lucru la `park` (conflictul reține `row.payload` vechi).

Fix: `remove`/`park` doar dacă `change_id` e cel trimis (`DELETE FROM sync_outbox WHERE seq=? AND change_id=?`; dacă 0 rânduri, lasă rândul pending); și pune tratarea fiecărui rezultat (`sync_state` + outbox) într-o tranzacție.

### C-2 · critic · Restaurarea / importul trimit **toată evidența** pe server, nu diferențele [verificat]

`src/core/server/persistence/revision-transaction.mjs:92-94`: `DELETE FROM records` apoi `recordRepository.save(...)` — dar `recordRepository` primit de `createRevisionTransaction` e cel **împachetat** (`create-branch-context.mjs:175-181`), care compară cu `raw.find()`; după DELETE totul e „nou”, deci fiecare înregistrare intră în outbox; `changeSink` (linia 106) e apoi redundant. Reprodus: restaurarea unui instantaneu **identic** cu 50 de fișe → `pending: 50`.

Consecință dincolo de zgomot: rândurile au `changedAt = acum` și `base_revision` din `sync_state`. Pentru înregistrările pe care alt calculator le-a schimbat după ultimul pull al acestuia: la tipurile LWW (achitări, cheltuieli) **copia veche câștigă** și suprascrie editarea celuilalt; la fișe/grupe apar conflicte în masă. Plus N intrări „sincronizare de pe X” în Istoricul fiecărui calculator, la fiecare restaurare. Testul din plan (`'replaceAllRecords trimite în outbox doar diferențele'`) lipsește; cel existent testează depozitul singur, nu compoziția.

Fix (o linie): `createRevisionTransaction({ recordRepository: rawRecordRepository, ... })` — `runRevisionTransaction` folosește depozitul doar pentru citire (`readEnvelope`, `currentRevision`), iar `replaceAllRecords` scrie brut + `changeSink` cu diferențele, exact cum spune planul. Test de compoziție în `sync-unconfigured`/un nou `sync-configured.integration.test.mjs`.

### C-3 · major · Pull-ul suprascrie o înregistrare cu conflict parcat [citire]

`sync-engine.service.mjs:236-241`: se sar doar propriile modificări (`device.id === deviceId`); planul cere și „skip a record that has a parked outbox row (update the conflict's remote side instead)”. Scenariu: A și B editează aceeași fișă; A primește `conflict` → rând parcat + `sync_conflicts`; la următorul pull vine varianta lui B (sau a treia, de pe C) → `applier.apply` o scrie peste `records` → varianta locală **dispare din UI**, rămâne doar în `sync_conflicts.local_payload`, iar ecranul de conflicte (Faza 4) nu există încă. Fix: în `pullOnce`, pentru `(kind, recordId)` cu rând `parked`, actualizează `sync_conflicts.remote_*` și `sync_state`, fără să atingi `records`.

### C-4 · major · „superseded” rescrie înregistrarea locală fără `meta.revision`, fără `onRecordsChanged`, fără tranzacție [verificat]

`sync-engine.service.mjs:146-157`. Reprodus: local `Local` → după push `Remote`, `meta.revision 0 → 0`, `onRecordsChanged` 0 apeluri. Fila deschisă nu află (nu se reîncarcă), formularele arată date vechi; următoarea salvare din acea filă trece verificarea de revizie și retrimite varianta veche (care câștigă din nou la LWW cu `changedAt` nou) — ping-pong între calculatoare. Cele 4 instrucțiuni (find/save/audit/sync_state) sunt autocommit-uri separate. Fix: tratează lotul de rezultate într-o `BEGIN IMMEDIATE`, `bumpRevision()` + `onRecordsChanged()` dacă s-a aplicat vreun `superseded`.

### C-5 · major · `resyncFromSnapshot` (410) eșuează pe orice filială cu prezență și e distructiv [verificat]

`sync-engine.service.mjs:184-216`. Snapshot-ul serverului conține toate `KINDS` (`changes.service.mjs:301-316`: `attendance`, mai târziu `settings`/`sms_templates`), iar linia 193 aplică `normalizeRecord(kind, …)` pentru fiecare kind → `Înregistrare invalidă.` la primul rând de prezență. Reprodus: `status.lastError: "Înregistrare invalidă."`. Efect: după prima curățare a istoricului (365 zile; vezi D-4 pentru cazuri mai timpurii), fiecare ciclu (15 s) descarcă întregul snapshot și eșuează, la nesfârșit. În plus: `DELETE FROM records` fără backup înainte (convenția cere `backupBefore` la operații ireversibile), șterge și variantele locale ale rândurilor parcate, nu golește `sync_state` pentru înregistrări dispărute (→ `base_revision` învechit la următoarea editare), nu rescrie prezența. Fix: `backups.backup('inainte-resincronizare')`; aplică prin `applier.apply` (care știe tipurile); păstrează rândurile parcate; `DELETE FROM sync_state` înainte; tratează `attendance`.

### C-6 · minor · Fluxul SSE către server nu se reconectează niciodată

`sync-http-client.mjs:111-137`: după o repornire a serverului/Caddy, `openEvents` se termină în tăcere; polling-ul rămâne, dar trezirea la 2 s dispare până la repornirea aplicației sau schimbarea filialei. Fix: reconectare cu backoff în `openEvents` sau în `start()`.

### C-7 · minor · `bumpRevision()` nu actualizează `meta.updated_at`

`sync-engine.service.mjs:125-127` → `/api/state.updatedAt` rămâne vechi după un pull. Fix: aceeași instrucțiune ca în `runRevisionTransaction` (`revision-transaction.mjs:68`).

### C-8 · minor · Pull-ul „aplică” `settings`/`sms_templates` ca no-op, dar scrie audit și `sync_state`

`change-applier.mjs:91-111`: intrări „sincronizare de pe X” în Istoric pentru modificări care nu s-au aplicat. Fix: ignoră tipurile netratate până la Faza 6 (fără audit, fără `sync_state`).

### C-9 · minor · Eroare generică → reîncercare la fiecare 15 s fără limită

`sync-engine.service.mjs:276-278`: un 404 de la server (filiala neînregistrată — exact starea dintre Faza 3 și 5) sau C-5 produc o linie de jurnal + (la 410) un snapshot complet la fiecare poll. Fix: backoff și pentru `SyncHttpError`/`SyncApplyError`, nu doar pentru rețea.

---

## D. `sync-server/`

### D-1 · major · Contractul culorii filialei e incompatibil între aplicație și server [verificat prin teste]

`sync-server/src/branches.routes.mjs:4,34-36` cere `color` hex (`/^#[0-9a-fA-F]{3,8}$/`) și dă 400 altfel; aplicația are `BRANCH_COLORS = ['orange','mint','yellow','pink']` (`src/shared/domain/branch.mjs:5`) și `registerBranch(branch)` trimite intrarea din registru ca atare (`sync-http-client.mjs:93-94`). Prima `POST /v1/branches` reală din Faza 5 va eșua întotdeauna. Testele de integrare din aplicație ocolesc problema trimițând `'#f5a623'` (`sync.routes.integration.test.mjs:112`), ceea ce a mascat-o. Fix: pe server acceptă token-urile (copiază `BRANCH_COLORS` în `change-policy.mjs` și adaugă-le la `tests/sync-shared-constants.test.mjs`).

### D-2 · major · Reluarea unui `changeId` cu rezultat „superseded” nu întoarce `head` → rândul rămâne pending pentru totdeauna [citire]

`sync-server/src/changes.service.mjs:95-108` (doar `conflict` întoarce `head` la replay) + `sync-engine.service.mjs:146` (`superseded && result.head`). Scenariu: răspunsul la push se pierde pe rețea; la retrimitere serverul răspunde `superseded` fără `head`; clientul nu șterge, nu parchează → același rând în fiecare push, cardul arată „Se trimit 1 modificări…” permanent. Fix: serverul întoarce `head` și la replay-ul `superseded`; clientul șterge rândul când `superseded` vine fără `head`.

### D-3 · minor · `runBackupCycle` rulează în `setInterval` fără `try/catch` → procesul cade

`backup.service.mjs:80-92`: disc plin la `VACUUM INTO` = `uncaughtException` (fără handler în `main.mjs`) → container restart; `lastRunDate = today` e setat înainte, deci nu se reîncearcă azi. Fix: `try/catch` cu log, `lastRunDate` după succes.

### D-4 · minor · `changes_floor_seq` e global, nu per filială → 410 fals pentru filiale liniștite

`backup.service.mjs:36-45`, `changes.service.mjs:233-234,241`: cursorul unei filiale fără activitate rămâne mic; curățarea (după `SYNC_HISTORY_DAYS`) ridică pragul global peste el → toate calculatoarele acelei filiale primesc 410 → resincronizare (care azi eșuează, C-5). Fix: prag per filială (`MAX(seq) … WHERE branch_id=? AND received_at<?`) sau `nextSince = MAX(seq) global` când nu sunt rânduri.

### D-5 · minor · `main.mjs` la SIGTERM folosește `server.close`, nu `close()`

`sync-server/src/main.mjs:12-15`: cu SSE deschise, `server.close` nu se termină; Docker trimite SIGKILL după 10 s; baza nu se închide curat (WAL+FULL o protejează, dar backup-ul programat/`closeAll` nu rulează). Fix: apelează `close()` din `createSyncServer`.

### D-6 · minor · `X-Forwarded-For`: se ia primul salt; limitatorul crește nelimitat

`router.mjs:75-82`, `auth.mjs:26-40`. Cu Caddy ≥ 2.5 (implicit nu are încredere în XFF-ul clientului) e sigur; în spatele altui proxy care doar adaugă, clientul își alege IP-ul → ocolește limita de 5/10 min la `pair`. `hitsByKey` nu e curățat (memorie per IP distinct). Fix: ultimul salt (cel adăugat de proxy-ul propriu); curățare periodică a cheilor fără lovituri în fereastră.

### D-7 · minor · `setupKey` comparat cu `!==`

`devices.routes.mjs:34`: nu e timing-safe; limitarea de rată reduce riscul. Fix: `timingSafeEqual` pe hash-uri.

### D-8 · minor · Parametri nevalidați la pull/snapshot

`changes.routes.mjs:55-57`: `since=abc` → `NaN` → `nextSince = NaN` → clientul scrie `'NaN'` în `sync.since` și nu mai primește nimic (`readCursor` → `NaN`); `limit=-1` → `LIMIT -1` = tot istoricul într-un răspuns. `changes.routes.mjs:61-70`: intrările snapshot-ului nu sunt validate (`kind` în `KINDS`, `id` string) → 500 pe `NOT NULL`. Fix: `Number.isInteger`, `1 ≤ limit ≤ 500`, validare per intrare ca la `assertValidChange`.

### D-9 · minor · SSE fără plafon și fără contrapresiune

`events.mjs:25-30`, `changes.routes.mjs:79-101`: un dispozitiv poate ține oricâte fluxuri; `response.write` fără `writableNeedDrain` → buffer nelimitat la un client care nu citește. Fix: un flux per dispozitiv (închide-l pe cel vechi), sari peste `write` când `writableNeedDrain`.

### D-10 · minor · Containerul rulează ca root; nu există jurnal de cereri

`Dockerfile` (fără `USER node`); `router.mjs` loghează doar 500-urile — planul cere „method, path, status, device id — never bodies”. Fix: `USER node`; o linie de log per cerere.

### Ce e în regulă aici

Token 32 octeți `base64url`, ținut **hash-uit** (`sha256`), `UNIQUE`; `auth: true` pe toate rutele în afară de `pair`; cod de conectare 6 cifre, 10 min, o singură folosire, șters după 5 încercări greșite, limitare 5/10 min per IP; limite de corp 20 MB / 64 MB; `changeId` idempotent; push-ul într-o singură tranzacție; fără date în URL; `VACUUM INTO` + redenumire; clientul refuză `http://` în afara loopback-ului; `sync.json` și `sync-server/data/` în `.gitignore`.

---

## E. Baza `Comun\` (Personal) — active azi

### E-1 · major · Baza comună nu are backup după scrieri și nici la oprirea din lansator [citire]

`src/app/server/create-common-context.mjs:32-42` creează un `createBackupService`, dar nimeni nu apelează `autoBackup()`/`scheduleBackup` după scrierile prin `kinds` (`kind-repository.mjs` nu are hook de backup; `grep autoBackup src/features/personal` → 0). Singurele copii: `app.backup('pornire')` (`main.mjs:86`, include `common`) și `shutdown()` la SIGINT/SIGTERM (`main.mjs:107`). Ruta `/api/shutdown` — calea reală a lansatorului — apelează `backupService.safeBackup('inchidere')` al **filialei** (`session.routes.mjs:57-58`), nu al aplicației. Deci salariile, avansurile, pontajul dintr-o zi de lucru nu au nicio copie până la următoarea pornire; nici copie externă (`forbiddenFolders: () => []`, fără `externalDir`). Planul Personal promitea „`Comun\Startica_Backup` … same retention”. Fix: `createSessionRoutes` primește `safeBackup` al aplicației (cel care face `common.safeBackup` + filială); `createCommonContext` dă lui `createKindRepository` un `onChange` care apelează `backups.autoBackup()` (sau `scheduleBackup`).

### E-2 · major · Scrieri în două baze în aceeași „tranzacție” — neatomice [citire]

`src/features/personal/server/salaries.service.mjs:87-127,156-236` + `src/core/server/persistence/kind-repository.mjs:21-32`. În interiorul `runRevisionTransaction` (BEGIN IMMEDIATE pe baza filialei), `personalRepository.kinds.save(...)` face **commit imediat** pe `Comun\` (conexiune separată). În `pay`: avansurile primesc `deductedBy: paymentId` (208-211) **înainte** de `normalizePersonalRecord('salary_payments', …)` (212), care poate arunca → filiala face ROLLBACK (cheltuiala dispare), dar avansurile rămân marcate ca scăzute de o plată inexistentă; `giveAdvance`: o cădere între cele două commit-uri lasă avans fără cheltuială sau invers. Nu se poate face atomic peste două fișiere; se poate reduce fereastra la o cădere de proces. Fix: validează/normalizează tot înainte de orice scriere; grupează scrierile în `Comun\` într-un singur `kinds.transaction(...)` ca **ultima** instrucțiune din callback (după ce filiala a scris tot); la pornire, un sweep care repară `deductedBy` orfan (fără `salary_payments` corespunzător).

---

## Top 10 (ordinea în care le-aș repara)

1. **A-1** filă veche → scrie în altă filială (activ azi, corupție între filiale) — token per context.
2. **C-2** restaurare/import inundă outbox-ul și poate suprascrie editările altora — depozitul brut în `createRevisionTransaction`.
3. **C-1** modificare locală ștearsă din outbox la push în zbor — `remove`/`park` după `change_id`, în tranzacție.
4. **E-1** `Comun\` fără backup între porniri și la oprirea din lansator.
5. **A-2** blocaj la oprire cu SSE deschis — închide fluxurile înainte de `server.close` + `closeAllConnections`.
6. **C-3** pull-ul suprascrie înregistrarea cu conflict parcat.
7. **C-4** `superseded` fără revizie/notificare/tranzacție.
8. **C-5** resincronizarea din snapshot eșuează pe prezență și e distructivă fără backup.
9. **D-1** culoarea filialei: token în aplicație, hex pe server — Faza 5 ar eșua din prima cerere.
10. **E-2** scrieri neatomice filială + `Comun\` la avansuri/salarii.

Apoi: A-3, B-1, D-2, restul minorelor.

---

## Loturi de reparat (fișiere disjuncte, se pot lucra în paralel)

**Lot 1 — motorul de sincronizare (aplicație).** `src/features/sync/server/sync-engine.service.mjs`, `sync-outbox.repository.mjs`, `change-applier.mjs`, `sync-http-client.mjs` (+ testele lor). Acoperă C-1, C-3, C-4, C-5, C-6, C-7, C-8, C-9, partea de client din D-2. Teste noi: „o scriere locală în timpul push-ului rămâne pending”, „un rând parcat nu e suprascris de pull”, „superseded crește revizia și notifică”, „resincronizarea aplică prezența și face backup înainte”.

**Lot 2 — composition root și oprire.** `src/app/server/create-application.mjs`, `create-branch-context.mjs`, `session.routes.mjs`, `main.mjs`. Acoperă A-1 (token per context), C-2 (depozit brut în `createRevisionTransaction`), A-2 (SSE înainte de `server.close`), A-3 (ordinea `setLastBranchId`, `try/catch` în `setTimeout`), E-1 partea de `/api/shutdown`, A-5. Teste noi: „o filă cu tokenul filialei vechi primește 403 după schimbare”, „restaurarea unui instantaneu identic nu pune nimic în outbox”, „app.close() se termină cu un flux SSE deschis”.

**Lot 3 — `sync-server/`.** `sync-server/src/{changes.service,changes.routes,branches.routes,backup.service,main,router,auth,devices.routes,events}.mjs`, `Dockerfile`, `tests/sync-shared-constants.test.mjs`. Acoperă D-1 … D-10. Teste noi: „POST /v1/branches acceptă culorile aplicației”, „replay-ul unui superseded întoarce head”, „410 doar pentru istoric curățat din aceeași filială”.

**Lot 4 — semințe categorii.** `src/features/expenses/server/expense-categories.routes.mjs`, `expense-category-seeding.mjs`, `src/shared/domain/expense-categories.mjs`, `record-snapshot-upgrade.mjs`. Acoperă B-1, B-2. Necesită `rawRecordRepository` expus în `ExpenseCategoriesRoutesDependencies` (o linie în lotul 2, de coordonat: cel mai simplu lotul 4 primește un parametru nou opțional, iar lotul 2 îl leagă).

**Lot 5 — `Comun\` și Personal.** `src/app/server/create-common-context.mjs`, `src/core/server/persistence/kind-repository.mjs`, `src/features/personal/server/salaries.service.mjs`. Acoperă E-1 (autoBackup după scrieri), E-2. Test nou: „o plată de salariu care eșuează la normalizare nu lasă avansuri marcate ca scăzute”.

**Lot 6 — registrul filialelor.** `src/core/server/branches/branch-registry.mjs` (+ test). Acoperă A-4 (listă goală = corupt; `folder` fără separatori de cale).

---

## Goluri de testare observate

- Nu există test pentru compoziția `replaceAllRecords` + depozit cu outbox (numele din plan lipsește) — ar fi prins C-2.
- Testul de izolare a filialelor folosește o singură „filă”; lipsește cazul filei rămase pe filiala veche (A-1).
- `sync.routes.integration.test.mjs` trimite culoare hex ca să treacă de server (D-1) — testul confirmă bug-ul în loc să-l prindă.
- Niciun test nu deschide un SSE și apoi `app.close()` (A-2); testele închid cititorul înainte.
- Motorul e testat doar cu un client fals care răspunde instant; nu există caz de scriere locală în timpul unui `await` (C-1).

## Scripturile de verificare

Rulate din scratchpad-ul sesiunii, cu import prin `file:///D:/CODE/Startica%20app/src/...` (fără fișiere în repo): `v1-replace-flood.mjs` (C-2), `v2-engine-races.mjs` (C-1, C-4, C-5), `v3-close-sse.mjs` (A-2, A-4), `v5-stale-tab.mjs` (A-1, A-3). Suitele existente: `node --test src/features/sync/server/*.test.mjs src/app/server/{branches.routes.integration,create-application.integration,create-common-context}.test.mjs sync-server/src/*.test.mjs` → 106/106 verzi.
