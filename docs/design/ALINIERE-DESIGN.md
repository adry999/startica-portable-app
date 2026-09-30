# Aliniere cod ↔ design — coada pentru Claude Code (29.09.2026)

Verificat pe `master-v2` @ b84d7df, pagină cu pagină, contra `.dc.html` din `docs/design/`. Detaliile complete sunt în `docs/design/VERIFICARE-DESIGN.md`.

## Stadiu la sync 29.09 17:13 (41 commituri după b84d7df, citit din `COADA-DE-LUCRU.md`)

**Închise în cod:** B1 (fără „Altele”, normalizare, split pe metode) · A1 · A2 · A3 · A3d · A3f (23a/b/c/f/l) · A4 · A5 · schema spec 28 (`parentRelation`, `pickupPersons`, note cu autor/editare/ștergere).

**Lucrate pe un design vechi.** Claude Code a raportat că `docs/design/Prezenta.dc.html`, `Formulare.dc.html` și `Dashboard.dc.html` din repo erau versiunile vechi (pachetul nu fusese copiat). A lucrat din text. După copierea pachetului de acum, **re-verifică vizual A2, A3c, A3e** față de artboard-uri.

**Rămase / redeschise, în ordinea de lucru:**
1. **A3c-fix** — codul are încă marcarea în masă (`markGroupPresent`, `markAllUnmarkedPresent`, butonul „Nemarcații → prezenți”, toastul de grup). **Se scot complet** (decizie 29.09, vezi A3c). Undo/istoric rămâne; se scot doar intrările `bulk`.
2. **A3e-undo** — Anulează / istoric / Ctrl+Z în Prezența · Luna (lipsește; `HistoryEntry` trebuie să poarte `date` pe lângă `childId`).
3. **B1-rest** — cele 7 plăți din `INTREBARI.md`: varianta **(a)** confirmată — rămân în De rezolvat până le împarte cineva. Scoate și fallback-ul „Altele” din `cash-summary.mjs` (Dashboard) și `accounting-report.mjs` (Raport contabil): o plată nerezolvată nu intră în nicio metodă, apare doar în De rezolvat.
4. **A3b** — Achitare nouă (15b): spațierea câmpurilor, „Plătitor” după repartizare, „+ Adaugă observație”, culorile repartizării pe stare, bifa de confirmare în subsol. Neînceput.
5. **B3** — Serviciu pe achitare + filă Servicii (10d) + mutarea încasărilor de bazin. Neînceput. Întâi diagnosticul.
6. **B2** — Șterge definitiv din arhivă (15h). Neînceput.
7. **A6** Asociere achitări · **A7** Backup și setări / Notificări · **A8** diferențe mici · **A9** Documente (plan tehnic întâi). Neîncepute.

