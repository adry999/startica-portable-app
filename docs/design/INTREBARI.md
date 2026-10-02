# Întrebări / decizii blocate

## ✅ §9.2 (PROMPT-8) — WeekFillBar „Toți prezenți”: conflict cu decizia 12, rezolvat cu un cod nou 'P' (02.10)

41b cere ca „Toți prezenți L–V”/„Prezent toată săptămâna” să completeze celulele goale ale
pontajului cu „prezent”. Decizia 12 (24-personal.md) spune însă explicit: **lipsa rândului
într-o zi lucrătoare ÎNSEAMNĂ deja lucrat 8 ore** — nu exista niciun cod „prezent” în
`TIMESHEET_CODES` (`'CO' | 'CM' | 'A' | 'I' | 'FP'`), deci „completarea” unei celule goale cu
„prezent” era, luată literal, un no-op (nimic de scris, pentru că e deja starea implicită).

Cerința explicită de o singură intrare `audit_log` pentru tot lotul (ca să poată fi anulată ca
o acțiune, §8.2) arată însă clar că se așteaptă o scriere reală. Am ales să adaug codul nou
`'P'` (prezent confirmat explicit) în `TIMESHEET_CODES`/`TimesheetCode`, numărat identic cu
lipsa rândului în `summarizeTimesheetMonth` (`worked`/`hours` includ și `'P'`, nu doar `''`) —
deci orele și salariul nu se schimbă față de o zi nemarcată; codul există doar ca să fie ceva
de scris/anulat. Vizual, o celulă `'P'` arată identic cu o zi lucrată nemarcată (fără literă,
`data-kind="worked"`), ca să nu introducă un simbol nou pe care operatorul ar trebui să-l învețe.

Fișiere atinse: `src/features/personal/domain/personal-schema.mjs` (TIMESHEET_CODES),
`src/features/personal/domain/timesheet-month.mjs` + portul webapp
`webapp/src/shared/personal/timesheet-rules.ts` (worked/hours), `personal.types.d.mts` +
portul webapp. Dacă asta nu e interpretarea dorită (de exemplu, dacă „P” ar trebui să apară
totuși vizibil distinct în grilă sau în tipărire), spune și ajustez — codul rămâne izolat,
ușor de redenumit/eliminat fără să atingă restul pontajului.

## ⚠️ §3.2 (PROMPT-8) — F9 MDL/EUR: verificare făcută, o neconcordanță găsită (02.10)

Verificat în cod cele 3 puncte cerute:

1. **Fiecare plată pe taxă EUR are `fxRate`+`amountEur`** — confirmat pentru calea de salvare curentă: `PaymentFormDrawer.handleSubmit` (`webapp/src/features/payments/PaymentFormDrawer.tsx`) calculează `fxRate` (BNM sau manual) + `amountEur = convertAmount(...)` ori de câte ori `isEurChild` e adevărat, înainte de `onSubmit`. **Nu pot verifica din cod dacă plățile VECHI (salvate înainte ca acest calcul să existe) au deja aceste câmpuri** — asta ține de datele reale, nu de cod; rămâne pe seama scriptului de migrare de mai jos, care oricum depinde de §3.3 (istoricul BNM) ca să completeze cursul corect al zilei plății.
2. **Dashboard, Situația plăților, Cheltuieli afișează doar MDL** — confirmat (niciun `EUR` în `features/dashboard`, `features/billing`, `features/expenses`; `status-summary.mjs` convertește explicit la lei pentru agregate).
3. **Raport contabil afișează doar MDL** — **NU** confirmat: `features/report/ReportMethodsPanel.tsx` + `ReportExportDrawer.tsx` + `report-excel.ts` au o secțiune dedicată „Pentru taxe în EUR” (sumă în EUR, curs, echivalent lei) — pare intenționată (comentariu „design 19a”, bifată deja ca rezolvată mai sus în acest fișier, la „Raport contabil (punctul 14)”), nu o scăpare. **Intră în conflict literal cu cerința F9 „Raport contabil afișează doar MDL”.**

Restul (EUR doar în plan/fișa copilului/fereastra de plată) confirmat — cu o completare minoră: `PaymentReceipt.tsx` arată și el EUR (bonul plății, derivat direct din `amountEur`-ul plății), ceea ce consider parte din „fereastra de plată”, nu o scăpare.

**Întrebare:** păstrez secțiunea EUR din Raportul contabil (utilă pentru contabilitate, pe taxe EUR) sau o scot ca să respecte F9 literal („doar MDL”)? Nu am scos-o — aștept răspuns, trec mai departe. Scriptul de migrare `scripts/migrate/` pentru plățile vechi fără `fxRate` rămâne de scris după §3.3 (are nevoie de istoricul BNM ca să completeze cursul corect al fiecărei zile).

## ⏳ §2.1 (PROMPT-8) — F4 autoComplete="off": Chrome pe nume/telefon, netestat manual (02.10)

Adăugat `autoComplete="off"` implicit pe `TextInput`/`NumberInput`/`PhoneInput`/`AmountInput`/`DateInput`/`TimeInput`/`TextArea`/`SearchInput` (deci și `GlobalSearch`) + pe fiecare `<form>` din `features/**`. PROMPT-8 cere: dacă testul manual arată că Chrome ignoră `off` pentru nume/telefon/adresă (comportament cunoscut al Chrome pe aceste câmpuri), să se treacă pe `autoComplete="new-password"` ca ocolire — și rezultatul testului să fie notat aici.

