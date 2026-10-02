# Audit cod — runda 2 (02.10.2026, după rezolvarea AUDIT-COD-02-10.md #5-#11)

Audit read-only, 5 agenți paraleli (backend/securitate, UI/design-system, facturare/plăți,
gestiune oameni, integritate-date/performanță/teste), instruiți explicit să nu repete găsirile
deja rezolvate din `docs/design/AUDIT-COD-02-10.md`.

**Nicio găsire de severitate Critică sau Înaltă.**

## Mediu

### 1. Sync: `recordId` din plic vs `payload.id` — fără verificare de consistență
`src/features/sync/server/change-applier.mjs:54-70` (`applyRecordEntry`) scrie local cu cheia din
`normalized.id`/`payload.id`, NU din `recordId`-ul primit în plic. `sync-server/src/changes.service.mjs:233-260`
ține revizia/conflictul per `recordId`, dar tratează `payload` ca opac — nu verifică niciodată
`payload.id === recordId`. `assertValidChange` validează doar forma plicului.

Toate punctele de `enqueue()` din cod setează mereu `recordId: record.id`, deci bug-ul nu apare din
utilizare normală. Dar un dispozitiv cu token valid ar putea trimite `recordId: 'X'` cu
`payload: {id: 'Y', ...}` (Y = înregistrare existentă pe alt calculator) — push-ul trece, dar la
pull alte calculatoare scriu peste Y, în timp ce audit/sync state raportează X. Jurnalul de audit
nu mai reflectă adevărul.

**Fix:** în `applyRecordEntry`, după `normalizeRecord`, `requireThat(normalized.id === recordId, ...)`.

### 2. Garda de alocare pentru plăți EUR compară lei cu euro — efectiv moartă
`src/shared/domain/record-schema.mjs:622` — `allocated <= cents(record.amount)` compară suma
`allocations[]` (în EURO pentru copil cu tarif EUR) cu `cents(record.amount)` (mereu în LEI).
Nu e exploatabil azi prin formular (`PaymentFormDrawer` calculează corect), dar garda server nu
mai prinde nimic pentru acest caz — o repartizare incorectă de la orice alt client/bug viitor ar
trece nedetectată.

**Fix:** compară `allocated` cu `cents(record.amountEur ?? record.amount)`.

### 3. `b3-pool-expenses-to-payments.mjs` — fără test, oprire totală la primul conflict
Spre deosebire de sibling-ii ei (toate cu `.test.mjs`), acest script nu are niciun test, și bucla
`--execute` oprește tot restul lotului la primul eșec — exact pattern-ul reparat la #7
(fxrate-backfill). Risc practic scăzut (rularea reală din 30.09 a reușit 143/143; idempotent la
rerulare), dar un candidat viitor eșuat ar bloca tăcut restul lotului.

**Fix:** același try/catch + `failed[]` ca la fxrate-backfill, plus un test minim.

### 4. Luna (attendance, 18b) filtrează copiii după grupa CURENTĂ, nu cea din luna vizualizată
`webapp/src/features/attendance/useAttendanceMonth.ts:94-99` (și `WeeklySheet.tsx`/
`WeeklySheetDialog.tsx`, același tipar) — un copil mutat din Grupa A în Grupa B pe 1 octombrie:
deschizi Luna/septembrie/Grupa A → copilul dispare, deși a avut prezență reală acolo; Luna/
septembrie/Grupa B → copilul apare, deși nu era acolo încă. Nu există istoric de apartenență la
grupă în schemă.

**Fix (necesită decizie de produs):** fie documentează explicit limitarea, fie adaugă un interval
valabil per grupă pe copil. Las în `docs/design/INTREBARI.md` ca decizie de produs, nu o rezolv
unilateral.

### 5. Bazin: crearea/oprirea unei programări și marcarea prezenței la ședințe nu scriu în audit
`src/features/pool/server/pool.routes.mjs` (`postBooking`/`postSessions`) — spre deosebire de
orice altă acțiune structurală (copil, vizită, grupă, plată), aici nu se scrie niciodată în
`auditTrail`, și nu există niciun comentariu care să explice de ce (spre deosebire de pontaj,
care documentează explicit omisiunea). Pare scăpare, nu decizie.

