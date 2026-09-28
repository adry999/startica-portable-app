# Audit B — funcționalități backend și domeniu partajat (2026-09-28)

Scop: codul scris în ultimele ~2 zile de agenți paraleli, în `src/features/personal`, `attendance`,
`report`, `receipts`, `sms-notify`, `expenses`, `billing`, `src/shared/domain`, `src/shared/format`
și rutele din `src/app/server` (`plan-presets`, `exchange-rates`, `bnm-exchange-rate`,
`kindergarten-settings`, sweep-urile din `create-branch-context`). Branch `master-v2`, HEAD `314a879`.
Audit read-only; nicio linie de cod modificată.

Metodă: citirea integrală a fișierelor din scop, confruntarea cu spec-urile (`docs/design/screens/`
14, 15, 16, 19, 20, 24) și planurile (`2026-09-27-personal-bazin.md`, `2026-09-27-sms-notify-p1.md`),
rularea testelor din scop (`node --test` — **425 teste, toate verzi**) și scripturi de verificare
pe baze `:memory:` pentru scenariile de salarizare (rezultatele sunt citate la fiecare constatare
marcată „verificat”).

Bilanț: **1 critic · 12 majore · 24 minore**.

---

## Critic

### C1. `pay()` pe mai mulți angajați lasă rânduri orfane în `comun` dacă un angajat eșuează — angajatul rămâne neplătibil pentru totdeauna (verificat)

`src/features/personal/server/salaries.service.mjs:172-234`

`runRevisionTransaction` deschide `BEGIN IMMEDIATE` doar pe baza filialei
(`src/core/server/persistence/revision-transaction.mjs:64`). Rândurile `advances` (deductedAt) și
`salary_payments` se scriu în `comun` prin `personalRepository.kinds.save`, fiecare cu propria
tranzacție auto-commit (`kind-repository.mjs:46-52`). Dacă bucla aruncă la al doilea angajat, filiala
face ROLLBACK (cheltuiala primului dispare), dar `comun` păstrează `salary_payments` + avansurile
marcate scăzute ale primului.

Scenariu (script pe două baze `:memory:`): STF-1 salariu 4400; STF-2 salariu 3000 cu avans 3000
(net 0). `pay({ staffIds: [STF-1, STF-2] })` → `normalizeRecord('expenses', { amount: 0 })` aruncă
`Suma: folosește o sumă validă…` (400). Rezultat:

```
STF-1 salary_payments in comun? true | cheltuiala in filiala? false
listMonth STF-1 paid? false
a doua plata STF-1 -> {"paid":[],"skipped":["STF-1"]}   ← pentru totdeauna
```

Consecințe: STF-1 apare „De plătit”, dar `pay()` îl sare mereu (rândul `SP-…` există); avansurile
lui, dacă avea, sunt marcate `deductedAt`/`deductedBy` către o plată inexistentă și nu mai apar în
listă (bani ascunși — exact ce comentariul din fișier promite că nu se întâmplă). Orice altă eroare
din buclă (validare de dată/metodă, `fail` pe orice) produce același efect.

Fix: (1) validează tot lotul **înainte** de tranzacție (rând calculat, `net > 0`, `date`/`method`
valide) și refuză cu mesaj pe nume; (2) scrie rândurile `comun` **o singură dată, la final**, într-un
singur `personalRepository.kinds.transaction(...)` executat ca ultim pas în callback-ul filialei; (3)
în `pay()`, un `salary_payments` a cărui cheltuială lipsește/e arhivată se tratează ca neplătit
(se rescrie), nu ca „skipped”.

---

## Majore

### M1. După plată, rândul și totalurile lunii arată brutul, nu netul plătit (verificat)

`salaries.service.mjs:53-63, 74-82`

`undeducted` filtrează `!advance.deductedAt`, deci după plată `advancesTotal = 0` și
`net = gross`; `totals.paid += row.net`. Script: avans 1000, salariu 4400 → înainte
`{gross:4400, advances:1000, net:3400}`; după plată `{gross:4400, advances:0, net:4400, paid:true}`,
`totals.paid = 4400`, dar cheltuiala `EXP-salariu-…` are `amount = 3400`. Ecranul 23c raportează cu
1000 lei mai mult decât a ieșit din casă.

Fix: când `payment` există, rândul ia `advances = Σ payment.advances` și `net = payment.amount`
(sursa de adevăr e plata, nu recalculul).