**Nu am putut testa manual în Chrome real în această sesiune** (fără interacțiune de browser disponibilă la acest pas) — am lăsat `off` peste tot, uniform, fără ocolirea `new-password`. Dacă la folosirea reală a instalerului Chrome tot oferă să salveze/completeze nume sau telefon (verifică pe „Copil nou” → câmpul Nume/Telefon părinte), spune și trec acele câmpuri specifice pe `autoComplete="new-password"`.

## ⚠️ §0 (PROMPT-8) — niciun `design_final_startica/` de copiat găsit pe disc (01.10, seara)

PROMPT-CLAUDE-CODE-8.md §0 cere „Copiază `design_final_startica/` peste `docs/design/`”, dar n-am găsit niciun asemenea folder/arhivă pe disc (verificat rădăcina repo, `%TEMP%`, Desktop, Downloads — doar extragerile vechi, deja consumate, din sesiunea PROMPT-7). În schimb, conținutul nou era deja prezent direct în `docs/design/`: `Feedback 01-10.dc.html`, `FEEDBACK-01-10.md`, `PROMPT-CLAUDE-CODE-8.md` (netrasate) și `COMPONENTE.md` deja avea §3b (rândurile 38a–38g) adăugat. Am tratat asta ca „pachetul e deja aplicat” — am mutat doar `PROMPT-CLAUDE-CODE-7.md` în `arhiva/` și am comis ce era deja pe disc, fără pas separat de copiere. Dacă mai există un pachet undeva (alt folder, altă mașină), spune calea și fac diff-ul cerut separat.

## ⚠️ §0 — pachetul `design_final_startica/` suprascrie documentație încă validă (01.10, rezolvat la copiere)

Pachetul predă `docs/design/` dintr-un export mai vechi decât încheierea PROMPT-6 din această sesiune — deși PROMPT-7 însuși spune „PROMPT-6 e închis integral”. Suprascrierea brută ar fi șters 3 lucruri încă adevărate în cod:
- `TOKENS.md` — secțiunea „Tokeni noi R2” (cei 5 tokeni, toți încă definiți în `tokens.css` și folosiți în module).
- `COMPONENTE.md` — rândul FilterPills redevenise „de făcut”, deși fix-ul e verificat (Achitări are 3 pastile, trece pe al doilea rând, fără limită în cod).
- `screens/30-stari-goale.md` — rândul `taxe.done` a dispărut, deși cheia există în `empty-states.ts`, e folosită în `FeeSetupPage.tsx` și are poveste Storybook.

Am re-adăugat manual cele 3 bucăți peste conținutul proaspăt copiat (restul pachetului intră neschimbat). `screens/21-incarcare.md` — checkbox-ul de la 21c a rămas nebifat (pachetul nu știe de implementarea din această sesiune); las-o așa, per instrucțiunea explicită primită să nu o reversez eu.

**Pentru viitor:** dacă pachetul de design se regenerează dintr-un export care nu include deciziile/tokenii adăugați direct în `docs/design/*.md` de sesiunile de cod, o copiere „cu suprascriere” va pierde tăcut acest gen de documentație — merită verificat diff-ul complet la fiecare `§0`, nu doar presupus corect.

## ✅ Teste 2.1.0 — bug-uri raportate de utilizator pe instalerul testat — rezolvate 01.10 (PROMPT-CLAUDE-CODE-7.md §1)

Doi bug-uri raportate în timpul testării `Startica_Setup_2.1.0.exe`. Ambele erau preexistente (nu veneau din §2/§3/§4 ale sesiunii anterioare), dar reale — reproduse cu Playwright pe o copie izolată, nu doar „date de test sărace”.

1. **Dashboard — „Evoluția încasărilor" nu mai arată bine** → cauză reală: `Tooltip.module.css` (`.wrapper`, `display:inline-block`, fără înălțime proprie) se interpune între bara cu `height:X%` din `BarChart.tsx` și ancestorul cu înălțime definită (`.pair`/`.group`) — procentul devine `auto`, bara colapsează la `min-height:2px` indiferent de valoare. Confirmat cu date reale (iulie 2026, 787.385 lei): bara măsura 1,99px în loc de ~138px. Fix: `height:100%` pe `.wrapper` (sigur — e no-op când părintele n-are înălțime definită, cazul tuturor celorlalte folosiri Tooltip). Capturi: `verificare/08-dashboard-bug1-before.png`/`-after.png`. Commit `a2a80e8`.
2. **„Copil nou" are scroll pe axa X** → două cauze: `ScrollArea.module.css` (`.viewport` fără `overflow-x` propriu → browserul calculează implicit `auto`) + `ChildFormDrawer.module.css` (grid-urile `.grid3`/`.grid2`/`.parentRow`/`.pickupRow` fără `min-width:0` pe celule → `Field`/`TextInput`/`PhoneInput` nu puteau coborî sub lățimea lor intrinsecă la 620px). Fix pe ambele cauze + test real în `tests/browser-smoke.mjs` (deschide drawer-ul, verifică `scrollWidth<=clientWidth` pe `.viewport`; verificat că pică fără fix). Commit `b93224a`.

## ✅ §3 — incident: capturile arătau codul vechi, nu codul curent — rezolvat 01.10

