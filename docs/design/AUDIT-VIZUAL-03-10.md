# Audit vizual cod ↔ design — 03.10.2026

Comparație ecran-cu-ecran, cod live (`npm run dev`, filiala „1 Buiucani", date reale de dezvoltare)
vs artboard `.dc.html` (`npx serve docs/design`), la 1440px. Extensia Chrome nu era disponibilă în
acest mediu — comparația s-a făcut cu Playwright (headless, deja dependență în `package.json`):
captură + extragere text/stiluri calculate pentru fiecare fapt verificat, nu doar inspecție vizuală.

Metodă per ecran: captură artboard (`id` din `ECRANE.md`) + captură ecran viu la aceeași lună/filtru
când se poate; pentru fiecare diferență vizuală suspectă, verificare directă prin DOM (text exact,
`getComputedStyle`, clase) înainte de a o raporta — ca să nu confund o diferență de **date** (luna
curentă fără înregistrări) cu o diferență de **cod**.

Legendă: 🐛 gol real (lipsește din cod, nu doar din datele de test) · ℹ️ deviație deja documentată
(ALINIERE-DESIGN.md/DECIZII.md/INTREBARI.md) — nu se reraportă · ✅ verificat, identic.

---

## Dashboard (`Dashboard.dc.html#1a`)

- ✅ Mărimea KPI: Încasări 36px, Cheltuieli/Diferență/Avansuri 30px — exact ca A8.
- ✅ Pastila de curs BNM: tot blocul e `<a href="https://www.bnm.md/" target="_blank" rel="noopener noreferrer">` — exact ca A8.
- 🐛✅ **Lipsea nota de sub graficul „Evoluția încasărilor"** — reparat: `<p className={styles.chartCaption}>`
  adăugat sub `<BarChart>`, text generat din `chartMonths[0]` (nu hardcodat). Verificat live.
- Bara „Cheltuieli" (verde, a doua serie din grafic) — cod corect (`secondarySeries` trimis,
  culori documentate în INTREBARI.md §11), dar filiala de test (1 Buiucani) are 0 cheltuieli în
  Aug/Sep/Oct 2026 (verificat și pe pagina Cheltuieli, nu doar pe Dashboard) — nu pot confirma
  vizual bara verde cu acest set de date. Nu raportez ca bug; de reverificat cu o filială/lună care
  chiar are cheltuieli.
- Sidebar „Backup și setări" — prezent în DOM (confirmat `innerText`), doar tăiat la marginea
  capturii `fullPage` — nu e bug, eroare de captură.

## Copii — listă (`Copii.dc.html#2a`)

- 🐛 **Lipsește cardul „Ultimele modificări" de sub tabel** — artboard-ul 2a are, sub paginare, un
  card cu ultimele 3 modificări (achitare/notă/mutare grupă) + „Tot istoricul →". Pe lista de copii
  (`ChildrenPage.tsx`) nu există deloc — doar fișa individuală (`ChildProfileView.tsx`, §45b) are
  propriul „Ultimele modificări", pentru UN copil. Posibil artboard-ul 2a arată o variantă la nivel
  de listă (toate modificările, nu doar ale unui copil) nescrisă încă — **întrebare de business**:
  se construiește cardul de listă separat, sau artboard-ul a copiat din greșeală secțiunea de pe
  fișă? Notat în `INTREBARI.md`.
- ℹ️ Rândul de filtre „Date: Toate / Date incomplete / Telefon invalid" din live NU există în
  artboard — pare un filtru în plus, util (leagă de KPI-ul „Fișe de verificat”/„Copii cu date
  obligatorii lipsă” de pe Dashboard), nu o lipsă. Nereportat ca bug — posibil adăugat ulterior
  artboard-ului; de confirmat cu DECIZII.md dacă există o decizie scrisă.
- ✅ Pastilele „De verificat” pe aproape fiecare rând din coloana Plată — corect pentru acest set de
  date (majoritatea copiilor sunt „Fără grupă”/fără taxă setată, deci starea reală e necunoscută,
  nu neachitată) — nu e bug, corespunde mesajului Dashboard „103 copii cu date obligatorii lipsă”.
