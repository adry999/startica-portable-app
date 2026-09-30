# Întrebări / decizii blocate

## ✅ B1 — diagnosticul plăților mixte — rezolvat, decizie (b) Cash provizoriu

Rulat `scripts/diagnostic/b1-payment-methods.mjs` (doar citire) pe `Startica_Date/startica.db`: **811 plăți totale, 7 cu tender necunoscut** (`→ „Altele”`). Nicio valoare brută nu e `numerar`/`card bancar`/`virament` (adică `normalizeTenderMethod()` din pasul 2 nu rezolvă niciuna din cele 7) și **niciuna nu are câmpuri brute cu suma pe metodă** (`cash`/`card`/`cashAmount`/`cardAmount`/`transferAmount` — toate lipsă), deci migrarea automată din pasul 3 nu are ce folosi ca sursă:

| id | dată | copil | `method` brut | sumă |
|---|---|---|---|---|
| PAY-0055 | 2025-04-09 | (fără) | „Mixtă” | 12 000 |
| PAY-0447 | 2026-03-02 | CSV-71 | „De verificat” | 2 100 |
| PAY-0452 | 2026-03-02 | (fără) | „Mixtă” | 12 000 |
| PAY-0558 | 2026-05-04 | CSV-56 | „De verificat” | 13 105 |
| PAY-0574 | 2026-05-08 | CSV-31 | „De verificat” | 13 121 |
| PAY-0575 | 2026-05-08 | CSV-51 | „De verificat” | 13 121 |
| PAY-0783 | 2026-08-24 | CSV-95 | „Mixtă” | 13 033 |

Toate cele 7 intră deci în **De rezolvat** cu „Plată mixtă: împarte suma pe Cash / Card” (pasul 3, varianta „nu au → De rezolvat”), nu printr-o migrare automată. Decizie necesară: (a) confirmă că da, aceste 7 merg în De rezolvat și rămân cu tender-ul vechi (`method` brut păstrat pe rând, doar afișarea din UI nu le mai pune la „Altele” fals-liniștitor, ci le arată clar ca „de rezolvat”) până le împarte cineva manual, sau (b) vrei să le atribui provizoriu integral pe o singură metodă (ex. Cash) ca să dispară complet „Altele” chiar și înainte de rezolvarea manuală? Implementarea continuă cu varianta (a) până la răspuns — e cea descrisă la pasul 3 din B1.

**Rezolvat 29.09, 23:19** (vezi `RASPUNSURI.md`): varianta **(b)** — cele 7 se atribuie provizoriu integral pe Cash, ca să dispară din „De rezolvat” înainte de rezolvarea manuală. Execuția (scriptul pe baza reală) se face separat, în paralel — nu mai e nevoie de alt cod, doar de rulare.


Punctele din `docs/design/COADA-DE-LUCRU.md` care au nevoie de o decizie a utilizatorului înainte de a fi terminate integral. **Toate punctele de mai jos au primit răspuns în `docs/design/RASPUNSURI.md` (2026-09-26, 20:20) — vezi acolo detaliul complet.** Rămân aici doar ca istoric + trimitere.

## ✅ Fișa copilului — relația (Mamă/Tată) + „persoane autorizate să ridice copilul” — rezolvat, implementat 29.09

`docs/design/screens/28-fisa-copilului-date.md` (decizii utilizator 29.09, §0) tranșează întrebarea de mai jos (istoric, păstrată): `parentRelation`/`parent2Relation` (string liber, ≤ 40) + `pickupPersons` (≤ 10, `{id, name, relation?, phone?, note?}`) adăugate direct pe `Child` — implementat în `record-types.d.mts` + `record-schema.mjs`, cu teste. Rămân de conectat la UI în A2 (formular) și A3 (fișă).

**Simplificare deliberată față de spec 28:** spec-ul cere kind-uri separate (`child_notes`, `child_documents`) tocmai ca să evite conflictul de sincronizare pe tot `Child` când două note/persoane se scriu simultan pe calculatoare diferite (§1). Nu am făcut migrarea la kind separat pentru note — am extins direct `ChildNote` cu `author`/`updatedAt`/`deletedAt`, păstrate pe `Child.notes`, exact ca `pickupPersons`. Risc acceptat: două note scrise în aceeași zi, pe două calculatoare, pentru același copil, ar da conflict pe toată fișa (`CONFLICT_KIND: children`), nu doar pe notă. Pentru un singur calculator per filială (cazul curent, fără sincronizare multi-device activă în producție), riscul e teoretic. Dacă/când sincronizarea multi-device pe aceeași filială devine reală, migrarea la `child_notes` ca kind separat (exact cum descrie spec 28) rămâne recomandarea corectă — nu e refuzată, doar amânată.

**Complet amânat, cere plan tehnic propriu (spec 28 §5 cere explicit un plan în `docs/superpowers/plans/` înainte de cod, ca la EUR/BNM și filiale):**
- `child_documents` — kind nou + stocare fișiere pe server (`documente/<sha256>`), endpoint-uri upload/download cu validare tip/mărime, coadă proprie de sincronizare a blob-urilor (`sync_blob_outbox`), descărcare leneșă, curățare orfani. E backend + UI, nu doar aliniere vizuală — A9 din ALINIERE-DESIGN.md rămâne placeholder până atunci.
- `payer_aliases.iban`/`nameKey` — kind-ul `payerAliases` există deja (cu `alias`/`childId`/`createdAt`), dar fără `iban` sau `nameKey` normalizat pentru potrivire pe IBAN (spec 28 §5, §6). Card-ul „Plătitori reținuți” din A3 poate arăta ce există acum (nume, dată, N achitări) dar nu IBAN-ul mascat cerut de Copii.dc.html#2b, până nu se adaugă acele câmpuri + `extractPayer()`.

