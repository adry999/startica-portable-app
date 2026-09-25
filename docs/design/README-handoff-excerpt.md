# Handoff: Startica — redesign UI/UX (v1.7)

Copiat integral din `design_handoff_startica_redesign/README.md` (proiect claude.ai/design "Startica V2"), citit direct din browser 2026-09-25. Înlocuiește extrasul parțial anterior — acum e tot fișierul (238 linii).

Link proiect: https://claude.ai/design/p/48bf3ace-a7af-4f08-acd9-58b3091919a2?file=Set+final.dc.html

## Overview
Redesign al aplicației locale Startica (administrare grădiniță: copii, grupe, vizite, achitări, cheltuieli, situația plăților, cozi „De rezolvat", administrare). Scopul: ierarhie vizuală mai clară, mai puține butoane pe rând, filtre compacte, formulare în panou lateral, stări explicite (gol / eroare / confirmare). Identitatea Startica (culori, fonturi, logo) rămâne neschimbată.

Repo țintă: `adry999/startica-portable-app` (branch `master-v2`), React 19 + Vite + TypeScript + react-router 7 în `webapp/`. CSS Modules per componentă (`*.module.css`), tokeni globali în `webapp/src/shared/tokens/tokens.css`.

## About the Design Files
Fișierele din acest pachet sunt **referințe de design create în HTML** (Design Components cu stiluri inline) — arată aspectul și comportamentul dorit, **nu sunt cod de producție de copiat**. Sarcina este să **recreezi aceste ecrane în codul existent** din `webapp/`, folosind componentele din `@shared/ui` (`Badge`, `Card`, `SegmentedControl`, `Drawer`, `ToastProvider`/`useToast`, `DataTable`, `MonthPicker`) și variabilele CSS din `tokens.css` (`var(--orange-ink)`, `var(--radius-xl)`, `var(--shadow-panel)` etc.), extinzându-le unde e nevoie. Logica rămâne în hook-urile existente (`useChildren`, `usePayments`, `useDashboard`…). Nu se schimbă backendul, baza de date sau calculele.

Pentru a deschide referințele de design: servește folderul acestui pachet (ex. `npx serve .`) și deschide `Set final.dc.html`. Fiecare fișier e un canvas cu artboard-uri de 1440 px; id-urile (1a, 1c, 2a…) sunt afișate ca etichete.

> **Implementare existentă pe `master-v2`:** vezi `CORECTII-master-v2.md` — lista exactă de diferențe CSS de corectat (carduri KPI, label-uri, antet, sidebar). Se aplică înainte de orice ecran nou.
>
> **Regulă generală:** valorile de culoare dintr-o secțiune se referă **doar** la elementul numit (label, link), nu la tot cardul. Cifrele mari sunt mereu `#3a4750`. Cardurile colorate sunt plate (fără umbră); cardurile albe au border `#ede7dc`, fără umbră.

## Fidelity
**High-fidelity.** Culori, tipografie, raze, spațiere și copy sunt finale. Datele din mock (nume, sume, note, documente) sunt exemple — folosește datele reale.

## Variante alese (sursa de adevăr)
| Ecran | Id | Fișier |
|---|---|---|
| Dashboard | 1a | Dashboard.dc.html#1a |
| Copii (listă) | 1c | Copii.dc.html#1c |
| Fișa copilului | 1e | Copii.dc.html#1e |
| Grupe | 1g | Grupe.dc.html#1g |
| Vizite | 2a | Operatiuni.dc.html#2a |
| De notificat | 2b | Operatiuni.dc.html#2b |
| Achitări | 1i (Tabel) + 1j (Pe luni) | Achitari.dc.html |
| Cheltuieli | 1k (Tabel) + 1l (Pe zile) | Cheltuieli.dc.html |
| Situația plăților | 1m (Lună) + 1n (An școlar) | Situatia.dc.html |
| Taxe și grupe | 2c | De rezolvat.dc.html#2c |
| De verificat | 2d | De rezolvat.dc.html#2d |
| Asociere achitări | 2e | De rezolvat.dc.html#2e |
| Istoric / Notificări / Backup și setări | 2f / 2g / 2h | Administrare.dc.html |
| Formulare (copil, achitare, cheltuială) | 3a / 3b / 3c | Formulare.dc.html |
| Confirmări / liste goale / salvare | 3d / 3e / 3f | Formulare.dc.html |

Ignoră variantele neselectate (1b, 1d, 1f, 1h) — rămân doar ca explorare. Meniul lateral: **varianta „a" (alb)** peste tot.

---

## Shell global

### Sidebar (`Sidebar.dc.html`, variant `a`) — înlocuiește stilurile `.sidebar` / `.nav`
- Lățime 248 px, fundal `#fff`, `border-right: 1px solid #ede7dc`, padding `26px 16px 18px`, gap 22 px între blocuri.
- Sus: logo `startica-logo.svg` înălțime 38 px, versiunea (`v1.6.3`, 11 px, 700, `#9aa3a9`) aliniată dreapta pe aceeași linie.
- Grupuri: (fără titlu) Dashboard, Copii, Grupe, Vizite · **Contabilitate**: Achitări, Cheltuieli, Situația plăților, De notificat · **De rezolvat**: Taxe și grupe, De verificat, Asociere achitări · **Administrare**: Istoric, Notificări, Backup și setări.
- Titlu grup: 11 px, 800, uppercase, letter-spacing .09em, `#9aa3a9`, padding `0 12px 6px`.
- Item `.nav`: padding `8px 12px`, radius 12, 14 px, 600, `#3a4750`; marker pătrat 8×8 radius 3 cu culoarea grupului (galben `#f9d257` / mint `#a8d8be` / roz `#f3a6be` / gri `#c9c4ba`).
- **Activ (schimbare față de acum):** nu mai e plin portocaliu; fundal `#fcead3`, text `#a34f00`, 800, marker `#ef8a1d`. Hover: `#fdf3d2`.
- Contoare: pastilă 11 px/800, `#fce9ef` / `#b0284f`, padding `2px 8px`. **Contorul 0 nu se afișează.**
- Jos (`margin-top:auto`): card stare salvare — fundal `#fffaf0`, border `#ede7dc`, radius 14, padding 12. Linia 1: punct 8 px `#3f9a6b` + „Salvat · 12:06" (13/700). Linia 2 (doar dacă există avertizare): 12 px `#7a5d00` „Copie externă neconfigurată · **Configurează**" (link către Backup).
- Stările cardului: vezi 3f (Normal / Se salvează / Nesalvat / Eroare) — deja în `SaveStatusCard.tsx` + `save-status.ts`; rămâne de cablat `warning` (copie externă) din `useBackup`.

### Antet pagină (topbar) — înlocuiește `.topbar`
- Padding `22px 40px`, `border-bottom: 1px solid #ede7dc`, fundal transparent pe `#fffaf0`.
- Stânga: eyebrow (12 px, 800, uppercase, .1em, `#ef8a1d`) + H2 Baloo 2 800 30 px.
- Dreapta: acțiunile paginii. Pe Dashboard: căutare globală (pill 300 px, `#fff`, border `#ede7dc`, placeholder „Caută copil, părinte, achitare…", badge „Ctrl K") + selector lună.
- **Selector lună:** pill `#fdf3d2`, border `#f6e3a6`, padding 4; butoane rotunde 32 px albe „‹" „›" de o parte și de alta a textului Baloo 700 16 px („Septembrie 2026"). Click pe text deschide meniul din `MonthPicker`.
- Butonul „Reîncarcă" dispare din antet (mută-l în Backup și setări sau în meniul ⋯).
- Banner-ul „Date salvate." de deasupra conținutului dispare — starea e în sidebar; confirmările folosesc toast (3d).

### Conținut
- Padding `28px 40px 40px`, gap vertical 18–24 px. Fundal pagină `#fffaf0`.

---

## Ecrane

### Dashboard (1a)
- **Rând KPI**: grid `1.5fr 1fr 1fr 1fr`, gap 16. Carduri radius 22, padding `22px 24px`, flex column gap 10, **fără umbră**; cerc decorativ alb 45–50% **jos-dreapta** (`right:-30px; bottom:-40px`, 130/110 px).
- Label: 12 px / 800 / uppercase / .08em, culoarea ink a cardului. Valoare: Baloo 800 36 px, line-height 1, **`#3a4750`** pe toate cardurile.
- Încasări (`#fcead3`): label `#a34f00`; bară stivuită 8 px pe fond alb (cash `#ef8a1d` / card `#f9d257` / transfer `#a8d8be`) + legendă 12 px `#5b666e` cu pătrățele 8×8 și sume compacte („Cash 129.036").
- Cheltuieli (`#e7f4ec`): link „+ Adaugă cheltuială" `#2e6b4c`.
- Diferență (`#fdf3d2`): subtext „încasări − cheltuieli".
- Avansuri nerepartizate: fundal alb, **border 1.5px dashed `#e6d9c4`**, label `#6b7780`, pastila „Toate lunile, până azi" (`#f4f1ea`/`#6b7780`) **jos**, sub valoare — separă vizual indicatorul cumulat de cei lunari.
- **Rând 2**: grid `1.45fr 1fr`.
- Evoluția încasărilor: 12 bare (max 34 px lățime, radius `10 10 4 4`), luna curentă `#ef8a1d`, restul `#f6c98f`, lunile fără date `#f1ece2` înălțime 6 px. Etichetă luna curentă `#a34f00` 800. **Comutator „Încasări / Cheltuieli" (segmented)** — încă nu e construit în cod.
- Necesită atenție: 4 rânduri radius 16, padding `10px 12px`, fundal pe categorie (pink/yellow/mint); contor în pătrat alb 52×44 Baloo 20; CTA text „Vezi lista →". **Rândul cu 0 e neutru** (`#f7f4ee`, text `#9aa3a9`, fără CTA).
- **Zile de naștere**: card cu grid `380px 1fr`. Stânga: următoarele 5 zile (rânduri `#fdf3d2` cu avatar inițiale, „împlinește X ani", pastilă „în 2 zile"). Dreapta: toată luna, grid 4 coloane de chip-uri (zi Baloo 18 + nume); zilele trecute opacitate .7. Înlocuiește calendarul lunar mare.

### Copii — listă (1c)
- Antet: „Import CSV" (`.btn-ghost`) + „+ Adaugă copil" (`.btn-primary`, deschide 3a).
- 3 statistici compacte (rânduri orizontale, radius 20, padding `16px 20px`): 99 Copii activi · 1 Grupe ocupate · 99 Fișe de verificat (+ „Verifică →"). Aceeași logică ca acum (PLAN_UI_ASTRA §6).
- Card tabel (radius 22): **bara de filtre e în capul tabelului**: căutare (flex 1, `#fffaf0`), segmented „Activi · 99 / Arhivați · 6 / Toți" (înlocuiește select-ul Arhivare), „Grupă ▾", „Plată ▾".
- Bară de selecție (apare doar cu rânduri bifate): fundal `#3a4750`, text alb 13 px: „2 selectați | Mută în grupă · Exportă · Arhivează (`#f3a6be`) … Anulează ×".
- Coloane: ☐ · Copil (avatar 38 px inițiale pastel + nume 800 + „Contract #3 · 4 ani" 12 px `#9aa3a9`) · Părinte · telefon · Grupă (badge colorat) · Scadență · Plată luna curentă (badge cu punct: Achitat mint / Parțial yellow / Neachitat pink / Scadent gri) · ⋯.
- **Acțiunile Editează / Reactivează / Șterge definitiv trec în meniul ⋯.** Click pe rând → fișa copilului (1e).
- Paginare: „Afișez 1–8 din 99" + numere de pagină (pagina activă `#fcead3`/`#a34f00`).

### Fișa copilului (1e) — înlocuiește dialogul `#profileBody`
Pagină proprie (nu dialog). Breadcrumb „Copii / Nume".
- Header card `#fcead3` radius 24: avatar 84 px, nume Baloo 36, meta (dată naștere · vârstă · contract), badge statut + grupă, butoane „Editează fișa" (alb) + „+ Plată" (primar, deschide 3b pre-completat).
- Grid `1fr 1.35fr`:
- Stânga: Date personale + Părinți (listă cu telefon; „+ adaugă telefon" dacă lipsește) · Grupă și educator (pătrat inițială grupă + „Schimbă") · Note (carduri `#fdf3d2` cea mai recentă, `#f7f4ee` restul, „+ Notă").
- Dreapta: 3 mini-carduri Sold (mint) / Taxă lunară (yellow) / Contract (alb) · Istoric plăți (tabel lună · dată · metodă · sumă · badge) · Documente (grid 3, icon PDF colorat, „+ Încarcă").

### Grupe (1g)
- Grid 3 coloane de carduri radius 24: nume Baloo 24, ocupare „7/10" Baloo 28, bară capacitate 8 px, educator + interval vârstă, stivă avatare (5 + „+2"), pastilă „▾ Deschide / ▴ Restrânge".
- Al treilea card: „+ Grupă nouă" dashed `#e0d5c2` cu formular inline (nume + locuri + „Creează") — înlocuiește formularul din capul paginii.
- **Click pe card = expand/collapse** editorul grupei sub grid (un singur editor deschis; cardul deschis are border 2 px în culoarea grupei). Editor: rând Nume / Educator / Capacitate / Salvează; „Copii în grupă · 7" + vârste; grid 2 coloane de rânduri copil (avatar, nume, vârstă, ×); combobox „Caută copil" cu sugestii din copiii fără grupă (+ Adaugă); „Șterge grupa X" text roșu `#b0284f` aliniat dreapta.
- Grupă goală: stare „Niciun copil în grupă" dashed mint.

### Vizite (2a)
- Statistici ca pastile inline (număr Baloo 22 + etichetă) în loc de 4 carduri mari.
- Grid `1.6fr 1fr`: calendar lunar (reutilizează `.month-calendar`, celule 72 px) | panoul zilei selectate: oră, copil + vârstă, părinte, grupă dorită, notă; **„Cum a decurs vizita?" — 4 butoane**: Efectuată (mint) · S-a înscris (orange) · Neprezentată (gri) · A renunțat (pink). Sub: Editează · Reprogramează · Arhivează. Înlocuiește cele 5 butoane de pe rând din tabel.

### De notificat (2b)
- Antet: pastilă „Telegram conectat" + „Trimite toate · N".
- Grid 2 coloane: coada (tab-uri De trimis / Trimise / Eșuate; rând selectat cu bară stânga 4 px `#ef8a1d`) | previzualizare mesaj (șabloane ca chip-uri, bulă `#e7f4ec`, câmpuri auto îngroșate, Nu trimite / Editează textul / Trimite).

### Achitări (1i / 1j) — comutator „Tabel | Pe luni" în antet
- Comutator: segmented pill `#f1ece2`, opțiune activă albă cu umbră. Persistă alegerea (localStorage).
- **Tabel (1i)**: 4 carduri sumar (Total filtrat orange / Cash / Card / Transfer — cele cu 0 au valoarea gri). Filtre într-un rând: căutare, Copil ▾, segmented metodă, Perioadă ▾, Nearhivate ▾. Rând „Filtre active" cu chip-uri ștergibile + „Resetează". Coloane: ☐ · Data · Copil/sursă (+ badge „Neasociată" + link „Asociază →") · Metodă (badge) · Luni acoperite (badge yellow) · Total (dreapta, 800) · ⋯. Bara de selecție flotantă jos (`#3a4750`, radius 16): „2 selectate · suma | Asociază cu un copil · Exportă · Arhivează".
- **Pe luni (1j)**: tab-uri Toate / Neasociate (pink) / Arhivate; grupuri pe lună cu subtotal; rânduri cu zi mare Baloo 20 + lună; click → **panou detaliu dreapta 400 px** (header pink dacă neasociată, sumă Baloo 38, asociere cu sugestii, luni acoperite, data/metodă, Arhivează · Anulează · Salvează).

### Cheltuieli (1k / 1l) — comutator „Tabel | Pe zile"
- **Tabel (1k)**: card total lună (mint) + card categorii (bară stivuită 12 px + 5 legende cu sume). Tabel: Data · Descriere/furnizor · Categorie (badge colorat) · Metodă · Sumă · ⋯.
- **Pe zile (1l)**: bloc „Adaugă rapid" mint (sumă, descriere, dată, metodă, Adaugă + chip-uri categorie); listă pe zile; coloană buget pe categorii cu bare de progres + avertizare depășire. *Bugetul e funcție nouă — de confirmat cu proprietarul înainte de implementare.*
- Culori categorii: Salarii `#ef8a1d`, Alimentație `#f9d257`, Utilități `#a8d8be`, Materiale `#f3a6be`, Întreținere `#9aa3a9`.

### Situația plăților (1m / 1n) — comutator „Lună | An școlar"
- **Lună (1m)**: 4 carduri (De încasat · Încasat cu bară · Restanțe pink · Fără taxă setată yellow + „Completează →"). Tab-uri Toți / Restanțieri / Parțial / Achitat / Urmează. Coloane: Copil · Scadență · Taxă · Achitat · Rest (roșu dacă >0) · Statut · CTA (Notifică / Vezi fișa). Banner jos `#fdf3d2` „N restanțieri — Notifică toți".
- **An școlar (1n)**: 3 carduri (restanțe / rată încasare / parțiale). Hartă: coloana copil 230 px + 12 coloane lună + Sold 130 px; celule 30 px radius 8: achitat `#a8d8be`, parțial `#f9d257`, neachitat `#e9527c`, urmează `#f1ece2`, înainte de contract `#faf7f1`; luna curentă cu outline 2 px `#fcead3`. Legendă sus.

### Taxe și grupe (2c)
- Progres în antet („6 din 109 completate" + bară 8 px).
- Notă explicativă `#fdf3d2`.
- Bara de selecție `#3a4750` cu „Aplică: Grupă ▾ · Taxă · Scadență · Aplică la N".
- Tabel editabil inline: câmpurile lipsă au border `#f3a6be` și text placeholder gri; buton „Salvează" per rând devine primar când rândul e modificat.

### De verificat (2d)
- Tab-uri Toate / Fișe / Achitări. Grid `360px 1fr`: coada (punct severitate roșu/galben/mint, problemă sub nume) | cardul cazului curent: identitate + „Deschide fișa →", casetă problemă `#fce9ef`, tabel comparativ (diferențele pe `#fdf3d2`), acțiuni: acțiune principală (ex. „Unește fișele") · „Nu e … · marchează verificat" · „Sari peste" (tasta S). Progres „1 din 284".

### Asociere achitări (2e)
- Grid 2 coloane: lista neasociatelor | detaliu: sumă, text bancă, **sugestii ordonate** (Potrivire mare mint + buton primar / Posibil / Slab), motivul potrivirii sub nume, căutare „Alt copil…", checkbox „Ține minte plătitorul" *(funcție nouă — de confirmat)*.

### Istoric (2f)
- Grupat pe zile; rând: oră · badge acțiune (Creat mint / Modificat yellow / Arhivat gri / Asociat orange / Șters pink) · descriere + diff „vechi (tăiat) → **nou** · câmp" · „Anulează" *(funcție nouă — de confirmat)*. Filtre segmented Tot / Copii / Achitări / Grupe.

### Notificări (2g)
- Card Telegram mint (cont, ultimul mesaj, Schimbă contul / Deconectează). Listă comutatoare (reutilizează `.toggle-field`, activ `#ef8a1d`): Restanțe, Zile de naștere, Vizite, Rezumat săptămânal *(nou)*, Probleme la backup — fiecare cu descriere și programare.

### Backup și setări (2h)
- 3 carduri pas ①②③: Date salvate (mint) · Backup local (mint) · Copie externă — **stare de avertizare** yellow cu border 2 px `#f9d257` și CTA primar „Alege un stick sau un folder".
- Listă copii de siguranță (dată, mărime, automat/manual, Restaurează) + „Fă un backup acum". Carduri Import și export, Grădinița. „Zonă periculoasă" cu border `#f3a6be`.

---

## Formulare și stări

### Panou lateral (3a, 3b) — înlocuiește `dialog` pentru creare/editare
- Poziție fixă dreapta, lățime 620 px (copil) / 560 px (achitare), fundal alb, `box-shadow: -20px 0 60px rgba(58,71,80,.2)`, overlay `rgba(58,71,80,.35)`.
- Header (Baloo 26 + × rotund 36 px `#f4f1ea`), corp derulabil, footer fix cu acțiunile (ca regula actuală „butonul de salvare rămâne vizibil").
- Esc și click pe overlay închid; dacă sunt modificări, confirmă.
- **3a Copil nou**: secțiuni numerotate (12 px/800/uppercase `#a34f00`): 1 Copil (Nume, Prenume, Data nașterii → sub câmp vârsta calculată și grupele compatibile), 2 Părinți (nume, telefon, relație ▾, „+ Adaugă încă un părinte"), 3 Contract și taxă (nr, început, scadență + 3 carduri program selectabile, selectat `#fcead3` border 2 px `#ef8a1d`), 4 Grupă opțional (chip-uri cu locuri libere). Footer: hint + Anulează + „Salvează copilul".
- **3b Achitare nouă**: Copil (card selectat cu taxă și luna neachitată, „Schimbă"), Sumă mare Baloo 40 cu scurtături „1 lună / 2 luni / 3 luni" calculate din taxă, Data + Metodă segmented, „Se repartizează automat" (listă luni cu statut), „Repartizează manual". Footer: checkbox confirmare părinte *(nou)* + „Salvează · suma".
- **3c Cheltuială nouă**: dialog 520 px: sumă mare, chip-uri categorie (selectat cu border 2 px în culoarea categoriei), descriere, dată, metodă, „+ Atașează bon" *(nou)*; „Salvează și adaugă alta" + „Salvează".

### Confirmări (3d)
- **Arhivare**: fără dialog; toast jos (`#3a4750`, radius 16, umbră) „N achitări arhivate · **Anulează**" (`#f9d257`), 6 s.
- **Ștergere definitivă**: dialog cu icon „!" `#fce9ef`/`#b0284f`, titlu Baloo 24, explicație (ce se mai șterge), câmp „Scrie ȘTERGE", buton `#e9527c` activ doar după text corect. Înlocuiește `.action-btn.confirm-pending`.

### Liste goale (3e)
- Fără rezultate (filtre active listate + „Șterge filtrele") · Coadă rezolvată (mint „Totul e rezolvat") · Primul pas (dashed + CTA primar).

### Salvare (3f)
- 4 stări în cardul din sidebar: Normal (punct `#3f9a6b`), Se salvează (`#f9d257`), Nesalvat (fundal `#fdf3d2`, border `#f9d257`, CTA „Salvează acum"), Eroare (fundal `#fce9ef`, border `#f3a6be`, text `#b0284f`, CTA „Încearcă din nou"). Mapare pe `data-state` existent.

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
- `selectedRowIds` (bara de selecție), `activeDetailId` (panoul din 1j, 2d, 2e).
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
- `app/shell/SaveStatusCard.tsx` + `.module.css`, `save-status.ts` — cardul de salvare (3f).
- `app/shell/AppShell.tsx`, `app/App.tsx`, `routes.ts` — layout, rute, contoare sidebar.

**Componente comune (`shared/ui/`)**
- `Card` (KPI, raze 20–24, cerc decorativ), `Badge` (tonuri statut/categorii), `SegmentedControl` (comutatoare Tabel/Pe luni, filtre Activi/Arhivați), `DataTable` (filtre în cap, selecție, paginare), `Drawer` (3a/3b/3c), `Toast` (3d), `MonthPicker`.
- De adăugat: meniu ⋯ pe rând, bară de selecție flotantă, dialog ștergere „Scrie ȘTERGE", stări goale (3e).

**Ecrane (`features/`)**

| Ecran | Id | Fișiere |
|---|---|---|
| Dashboard | 1a | `dashboard/DashboardPage.tsx`, `useDashboard.ts` |
| Copii + fișa | 1c, 1e | `children/ChildrenPage.tsx`, `useChildren.ts`, `useChildProfile.ts`, `ChildrenCsvDialog.tsx` |
| Copil nou | 3a | `children/ChildFormDrawer.tsx`, `child-form.ts` |
| Grupe | 1g | `groups/GroupsPage.tsx`, `useGroups.ts` |
| Vizite | 2a | `visits/VisitsPage.tsx`, `VisitFormDrawer.tsx`, `EnrollDrawer.tsx`, `useVisits.ts` |
| Achitări | 1i, 1j | `payments/PaymentsPage.tsx`, `usePayments.ts` |
| Achitare nouă | 3b | `payments/PaymentFormDrawer.tsx`, `payment-form.ts` |
| Cheltuieli + 3c | 1k, 1l, 3c | `expenses/ExpensesPage.tsx`, `useExpenses.ts` |
| Situația plăților | 1m, 1n | `status/StatusPage.tsx`, `useStatus.ts` |
| De notificat | 2b | `notify/NotifyPage.tsx`, `useNotify.ts` |
| Taxe și grupe | 2c | `fee-setup/FeeSetupPage.tsx`, `useFeeSetup.ts` |
| De verificat | 2d | `review/ReviewPage.tsx`, `useReview.ts` |
| Asociere achitări | 2e | `assign/AssignPage.tsx`, `useAssign.ts` |
| Istoric | 2f | `audit-log/AuditLogPage.tsx`, `useAuditLog.ts` |
| Notificări | 2g | `notifications/NotificationsPage.tsx`, `useNotificationPreferences.ts`, `useTelegramStatus.ts` |
| Backup și setări | 2h | `backup/BackupPage.tsx`, `ExcelImportDialog.tsx`, `useBackup.ts`, `useRestore.ts`, `useExcelTransfer.ts` |

Fiecare ecran are teste (`*.test.tsx` / `*.test.ts`) — actualizează-le odată cu markup-ul și rulează `npm test` + `npm run typecheck` în `webapp/`.

## Fișiere în pachet
`Set final.dc.html` (index) · `Sidebar.dc.html` · `Dashboard.dc.html` · `Copii.dc.html` · `Grupe.dc.html` · `Achitari.dc.html` · `Cheltuieli.dc.html` · `Situatia.dc.html` · `Operatiuni.dc.html` · `De rezolvat.dc.html` · `Administrare.dc.html` · `Formulare.dc.html` · `support.js` (runtime pentru a deschide fișierele de design) · `web/assets/*` (copii locale ale logo-ului, identice cu `webapp/public/assets/`).

## Funcții noi, "de confirmat" cu utilizatorul înainte de implementare

- Buget pe categorii (Cheltuieli, 1l)
- „Anulează" în Istoric (undo pe o acțiune din audit log, 2f)
- „Ține minte plătitorul" (checkbox la asociere achitări, 2e)
- Confirmare trimisă părintelui (checkbox la achitare nouă, 3b)
- Atașare bon la cheltuială (3c)
- Rezumat săptămânal Telegram (2g)

Niciuna nu e implementată acum în aplicație — nu se construiesc fără decizie explicită a utilizatorului.

## Decis explicit împotrivă (2026-09-25) — nu se construiesc, design-ul rămâne fără ele

Din fișa copilului (1e), trei secțiuni pe care design-ul le arată dar schema `Child` reală nu le are:

- **Date personale (IDNP, adresă)** — câmpuri inexistente în `record-schema.mjs`; nu se calculează, nu se raportează nicăieri. Nu se adaugă în schemă.
- **Note multiple, cu dată** — schema are un singur câmp text (`child.notes`). Rămâne așa; nu devine listă/istoric.
- **Documente (upload PDF)** — funcție nouă, fără stocare de fișiere în backend azi. Nu se construiește.

Fișa copilului implementată (`ChildrenPage.tsx`) omite deliberat aceste trei secțiuni — nu e un gol de umplut, e decizia utilizatorului.