### M2. Net 0 (avansuri ≥ salariu) → 400 generic „Suma: folosește o sumă validă” și declanșează C1

`salaries.service.mjs:183-195`

`normalizePersonalRecord('salary_payments')` acceptă `amount: 0` (`requireAmount(…, true)`), dar
`normalizeRecord('expenses')` nu. Angajatul cu avansuri care acoperă salariul nu poate fi „închis”
niciodată, iar mesajul nu spune de ce.

Fix: înainte de tranzacție, `if (row.net <= 0) fail(`${staff.name}: avansurile acoperă salariul — nimic
de plătit.`)` sau scrie `salary_payments` cu `amount: 0` fără cheltuială (decizie de produs).

### M3. Salariul fix nu e pro-rata pentru un angajat intrat/ieșit în cursul lunii (verificat)

`src/features/personal/domain/salary-computation.mjs:36-43`, `timesheet-month.mjs:49-62`

`workingDays` numără doar zilele active ale angajatului, dar `amount` e salariul lunar întreg.
Script: angajat `since: 2026-09-15`, 12 zile lucrătoare active, 2 A →
`gross = 4400 − 4400·2/12 = 3666.67`. Cu 0 absențe ar primi 4400 pentru jumătate de lună.
Spec-ul nu tratează cazul; comportamentul actual e aproape sigur greșit.

Fix: `gross = amount · (workingDays − deductible) / workingDaysOfFullMonth` (zilele lucrătoare ale
lunii calendaristice, nu doar cele active) — de confirmat cu administratorul în `INTREBARI.md`.

### M4. Luna curentă se calculează (și se poate plăti) cu zilele viitoare „lucrate” (verificat)

`salaries.service.mjs:45` (`upTo: 'month'`), `salary-computation.mjs:45-50`

Script: mod `zi`, 300 lei/zi, `todayStr = 2026-09-10` → `gross 6600, "300 lei × 22 zile"`. Planul
alege deliberat `upTo: 'month'` pentru „o lună închisă”, dar `pay()` nu verifică că luna e închisă:
pe 10 septembrie se plătește toată luna, inclusiv absențele care nu s-au produs încă. Pentru `fix`,
absențele viitoare nu sunt încă scăzute.

Fix: `pay()` refuză `month >= today().slice(0, 7)` („Luna nu s-a încheiat”), iar `listMonth` pe luna
curentă folosește `upTo: 'today'` cu eticheta „estimare”.

### M5. `POST /api/personal/salaries` nu scrie audit, nu verifică filiala și nu are idempotență

`src/features/personal/server/salaries.routes.mjs:70-78`, `personal.repository.mjs:164-169`

Modificarea salariului (cea mai sensibilă înregistrare a modulului) nu lasă nicio urmă în Istoric;
toate celelalte scrieri Personal (angajat, concediu, setări, roluri) au `auditTrail.recordChange`.
`staffId` nu e verificat față de `staffForBranch(branchId)`. Același lucru pentru `pay()`:
`staffIds` nu e filtrat pe filiala activă (`salaries.service.mjs:159-163`), deci un angajat al
celeilalte filiale poate fi plătit din filiala curentă.

Fix: `auditTrail.recordChange({ action: 'personal: salariu', recordType: null, before, after })` +
`isStaffInBranch` în ambele rute.

### M6. `POST /api/kindergarten` poate da înapoi `nextReceiptNumber` → numere de confirmare reutilizate

`src/app/server/kindergarten-settings.routes.mjs:15-19`, `src/shared/domain/kindergarten-settings.mjs:77-78`

Ruta rescrie tot obiectul, inclusiv `nextReceiptNumber`, cu orice valoare ≥ 1. Formularul webapp
(`KindergartenSettings.tsx:157`) trimite valoarea încărcată la deschiderea filei: operatorul deschide
„Grădinița” (nr. 41), tipărește 3 confirmări din alt tab (42, 43, 44 → next 45), apoi salvează
denumirea → `nextReceiptNumber` revine la 41 → următoarele confirmări primesc 41…44 a doua oară.
Contrazice spec 15 („nu se reutilizează”). Fără audit.

Fix: pe POST, `nextReceiptNumber = max(input, current, max(payments.receiptNumber) + 1)`; audit
`recordChange` pe schimbarea numărului.

### M7. `obligation()` ignoră cursul înghețat pe achitare (`fxRate`/`amountEur`) — contrar spec 16 (reguli 5–6)