**Fix:** adaugă `auditTrail.recordChange(...)` la creare/oprire programare, cu același tipar ca
restul rutelor structurale.

## Scăzut

- **`PaymentFormDrawer.tsx:760-770`** — rândul de repartizare manuală nu arată €/lei lângă câmp;
  indiciul e doar textul de sub el. Cosmetic.
- **`b1-fix-mixed-payments.mjs`** — fără test, dar risc minim (7 id-uri hardcodate, one-shot deja
  rulat pe date reale cu gardă proprie).
- **Worktree-uri/foldere rămase pe disc** (gitignorate, fără risc de commit): `.worktrees/feat-multi-currency-fees`
  (branch nemerge), `.claude/worktrees/agent-a7772503006c201e9`/`agent-aa775a32c72e04cd7` (încă
  `locked`), `.claude/worktrees/agent-a14d541c82869a72f`/`agent-a8d6598273f5df260` (orfane,
  `git worktree list` nu le mai arată), `.claude/worktrees/npm-check-out.txt` (362KB, fișier rătăcit).
  Doar igienă — de curățat când userul confirmă că nu mai are treabă cu ele.
- **`ServicesSettings.tsx`/`VisitFormDrawer.tsx`** — fără `if (submitting) return` explicit, dar
  scriu prin `session.mutate`, care are gardă globală sincronă (`app-session-store.mjs:233`) — un
  Ctrl+Enter dublu nu creează înregistrare duplicată, doar o eroare confuză la apăsare accidentală.
  Aceeași clasificare „cosmetic, nu funcțional" ca cele 5 formulare deja acceptate în auditul
  precedent. Fix opțional: aceeași gardă, pentru consecvență.
- **`ConnectServerForm.tsx`/`BackupPage.tsx`** — fără gardă internă, dar nu sunt în Drawer/Dialog
  (fără vector Ctrl+Enter) — `disabled` pe buton e suficient.
- **Prezența la grădiniță** — fără audit trail, la fel ca bazinul (#5), dar probabil aceeași
  justificare ca pontajul (prea frecvent) — nedocumentată.
- **Contrast de culoare** — `TOKENS.md` nu documentează nicio regulă, iar `jest-axe` în jsdom nu
  verifică fiabil `color-contrast` (cere randare pixel reală) — neverificat automat nicăieri.

## Verificat, fără bug nou

- Lanțul de revocare a dispozitivelor la sync, hash-ul tokenului, rate-limiter-ul, gestionarea
  erorilor (niciodată `.stack` spre client) — solide.
- `allocationCurrency()`/`tuition-obligation.mjs`/`payment-auto-allocation.mjs`/`exchange-rates.mjs`/
  `salaries.service.mjs` — validări solide, fixurile din sesiunea precedentă (#1, #3, #6, #7) rămân
  corecte la relectură.
- Niciun caz nou de scanare dublă tip #8 — toate `readSnapshot()` din `src/**/*.routes.mjs` sunt
  deja în afara buclelor.
- `enrolChild`, `group-delete`, `replaceDepartmentsAndRoles` — tranzacții atomice, fără referințe
  orfane.
- `postBooking` — fără cursă reală pe ultimul loc liber (handler sincron, fără `await` între
  verificare și scriere).
- R1-R13 din `architecture.test.ts` — toate allowlist-urile rămân goale, nicio excepție nouă.

## Recomandare de prioritate

Niciun punct nu cere acțiune imediată (nimic Critic/Înalt). Dintre cele 5 Mediu, aș prioritiza:
**#1 (sync recordId/payload.id)** — integritate de date pe termen lung, fix mic; **#2 (gardă EUR
moartă)** — fix de o linie; **#3 (b3-pool-expenses, fără test)** — mecanic, ca #7. **#4 (Luna/grupă
istorică)** cere o decizie de produs, nu doar cod. **#5 (audit bazin)** — mic, dar schimbă ce arată
Istoricul, merită confirmare că omisiunea chiar e o scăpare și nu intenționată.
