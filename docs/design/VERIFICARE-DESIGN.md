# Verificare design ↔ cod, pagină cu pagină

`master-v2` @ b84d7df, 29.09.2026. Comparat fiecare `.dc.html` cu componentele din Screen map (TSX + CSS module).
Legendă: ✅ aliniat · ⚠️ diferențe mici · ❌ nealiniat.

## Ordinea de lucru pentru Claude Code
1. `Drawer` comun (antet cu linie, padding 30, subsol cu Anulează) — afectează toate panourile.
2. **15a Copil nou** — `screens/29-copil-nou-diferente.md`.
3. **2b Fișa copilului** — așezare + date personale, relație, persoane autorizate, note cu autor/editare (spec 28). Documentele cer backend.
4. **Bazin 22a / 22b / 22c** — refacere vizuală după `Bazin.dc.html`.
5. **8a De notificat** — listă + previzualizare mesaj (spec 10).
6. **9c Asociere achitări** — listă + sugestii (spec 11 §9c).
7. **10c Backup și setări**, **10b Notificări** — așezarea pe coloane.
8. Restul de ⚠️ — valori mici (fonturi, padding), pot fi făcute într-un singur commit.

## Shell
- ✅ **Sidebar:** 248px, logo 46, selector filială, 4 grupe cu marcaje, versiunea lângă „Backup și setări”, cardul de sync jos. Diferență neglijabilă: gap rând 10 vs 11.
- ✅ **Topbar:** padding `12px 40px`, titlu Baloo 24 + eyebrow 11px pe același rând, pastila cursului.

## Dashboard
- ✅ **1a:** KPI 1.5/1/1/1, benzi metode, grafic 12 luni (190px, bare 34px), „Necesită atenție”, zile de naștere 380px + calendar 4 coloane — la fel. Mic: valorile Cheltuieli/Diferență/Avansuri sunt 36px (design 30px, doar Încasări e 36); textul CTA din Atenție 12px (design 13px).

## Achitări
- ✅ **5a Tabel:** carduri 1.4/1/1/1, card tabel 22, toolbar, filtre active, badge „Neasociată →”. Abateri deja notate de Claude Code: Perioadă = 2 câmpuri lună (design: dropdown), „Bon zi” în plus lângă Exportă.
- ✅ **5b Pe luni + panou:** listă pe zile (zi Baloo 20), rând activ cu bară portocalie, panou 400px cu antet colorat, sumă 38, subsol Arhivează/Tipărește.

## Cheltuieli
- ⚠️ **6a Tabel:** bară categorii + legendă 5 coloane, toolbar, descriere pe 2 rânduri, subsol. Mic: KPI `1fr 2fr` (design `1fr 2.2fr`), valoare total 32px.
- ✅ **6b Pe zile:** „Adaugă rapid” `160 / 1fr / 140 / 150 / auto`, chip-uri, zile grupate.

## Situația plăților
- ✅ **7a Lună:** 4 carduri, toolbar, FilterPills, CTA Notifică, banner.
- ⚠️ **7b An școlar:** harta `230px + 12 + 130px` la fel. Diferențe: în coloana Copil lipsește avatarul 30px (design: avatar + nume); cifrele din cele 3 carduri 36px (design 44px); antetul hărții 12px (design 11px).
- ✅ **7c/7d/7e dialoguri SMS:** verificate la 27.09, nemodificate de atunci.

## Prezența
- ✅ **18a Ziua:** 4 carduri, grupe cu pastilă, grilă 5 coloane, marcaj rotund, „Nemarcații (N) → prezenți”. Mic: tile padding `8px 10px` / radius 14 / border 1px (design `10px 12px` / 16 / 1.5px), avatar 32.
- ✅ **18b Luna:** `200px + zile + 70px`, azi portocaliu, weekend stins, rând „Prezenți pe zi”.
- ✅ **18c/18d Foi pe săptămână:** implementate după spec 26 (Claude Code a notat că nu le-a comparat vizual).

