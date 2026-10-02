# Audit cod complet — 02.10.2026

Sync la `master-v2` (`c2c745e`, PROMPT-9 §1–§9 complet). 5 audituri paralele, doar citire: securitate/arhitectură server, design-system/UI, financiar (plăți/facturare), oameni (copii/grupe/personal/bazin), date/performanță/acoperire teste. Fiecare punct de mai jos a fost urmărit prin cod real, nu presupus din nume.

## Critic — nu rula încă

### 1. ✅ Rezolvat (`c3fe4b1`) — `fxrate-backfill.mjs` ar corupe soldul copiilor cu tarif EUR dacă rulează `--execute`
`scripts/migrate/fxrate-backfill.mjs:255` scrie `fxRate`/`amountEur` pe o plată veche, dar lasă `amount`/`allocations[].amount` neatinse (corect — acolo e suma reală în lei de atunci). Problema: `allocationCurrency()` (`src/shared/domain/payment-allocations.mjs:36-38`) decide moneda plății după simpla prezență a `amountEur`, nu după un flag explicit — deci din momentul în care migrarea scrie `amountEur`, restul aplicației (obligation/sold, Situația plăților, dashboard) citește `allocations[].amount` (suma veche în LEI) **ca și cum ar fi în EUR**.

**Scenariu concret:** copil cu tarif EUR, a plătit 1500 MDL în martie 2024 (înainte de funcția de curs). Migrarea calculează corect `amountEur ≈ 75.76`, dar `amount: 1500` rămâne. De acum, `obligation()` citește 1500 **EUR**, nu 1500 MDL — copilul arată un credit fantomă de ~20x suma reală, iar restanțele reale dispar din rapoarte pentru toată durata de viață a acelei plăți.

Scriptul nu a fost rulat niciodată cu `--execute` pe date reale (confirmat de toate rapoartele) — zero pagubă până acum. **Rezolvat**: migrarea convertește acum fiecare rând din `allocations` cu același curs (ultimul rând absoarbe rotunjirea, ca suma să cadă exact pe `amountEur`); testat cu plăți pe 1 și pe 3 luni.

## Înalt

### 2. ✅ Rezolvat (`3f0f6ef`) — `GET /api/state` trimite tot setul de date, inclusiv la un profil restrâns
`src/app/server/session.routes.mjs:108` + `/api/state` e în `OPEN_PATHS` (`route-modules.mjs:131-143`) — fără nicio poartă de modul. §2 (`ChildProfileView.tsx`) ascunde secțiunile de plată în UI pe profil restrâns, dar datele au ajuns deja complet în browser la încărcare — oricine deschide devtools pe un calculator cu profil restrâns vede toate plățile, indiferent de profil. Contrast cu `/api/personal/state`, care E corect filtrat. Scrierile sunt corect păzite (`/api/record` verifică `assertModuleAccess` dinamic) — doar citirea în bloc nu e.
**Rezolvat**: `filterSnapshotForProfile()` (computer-profile.mjs) golește tipurile al căror modul e sub „Vede" și taie `healthNotes`/`feeHistory` din `children` când `payments` nu e permis — aplicat în `create-branch-context.mjs`, doar pentru `/api/state` (nu și pentru citirile interne de validare la scriere, care au nevoie de tot setul).

### 3. ✅ Rezolvat (`0b23512`) — `BookingDrawer` (bazin) poate crea rezervări duble — §3 a deschis o cale nouă spre bug
`webapp/src/features/pool/BookingDrawer.tsx:58` — `submit()` nu verifică `if (saving) return` la intrare (toate celelalte formulare o fac: PaymentFormDrawer, ExpenseFormDrawer, ChildFormDrawer, GroupFormDrawer). Mai mult, `saveBooking()` (`usePool.ts:198-207`) nu trece prin `session.mutate`, singurul loc cu gardă globală sincronă (`app-session-store.mjs:233`) care protejează restul formularelor. §3 a adăugat Ctrl+Enter → `form.requestSubmit()` global — a doua cale de declanșare într-un formular fără nicio protecție. Scenariu: Ctrl+Enter, apoi click imediat pe „Programează" înainte de re-render → 2 rezervări pe același interval, posibil peste `seatsPerSlot`, fiecare facturată separat.
**Rezolvat**: `if (saving) return;` la începutul `submit()`. Testat cu `form.requestSubmit()` direct (Ctrl+Enter ocolește butonul disabled) cât timp prima salvare e în curs.

