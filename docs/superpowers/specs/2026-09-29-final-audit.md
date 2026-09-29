# Audit final — 29 septembrie 2026 (`master-v2`, sfârșit de sesiune)

Branch `master-v2`, HEAD `3986402` (arbore curat; auditul a rulat într-un worktree adus la același commit). Audit **read-only**, al doilea din aceeași zi: verifică dacă cele 20 de constatări din `2026-09-29-code-audit.md` (HEAD `e94c7e3`, 03:51) au fost într-adevăr închise de commit-urile `462385d`…`736f753`, și caută probleme **noi** în ce a intrat între timp fără recitire umană: setul comun sincronizat (Task 12, `9241ac1`), plătitorii reținuți (`0793598`, `3986402`), Nume/Prenume/IDNP/adresă la copil (`0782190`), plus loturile de reparații 1-7.

Metodă: citirea integrală a `create-common-context.mjs`, `create-application.mjs`, `sync-connect.service.mjs`, `snapshot-io.mjs`, `change-applier.mjs`, `sync-engine.service.mjs`, `sync-outbox.repository.mjs`, `sync-conflicts.routes.mjs`, `sync.routes.mjs`, `kind-repository.mjs`, `sync-server/src/changes.service.mjs` + diff-urile `change-policy`/`changes.routes`/`devices.routes`, `payer-aliases.routes.mjs`, `payment-name-matching.mjs`, diff-ul `record-editing.routes.mjs`/`record-schema.mjs`/`record-integrity.mjs`, `useAssign.ts`, `useSyncStatus.ts`, testele noi ale fiecărui lot; apoi **șapte scripturi de verificare** rulate din scratchpad, cu **sync-server real** pornit pe port efemer acolo unde conta (v1, v6, v7). Ce e închis se confirmă într-un rând (§E); efortul s-a dus pe suprafața nouă și pe reparațiile însele.

Etichete: **[verificat]** = reprodus cu script sau test rulat; **[citire]** = dedus din cod, nereprodus.

## Contoare

| Severitate | Număr |
| ---------- | ----- |
| critic     | 2     |
| major      | 4     |
| minor      | 6     |

Cele două critice sunt amândouă în **conectarea la sincronizare** și amândouă înseamnă că **primul calculator conectat** (cel cu toate datele) nu e tratat corect: **S-1** — după ce își urcă evidența, prima editare a oricărei fișe/grupe/categorii/vizite existente devine un conflict cu el însuși; **S-2** — la conectarea celui de-al doilea calculator, setul comun nu se contopește, ci **diverge** (A și B rămân cu valori diferite pentru aceeași înregistrare, iar redenumirile de pe A se pierd). Niciuna nu e prinsă de teste, pentru că niciun test nu editează o înregistrare pre-existentă **după** connect pe calculatorul care a urcat-o. S-1 e pre-existent (Task 11, 28.09) și a scăpat ambelor audituri anterioare; S-2 e nou de azi.

Toate cele 20 de constatări de dimineață sunt închise (§E), cu o singură contra-indicație: reparația B-4 a introdus S-3 (deconectarea e acum ireversibil-409 la reconectarea pe **același** server — exact scenariul pe care voia să-l rezolve).

---

## A. Sincronizare — conectare și motor

### S-1 · critic · Calculatorul care își urcă evidența nu primește `sync_state`; prima editare a oricărei fișe existente devine conflict cu el însuși [verificat]

`sync-server/src/changes.service.mjs:267-300` (`writeSnapshot`: fiecare rând din instantaneu e scris cu `updated_by = deviceId`-ul celui care urcă și cu un rând `changes` atribuit **aceluiași** dispozitiv) + `src/features/sync/server/sync-engine.service.mjs:317` (`pullOnce`: `if (change.device.id === deviceId) continue;` — propriile modificări sunt sărite **fără** `syncState.set`) + `sync-connect.service.mjs:186-202` (după `uploadSnapshot` nu se scrie nimic în `sync_state` local). Rezultat: după primul ciclu, `sync_state` e gol, iar `sync-outbox.repository.mjs:67-71` dă `base_revision = 0` oricărei editări; pe server `changes.service.mjs:113` (`baseMatches`: `headRow.revision (1) === 0` fals) → pentru `children`/`groups`/`categories`/`visits` (CONFLICT_KINDS) răspunsul e `conflict`.

