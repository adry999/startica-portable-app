# Întrebări / decizii blocate

## ⏳ B1 — diagnosticul plăților mixte (rezultatul scriptului, înainte de migrare)

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


Punctele din `docs/design/COADA-DE-LUCRU.md` care au nevoie de o decizie a utilizatorului înainte de a fi terminate integral. **Toate punctele de mai jos au primit răspuns în `docs/design/RASPUNSURI.md` (2026-09-26, 20:20) — vezi acolo detaliul complet.** Rămân aici doar ca istoric + trimitere.

## ⏳ Fișa copilului — relația (Mamă/Tată) pe cei 2 părinți + „persoane autorizate să ridice copilul” lipsesc din modelul de date

Mockup-ul (`Copii.dc.html`, cardul de contacte) arată sub fiecare nume de părinte eticheta relației („Tată”, „Mamă”), dar `Child` (`record-types.d.mts`) are doar `parent`/`phone`/`parent2`/`phone2` — două sloturi fixe de nume+telefon, fără câmp de relație. Mockup-ul nu arată o listă separată de „persoane autorizate să ridice copilul” (dincolo de cei 2 părinți), dar nici schema nu are un asemenea concept — dacă ar trebui adăugat e tot o decizie de produs, nu doar de UI.

Nu e un tweak de UI: fie (a) `parent`/`parent2` capătă un câmp `relation?: string` (schemă + migrare + formular + card), fie (b) rămân fără etichetă de relație (mockup-ul afișează un detaliu pe care spec-ul scris nu-l cere explicit — `09-copii-fisa.md` nu menționează „Mamă/Tată”), fie (c) se face un model mai mare (listă variabilă de contacte, fiecare cu relație + autorizare de ridicare) — schimbare de model separată de CF-4 (notele), deja semnalată în `COADA-DE-LUCRU.md` („Nume/Prenume separate pe Child și număr variabil de părinți”) ca rămasă pentru altă sesiune.

Până la răspuns: cardul de contacte rămâne cum e (2 părinți, nume+telefon, fără relație, fără listă de persoane autorizate).

## ⏳ Modulul 2 (Copii) — CF-2, fișa copilului: „Plătitori reținuți” lipsesc din modelul de date

**Actualizat 2026-09-29:** „Date personale” (IDNP + adresă) s-a implementat între timp — `Child.idnp`/`Child.address` există în schemă, în `ChildFormDrawer` și în `ChildProfileView` (verificat direct în cod, nu doar din audit). Rămâne deschis doar „Plătitori reținuți”: niciun concept `payer_aliases` nu există în cod — nici schemă, nici API, nici UI. Nu e tweak de UI, e funcție nouă (schemă + backend + UI + ștergere alias).

Decizie necesară: (a) adăugăm un tabel/câmp nou pentru plătitori reținuți (plan tehnic separat, ca la EUR/BNM sau filiale), sau (b) rămâne amânat definitiv?

Până la răspuns: fișa copilului rămâne fără „Plătitori reținuți" — restul din CF-1…CF-10 e închis (vezi `COADA-DE-LUCRU.md`).

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