`src/shared/domain/tuition-obligation.mjs:24-35, 59-68`, `payment-allocations.mjs:12-25`

Achitările se salvează mereu în lei (`currency: 'MDL'`, webapp nu setează niciodată `'EUR'`), cu
`fxRate`/`amountEur` înghețate. `sumEntriesInCurrency` convertește însă cu
`eurToMdlRate(rates, entry.date)` din tabelul de cursuri, nu cu `payment.fxRate`. Scenarii:
(a) curs corectat manual pe achitare (12b, `fxRateSource: 'manual'`) → confirmarea spune 152,91 €,
Situația calculează altă sumă; (b) cursul zilei corectat ulterior în 12a → restul copilului se
schimbă retroactiv; (c) filiala nu are curs pentru ziua respectivă (fereastra de 30 de zile a
backfill-ului, offline) → copil „De verificat” deși plata poartă propriul curs.

Fix: `paymentIndex` duce `amountEur`/`fxRate` în intrări; `sumEntriesInCurrency` folosește
`entry.amountEur` când ținta e EUR și câmpul există, căzând pe tabel doar pentru plăți vechi.

### M8. Sweep-ul BNM rescrie `exchangeRates` cu un instantaneu vechi — corectarea manuală făcută între timp se pierde

`src/app/server/create-branch-context.mjs:307-327`

`current` se citește o dată, apoi urmează până la 30 de `await fetch` (10 s timeout fiecare); la
final se scrie `{ ...current, ...fetched }`. Un `POST /api/exchange-rates` (12a) sau
`/refresh` executat în acest interval (zeci de secunde la o filială nouă sau după o pauză) e
suprascris, împreună cu `exchangeRateSources`.

Fix: re-citește și îmbină setările imediat înainte de `setSetting`, sau scrie per zi obținută.

### M9. Șablonul implicit poate fi „de-implicit” → zero șabloane implicite

`src/features/sms-notify/server/sms-template.repository.mjs:53-62`, `sms.routes.mjs:208-227`

`save()` scrie `is_default = 0` când `isDefault` e fals și rulează `moveDefault` doar pe `true`.
Salvarea șablonului implicit cu bifa scoasă lasă tabelul fără implicit (comentariul din fișier
promite exact opusul). Webapp cade pe `defaultTemplate: null` → „Notifică” fără șablon.

Fix: în `saveTemplate`, dacă `before?.isDefault && !isDefault` → `fail('Alege alt șablon implicit mai
întâi.')`; `deleteTemplate` are deja garda simetrică.

### M10. `POST /api/sms-send` nu e idempotent — o reluare după cădere de rețea trimite (și plătește) tot lotul a doua oară

`src/features/sms-notify/server/sms.routes.mjs:259-262`, `sms-send.service.mjs:69-185`

Convenția clientului (`ApiError.kind === 'network'` → reia cu același `requestId`) nu are ce relua:
ruta nu primește `requestId`. Un lot de 60 de mesaje durează ≥ 60 s (`SEND_PAUSE_MS`); un timeout
HTTP al clientului urmat de retry dublează costul și SMS-urile primite de părinți. Nici jurnalul nu
poate detecta dublura (nu există cheie de lot).

Fix: `requestId` obligatoriu în corp, salvat pe fiecare rând `sms_log` (`batch_id`); un lot cu
același id întoarce rezultatul memorat, nu retrimite.

### M11. Avans dat pentru o lună deja plătită nu se scade niciodată și strică afișarea (verificat)

`salaries.service.mjs:87-127, 176-181`

Script: plată septembrie, apoi avans 500 cu `month: '2026-09'` → rândul devine
`{advances:500, net:3900, paid:true}`, `totals.paid 3900` (deși s-au plătit 4400), iar `pay()`
ulterior e `skipped`; avansul rămâne `deductedAt: null` la infinit.

Fix: `giveAdvance` refuză `month` cu `salary_payments` existent (sau îl mută pe luna următoare —
decizie), iar rândul plătit ignoră avansurile de după plată (vezi M1).

### M12. `firstUnpaidMonth` nu are cursuri → pentru copiii cu taxă în EUR sare lunile plătite parțial

`src/shared/domain/tuition-obligation.mjs:101-113`

