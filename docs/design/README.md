# Handoff: Startica — redesign UI/UX (v1.7)

## Overview
Redesign al aplicației locale Startica (administrare grădiniță: copii, grupe, vizite, achitări, cheltuieli, situația plăților, cozi „De rezolvat”, administrare). Scopul: ierarhie vizuală mai clară, mai puține butoane pe rând, filtre compacte, formulare în panou lateral, stări explicite (gol / eroare / confirmare). Identitatea Startica (culori, fonturi, logo) rămâne neschimbată.

Repo țintă: `adry999/startica-portable-app` (branch `master-v2`), React 19 + Vite + TypeScript + react-router 7 în `webapp/`. CSS Modules per componentă (`*.module.css`), tokeni globali în `webapp/src/shared/tokens/tokens.css`.

## Numerotarea designului
Fiecare modul are numărul lui; literele numără ecranele din modul (ex. 2a, 2b, 2c = Copii).
| Nr. | Modul | Fișier | Ecrane |
|---|---|---|---|
| 1 | Dashboard | Dashboard.dc.html | 1a |
| 2 | Copii | Copii.dc.html | 2a listă · 2b fișa · 2c zile de naștere |
| 3 | Grupe | Grupe.dc.html | 3a carduri · 3b tablă |
| 4 | Vizite | Vizite.dc.html | 4a |
| 5 | Achitări | Achitari.dc.html | 5a tabel · 5b pe luni |
| 6 | Cheltuieli | Cheltuieli.dc.html | 6a tabel · 6b pe zile |
| 7 | Situația plăților + SMS | Situatia.dc.html | 7a lună · 7b an școlar · 7c–7e SMS |
| 8 | De notificat | De notificat.dc.html | 8a |
| 9 | De rezolvat | De rezolvat.dc.html | 9a taxe · 9b de verificat · 9c asociere |
| 10 | Administrare | Administrare.dc.html | 10a istoric · 10b notificări · 10c backup |
| 11 | Mesaje SMS | Sms.dc.html | 11a mesaje · 11b șabloane |
| 12 | Planuri în EUR + curs | Planuri si curs.dc.html | 12a–12g |
| 13 | Filiale | Filiale.dc.html | 13a–13c |
| 14 | Sincronizare | Sincronizare.dc.html | 14a–14c |
| 15 | Formulare și stări | Formulare.dc.html | 15a–15f |
| 16 | Grădinița + tipărire | Tiparire.dc.html | 16a grădinița · 16b confirmare · 16c raport |
| 17 | Ecrane mai mici | Responsive.dc.html | 17a–17c |

## Specificații pe ecrane
Pentru implementare, citește întâi `screens/README.md`. Fiecare ecran are un fișier cu structura explicită: fișiere, date, arbore de componente, CSS, stări, teste și criterii de acceptare.

## About the Design Files
Fișierele din acest pachet sunt **referințe de design create în HTML** (Design Components cu stiluri inline) — arată aspectul și comportamentul dorit, **nu sunt cod de producție de copiat**. Sarcina este să **recreezi aceste ecrane în codul existent** din `webapp/`, folosind componentele din `@shared/ui` (`Badge`, `Card`, `SegmentedControl`, `Drawer`, `ToastProvider`/`useToast`, `DataTable`, `MonthPicker`) și variabilele CSS din `tokens.css` (`var(--orange-ink)`, `var(--radius-xl)`, `var(--shadow-panel)` etc.), extinzându-le unde e nevoie. Logica rămâne în hook-urile existente (`useChildren`, `usePayments`, `useDashboard`…). Nu se schimbă backendul, baza de date sau calculele.

Pentru a deschide referințele de design: servește folderul acestui pachet (ex. `npx serve .`) și deschide `Set final.dc.html`. Fiecare fișier e un canvas cu artboard-uri de 1440 px; id-urile (1a, 2a, 2a…) sunt afișate ca etichete.

> **Implementare existentă pe `master-v2`:** vezi `CORECTII-master-v2.md` — lista exactă de diferențe CSS de corectat (carduri KPI, label-uri, antet, sidebar). Se aplică înainte de orice ecran nou.
>
> **Regulă generală:** valorile de culoare dintr-o secțiune se referă **doar** la elementul numit (label, link), nu la tot cardul. Cifrele mari sunt mereu `#3a4750`. Cardurile colorate sunt plate (fără umbră); cardurile albe au border `#ede7dc`, fără umbră.