### 4. Fiecare scriere re-citește/retrimite tot setul de date — fără paginare server-side
`revision-transaction.mjs:83` + `record-repository.mjs:5-13` — orice salvare de plată/copil/cheltuială face un scan complet al tabelului `records`, JSON.parse pe fiecare rând, apoi retrimite tot snapshot-ul. `/api/state` la fel. Nicio listă mare (Copii/Plăți/Cheltuieli/Istoric) nu are paginare pe rețea — doar în browser, după ce tot setul a ajuns deja. Nu e critic azi pe SQLite local, dar e principalul risc de scalare pe termen lung (câțiva ani de date reale, înregistrări arhivate nepurjate niciodată). Nu necesită acțiune imediată, dar e bine de avut în vedere la următoarea trecere de arhitectură.

## Mediu

### 5. ✅ Rezolvat (`0e88205`) — `/api/undo` ocolește gărzile de modul/PIN
`route-modules.mjs:131-143` pune `/api/undo` în `OPEN_PATHS`. Fereastra de anulare e 15s; dacă profilul calculatorului e restrâns (sau i se cere PIN) chiar în acel interval dintr-un alt calculator conectat, anularea tot reușește — scrie pe un modul la care calculatorul nu mai are acces. **Rezolvat**: `undo()` rezolvă dinamic `KIND_MODULE[entry.recordType] ?? 'admin'` și cheamă `assertModuleAccess`/`assertPinUnlocked` înainte de orice scriere; `/api/undo` rămâne tehnic în `OPEN_PATHS` (modulul nu se știe înainte de dispatch), dar nu mai e nepăzit — garda e în interiorul handler-ului.

### 6. Avans/cheltuială se pot dezsincroniza
Un avans e simultan un rând `expense` și un rând propriu `advances` (cu `expenseId`). Dacă cheltuiala e arhivată/editată direct din ecranul Cheltuieli (nu din Avans), rândul de avans rămâne neschimbat, referind o cheltuială acum neconformă — fără nicio gardă UI care să prevină asta. Deja semnalat ca risc acceptat de agentul §5; confirmat plauzibil la citirea codului curent.

### 7. ✅ Rezolvat (`a02bf25`) — `fxrate-backfill.mjs` se oprește complet la primul conflict, în loc să raporteze per-plată
Spre deosebire de migrarea §8 (`exchange-rates-plan-presets-to-common.mjs`, care raportează divergențele fără să cadă), bucla `--execute` din `fxrate-backfill.mjs:256-261` nu prinde eroarea unui `POST /api/record` eșuat (ex. 409 de la o editare concurentă) — un singur conflict oprește tot restul rulării. **Rezolvat**: scrierea per-plată e într-un try/catch, eșecurile se colectează în `failed` (raportate în log și în rezultat), migrarea continuă cu restul lotului; reparabil cu o simplă rerulare (idempotent).

### 8. ✅ Rezolvat (`b59a8ef`) — Ștergere în lot de copii arhivați — scanare dublă a tabelului per id
`record-editing.routes.mjs:102-108` — `readSnapshot()` chemat de 2 ori per id, în interiorul buclei `for (const id of ids)` (verificare vizite + verificare taxe). **Rezolvat**: ambele citiri scoase în afara buclei, un singur scan pentru tot lotul.

### 9. Testul `axe` (accesibilitate) nu e impus arhitectural — 49/118 componente din `shared/ui` nu-l au deloc
Inclusiv primitive de bază: `TextInput`, `Select`, `Checkbox`, `NumberInput`, `DateInput`, `Field`, `Button`, `DataTable`, `Drawer`, `Popover`, `Badge`. Nimic din `architecture.test.ts` (R1-R13) nu verifică asta — e doar o convenție per-fișier, nerespectată sistematic. **Fix:** regulă nouă de arhitectură care scanează `shared/ui/*.test.tsx` după `axe(`/`toHaveNoViolations`.

### 10. Componente mult folosite, fără niciun test unitar
`RowMenu` (13 fișiere), `FilterPills` (12), `ConfirmDeleteDialog` (11), `SelectionBar` (5), `MonthStepper` (6), `ServiceBadge` (3), `ScrollArea` (3) — au Storybook, dar nicio verificare automată la o regresie.

### 11. Testul de backup blocat (locked-file) nu testează de fapt nimic pe Windows
`backup.service.test.mjs:192-213`, unul din cele 2 teste `skip` permanente ale repo-ului — `openSync(locked, 'r')` nu blochează `unlinkSync` pe Windows, deci scenariul real (antivirus/Google Drive ținând un fișier deschis) nu a fost niciodată testat cu adevărat. Merită un lacăt mai puternic (deschidere pentru scriere / flag `O_EXCL`-style) ca testul să chiar exercite calea de avertizare.