Reprodus (`v1-upload-then-edit.mjs`, sync-server real): A cu `CHILD-1` → `connect()` → `uploaded: [local-1]` → motorul lui A face primul ciclu → `sync_state rows = 0`, `sync.since = 2` → A redenumește `CHILD-1` pe drumul normal (`createOutboxRecordingRepository`) → outbox `{ kind: children, baseRevision: 0 }` → push → **`conflicts = 1`, `parked = 1`**, capul serverului rămâne `Ana`. Scenariu real: grădinița conectează calculatorul principal (luni de fișe, grupe, vizite); din acel moment **fiecare** primă editare a unei fișe existente (telefon, grupă, statut) apare în 14c ca „Aceleași date modificate pe alt calculator: Calculator A” — adică el însuși — și trebuie rezolvată manual, una câte una; până atunci editarea nu ajunge la B. Plățile/cheltuielile/taxele (LWW) trec, pentru că `changes.service.mjs:142` compară `changedAt`. Verificarea live din 28.09 (6/6) a trecut pentru că a editat doar pe B (care are `sync_state` din `writeLocalSnapshot`) sau fișe create după conectare.

Același mecanism lovește setul comun: calea „serverul n-are nimic → `uploadSnapshot(comun)`” (`sync-connect.service.mjs:238-239`) lasă `staff` (CONFLICT_KIND, `change-policy.mjs`) fără `sync_state` → prima editare a oricărui angajat existent = conflict (vezi și S-2).

Fix (1 linie + 1 test): în `pullOnce`, pentru `change.device.id === deviceId` scrie `syncState.set(kind, recordId, { serverRevision: change.revision, … })` **înainte** de `continue` — idempotent pentru modificările deja marcate la push, corect pentru rândurile din instantaneu și pentru `pushChanges` de la connect (S-2); acoperă și motorul comun fără altă schimbare. Alternativ, `finishConnecting` scrie `sync_state` (revizia 1) + `sync.since = headSeq` (întors de `POST /snapshot`) după fiecare `uploadSnapshot`. Test nou în `sync-connect.service.integration.test.mjs`: „după urcarea instantaneului, prima editare a unei fișe existente se aplică, nu produce conflict” (harness-ul cu server real există deja acolo).

### S-3 · major · „Deconectează acest calculator” → reconectarea la **același** server e 409 definitiv [verificat]

`sync-connect.service.mjs:43-55` (`resetSyncState`: `DELETE FROM sync_state` la `disconnect()`, `:278-298`) vs `:166` (`if (hasLocalSyncState(...)) continue;` — singura cale prin care o filială nevidă care există deja pe server scapă de 409) și `:167-172` (`headSeq === 0` → reia încărcarea; altfel `fail(…, 409)`). Cele două jumătăți ale reparației B-4 se anulează: deconectarea șterge exact dovada de care reconectarea are nevoie. Comentariul de la `:280-282` („fără curățarea lor, o reconectare la ACELAȘI server dă 409”) e inversat — cu curățarea dă 409.

Reprodus (`v1-upload-then-edit.mjs`, partea a doua): după connect reușit, `disconnect()` apoi `connect()` pe același server → `POST /pair 200`, `GET /branches`, `GET /branches/local-1/snapshot` (headSeq > 0), `POST /devices/…/revoke 200` (B-9 funcționează), apoi **`409 Filiala „Filiala principală” există deja pe server — poate fi doar un filiale.json copiat`**. Testul nou `sync-connect.service.test.mjs:243` acoperă doar reconectarea la un server **nou** (`branches: []`). Scenariu: operatorul deconectează (token pierdut, redenumire, „să văd dacă merge”) și nu se mai poate reconecta niciodată la serverul grădiniței fără să șteargă datele locale; editările făcute cât a fost deconectat nici nu sunt în outbox (`isEnabled()` fals). Fix: la `disconnect()`, păstrează `sync_state` și reține `serverUrl`-ul (o setare `sync.last_server_url`); la `connect()`, filială nevidă + există pe server cu date + același `serverUrl` → „același calculator revenit” (și, cinstit, descarcă instantaneul serverului peste local cu backup înainte, ca la 410 — editările offline nu sunt oricum capturate); server diferit → resetul de azi. Test: „disconnect + connect la același server reușește”.

### S-6 · major · Ordinea de livrare: aplicația de azi cu un sync-server de ieri blochează toată coada la primul plătitor reținut [citire]