Nu blochează A2/A3: relația părinților și persoanele autorizate se pot construi acum (schema există); notele cu autor/editare/ștergere la fel; documentele și IBAN-ul plătitorilor rămân cu ce era înainte (placeholder, respectiv fără IBAN) până la un plan tehnic dedicat.

## ✅ Modulul 2 (Copii) — CF-2, fișa copilului: „Plătitori reținuți” lipsesc din modelul de date

**Actualizat 2026-09-29:** „Date personale” (IDNP + adresă) s-a implementat între timp — `Child.idnp`/`Child.address` există în schemă, în `ChildFormDrawer` și în `ChildProfileView` (verificat direct în cod, nu doar din audit). Rămâne deschis doar „Plătitori reținuți”: niciun concept `payer_aliases` nu există în cod — nici schemă, nici API, nici UI. Nu e tweak de UI, e funcție nouă (schemă + backend + UI + ștergere alias).

Decizie necesară: (a) adăugăm un tabel/câmp nou pentru plătitori reținuți (plan tehnic separat, ca la EUR/BNM sau filiale), sau (b) rămâne amânat definitiv?

Până la răspuns: fișa copilului rămâne fără „Plătitori reținuți" — restul din CF-1…CF-10 e închis (vezi `COADA-DE-LUCRU.md`).

**Rezolvat 30.09, 12:30** (vezi `RASPUNSURI-30-09.md` punctul 2): cardul se face acum din `payerAliases` existent — nume, „din dd.mm.yyyy”, „N achitări”, ștergere alias (toast „Anulează”). IBAN mascat rămâne amânat, cu plan tehnic separat (`iban`, `nameKey`, `extractPayer()`); până atunci rândul arată „fără IBAN, doar numele”.

## ✅ Achitări — „Tipărește chitanța” (punctul 5) — confirmat amânat
Rămâne amânat, se reia împreună cu ecranul 16b (`screens/15-tiparire.md`). Nimic de schimbat acum.

## ✅ Cheltuieli — filtrul Metodă (punctul 6b) — rezolvat, de implementat
Se adaugă `method?: 'cash' | 'card' | 'transfer'` pe `Expense` (schemă + normalizare + select în formularul 15c, implicit Cash la cheltuieli noi). Cheltuielile vechi rămân fără metodă: apar doar la „Toate”, coloana Metodă arată „—”. Fără pastilă „Nespecificat”. Vezi punctul 6b din coadă.

## ✅ Monedă — modelul ales (punctul 8) — rezolvat, de implementat
Nu se ia niciuna din cele două variante descrise inițial mai jos întocmai. Modelul ales (b, redus, peste backend-ul existent):
- `feeHistory.currency: 'MDL'|'EUR'` rămâne cum e în cod — fără migrare automată a copiilor vechi.
- `Payment` capătă `fxRate` + `amountEur` (pe lângă `amount` lei + `currency`). La salvare, dacă taxa copilului e EUR: `fxRate` = cursul BNM din ziua plății, `amountEur = round2(amount / fxRate)`, ambele îngheațate.
- Obligația copilului cu taxă EUR se calculează în EUR din `amountEur`. Agregatele pe mai mulți copii rămân cum sunt deja (conversie la curs).
- Avansul rămâne în lei.
- Planurile = presetări simple în Setări (nume + preț EUR), fără `plan_id` obligatoriu, fără `plan_price_history` în v1.
- `16-planuri-eur.md` actualizat (vezi commit-ul care însoțește acest fișier) — `plan_id`/`monthly_fee_eur`/`amount_mdl` înlocuite cu `feeHistory.currency` + `Payment.fxRate`/`amountEur`.

_(istoric — descrierea inițială a conflictului, păstrată pentru context)_
Backend-ul deja cherry-pick-uit implementează monedă dublă simplă (`currency: 'MDL'|'EUR'` liber pe fiecare taxă/plată). `16-planuri-eur.md` descria inițial un model diferit (planuri fixe EUR, `plan_id`, `amount_mdl`/`fx_rate`/`amount_eur`). Rezolvat prin modelul (b) de mai sus — nu s-a ales niciuna din variantele „totul sau nimic” inițiale.