## Situația plăților — notificare SMS (`Situatia.dc.html#7c`, `#2b`)
- **Ambele variante se folosesc.** 2a pentru „Notifică” pe un rând (un singur părinte, mesaj editabil liber). 2b pentru „Notifică toți” și „Notifică” din 7b (mai mulți destinatari, șablon cu variabile). Comutatorul „Fără diacritice” și contorul de caractere din 2a se adaugă și în 2b, sub șablon.
- **2a** — „Notifică” pe un rând deschide un modal de 560 px (fundal `#fffaf0`, radius 24): cardul destinatarului (nume, telefon, copil, rest roșu), șabloane (Reamintire restanță / Plată parțială / Personalizat), textarea editabilă precompletată, comutator „Fără diacritice”, contor „N caractere · N SMS” (GSM-7: 160/153 pe segment; cu diacritice UCS-2: 70/67), ultima notificare. Butoane: Anulează / **Trimite SMS**.
- **2c — Personalizat**: aceeași fereastră ca 2a, cu fila „Personalizat” activă. Textarea e liberă (placeholder „Scrie mesajul pentru părinte…”); variabilele `+ părinte`, `+ copil`, `+ rest` se inserează la cursor; bifa „Salvează ca șablon nou” adaugă mesajul la file. În 2b, „Personalizat” golește șablonul, iar previzualizarea înlocuiește variabilele pentru fiecare destinatar. „Trimite” e dezactivat cât textarea e goală.
- **2b** — „Notifică toți” / „Notifică” din 7b: modal de 860 px, șablon cu variabile (`părinte`, `copil`, `rest`, `zi`), previzualizare per destinatar („3 din 13”), listă cu bife; părinții fără telefon sunt excluși automat și marcați. Buton „Trimite N SMS”.
- După trimitere: toast „SMS trimis către …” / „13 SMS trimise”, pe rând apare badge-ul „Notificat azi”, iar evenimentul intră în Istoric. Eroare de la furnizor: modalul rămâne deschis, cu mesaj roșu și „Reîncearcă”.
- **Furnizor SMS — recomandare: sms.md** (local, Moldova). Lucrează direct cu Moldcell, Orange și Unite, are REST API și webhooks (pentru starea „Livrat” din 11a), fără abonament lunar, de la ~0,30 MDL/SMS cu TVA, depozit minim 500 MDL; mesajele respinse (număr invalid) nu se taxează. Suport în română și rusă. Alternativă internațională: BudgetSMS (de la ~0,041 €/SMS, HTTP API). Expeditorul „Startica” se înregistrează la furnizor. Implementarea rămâne în spatele interfeței `SmsProvider`, ca furnizorul să poată fi schimbat.
- **Fără limită lunară.** SMS-urile se trimit manual, fără limită lunară. Aplicația le numără: câte mesaje și câte SMS (segmente) au plecat în fiecare lună, pe filială.
- Cod: `features/status/StatusPage.tsx` + un nou `SmsConfirmDialog.tsx`; trimiterea printr-un endpoint nou din backend, nu direct din browser.
- **Backend (propunere):** `POST /api/sms/send` `{ messages: [{ childId, phone, text }] }` → `{ results: [{ childId, ok, providerId?, error? }] }`. Cheia API și expeditorul se țin în setări locale, niciodată în frontend. Tabel nou `sms_log` (id, child_id, phone, text, segments, status: sent/failed, provider_id, error, created_at) — alimentează badge-ul „Notificat azi”, rândul „Ultima notificare” din 2a și ecranele 11a/11b (`Sms.dc.html`).
- Tabel `sms_templates` (id, name, body, is_default, sort) — fila „Personalizat” + „Salvează ca șablon nou” scrie aici.
- Număr de telefon: normalizare la `+373…` înainte de trimitere; numerele invalide sunt tratate ca „fără telefon” (excluse în 2b).
- Trimiterea în masă: secvențial, max. 1 mesaj/s; rezultatul parțial se afișează în modal („11 trimise · 2 eșuate · Reîncearcă eșuatele”).
- Teste: numărătoarea de caractere/segmente (GSM-7 vs UCS-2), înlocuirea variabilelor, excluderea fără telefon, butonul dezactivat la text gol.

## Decizii funcții noi (25 sept. 2026)
- **Intră:** „Ține minte plătitorul” (Asociere, 9c). La bifare se salvează perechea (nume/IBAN plătitor din textul băncii → copil) într-un tabel `payer_aliases`; la următoarele achitări de la același plătitor, sugestia apare prima, cu motivul „Plătitor reținut”. Aliasurile se pot șterge din fișa copilului.
- **Nu intră acum (se ascund din UI):** buget pe categorii (coloana din 6b dispare, lista pe zile ocupă toată lățimea), „Anulează” în Istoric (10a), bifa de confirmare către părinte din 15b, „+ Atașează bon” din 15c, „Rezumat săptămânal” din 10b.
- **Ecrane:** doar laptop/PC. Se implementează doar pragul 900–1279 px (17a, 17b). 17c (tabletă) nu se face.

## Planuri în EUR, plată în lei (26 sept. 2026)
Taxa lunară e fixă, în EUR, și vine din unul dintre cele 3 planuri (scurt / mediu / lung), cu prețurile editabile din Setări. Achitările se fac în lei; suma se transformă în EUR la cursul BNM din ziua plății (corectabil manual), rotunjit la ban. Datoria și restul se țin în EUR, avansurile în lei, iar Dashboard-ul afișează lei. Specificația completă: `screens/16-planuri-eur.md`; design: `Planuri si curs.dc.html`. **Are prioritate față de orice sumă „taxă în lei” din celelalte secțiuni.**

## Fidelity
**High-fidelity.** Culori, tipografie, raze, spațiere și copy sunt finale. Datele din mock (nume, sume, note, documente) sunt exemple — folosește datele reale.

## Variante alese (sursa de adevăr)
| Ecran | Id | Fișier |
|---|---|---|
| Dashboard | 1a | Dashboard.dc.html#1a |
| Copii (listă) | 2a | Copii.dc.html#2a |
| Fișa copilului | 2b | Copii.dc.html#2b |
| Grupe | 3a | Grupe.dc.html#3a |
| Vizite | 2a | Vizite.dc.html#4a |
| De notificat | 2b | De notificat.dc.html#8a |
| Achitări | 5a (Tabel) + 5b (Pe luni) | Achitari.dc.html |
| Cheltuieli | 6a (Tabel) + 6b (Pe zile) | Cheltuieli.dc.html |
| Situația plăților | 7a (Lună) + 7b (An școlar) | Situatia.dc.html |
| Taxe și grupe | 2c | De rezolvat.dc.html#9a |
| De verificat | 9b | De rezolvat.dc.html#9b |
| Asociere achitări | 9c | De rezolvat.dc.html#9c |
| Istoric / Notificări / Backup și setări | 10a / 10b / 10c | Administrare.dc.html |
| Formulare (copil, achitare, cheltuială) | 15a / 15b / 15c | Formulare.dc.html |
| Confirmări / liste goale / salvare | 15d / 15e / 15f | Formulare.dc.html |
| SMS — confirmare mesaj | 2a / 2b / 2c | Situatia.dc.html |
| SMS — mesaje trimise / șabloane | 11a / 11b | Sms.dc.html |
| Ecrane mai mici | 17a / 17b / 17c | Responsive.dc.html |
| Setări grădiniță / confirmare de plată / situația tipărită | 16a / 16b / 16c | Tiparire.dc.html |

Ignoră variantele eliminate (1b, 1d, 1f) — rămân doar ca explorare. Meniul lateral: **varianta „a” (alb)** peste tot.

---

## Shell global