## Bazin
- ❌ **22a Săptămâna** (`WeekView`): construită generic, nu după design.
  - Carduri: design stânga, etichetă uppercase coloră + valoare 26, padding `14px 18px`, radius 18, fundal/border pe ton. Cod: centrate, valoare 28 + etichetă gri sub.
  - Lipsește rândul „Antrenor: Rusu Vlad” + legenda Venit / Lipsă / Motivat / De marcat.
  - Grila: design = card alb radius 22, `72px + 5 zile`, antet zi cu număr Baloo 20 + nume (azi evidențiat), celule min 92px. Cod: grid cu gap 1px pe fundal gri, antete gri, celule 48px.
  - Copil în celulă: design = pastilă cu avatar 22 în tonul grupei + nume + punct de stare 10px, click ciclic. Cod: dreptunghi colorat cu nume + text stare.
  - Lipsește nota de sub grilă (zile trecute / viitoare / anulată tăiată).
  - Antet: segmented Săptămâna/Luna + stepper „21–25 septembrie” + „+ Programare” — de verificat în `PoolPage`.
- ❌ **22b Programare nouă** (`BookingDrawer`): design 480px cu Ziua (pastile), **Ora ca 5 carduri** cu locuri libere (`8px 4px`, radius 12, border 1.5px), Începând cu / Se repetă pe 2 coloane. Cod: select-uri + zile ca pastile mint, fără carduri de oră.
- ❌ **22c Luna** (`MonthView`): design = 4 carduri stânga-aliniate + grilă `1.7fr / 1fr`: stânga tabel „Pe copii” (`1.6fr 60 60 60 60 100 110`, avatar 26 în ton, Venit verde / Lipsă roz), dreapta cardul antrenorului (avatar 44, ședințe ținute, copii veniți, total, „Închide luna”). Cod: carduri centrate, `<table>` simplu 13px, carduri antrenori pe rând sub tabel.
- ⚠️ **22d Setări:** de verificat în `BackupPage` (fila Bazin); nu am găsit CSS dedicat.
- ✅ **Bon 58 mm** (`PoolReceiptLabel`): logo, titlu, „ÎN FIECARE” 34px, grila 4 × ședințe, punctat = zi liberă — la fel ca în `Bon 58mm.dc.html`.