**Deschise în `INTREBARI.md`, răspuns utilizator de adăugat în `RASPUNSURI.md`:** descrierea cheltuielii de salariu fără nume (A3f #2), dezvăluirea salariului inline pe 23j (#4), formatul „Antrenor:” cu mai mulți antrenori (A4), SMS în loc de Telegram în De notificat și în bifa din 15b (A5). Până la răspuns rămâne cum e în cod.

## Înainte de început
Pachetul `design_final_startica/` se copiază în `docs/design/` (vezi `README.md` → „Cum se pune în repo”). Citește întâi `DECIZII.md`; pentru culori și tipografie folosește `TOKENS.md`, pentru lista artboard-urilor `ECRANE.md`.

## Ordinea de lucru
Re-verificare vizuală A2/A3c/A3e → A3c-fix (scoate marcarea în masă) → A3e-undo → B1-rest → A3b → B3 → B2 → A6 → A7 → A8 → A9.

(Istoric: A1, A2, A3, A3d, A3f, A4, A5, B1 închise pe 29.09.)

## Reguli
- Referința vizuală e mereu `.dc.html`-ul numit la fiecare punct. Deschide-l, citește valorile inline (padding, radius, font, culori) și folosește tokenii existenți din `tokens.css`. Nu inventa tokeni noi dacă există unul apropiat.
- Nu schimba logica de date decât unde scrie explicit. Hook-urile existente rămân.
- Un punct e închis când: arată ca artboard-ul, criteriile de la punct sunt bifate, `npm run check` + `cd webapp && npm run typecheck && npm test` sunt verzi.
- Commit după fiecare punct (`ui(<ecran>): aliniat la <fișier>.dc.html#<id>`), notează în `COADA-DE-LUCRU.md`, treci la următorul.
- La început, pentru fiecare punct, scrie o listă scurtă: ce lipsește. Apoi lucrează pe ea.
- Oprește-te doar dacă ai nevoie de o decizie de business; scrie întrebarea în `INTREBARI.md` și treci la punctul următor care nu depinde de ea.

---

## A1. `Drawer` comun — `shared/ui/Drawer.module.css`
Referință: `Formulare.dc.html#15a`, `Grupe.dc.html#4c`.
- `.header`: padding `24px 30px`, `border-bottom: 1px solid var(--border)`.
- `.body`: padding `22px 30px`.
- `.footer`: padding `18px 30px`, `display:flex; align-items:center; gap:10px`.
- Criteriu: 4c, 15a, 15b, 22b arată cu antetul despărțit de o linie și conținutul la 30px de margine.

## A2. Copil nou (15a) — `children/ChildFormDrawer.tsx` + `.module.css`
Referință: `Formulare.dc.html#15a`. Lista completă de diferențe: `screens/29-copil-nou-diferente.md`. Pe scurt:
- Titlu „Copil nou” / „Editează copilul”. Subsol: stânga „Poți completa restul mai târziu din fișă.” 13px `--muted`; dreapta „Anulează” (outline) + „Salvează copilul”.
- Fără chenar pe secțiuni și pe cardurile de părinte. Titlu secțiune 12px/800 uppercase `letter-spacing:.08em` `--orange-ink`, gap 12 în secțiune, 22 între secțiuni.
- Input: padding `11px 14px`, radius 12, 15px/600; focus `1.5px solid var(--orange)`.
- **1 · Copil:** grid `1fr 1fr 170px` gap 10 (Nume · Prenume · Data nașterii) + un rând 12px: „10 luni · se potrivește în grupele: **Mars, Soare**” / „**niciuna** — vezi grupele”.
- **2 · Părinți:** rând per părinte, grid `1.4fr 1fr 110px` (Nume · Telefon · Relație: Mamă/Tată/Bunică/Bunic/Tutore/Altul). Link „+ Adaugă încă un părinte” (max. 2). Câmpuri noi: `parentRelation`, `parent2Relation`.
- **3 · Contract și taxă:** grid 3 col (Nr. contract · Începe la · Scadență „ziua N”); dedesubt cele 3 carduri de program, **mereu vizibile** (radius 14, padding `12px 14px`, border 1.5px; selectat 2px `--orange` + `--orange-soft`; nume 14/800 + „8:00–13:00 · 190 €” 12px). Alegerea setează taxa și moneda. Câmp nou `contractNumber` (opțional).
- **4 · Grupă (opțional):** pastile `9px 16px` 13px/800 pe un rând: „Fără grupă” (selectat = slate plin, alb), „Mars · 3 locuri” în tonul grupei (`groupTone`, `-soft` / `-ink`; selectat = ton plin).
- **Principiu:** panoul cere doar ce trebuie ca să existe copilul și să se calculeze taxa. Restul se completează din fișa copilului (2b), direct pe cardul respectiv.
- **Automat la creare (nu apar în formular):** Statut = „Activ”; Data contractului = „Începe la”; istoricul taxei pornește cu programul ales; lista de alergii, persoanele autorizate, notele și documentele pornesc goale.
- **Scoase din panou (și la creare, și la editare):** Date medicale / alergii, Persoane autorizate, Istoric (avansat), Statut, Retragere. Se editează din fișă: „Alergii, sănătate” și „Pot ridica copilul · + Adaugă” pe cardul Date personale, Istoricul taxei din cardul Contract, Retragere/Statut din meniul ⋯ al antetului fișei.
- **Doar la editare**, după secțiunea 4, o secțiune pliată **5 · Alte date**: IDNP, Adresă, Data contractului.
- Criterii: „Copil nou” are exact 4 secțiuni ca în 15a; editarea are 4 + „Alte date”; niciun câmp nu se pierde (tot ce a ieșit din panou are un loc de editare în 2b); cardurile de program apar și la MDL.

## A3. Fișa copilului (2b) — `children/ChildProfileView.tsx`, `shared/ui/ProfileLayout.module.css`
Referință: `Copii.dc.html#2b`. Model de date: `screens/28-fisa-copilului-date.md`.
- Grilă `minmax(0,1fr) minmax(0,1.35fr)` gap 16 (acum `360px / 1fr`). Coloana stângă: Date personale → Grupă și educator → Prezența → Note. Coloana dreaptă: 3 StatCard → Istoric plăți → Documente → Plătitori reținuți.
- Antet: „Editează fișa” + „+ Plată” pe **un rând** (`.actions` → `flex-direction: row`).
- **Date personale** (un singur card, padding `20px 22px`, radius 20): grid `auto 1fr` gap `8px 18px` cu Data nașterii + „Alergii, sănătate” (valoare `#a3361f`, 700). Linie `#f3eee5`. Sub-titlu „PĂRINȚI” 12px/800 `#9aa3a9`: nume 800 + relație 12px `--muted` sub nume, telefon dreapta (sau „+ adaugă telefon”). Linie. „POT RIDICA COPILUL” + „+ Adaugă”: nume, „Bunică · marți, joi”, telefon. IDNP și Adresă se mută în acest card, după Data nașterii. Cardul separat „Părinți” dispare.
- **Grupă și educator:** pătrat 48, radius 14, font 20; rândul 2 „Educator Ala · vârste 2c 5l – 6a 9l”.
- **Note:** fiecare notă padding `12px 14px`, radius 14, 14px, line-height 1.45; cea mai recentă `#fdf3d2` cu meta `#7a5d00`, restul `#f7f4ee` cu meta `#9aa3a9`. Meta: „24.09.2026, 13:10 · Ala (Recepție)” + „· editată” + ⋯ (Editează / Șterge cu toast „Anulează”). Formular: caset `#f7f4ee` border 2px `--orange`, textarea albă, „Renunță” + „Salvează”. Date: notă = `{id, text, createdAt, updatedAt?, author, deletedAt?}` stocată separat de copil (spec 28).
- **Plătitori reținuți:** sub titlu textul „Transferurile de la ei se propun direct pentru <prenume> la Asociere achitări.” (link). Rând grid `1fr auto auto`: nume uppercase 800 + „IBAN MD24 … 4417” / „fără IBAN, doar numele” 12px; „din 14.09.2026 · 3 achitări” 12px `#9aa3a9`; × rotund 28.
- **Contract (StatCard):** sub „din 01.09.2025 · program mediu”.
- **Documente:** scos din design 30.09. Cardul și placeholderul se șterg din fișă.
- Criterii: capturat la 1440px arată ca 2b; relația părinților apare; notele au autor și se pot edita/șterge.

## A3b. Achitare nouă (15b) — `payments/PaymentFormDrawer.tsx` + `.module.css`
Referință: `Formulare.dc.html#15b` (lei), `Planuri si curs.dc.html#12b` (copil cu taxă €). Logica rămâne.
- Câmpuri: `.field` gap `8px` (acum 4); input padding `11px 14px`, radius 12, border `1px solid #c9c4ba`, 15px/600 (acum 8/12, 13px).
- Scurtături „1 lună / 2 luni / 3 luni”: padding `5px 12px` (acum 4/12).
- „Nume din sursă / plătitor” → eticheta „Plătitor”, placeholder „Numele din extras, dacă diferă de părinte”; stă după repartizare, ca în 15b.
- „Observații”: nu mai e textarea deschisă; link „+ Adaugă observație” 13px/800 `--orange-ink` care o deschide. La editare, dacă există text, e deschisă.
- Repartizare automată: punctul și eticheta în culoarea stării (achitat complet / avans = mint `#3f9a6b` / `--mint-ink`; plată parțială = `#e0b400` / `#7a5d00`; neachitat = `#e9527c` / `#b0284f`). Acum totul e mint.
- Subsol: stânga bifa „Trimite confirmare părintelui” (18px, radius 5, bifată = `--orange`), dreapta „Salvează · <sumă>”. Bifa trimite pe Telegram prin coada din De notificat; dacă Telegram nu e conectat, bifa e dezactivată cu textul „Telegram neconectat”. Dacă trimiterea nu există încă în backend → întrebare în `INTREBARI.md`, bifa ascunsă până atunci.
- Copil cu taxă €: cardul copilului, „= X €”, câmpul Curs și linkul BNM urmează 12b (existent în cod, verifică doar spațierea de mai sus).
- Criterii: 15b și 12b arată ca artboard-urile la 1440px; testele din `PaymentFormDrawer.test.tsx` rămân verzi.

## A3c. Prezența · Ziua (18a) — `attendance/DayView.tsx`, `ChildTile.tsx`, `DayView.module.css`, `AttendancePage.tsx`
Referință: `Prezenta.dc.html#18a` (actualizat 29.09).
- **Cele 4 carduri dispar.** În locul lor, un singur card alb (padding `12px 18px`, radius 18, border `--border`, gap 10): pe rândul 1 patru contoare orizontale — punct 10px în culoarea stării (nemarcați = cerc gol border 1.5px `#c9c4ba`), număr Baloo 22/800 în `-ink`-ul stării (0 = `#c9c4ba`), eticheta 13px/700 `--muted`; separate prin `border-right:1px solid #f3eee5`, padding-right 18. Dreapta: „N% prezenți azi” 13px/800 `--mint-ink`. Rândul 2: bară 6px radius pill, segmentată proporțional (prezenți `#3f9a6b`, absenți `#e9527c`, motivați `#e0b400`, nemarcați gol pe `#f1ece2`).
- **Legenda** (Prezent/Absent/Motivat) din bara de filtre dispare — contoarele o înlocuiesc. „Foi pe săptămână” rămâne la dreapta (`margin-left:auto`).
- **Grupa = un chenar în culoarea grupei.** Fiecare secțiune: fundal `-soft` al tonului grupei, `border:1.5px solid` ton mediu (Mars `#f6d3ad`, Soare `#c6e6d3`, Luna `#f6e3a6`, Stele `#f6c6d5`), radius 22, padding `14px 16px 16px`, gap 12. Între secțiuni gap 18.
- **Antet secțiune:** numele grupei Baloo 19/800 în `-ink` (nu Badge), apoi „N din M prezenți · K nemarcați” 13px/700 `#5b666e`. Nimic la dreapta.
- **DECIZIE 29.09 — fără marcare în masă.** Se scot complet: butonul din antet „Nemarcații (N) → prezenți” (`markAllUnmarkedPresent`), acțiunea de pe grupă (`markGroupPresent`, `sectionAction`), toastul de acțiune în masă și testele lor. Fiecare copil se marchează manual (Prezent → Absent → Motivat → Nemarcat); cine nu e atins rămâne **nemarcat** (nu prezent implicit). Specul `19-prezenta.md` (secțiunile despre „Toți nemarcații → prezenți”, „Toți prezenți” pe grupă și criteriul aferent) e înlocuit de acest punct.
- **Placa copilului:** avatar **38** (acum 32), fundal = ton puțin mai închis decât secțiunea (Mars `#f8dcbc`, Soare `#cfe9da`…), Baloo 14/800; numele 13px/**800**; starea **sub nume**, 11px/800 în culoarea stării (acum e pe același rând, `--muted`). Prezent: fundal `#f3faf6`, border `#bfe3cf` (mai deschis decât `--mint`). Nemarcat: alb, border `--border`.
- **Antet pagină — LIPSESC ÎN COD (prioritar, raportat de utilizator 29.09):** grupul „↶ Anulează | N ▾” (Ctrl+Z; ▾ deschide „Modificări azi” cu fiecare acțiune, oră, „Anulează” / „Anulează până aici”, „Anulează tot”). Indicatorul de salvare stă imediat după titlu.
  - Implementare: `useAttendanceDay` ține o stivă `history: {label, time, prev: Map<childId, status|null>, bulk}` pentru ziua afișată; fiecare `cycle` și `setReason` împinge o intrare. „Anulează” = scrie înapoi `prev` prin aceeași mutație (nu ștergere locală), ca să treacă prin sync și Istoric. „Anulează până aici” = pop până la index. Stiva se golește la schimbarea zilei. Ctrl+Z pe pagină = ultima intrare.
  - Același mecanism în Luna (18b) pentru clicurile din grilă.
  - Test: marchez 3 copii, Anulează → doar ultimul revine; „Anulează până aici” pe primul → toți trei revin; „Anulează tot” → starea de la intrarea pe zi.
- **Lipsește în cod:** nota de jos (fundal `--yellow-soft`, radius 14): „**Motivat** cere un motiv scurt…”.
- Spațiere: `.root` gap **18** (acum 12).
- Criterii: la 1440px, primul copil apare deasupra liniei de 400px; fiecare grupă se distinge prin chenar; undo/istoric funcționează ca în 18a.

## A3e. Prezența · Luna (18b) — `attendance/MonthView.tsx` + `.module.css`
Referință: `Prezenta.dc.html#18b`. Logica (grilă, popover motiv, tipărire, export) există; prezentarea nu seamănă.
- **Structură pe rânduri, nu pe celule:** fiecare rând (antet, copil, subsol) e propriul `div` grid `200px repeat(N,minmax(0,1fr)) 70px` cu padding pe rând, nu pe fiecare celulă. Antet `10px 16px` + `border-bottom:1px solid var(--border)`; rând copil `7px 16px` + `border-bottom:1px solid #f3eee5`; subsol „Prezenți pe zi” `9px 16px`, fundal `--cream`. Acum `padding: 8px` pe fiecare din cele 30+ celule strică lățimile.
- **Antet zile:** 10px/800 `#9aa3a9`, **fără** uppercase/letter-spacing (acestea doar pe „COPIL” și „ZILE”, 11px). Ziua de azi: pastilă `--orange`, text alb, radius 6, `padding:3px 0` — doar pe număr, nu pe toată celula. Weekend/sărbătoare: `#c9c4ba`.
- **Celula:** punct **14px** cerc (prezent `#3f9a6b`, absent `#e9527c`, motivat `#e0b400`, nemarcat = cerc gol border 1.5px `#c9c4ba`, viitor = nimic). Coloana de weekend are fundal `--off-day` pe toată înălțimea rândului. Fără border pe celule.
- **Nume:** 13px/800, ellipsis; **Zile:** dreapta 13px/800 „18/22”.
- **Card:** alb, radius **22**, border `--border`, `overflow:hidden`. Gap între bara de filtre și card 18.
- **Bara de filtre:** „Grupa” 13px/700 `--muted` + pastile `6px 14px` 13px/800 în tonul grupei, selectată = slate plin; dreapta „22 zile lucrătoare · prezență medie **86%**” (86% în `--slate`, 800).
- **Lipsește:** nota de sub card, 13px `--muted`: „Zilele de weekend și sărbătorile sunt gri. Un clic pe o celulă deschide aceeași alegere ca în 18a, pentru acea zi. Zilele viitoare rămân goale.”
- **Anulează / istoric:** ca în A3c.
- Criterii: la 1440px toate cele 30–31 de zile încap fără scroll orizontal; captura seamănă cu 18b.

## A3d. Grupe · Carduri (4a) — `groups/GroupCardCompact.tsx` + `.module.css`
Referință: `Grupe.dc.html#4a`.
- Mânerul ⋮⋮ stă **în rând, stânga numelui** (acum absolut, dreapta-sus, și împinge numele cu `padding-right`). Opacitate .55.
- Bara de ocupare: fundal `#fff` (acum `rgba(255,255,255,.6)`), radius pill și pe umplere.
- Meniul ⋯ „Stickere pentru grupă” (există doar în cod): rămâne, dar lângă număr, după ocupare, 24×24, ca să nu se suprapună cu mânerul.
- Selecție: border 2px în tonul grupei (există). Tragere: vezi A8 „Grupe 4a/4b · mutarea grupelor”; `.dragOver` → inel `--orange`, nu `--slate`.

## A3f. Personal — `features/personal/*`
Referință: `Personal.dc.html` (#23a–#23l), spec `screens/24-personal.md`.

**Antet comun (PersonalPage):** comutatorul de file: Echipa · Pontaj · Concedii · Salarii · admin · Candidați. Acțiunea principală a filei stă în antet: „+ Angajat” (23a), stepper lună + „Tipărește” (23b), „+ Concediu” (23f, vezi mai jos), stepper lună + „Blochează” + „Plătește N selectați” (23c), „+ Candidat” (23l).

**23a Echipa — `TeamView`, `staffColumns`:**
- Căutarea: pastilă 280px, padding `9px 14px`, radius pill, **pe același rând** cu pastilele de departament (acum rânduri separate). Dreapta rândului: text 13px `--muted` (ex. „18 angajați · 2 în concediu azi”).
- Butonul „Funcții” (există doar în cod) rămâne, outline mic, la capătul rândului.
- Tabel: card radius 22; coloane `minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.3fr) 130px 100px 20px` gap 12: Angajat (avatar **36** Baloo 13 în tonul departamentului, nume 15/800, sub el 12px `#9aa3a9` „ambele filiale” / etichete) · Funcția 14px `#5b666e` · Grupa și rolul (pastilă „Mars · principal” în tonul grupei, sau „—” `#c9c4ba`) · Telefon · Azi (pastilă: Lucrează / CO / CM / A) · „›”.
- Rând padding `11px 22px`, border-top `#f3eee5`. Antet departament padding `14px 22px 6px` (vezi A8 pentru stil).

**23b Pontaj — `TimesheetView`:**
- Pastilele de departament **fără** eticheta „Departament” și fără card în jur; dreapta textul „Toți lucrează implicit în zilele lucrătoare; se marchează doar excepțiile.” 13px `--muted`.
- **Legenda deasupra tabelului** (acum dedesubt): „Lucrat” stânga; CO / CM / A dreapta. „Zi liberă” iese din legendă.
- **Fiecare celulă e o pastilă** 22px (radius 5, `margin:0 1px`): lucrat = `--mint-soft`, liber = `#f1ece2`, viitor = border 1px dashed `--border`, cod = culoare plină + text alb 10px/800. Acum celula întreagă e colorată mint și codul e o pastilă separată → dungi.
- Culori: **CO = `#e0b400`** (acum `--yellow-ink`, prea închis), CM = `#e9527c`, A = `#6b7780`.
- Totaluri: **Zile** (`--mint-ink`) · **CO** (`--yellow-ink`) · **CM** (`--pink-ink`) · **A** (`--muted`) — 4 coloane `44px 36px 36px 36px`. Acum lipsește CM.
- Rând padding `6px 16px`; nume 13/800, rol 11px `#9aa3a9`. Antet `10px 16px`, ziua de azi pastilă `--orange`.
- **Logică — diferență:** designul permite marcarea zilelor viitoare (concediu planificat); codul le blochează. Decizie: zilele viitoare acceptă doar CO și CM (ciclu gol → CO → CM → gol), A doar până azi. Nota de jos: „Weekend-urile și sărbătorile sunt gri. Zilele viitoare se pot marca dinainte (concediu planificat). Pontajul se tipărește pe A4 orizontal pentru dosar.”

**23f Concedii — `LeavesView`:**
- Totul într-un card (radius 22): antet `16px 22px` cu „Concedii 2026” Baloo 22 + legenda (bare 18×8: Concediu `#e0b400`, Boală `#e9527c`, Planificat `#f0d77a` + border 1.5px dashed `#b89a00`) + „+ Concediu” primar la dreapta. Toolbar-ul separat dispare.
- **Barele trebuie să fie pe zile, nu pe luni.** Acum orice concediu colorează luna întreagă (`monthsTouched`). Corect: pistă continuă 20px, fundal cu 12 benzi alternante (`#faf7f1`/`#f1ece2`), fiecare concediu = `position:absolute` cu `left = ziua din an / zile în an`, `width = durată / zile în an`, `top/bottom:3px`, radius 4.
- Luna curentă evidențiată în antetul coloanelor.
- Nume 14/800 + pastilă grupă (pentru educatori) 11px/800 în tonul grupei.
- „Rămas”: text dreapta 13/800 (ex. „14 zile”), roșu `--pink-ink` dacă < 0. Fără Badge.
- Avertizarea de suprapunere: **în card, jos**, `--yellow-soft`, radius 12: „**Atenție:** Doina Cebotari și Ala Munteanu (Mars) au concediu suprapus 15–27 iulie. Grupa rămâne fără educator; alege un înlocuitor.” — include numele grupei și intervalul formatat.
- **Lipsește:** clic pe o bară deschide `LeaveFormDrawer` în editare (+ „Șterge”). Acum se poate doar adăuga.

**23c Salarii — `SalariesView`, `useSalaries`:**
- **Antet:** stepper lună (acum luna e fixă = luna trecută; stepperul permite lunile încheiate, viitoarele dezactivate), „Blochează” (outline, `POST /api/personal/pin/lock`), „Plătește N selectați” primar. Bara cu `<select>` nativ dispare; metoda (Cash/Card/Transfer, SegmentedControl) se alege în dialogul de confirmare deschis de „Plătește”, care arată și totalul.
- **Carduri** (padding `16px 20px`, radius 20, valoare Baloo 28): „Total salarii · N” `--pink-soft` + cerc decorativ; „Avansuri date” alb; „Plătit” `--mint-soft`; „Rămas de plătit” alb cu border 2px `--slate`.
- **Tabel:** coloane `40px minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1.2fr) 110px 100px 110px 110px` gap 10: bifă 16px stilizată · Angajat (nume 800 + funcția 12px `#9aa3a9`) · **Cum se calculează** = pastilă „Fix” / „Pe zile” / „Bazin” (acum textul brut `fix`/`zi`/`bazin`) · **Baza lunii** 13px `#5b666e` (textul `base` din `salaryForMonth`) · Salariu 800 · Avans `--muted` · De plătit 800 · Stare (pastilă: De plătit / Plătit 12.09 / Din Bazin / Fără salariu setat). Rând selectat `#fffaf0`.
- **Clic pe rând → 23h** (istoric). Meniul ⋯ rămâne pentru Avans / Setează salariul.
- Angajat fără salariu setat: rândul apare, „Baza lunii” = „+ Setează salariul” (link), nebifabil.
- Cele două note de jos (galbenă „Plătește creează…” și albă cu regulile Fix / Pe zile / Bazin).
- **Logică de verificat (utilizatorul spune că salariile „nu sunt în logica din cod”):** `salary-computation.mjs` există (fix pro-rata minus A; zi = tarif × zile lucrate; bazin din `coachPay`). Verifică și scrie rezultatul în `INTREBARI.md`:
  1. `readCoachPayForMonth` e injectat în `createSalariesRoutes` la pornirea serverului? Dacă nu, toți antrenorii rămân „de închis în Bazin”.
  2. Plata creează cheltuiala „Salariu <lună> · <nume>” la categoria Salarii, minus avansurile lunii, și marchează avansurile ca scăzute (`deductedAt`).
  3. Avansul dat intră în Cheltuieli în ziua dării și nu se dublează la plată.
  4. Salariul se vede pe fișa angajatului (23j) după PIN.
  5. Există un loc în UI pentru `deductOnlyUnexcused` și `annualLeaveDays` (Backup și setări sau Funcții).
  Pentru fiecare punct care lipsește: test + implementare.

**23l Candidați — `CandidatesTab`:** corespunde specului. De verificat doar: căutarea 360px; avatar 30 cu inițiale în coloana Nume; telefon bold cu cifre tabulare; notițe pe un rând cu ellipsis, „—” gri când lipsesc; drawer 480px cu Poziție + Vârstă (110px) pe un rând și Unde locuiește + Telefon pe alt rând.

## A4. Bazin — `pool/WeekView`, `pool/BookingDrawer`, `pool/MonthView`, `pool/PoolPage`
Referință: `Bazin.dc.html#22a`, `#22b`, `#22c`. Logica rămâne; se reface doar prezentarea.
- **Antet (PoolPage):** segmented Săptămâna / Luna (pastilă `#f1ece2`), stepper „21–25 septembrie”, „+ Programare” primar.
- **22a carduri:** 4 col gap 14; card padding `14px 18px`, radius 18, fundal+border pe ton; etichetă 12px/800 uppercase în culoarea tonului, valoare Baloo 26 — **aliniate stânga**.
- **22a rând info:** „Antrenor: **Rusu Vlad**” stânga; legendă dreapta: puncte 10px Venit `#3f9a6b`, Lipsă `#e9527c`, Motivat `#e0b400`, De marcat (cerc gol border 1.5px).
- **22a grila:** card alb radius 22 border `--border`; coloane `72px repeat(5,1fr)`; antet zi padding `12px 14px`, număr Baloo 20 + nume zi 13px/800, ziua curentă evidențiată; coloana oră 13px/800 `--muted` padding `12px 0 0 16px`; celule `min-height:92px` padding 8 gap 5, `border-left:1px solid #f3eee5`.
- **22a copil în celulă:** pastilă `5px 8px 5px 5px` radius 10 border 1px; avatar 22 în tonul grupei (9px/800); nume 12px/700 ellipsis; punct stare 10px dreapta. Click ciclează starea doar pentru azi și zilele trecute.
- **22a notă sub grilă:** 13px `--muted` („Zilele trecute și ziua de azi se pot marca…”).
- **22b Programare nouă:** 480px; Ziua = pastile; **Ora = 5 carduri** (`repeat(5,1fr)` gap 6, padding `8px 4px`, radius 12, border 1.5px) cu ora + locuri libere; ora plină dezactivată; „Începând cu” / „Se repetă” pe `1fr 1fr`.
- **22c Luna:** 4 carduri stânga-aliniate (padding `16px 20px`, radius 20); apoi `minmax(0,1.7fr) minmax(0,1fr)` gap 16: stânga card „Pe copii” cu grid `minmax(0,1.6fr) 60px 60px 60px 60px 100px 110px` (avatar 26 în ton, Venit verde `#2e6b4c`, Lipsă roz), dreapta cardul antrenorului (avatar 44 roz, grid `1fr auto` Ședințe ținute / Copii veniți / … , buton „Închide luna”).
- Criterii: 22a, 22b, 22c identice cu artboard-urile la 1440px; testele existente din `pool/` rămân verzi.

## A5. De notificat (8a) — `notify/NotifyPage.tsx`
Referință: `De notificat.dc.html#8a`, spec `screens/10-de-notificat.md`.
- Antet: pastilă „● Telegram conectat” (mint) + „Trimite toate · N” primar.
- Conținut `minmax(0,1fr) minmax(0,1fr)` gap 16.
- Stânga: card radius 22; segmented „De trimis · N / Trimise · N / Eșuate · N”; rânduri padding `14px 18px` border-top: avatar 40 (ton), nume părinte 14/800, „pentru <copil> · <motiv>” 12px, sumă 14/800 colorată; rândul selectat evidențiat.
- Dreapta: card radius 22 padding `22px 24px` gap 14: „Mesaj către <părinte>” Baloo 20 + badge motiv; chip-uri șablon (activ = slate plin); bula mesajului padding `16px 18px`, radius `18px 18px 18px 6px`, `--mint-soft`, 15px/1.55; notă 12px; subsol cu border-top: „Nu trimite” · „Editează textul” (outline) · „Trimite” (primar).
- Tabelul cu 11 coloane și cele 4 carduri de statistici dispar. Datele vin din același hook.

## A6. Asociere achitări (9c) — `assign/AssignPage.tsx`
Referință: `De rezolvat.dc.html#9c`, spec `screens/11-de-rezolvat.md` §9c.
- Antet: „**64** achitări fără copil · 612.480 lei”.
- `minmax(0,1fr) minmax(0,1.1fr)` gap 16.
- Stânga: card radius 22; căutare „Caută plătitor sau sumă”; rânduri padding `12px 16px`: zi Baloo 19 + lună 11px uppercase (44px), nume 14/800, „Transfer · <detalii>” 12px, sumă 15/800; rândul selectat evidențiat.
- Dreapta: card radius 24 padding `24px 26px` gap 16: eyebrow „Achitare selectată · 17.08.2026”, „<plătitor> · <sumă>” Baloo 30, „Detalii bancă: „…”” 13px; „Sugestii” 15/800; carduri sugestie padding `14px 16px` radius 18 border 1.5px: avatar 42 alb, nume 15/800, motiv 12px, scor 12px/800, buton „Asociază”; „Alt copil…” (SearchSelect); bifa „Ține minte: plătitorul „X” = <copil> pentru achitările viitoare”.
- Cele 3 carduri de risc și tabelul cu `<select>` dispar. Scorul și plătitorii reținuți vin din `useAssign`.

## A7. Backup și setări (10c) și Notificări (10b)
Referință: `Administrare.dc.html#10c`, `#10b`.
- **10c:** sub file, 3 carduri de stare `repeat(3,1fr)` gap 14 (padding `20px 22px`, radius 22): două `--mint-soft`, al treilea `--yellow-soft` + border 2px `--yellow` când există o problemă (ex. backup extern lipsă). Apoi `minmax(0,1.3fr) minmax(0,1fr)` gap 16: stânga „Copii de siguranță” ca listă în card; dreapta cardul „Grădinița” (grid `auto 1fr`) + card border 1.5px `--pink` cu acțiunea periculoasă.
- **10b:** `minmax(0,1fr) minmax(0,1.3fr)` gap 16: stânga cardul Telegram, dreapta lista de comutatoare.

## A8. Diferențe mici (un singur commit)
- **Antet (toate modulele):** eyebrow-ul nu mai conține filiala („Organizare”, nu „Organizare · Filiala 1 Buiucani”). Filiala apare doar în butonul-dropdown de filiale din meniul lateral. Actualizează și `screens/17-filiale.md`.
- **Dashboard:** valorile Cheltuieli / Diferență / Avansuri 30px (doar Încasări 36); textul CTA din „Necesită atenție” 13px.
- **Dashboard · curs €** (există în cod, adăugat acum în design): pastilă între căutare și selectorul de lună — cerc 30 `--mint-soft` cu „€” `--mint-ink`, „19,92 lei” Baloo 15/800, sub el „**Curs BNM** · azi” 11px/700 `#9aa3a9`, apoi „↗” 13px/800 `#9aa3a9`; padding `6px 12px 6px 6px`, radius pill, border `--border`. **Toată pastila e link spre `https://www.bnm.md/`** (tab nou, `rel="noopener"`), ca să se verifice rapid cursul. Peste tot în aplicație se scrie **BNM**, niciodată „BNR” — caută și înlocuiește în cod și în texte.
- **Dashboard · Evoluția încasărilor:** două coloane pe lună, una lângă alta (gap 3): Încasări `#f6c98f` (luna curentă `--orange`) și Cheltuieli `#a8d8be` (luna curentă `#5fb58a`); fiecare max. 13px lățime, radius `6px 6px 2px 2px`; lună fără date = 4–6px `#f1ece2`. Comutatorul Încasări/Cheltuieli dispare, în locul lui legenda cu pătrate 10px. Tooltip pe lună: „<Lună> · diferență X lei”. Aceeași scală pentru ambele serii.
- **Copii 2a:** scoate pastila „Scadent”; antet coloană „Părinte · telefon”; sub nume „Contract #N · vârstă”. Coloana arată contactul principal (nume + telefon); dacă există al doilea părinte, insignă „+1” (11px/800, `#f4f1ea`, pill) lângă nume, cu tooltip „Al doilea părinte: <nume> · <telefon>”. Căutarea găsește și după al doilea părinte.
- **Grupe 4a/4b · mutarea grupelor:** în timpul tragerii, cardul sursă devine loc gol (opacity .45, border 2px dashed în tonul grupei); imaginea de tragere e o copie a cardului rotită −2°, border 2px `--orange`, umbră `0 18px 36px rgba(58,71,80,.22)` (ca la copii); ținta primește inel `0 0 0 3px var(--orange)`. Tranziție 120ms pe umbră/opacitate.
- **Cheltuieli 6a:** KPI `1fr 2.2fr`.
- **Situația 7b:** avatar 30 lângă nume în hartă; cifrele cardurilor 44px; antet hartă 11px.
- **Prezența 18a:** tile padding `10px 12px`, radius 16, border 1.5px.
- **Pontaj 23b:** celule = pastilă 22px înălțime, radius 5, `margin:0 1px`, text alb 10px/800; CO `#e0b400` text alb; rol sub nume 11px `#9aa3a9`; antet departament uppercase 12px/800 `#5b666e`, pătrat 8px, fundal `--cream`; legendă cu pătrate 18px și litera în ele; nota de sub tabel.
- **Grupe 4b/4a:** titlul „Fără grupă” 20px; rândurile copiilor din editor cu border 1px `#f1e8d6`, gap 6, radius 12.
- **Vizite:** calendar gap 6, padding celulă `6px 8px`, radius 12.
- **Sincronizare 14b:** coloana dreaptă 380px. **14c:** `font-family: var(--font-heading)` pe titlu (acum `Baloo2`, greșit), radius tabel 14.
- **Încărcare 21a/21c:** cercurile decorative (21a: 300px `--yellow` stânga-sus −90/−90 + 320px dreapta-jos; 21c: 220px stânga-sus −80/−80); rândul sub bară (pas curent 800 stânga, procent dreapta, 13px); gap 26; titlul 21c 30px.

## B1. BUG — Achitări: plățile mixte cad la „Altele” — `record-list-summary.mjs`, `payment-allocations.mjs`, `PaymentsTable.tsx`, `useDayClosingReceipt.ts`
Raportat 29.09: în Achitări apare cardul „Altele”; o plată mixtă (parte cash, parte card) nu se împarte, ci se duce toată la „Altele”. Nu trebuie să existe „Altele”: fiecare leu e Cash, Card sau Transfer.
- **Cauza probabilă:** `summarizePaymentsByMethod` trimite la „Altele” orice `tender.method` care nu e exact `Cash`/`Card`/`Transfer`. Plățile vechi/importate fără `tenders[]` trec prin `paymentTenders()` → un singur tender cu `p.method` (ex. „Mixt”, „cash+card”, „cash”, „Numerar”) și toată suma → „Altele”.
- **Pași:**
  1. Script de diagnostic (doar citire): listează plățile al căror tender nu e exact una din cele 3 metode — id, dată, copil, `method`, `amount`, câmpurile brute. Pune rezultatul în `INTREBARI.md` înainte de orice migrare.
  2. `normalizeTenderMethod()` în `#shared/domain`: case-insensitive, fără diacritice, trim; „numerar”→Cash, „card bancar”/„pos”→Card, „virament”/„transfer bancar”→Transfer. Folosit în `paymentTenders` și la import.
  3. Plățile mixte vechi: dacă înregistrarea brută are sumele pe metodă (ex. `cash`, `card`, `cashAmount`), migrare → `tenders: [{Cash, x}, {Card, y}]`. Dacă nu au, intră în **De rezolvat** cu „Plată mixtă: împarte suma pe Cash / Card” (două câmpuri, suma trebuie să dea totalul). Migrare cu backup și intrare în Istoric.
  4. Scoate „Altele” din `PaymentsSummary`, `PaymentsTable` (cardul), `DayClosingReceipt` (`METHOD_ORDER`) și `useDayClosingReceipt`. O metodă necunoscută după normalizare = eroare de validare la salvare, nu bucket.
  5. `tenderMethodsFor()` nu mai adaugă în SegmentedControl metode din afara celor 3.
  6. `findDuplicatePayment` compară `payment.method` (câmp vechi) — trece pe tenders normalizate.
  7. Plata mixtă nouă (15b): „Metodă” rămâne un singur câmp; link mic „Împarte pe metode” sub Sumă deschide două/trei rânduri Cash/Card/Transfer cu sumă, totalul trebuie să dea Suma. (Modelul `tenders[]` o suportă deja.)
- Criterii: Cash + Card + Transfer = Total pe orice filtru; „Altele” nu mai apare nicăieri; testul „arată un card Altele…” din `PaymentsPage.test.tsx` se înlocuiește cu unul care verifică împărțirea unei plăți mixte; închiderea zilei pe bon dă aceleași sume.

## B2. Ștergere în masă din arhivă (15h) — `shared/ui/SelectionBar`, `ConfirmDeleteDialog`, Copii / Achitări / Cheltuieli / Vizite
Referință: `Formulare.dc.html#15h`. Cerut 29.09.
- Cu filtrul „Arhivate”, bara de selecție arată: „N selectați” · Dezarhivează · Exportă · **Șterge definitiv** (pastilă `#e9527c`, text alb) · „Anulează selecția ×”. În „Active” rămâne doar „Arhivează”. În „Toate”, „Șterge definitiv” apare doar când **toate** rândurile selectate sunt arhivate (altfel ascuns).
- Confirmare: `ConfirmDeleteDialog` existent („Scrie ȘTERGE”), titlu „Ștergi definitiv N <copii|achitări|cheltuieli|vizite>?”, lista numelor (max. 5 + „și încă N”), ce se șterge odată cu ele, buton `--pink-ink` „Șterge N …”.
- Ce se întâmplă cu legăturile: **Copil** → se șterg prezența, notele, documentele, plătitorii reținuți; achitările rămân, cu copil neasociat (apar în Asociere achitări). **Achitare** → se șterg repartizările ei; obligația lunii se recalculează. **Cheltuială** și **Vizită** → doar înregistrarea.
- Backend: o singură mutație pe lot (`/api/record-delete` cu `ids[]` sau un endpoint nou de lot), într-o tranzacție; refuză orice id care nu e arhivat (409). Intră în Istoric ca o intrare per înregistrare, și în outbox-ul de sincronizare.
- Criterii: selectez 3 arhivate → Șterge definitiv → scriu ȘTERGE → dispar din listă și din Istoric apar 3 ștergeri; un rând activ în selecție ascunde butonul; testul de backend refuză ștergerea unui neachivat.

## B3. Serviciu pe achitare + mutarea încasărilor de bazin din Cheltuieli — decis 29.09
Referință: `Achitari.dc.html#5a` (pastila + filtrul Serviciu), `Formulare.dc.html#15b` (câmpul Serviciu).
- **Model:** `Payment.service: string` (id din lista de servicii), obligatoriu, implicit `gradinita`. Kind nou `services` (`id`, `name`, `order`, `tone` din cele 8 tonuri, `priceMode: 'free'|'fixed'`, `price?`, `hidden`, `system: boolean`), per filială, sincronizat. Pornește cu **Grădiniță** și **Bazin** (`system: true` — nu se șterg, nu se redenumesc id-urile, pentru că taxa și Bazinul depind de ele).
- **Servicii noi (10d, `Administrare.dc.html#10d`):** filă „Servicii” în Backup și setări. Listă cu mâner de reordonare, pastila în tonul serviciului, „implicit” la Grădiniță, numărul de achitări, stare Activ/Ascuns, „Editează”. „+ Serviciu” deschide Drawer 480: Nume (obligatoriu, unic), Culoare (8 tonuri), Suma la achitare (Liberă / Preț fix + preț), previzualizarea pastilei. Un serviciu cu achitări nu se șterge, doar se ascunde (nu mai apare în Achitare nouă, rămâne în filtre și în istoricul plăților). Serviciile nesistem nu au obligație: nu intră în „Rest de plată” și nici în Situația plăților, doar în Achitări, Dashboard (Încasări) și Raport contabil.
- **O achitare = un serviciu.** Dacă părintele plătește și grădinița, și bazinul, se fac două achitări. Repartizările unei achitări sunt toate pe serviciul ei.
- **Obligația:** serviciul Grădiniță acoperă taxa lunară (`feeHistory`); Bazin acoperă `charges` de bazin (rândurile din Bazin/Situația/fișă). `obligation()` filtrează plățile după serviciu, ca o plată de bazin să nu scadă taxa grădiniței și invers.
- **Migrare (cu backup + Istoric, o singură dată):**
  1. Toate achitările existente primesc `service: 'gradinita'`.
  2. Cheltuielile care sunt de fapt încasări de bazin (categoria Bazin / descrierea conține „bazin”) — **întâi scriptul de diagnostic doar citire**, listă în `INTREBARI.md` cu dată, sumă, descriere, metodă; utilizatorul confirmă lista.
  3. După confirmare: fiecare devine o **achitare fără copil** (`childId: ''`, `service: 'bazin'`, aceeași dată, sumă, metodă, `sourceName` = descrierea), iar cheltuiala se arhivează cu nota „mutată la Achitări · <id>”. Apar în **Asociere achitări**, unde se potrivesc cu copiii (sugestiile iau în calcul doar copiii cu programări la bazin în luna respectivă).
  4. Totalurile Dashboard/Raport contabil se schimbă: acele sume trec din Cheltuieli în Încasări. Notează în `COADA-DE-LUCRU.md` diferența pe fiecare lună afectată.
- **UI:**
  - 15b: câmp „Serviciu” (SegmentedControl, cu serviciile din listă) sub Copil. „+ Plată” din fișă pornește cu Grădiniță; „Încasează” din Bazin pornește cu Bazin. Scurtăturile 1/2/3 luni apar doar la Grădiniță; la Bazin, scurtătura e „restul lunii · X lei” din `charges`.
  - 5a: **coloană separată „Serviciu”**, după Copil (grid `44px 0.9fr 1.6fr 0.9fr 1.4fr 0.8fr 1fr 1.1fr 48px`): pastilă 12px/800, `4px 10px`, ca la Metodă — Grădiniță `--neutral-soft`/`#5b666e`, Bazin `--blue-soft`/`--blue-ink`; coloana se poate sorta; grup nou în FilterPills „Serviciu: Toate / Grădiniță / Bazin”. Cardurile Cash/Card/Transfer respectă filtrul Serviciu.
  - Bonul de zi, Raportul contabil și exportul primesc coloana Serviciu.
- Criterii: o plată de bazin nu scade taxa grădiniței; Asociere achitări arată încasările de bazin mutate; după migrare nicio cheltuială activă nu mai e încasare de bazin; testele `usePayments`/`obligation` acoperă filtrarea pe serviciu.

## A9. ~~Documente pe fișă~~ — scos din design 30.09, nu se face
Spec `screens/28-fisa-copilului-date.md`: PDF/JPG/PNG ≤ 10 MB, stocare pe server, sincronizate, stare descărcare vizibilă. Kind separat de `children` (ca notele și `payer_aliases`), endpointuri upload/download cu validare tip+mărime. UI: grilă 3 col, rând fișier padding `10px 12px` radius 14 fundal `--cream` border `#f1e8d6`, icon tip 34×40 radius 8, nume 13/800 ellipsis, dată/stare 11px.

---

Aliniate, fără modificări: Sidebar, Topbar, Grupe, Achitări 5a/5b, Cheltuieli 6b, Situația 7a, Prezența 18b–18d, Bon 58 mm, Personal 23a/23c–23l, De rezolvat 9a/9b, Istoric 10a, Conflicte 14c (în afară de font), Filiale, Planuri și curs, Raport contabil, Tipărire, SMS.