- ✅ Paginare 25/pagină (F1, deja ✅) — artboard-ul arată 8/pagină doar ca exemplu de mockup mai
  scurt, nu contrazice regula de 25 deja implementată.
- Pastilele de grupă din filtre includ grupe de test („test212”, „test”, „test22”) — poluare din
  datele de dezvoltare, nu un bug de cod.

## Grupe (`Grupe.dc.html#4a` Carduri, `#4b` Tablă)

- 🐛✅ **Eyebrow „Organizare" în loc de „Evidență"** — vezi secțiunea de mai jos (bug sistemic),
  reparat în `nav-items.ts`.
- 🐛✅ **Buton „+ Grupă nouă" fără `size="header"`** — vezi secțiunea de mai jos, reparat.
- ℹ️ „Șterge grupa X" + „Mută întâi cei N copii" sub el (grupă cu copii) — deja documentat ca spec
  explicit în `PROMPT-CLAUDE-CODE-11.md` §Ștergere și `INTREBARI.md` (`blockingChildCount`), nu e
  artefact — artboard-ul (grupa Mars, fără blocare) doar nu a ilustrat cazul blocat.
- ✅ Structura cardului de grupă (nume, contor, bară progres, educator, avataruri copii, „+N"),
  editorul inline „Editează grupa X" (nume, capacitate, Echipa grupei cu Principal/Asistent/
  Înlocuitor + zile, Copii în grupă) — identice cu artboard-ul, verificat captură + DOM.
- Sidebar „Backup și setări" + versiunea lipsesc din capturile `fullPage` anterioare doar pentru că
  ies sub fold la 1000px înălțime — confirmat prezente în DOM (`page.$$eval`), nu bug (același tipar
  ca la Dashboard).

### 4c — panoul „+ Grupă nouă"

- 🐛✅ **Lipsea nota de sub Culoare** („Implicit e prima culoare liberă. Poți alege și una folosită
  deja.") — reparat (`GroupFormDrawer.tsx`).
- 🐛✅ **Vârstă minimă/maximă foloseau `NumberInput` simplu**, fără steperul +/- pe care artboard-ul
  îl arată identic pentru Capacitate ȘI Vârstă (grup unic „Vârstă (pentru sugestii)”, două steppere,
  sufix „ani”) — reparat; fiecare input are acum `ariaLabel` propriu (vechiul `<label>` unic nu mai
  e valabil cu două controale). Layout ajustat (`.fieldAuto`/`.ageInput`/`.ageStepper`) ca rândul să
  încapă în lățimea fixă a drawer-ului (480px) fără overflow — verificat, 0px tăiat.
- ✅ Cele 8 culori (`BOARD_TONE_PALETTE`) — toate prezente în DOM, implicit prima liberă
  (`firstUnusedTone`) — ce părea „doar 7 vizibile" într-o captură mică a fost eroare de citire a
  imaginii, nu bug (confirmat `page.evaluate` pe toate butoanele).
- ✅ Textul „Grupa nouă apare prima, lângă «Fără grupă»…" — deja implementat (`GroupFormDrawer.tsx`
  linia 246), doar ieșea sub fold în captura de 900px înălțime — nu bug.

## Buton CTA principal din antet — bug sistemic (găsit + reparat)