## Personal
- ✅ **23a Echipa, 23j fișa angajatului, 23l Candidați:** pe `PersonCell` / `DataTable.groupBy` / `ProfileLayout` (0.5), verificate de Claude Code ecran cu ecran la 28.09.
- ⚠️ **23b Pontaj** (`TimesheetView`):
  - Celule: design = pastilă 22px înălțime, radius 5, `margin 0 1px`, text alb 10px; cod = fundal pe toată celula, fără radius, 11px.
  - CO: design `#e0b400` cu text alb; cod `--yellow` (#f9d257). CM `#e9527c`, A `#6b7780` — la fel.
  - Coloana Angajat: lipsește rolul sub nume (11px `#9aa3a9`); coloanele finale Zile / CO / CM colorate (verde / galben / roz) — de verificat.
  - Antet departament: design uppercase 12px/800 `#5b666e`, pătrat 8px, fundal `#fffaf0`; cod 13px, pătrat 12px.
  - Legenda: design pătrate 18px cu litera înăuntru; cod 10px fără literă.
  - Lipsește textul de sub tabel.
- ✅ **23c–23k (Concedii, Salarii, PIN, tipărire):** verificate de Claude Code la 28.09; 23k a primit comutatorul Ore / Prezență.

## Vizite
- ✅ **Vizite:** pâlnie, grilă `1.6fr / 1fr`, calendar 7 coloane cu celule 72px, detaliu cu oră 52px + 4 stări, tabel. Mic: celule calendar gap 8 (design 6), padding 6 (design `6px 8px`).

## De notificat
- ❌ **8a** (`NotifyPage`): codul e tabelul vechi cu 11 coloane (`<table>` 13px) + 4 carduri de statistici. Design = 2 coloane egale:
  - stânga: card cu segmented „De trimis · 4 / Trimise · 38 / Eșuate · 0”, apoi lista părinților (avatar 40, nume părinte, „pentru copil · motiv”, sumă colorată), rândul selectat evidențiat;
  - dreapta: „Mesaj către X” + badge motiv, chip-uri șablon, bula mesajului (verde, `18px 18px 18px 6px`), nota „Textul se poate edita…”, subsol Nu trimite / Editează textul / Trimite.
  - Antet: pastila „Telegram conectat” + „Trimite toate · 4”.
  - Spec: `screens/10-de-notificat.md` (punctul 4 din coadă — neimplementat).

## De rezolvat
- ✅ **9a Taxe și grupe:** progres în antet 260px, bară de selecție cu „Aplică la N”, avatar 34, câmpuri lipsă cu border roz.
- ✅ **9b De verificat:** `360px / 1fr`, coadă cu punct + bară activă, progres + tasta S, avatar 60, casetă roz. De verificat vizual tabelul de comparație Câmp / Fișă / Achitare (`140px 1fr 1fr`, radius 16) — nu are CSS dedicat în `ReviewPage.module.css`.
- ❌ **9c Asociere achitări** (`AssignPage`): codul e tabel (`<table>` 13px) cu un `<select>` pe rând + 3 carduri de risc. Design = 2 coloane `1fr / 1.1fr`:
  - stânga: căutare „Caută plătitor sau sumă” + listă (zi Baloo 19 + lună, nume plătitor, „Transfer · detalii”, sumă), rândul selectat evidențiat;
  - dreapta: „Achitare selectată · data”, „Sofia · 12.981,00 lei” Baloo 30, detalii bancă; „Sugestii” = carduri radius 18 cu avatar 42, motiv, scor, buton „Asociază”; „Alt copil…”; bifa „Ține minte plătitorul”.
  - Antet: „64 achitări fără copil · 612.480 lei”.
  - Spec: `screens/11-de-rezolvat.md` §9c. Logica (scor, plătitori reținuți) există deja în `useAssign`; lipsește doar UI-ul.

## Administrare
- ✅ **10a Istoric:** grupat pe zile, card radius 20, rând oră 46px + badge 88px + diferențe tăiate.
- ⚠️ **10b Notificări:** conținutul e la fel (card Telegram mint cu cerc, comutatoare 46×26), dar așezarea nu: design = 2 coloane `1fr / 1.3fr` (Telegram stânga, lista dreapta); cod = carduri unul sub altul.
- ❌ **10c Backup și setări:** cod = panouri generice unul sub altul. Design:
  - sus 3 carduri de stare (padding `20px 22px`, radius 22): două verzi + unul galben cu border 2px `#f9d257` pentru problema activă (ex. backup extern lipsă);
  - apoi `1.3fr / 1fr`: stânga „Copii de siguranță” ca listă în card; dreapta cardul „Grădinița” (Nume, adresă… pe `auto 1fr`) + cardul cu border roz `#f3a6be` pentru acțiunea periculoasă.
  - Filele (Import și export, Grădinița, Filiale, Curs, Bazin, Sincronizare) rămân.

## Sincronizare
- ✅ **14a card sidebar:** 4 stări + click deschide 14b.
- ⚠️ **14b fila Sincronizare:** coloana dreaptă 280px (design 380px). Restul (card server mint cu cerc, lista calculatoarelor pe `44px 1fr 170px 120px`) de verificat în `DevicesList`.
- ✅ **14c Conflicte:** `320px / 1fr`, tabel `140px 1fr 1fr`, rândurile diferite pe galben. Mic: titlul folosește `font-family: Baloo2` (nume greșit, cade pe fontul implicit) — trebuie `var(--font-heading)`; radius tabel 12 (design 14).

## Filiale, Încărcare, Planuri, Raport, Tipărire
- ✅ **13a–13d Filiale:** selector (pătrat 30 / radius 9, dropdown 300px radius 18), dialogul de formular nesalvat 480px cu icon 48, carduri filială `44px 1fr auto`.
- ⚠️ **21a/21c Încărcare:** lipsesc cercurile decorative de pe fundal (galben stânga-sus 300px `#f9d257`, al doilea dreapta-jos 320px; la 21c un cerc 220px); lipsește rândul de sub bară (pasul curent 800 stânga + procent dreapta); gap 24 (design 26); titlul 21c 26px (design 30px).
- ✅ **12a–12g Planuri și curs:** `1fr / 380px`, carduri plan `8px 1fr 170px 150px`, corecție curs cu border portocaliu, tabelele 12c/12d/12g.
- ✅ **19a/19b Raport contabil:** 3 carduri (sold cu border 2px slate), 2 panouri, tabel EUR `64 1fr 96 64 76`, Pe zile `120px + 4`, export 520px.
- ✅ **16a–16g Tipărire:** confirmate de tine pe 26.09 (RASPUNSURI.md), nemodificate de atunci.
- ✅ **SMS** (dialoguri 7c–7e, Notificări): confirmate pe 27.09, nemodificate.
- — **22 Prima pornire:** neconstruită intenționat (opțională), doar partea de conectare cu cod există în 14b.

## Grupe
- ✅ **4b Tablă:** grilă `300px / 1fr`, panou Fără grupă cu căutare, tile-uri 2 coloane gap 14, bară 5px, pastile copii — la fel. Mic: titlul panoului 16px (design 20px).
- ✅ **4a Carduri + editor:** 4 coloane, carduri 20/22, editor cu echipă și „Copii în grupă” pe 4 coloane. Mic: rândurile copiilor fără border `#f1e8d6`, gap 8 (design 6), radius 12.
- ⚠️ **4c Grupă nouă:** conținutul e ca în design; padding-ul panoului vine din `Drawer` comun (24 în loc de 30, fără linie sub antet) — se rezolvă odată cu 15a.

## Copii
- ⚠️ **2a Listă:** statistici, card tabel radius 22, toolbar 14/16, segmented, FilterPills, badge-uri, ⋯ — la fel. Diferențe:
  - pastilă în plus „Scadent” la Plată (nu e în 2a);
  - antet coloană „Părinte” → în design „Părinte · telefon”;
  - rândul 2 sub nume: design „Contract #112 · 4 ani”; de verificat că `contractLabel` include vârsta.
- ❌ **2b Fișa copilului** (`ChildProfileView.tsx`, `ProfileLayout`):
  - Grilă: design `1fr / 1.35fr`, cod `360px / 1fr`.
  - Antet: butoanele „Editează fișa” + „+ Plată” pe un rând în design; în cod `.actions` e `flex-direction: column` (unul sub altul).
  - **Date personale:** design = un singur card cu Data nașterii + „Alergii, sănătate” (roșu `#a3361f`), apoi Părinți (nume + relație „Tată/Mamă” sub nume, telefon dreapta), apoi „Pot ridica copilul” + „+ Adaugă”. Cod: card IDNP + Adresă, card Părinți separat fără relație, fără alergii, fără persoane autorizate.
  - **Grupă:** lipsește „vârste 2c 5l – 6a 9l” din rândul 2; pătrat font 16 vs 20.
  - **Prezența** e în coloana stângă în design (după Grupă), în cod în dreapta.
  - **Note:** lipsesc ora, autorul (calculatorul), „editată”, meniul ⋯ (editează / șterge cu anulare); formularul nu are chenarul portocaliu + „Renunță”. Nota recentă `#fdf3d2`, restul `#f7f4ee`, padding `12px 14px`, radius 14, 14px (cod: 8/10, 13px).
  - **Documente:** cod = 3 sloturi goale + buton dezactivat. Design = listă de fișiere (icon tip, nume, dată/stare descărcare), „PDF, JPG, PNG · max. 10 MB”, „+ Încarcă” activ. Necesită backend (spec 28).
  - **Plătitori reținuți:** lipsesc textul explicativ cu link spre Asociere, IBAN sub nume, „din 14.09.2026 · 3 achitări”; numele în uppercase 800.
  - Cardul Contract: sub-rândul design „din 01.09.2025 · program mediu”, cod doar data.
  - Toate diferențele de conținut sunt descrise în `screens/28-fisa-copilului-date.md`.
- ❌ **15a Copil nou:** vezi `screens/29-copil-nou-diferente.md`.