## Scăzut

- **Validarea de alocare pentru plăți EUR e inertă** (`record-schema.mjs:622`) — compară lei cu EUR, trece mereu datorită raportului ~20x, nu prinde niciodată o supra-alocare reală la tarif EUR.
- **Testul de acoperire a rutelor** (`tests/architecture/route-modules-coverage.test.mjs:21`) prinde doar `path: '...'` cu ghilimele simple — un viitor `path: \`${BASE}/x\`` ar trece nedetectat, fără nicio poartă. Azi nu există niciun caz de genul (închis prin convenție Prettier, nu prin test).
- **Testul de graniță de import** (`tests/architecture/import-boundary-rules.mjs:36`) e regex, nu AST — un import dinamic construit din variabilă ar fi invizibil. Niciun caz curent în `src/`.
- **Nepotriviri doc/cod în `COMPONENTE.md`:** `SiblingPaymentRows` (§44b) și `BackupContents` (§3c) sunt descrise ca „Implementat" dar nu există ca entități separate — logica e inline în `PaymentFormDrawer`/nu există deloc. Risc: un viitor agent pierde timp căutând o componentă care nu a fost construită ca atare.
- **`FEEDBACK-01-10.md` §6c e învechit** — golul real azi e 1 componentă (`Toast`, are test dar nu are story), nu 3; „R12" a fost între timp realocat pentru altceva (moduleId+ModuleGuard pe rute).
- **Teste `axe` superficiale** — verifică doar randarea implicită, nu stările loading/error/disabled.
- `markSent()` din `sync-outbox.repository.mjs` — cod mort, nefolosit nicăieri.
- `audit_changes`/outbox cresc fără limită — tradeoff intenționat (jurnal de audit), accelerat de §7 care scrie acum 2 rânduri per acțiune în loc de 1.

## Verificat, fără bug (ca să nu se reverifice degeaba)

- Lanțul de încredere al identității dispozitivului la sincronizare (§7) — identitatea vine mereu din `device` verificat de server, nu din payload-ul autodeclarat. Solid.
- Protecția la traversare de cale pe restaurare backup (`assertBackupName`) — acoperă și noul flux de prima pornire (§4).
- Toate migrările din `scripts/migrate/` fac backup înainte de scriere, fără excepție, cu eroare de backup care oprește rularea (nu continuă silențios).
- Separarea curs/planuri în baza comună (§8) — curată, fără referințe vechi per-filială rămase.
- Codul „P" (§1.2) în pontaj — tratat identic cu zi lucrată nemarcată peste tot (salarizare, print).
- PIN Salarii după refactorizarea §7 — nicio cale de ocolire găsită.
- `EnrollDrawer` — o singură scriere atomică, nu există stare „copil fără grupă" la eșec parțial.
- Capacitatea grupei — deliberat neforțată server-side („Peste cu N" e stare UI suportată, nu eroare); nu există cursă de condiție pentru că nu există nicio aplicare de blocat.
- „Duplicate React key" din testele instabile sub sarcină — id-uri reale, unice; nu indică un bug de producție.
- Cele 5 formulare amânate la sweep-ul §3 (`WeeklySheetDialog`, `ReportExportDrawer`, `SmsNewMessageDialog`, `ExcelImportDialog`, confirmarea din `MonthView`) — toate au deja gardă proprie contra dublei trimiteri; golul e doar cosmetic/consistență, nu funcțional.
- Vechea amintire despre „capcanele de 1000 de rânduri"/PostgREST nu se aplică acestei aplicații (Node/SQLite, strat de date complet diferit de aplicația Nuxt/Supabase abandonată) — de corectat în memoria persistentă.

## Recomandare de prioritate

1. ✅ `fxrate-backfill.mjs` — conversia `allocations` reparată (`c3fe4b1`).
2. ✅ `BookingDrawer` — gardă anti-dublă-trimitere (`0b23512`).
3. ✅ `/api/state` — filtrat după profil (`3f0f6ef`).
4. Restul (medii + scăzute, punctele 4-11 de mai sus) — de programat ca puncte separate, fără presiune de timp.

Toate 3 fixurile de mai sus au `npm run check` verde (1489/1491 teste server) + `cd webapp && npx tsc -p . --noEmit` curat + `npx vitest run` verde (285/285 fișiere, 2416/2416 teste). Fiecare fix a fost verificat să pice fără el și să treacă cu el (nu doar scris, ci confirmat).