`sync-server/src/changes.routes.mjs:14-19` (fiecare `kind` din lot e validat împotriva `KINDS`; un singur kind necunoscut → `400` pentru **întregul** lot) + `change-policy.mjs` (`payerAliases` există doar de la `3986402`, ultimul commit al zilei) + `sync-engine.service.mjs:361-381` (`handleError`: 400 nu e nici rețea, nici revocare → `lastError` + backoff, același lot retrimis la nesfârșit). Scenariu: instalatorul de azi ajunge pe calculatoare, serverul de pe VPS nu e redesfășurat; prima bifă „Ține minte plătitorul” pune un rând `payerAliases` în outbox → lotul de 200 care îl conține (cu toate fișele/plățile editate după el) primește 400 la fiecare ciclu → cardul 14a arată eroare permanentă, nimic nu mai pleacă de pe acel calculator. Același tipar pentru `staff`…`salary_payments` (`COMMON_KINDS` pe server, `9241ac1`). Fix: **redesfășoară sync-server-ul înainte** de instalator (de notat în `GHID-LIVRARE.md`); defensiv, motorul ar putea parca rândurile respinse cu 400 individual, dar serverul nu spune care — cel puțin `lastError` ar trebui să numească kind-ul.

Tot aici, versiuni amestecate ale aplicației: o versiune dinainte de `0782190` care primește prin pull un copil cu `idnp`/`address` îi taie câmpurile la `normalizeRecord` (whitelist `FIELDS`) și, la următoarea editare de acolo, le trimite înapoi **fără** ele → IDNP-ul dispare și pe calculatorul nou. Se evită doar actualizând toate calculatoarele deodată.

### Reparațiile B-1…B-9 — verificate

- **B-1/B-2** închise: `snapshot-io.mjs:122-156` trece prin `applySnapshotEntry` (`createSyncAttendanceWriter`/`createSyncPoolWriter` pe aceeași bază), `:23-107` citește `attendance`/`pool_*` cu aceleași id-uri ca outbox-ul; testele `snapshot-io.test.mjs:89,147` acoperă exact scenariile de dimineață. Nicio regresie: `applied === false` nu lasă `sync_state`, ca la 410.
- **B-3** închisă: `sync-outbox.repository.mjs:32-34,84-93` actualizează rândul ne-terminal pe loc (statusul rămâne), `sync-conflicts.routes.mjs:96-98,111-112` șterge și rândul pending la „remote” și trimite `rawRecordRepository.find` curent la „local” (teste `:110,132,139`). **Același depozit e folosit de outbox-ul comun** (`create-common-context.mjs:75`), deci reparația e pe amândouă. O regresie posibilă, verificată negativ: „local” cu fișa între timp ștearsă local → `unpark(…, null)` → trimite ștergerea, corect.
- **B-4** închisă pentru reluarea unei conectări întrerupte (`headSeq === 0` → reia; test `:139`), dar vezi **S-3** pentru jumătatea cealaltă.
- **B-5/B-6/B-7/B-8** închise: `useSyncSettings.ts:90` `Promise.allSettled`; `ConflictsPage` prinde erori (test); `sync-conflicts.routes.mjs:68-82` normalizează la „remote” (409 cu mesaj); `usePool.ts:73,141,187` + `usePersonal.ts` reîncarcă pe `records-changed` tăgăduit cu `dataset` (`useSyncStatus.ts:121-131`).
- **B-9** închisă și observată în jurnalul serverului din `v1` (`POST /v1/devices/<id>/revoke 200` după eșec); `devices.routes.mjs` a scos garda „nu te poți revoca pe tine” — acceptabil, interfața ascunde butonul pe rândul propriu.

### Minore în motor

**S-7 · minor** · `sync-engine.service.mjs:197-210`: la `conflict`, `conflicts.insert(...)` rulează **înainte** și indiferent de rezultatul lui `outbox.park(row.seq, row.changeId)`; dacă rândul a fost coalescat cât push-ul era în zbor (garda C-1), `park` întoarce fals, rândul rămâne pending, dar în `sync_conflicts` (fără UNIQUE pe `kind,record_id` — `schema.mjs:19`) apare un conflict care arată spre un rând care nu e parcat; următorul push produce încă unul. Pre-existent, probabilitate mică. Fix: `if (outbox.park(...)) conflicts.insert(...)`. [citire]

---

## B. Setul comun (Task 12, `9241ac1`)