Semnătura nu primește `rates`, deci `obligation()` primește `{}`; pentru un copil EUR cu o plată
în lei într-o lună, `paid` e `null` → `rest ?? 0 = 0` → luna e considerată „fără rest”. Formularul
de achitare (`payment-form.ts`) propune luna următoare, deși cea curentă mai are rest. Rezolvat
implicit de M7 (nu mai e nevoie de curs când achitarea poartă `amountEur`).

Fix: M7, sau parametru `rates` propagat din apelant.

---

## Minore

### m1. `amountInWordsRo` — greșeli de gramatică la compusele care se termină în 1 (verificat)

`src/shared/format/amount-in-words.mjs:79-90`, testul `amount-in-words.test.mjs:31` consacră forma greșită.

`101 → „o sută un leu”`, `1001 → „o mie un leu”`, `2000001 → „două milioane un leu”`,
`21001 → „…una de mii un leu”`, `101000 → „o sută o mie de lei”`. Corect: „o sută unu lei”, „o mie
unu lei”, „o sută una mii de lei” (cf. „o sută unu dalmațieni”). Articolul „un/o” e corect doar
pentru 1 izolat („un leu”, „o mie de lei”, „un milion de lei”). Apare pe documentul tipărit 16b.

Fix: în `countedNoun`, ramura `remainder === 1` doar când `n === 1`; altfel forma invariabilă
`unu/una` + plural fără „de”.

### m2. Sărbătoarea „26 decembrie” — de verificat cu art. 111 Codul muncii (nevalidat)

`src/shared/domain/holidays-md.mjs:44`. În lista pe care o cunosc, art. 111 prevede doar 25
decembrie; 26 decembrie ar face o zi lucrătoare să nu conteze în pontaj și salariu. Restul listei
(Paștele ortodox 2024–2028, Blajinii, 1 iunie etc.) verificat corect.

### m3. Contorul lunar SMS e per filială, nu „global pe instalare” cum afirmă README-ul și planul

`sms-notify/README.md:90`, `sms-send.service.mjs:74-79`; `sms_log` trăiește în baza filialei
(`create-branch-context.mjs:250-255`). Cu două filiale, limita se poate depăși de două ori.
Fix: corectează documentația (per filială) sau mută contorul în `comun`.

### m4. `staff-archive` fără `archivedAt` dez-arhivează în tăcere; `archivedAt < since` acceptat

`personal.routes.mjs:76-84`, `personal-schema.mjs:144-145`. Fix: cere `dateOK(archivedAt)` explicit
pe rută (dez-arhivarea să fie o acțiune separată) și `archivedAt >= since`.

### m5. Cursul manual: validare doar prin regex, două scrieri neatomice, fără audit și fără „motiv”

`exchange-rates.routes.mjs:29-38`. `2026-02-31` trece; spec 16 cere „curs + motiv”, dar ruta nu
acceptă motiv și nu scrie în jurnal. Fix: `dateOK`, `auditTrail.recordChange`, câmp `reason`.

### m6. Cascada ștergere/redenumire categorie compară numele exact

`expense-categories.routes.mjs:30-31, 48, 99`. O cheltuială cu „bucatarie” (import, date vechi)
nu se mută la General când se șterge „Bucătărie”; la următoarea pornire
`missingExpenseOnlyCategorySeeds` o vede ca nume nou → categorie duplicat. Fix: comparație
`comparable()` ca în `expense-categories.mjs:32`.

### m7. Semințele „din cheltuieli” au id aleator → duplicate la sincronizare

`expense-category-seeding.mjs:23`. Două calculatoare cu aceeași cheltuială orfană creează două
categorii cu același nume (ocolind `assertUniqueName`). Fix: id derivat determinist din numele
comparabil (`CAT-<slug>`).

### m8. `EXPENSE_CATEGORY = 'Salarii'` literal

`salaries.service.mjs:8`. Dacă operatorul a redenumit/șters categoria-sămânță, cheltuielile de
salariu creează o categorie-text orfană, re-însămânțată ca duplicat la pornire. Fix: rezolvă numele
după `CAT-salarii` din `records.categories`, cu cădere pe General.

### m9. Vizibilitate pe filiale incompletă în Salarii

`salaries.routes.mjs:92-97, 115-123`; `personal.repository.mjs:180-185`. `GET /api/personal/advances`
și `history` întorc avansurile/istoricul tuturor angajaților, nu doar ai filialei active (spec 24,
„Vizibilitate pe filiale”). Fix: `advancesForYear(year, branchStaffIds())`.

