# Întrebări / decizii blocate

Punctele din `docs/design/COADA-DE-LUCRU.md` care au nevoie de o decizie a utilizatorului înainte de a fi terminate integral. **Toate punctele de mai jos au primit răspuns în `docs/design/RASPUNSURI.md` (2026-09-26, 20:20) — vezi acolo detaliul complet.** Rămân aici doar ca istoric + trimitere.

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