Arhitectura de bază e corectă și confirmată la citire: motorul comun primește `createRecordRepository` (fără tranzacții proprii) ca `rawRecordRepository` (`create-common-context.mjs:88`), `writeCommonSnapshot` folosește `kinds.transaction` (`snapshot-io.mjs:192`) iar `syncState.set`/`setSetting` nu deschid tranzacții — **nu există o a doua imbricare** de tipul celei prinse de crew; rezolvarea unui conflict `staff` trece prin `common.runInTransaction` cu `rawRepository` (`sync-conflicts.routes.mjs:176-190`), nu prin `kinds.save`; `disconnect()` chiar apelează `getCommon()` și `resetSyncState(common.db)` (`sync-connect.service.mjs:291-292`, `getCommon` cablat la `create-application.mjs:130`); `reopenActiveBranch()` reconstruiește motorul comun doar la connect/disconnect (`:314`); statusul se contopește într-un singur card (`sync.routes.mjs:27-46`), „Sincronizează acum” pornește amândouă motoarele (`:117-123`). Testul de integrare `common-dataset.integration.test.mjs` (3 teste, server real) trece. Problemele sunt la **cusătura de la connect** și la **ce anume** e în set.

### S-2 · critic · La conectarea celui de-al doilea calculator, setul comun diverge: A pierde redenumirile, B le păstrează, serverul are a treia variantă [verificat]

`sync-connect.service.mjs:232-260`: când și serverul și localul au rânduri, localul e trimis ca `pushChanges` cu `baseRevision: 0` și `changedAt: entry.updatedAt`, unde `updatedAt = now()` pentru **toate** rândurile (`snapshot-io.mjs:168,172` — `readCommonSnapshot` n-are un „ultima schimbare” per rând); rezultatul apelului e **aruncat** (nici `sync_state`, nici conflicte, nici `head`-uri). Pe server, `changes.service.mjs:142` (LWW: `changedAt > head.updated_at` → aplică) — deci orice id care există pe amândouă e **suprascris de calculatorul care se conectează ultimul**, oricât de veche i-ar fi copia. Și această cale nu e un caz-limită: `personal.repository.mjs:33-38` seamănă `departments`/`roles` cu id-uri fixe (`personal-seeds.mjs:11-14`: `DEP-administratie`, `DEP-educatori`, …) la **fiecare** pornire a aplicației (`create-branch-context.mjs:262`), deci pe o instalare reală `localHasRecords` e mereu adevărat — **fiecare** al doilea calculator trece pe aici, iar ramura `writeCommonSnapshot` (`:240-241`) nu rulează niciodată în producție.

Reprodus (`v7-comun-seeds.mjs`, server real, semințele reale): A se conectează (urcă), redenumește `DEP-altele` → „Contabilitate (redenumit pe A)”, sincronizează (server rev 2). B, instalare nouă cu semințele implicite, se conectează → push `DEP-altele` „Altele” cu `baseRevision 0`, `changedAt = acum` → aplicat, rev 3. B trage de la 0: rev 1 (A), rev 2 (A, „Contabilitate”) se aplică, rev 3 e **propria** modificare → sărită → B rămâne local pe „Contabilitate”. A trage rev 3 → **A revine la „Altele”**. Stare finală: `A DEP-altele = Altele | B DEP-altele = Contabilitate (redenumit pe A)`, server „Altele” — **trei valori, două calculatoare**, fără niciun conflict afișat și fără să se repare singură (B are `sync_state DEP-altele@2`, serverul e la 3, deci următoarea editare pe B trece iar cu LWW). În plus (`v6-comun-both.mjs`): după contopire, `sync_state` al fiecăruia conține **doar angajatul celuilalt** (`A: [STF-B@1]`, `B: [STF-A@1]`), iar editarea propriului angajat dă `conflicts = 1` pe fiecare (S-1 pe setul comun). Roluri (cu salariile implicite editate), departamente, orice id determinist — la fel.

Fix (de decis, nu de ghicit — dar nu poate rămâne așa): la connect, pentru id-urile care **există deja pe server**, nu trimite nimic (serverul câștigă; copia locală e suprascrisă la primul pull — pe un calculator nou pierderea e doar semințele) și pune id-urile **noi** local în **outbox-ul comun** (`outbox.enqueue`, `baseRevision 0`) în loc de `pushChanges` direct — motorul le trimite după `reopenActiveBranch()` și tratează el `applied`/`conflict`/`sync_state`. Împreună cu S-1 (sync_state la pull pentru propriul dispozitiv) dispare și conflictul-cu-sine. Test: scenariul v7 exact (redenumire pe A, conectare B, ambele arată „Contabilitate”).

### S-4 · major · `candidates` nu e în setul sincronizat, dar trăiește în aceeași tabelă: nu se contopește între calculatoare și e **șters** la o resincronizare 410 [verificat]