### m10. Concediile nu verifică existența/filiala angajatului

`personal.routes.mjs:121-135`, `leaves.service.mjs:30-47`. Spre deosebire de pontaj (`:108-109`),
un `leave.staffId` inexistent sau din cealaltă filială e acceptat și scrie rânduri de pontaj orfane.

### m11. Criteriul bifat „Salariile nu se văd fără PIN” e satisfăcut doar pe rutele Personal

Spec 24 `[x]` linia 37. Sumele apar fără PIN în `/api/state` (cheltuieli „Salariu 2026-09 · Ana
Popescu”, „Avans …”) și în Istoric (`after: payment` la `personal: plată salariu`, audit-ul
cheltuielilor). Planul (decizia 7/8) acceptă cheltuiala vizibilă, dar criteriul din spec e bifat
fără această rezervă. Fix: menționează excepția în spec sau redactează suma în audit-ul Personal.

### m12. Fus orar: `today` UTC în `salaries.service.mjs:36`

Restul codului folosește `today()` local din `calendar-month.mjs`. Momentan fără efect
(`upTo: 'month'`), dar devine bug la M4. Fix: importă `today` din `#shared/domain/calendar-month.mjs`.

### m13. Fus orar în jurnalul SMS

`sms-log.repository.mjs:84-89` (`substr(created_at,1,7)` = luna UTC) vs `monthlyStats` (luna
locală, `:46-50`) → un SMS trimis pe 1 octombrie 01:30 apare în „Sep” în tabelul lunilor și în
„luna curentă” în statistici. `sms.routes.mjs:196-201` (`T00:00:00.000Z`) și
`expireOldEntries(:198)` folosesc miezul nopții UTC (2–3 h decalaj). Fix: calculează limitele cu
`localMonthBounds`/`Date` local peste tot.

### m14. `attendance-rules.isChildEnrolledOn` folosește `??`, nu `||`

`attendance-rules.mjs:38`. `attendanceDate: ''` (formular gol) ascunde `contractDate`; copilul e
„înscris” de la începutul timpului. Fix: `child.attendanceDate || child.contractDate || ''`.

### m15. `POST /api/attendance` nu respectă „copiii arhivați sau înscriși după această dată nu apar”

`attendance.routes.mjs:48-58`. Se acceptă marcaje pentru copii arhivați sau înainte de înscriere.
Fix: `isChildEnrolledOn(child, date)` în `assertValidChange`.

### m16. `sms-send`: validare slabă la graniță

`sms-send.service.mjs:69-72, 129`. `messages` nu e verificat că e array (TypeError → 500), `source`
și `month` nu sunt validate (ajung în jurnal), telefonul e validat dar trimis nenormalizat
(`message.phone`, nu rezultatul `normalizeMoldovanPhone`), fără plafon pe mărimea lotului și fără
verificarea existenței `childId`.

### m17. `refreshDeliveryStatuses` marchează „unknown” înainte de verificare

`sms-send.service.mjs:234-237`. Un SMS de 49 h care ar fi întors „Delivered” devine „unknown”
definitiv. Fix: verifică întâi lotul pending, apoi marchează.

### m18. `GET /api/sms-status` face o cerere de rețea la fiecare poll

`sms.routes.mjs:98-113`. Fix: cache cu `balanceCheckedAt` (ex. 5 min) sau refresh doar la acțiune.

### m19. Răspunsul `giveAdvance`/`pay` la replay

`salaries.service.mjs:126, 235`. La reluare cu același `requestId`, `advance` e `undefined` (id nou
generat) și `paid`/`skipped` sunt goale. Fix: id determinist din `requestId`
(`ADV-<requestId>`) și recitire.

### m20. `normalizePersonalRecord('staff')` nu validează `birth`, `idnp`, `address`

`personal-schema.mjs:123-146`. Orice tip trece (obiect, număr). Fix: `text()` pe cele trei,
`dateOK(birth)` când e completat.

### m21. `leaveDaysRemaining` atribuie concediul întreg anului lui `from`

`leave-days.mjs:29-31`. Un CO 28.12–08.01 consumă toate zilele din anul vechi. Fix: numără
`leaveWorkingDays` filtrate pe `date.slice(0,4) === year`.

### m22. `toMdlToday` fără curs = 1:1

`billing/domain/status-summary.mjs:21-24`. 100 € apar ca 100 lei în carduri când nu există niciun
curs (filială nouă, offline). Documentat, dar înșelător. Fix: `null` + etichetă „fără curs”.