## Folder străin la rădăcina proiectului — `Startica V2/` + `Startica V2.zip`
Găsite netrasate la rădăcina repo-ului (nu în `docs/design/`), 60 de fișiere sub `Startica V2/design/{screens,web}/`. `docs/design/` însuși e deja actualizat (RASPUNSURI.md, screens/*.md, *.dc.html — toate modificate) — par resturi de la dezarhivarea sincronizării, nu conținut încă neaplicat. **Nu le-am şters** — doar excluse din `npm run check` (`.prettierignore`) ca să nu blocheze verificarea. Dacă sunt într-adevăr resturi, se pot şterge cu `rm -rf "Startica V2" "Startica V2.zip"`; dacă sunt ceva în lucru, spune ce.

## ✅ Situația plăților — comentariul din `useStatus.ts` (punctul 7) — rezolvat, de implementat
Comentariul „fără filtre — situația unei luni trebuie să rămână completă” e depășit. Designul 7a are intenționat pastilele Grupa. Intenția se păstrează altfel: filtrul restrânge **doar tabelul**, cardurile de sus rămân mereu pe toată luna (ca la Achitări). Comentariul se rescrie în acest sens.

## ✅ Situația plăților — ecranul complet (punctul 10) — rezolvat, plan înainte de cod
Ecran separat, plan scris înainte de cod (`docs/superpowers/plans/`). Ordinea: (1) pastilele Grupa — punctul 7, (2) cele 4 carduri + modul An școlar + harta — punctul 10, (3) SMS — după P1 din spec-ul SMS.

## ✅ Raport contabil (punctul 14) — selectorul de filială din export — rezolvat, implementat
`20-raport-contabil.md` 19b cerea „Filiala (Ambele pe foi separate / una)”, amânat provizoriu până la filiale (Faza 6 a designului, `2026-09-27-filiale.md` Faza 4 a planului). Implementat: `ReportExportDrawer.tsx` arată grupul „Filiala” doar când sunt mai multe filiale (`GET /api/branches`), cu opțiunile „<filiala curentă>” și „Ambele (o foaie pe filială)”; pe PDF grupul e dezactivat („PDF-ul tipărește filiala deschisă”, PDF rămâne pe filiala curentă). „Ambele” citește celelalte filiale read-only (`GET /api/branches/records?id=`), calculează raportul cu `buildForRecords` (peste `buildAccountingReport`, pur) și scrie un Excel cu `buildMultiBranchWorkbook`: o pereche de foi Încasări/Cheltuieli per filială + un Rezumat comun cu total. Criteriul din `20-raport-contabil.md` e bifat.

## ✅ Încărcare (punctul 12) — pasul „Sincronizez” și „Lucrez fără legătură” — decis provizoriu
Nu există server comun (Faza 6 exclusă): pasul de sincronizare nu apare (spec-ul permite asta), iar pe 21c butonul „Lucrez fără legătură” nu are sens fără server comun — rămân „Încearcă din nou” și varianta cu eroarea bazei locale + „Deschide dosarul cu backupuri”.

## ✅ Personal + Bazin (`docs/superpowers/plans/2026-09-27-personal-bazin.md`) — 6 întrebări deschise, decise provizoriu și deja implementate
Planul le listează cu recomandarea pe care o și urmează în cod; mutate aici ca să nu se piardă, cu răspunsul deja construit:
1. **Valorile implicite ale bazinului** (150 lei/ședință, 30 min, 09:00–11:30 din 30 în 30, locuri nelimitate, lipsa nemotivată se taxează, antrenorul plătit per copil prezent, 60 lei) — doar precompletare de formular, în 22d se schimbă fără cod nou.
2. **Valorile implicite ale Personalului** (`annualLeaveDays = 28`, `deductOnlyUnexcused = true`, departamentele/rolurile din spec) — seminate o singură dată la crearea bazei `comun`, editabile din 23e.
3. **Codul „I” (învoire)** — rămâne în afara ciclului de clic din 23b (doar CO/CM/A); API-ul îl acceptă și legenda îl tipărește, fără ecran propriu în V1.
4. **Zilele rămase de concediu** scad și pentru CO planificat, nu doar pentru cel trecut — fișa arată „14 din 28 · 7 planificate”.
5. **Salariul fix al unui angajat cu ambele filiale** se plătește din filiala activă la momentul „Plătește”; cealaltă arată „Plătit din <filiala>”. Un antrenor `bazin` se plătește separat, per filială.
6. **Salariul antrenorului rămâne vizibil fără PIN** pe cardul din 22c — consemnat explicit în textul din setările 22d, nu ascuns.

Nu blochează nimic din Task 12 (sincronizarea setului comun) — consemnate aici doar ca să nu rămână doar în planul tehnic.