`change-applier.mjs:31-40` (`COMMON_KINDS`: 8 kind-uri, fără `candidates`) vs `personal.repository.mjs:194-215` (`kinds.list/save/remove('candidates')` — în `records` din `Comun\`) vs `docs/design/screens/24-personal.md:14` („`candidates` … comun ambelor filiale (ca `departments`), **sincronizat ca restul**”) vs `sync-engine.service.mjs:252` (`resyncFromSnapshot`: `DELETE FROM records` pe **toată** tabela, apoi rescrie doar ce e în instantaneul serverului). `COADA-DE-LUCRU.md:290` recunoaște prima jumătate („candidații nu se contopesc încă”), nu și a doua.

Reprodus (`v3-comun-410.mjs`): bază comună cu 1 `staff` + 2 `candidates`; `readCommonSnapshot` → doar `staff`; motorul comun primește 410 la pull → resincronizare (backup făcut: 1) → `staff` rescris de pe server, **`candidates` 2 → 0**. Scenariu: laptopul secretariatului stă oprit peste pragul de istoric al serverului (`SYNC_HISTORY_DAYS`; `changes.service.mjs:238`) → la repornire, lista de candidați dispare fără mesaj; singura copie e în `Comun\Startica_Backup\…inainte-resincronizare`. Fix: adaugă `candidates` în `COMMON_KINDS` (aici + `sync-server/src/change-policy.mjs`, LWW) — testul `tests/sync-shared-constants.test.mjs` va cere amândouă; sau, dacă rămâne deliberat local, `resyncFromSnapshot` să șteargă doar `WHERE kind IN (…)`, nu toată tabela.

### S-5 · major · Adoptarea unei filiale goale schimbă id-ul filialei, dar nu și `staff.branchIds`/`salary_payments.branchId` din setul comun [citire, confirmat ca real și neadresat]

`sync-connect.service.mjs:174-181` (`registry.replaceEmpty(local.id, unclaimed)` — filiala locală **fără copii/grupe** primește id-ul celei de pe server) + `personal-schema.mjs:90,103` (`staff.branchIds`, `salary_payments.branchId` țin id-ul vechi) + `isStaffInBranch` (`personal.repository.mjs:57` — lista echipei; `salaries.routes.mjs:84,137`, `salaries.service.mjs:180,270` — plata refuză „nu lucrează la filiala activă”). Nimic din `src/` nu rescrie `branchIds` la remap (grep în `app/server`, `sync/server`, `core/server/branches` → 0). Precondiția e ușor de îndeplinit: pe o instalare nouă filiala implicită e goală, iar Personal se poate folosi imediat (angajați, avansuri) înainte de „Conectează”. După connect, angajații creați acolo dispar din lista filialei pe **ambele** calculatoare (`branchIds` = un id care nu mai există în niciun registru) și salariile lor nu se mai pot plăti. Crew-ul a semnalat-o corect (`COADA-DE-LUCRU.md:291`), dar rămâne deschisă; nu e teoretică. Fix: în `finishConnecting`, după `replaceEmpty`, rescrie `branchIds`/`branchId` din `comun` pentru `old → new` (în aceeași tranzacție cu registrul, prin `kinds.transaction`), sau refuză adoptarea cât timp setul comun referă filiala goală (mesaj clar).

### Minore

**S-8 · minor** · `create-common-context.mjs:99-105`: `onChange` pune în outbox, dar nu apelează `syncEngine?.noteLocalChange()` (cum face `outbox-recording-repository` pentru filială) → o scriere Personal/Bazin-salarii pleacă abia la polling-ul de 15 s sau la următorul eveniment SSE, nu în 2 s. [citire]

**S-9 · minor** · Rezolvarea unui conflict `staff` cu „varianta de pe alt calculator” (`sync-conflicts.routes.mjs:176-192`) scrie în `records` fără nicio notificare `records-changed`/revizie → ecranul Personal deschis rămâne cu varianta veche până la o reîncărcare manuală (pentru filială, `runRevisionTransaction` ridică revizia și sesiunea se reîncarcă). [citire]

---

## C. Plătitori reținuți (`payer_aliases`, `0793598` + `3986402`)

Nucleul e corect: kind în `TYPES` (deci în backup/export JSON, foaia brută Excel prin bucla `TYPES`, `validateState` tolerant la lipsă), `normalizeRecord` cere text nevid, id de copil valid, dată ISO și face `trim` (`record-schema.mjs:424-433`, verificat); crearea trece prin `/api/record` generic cu `assertRecordReferencesExist` (copilul trebuie să existe); ștergerea are rută proprie pe același tipar ca `group-delete` (`runRevisionTransaction`, 409 dacă nu mai există, audit `before/after`) și trece prin depozitul cu outbox, deci ajunge pe celălalt calculator; `useAssign.ts` scrie alias-ul **după** asocierea reușită și nu o anulează dacă alias-ul pică; sugestia primește scor 1000 și `nameMatch: true`, deci trece și prin `findUnassignedPaymentHintsByChild`. Granițele: `src/features/payer-aliases/` importă doar `#core`/`#shared` (`import-boundaries` verde).

### P-1 · minor · Potrivirea e exactă după `strip+trim`, nu după normalizarea spațiilor/punctuației [verificat]

`payment-name-matching.mjs:83,92-94`. Script (`v4-import-aliases.mjs`): alias `Ştefan Rusu` → `Ștefan Rusu` DA, `ŞTEFAN RUSU` DA, ` stefan rusu ` DA, dar **`Stefan  Rusu` NU** (două spații), **`Stefan Rusu.` NU**, `STEFAN RUSU SRL` NU (acesta e corect). Extrasele bancare ale aceleiași bănci sunt de obicei stabile, dar un import CSV cu spații duble sau un punct final strică singurul indiciu care contează 1000. Fix: compară `nameTokens(...).join(' ')` (există deja) sau `replace(/\s+/g,' ')` + fără punctuație finală, pe ambele părți.

### P-2 · minor · Deduplicarea folosește alt comparator decât potrivirea → alias-uri duble pentru ş/ș [verificat]

`record-editing.routes.mjs:46-48` (`toLocaleLowerCase('ro-RO')`, fără `stripDiacritics`) vs `payment-name-matching.mjs:7` (`stripDiacritics + lowercase`). Script: `'Ştefan'.toLocaleLowerCase() === 'Ștefan'.toLocaleLowerCase()` → **false**; `stripDiacritics` → true. Un extras cu sedilă și unul cu virgulă → două cipuri identice în fișa copilului, amândouă potrivesc. Fără fereastră de cursă locală (verificarea e în `BEGIN IMMEDIATE`); între calculatoare duplicatul e inerent și inofensiv. Fix: același `normalizeSearchText` din `text-search.mjs` în ambele locuri.

### P-3 · minor · `/api/payer-alias-delete` cu `id` lipsă/nevalid → 500, nu 400 [verificat]

`payer-aliases.routes.mjs:22` → `recordRepository.find('payerAliases', undefined)` → `TypeError: Provided value cannot be bound to SQLite parameter 2`. Identic cu `group-delete` (nu e regresie), dar e un `fail(400)` de un rând.

---

## D. Modelul copilului (`firstName`/`lastName`/`idnp`/`address`, `0782190`)

Nimic de raportat. Verificat (`v4-import-aliases.mjs`): un backup vechi (copil cu `group` text, `notes` text, fără `firstName`/`idnp`/`payerAliases`/`charges`) trece prin `upgradeSnapshot` + `validateState` (`children = 2`, `payerAliases = 0`, notele mutate în listă, `idnp: ''` → șters) și prin `buildImportReport` fără erori; `idnp` acceptă doar `\d{13}` după `trim` (`123`, 14 cifre → respinse cu mesaj; ` 2001234567890 ` → acceptat), e opțional, iar `name` se recalculează doar când **ambele** `firstName`+`lastName` sunt prezente (`record-schema.mjs:240`) — o fișă veche editată doar pe un câmp nu-și pierde numele; `child-form.ts:58-72,118-137` pornește câmpurile goale pentru fișe vechi și nu încearcă să despartă `name`. CSV-ul și foaia lizibilă Excel nu poartă câmpurile noi (nici nu trebuie — reimportul vine din foaia brută). Singura grijă e cea de la S-6 (versiuni amestecate).

---

## E. Cele 20 de constatări de dimineață — stare

| Id | Stare | Unde |
| --- | --- | --- |
| C-1 înscriere din vizită | închis | `visit-child-prefill.mjs:26` (listă datată), teste |
| C-2 căutare în note | închis | `record-list-search.mjs:32` |
| C-3 migrare 003 UTC | închis | `003-child-notes-list.mjs` (diff) |
| B-1 / B-2 snapshot attendance/pool | închis | `snapshot-io.mjs`, teste `:89,:147` |
| B-3 editare peste parcat | închis | `sync-outbox.repository.mjs:84-93`, `sync-conflicts.routes.mjs:96-112` |
| B-4 reluare conectare | închis parțial — **S-3** | `sync-connect.service.mjs:166-172` vs `:43-55` |
| B-5 fila offline | închis | `useSyncSettings.ts:90` |
| B-6 / B-7 | închis | `ConflictsPage.tsx`, `sync-conflicts.routes.mjs:68-82` |
| B-8 reîncărcare Bazin la pull | închis | `usePool.ts:73,141,187` |
| B-9 cod ars la eșec | închis | `sync-connect.service.mjs:111-121`, observat în v1 |
| A-1 sărbători | închis | `pool.routes.mjs:116,212` |
| A-2 total bon | închis | `PoolReceiptLabel.tsx:44-45` (ședințe taxabile × preț) |
| A-3 oprire programare | închis | `MonthView.tsx:67` `endBooking`, `pool.routes.mjs:154` `archivedAt` doar la `endDate < today` |
| A-4 reînchidere vs salariu | închis | `salaries.service.mjs:431-470` (compară `net`, arhivează, rescrie) |
| A-5 capacitate pe interval | închis | `pool-schedule.mjs:84` `seatsTakenOverlapping` |
| A-6 rânduri 0/0/0 | închis | `pool.routes.mjs:250` |
| A-7 formatMoney | închis | `MonthView.tsx:86,90,121,157` |
| A-8 cusături | închis (diff-ul `Lot 6`) — nu rechecked fiecare punct | — |
| D hex `PaymentDetailPanel` | închis | diff |

---

## F. Convenții, granițe, suite

- **Granițe.** `tests/architecture/import-boundaries.test.mjs` + `tests/sync-shared-constants.test.mjs`: 12/12; `webapp/src/architecture.test.ts` trece în vitest. Feature-ul nou `payer-aliases` nu importă alt feature; `payment-assignment` primește `payerAliases` prin `records`, nu prin import. `COMMON_DATASET_ID` e dublat corect (`environment.mjs`/`change-policy.mjs`) și acoperit de testul de constante partajate.
- **Cod mort în producție.** `writeCommonSnapshot` + testele lui acoperă o cale pe care semințele Personal o fac de neatins (vezi S-2); calea reală (`pushChanges`) nu are niciun test care să verifice `sync_state`-ul sau editarea următoare.
- **Flake-ul de dimineață, explicat.** Diferența 1104 vs 1111 din §E al auditului de dimineață are aceeași semnătură ca aici (1149/1 fail vs 1156/0): `excel-workbook.test.mjs` cere `webapp/node_modules/xlsx`, care lipsește într-un worktree proaspăt — fișierul pică la `require` și 7 teste nu mai sunt numărate. Nu e un test instabil; e o dependență de mediu (de mutat `xlsx` în `package.json`-ul rădăcinii sau de sărit testul cu mesaj când modulul lipsește).

### Starea suitelor (rulate, nu presupuse)

| Verificare | Rezultat |
| --- | --- |
| `npm run check` (rădăcină) — prettier, `tsc -p .` | verde |
| `npm test` (rădăcină), rularea 1 (worktree fără `node_modules`) | `# tests 1149 · pass 1146 · fail 1 · skipped 2` — `excel-workbook.test.mjs`: `Cannot find module …\webapp\node_modules\xlsx\xlsx.js` (mediu, vezi mai sus) |
| `npm test` (rădăcină), rularea 2 (joncțiune `node_modules` spre checkout-ul principal) | `# tests 1156 · pass 1154 · fail 0 · skipped 2`, exit 0 |
| `excel-workbook.test.mjs` singur | 8/8 |
| `cd sync-server && npm test` | `# tests 69 · pass 69 · fail 0` |
| `cd webapp && npm run typecheck` | verde |
| `cd webapp && npx vitest run` | **154 fișiere, 848 teste, toate trec** |
| `npm run test:e2e` | nerulat |

---

## Top 6 (ordinea în care le-aș repara)

1. **S-1** — `sync_state` pentru propriul dispozitiv la pull (1 linie în `pullOnce`) + test „urcă, apoi editează”. Fără el, primul calculator conectat își face singur conflicte la fiecare fișă existentă. Rezolvă și jumătate din S-2.
2. **S-2** — contopirea setului comun la connect: nu suprascrie id-urile existente pe server, id-urile noi prin outbox, nu `pushChanges` direct; test cu semințele reale (scenariul v7). Până atunci, **niciun al doilea calculator nu trebuie conectat** — divergența nu se repară singură.
3. **S-3** — deconectare/reconectare pe același server (păstrează `sync_state` sau reține serverul; descarcă peste local cu backup). Blocaj total pentru cine apasă „Deconectează”.
4. **S-4** — `candidates` în `COMMON_KINDS` (două fișiere + testul de constante), sau `DELETE … WHERE kind IN (…)` la 410.
5. **S-5** — remap `branchIds`/`branchId` la `replaceEmpty`, în aceeași tranzacție.
6. **S-6** — notă în `GHID-LIVRARE.md`: serverul se redesfășoară **înainte** de instalator; toate calculatoarele se actualizează deodată.

Apoi: P-1/P-2 (un singur normalizator), S-7, S-8, S-9, P-3.

## Loturi de reparat (fișiere disjuncte)

**Lot A — motor.** `sync-engine.service.mjs` (S-1 în `pullOnce`; S-7 `park` înainte de `insert`), `sync-engine.service.integration.test.mjs`. Test nou cu server real: „după `uploadSnapshot`, editarea unei fișe existente e `applied`”.

**Lot B — connect.** `sync-connect.service.mjs` (S-2 contopire comun; S-3 same-server; S-5 remap), `sync-connect.service.test.mjs`/`.integration.test.mjs`, `common-dataset.integration.test.mjs`. Teste noi: v7 (semințe), „disconnect + connect același server”, „angajat pe filială goală supraviețuiește adoptării”.

**Lot C — set comun.** `change-applier.mjs` + `sync-server/src/change-policy.mjs` (S-4 `candidates`), `create-common-context.mjs` (S-8 `noteLocalChange`), `sync-conflicts.routes.mjs` (S-9 notificare).

**Lot D — plătitori.** `payment-name-matching.mjs` + `record-editing.routes.mjs` (P-1/P-2, un normalizator din `text-search.mjs`), `payer-aliases.routes.mjs` (P-3), testele lor.

**Lot E — livrare.** `docs/design/GHID-LIVRARE.md` (S-6), `package.json` rădăcină sau `excel-workbook.test.mjs` (dependența `xlsx`).

## Goluri de testare observate

- Niciun test nu editează o înregistrare **pre-existentă** pe calculatorul care a urcat instantaneul (filială sau comun) — S-1 și S-2(b) ar fi picat imediat.
- `common-dataset.integration.test.mjs:65` verifică doar că **id-urile** se contopesc, nu și **valorile** unei înregistrări cu același id pe ambele părți (S-2c) — semințele sunt exact acest caz și sunt în fiecare test, neobservate.
- `sync-connect.service.test.mjs:243` testează reconectarea la un server **nou**, nu la același (S-3).
- Nu există test pentru un 410 pe motorul comun (S-4), nici pentru `replaceEmpty` cu date în `comun` (S-5).
- `payment-name-matching.test.mjs` nu are cazuri de spații duble/punctuație (P-1); `record-editing.routes.integration.test.mjs` nu are cazul sedilă/virgulă (P-2).

## Verdict

**Instalatorul poate fi construit pentru utilizare locală** (fără „Conectează”): Bazinul, plătitorii reținuți, câmpurile noi ale copilului și toate cele 20 de reparații de dimineață sunt corecte la citire și verde pe 1154 + 848 + 69 de teste. **Sincronizarea nu e de pus în mâna nimănui în forma asta**: S-1 face din primul calculator conectat o fabrică de conflicte cu el însuși, S-2 face ca al doilea calculator să lase setul comun divergent și să șteargă redenumirile de pe primul, iar S-3 face „Deconectează” ireversibil. Toate trei sunt în două fișiere (`sync-engine.service.mjs`, `sync-connect.service.mjs`), au reproduceri scriptate gata de transformat în teste și nu cer decizii de produs — cu excepția regulii de contopire de la S-2 (serverul câștigă pe id-urile comune), care merită un rând în `INTREBARI.md` dacă nu e evidentă. Push-ul pe `master-v2` e în regulă; livrarea cu sincronizare activată, nu — și serverul se redesfășoară primul (S-6).

## Scripturile de verificare

Rulate din scratchpad-ul sesiunii, cu import prin `file:///…/agent-a0ff44035a24f4a0d/src/...` și `sync-server/src/create-sync-server.mjs` pe port efemer (nimic în repo): `v1-upload-then-edit.mjs` (S-1, S-3, B-9), `v3-comun-410.mjs` (S-4), `v4-import-aliases.mjs` (D, P-1, P-2, P-3), `v6-comun-both.mjs` (S-2 a/b), `v7-comun-seeds.mjs` (S-2 c). Suitele: `npm run check` + `npm test` ×2 în rădăcină, `npm test` în `sync-server/`, `npm run typecheck` + `vitest run` în `webapp/` — rezultatele exacte în §F.