### m23. `/api/record` nu protejează `receiptNumber` server-side

`record-editing.routes.mjs:18-51`. Formularul păstrează câmpul (`buildPaymentRecord` întinde
`previous`), dar orice alt client poate șterge/schimba numărul. Fix: `receiptNumber: existing?.receiptNumber`
forțat la `update`. Tot aici, `assignReceiptNumber` numerotează și achitări arhivate
(`receipt-numbering.service.mjs:39-41`).

### m24. Presetări de plan: `priceEur` fără plafon și fără rotunjire la ban

`plan-presets.routes.mjs:63-64`. Fix: `requireAmount`-like (≤ 100 000 000, 2 zecimale).

### Observații de convenții (fără severitate)

- `src/shared/domain/money.mjs:2` — identificatori interziși `s`, `r`.
- `src/features/personal/README.md:27` — „Rutele … se adaugă în Task 3” e depășit; rutele există.
- `expense-categories.routes.mjs:27` și `personal.repository.mjs:33-38` — scrieri la construcția
  rutelor/repository-ului (efect secundar în composition root); documentat, dar rulează și în teste
  care construiesc rute doar pentru citire.
- Granițe de import respectate în tot scopul (niciun feature nu importă alt feature; `shared` nu
  importă `core`/`features`).

## Criterii bifate `[x]` care nu sunt satisfăcute integral de cod

| Spec | Criteriu | Stare |
| --- | --- | --- |
| 24-personal:35 | „Avansul se scade o singură dată” | scăderea e unică (ok), dar afișarea de după plată (M1) și avansul post-plată (M11) contrazic ecranul |
| 24-personal:37 | „Salariile nu se văd fără PIN” | rutele Personal sunt protejate; sumele se văd în Cheltuieli și Istoric (m11) |
| 15-tiparire (Numerotare) | „crește la prima tipărire și nu se reutilizează” | reutilizabil prin `POST /api/kindergarten` (M6) |
| 16-planuri-eur regula 5–6 | `fxRate`/`amountEur` „înghețate” | raportul le citește înghețate (spec 20 ok), `obligation()` nu (M7) |

Restul criteriilor bifate din 14, 19, 20 sunt susținute de cod și teste.

---

## Lista de fix-uri, prioritizată, în loturi cu fișiere disjuncte

**Lot 1 — Salarii (personal/server + domain):** `salaries.service.mjs`, `salary-computation.mjs`,
`salaries.routes.mjs`, `timesheet-month.mjs` (+ teste) → C1, M1, M2, M3, M4, M5, M11, m8, m9, m12, m19.
Ordinea: C1 și M2 împreună (validare înainte de tranzacție + `comun` într-o singură tranzacție la
final), apoi M1/M11 (rândul plătit din `salary_payments`), apoi M4/M3/M5.

**Lot 2 — Domeniu EUR (shared):** `tuition-obligation.mjs`, `payment-allocations.mjs` (+ teste) → M7, M12.

**Lot 3 — Numerotare confirmări:** `kindergarten-settings.routes.mjs`, `receipt-numbering.service.mjs`
→ M6, m23.

**Lot 4 — Cursuri:** `create-branch-context.mjs` (sweep), `exchange-rates.routes.mjs` → M8, m5.

**Lot 5 — SMS:** `sms.routes.mjs`, `sms-template.repository.mjs`, `sms-send.service.mjs`,
`sms-log.repository.mjs`, `sms-notify/README.md` → M9, M10, m3, m13, m16, m17, m18.

**Lot 6 — Categorii cheltuieli:** `expense-categories.routes.mjs`, `expense-category-seeding.mjs`
→ m6, m7.

**Lot 7 — Format/calendar:** `amount-in-words.mjs` (+ test), `holidays-md.mjs` → m1, m2.

**Lot 8 — Personal echipă/concedii:** `personal.routes.mjs`, `personal-schema.mjs`, `leave-days.mjs`,
`leaves.service.mjs`, `personal/README.md` → m4, m10, m20, m21, README.

**Lot 9 — Prezență/billing/presetări:** `attendance-rules.mjs`, `attendance.routes.mjs`,
`status-summary.mjs`, `plan-presets.routes.mjs` → m14, m15, m22, m24.

Loturile 2–9 sunt independente între ele și de lotul 1; pot rula în paralel.