## ✅ Folder străin la rădăcina proiectului — `Startica V2.zip` — șters
Găsite netrasate la rădăcina repo-ului (nu în `docs/design/`), 60 de fișiere sub `Startica V2/design/{screens,web}/`. `docs/design/` însuși e deja actualizat (RASPUNSURI.md, screens/*.md, *.dc.html — toate modificate) — par resturi de la dezarhivarea sincronizării, nu conținut încă neaplicat. **Nu le-am şters** — doar excluse din `npm run check` (`.prettierignore`) ca să nu blocheze verificarea. Dacă sunt într-adevăr resturi, se pot şterge cu `rm -rf "Startica V2" "Startica V2.zip"`; dacă sunt ceva în lucru, spune ce.

**Rezolvat 29.09, 23:19:** erau resturi, confirmat de utilizator. `Startica V2.zip` șters de la rădăcina repo-ului (folderul `Startica V2/` nu exista deja).

## ✅ Situația plăților — comentariul din `useStatus.ts` (punctul 7) — rezolvat, de implementat
Comentariul „fără filtre — situația unei luni trebuie să rămână completă” e depășit. Designul 7a are intenționat pastilele Grupa. Intenția se păstrează altfel: filtrul restrânge **doar tabelul**, cardurile de sus rămân mereu pe toată luna (ca la Achitări). Comentariul se rescrie în acest sens.

## ✅ Situația plăților — ecranul complet (punctul 10) — rezolvat, plan înainte de cod
Ecran separat, plan scris înainte de cod (`docs/superpowers/plans/`). Ordinea: (1) pastilele Grupa — punctul 7, (2) cele 4 carduri + modul An școlar + harta — punctul 10, (3) SMS — după P1 din spec-ul SMS.

## ✅ Raport contabil (punctul 14) — selectorul de filială din export — rezolvat, implementat
`20-raport-contabil.md` 19b cerea „Filiala (Ambele pe foi separate / una)”, amânat provizoriu până la filiale (Faza 6 a designului, `2026-09-27-filiale.md` Faza 4 a planului). Implementat: `ReportExportDrawer.tsx` arată grupul „Filiala” doar când sunt mai multe filiale (`GET /api/branches`), cu opțiunile „<filiala curentă>” și „Ambele (o foaie pe filială)”; pe PDF grupul e dezactivat („PDF-ul tipărește filiala deschisă”, PDF rămâne pe filiala curentă). „Ambele” citește celelalte filiale read-only (`GET /api/branches/records?id=`), calculează raportul cu `buildForRecords` (peste `buildAccountingReport`, pur) și scrie un Excel cu `buildMultiBranchWorkbook`: o pereche de foi Încasări/Cheltuieli per filială + un Rezumat comun cu total. Criteriul din `20-raport-contabil.md` e bifat.

## ✅ Încărcare (punctul 12) — pasul „Sincronizez” și „Lucrez fără legătură” — redeschis 30.09, blocaj arhitectural
Decizia veche (mai jos, tăiată) presupunea că nu există server de sincronizare. Între timp `src/features/sync/` există (Faza 6 nu mai e exclusă), deci „Lucrez fără legătură” + „Ultima sincronizare” pe 21c ar avea sens — dar codul actual nu poate arăta corect acest ecran:
- `app-session-store.mjs` (`load()`) cheamă `/api/sync/status` **abia după** ce `/api/state` a reușit și `ready` a devenit `true` (`accept()` setează `ready=true` imediat ce state-ul vine) — sincronizarea explicit „nu blochează pornirea”. Deci exact în scenariul 21c (15s+, `/api/state` nu răspunde), pasul de sincronizare nici n-a apucat să pornească — nu e el cel blocat.
- `lastSyncedAt` există doar în memorie în `sync-engine.service.mjs`, resetat la fiecare pornire a serverului, nescris niciodată în `sync.json` sau altundeva persistent. `session.routes.mjs`'s `syncSummary()` nu-l expune deloc (`{configured, deviceName, serverUrl}`).
Ca să afișăm o „Ultima sincronizare” reală pe 21c ar trebui persistat `lastSyncedAt` în sync engine — schimbare de backend mai mare decât UI-ul din punctul 2, pe cod de sincronizare deja verificat/sensibil. Decizie: **nu implementez acum** butonul „Lucrez fără legătură” + ora ultimei sincronizări pe 21c; rămân „Încearcă din nou” și varianta cu eroarea bazei locale + „Deschide dosarul cu backupuri” (ca înainte). Restul punctului 2 (21a, 21b) merge înainte. Revine ca task separat când se persistă `lastSyncedAt`.

~~Nu există server comun (Faza 6 exclusă): pasul de sincronizare nu apare (spec-ul permite asta), iar pe 21c butonul „Lucrez fără legătură” nu are sens fără server comun — rămân „Încearcă din nou” și varianta cu eroarea bazei locale + „Deschide dosarul cu backupuri”.~~

**Rezolvat 30.09, 12:30** (vezi `RASPUNSURI-30-09.md` punctul 5): da, ca task separat, după terminarea migrării pasului 4 (§4 din `PROMPT-CLAUDE-CODE-5.md`). Întâi se persistă `lastSyncedAt` în `sync.json` (`sync-engine.service.mjs`), expus în `/api/session` (`syncSummary`), apoi 21c după `Incarcare.dc.html`. Plan scurt în `docs/superpowers/plans/` înainte de cod.

## ✅ Personal + Bazin (`docs/superpowers/plans/2026-09-27-personal-bazin.md`) — 6 întrebări deschise, decise provizoriu și deja implementate
Planul le listează cu recomandarea pe care o și urmează în cod; mutate aici ca să nu se piardă, cu răspunsul deja construit:
1. **Valorile implicite ale bazinului** (150 lei/ședință, 30 min, 09:00–11:30 din 30 în 30, locuri nelimitate, lipsa nemotivată se taxează, antrenorul plătit per copil prezent, 60 lei) — doar precompletare de formular, în 22d se schimbă fără cod nou.
2. **Valorile implicite ale Personalului** (`annualLeaveDays = 28`, `deductOnlyUnexcused = true`, departamentele/rolurile din spec) — seminate o singură dată la crearea bazei `comun`, editabile din 23e.
3. **Codul „I” (învoire)** — rămâne în afara ciclului de clic din 23b (doar CO/CM/A); API-ul îl acceptă și legenda îl tipărește, fără ecran propriu în V1.
4. **Zilele rămase de concediu** scad și pentru CO planificat, nu doar pentru cel trecut — fișa arată „14 din 28 · 7 planificate”.
5. **Salariul fix al unui angajat cu ambele filiale** se plătește din filiala activă la momentul „Plătește”; cealaltă arată „Plătit din <filiala>”. Un antrenor `bazin` se plătește separat, per filială.
6. **Salariul antrenorului rămâne vizibil fără PIN** pe cardul din 22c — consemnat explicit în textul din setările 22d, nu ascuns.

Nu blochează nimic din Task 12 (sincronizarea setului comun) — consemnate aici doar ca să nu rămână doar în planul tehnic.

## ✅ A3f — cele 5 verificări de logică salarii — toate 5 rezolvate
Verificat cod + teste, nu doar citit. Rezultat: 4 din 5 erau deja corecte; 1 (#5) era un gol real, fixat (vezi commit `fix(personal): loc în UI pentru annualLeaveDays/deductOnlyUnexcused`).

1. **`readCoachPayForMonth` injectat la pornire?** ✅ Da — `src/app/server/create-branch-context.mjs:282` îl construiește (citește setările Bazinului + `bookings`/`sessions` prin `coachPayForMonth`) și îl pasează la `createPersonalRoutes` (linia ~355), care îl dă mai departe la `salaries.routes.mjs` → `salaries.service.mjs`. Antrenorii mod `bazin` NU rămân „de închis”; `rowForStaff` îl apelează direct (`salaries.service.mjs:99`).
2. **Plata creează cheltuiala „Salariu <lună> · <nume>”, minus avansuri, marchează avansurile scăzute?** ⚠️ Parțial altfel, DELIBERAT — cheltuiala se creează la categoria Salarii, suma = brut minus avansurile nescăzute (`row.net`), și avansurile chiar se marchează `deductedAt`/`deductedBy` în aceeași tranzacție atomică (`salaries.service.mjs`, funcția `pay()`). **Diferență față de textul din spec:** descrierea e `Salariu <lună>` **fără numele angajatului** — comentariul din cod (m11, `24-personal:37`) spune explicit că e intenționat: cheltuiala e vizibilă în Cheltuieli/Istoric fără PIN, iar identitatea angajatului trebuie să rămână „în spatele cortinei”. Nu am schimbat asta ca să respect spec-ul literal — pare o decizie de confidențialitate deja luată. **Întrebare pentru tine:** rămâne așa, sau chiar vrei numele în descriere (caz în care suma unui salariu individual ar deveni vizibilă oricui vede Cheltuielile, fără PIN)?

**Rezolvat 29.09, 23:19:** rămâne așa — descriere generică „Salariu <lună>”, fără nume. Nimic de schimbat.
3. **Avansul intră în Cheltuieli în ziua dării, fără dublare la plată?** ✅ Da — `giveAdvance()` creează cheltuiala imediat, cu `date` = ziua dării. La `pay()`, avansurile NU se re-cheltuiesc — doar se marchează `deductedAt`, iar cheltuiala nouă a plății e doar pentru `row.net` (brutul minus avansuri). Confirmat și prin comentariile M1/M11 din cod.
4. **Salariul se vede pe fișa angajatului (23j) după PIN?** ⚠️ Parțial altfel — `StaffProfilePage.tsx:168-172` arată cardul „Salariu” mereu mascat (`•••••`) cu link „Vezi cu PIN →” care **navighează către fila Salarii** (`/personal?tab=salarii`, ea însăși în spatele PIN-ului), nu dezvăluie suma inline pe fișă după introducerea PIN-ului. Criteriul „Salariile nu se văd fără PIN” (spec 24, §7) e respectat; dacă vrei dezvăluire inline pe fișă (nu doar redirecționare), e un punct separat de implementat — spune dacă îl vrei.

**Rezolvat 29.09, 23:19:** rămâne doar link către fila Salarii, fără dezvăluire inline pe fișă. Nimic de schimbat.
5. **Loc în UI pentru `deductOnlyUnexcused`/`annualLeaveDays`?** ❌ → ✅ FIXAT. Backend-ul (`/api/personal/settings`, validare completă în `personal.repository.mjs`) și hook-ul (`usePersonal().saveSettings`) existau deja, complet funcționale — dar `saveSettings` nu era apelat din nicăieri în UI. Adăugat în drawer-ul „Funcții” (`RolesDrawer.tsx`, 23e): câmp numeric (0-365) + bifă, cu validare și testare (2 teste noi).

## ✅ A4 Bazin — rândul „Antrenor: <nume>” din 22a cu mai mulți antrenori — confirmat
Spec (`ALINIERE-DESIGN.md`, 22a rând info) arată mockup-ul cu un singur antrenor: „Antrenor: **Rusu Vlad**” stânga, legenda dreapta. Codul (`pool_bookings.coachId`) permite mai mulți antrenori pe aceeași filială. Implementat: rândul arată toți antrenorii configurați, uniți prin virgulă („Antrenor: Rusu Vlad, Ion Pop”); dacă nu e niciun antrenor configurat încă, rândul dispare (rămâne doar legenda, dreapta). Nu am găsit alt loc în spec care să lămurească formatul pentru mai mulți — dacă vrei alt format (listă pe rânduri, doar primul + „și încă N”, etc.), spune și schimb.

**Rezolvat 29.09, 23:19:** confirmat formatul cu virgulă, cum e deja implementat. Nimic de schimbat.

## ✅ A6 — Asociere achitări: pragul „scor” pentru cele 3 trepte de potrivire — confirmat ≥2

Spec (`ALINIERE-DESIGN.md` A6) cere „scor 12px/800” pe cardul de sugestie; `11-de-rezolvat.md` §9c descrie 3 trepte calitative (Mare/Posibil/Slab, mint/galben/neutral), fără prag numeric. `suggestChildren()` (`payment-name-matching.mjs`) calculează deja un scor intern (nume potrivit = +3, sumă = taxa exactă pe N luni = +2, toate lunile neachitate = +2, parțial = +1, plătitor reținut = +1000) — dar acest scor n-a fost gândit ca prag de afișare, doar ca ordine de sortare a sugestiilor. Implementat: `nameMatch` → „Potrivire mare” (mint); fără nume, `score ≥ 2` → „Posibil” (galben); `score < 2` (adică exact 1, un singur indiciu slab) → „Slab” (neutru). Nu am arătat scorul brut (ar fi confuz — un plătitor reținut ar arăta „1000”). Pragul „2” e o alegere rezonabilă, nu vine din spec — dacă vrei alt prag sau alt mod de afișare a scorului, spune și schimb.

**Rezolvat 29.09, 23:19:** pragul ≥2 rămâne așa cum e implementat. Nimic de schimbat.

## ✅ A7 — Backup și setări (10c) / Notificări (10b): 3 goluri — toate scoase din design

Ecranele erau deja aproape identice cu spec-ul (grid-uri, radius, Toggle 46×26 `--orange`, „Fără Rezumat săptămânal” — toate deja corecte). Am corectat doar ce era pur vizual (padding/radius cardurilor ①②③, „Startica v” înaintea versiunii). 3 lucruri din spec nu există deloc în cod și sunt funcții noi, nu tweak-uri — nu le-am construit fără confirmare:

1. **„Probleme la backup” (10b)** — al 4-lea comutator din listă (Restanțe/Zile de naștere/Vizite/**Probleme la backup**). Nu există `backupProblemsEnabled` în `notification-preferences.mjs` și nicio verificare periodică a stării backup-ului care să trimită un mesaj Telegram la eșec. Ar cere: câmp nou în schemă + o sarcină (job) care verifică `useBackup`/`backupData.health` și trimite mesaj. **Rezolvat 29.09, 23:19: scos din design, nu se construiește.**
2. **„Zonă periculoasă” (10c, border `--pink`)** — spec-ul cere un card cu o acțiune distructivă lângă cardul Grădinița, dar nu spune care acțiune. N-am găsit nicio funcție distructivă existentă de mutat acolo (ștergere totală a filialei? resetare?) — nu am inventat una. **Rezolvat 29.09, 23:19: scoasă din design, nu se adaugă nicio acțiune distructivă.**
3. **„Importă copii din CSV” (`ChildrenCsvDialog`, 10c → Import și export)** — nu există deloc în webapp (doar Excel: `useExcelTransfer`, „Import Excel”/„Export Excel complet”). Ar cere un dialog nou + o rută de parsare CSV pe server. **Rezolvat 29.09, 23:19: rămâne doar Excel, CSV nu se construiește.**

**Divergență deliberată, nu bug:** dreapta grid-ului din 10c (spec: cardul „Grădinița” + zona periculoasă) e azi cardul „Import și export” — pentru că „Grădinița” a devenit între timp propria filă completă (16a, `KindergartenSettings`), nu mai încape ca rezumat mic lângă listă. N-am mutat-o înapoi.

## ✅ B3 — diagnostic (doar citire): cheltuieli care par încasări de bazin — decizii luate 29.09, migrare executată 30.09

Rulat `scripts/diagnostic/b3-pool-expenses.mjs` (nou, doar citire — `DatabaseSync(..., { readOnly: true })`) pe ambele baze active:

- `Comun/Startica_Date/startica.db` — 0 cheltuieli în total (normal, „Comun” nu ține date financiare per filială).
- `Startica_Date/startica.db` — **143 cheltuieli** cu categoria exact „Bazin” (nearhivate), nicio potrivire suplimentară după descriere. Toate din **2026-06-02 până în 2026-07-31**. Sumă totală **113.250,00 lei** (53.250 în iunie, 60.000 în iulie). Sume individuale între 300 și 10.000 lei (majoritatea 600 — o ședință; câteva mai mari, posibil mai multe ședințe plătite deodată).

**Găsit pe drum, nu era anticipat în plan:** niciuna din cele 143 nu are `description` sau `method` completate (ambele goale/null la toate). Planul din §B3 zice că migrarea le-ar duce la o achitare cu `method` = metoda cheltuielii și `sourceName` = descrierea — dar aici n-ar avea nici una, nici alta. Migrarea ar trebui fie să ceară o metodă implicită (Cash?), fie să lase `method` needitat și utilizatorul completează manual din Asociere achitări.

**Întrebări pentru tine, înainte de orice scriere:**
1. Confirmi că toate cele 143 chiar sunt încasări de bazin (nu cheltuieli reale de întreținere a bazinului, gen reparații/produse chimice) — categoria „Bazin” pare folosită exclusiv pentru încasări, dar nu am cum să verific asta din date; ai tu contextul.
2. Ce metodă de plată presupunem la migrare, dat fiind că nu e înregistrată nicăieri (Cash implicit? sau lăsăm necompletat și le rezolvi manual din Asociere achitări, una câte una)?
3. Rulez migrarea și pe iunie-iulie 2026 (adică pe date deja „istorice”, posibil deja incluse în rapoarte închise ale lunilor respective), sau doar de-acum înainte (păstrăm istoricul cum e, migrăm doar noile cheltuieli de bazin)? Dacă migrăm și istoricul, `COADA-DE-LUCRU.md` trebuie să noteze diferența pe fiecare lună afectată (cf. §B3, pasul 4) — Dashboard/Raport contabil pentru iunie și iulie 2026 s-ar schimba retroactiv.

Lista completă (143 rânduri, id/dată/sumă) e reproductibilă oricând cu `node scripts/diagnostic/b3-pool-expenses.mjs`; n-am dus-o toată aici ca să nu îngroape restul fișierului. Nimic scris, nicio migrare încă — aștept răspuns.

**Rezolvat 29.09, 23:19** (vezi `RASPUNSURI.md`) — trei decizii confirmate; migrarea propriu-zisă (câmpul `Payment.service`, kind-ul `services`, scrierea celor 143 rânduri, notele de diferență lunară în `COADA-DE-LUCRU.md`) rămâne un task separat, mai mare, executat ulterior:
1. Toate cele 143 sunt încasări reale de bazin — confirmat, fără verificare manuală rând cu rând.
2. Metoda la migrare: **Cash** (niciuna din cele 143 n-are metodă înregistrată).
3. Retroactiv, inclusiv iunie–iulie 2026 — nu doar de-acum înainte.

**Executat 30.09** (`scripts/migrate/b3-pool-expenses-to-payments.mjs --execute`, backup luat înainte): 143/143 migrate, 0 erori. Vezi `COADA-DE-LUCRU.md` pentru detalii și impactul retroactiv pe iunie/iulie 2026.

## ✅ Contrast buton primar — alb pe `--orange` (punctul 5, PROMPT-CLAUDE-CODE-3.md) — rezolvat 30.09, varianta 1

Textul alb pe fundal `--orange` (butonul principal peste tot în aplicație) avea contrast **2,4:1** — sub minimul WCAG AA. Rezolvat cu varianta 1: token nou `--orange-strong` (#b85a00, contrast 4,7:1 cu alb), aplicat doar acolo unde stă text/iconițe albe pe portocaliu — `Button.primary`, `Checkbox.box.on` (bifa albă pe fundal bifat). `--orange` rămâne neschimbat pentru restul (badge-uri soft, accente, evidențieri fără text alb deasupra). Vezi `TOKENS.md` și `DECIZII.md` (secțiunea „30.09 — Contrast buton primar”).

## ✅ Pasul 4 (migrare module) — §3 din DS-IMPLEMENTARE.md e nebifat, deși toate cele 15 module au deja commit „punctul 4 — migrarea X”

Verificare 30.09, după terminarea completă a pasului 3 (toate cele ~60 de componente din `@shared/ui` există acum, ultimul val fiind MasterDetail/Wizard/NavRail/GlobalSearch/BranchSelector/SyncStatusCard/FormSection/ColumnMenu/etc.). Toate cele 15 module au deja câte un commit “punctul 4 — migrarea X pe componente” (`ce20807`…`40cf9a1`, 15/15) — DAR acele commit-uri au fost făcute **înainte** ca lotul mare de componente noi din pasul 3 (val 3-5, ~30 de componente: `MasterDetail`, `Wizard`, `SplitButton`, `PrintOptionsDialog`, `FilterMenu`, `ActiveFilters`, `ListToolbar`, `Kpi`, `AmountInput`, `ChoiceCards`, `SmsPreview`, `SegmentCounter`, `DocumentCard`, `NoteList`, `FormSection`, `InlineEdit`, `TaskRow`, `AvatarGroup`, `TonePicker`-adiacente etc.) să existe.

Verificat concret pe Achitări (checklist cere: `DataTable, ListToolbar, FilterMenu, PeriodFilter, ActiveFilters, SelectionBar, Kpi, MasterDetail, AmountInput, ChoiceCards, SegmentedControl, SplitButton, PrintOptionsDialog`): `PaymentsTable.tsx`/`PaymentsPage.tsx` folosesc azi doar `DataTable, PeriodFilter, SelectionBar, SegmentedControl` din listă — restul (`ListToolbar, FilterMenu, ActiveFilters, Kpi, MasterDetail, AmountInput, ChoiceCards, SplitButton, PrintOptionsDialog`) lipsesc, pentru că nu existau încă la momentul migrării. Probabil identic pe restul de 14 module — fiecare a fost migrat cu ce exista atunci, nu cu lista completă din §3.

**Decizia care îți revine, înainte să reiau lucrul pe pasul 4:**
1. Se face un **al doilea val de migrare** pe toate cele 15 module, ca să ajungă să folosească și componentele noi din §3 (ex. Achitări trece pe `MasterDetail` pentru layout listă+detaliu, `SplitButton` pentru export, `PrintOptionsDialog` la printare) — risc real: sunt ecrane cu date financiare de producție, deja funcționale; o restructurare de layout (nu doar swap vizual 1:1) e mai riscantă decât migrarea inițială.
2. Sau lista din §3 rămâne **aspirațională/parțial istorică** (componentele “corecte” de folosit dacă ecranul s-ar rescrie de la zero), iar modulele deja migrate rămân cum sunt — caz în care bifele din §3 nu se mai pot bifa 100% literal și “definiția lui gata” din §4 trebuie relaxată/actualizată să reflecte asta.
3. Sau o cale de mijloc: doar componentele ușor de adăugat fără restructurare de layout (ex. `SplitButton` în loc de un buton simplu de export, `PrintOptionsDialog` în loc de printare directă) se adaugă acum, iar cele care ar cere restructurare de layout (`MasterDetail`, `Board`, `Wizard`) rămân notate ca datorie/follow-up separat, per ecran.

Nimic schimbat în cod pe baza asta — aștept alegerea ta. Între timp continui alte părți sigure/reversibile ale pasului 5 (lista „Nu se face”) care nu ating ecranele deja migrate.

**Rezolvat 30.09, 12:30** (vezi `RASPUNSURI-30-09.md` punctul 1 și `PROMPT-CLAUDE-CODE-5.md`): varianta 1 — toate cele 15 module, modul cu modul, cu captură design lângă cod după fiecare. Restructurarea de layout (`MasterDetail`, `Board`, `Wizard`) intră. Ordinea: Dashboard, Copii, Achitări, Prezența, apoi restul (§2 din PROMPT-5).

## ✅ R3 (arhitectură DS) — caracterul „×” exclus din verificarea automată de iconițe-brute — decizie tehnică, nu de business

`architecture.test.ts` (R3) verifică automat caracterele-iconiță (⌕⋯▾‹›✓☰⋮⋮↶↗▲▼⇅) rămase ca text randat în `features/**`. „×” a fost exclus intenționat din regex: în cod apare aproape exclusiv ca semn de înmulțire legitim în text („tarif × zile lucrate”, „ședințe × preț”, „58×30”), nu ca iconiță de închidere — un regex care l-ar prinde ar da fals-pozitive în text corect, nu datorie reală. Singurele „×” cu rol de iconiță (buton de închidere) au fost deja înlocuite cu `<Icon name="close">` în migrarea anterioară (commit `2f8fdfd`). Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în acoperirea R3.

## ✅ Dashboard — graficul „Evoluția încasărilor” rămâne pe implementarea proprie, nu `BarChart` din `@shared/ui` — decizie tehnică, nu de business

Migrarea Dashboard-ului (§2, `PROMPT-CLAUDE-CODE-5.md`) a înlocuit `methodBar`/`methodLegend`/legendele custom cu `ProgressBar(segmented)`/`Legend`, iar `+ Adaugă cheltuială`/„Vezi calendarul →” cu `Button variant="link"`. Rândul de bare lună-cu-lună (Încasări + Cheltuieli) și rândul „Vezi lista →” din „Necesită atenție” au rămas `<button>` brut, cu excepție păstrată în R1 din `architecture.test.ts`.

Motiv: `08-dashboard.md` + testele existente (`DashboardPage.test.tsx`, „A8”) cer explicit un singur element cu `role="button"` per lună, cu `aria-label` combinat „încasări X, cheltuieli Y” și un tooltip la hover/focus cu **diferența** (nu valoarea unei singure serii). `BarChart` din `@shared/ui` randează două `<span>` separate cu câte un `Tooltip` propriu fiecare (valoare individuală, nu diferență) — nu are un mod „o singură țintă interactivă pe grup, cu tooltip combinat”. Am păstrat comportamentul testat (`role="button"`, tooltip cu diferența) peste reutilizarea 1:1 a componentei, ca să nu pierd un comportament deja specificat/testat. Am eliminat totuși starea JS `activeBar` (hover/scale acum e CSS `:hover`/`:focus-visible`) și am înlocuit balonul custom cu `Tooltip` din `@shared/ui` (conținut text simplu, fără bold).

`attentionAction` („Vezi lista →”) a rămas la fel `<button>` brut: culoarea lui vine din tonul rândului (`pink-ink`/`yellow-ink`/`mint-ink`, calculat din `AttentionTone`), iar `Button` nu are o variantă „link cu culoare moștenită din rând” — a adăuga una nouă doar pentru acest rând mi s-a părut supra-inginerie pentru un singur loc de folosire. Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare.

## ✅ Achitări — modul Pe luni rămâne pe layout propriu, nu `MasterDetail` — decizie tehnică, nu de business

`05-achitari.md` §4 cere pentru modul „Pe luni”: lista grupată pe lună **largă** (restul lățimii) + panoul de detaliu **fix 400px, în dreapta**. `MasterDetail` din `@shared/ui` are exact structura opusă: panoul din stânga (`master`) e cel cu lățime fixă (`masterWidth`, implicit 360), iar cel din dreapta (`detail`) ia restul spațiului — gândit pentru tipare gen client de email (listă îngustă + conținut lat), nu pentru „listă lată + rezumat îngust”. A forța inversarea (conținutul listei în slotul `detail`, panoul de 400px în slotul `master` cu `masterWidth` mare) ar însemna doar redenumirea proprietăților fără niciun beneficiu real — tot markup și CSS propriu rămân, doar botezate altfel.

`PaymentsByMonth.tsx` rămâne pe `.layout { display:flex }` cu `.main { flex:1 }` + `PaymentDetailPanel` (400px) — exact proporțiile cerute de spec. Restul modulului a trecut pe componente din `@shared/ui`: pastilele „Toate/Neasociate/Arhivate” pe `FilterPills` (înlocuind trei `Button` cu `className` + `!important`, exact tiparul deja folosit în Personal 23a — `TeamView.tsx`), cardurile de sumar din modul Tabel pe `Kpi` (cu un prop nou, `activeTone`, pentru conturul 2px pe cardul metodei filtrate — fundalul rămâne alb, doar conturul se colorează), link-urile „Asociază în De rezolvat →” și „Arhivează”/„Dezarhivează” din panoul de detaliu pe `Button variant="link"`/`variant="danger"` (înlocuind `className` cu `!important` care reimplementau exact aceleași variante). Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare.

## ✅ Prezența — `MonthView.tsx` rămâne pe grilă proprie + `AttendanceDot`, nu `DayGrid` — decizie tehnică, nu de business

`DayGrid` din `@shared/ui` randează o grilă generică copil×zi cu puncte pe sistem de „ton” simplu (o culoare per stare). Ecranul Luna (18b, `19-prezenta.md`) cere însă 6+ stări distincte per celulă (prezent/absent/motivat/nemarcat/viitor/zi liberă), fiecare cu propriul `role="img"`/`aria-label` — exact ce oferă deja `AttendanceDot` din `@shared/attendance`, o componentă folosită și în fișa copilului (linia de puncte din profil, per spec). Forțarea pe `DayGrid` ar însemna fie sărăcirea semanticii ARIA existente (regresie de accesibilitate), fie extinderea `DayGrid` cu un sistem de stări pe care nimeni altcineva nu-l folosește. `MonthView.tsx` rămâne pe grila proprie (`.headRow`/`.dataRow`/`.footRow`, `gridTemplateColumns` comun — A3e) cu `AttendanceDot` ca primitivă de celulă; restul ecranului (`Card`, `FilterPills`, `LoadingState`, `StatusIconButton`) e deja pe `@shared/ui`. Nimic de decis din partea ta.

## ✅ Prezența — `WeeklySheetDialog.tsx` (Foi pe săptămână) rămâne cu modal propriu, nu `Dialog` din `@shared/ui` — deliberat amânat

`WeeklySheetDialog.tsx` e ecranul „Foi de prezență pe săptămână” (`26-foaie-saptamana.md` §3), tangențial la scope-ul acestei treceri (`19-prezenta.md`, 18a/18b). Implementează propriul modal (`overlay`/`dialog` cu `role="dialog"`/`aria-modal`, închidere la click-în-afară manuală) în loc de componenta `Dialog` din `@shared/ui`, plus un `style` inline pe un `Button variant="outline"` pentru culoarea pastilei de grupă selectate (`TONE_VARS` lookup). Am fixat doar violarea R2 mecanică din CSS-ul lui (`rgba(58,71,80,0.4)` → `var(--overlay)`, exact tokenul pe care `Dialog` însuși îl folosește — confirmă că dialogul ăsta duplică ce oferă deja componenta). Adoptarea `Dialog` + eliminarea hack-ului de `style` rămân follow-up separat, când se face trecerea pe `26-foaie-saptamana.md`, nu în pasul curent. Nimic de decis din partea ta.

## ✅ De notificat — starea „coadă golită” rămâne cu text dinamic din `useNotify.ts`, nu cheia de catalog `denotificat.done` — decizie tehnică, nu de business

`empty-states.ts` are o cheie exactă pentru acest ecran, `denotificat.done` (`title: 'Nimeni de notificat'`, `text: 'Toți părinții cu restanțe au primit SMS. Lista se completează după scadență.'`), iar `10-de-notificat.md` nu spune altceva despre stare goală în afara criteriilor de acceptare generale. Dar mesajul real, calculat în `useNotify.ts` (`emptyMessage`), nu e static — depinde și de câte fișe sunt „De verificat” (fără taxă/perioadă confirmată): fie `'Nimeni de notificat pentru luna aceasta.'`, fie `'Nimeni de notificat, dar N fișe nu pot fi evaluate. Completează taxa și perioada.'`. Această a doua variantă e informație de business reală (nu ar trebui ascunsă din spatele unui text fix de catalog), iar `useNotify.ts` e explicit în afara scope-ului acestei treceri („rămâne”, 10-de-notificat.md §1) — nu puteam despărți acolo titlul de restul textului ca să potrivesc exact forma `title`/`text` a catalogului.

Am păstrat textul dinamic din hook, dar am trecut randarea lui de pe un `<p>` simplu pe `EmptyState variant=”done”` (fără `description`, doar `title={notifyData.emptyMessage}`) — același decor „coadă golită” ca în restul modulelor migrate (`situatia.done`, `derezolvat.done`), fără să pierd nuanța „fișe de verificat”. Import nou, legitim, al `EmptyState` (R9 `IMPORT_ALLOWED`). Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare.

## ✅ Taxe și grupe / De verificat — cheia de catalog `derezolvat.done` rămasă nefolosită — decizie tehnică, nu de business

Migrarea `fee-setup/FeeSetupPage.tsx` (9a) și `review/ReviewPage.tsx` (9b) avea de verificat dacă starea „coadă golită” a fiecăreia (`FeeSetupPage`: filtrul „missing” cu 0 rânduri, azi „Totul e completat”; `ReviewPage`: `rows.length === 0`, azi „Totul e verificat”) trebuie mutată pe cheia `derezolvat.done` din `empty-states.ts` (`title: 'Nimic de rezolvat'`, `text: 'Taxele, verificările și asocierile sunt la zi.'`) — cheie deocamdată nefolosită nicăieri în cod (verificat cu grep), rezervată probabil exact pentru acest val.

N-am forțat-o în niciuna din cele două pagini: textul cheii enumeră toate cele trei categorii (taxe + verificări + asocieri) laolaltă, dar fiecare pagină vede coada ei, nu pe a celorlalte două — `FeeSetupPage` la 0 rânduri „missing” nu știe dacă mai sunt fișe de verificat sau achitări neasociate, și invers pentru `ReviewPage`. Afișarea textului comun ar sugera greșit că *tot* modulul „De rezolvat” e la zi, când de fapt doar sub-coada curentă e goală — exact genul de regresie de acuratețe pe care catalogul (35c) încearcă s-o evite prin chei specifice per ecran (vezi `asociere.done`, deja folosită corect doar în `AssignPage.tsx`). Niciuna din cele două texte proprii actuale („Totul e completat” / „Toți copiii nearhivați au taxă și grupă.”, respectiv „Totul e verificat” / „Nu mai sunt fișe sau achitări de corectat.”) nu conține tiparul „Niciun/Nicio” verificat automat de R9, deci nu exista nicio încălcare de reparat — am lăsat ambele texte neschimbate, specifice paginii lor.

Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare. Dacă la un moment dat apare un ecran-hub care agregă toate cele trei cozi într-un singur progres, acela e locul potrivit pentru `derezolvat.done`.
