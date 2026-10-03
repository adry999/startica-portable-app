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

## Eyebrow antet — bug sistemic (găsit + reparat)

`DECIZII.md` §1 (prioritate maximă): eyebrow = grupa din sidebar — Evidență (Copii, Grupe, Prezența,
Bazin, Vizite, Personal) · Contabilitate · De rezolvat · Administrare. Verificat `nav-items.ts`
`VIEW_TITLES` pentru toate cele 19 ecrane:

- 🐛✅ **Grupe arăta „Organizare"** în loc de „Evidență" — reparat.
- 🐛✅ **Vizite arăta „Înscrieri"** în loc de „Evidență" — reparat.
- ✅ Toate celelalte 17 ecrane (Copii, Prezența, Bazin, Personal, Achitări, Cheltuieli, Situația
  plăților, De notificat, Raport contabil, Taxe și grupe, De verificat, Asociere achitări,
  Conflicte, Istoric, Notificări, Backup și setări, Dashboard) — corecte.

## Legendă progres

- [x] Dashboard (1a) — 1 gol real găsit, reparat
- [x] Copii — listă (2a) — 1 gol real (posibil) găsit, 1 întrebare de business
- [ ] Copii — fișă (2b), Zile de naștere (2c)
- [x] Grupe (4a/4b) — eyebrow + buton CTA reparate; 4c (drawer „+ Grupă nouă") de verificat separat
- [ ] Achitări (5a/5b)
- [ ] Cheltuieli (6a/6b)
- [ ] Situația (7a/7b)
- [ ] De notificat (8a)
- [ ] De rezolvat (9a/9b/9c)
- [ ] Bazin (22a/22b/22c/22d)
- [ ] Prezența (18a/18b/18c/18d)
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