Verificare detaliată (poziție, mărime, font) a butonului „+ Grupă nouă" din antetul Grupe vs
`DS Componente.dc.html#28a` („primary · header"): spec cere Baloo 2, 15px/700, padding 8px 18px.

- 🐛 **`.header` (dimensiunea de buton din antet, `Button.module.css`) nu seta `font-family`/
  `font-weight`** — moștenea doar `font-weight: 800`/`font-size: 13px` de la `.btn`, deci chiar
  butoanele care foloseau `size="header"` ieșeau cu font greșit.
- 🐛 **Aproape niciun CTA principal de antet nu trecea `size="header"` deloc** — verificat toate
  cele 17 locuri cu `useTopbarActions`: 8 butoane CTA (variantă implicită „primary”, stil „+ X nouă”)
  rulau la dimensiunea `md` (13px/800, 8px 16px), nu la `header` (15px/700, 8px 18px):
  Grupe (+ Grupă nouă), Copii (+ Adaugă copil), Achitări (+ Achitare nouă), Cheltuieli
  (+ Cheltuială nouă), Personal (+ Angajat, + Candidat), Bazin (+ Programare nouă), Vizite
  (+ Programează vizită), Raport contabil (Exportă pentru contabil). Deja corecte: Notificare SMS
  („Trimite tuturor"), Prezența („Foi pe săptămână").
- **Reparat**: `font-family: var(--font-heading); font-weight: 700;` adăugat în `.header`
  (`Button.module.css`); `size="header"` adăugat pe toate cele 8 butoane de mai sus. Test nou în
  `Button.test.tsx` (clasa `header`) + story `Header` în `Button.stories.tsx`. Verificat live
  (Playwright, `ui.scale=normal`, 1440px): `+ Grupă nouă` → `Baloo 2`, `700`, `15px`,
  `padding: 8px 18px` — identic cu #28a.
- tsc + 1219 teste webapp (inclusiv `design-system.coverage.test.tsx`, axe) — toate verzi.

## Achitări (`Achitari.dc.html#5a` Tabel, `#5b` Pe luni)

- 🐛✅ **Lipsea eyebrow-ul „ÎNCASARE RAPIDĂ" + nota „Enter deschide plata precompletată (44a)."**
  de la căutarea rapidă din antet — reparat (`QuickPaySearch.tsx`).
- 🐛✅ **Numele copilului în coloana „Copil" nu era bold** (artboard: 800, cod: 400) — reparat cu
  `<strong>`, același tipar ca `PersonCell` (Copii, Personal).
- 🐛✅ **Dropdown „Pe pagină" lipsea din toate tabelele** — semnalat direct de utilizator, vezi
  secțiunea dedicată mai jos (bug sistemic, `DataTable`/`Pagination`).
- 🐛✅ **„Pe luni" (5b) nu avea paginare deloc** — semnalat direct de utilizator; afișa toate cele
  332 de achitări simultan, pe toate lunile (pagină de 18532px). Reparat: `PaymentsByMonth.tsx`
  paginează lista plată (ordinea lunilor, descrescător) cu același `Pagination`/`table.pageSize`
  global ca modul Tabel; antetul fiecărei luni rămâne cu numărul/subtotalul real al lunii, chiar
  dacă pagina curentă arată doar o parte din rândurile ei.
- ⚠️ **„Tipărește raportul zilei"** lipsește din panoul „Casa de azi" — fals-pozitiv: linkul e
  condiționat de `paymentCount > 0` (`CashSummaryCardView.tsx`), iar azi (03.10.2026) nu are nicio
  achitare în datele de dezvoltare. Cod corect, nu bug.
- ❓ **„+ Împarte pe mai multe luni"** (5b, panoul de detaliu) — apare în artboard sub „Luni
  acoperite", absent din `PaymentDetailPanel.tsx`. Comentariul din cod spune explicit „doar
  afișează” alocările, fără editare — posibil scop redus deliberat (editarea completă se face din
  `PaymentFormDrawer`), posibil funcție neconstruită încă. Notat în `INTREBARI.md`.
- ℹ️ Filtrul de arhivare: artboard are un dropdown „Nearhivate ▾”, codul are `SegmentedControl`
  (Active/Arhivate/Toate) — funcțional echivalent, fără spec scrisă care să interzică această
  variantă; nereportat ca bug.
- ℹ️ „Pe luna încasării” (cod) vs „Pe luni” (artboard) — wording, fără decizie scrisă contrară;
  nereportat.

## Eyebrow antet — bug sistemic (găsit + reparat)

`DECIZII.md` §1 (prioritate maximă): eyebrow = grupa din sidebar — Evidență (Copii, Grupe, Prezența,
Bazin, Vizite, Personal) · Contabilitate · De rezolvat · Administrare. Verificat `nav-items.ts`
`VIEW_TITLES` pentru toate cele 19 ecrane:

- 🐛✅ **Grupe arăta „Organizare"** în loc de „Evidență" — reparat.
- 🐛✅ **Vizite arăta „Înscrieri"** în loc de „Evidență" — reparat.
- ✅ Toate celelalte 17 ecrane (Copii, Prezența, Bazin, Personal, Achitări, Cheltuieli, Situația
  plăților, De notificat, Raport contabil, Taxe și grupe, De verificat, Asociere achitări,
  Conflicte, Istoric, Notificări, Backup și setări, Dashboard) — corecte.

## Copii — fișă (`Copii.dc.html#2b`)

- 🐛✅ **„Contract 3” în loc de „Contract #3”** (antet + card KPI) — `useChildProfile.ts` omitea
  `#`-ul pe care `useChildren.ts` (lista) și artboard-ul îl au. Reparat.
- ⚠️→✅ **Fals-pozitiv de infrastructură**: „Ultimele modificări” arăta „Pagina nu există.” —
  NU e bug de cod. Serverul backend (port 8765) rula de pe 30.09, dinainte de ruta
  `GET /api/audit/scope`, deci orice cerere la ea pica în 404 generic. Confirmat direct cu `curl`
  (ruta merge perfect după restart). **Repornit serverul** — „Ultimele modificări” arată acum
  istoricul real. De reținut pentru orice audit viitor: verifică vârsta procesului backend
  (`Get-Process`) înainte de a raporta un gol de date ca bug de cod.
- ✅ „Prezența” (linie de puncte + listă absențe motivate, nu grilă calendar) — verificat intenționat:
  `screens/19-prezenta.md` („Secțiune nouă… luna curentă pe o linie de puncte”) e mai nou decât
  artboard-ul 2b (care arată o grilă calendaristică veche) și are prioritate; codul implementează
  exact spec-ul scris, nu artboard-ul vechi. Nu e bug.
- ✅ Lipsă „Alergii, sănătate”, rolurile „Tată”/„Mamă” la părinți, „vârste X–Y” la educator, „Pot
  ridica copilul” gol — toate implementate corect în cod (`child.healthNotes`, `parentRelation`,
  `group.ageMinYears/ageMaxYears`), doar neconfigurate pentru acest copil de test (Alexander Cerba,
  date reale de dezvoltare) — date, nu cod.
- ✅ „Taxă lunară” (nu „PLAN”) — fără spec scris care să ceară „PLAN”; wording consecvent cu restul
  aplicației (Achitări, Cheltuieli) — artboard-ul pare un draft mai vechi.
- Secțiunea „Note” — live are compunere prin toggle „+ Notă”, artboard arată caseta deschisă
  permanent; ambiguu dacă artboard ilustrează doar starea „deschis” — nereportat, severitate joasă.

## Zile de naștere (`Copii.dc.html#2c`)

- 🐛✅ **4 tonuri de grupă lipseau din CSS** (teal/blue/purple/coral) — vezi secțiunea de mai jos,
  reparat. Grupele cu aceste tonuri (ex. „Mars”) apăreau fără nicio culoare, atât în grila de
  calendar cât și în lista „Toată luna”.
- ✅ Restul ecranului (antet, filtre de grupă, „N zile de naștere”, grila, lista laterală) —
  identic structural cu artboard-ul, diferențele de date (nume, grupe) sunt din setul de dezvoltare.

## Cheltuieli (`Cheltuieli.dc.html#6a` Tabel, `#6b` Pe zile)

- 🐛✅ **„Pe zile" (6b) nu avea paginare deloc** — exact același bug ca Achitări „Pe luni",
  găsit prin aceeași verificare (nu doar semnalat de utilizator de data asta, ci căutat explicit
  după precedent). Toate cele 1201 cheltuieli din bază randau deodată, pe toate datele (pagină de
  96208px). Reparat: `ExpensesPage.tsx` paginează lista plată (ordinea zilelor, descrescător) cu
  același `Pagination`/`table.pageSize` global ca Tabel/Achitări; antetul fiecărei zile păstrează
  totalul real al zilei, chiar dacă pagina curentă arată doar o parte din înregistrările ei.
- ✅ **Mod Tabel (6a)** — coloane, grilă, toolbar (căutare + `PeriodFilter` + „Nearhivate ▾” +
  `FilterPills` Categorie/Metodă), cardul KPI (`1fr 2.2fr`, confirmat deja corect în cod) — toate
  conforme cu spec-ul (`06-cheltuieli.md`) și `ALINIERE-DESIGN.md`. Categoriile din pastile diferă
  de exemplul din artboard (Salarii/Alimentație/Utilități/Materiale/Întreținere) — intenționat,
  categoriile sunt configurabile din „Administrează categorii" (meniul ⋯), artboard-ul arată doar
  date exemplu.
- ℹ️ Cardul „Pe categorii, luna curentă” are un eyebrow explicit, absent din descrierea textuală a
  spec-ului (dar nu contrazice nimic din `DECIZII.md`/`ALINIERE-DESIGN.md`) — etichetă de claritate,
  nereportat ca bug.
- ℹ️ Toate cele 1201 cheltuieli din baza de dezvoltare sunt arhivate (migrarea B3, categoria
  „Bazin” mutată la achitări) — „Nearhivate” arată 0 înregistrări în orice lună; verificat cu
  filtrul „Toate” + perioada „Tot” pentru comparația vizuală. Date, nu bug.
- ✅ Mod Pe zile (6b): blocul „Adaugă rapid” (mint, sumă/descriere/dată/metodă + chip-uri
  categorie), lista grupată pe zile, fără coloana de buget — conform spec-ului, deja în lista
  „Aliniate, fără modificări" din `ALINIERE-DESIGN.md`.

## Situația plăților (`Situatia.dc.html#7a` Lună, `#7b` An școlar, SMS `#7c/#7d/#7e`)

- ✅ **7a (Lună)** — 4 carduri, toolbar (segmented Toți/Restanțieri/Parțial/Achitat/Urmează +
  căutare), `FilterPills` Grupa, coloane/grid, banner „N restanțieri — Notifică toți" (ascuns
  corect când 0 restanțieri) — toate conforme. CTA pe rând (SMS+Plată+ vs Vezi fișa) verificat în
  cod (`NOTIFIABLE_LABELS`), corect, dar nu l-am putut vedea live cu CTA-ul de restanță — luna
  curentă din baza de dezvoltare are 0 restanțieri/parțiale (majoritatea celor 105 copii sunt „De
  verificat", fără taxă setată — date, nu bug).
- ✅ **7b (An școlar)** — cele 3 alinieri mici din `ALINIERE-DESIGN.md` (avatar 30px lângă nume,
  cifrele cardurilor 44px, antetul hărții 11px) erau deja corecte în cod, confirmat și vizual.
  Harta, legenda, outline-ul lunii curente — conforme.
- ℹ️ „Tipărește” e dezactivat în modul An școlar (`disabled={mode !== 'month'}`) — tipărirea nu
  acoperă harta anuală. Nu contrazice explicit `07-situatia.md` (antetul „identic” se referă la
  elementele prezente, nu neapărat la starea fiecăruia), dar nu e nici confirmat ca decizie scrisă
  — severitate joasă, nereportat ca bug.
- ✅ Dialogul SMS (`shared/ui/sms/SmsConfirmDialog.tsx`) — componentă matură, cu teste + Storybook
  proprii și un amendament de design deja referit în cod (`docs/design/FEEDBACK.md`, Task 17);
  nu l-am comparat pixel-cu-pixel cu 7c/7d/7e (artboard-uri probabil mai vechi decât amendamentul).

## De notificat (`De notificat.dc.html#8a`)

- ✅ Structura (listă De trimis/Trimise/Eșuate, bara activă orange 4px, panoul de mesaj cu
  șablon/bulă/footer) — conformă `10-de-notificat.md` și artboard.
- ℹ️ Artboard-ul arată deja „SMS conectat” (nu „Telegram conectat”, cum zice textul vechi din
  `ALINIERE-DESIGN.md` A5) — artboard-ul a fost actualizat între timp; codul (`sms.md
  neconectat`/`SMS conectat`) e corect, aliniat cu artboard-ul curent. Decizia A5 e deja aplicată;
  doar textul din `ALINIERE-DESIGN.md` a rămas în urmă (documentație, nu cod).
- ℹ️ Butoanele „Copiază toate mesajele” (antet) și „Copiază” (panou) nu apar în mockup — comentariu
  explicit în cod (`NotifyPage.tsx`) le justifică drept fallback când sms.md nu e conectat; nu au
  alt loc în layout-ul nou pe 2 coloane. Nereportat ca bug.
- ℹ️ „Editează textul” din spec (footer-ul arborelui, §3) nu există ca buton separat — editarea
  șablonului/textului s-a mutat în dialogul de trimitere (`SmsConfirmDialog`, care are deja
  selector de șablon + textarea), panoul doar arată o previzualizare + „Șablonul și textul se pot
  alege la trimitere.” Consolidare rezonabilă, nu lipsă de funcție.
- ℹ️ „Trimite toate · N” (spec/artboard) vs „Trimite tuturor · N” (cod) — wording, consecvent cu
  „Notifică toți” din Situația 7a; fără decizie scrisă contrară, nereportat.

## De rezolvat (`De rezolvat.dc.html#9a` Taxe și grupe, `#9b` De verificat, `#9c` Asociere achitări)

- 🐛✅ **9a (Taxe și grupe) forța `pageSize={rows.length || 1}` pe `DataTable`** — a treia variantă
  a aceluiași bug sistemic (de data asta explicit, nu lipsă de cod): toate cele 102–103 rânduri
  randau pe o singură pagină de 7950px, indiferent de preferința globală „Pe pagină". Nicio
  justificare în cod pentru excepție; selecția în masă (`selectedRowKeys`) e stare externă, nu
  depinde de pagina curentă — confirmat că paginarea nu rupe fluxul „N selectați → Aplică la N".
  Reparat: scoasă suprascrierea, tabelul folosește acum `table.pageSize` global ca restul aplicației.
- ✅ **9b (De verificat)** — coada din stânga (426 intrări) e deja într-un `ScrollArea` cu înălțime
  fixă (360px, ca în spec), nu randează toate intrările pe pagină — nu are nevoie de paginare,
  tipar corect pentru o coadă secvențială de revizuit. Restul ecranului (progres, caseta
  problemei, acțiunile, tasta S) conform spec-ului.
- ✅ **9c (Asociere achitări)** — structură identică cu artboard-ul (listă + detaliu + sugestii
  Potrivire mare/Posibil/Slab + „Alt copil…” + „Ține minte plătitorul”); lista din stânga (207
  intrări) e la fel într-un container cu scroll propriu, nu pe toată pagina.
- ℹ️ 9c are 3 butoane în plus față de spec (`Completează cu prima sugestie`, `Golește selecțiile`,
  `Salvează asocierile (N)`) — bulk-acțiuni rezonabile pentru un backlog mare (207 azi vs. 64 în
  exemplul din artboard), fără comentariu explicit în cod dar fără conflict cu `DECIZII.md`;
  nereportat ca bug.

## Bazin (`Bazin.dc.html#22a`–`#22d`, `#43b` Azi)

- ⚠️ **Nu am putut verifica vizual live** — filiala activă („1 Buiucani”) nu are bazinul
  configurat (`pool_settings` lipsă → „Bazinul nu este configurat pentru această filială”,
  comportament corect per planul tehnic, §10). Configurarea ar scrie date reale în baza de
  dezvoltare partajată — în afara scopului unui audit doar de citire. Verificat doar din cod.
- ❓ **22a — cardul „Locuri libere” lipsește, înlocuit cu „Motivat”** — logat în `INTREBARI.md`
  (întrebare de business, nu bug silențios reparat).
- ✅ **43b (Azi)** — artboard real, construit intenționat (commit `04d233e`, §12); starea goală
  („Bazinul nu este configurat…”) confirmată corectă pentru o filială fără `pool_settings`.
- ✅ **22c (Luna)** — tabelul pe copii (`MonthView.tsx`) nu folosește `DataTable`/paginare, dar
  setul e natural mărginit (copiii înscriși la bazin într-o lună, nu tot efectivul filialei) —
  nu intră în clasa de bug găsită la Achitări/Cheltuieli/Taxe și grupe.
- ℹ️ Rândul „Antrenor: <nume>” + legenda (A4 din `ALINIERE-DESIGN.md`) — confirmat în cod
  (`WeekView.tsx`), formatul cu virgulă pentru mai mulți antrenori e cel deja decis.

## Prezența (`Prezenta.dc.html#18a` Ziua, `#18b` Luna)

- ✅ **18a** — redesignul A3c (bandă compactă cu 4 contoare + „N% prezenți azi”, grupe în chenar
  colorat, avatar 38px, stare sub nume, fără marcare în masă, `↶ Anulează | N ▾` în antet) e
  implementat exact ca în `ALINIERE-DESIGN.md` — confirmat din cod (comentarii citează explicit
  „A3c”) și live. Bulk-marking (`markAllUnmarkedPresent`/`markGroupPresent`) confirmat șters din
  cod, conform DECIZIA 14.
- ✅ **18b** — MonthStepper, FilterPills Grupa (o singură grupă), „Foi pe săptămână”/„Tipărește
  luna”/„Exportă”, grila zi×copil cu weekend/sărbători gri și zile viitoare goale, coloana Zile,
  rândul „Prezenți pe zi”, `↶ Anulează` partajat cu 18a — toate conforme.
- ℹ️ Deja în lista „Aliniate, fără modificări" din `ALINIERE-DESIGN.md` pentru 18b–18d; verificarea
  live de azi (18a/18b) confirmă asta, nu a găsit nimic nou.

## Legendă progres

- [x] Dashboard (1a) — 1 gol real găsit, reparat
- [x] Copii — listă (2a) — 1 gol real (posibil) găsit, 1 întrebare de business
- [x] Copii — fișă (2b) — 1 gol real reparat, 1 fals-pozitiv (server vechi), rest confirmat OK
- [x] Zile de naștere (2c) — 1 gol real (4 tonuri lipsă din CSS) reparat
- [x] Grupe (4a/4b/4c) — eyebrow, buton CTA, nota Culoare, stepper Vârstă — toate reparate
- [x] Achitări (5a/5b) — 2 bug-uri reparate (Copil bold, paginare „Pe luni")
- [x] Cheltuieli (6a/6b) — 1 bug sistemic reparat (paginare „Pe zile”), rest conform spec
- [x] Situația (7a/7b) — niciun bug găsit; alinierile mici erau deja corecte în cod
- [x] De notificat (8a) — niciun bug găsit; deviațiile (SMS, Copiază, editare în dialog) deliberate
- [x] De rezolvat (9a/9b/9c) — 1 bug sistemic reparat (paginare forțată „all” la 9a)
- [x] Bazin (22a/22b/22c/22d, 43b) — verificat din cod (branch fără bazin configurat); 1 întrebare
- [x] Prezența (18a/18b/18c/18d) — niciun bug găsit; redesignul A3c confirmat complet implementat
- [ ] Personal (23a–23l)
- [ ] Vizite (4a — fișier Vizite.dc.html)
- [ ] Sincronizare (14a/14b/14c)
- [ ] Filiale (13a/13b/13c)
- [ ] Planuri și curs (12a–12g)
- [ ] Notificare SMS/Situatia (7a–7e)
- [ ] SMS istoric (11a/11b)
- [ ] Administrare (10a–10d)
- [ ] Raport contabil (19a/19b)
- [ ] Prima pornire (20a–20c)
- [ ] Încărcare (21a–21c)
- [ ] Responsive (17a–17c)
- [ ] Tipărire/Bon 58mm (16a–16g, 24a–24d)
- [ ] Componente de formular (25a–25f) — verificare per-componentă, nu per-ecran
- [ ] Design system (26–34) — verificare per-componentă din `COMPONENTE.md`, nu artboard-uri de ecran