### Sidebar (`Sidebar.dc.html`, variant `a`) — înlocuiește stilurile `.sidebar` / `.nav`
- Lățime 248 px, fundal `#fff`, `border-right: 1px solid #ede7dc`, padding `26px 16px 18px`, gap 22 px între blocuri.
- Logo singur sus, centrat, 46 px. Sub el, selectorul de filială (vezi `screens/17-filiale.md`). Versiunea `v2.0.0` (11 px, 700, `#9aa3a9`) apare în dreapta rândului „Backup și setări” din meniu și în antetul paginii Backup și setări.
- Grupuri: (fără titlu) Dashboard, Copii, Grupe, Vizite · **Contabilitate**: Achitări, Cheltuieli, Situația plăților, De notificat · **De rezolvat**: Taxe și grupe, De verificat, Asociere achitări · **Administrare**: Istoric, Notificări, Backup și setări.
- Titlu grup: 11 px, 800, uppercase, letter-spacing .09em, `#9aa3a9`, padding `0 12px 6px`.
- Item `.nav`: padding `8px 12px`, radius 12, 14 px, 600, `#3a4750`; marker pătrat 8×8 radius 3 cu culoarea grupului (galben `#f9d257` / mint `#a8d8be` / roz `#f3a6be` / gri `#c9c4ba`).
- **Activ (schimbare față de acum):** nu mai e plin portocaliu; fundal `#fcead3`, text `#a34f00`, 800, marker `#ef8a1d`. Hover: `#fdf3d2`.
- Contoare: pastilă 11 px/800, `#fce9ef` / `#b0284f`, padding `2px 8px`. **Contorul 0 nu se afișează.**
- Jos (`margin-top:auto`): card stare salvare — fundal `#fffaf0`, border `#ede7dc`, radius 14, padding 12. Linia 1: punct 8 px `#3f9a6b` + „Salvat · 12:06” (13/700). Linia 2 (doar dacă există avertizare): 12 px `#7a5d00` „Copie externă neconfigurată · **Configurează**” (link către Backup).
- Stările cardului: vezi 15f (Normal / Se salvează / Nesalvat / Eroare) — deja în `SaveStatusCard.tsx` + `save-status.ts`; rămâne de cablat `warning` (copie externă) din `useBackup`.
- Deja implementat în `Sidebar.tsx` / `Sidebar.module.css` / `nav-items.ts`. Diferență față de design: logo-ul e `width:100%` cu versiunea dedesubt — designul cere logo 38 px înălțime și versiunea aliniată dreapta pe aceeași linie.

### Antet pagină (topbar) — înlocuiește `.topbar`
- **Compact (~60 px):** padding `12px 40px`, `border-bottom: 1px solid #ede7dc`. Pe un rând: titlu Baloo 2 800 24 px, apoi eyebrow 11 px/800/uppercase/.1em `#9aa3a9` (baseline). Detalii: `screens/00-comun.md` A.
- Dreapta: acțiunile paginii. Pe Dashboard: căutare globală (pill 300 px, `#fff`, border `#ede7dc`, placeholder „Caută copil, părinte, achitare…”, badge „Ctrl K”) + selector lună.
- **Selector lună:** apare **doar** pe Dashboard și pe Situația plăților în modul „Lună” (în „An școlar” e înlocuit de „Anul școlar 2025–2026 ▾”). Celelalte ecrane nu îl afișează — Achitări și Mesaje SMS folosesc filtrul „Perioadă ▾” din capul tabelului. Aspect: pill `#fdf3d2`, border `#f6e3a6`, padding 4; butoane rotunde 32 px albe „‹” „›” de o parte și de alta a textului Baloo 700 16 px („Septembrie 2026”). Click pe text deschide meniul din `MonthPicker`.
- Butonul „Reîncarcă” dispare din antet (mută-l în Backup și setări sau în meniul ⋯).
- Banner-ul „Date salvate.” de deasupra conținutului dispare — starea e în sidebar; confirmările folosesc toast (15d).

### Conținut
- Padding `28px 40px 40px`, gap vertical 18–24 px. Fundal pagină `#fffaf0`.

---

## Ecrane

### Dashboard (1a)
- **Rând KPI**: grid `1.5fr 1fr 1fr 1fr`, gap 16. Carduri radius 22, padding `22px 24px`, flex column gap 10, **fără umbră**; cerc decorativ alb 45–50% **jos-dreapta** (`right:-30px; bottom:-40px`, 130/110 px).
  - Label: 12 px / 800 / uppercase / .08em, culoarea ink a cardului. Valoare: Baloo 800, line-height 1, **`#3a4750`** pe toate cardurile, `white-space:nowrap`, **fără zecimale** („236.886 lei”). Mărime: 36 px pe Încasări (1.5fr), 30 px pe celelalte trei — la 36 px suma nu încape pe un rând în coloanele 1fr.
  - Încasări (`#fcead3`): label `#a34f00`; bară stivuită 8 px pe fond alb (cash `#ef8a1d` / card `#f9d257` / transfer `#a8d8be`) + legendă 12 px `#5b666e` cu pătrățele 8×8 și sume compacte („Cash 129.036”).
  - Cheltuieli (`#e7f4ec`): link „+ Adaugă cheltuială” `#2e6b4c`.
  - Diferență (`#fdf3d2`): subtext „încasări − cheltuieli”.
  - Avansuri nerepartizate: fundal alb, **border 1.5px dashed `#e6d9c4`**, label `#6b7780`, pastila „Toate lunile, până azi” (`#f4f1ea`/`#6b7780`) **jos**, sub valoare — separă vizual indicatorul cumulat de cei lunari.
- **Rând 2**: grid `1.45fr 1fr`.
  - Evoluția încasărilor: 12 bare (max 34 px lățime, radius `10 10 4 4`), luna curentă `#ef8a1d`, restul `#f6c98f`, lunile fără date `#f1ece2` înălțime 6 px. Etichetă luna curentă `#a34f00` 800. Comutator „Încasări / Cheltuieli” (segmented).
  - Necesită atenție: 4 rânduri radius 16, padding `10px 12px`, fundal pe categorie (pink/yellow/mint); contor în pătrat alb 52×44 Baloo 20; CTA text „Vezi lista →”. **Rândul cu 0 e neutru** (`#f7f4ee`, text `#9aa3a9`, fără CTA).