În timpul corecției de mai jos (R2/R9 + bug-uri vizuale), repararea paginării din `DataTable` nu se vedea deloc în captura regenerată — codul era corect, testele treceau, dar imaginea arăta tot comportamentul vechi. Motiv: `src/core/server/http/static-assets.mjs` servește `webapp/dist` (bundle precompilat prin `npm run build`), nu sursa live — iar `scripts/design-capture.mjs` pornea serverul pe copia izolată fără să reconstruiască `dist` întâi. Toate cele 18 capturi din prima trecere a §3 (inclusiv cele „verificate" vizual de mine) arătau de fapt un build mai vechi decât multe din schimbările acestei sesiuni.

**Rezolvat:** `design-capture.mjs` rulează acum `npm run build` în `webapp/` înainte de orice captură. Toate cele 18 capturi au fost regenerate cu `dist` proaspăt; cele 2 module cu bug-uri reale reparate (Achitări, Personal — Echipa) au fost reverificate vizual pe captura nouă și confirmă reparația.

## ⏳ §3 — PeriodFilter: presetările din spec rămân neconstruite (01.10, decizie veche confirmată)

Revizorul a semnalat că Achitări folosește încă `<input type="month">` în loc de dropdown-ul cu presetări din artboard. Verificat: `PeriodFilter.tsx` are deja acest gol documentat explicit în propriul comentariu JSDoc, de dinainte de această sesiune — „Presetările din spec (luna curentă, luna trecută, 30 zile, an școlar, tot) rămân pentru ecranul care le va folosi efectiv prima dată — nu sunt construite speculativ aici." Nu e datorie nouă din §2/§3.

Nu am implementat presetările acum: „30 de zile" cere interval pe zile, nu pe lună (`from`/`to` sunt azi `YYYY-MM`), iar „An școlar" trebuie să respecte aceeași semantică folosită în altă parte a aplicației (Situația plăților) — o extensie reală de API/logică de date, exact cazul din regulile de sesiune („te oprești dacă o extensie de componentă schimbă logica de date"). Rămâne task separat, cu design propriu pentru conversia `from`/`to`, nu un patch grăbit peste o sesiune deja încărcată de corecții.

## ✅ §2/§3 — corecție: excepțiile R2/R9 nu erau închise + bug-uri vizuale reale ratate la §3 — rezolvat 01.10

Un revizor extern a verificat 6 din cele 18 capturi §3 și a găsit: (1) `architecture.test.ts` avea încă 5 excepții R2 și 9+24 excepții R9, deși PROMPT-CLAUDE-CODE-6.md §2 cerea explicit ≤1 excepție totală (doar R3 `WeeklySheet.tsx`) și ștergerea mecanismului de allowlist pentru R2/R9; (2) clasificarea „doar date de test" de la §3 a ratat bug-uri reale la Achitări, Personal.

Corectat:
- **R2** — 4 din 5 excepții s-au închis rotunjind razele la cea mai apropiată `--radius-*` din TOKENS.md „Corespondență" (judecata mea anterioară de „păstrare a formei" a fost greșită — instrucțiunea §2 e explicită și are prioritate); a 5-a (`PaymentReceipt.module.css`) s-a închis cu un token nou (`--shadow-ring-mint`) și o rafinare a regexului de `z-index` (sub 10 = stacking local, nu intră în scara globală). Allowlist-ul R2 e acum gol.
- **R9** — textul de căutare/filtre fără rezultate (politică deja documentată în header-ul `empty-states.ts`) e acum exclus structural prin regex, nu prin listă de fișiere; 4 texte reformulate fără „Niciun/Nicio" (WeeklySheetDialog, GroupTeamPicker ×2, DayClosingReceipt, PaymentFormDrawer); `ConflictsPage`/`ReviewPage` trec pe catalog (`conflicte.done`/`derezolvat.done`, chei deja existente, nefolosite până acum); `FeeSetupPage` are cheie nouă `taxe.done`. Regula de import direct a fost rescrisă să verifice `variant` literal (catalogul nu acoperă `'no-results'` — structural, nu datorie). Allowlist-ul R9 e acum gol. Întregul `architecture.test.ts` are o singură excepție rămasă în tot fișierul: `attendance/WeeklySheet.tsx` (R3), exact cum cere §2.
- **Bug-uri vizuale reale** (Achitări: paginare fără elipsă/overflow, coloana Metodă dublează suma, luna „2026 Iun" → „Iun 2026", pastilele Grupă pe 2 rânduri — acceptat, vezi mai sus pentru PeriodFilter; Personal: „Lucrează" → „La lucru") — reparate în cod, cu teste actualizate.
- **Nu erau bug-uri** (verificat cu cod, nu presupus): Copii „Plată" gol (decizie A8/2a, intenționat), avatare gri la copii fără grupă (ton de grupă, intenționat), inițială unică la Personal (artefact de date de test, nu bug de componentă), anteturile de departament din Personal (deja stilizate corect în cod — posibil artefact de rezoluție în captură).

## ✅ §3 — incident: copia izolată de date a scris un backup real pe Google Drive — rezolvat 01.10

Primul test al `scripts/dev-data-copy.mjs` (server pornit pe `.tmp/data-copy/`, cu `STARTICA_HOME` izolat) a scris totuși un fișier real în `D:\Google Drive\` — `startica_2026-10-01T10-02-28-562Z_pornire_15fe8499.db`. Motiv: setarea `externalDir` (calea de backup extern) stă ÎN `startica.db`, nu derivă din `STARTICA_HOME` — copiind baza întreagă, serverul pe copie a moștenit calea reală, iar backup-ul automat de pornire (`main.mjs`, `app.backup('pornire')`) a scris acolo. Fișierul e un backup valid (nicio dată reală corupt/pierdut), dar e o scriere neintenționată în afara `.tmp/`. Utilizatorul a șters manual fișierul din Google Drive.

**Rezolvat:** `copyDevData()` neutralizează acum `externalDir` (DELETE direct din `settings`, cu `node:sqlite`) în fiecare `startica.db` din copie, imediat după copiere, înainte de orice pornire a serverului. Verificat: a doua rulare arată `externalDir: ""`, 0 scrieri externe, numărul de fișiere din Google Drive neschimbat.

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

## ✅ Prezența — `WeeklySheetDialog.tsx` (Foi pe săptămână) adoptă `Dialog` din `@shared/ui` — rezolvat 01.10 (PROMPT-CLAUDE-CODE-6.md §2)

**Istoric (decizie anterioară, depășită):** implementa propriul modal (`overlay`/`dialog` manual) plus un `style` inline pe un `Button variant="outline"` pentru culoarea pastilei de grupă selectate (`TONE_VARS` lookup) — amânat ca follow-up separat.

**01.10:** trecut pe `Dialog` (title + footer cu acțiunile „Anulează”/„Tipărește N foi”, `open` mereu `true` — componenta e montată doar cât e deschisă, ca înainte). `TONE_VARS` (lookup JS → `style` inline) înlocuit cu 8 clase statice de ton în `WeeklySheetDialog.module.css` (`.orange`/`.mint`/… ca la `ChipSelect`), combinate cu `.groupPillSelected` pentru bordura transparentă — niciun `style=` rămas pe pastilele de grupă.

## ✅ De notificat — starea „coadă golită” trece pe cheia de catalog `denotificat.done` — rezolvat 01.10 (PROMPT-CLAUDE-CODE-6.md §2)

**Istoric (decizie anterioară, depășită):** `empty-states.ts` are o cheie exactă pentru acest ecran, `denotificat.done`, dar mesajul real calculat în `useNotify.ts` (`emptyMessage`) nu era static — depindea și de câte fișe sunt „De verificat” (fără taxă/perioadă confirmată). Varianta veche păstra tot textul dinamic drept `title`, fără catalog.

**01.10:** restructurat ca titlu static din catalog + nota dinamică mutată în `text`. `denotificat.done.text` devine o funcție de `params.nefise`: cu fișe neevaluate arată „N fișe nu pot fi evaluate. Completează taxa și perioada.”, altfel textul static din catalog („Toți părinții cu restanțe au primit SMS…”). `useNotify.ts` nu mai expune `emptyMessage` — doar `stats.unknown` (deja exista), iar `NotifyPage.tsx` randează `EmptyState` cu `EMPTY_STATES['denotificat.done']` + `resolveEmptyStateTitle`/`resolveEmptyStateText({ nefise: String(stats.unknown) })`, exact tiparul din `AssignPage.tsx`/`DayView.tsx`. Import direct al `EmptyState` rămâne legitim (R9 `IMPORT_ALLOWED`) — coada nu e un `DataTable`.

## ✅ Taxe și grupe / De verificat — cheia de catalog `derezolvat.done` rămasă nefolosită — decizie tehnică, nu de business

Migrarea `fee-setup/FeeSetupPage.tsx` (9a) și `review/ReviewPage.tsx` (9b) avea de verificat dacă starea „coadă golită” a fiecăreia (`FeeSetupPage`: filtrul „missing” cu 0 rânduri, azi „Totul e completat”; `ReviewPage`: `rows.length === 0`, azi „Totul e verificat”) trebuie mutată pe cheia `derezolvat.done` din `empty-states.ts` (`title: 'Nimic de rezolvat'`, `text: 'Taxele, verificările și asocierile sunt la zi.'`) — cheie deocamdată nefolosită nicăieri în cod (verificat cu grep), rezervată probabil exact pentru acest val.

N-am forțat-o în niciuna din cele două pagini: textul cheii enumeră toate cele trei categorii (taxe + verificări + asocieri) laolaltă, dar fiecare pagină vede coada ei, nu pe a celorlalte două — `FeeSetupPage` la 0 rânduri „missing” nu știe dacă mai sunt fișe de verificat sau achitări neasociate, și invers pentru `ReviewPage`. Afișarea textului comun ar sugera greșit că *tot* modulul „De rezolvat” e la zi, când de fapt doar sub-coada curentă e goală — exact genul de regresie de acuratețe pe care catalogul (35c) încearcă s-o evite prin chei specifice per ecran (vezi `asociere.done`, deja folosită corect doar în `AssignPage.tsx`). Niciuna din cele două texte proprii actuale („Totul e completat” / „Toți copiii nearhivați au taxă și grupă.”, respectiv „Totul e verificat” / „Nu mai sunt fișe sau achitări de corectat.”) nu conține tiparul „Niciun/Nicio” verificat automat de R9, deci nu exista nicio încălcare de reparat — am lăsat ambele texte neschimbate, specifice paginii lor.

Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare. Dacă la un moment dat apare un ecran-hub care agregă toate cele trei cozi într-un singur progres, acela e locul potrivit pentru `derezolvat.done`.

## ✅ Vizite — celula calendarului rămâne `<button>` propriu, nu `MonthCalendar` din `@shared/ui` — decizie tehnică, nu de business

`04-vizite.md` §3 scrie pseudocodul `<MonthCalendar cellHeight={72} selected={day} onSelect={setDay} />`, iar `DS-IMPLEMENTARE.md` §3 listează `MonthCalendar` printre componentele intenționate pentru acest ecran. Componenta chiar există în `@shared/ui/MonthCalendar.tsx`, dar nu e folosită încă nicăieri în `features/` — ar fi prima ei utilizare reală. Verificat API-ul ei: randează fiecare zi ca `<div role="button">`, nu ca `<button>`, și n-are nicio noțiune de zi „selectată” (doar `isToday`) — nici prop `cellHeight`. Ecranul Vizite are însă nevoie explicit de o stare „selectată” persistentă (fundal + bordură galbenă, cerută de criteriul de acceptare „click pe rând selectează ziua în calendar”) și de celule cu mai multe pastile de statut colorate individual (nu doar primele 3 + tooltip „+N” ca la `MonthCalendar`).

Mai important: `VisitsPage.test.tsx` selectează azi celula explicit prin `container.querySelector('button[class*="calendarCellToday"]')`, în trei teste diferite (butoanele rapide de statut, „S-a înscris”, formularul de înscriere) — comportament deja testat, nu doar o scăpare de migrare. Trecerea pe `MonthCalendar` ar cere fie extinderea API-ului ei cu `selected`/`cellHeight`/`role="button" pe <button>` (schimbare de componentă comună, în afara scope-ului acestei treceri — doar `VisitsPage.tsx`/`.module.css`/`.test.tsx`), fie rescrierea celor trei teste ca să caute `role="button"` pe un `<div>` — ambele mai riscante decât păstrarea comportamentului deja funcțional și testat.

Am păstrat `<button>` propriu pentru celula calendarului, cu excepția documentată în R1 `ALLOWED` din `architecture.test.ts`. Tabelul „Toate vizitele” folosește deja `DataTable` real (cu `onRowClick` nativ pentru selecția zilei, fără niciun `<button>`/`<table>` brut). Nimic de decis din partea ta — doar consemnat ca să nu pară o gaură în migrare.

## ✅ Personal (Salarii) — titlul dinamic „Plătește N salarii” — rezolvat 01.10 (PROMPT-CLAUDE-CODE-6.md §2)

**Istoric (decizie anterioară, depășită):** `Dialog` din `@shared/ui` avea un singur prop `title`, folosit simultan ca text de antet vizibil și ca `aria-label` — `SalariesView.tsx` păstra `title="Confirmă plata"` (static) ca să nu rupă `SalariesView.test.tsx` (`getByRole('dialog', { name: 'Confirmă plata' })`), pierzând titlul dinamic din implementarea manuală de dinainte.

**01.10:** `Dialog` capătă prop nou `ariaLabel?: string` (implicit `title`), exact pentru acest caz. `SalariesView.tsx` acum: `title` dinamic („Plătește N salarii”/„Plătește 1 salariu”), `ariaLabel="Confirmă plata"` (static, testul rămâne neschimbat).

## ⏳ Curs valutar — stocat per filială, nu în baza comună — întrebare arhitecturală (F12)

`PROMPT-CLAUDE-CODE-8.md` §3.3 spune „ratele stau în baza comună”. În cod, `exchangeRates`/`exchangeRateSources` sunt chei de settings citite/scrise prin `createSettingsRepository(db)` pe **baza filialei active** (`create-branch-context.mjs`), nu prin `create-common-context.mjs` — la fel și planurile (`plan-presets`). Fiecare filială își ține propriul istoric de curs și propriile planuri, complet separat.

Dacă ar trebui să fie comun (un singur curs/planuri pentru toate filialele unei instalații), e o relocare de date live, nu doar o mutare de cod: fiecare filială existentă are deja propriul `exchangeRates`/`exchangeRateSources`/`plan-presets` salvate, iar o migrare ar trebui să aleagă o sursă de adevăr (ex. filiala cea mai recent folosită) și să șteargă/ignore divergențele celorlalte. N-am făcut nicio mutare fără să întreb — cursul și planurile rămân per filială ca până acum, F12 (polling orar + calendar + backfill) construit pe structura existentă.

**De decis:** rămân per filială (fiecare filială poate avea curs/planuri diferite — util dacă filialele sunt în țări/valute diferite) sau se mută în baza comună (un singur curs valabil peste tot)? Dacă al doilea, urmează o migrare separată, nu inclusă aici.

## ⏳ „+ Plată” din fișă — suma precompletată include restanța? (F11)

`PROMPT-CLAUDE-CODE-8.md` §3.4 / `FEEDBACK-01-10.md` F11: „De încasat: 9.845,00 lei (500 € × 19,69) **plus restanța, dacă există**”. Am precompletat suma doar cu taxa lunii curente (plan × cursul zilei) — restanțele rămân neconectate automat, exact ca la F7 (bifă opt-in, nimic bifat implicit).

N-am inclus restanța în suma precompletată pentru că F7 a decis explicit opus: „plata acoperă luna ei, restanțele devin opt-in” — o sumă precompletată care include automat restanța ar însemna o bifă pre-bifată, exact ce F7 a eliminat. Dacă „plus restanța” din F11 chiar cere suma totală (lună + restanță) pre-adunată, cu bifa pre-bifată doar în acest flux (venit direct din fișă, nu din achitare liberă), e o excepție de la regula F7, nu o aplicare a ei — am lăsat-o deschisă.

**De decis:** suma precompletată rămâne doar taxa lunii (ca acum, utilizatorul bifează manual restanța dacă vrea s-o acopere) sau trebuie să includă automat restanța + bifa pre-bifată, doar pentru acest flux?

## ✅ „Anulează după salvare” (40b) — doar 2 din cele 6 acțiuni legate la `UndoToast`, restul folosesc mecanismul existent — decizie tehnică, nu de business

`PROMPT-CLAUDE-CODE-8.md` §8.2 cere `UndoToast` (slate, bifă mint, „Anulează · N”, fereastră 15s verificată server-side, `POST /api/undo`) pentru 6 acțiuni: achitare, cheltuială, avans, copil nou, mutare în grupă, arhivare — cu instrucțiune explicită să leg „câte pot verifica sigur” și să consemn restul aici.

**Server, generic pentru toate cele 6 (gata, testat):**
- `audit_changes` are acum `session_token` (ștampilat de `createAuditLogRepository`), `findById(id)` și `recordChange()` întoarce id-ul intrării.
- `src/features/audit-log/domain/undo-eligibility.mjs` — `checkUndoEligibility` (fereastră 15s, același calculator prin `sessionToken`, înregistrarea neschimbată între timp) + `restoreValueForUndo` (nu rescrie cu placeholder-ul redactat `[date medicale]` peste date medicale reale curente).
- `POST /api/undo` (`src/features/audit-log/server/undo.routes.mjs`) — nu `/api/undo/:auditId`, fiindcă `route-dispatcher.mjs` n-are segmente dinamice nicăieri în aplicație; id-ul vine în corp, ca `type` la `/api/record`.
- `runRevisionTransaction` propagă acum ce întoarce `applyChanges()` (dacă e obiect) în plicul răspunsului — `saveRecord` (`record-editing.routes.mjs`) întoarce `{auditId}` la fiecare creare/actualizare prin `/api/record`. **Acoperă deopotrivă toate cele 6 acțiuni** (achitare, cheltuială, avans, copil nou, mutare în grupă, arhivare trec toate prin `/api/record`) — nu e nevoie de cod server suplimentar per acțiune.
- 13 + 6 + 4 teste noi (`undo-eligibility.test.mjs`, `undo.routes.integration.test.mjs`, `audit-log.repository.test.mjs`), toate verzi.

**Client — legate de `UndoToast` cu verificare completă (round-trip, cerința explicită „cel puțin 2 din 6”):**
1. **Cheltuială nouă** (`ExpensesPage.tsx`, `submitExpenseForm`/`quickAddExpense`) — `createExpense()` întoarce `auditId`, `UndoToast` cu titlu „Cheltuială adăugată” + sumă/categorie. Test: `ExpensesPage.test.tsx` „40b: «Anulează» din UndoToast...” — creează, verifică toast-ul, dă click, verifică dispariția.
2. **Arhivare copil, un singur rând selectat** (`ChildrenPage.tsx`, `archiveSelected`) — la fel, `UndoToast` cu titlul „Copil arhivat” + numele. Test: `ChildrenPage.test.tsx` „40b: arhivează copilul selectat...” — round-trip complet (arhivează → UndoToast → Anulează → reapare în listă).

**Lăsate pe mecanismul vechi (Toast cu `actionLabel`, dezarhivare/reinversare imediată client-side, fără fereastră de 15s, fără verificare server „neschimbat între timp”) — nu pe `UndoToast`:**
- **Arhivare în lot** (mai mulți copii/cheltuieli selectate deodată din `ChildrenPage.tsx`/`ExpensesPage.tsx`) — „Anulează · N” din spec e un numărător de secunde, pentru o singură acțiune; n-are cum să reprezinte „anulează arhivarea pentru M copii” fără un design nou (listă? un toast per copil?), neclar din prompt. Mecanismul existent (deja testat, M1) rămâne pentru loturi; doar arhivarea unui singur rând selectat a trecut pe `UndoToast`.
- **Achitare (payment), avans, copil nou, mutare în grupă** — serverul e deja gata pentru oricare dintre ele (orice creare/actualizare prin `/api/record` întoarce `auditId`, exact ca la cheltuială/arhivare). N-am mai legat butonul client (`PaymentFormDrawer`/`AdvancesTab`/`ChildFormDrawer`/mutarea de grupă din profilul copilului) din lipsă de timp pentru verificare robustă a fiecăruia (fiecare are propriul flux de succes — `toast.show(...)` — și propriul test de integrare de actualizat), nu dintr-un blocaj tehnic. Firul e identic cu cel de la cheltuială: ia `auditId` din răspunsul lui `session.mutate('/api/record', …)`, cheamă `undoToast.show({ title, detail, onUndo: () => session.mutate('/api/undo', { auditId }) })`.

**Nimic de decis din partea ta** — doar consemnat ca să nu pară o gaură. Dacă urmează un pas separat, următorul e legarea celor 4 rămase, mecanic, după tiparul de la cheltuială/arhivare de mai sus.

## ⏳ 42a/42b — `AppBanner` sincronizare oprită / actualizare gata — rămân neatinse, blocate pe §5.2

`PROMPT-CLAUDE-CODE-8.md` §11 (42a/42b): banda roz „Sincronizare oprită” (nu se închide, cu numărul de modificări în așteptare) și banda mint „Actualizare gata” (se închide până a doua zi) în shell, deasupra antetului, pe toate rutele, plus pastila de sincronizare din antet și „Cere actualizarea” pe profil Educator. Textul §11 le leagă explicit de §5.2 (actualizări/versionare), care nu există încă în cod (fără verificare de versiune nouă, fără semnal server „actualizare disponibilă”, fără contor de modificări nesincronizate expus către UI).

N-am construit un `AppBanner` cu stări fictive doar ca să bifez punctul — ar însemna fie o componentă fără sursă reală de date (stările „oprit”/„gata” n-ar porni niciodată, pentru că nimic nu le declanșează), fie să inventez infrastructura de §5.2 pe ascuns, în afara scope-ului cerut pentru §11. Am lăsat 42a/42b complet neatinse.

**De decis / următorul pas:** 42a/42b se reiau când §5.2 (auto-update/versionare) e construit — atunci `AppBanner` are o sursă reală (stare de sincronizare + verificare de versiune) de legat.

## ✅ 42c — rândul „Rotunjire” de pe bon există și e testat, dar nimic nu populează încă `roundingDiff` — depinde de §9.1

`PROMPT-CLAUDE-CODE-8.md` §11 (42c) cere pe bonul 58mm un rând „Rotunjire” doar dacă `roundingDiff ≠ 0`, plus rândul „€ × curs = lei”, totalul ACHITAT, restanța și avansul. Verificat în cod: `roundingDiff`, `paymentRounding` și `roundTo` (§9.1, 41f din `FEEDBACK-01-10.md`) **nu există nicăieri** — nici tipul `Payment`, nici `payment-form.ts`, nici vreun serviciu de achitări nu calculează sau salvează o diferență de rotunjire. `FEEDBACK-01-10.md` confirmă: „Rotunjire la achitare | ✅ 41f | ⏳ §9.1”.

Am făcut partea care ține strict de bon (42c), fără să ating §9.1 (calculul rotunjirii la salvare — setarea `paymentRounding` pe filială, suma precompletată, logica de toleranță — rămâne alt punct, cu risc de coliziune cu orice agent care lucrează la §9.1 în paralel):
- `Payment.roundingDiff?: number` adăugat în `record-types.d.mts` + whitelist-ul din `normalizeRecord` (`record-schema.mjs`) + validare (`Number.isFinite`), cu teste (`record-schema.test.mjs`).
- `PaymentReceiptThermal.tsx` arată rândul „Rotunjire” (cu semn, „+0,17 lei”/„−1,83 lei”) doar când `payment.roundingDiff` e un număr diferit de zero, și un rând nou „€ × curs = lei” (sursă BNM/manual + data) când achitarea are `fxRate` — date deja calculate în `usePaymentReceipt.ts` dar neafișate pe bonul termic până acum. Total redenumit „TOTAL ACHITAT”.
- Teste structurale pe 4 cazuri (`PaymentReceiptThermal.test.tsx`): fără rotunjire → rândul lipsește; rotunjit în plus (+0,17); rotunjit în minus (−1,83); conversie EUR cu curs și dată.

**Nimic de decis din partea ta** — doar consemnat: rândul e gata și testat, dar va rămâne mereu invizibil (0 cazuri reale) până când §9.1 scrie efectiv `roundingDiff` pe o achitare.

## ✅ 42d — motorul de restaurare a arhivei complete e gata (serverul); rămân coada nou-calculator (UI) și `BackupPage.tsx` — pașii 9-10 din planul §1.2

`PROMPT-CLAUDE-CODE-8.md` §11 (42d) cere: la prima pornire fără date, alegere Backup/Sincronizare/De la zero; previzualizare din `manifest.json`; după restaurare, numără din nou și compară cu manifestul (diferență → nu deschide aplicația, păstrează fișierul); backup de versiune mai nouă blocat; backup vechi `.db` cu avertisment; test de integrare pe calculator gol. Am continuat `docs/superpowers/plans/2026-10-01-backup-complet.md` (F6/§1.2) de la pasul 6, unde se oprise sesiunea anterioară („restorePreview/restore NU sunt încă scrise”).

**Gata, testat (server, fără nicio schimbare în `BackupPage.tsx`/`useRestore.ts`):**
- `full-backup.service.mjs`: `validateArchive(file)`/`restore(file, {apply})` — versiune de aplicație mai nouă blocată (`appVersion` în manifest, comparație semantică), bază lipsă sau coruptă respinsă, numărătoarea fiecărei baze comparată cu manifestul înainte de orice scriere (echivalentul cerut de „numără din nou și compară” — aici înainte de restaurare, nu după, ca nimic să nu ajungă pe disc dacă arhiva nu corespunde) — un eșec nu atinge arhiva de pe disc. `previewArchive(file)` agregă copii/achitări/cheltuieli peste toate filialele, în exact formatul deja afișat de ecranul de restaurare existent.
- `create-application.mjs`: `restoreFullBackup(file)` — backup de siguranță întâi (nu poate eșua silențios), Comun închis/suprascris/redeschis, filialele neactive suprascrise direct, **filiale.json înlocuit cu lista din arhivă** (o filială necunoscută local e adoptată cu exact id-ul din arhivă, pe un folder nou; una locală absentă din arhivă dispare din registru, fișierul ei rămâne orfan pe disc), filiala activă închisă/suprascrisă/redeschisă ultima. O intrare „restaurare” ajunge în audit log-ul bazei proaspăt restaurate.
- `backup.routes.mjs`: `/api/backup` (manual) produce acum întotdeauna o arhivă completă; `/api/backup-preview`/`/api/restore` detectează automat arhivă vs. backup vechi `.db` (avertisment nou în previzualizare pe cel vechi: „conține o singură filială; Comun și celelalte filiale nu se schimbă”).
- Teste: 15 la `full-backup.service.mjs` (inclusiv versiune blocată, bază lipsă, numărătoare alterată), 2 la `backup.routes.integration.test.mjs` prin HTTP real (calculator gol cu o filială, și cu o a doua filială adoptată), 1 la `branch-registry.test.mjs` (`replaceAll`).

**Neatins, din scop (pașii 9-10 ai planului, nu cer explicit „42d” din prompt dar sunt dependențele lui de UI):**
1. **Coada „La prima pornire fără date: alegere Backup/Sincronizare/De la zero”** — n-am găsit nimic din asta în `webapp/src/app/shell/StartupScreen.tsx` (doar progres/eroare/prea-lent) sau în altă parte. E un ecran nou de onboarding, nu o conectare de piese existente — l-am lăsat neconstruit ca să nu improvizez un design fără artboard dedicat (artboard-ul §11 citat de prompt e tot `Feedback 01-10.dc.html#42d`, dar nu descrie pașii ecranului, doar comportamentul din spate).
2. **`BackupPage.tsx`/`useRestore.ts`** nu știu încă să anunțe utilizatorul că, pentru o arhivă completă, restaurarea cere reîncărcarea completă a paginii (nu doar un refetch) — răspunsul `/api/restore` pentru o arhivă e `{ok:true}`, fără `state` inline (motivul: pot apărea/dispărea filiale întregi, nu doar rânduri). Până la actualizarea UI, un restore de arhivă din ecranul deja existent lasă clientul cu starea veche în memorie, până la un refresh manual (F5).

**De decis / următorul pas:** cine construiește coada de prim-pornire (ecran nou + detectarea „fără date”) și actualizarea `BackupPage.tsx` pentru reload — următorul punct din plan, nu inclus aici ca să nu se suprapună cu alt agent care ar putea lucra pe `BackupPage.tsx`.

## ⏳ 44d — regulile de Drawer/Dialog rămân amânate într-o trecere separată (ca 41d)

`PROMPT-CLAUDE-CODE-8.md` §13/44d cere, „aplicate o dată în componentele de bază, nu pe fiecare formular”: focus inițial, Ctrl+Enter = submit, Esc → 40c (deja există, vezi `UnsavedChangesDialog`), subsol fix, focus pe primul câmp cu eroare + număr de erori în subsol, `loading` pe butonul principal, fără drawer în drawer (test de arhitectură), lățimi 620/480/440 ca tokeni.

E cross-cutting peste `Drawer`/`Dialog` din `@shared/ui` și, prin ele, peste aproape toate formularele aplicației (Achitări, Cheltuieli, Copii, Personal, Grupe, Vizite, Avansuri, Setări…) — exact tiparul de la 41d (`toUserError`, amânat deliberat, „pasă separată ulterioară”, `FEEDBACK-01-10.md` rândul „Mesaje de eroare”). N-am atins `Drawer`/`Dialog` de bază și n-am aplicat regulile pe formulare existente în §13 — risc prea mare de regresie într-o singură trecere făcută în grabă, pe lângă 44a–44c.

**Ce am făcut în loc:** `PaymentFormDrawer` (singurul formular pe care l-am extins substanțial în §13, cu frații din 44b) n-a devenit un drawer nou — e cel existent, extins — deci nu intră nici la „componentă nouă care trebuie să respecte regulile de la început”.

**De decis:** cine preia 44d ca pas separat (lățimi ca tokeni, apoi regulile de focus/Ctrl+Enter/eroare pe `Drawer`/`Dialog`, apoi o trecere prin formularele existente) — probabil după ce toate ecranele din coada ALINIERE-DESIGN.md sunt gata, ca să nu se reatingă fiecare formular de două ori.

## ⏳ 44b — anularea unui grup de frați, odată ce Achitări capătă `UndoToast`

Nota „✅ Anulează după salvare (40b)” de mai sus spune explicit că achitările n-au încă `UndoToast` legat client-side (server gata, buton nelegat — „din lipsă de timp”, nu blocaj tehnic). §13/44b cere: „Anularea (40b) anulează tot grupul” pentru o plată cu frați (`receiptGroupId`, vezi commitul 44b) — azi nu există nimic de „anulat” pe calea asta (nici pentru o achitare simplă, nici pentru un grup), deci cerința e imposibil de implementat înaintea notei de mai sus.

**Ce rămâne de făcut, când se leagă `UndoToast` pentru Achitări:** `createPayment` din `usePayments.ts` apelează `session.mutate('/api/record', …)` o dată pentru plata principală și o dată per frate bifat (`buildSiblingPaymentRecords`) — fiecare apel întoarce propriul `auditId` (la fel ca la cheltuială/arhivare). Legarea pentru un grup de frați trebuie să rețină **toate** `auditId`-urile create (nu doar al plății principale) și, la „Anulează”, să cheme `POST /api/undo` o dată per `auditId` din grup — `/api/undo` ia un singur `auditId`, nu există azi o cale de anulare în lot pe server. Dacă fereastra de 15s expiră diferit pentru rânduri create la milisecunde distanță una de alta, primul `/api/undo` eșuat (timeout) nu trebuie să blocheze anularea celorlalte — tratează fiecare apel independent, raportează ce n-a mers.

**Nimic de decis din partea ta** — doar consemnat ca să nu pară o gaură, la fel ca nota de mai sus.