- **Zile de naștere**: card cu grid `380px 1fr`. Stânga: următoarele 5 zile (rânduri `#fdf3d2` cu avatar inițiale, „împlinește X ani”, pastilă „în 2 zile”). Dreapta: toată luna, grid 4 coloane de chip-uri (zi Baloo 18 + nume); zilele trecute opacitate .7. Înlocuiește calendarul lunar mare.

### Copii — listă (2a)
- Antet: doar „+ Adaugă copil” (`.btn-primary`, deschide 15a). **Fără buton „Import CSV”** — importul copiilor se face o singură dată, din Administrare → Backup și setări → Import și export.
- 3 statistici compacte (rânduri orizontale, radius 20, padding `16px 20px`): 99 Copii activi · 1 Grupe ocupate · 99 Fișe de verificat (+ „Verifică →”). Aceeași logică ca acum (PLAN_UI_ASTRA §6).
- Card tabel (radius 22): **bara de filtre e în capul tabelului**: căutare (flex 1, `#fffaf0`), segmented „Activi · 99 / Arhivați · 6 / Toți” (înlocuiește select-ul Arhivare), „Grupă ▾”, „Plată ▾”.
- Bară de selecție (apare doar cu rânduri bifate): fundal `#3a4750`, text alb 13 px: „2 selectați | Mută în grupă · Exportă · Arhivează (`#f3a6be`) … Anulează ×”.
- Coloane: ☐ · Copil (avatar 38 px inițiale pastel + nume 800 + „Contract #3 · 4 ani” 12 px `#9aa3a9`) · Părinte · telefon · Grupă (badge colorat) · Scadență · Plată luna curentă (badge cu punct: Achitat mint / Parțial yellow / Neachitat pink / Scadent gri) · ⋯.
- **Acțiunile Editează / Reactivează / Șterge definitiv trec în meniul ⋯.** Click pe rând → fișa copilului (2b).
- Paginare: „Afișez 1–8 din 99” + numere de pagină (pagina activă `#fcead3`/`#a34f00`).

### Fișa copilului (2b) — înlocuiește dialogul `#profileBody`
Pagină proprie (nu dialog). Breadcrumb „Copii / Nume”.
- Header card `#fcead3` radius 24: avatar 84 px, nume Baloo 36, meta (dată naștere · vârstă · contract), badge statut + grupă, butoane „Editează fișa” (alb) + „+ Plată” (primar, deschide 15b pre-completat).
- Grid `1fr 1.35fr`:
  - Stânga: Date personale + Părinți (listă cu telefon; „+ adaugă telefon” dacă lipsește) · Grupă și educator (pătrat inițială grupă + „Schimbă”) · Note (carduri `#fdf3d2` cea mai recentă, `#f7f4ee` restul, „+ Notă”).
  - Dreapta: 3 mini-carduri Sold (mint) / Taxă lunară (yellow) / Contract (alb) · Istoric plăți (tabel lună · dată · metodă · sumă · badge) · Documente (grid 3, icon PDF colorat, „+ Încarcă”).

### Grupe (3a / 3b) — comutator „Carduri | Tablă” în antet
- Același antet compact în ambele moduri: titlu, „N copii în grupe · N fără grupă”, comutator (segmented `#f1ece2`, ca la Achitări), „+ Grupă nouă” în modul Tablă. Alegerea se ține minte (localStorage).
- **Tablă (3b)**: sub antet, bara de filtre (căutare copil, pastila „Doar activi”, „Restrânge tot / Deschide tot”); coloane pe grupe cu drag & drop, restrângere la 84 px.

#### Carduri (3a)
- Grid 3 coloane de carduri radius 24: nume Baloo 24, ocupare „7/10” Baloo 28, bară capacitate 8 px, educator + interval vârstă, stivă avatare (5 + „+2”), pastilă „▾ Deschide / ▴ Restrânge”.
- Al treilea card: „+ Grupă nouă” dashed `#e0d5c2` cu formular inline (nume + locuri + „Creează”) — înlocuiește formularul din capul paginii.
- **Click pe card = expand/collapse** editorul grupei sub grid (un singur editor deschis; cardul deschis are border 2 px în culoarea grupei). Editor: rând Nume / Educator / Capacitate / Salvează; „Copii în grupă · 7” + vârste; grid 2 coloane de rânduri copil (avatar, nume, vârstă, ×); combobox „Caută copil” cu sugestii din copiii fără grupă (+ Adaugă); „Șterge grupa X” text roșu `#b0284f` aliniat dreapta.
- Grupă goală: stare „Niciun copil în grupă” dashed mint.

### Vizite (2a)
- Statistici ca pastile inline (număr Baloo 22 + etichetă) în loc de 4 carduri mari.
- Grid `1.6fr 1fr`: calendar lunar (reutilizează `.month-calendar`, celule 72 px) | panoul zilei selectate: oră, copil + vârstă, părinte, grupă dorită, notă; **„Cum a decurs vizita?” — 4 butoane**: Efectuată (mint) · S-a înscris (orange) · Neprezentată (gri) · A renunțat (pink). Sub: Editează · Reprogramează · Arhivează. Înlocuiește cele 5 butoane de pe rând din tabel.

- **Tabel „Toate vizitele”** sub calendar (card radius 22, același stil ca tabelul Copii 2a): bara cu titlu, căutare (copil/părinte/telefon), segmented Toate / Programate / Arhivate, „Statut ▾”, „Perioadă ▾”. Coloane: Data + ora (sortare descrescătoare) · Copil + vârstă · Părinte + telefon · Grupă dorită · Notă (trunchiată) · Statut (pastilă colorată ca butoanele „Cum a decurs vizita?”) · „⋯” (Editează / Reprogramează / Arhivează). Click pe rând selectează ziua în calendar și deschide panoul vizitei. Paginare 20/pagină.

### De notificat (2b)
- Antet: pastilă „Telegram conectat” + „Trimite toate · N”.
- Grid 2 coloane: coada (tab-uri De trimis / Trimise / Eșuate; rând selectat cu bară stânga 4 px `#ef8a1d`) | previzualizare mesaj (șabloane ca chip-uri, bulă `#e7f4ec`, câmpuri auto îngroșate, Nu trimite / Editează textul / Trimite).

### Achitări (5a / 5b) — comutator „Tabel | Pe luni” în antet
- Comutator: segmented pill `#f1ece2`, opțiune activă albă cu umbră. Persistă alegerea (localStorage).
- **Tabel (5a)**: 4 carduri sumar (Total filtrat orange / Cash / Card / Transfer — cele cu 0 au valoarea gri). Filtre într-un rând: căutare, Copil ▾, segmented metodă, Perioadă ▾, Nearhivate ▾. Rând „Filtre active” cu chip-uri ștergibile + „Resetează”. Coloane: ☐ · Data · Copil/sursă (+ badge „Neasociată” + link „Asociază →”) · Metodă (badge) · Luni acoperite (badge yellow) · Total (dreapta, 800) · ⋯. Bara de selecție flotantă jos (`#3a4750`, radius 16): „2 selectate · suma | Asociază cu un copil · Exportă · Arhivează”.
- **Pe luni (5b)**: tab-uri Toate / Neasociate (pink) / Arhivate; grupuri pe lună cu subtotal; rânduri cu zi mare Baloo 20 + lună; click → **panou detaliu dreapta 400 px** (header pink dacă neasociată, sumă Baloo 38, asociere cu sugestii, luni acoperite, data/metodă, Arhivează · Anulează · Salvează).

- Actualizări: cardurile Cash/Card/Transfer arată mereu defalcarea reală (cu număr de achitări); metoda filtrată are contur 2 px. Coloană nouă **Plătitor** (din „Ține minte plătitorul”); pentru neasociate, Copil = „—”. Eticheta „Neasociată →” și bara de selecție duc la De rezolvat → Asociere achitări (singurul flux de asociere). Meniul „⋯”: Editează / Tipărește confirmarea (16b) / Schimbă copilul / Arhivează. Panoul din 5b: Plătitor + Copil, link spre De rezolvat, buton „Tipărește confirmarea”. Fără filtrul „Copil ▾” (căutarea acoperă).

### Cheltuieli (6a / 6b) — comutator „Tabel | Pe zile”
- **Tabel (6a)**: card total lună (mint) + card categorii (bară stivuită 12 px + 5 legende cu sume). Tabel: Data · Descriere/furnizor · Categorie (badge colorat) · Metodă · Sumă · ⋯.
- **Pe zile (6b)**: bloc „Adaugă rapid” mint (sumă, descriere, dată, metodă, Adaugă + chip-uri categorie); listă pe zile; coloană buget pe categorii cu bare de progres + avertizare depășire. *Bugetul e funcție nouă — de confirmat cu proprietarul înainte de implementare.*
- Culori categorii: Salarii `#ef8a1d`, Alimentație `#f9d257`, Utilități `#a8d8be`, Materiale `#f3a6be`, Întreținere `#9aa3a9`.

### Situația plăților (7a / 7b) — comutator „Lună | An școlar”
- **Lună (7a)**: 4 carduri (De încasat · Încasat cu bară · Restanțe pink · Fără taxă setată yellow + „Completează →”). Tab-uri Toți / Restanțieri / Parțial / Achitat / Urmează. Coloane: Copil · Scadență · Taxă · Achitat · Rest (roșu dacă >0) · Statut · CTA (Notifică / Vezi fișa). Banner jos `#fdf3d2` „N restanțieri — Notifică toți”.
- **An școlar (7b)**: 3 carduri (restanțe / rată încasare / parțiale). Hartă: coloana copil 230 px + 12 coloane lună + Sold 130 px; celule 30 px radius 8: achitat `#a8d8be`, parțial `#f9d257`, neachitat `#e9527c`, urmează `#f1ece2`, înainte de contract `#faf7f1`; luna curentă cu outline 2 px `#fcead3`. Legendă sus.

### Taxe și grupe (2c)
- Progres în antet („6 din 109 completate” + bară 8 px).
- Notă explicativă `#fdf3d2`.
- Bara de selecție `#3a4750` cu „Aplică: Grupă ▾ · Taxă · Scadență · Aplică la N”.
- Tabel editabil inline: câmpurile lipsă au border `#f3a6be` și text placeholder gri; buton „Salvează” per rând devine primar când rândul e modificat.

### De verificat (9b)
- Tab-uri Toate / Fișe / Achitări. Grid `360px 1fr`: coada (punct severitate roșu/galben/mint, problemă sub nume) | cardul cazului curent: identitate + „Deschide fișa →”, casetă problemă `#fce9ef`, tabel comparativ (diferențele pe `#fdf3d2`), acțiuni: acțiune principală (ex. „Unește fișele”) · „Nu e … · marchează verificat” · „Sari peste” (tasta S). Progres „1 din 284”.

### Asociere achitări (9c)
- Grid 2 coloane: lista neasociatelor | detaliu: sumă, text bancă, **sugestii ordonate** (Potrivire mare mint + buton primar / Posibil / Slab), motivul potrivirii sub nume, căutare „Alt copil…”, checkbox „Ține minte plătitorul” *(funcție nouă — de confirmat)*.

### Istoric (10a)
- Grupat pe zile; rând: oră · badge acțiune (Creat mint / Modificat yellow / Arhivat gri / Asociat orange / Șters pink) · descriere + diff „vechi (tăiat) → **nou** · câmp” · „Anulează” *(funcție nouă — de confirmat)*. Filtre segmented Tot / Copii / Achitări / Grupe.

### Notificări (10b)
- Card Telegram mint (cont, ultimul mesaj, Schimbă contul / Deconectează). Listă comutatoare (reutilizează `.toggle-field`, activ `#ef8a1d`): Restanțe, Zile de naștere, Vizite, Rezumat săptămânal *(nou)*, Probleme la backup — fiecare cu descriere și programare.

### Backup și setări (10c)
- 3 carduri pas ①②③: Date salvate (mint) · Backup local (mint) · Copie externă — **stare de avertizare** yellow cu border 2 px `#f9d257` și CTA primar „Alege un stick sau un folder”.
- Listă copii de siguranță (dată, mărime, automat/manual, Restaurează) + „Fă un backup acum”. Carduri Import și export, Grădinița. „Zonă periculoasă” cu border `#f3a6be`.

---

### SMS — mesaje trimise (11a)
Filă nouă „Mesaje SMS” în Notificări (comutator `pill` Canale / Mesaje SMS / Șabloane în antet), fără selector de lună; perioada se alege din „Perioadă ▾” (implicit ultimele 30 de zile).
- Rând de statistici inline: trimise · eșuate (`#b0284f`) · SMS consumate; dreapta, contorul pe luni: pastile pentru ultimele 3 luni („Sep 61 · Aug 54 · Iul 38”) + „Toate lunile →”.
- Grid `1fr 380px`. Tabel: tabs Toate / Livrate / În curs / Eșuate, căutare, „Șablon ▾”. Coloane: Trimis (zi + oră) · Destinatar (părinte + copil) · Mesaj (o linie, trunchiat) · Șablon (badge neutru) · Stare (badge cu punct: Livrat mint / În curs yellow / Eșuat pink).
- Panou detaliu: header în culoarea stării, bula mesajului, date (trimis, șablon, lungime, sursă), răspunsul furnizorului la eșec, „Retrimite” + „Corectează telefonul” (deschide fișa copilului la Părinți).
- Date: tabelul `sms_log`. Starea „În curs” → „Livrat” vine din raportul de livrare al furnizorului (dacă îl oferă; altfel doar Trimis / Eșuat).

### SMS — șabloane și furnizor (11b)
- Grid `320px 1fr`. Stânga: lista șabloanelor (etichetă „Implicit” mint, „Nou” orange pentru cele salvate din Personalizat; rând activ cu bară 4 px) + card „Furnizor SMS” (Serviciu ▾, Expeditor, Cheie API mascată + Schimbă, „Trimite SMS de test”, badge Conectat / Neconectat).
- Dreapta: editor — Nume, Text cu variabile ca pastile (`părinte`, `copil`, `luna`, `rest`, `achitat`, `zi`), comutatoare „Fără diacritice la trimitere” și „Implicit pentru Notifică”; previzualizare cu date reale ale primului restanțier + contor; avertizare yellow despre numele lungi. Footer: „Folosit de N ori” · Renunță · Salvează șablonul.
- „Șterge șablonul” (text roșu) → confirmare simplă; șablonul implicit nu poate fi șters.

### Ecrane mai mici (17a–17c)
- **≥ 1280 px**: layoutul de bază.
- **900–1279 px** (17a, 17b): sidebar ascuns; buton ☰ 42 px în antet deschide sidebar-ul peste conținut (overlay `rgba(58,71,80,.35)`, slide din stânga 200 ms, Esc închide). Căutarea devine buton rotund ⌕ care deschide căutarea globală. Selector lună prescurtat („Sept. 2026”). Grile KPI 4 → 2 coloane; rândul 2 din Dashboard rămâne pe 2 coloane; zilele de naștere sub ele, pe toată lățimea. Padding conținut `24px 28px`.
- **< 900 px** (17c): *nu se implementează — aplicația se folosește doar pe laptop/PC.* Păstrat ca referință: tabelele devin liste de carduri (avatar, nume + badge statut, o linie meta, suma și CTA dreapta). Tab-urile derulează orizontal. Acțiunea principală a paginii („Notifică toți”) într-o bară fixă jos. Drawer-ele și modalele pe toată lățimea.
- Implementare: `AppShell.module.css` (media query la 1279 px, stare `navOpen`), `Sidebar.tsx` (prop `mode: 'fixed' | 'overlay'`). Lățime minimă a aplicației: 1024 px.

### Setări grădiniță (16a)
- Filă nouă „Grădinița” în Backup și setări (comutator `pill` Backup / Import și export / Grădinița). Înlocuiește cardul „Grădinița” din 10c.
- Grid `1fr 400px`. Stânga, 3 carduri numerotate: **1 Identitate** (logo 96 px dashed + „Schimbă” / „Folosește logo-ul Startica”; Denumire, Nume afișat, IDNO, Administrator) · **2 Contact și plăți** (Adresă, Telefon, Email, Site, IBAN, Banca) · **3 Confirmări de plată** (Următorul număr, Semnătură, Mențiune în subsol).
- Dreapta, sticky: previzualizarea antetului așa cum apare pe documente + Renunță / Salvează datele.
- Date: un obiect `kindergarten` în setările locale (nu în tabelele de copii). Numerotarea confirmărilor crește automat și nu se reutilizează.

### Confirmare de plată (16b) — A5 portret
- Deschisă din Achitări (meniul ⋯ → „Tipărește confirmarea”) și din fișa copilului (istoric plăți). Se tipărește sau se salvează ca PDF (`window.print()` pe o rută `/achitari/:id/confirmare` cu `@page { size: A5 }`).
- Antet: logo 34 px + datele grădiniței aliniate dreapta, linie 2 px `#ef8a1d`. Titlu „Confirmare de plată” + Nr. (Baloo 28) + dată.
- Copil + contract, plătitor, metodă; tabel „Se repartizează pe” (lunile din alocare) + Total achitat (Baloo 22); suma în litere; casetă yellow cu restul și scadența (doar dacă există rest); două linii de semnătură; subsol cu mențiunea din 16a.
- **Nu e bon fiscal** — mențiunea din subsol e obligatorie. Dacă grădinița are nevoie de documente fiscale, acestea rămân în afara aplicației.

### Situația plăților tipărită (16c) — A4 orizontal
- „Tipărește” din 7a deschide un dialog mic: Ce tipăresc? (filtrul curent / toți copiii) · Coloane (cu/fără telefon) · Orientare.
- Antet: logo, titlu „Situația plăților · Luna”, data situației + filtrul aplicat; dreapta denumire + IDNO.
- Bandă de 4 totaluri (De încasat, Încasat, Rest, Copii în listă). Tabel 11 px: Nr. · Copil · Părinte · Telefon · Scad. · Taxă · Achitat · Rest · Statut; linie de total.
- **Alb-negru lizibil**: statutul e scris, nu doar colorat; rândurile neachitate au fundal `#f6f4f0`. Capul tabelului se repetă pe fiecare pagină (`thead { display: table-header-group }`); subsol „Pagina N din M · tipărit la”.
- Cod: `features/status/StatusPrint.tsx` + `@media print` în `StatusPage.module.css` (ascunde shell-ul, sidebar-ul și butoanele).

## Formulare și stări

### Panou lateral (15a, 15b) — înlocuiește `dialog` pentru creare/editare
- Poziție fixă dreapta, lățime 620 px (copil) / 560 px (achitare), fundal alb, `box-shadow: -20px 0 60px rgba(58,71,80,.2)`, overlay `rgba(58,71,80,.35)`.
- Header (Baloo 26 + × rotund 36 px `#f4f1ea`), corp derulabil, footer fix cu acțiunile (ca regula actuală „butonul de salvare rămâne vizibil”).
- Esc și click pe overlay închid; dacă sunt modificări, confirmă.
- **15a Copil nou**: secțiuni numerotate (12 px/800/uppercase `#a34f00`): 1 Copil (Nume, Prenume, Data nașterii → sub câmp vârsta calculată și grupele compatibile), 2 Părinți (nume, telefon, relație ▾, „+ Adaugă încă un părinte”), 3 Contract și taxă (nr, început, scadență + 3 carduri program selectabile, selectat `#fcead3` border 2 px `#ef8a1d`), 4 Grupă opțional (chip-uri cu locuri libere). Footer: hint + Anulează + „Salvează copilul”.
- **15b Achitare nouă**: Copil (card selectat cu taxă și luna neachitată, „Schimbă”), Sumă mare Baloo 40 cu scurtături „1 lună / 2 luni / 3 luni” calculate din taxă, Data + Metodă segmented, „Se repartizează automat” (listă luni cu statut), „Repartizează manual”. Footer: checkbox confirmare părinte *(nou)* + „Salvează · suma”.
- **15c Cheltuială nouă**: dialog 520 px: sumă mare, chip-uri categorie (selectat cu border 2 px în culoarea categoriei), descriere, dată, metodă, „+ Atașează bon” *(nou)*; „Salvează și adaugă alta” + „Salvează”.

### Confirmări (15d)
- **Arhivare**: fără dialog; toast jos (`#3a4750`, radius 16, umbră) „N achitări arhivate · **Anulează**” (`#f9d257`), 6 s.
- **Ștergere definitivă**: dialog cu icon „!” `#fce9ef`/`#b0284f`, titlu Baloo 24, explicație (ce se mai șterge), câmp „Scrie ȘTERGE”, buton `#e9527c` activ doar după text corect. Înlocuiește `.action-btn.confirm-pending`.

### Liste goale (15e)
- Fără rezultate (filtre active listate + „Șterge filtrele”) · Coadă rezolvată (mint „Totul e rezolvat”) · Primul pas (dashed + CTA primar).

### Salvare (15f)
- 4 stări în cardul din sidebar: Normal (punct `#3f9a6b`), Se salvează (`#f9d257`), Nesalvat (fundal `#fdf3d2`, border `#f9d257`, CTA „Salvează acum”), Eroare (fundal `#fce9ef`, border `#f3a6be`, text `#b0284f`, CTA „Încearcă din nou”). Mapare pe `data-state` existent.

---

## Interacțiuni
- Hover rând tabel: `#faf7ef` (în `DataTable.module.css`). Rând selectat: `#fffaf0` + checkbox plin `#ef8a1d` cu ✓ alb.
- Rând activ în liste cu panou: `box-shadow: inset 4px 0 0 #ef8a1d`, fundal `#fffaf0`.
- Focus: păstrează `outline: 3px solid #a34f00; outline-offset: 2px`.
- Tranziții: 120–160 ms ease pentru hover/expand; panoul lateral slide-in 200 ms.
- Comutatoarele de vizualizare și filtrele resetează paginarea (regula existentă).
- Meniu ⋯ pe rând: Editează · Arhivează/Reactivează · separator · Șterge definitiv (roșu).

## State
- `viewMode[page]` ∈ {table, grouped} pentru Achitări / Cheltuieli / Situație (persistat cu `usePersistedState` din `@shared/state`).
- `openGroupId` (Grupe, un singur editor deschis).
- `selectedRowIds` (bara de selecție), `activeDetailId` (panoul din 5b, 9b, 9c).
- `drawer` ∈ {null, childNew, paymentNew, expenseNew} + `drawerDirty`.
- `toast` — prin `useToast().show({ message, actionLabel, onAction })` (auto-închidere 6 s deja implementată).
- Rute: fișa copilului `/copii/:childId`, formular achitare `/achitari/nou` și `/achitari/:paymentId` (vezi `App.tsx`, `routes.ts`).

## Design tokens
**Culori (toate există deja ca variabile în `webapp/src/shared/tokens/tokens.css`)**: orange `#ef8a1d`, orange-soft `#fcead3`, slate `#3a4750`, muted `#6b7780`, mint `#a8d8be`, mint-soft `#e7f4ec`, yellow `#f9d257`, yellow-soft `#fdf3d2`, pink `#f3a6be`, pink-soft `#fce9ef`, raspberry `#e9527c`, cream `#fffaf0`, border `#ede7dc`.
**Adăugate (text pe fundaluri soft, contrast ≥ 4.5:1)**: orange-ink `#a34f00`, mint-ink `#2e6b4c`, yellow-ink `#7a5d00`, pink-ink `#b0284f`, subtle `#9aa3a9`, neutral-soft `#f4f1ea`, neutral-softer `#f7f4ee`, success-dot `#3f9a6b`, row-divider `#f3eee5`, input-border `#c9c4ba`.
**Tipografie**: titluri Baloo 2 (700/800) — H1 pagină 30, titlu card 18–20, cifre KPI 26–36; text Nunito — body 14, meta 12–13, eyebrow 11–12 / 800 / uppercase / .08–.1em.
**Raze**: 8–10 (celule, butoane mici), 12 (inputuri), 14–16 (rânduri, casete), 20–24 (carduri), 999 (pill-uri, butoane).
**Umbre**: card `0 8px 24px rgba(58,71,80,.1)` (existent), buton primar `0 8px 18px rgba(239,138,29,.32)`, bară flotantă `0 12px 28px rgba(58,71,80,.25)`, panou `-20px 0 60px rgba(58,71,80,.2)`.
**Spațiere**: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 40.

## Assets
- `webapp/public/assets/startica-logo.svg`, `startica-icon.svg` (servite la `/assets/...`).
- Fonturi: Baloo 2 și Nunito — locale în `webapp/public/assets/fonts/`, declarate în `tokens.css`.
- Iconițe: doar caractere text (‹ › ⋯ × ⌕ ✓ ▾); fără set de iconițe nou.

## Maparea pe fișiere din repo (`master-v2`, rădăcina `webapp/src/`)
**Shell**
- `app/shell/Sidebar.tsx` + `.module.css`, `nav-items.ts` — meniul lateral (gata; ajustare logo/versiune).
- `app/shell/Topbar.tsx` + `.module.css` — antet, căutare globală Ctrl K, selector lună.
- `app/shell/SaveStatusCard.tsx` + `.module.css`, `save-status.ts` — cardul de salvare (15f).
- `app/shell/AppShell.tsx`, `app/App.tsx`, `routes.ts` — layout, rute, contoare sidebar.

**Componente comune (`shared/ui/`)**
- `Card` (KPI, raze 20–24, cerc decorativ), `Badge` (tonuri statut/categorii), `SegmentedControl` (comutatoare Tabel/Pe luni, filtre Activi/Arhivați), `DataTable` (filtre în cap, selecție, paginare), `Drawer` (15a/15b/15c), `Toast` (15d), `MonthPicker`.
- De adăugat: meniu ⋯ pe rând, bară de selecție flotantă, dialog ștergere „Scrie ȘTERGE”, stări goale (15e).

**Ecrane (`features/`)**
| Ecran | Id | Fișiere |
|---|---|---|
| Dashboard | 1a | `dashboard/DashboardPage.tsx`, `useDashboard.ts` |
| Copii + fișa | 2a, 2b | `children/ChildrenPage.tsx`, `useChildren.ts`, `useChildProfile.ts` (scoate butonul Import CSV din antet; `ChildrenCsvDialog.tsx` se deschide doar din Backup și setări) |
| Copil nou | 15a | `children/ChildFormDrawer.tsx`, `child-form.ts` |
| Grupe | 3a | `groups/GroupsPage.tsx`, `useGroups.ts` |
| Vizite | 2a | `visits/VisitsPage.tsx`, `VisitFormDrawer.tsx`, `EnrollDrawer.tsx`, `useVisits.ts` |
| Achitări | 5a, 5b | `payments/PaymentsPage.tsx`, `usePayments.ts` |
| Achitare nouă | 15b | `payments/PaymentFormDrawer.tsx`, `payment-form.ts` |
| Cheltuieli + 15c | 6a, 6b, 15c | `expenses/ExpensesPage.tsx`, `useExpenses.ts` |
| Situația plăților | 7a, 7b | `status/StatusPage.tsx`, `useStatus.ts` |
| De notificat | 2b | `notify/NotifyPage.tsx`, `useNotify.ts` |
| Taxe și grupe | 2c | `fee-setup/FeeSetupPage.tsx`, `useFeeSetup.ts` |
| De verificat | 9b | `review/ReviewPage.tsx`, `useReview.ts` |
| Asociere achitări | 9c | `assign/AssignPage.tsx`, `useAssign.ts` |
| Istoric | 10a | `audit-log/AuditLogPage.tsx`, `useAuditLog.ts` |
| Notificări | 10b | `notifications/NotificationsPage.tsx`, `useNotificationPreferences.ts`, `useTelegramStatus.ts` |
| Backup și setări | 10c | `backup/BackupPage.tsx`, `ExcelImportDialog.tsx`, `useBackup.ts`, `useRestore.ts`, `useExcelTransfer.ts` |

Fiecare ecran are teste (`*.test.tsx` / `*.test.ts`) — actualizează-le odată cu markup-ul și rulează `npm test` + `npm run typecheck` în `webapp/`.

## Fișiere în pachet
`Set final.dc.html` (index) · `Sidebar.dc.html` · `Dashboard.dc.html` · `Copii.dc.html` · `Grupe.dc.html` · `Achitari.dc.html` · `Cheltuieli.dc.html` · `Situatia.dc.html` · `Vizite.dc.html` · `De rezolvat.dc.html` · `Administrare.dc.html` · `Formulare.dc.html` · `Sms.dc.html` · `Responsive.dc.html` · `Tiparire.dc.html` · `CORECTII-master-v2.md` · `CLAUDE-CODE.md` · `project-conventions.md` · `support.js` (runtime pentru a deschide fișierele de design) · `web/assets/*` (copii locale ale logo-ului, identice cu `webapp/public/assets/`).


## Copii — Zile de naștere (pagină, Copii 2a)
Pagină separată în modulul Copii (sidebar activ: Copii). Se deschide din butonul „Zile de naștere” din antetul listei Copii (2a) și din „Vezi calendarul →” de pe Dashboard (1a).
- Header: eticheta „Evidență · Copii”, titlul „Zile de naștere”, butonul „Azi”, navigarea între luni ‹ Luna An › (același stil ca selectorul de lună din Dashboard) fără buton de închidere (e pagină, nu modal).
- Filtre pe grupă (Toate + grupele), în culorile grupelor; filtrul se aplică și grilei, și listei. Contorul din dreapta: „N zile de naștere”.
- Grila: 7 coloane Lu–Du, weekendul pe fundal #f7f4ee. Pe o zi apar maximum 2 copii (Prenume N. + vârsta împlinită), restul ca „+N copii”. Ziua de azi are contur 2px #ef8a1d. Zilele trecute au opacitate .5.
- Lista laterală (300px): toți copiii din luna aleasă, sortați după zi, cu vârsta împlinită și grupa. Starea goală: „Nicio zi de naștere pentru filtrul ales.”
