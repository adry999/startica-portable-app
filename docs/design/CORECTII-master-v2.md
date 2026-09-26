# Corecții — implementarea `master-v2` față de design

Comparație între `webapp/src` (`master-v2`, 25 sept. 2026) și fișierele de design. Secțiunile 1–6: Dashboard și shell. 7: componente comune (afectează toate ecranele). 8–14: ecran cu ecran. Valorile din dreapta sunt cele finale. Se aplică întâi acestea, apoi se verifică la 1440 px lângă referință.

## 1. `shared/ui/Card.module.css` — cauza principală

| Proprietate | Acum | Corect |
|---|---|---|
| `.orange/.mint/.yellow/.pink` `color` | `--*-ink` (colorează **tot** cardul, inclusiv suma) | **șterge** `color`; textul rămâne `var(--slate)`. Culoarea ink se aplică doar pe label și pe link-uri. |
| `border-radius` | `24px` | `22px` pe KPI (adaugă varianta sau suprascrie în `kpiCard`) |
| `padding` | `20px 24px` | `22px 24px` |
| `box-shadow` pe tonuri colorate | `--shadow-card` | **none** — cardurile KPI sunt plate |
| `display` | `block` | `flex; flex-direction: column; gap: 10px` |
| `.decorative::after` | sus-dreapta, `top:-30%; right:-20%; 60%×60%` | **jos-dreapta**: `right:-30px; bottom:-40px; width/height:130px` (Încasări) / `110px` (restul); `rgba(255,255,255,.45)` Încasări, `.5` restul |
| conținut peste cerc | — | `position: relative` pe copiii cardului (legenda, link-ul) |

Cardurile albe din rândul 2 (Evoluția încasărilor, Necesită atenție, Zile de naștere): `border: 1px solid var(--border)`, **fără umbră**, radius `22px`, padding `24px 26px`, gap intern `20px`.

## 2. `features/dashboard/DashboardPage.module.css` + `.tsx`

**Label KPI (`.kpiLabel`)**
- Acum: 13 px / 700, fără majuscule, culoare moștenită.
- Corect: `font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin:0;`
- Culoare per card: Încasări `var(--orange-ink)`, Cheltuieli `var(--mint-ink)`, Diferență `var(--yellow-ink)`, Avansuri `var(--muted)`.

**Valoare (`.kpiValue`)**
- `font-size:36px; line-height:1; color:var(--slate); margin:0; white-space:nowrap` pe Încasări; **30 px** pe Cheltuieli, Diferență, Avansuri. Sume fără zecimale (`formatMoney(v, { decimals: 0 })`).

**Bara pe metode**
- Fundal `#fff` (acum `rgba(255,255,255,.6)`), `margin-top:4px`.

**Legendă (`.methodLegend`)** — de refăcut markup-ul
- Acum: un singur `<small>` „Cash: 129.036,00 lei · Card: …”.
- Corect: `display:flex; gap:14px; font-size:12px; color:#5b666e`; fiecare element = pătrat 8×8 radius 2 (culoarea metodei) + `gap:5px` + text **„Cash 129.036”** (sumă compactă fără zecimale și fără „lei”, `formatCompactMoney`).

**Cheltuieli**
- „+ Adaugă cheltuială”: 13 px / 700 `var(--mint-ink)`, `margin-top:auto`.

**Diferență**
- „încasări − cheltuieli”: 13 px `var(--muted)`, `margin-top:auto` (acum moștenește galben).

**Avansuri nerepartizate**
- Label pe un rând, **fără** `advanceHead`; pastila „Toate lunile, până azi” se mută **jos**: `align-self:flex-start; margin-top:auto; font-size:12px; font-weight:700; padding:3px 10px; background:var(--neutral-soft); color:var(--muted)`.
- Border `1.5px dashed #e6d9c4`, radius 22, fundal alb (corect acum), fără umbră.

**Rând 2**
- Titluri panou (`.panelTitle`): **20 px** (acum 18).
- Comutatorul „Încasări / Cheltuieli” lipsește — adaugă `SegmentedControl` aliniat dreapta pe rândul titlului.

## 3. `app/shell/AppShell.module.css`

- `.content`: `padding: 32px 40px 44px; gap: 24px` (acum `28px 40px 40px`, gap 20).

## 4. `app/shell/Topbar.tsx` / `nav-items.ts`

- Titlul Dashboard: **„Rezumatul lunii”** (acum „Dashboard”) → `VIEW_TITLES.dashboard.title`.
- Eyebrow + titlu: `gap:2px`, titlu `line-height:1.1`.
- Căutare: `padding:10px 14px; font-size:14px`; placeholder `#9aa3a9`.
- `kbd` „Ctrl K”: font-ul aplicației (nu monospace) — `font-family:inherit; font-weight:800; border-radius:6px; color:var(--muted)`.

## 5. `shared/ui/MonthPicker.module.css`

- Afișat în `Topbar` **doar** pe rutele Dashboard și Situația plăților (mod Lună). Pe restul ecranelor se ascunde.
- `.arrow`: `font-weight:800; display:flex; align-items:center; justify-content:center`.
- `.trigger`: `padding: 0 10px`.

## 6. `app/shell/Sidebar.module.css` + `.tsx`

- `.brand`: `flex-direction:row; align-items:center; justify-content:space-between` — versiunea pe aceeași linie cu logo-ul, aliniată dreapta.
- `.logo`: `height:38px; width:auto` (acum `width:100%` → logo uriaș).
- `.navItem`: `border-radius:12px` (acum 14).
- Versiunea: formatul `v2.0.0` (prefix „v”).

## 7. Componente comune — afectează toate ecranele

**`shared/ui/DataTable.module.css`**
- `.wrap`: `box-shadow: none; border: 1px solid var(--border); border-radius: 22px` (acum umbră + `--radius-xl`). Când tabelul e deja într-un `Card`, `.wrap` nu mai are border propriu.
- `thead th`: `font-size:11px; letter-spacing:.07em; color:var(--subtle); padding:10px 20px` (acum 12 px, .05em, `--muted`).
- `td`: `padding:11px 20px` (acum `12px 16px`).

**`shared/ui/Badge.module.css`**
- `font-size:12px; padding:4px 10px; line-height:1.2` (acum 11 px / `2px 8px`). Varianta cu punct (statut plată): punct 6 px `currentColor`, gap 6.

**`shared/ui/SegmentedControl.module.css`** — două variante:
- `pill` (comutatoare de vizualizare în antet: Tabel/Pe luni, Lună/An școlar): track `padding:3px`, opțiune `padding:7px 14px; font-weight:800`, activ `box-shadow:0 1px 3px rgba(58,71,80,.12)` (acum `--shadow-card`, prea puternic).
- `tabs` (filtre în capul tabelului: Activi/Arhivați, Toți/Restanțieri…): track `background:var(--neutral-soft); border-radius:12px`, opțiune `border-radius:10px; padding:7px 14px; font-weight:700`, activ `box-shadow:0 1px 3px rgba(58,71,80,.1)`. Tab-ul „Restanțieri” activ are text `var(--pink-ink)`.

**Câmpuri în bara de filtre** (Copii, Cheltuieli, Vizite, Achitări — `.search`, `.select`)
- `border:1px solid var(--border)` (acum `--input-border` `#c9c4ba`, prea închis), `padding:10px 14px; font-size:14px; border-radius:12px`. Placeholder `var(--subtle)`, prefix „⌕”.

**Meniu ⋯ (`.rowMenu`)** — duplicat în Copii și Cheltuieli; mută-l în `shared/ui/RowMenu.tsx` și folosește-l și în Achitări, Vizite.
- Separator `1px var(--row-divider)` înainte de „Șterge definitiv”; panou `border-radius:14px; box-shadow:0 12px 28px rgba(58,71,80,.18); border:1px solid var(--border)`.

**Confirmare ștergere** — `window.confirm` (Achitări, Copii) → dialog 3d „Scrie ȘTERGE” (`shared/ui/ConfirmDeleteDialog.tsx`, nou).

## 8. Copii (`features/children/ChildrenPage.module.css`)
- `.statValue*`: cifra rămâne `var(--slate)`; culoarea ink doar pe link-ul „Verifică →” (aceeași regulă ca la Dashboard).
- `.statCard`: fundal soft pe ton, fără umbră.
- `.tableCard`: `border:1px solid var(--border)`, fără umbră.
- `.toolbar`: `border-bottom:1px solid var(--border)` (separă filtrele de capul tabelului).
- `.selectionBar`: corect; adaugă „Mută în grupă” și „Exportă”.

## 9. Grupe (`features/groups/GroupsPage.module.css`)
- `.tileOpen`: `outline` → `border:2px solid <culoarea grupei>` (acum slate pe toate).
- `.occupancyBar span`: umplere în culoarea grupei (`--orange`, `--mint`…), nu slate.
- `.newTile`: `border:1.5px dashed #e0d5c2; background:transparent`.
- Pastila „▾ Deschide / ▴ Restrânge” lipsește din card — adaug-o jos-dreapta (`.tilePill` există, dar e folosit sus).
- `.memberRow`: `border-radius:14px; padding:10px 12px`; avatar 32 px inițiale pastel (lipsește).
- `.addRow select` → combobox cu căutare și sugestii (copiii fără grupă).

## 10. Achitări (`features/payments/`)
- `.summaryLabel`: 12 px / 800 / uppercase / .08em, culoare ink (ca la Dashboard). `.summaryValue`: `var(--slate)`; cardurile cu 0 → valoare `var(--subtle)`.
- Tonuri sumar: Total filtrat orange, **Cash / Card / Transfer albe cu border** (acum mint/yellow/pink — prea multă culoare pe un rând).
- **Filtrele** stau într-un `Card` separat → mută-le în capul tabelului (ca la Copii). „De la / Până la” (două `input type=month`) → un singur buton „Perioadă ▾” cu meniu.
- Lipsește rândul „Filtre active” cu chip-uri ștergibile + „Resetează” (există la Cheltuieli — `.chip`, refolosește).
- Rândul are 3 link-uri Arhivează/Editează/Șterge → **meniu ⋯**. Sub copil, la neasociate: link „Asociază →” (lipsește).
- `.selectionBar`: e sus, lipit de tabel → **flotant jos** (`position:sticky; bottom:24px; margin:0 auto; width:fit-content; border-radius:16px`), cu „Asociază cu un copil · Exportă · Arhivează”.
- **Pe luni (1j)** e acum un tabel simplu per lună. De făcut: tab-uri Toate / Neasociate / Arhivate; rând cu ziua mare (Baloo 20) + copil + badge-uri; click → panou detaliu dreapta 400 px (nu drawer-ul de editare).

## 11. Cheltuieli (`features/expenses/ExpensesPage.module.css`)
- `.kpiLabel` / `.kpiValue`: ca la Achitări (uppercase 12/800; valoare slate 36 px).
- `.categoryDot`: pătrat 8×8 radius 2 (acum cerc), ca în legenda de la Dashboard.
- `.tableCard`: border, fără umbră.
- **Pe zile (1l)**: lipsește blocul „Adaugă rapid” (mint, radius 20) și coloana de buget (buget — de confirmat). `.dayHead`: data Baloo 18 + total zi dreapta; `.dayRow`: fundal alb, `border-radius:14px; border:1px solid var(--row-divider)`.

## 12. Situația plăților (`features/status/`) — cel mai departe de design
Acum: un tabel simplu (Contract, Copil, Taxă, Achitat, Rest, Credit, Scadență, Situație), fără filtre. De construit după 1m / 1n:
- Antet: comutator `pill` „Lună | An școlar” + „Tipărește”. Textul explicativ lung → tooltip „ⓘ Cum se calculează” lângă titlu.
- 4 carduri sumar (De încasat alb · Încasat mint cu bară · Restanțe pink · Fără taxă setată yellow + „Completează →” spre Taxe și grupe).
- Capul tabelului: tabs Toți / Restanțieri / Parțial / Achitat / Urmează (cu contoare), căutare, „Grupă ▾”.
- Coloane: Copil (avatar + nume + părinte) · Scadență („ziua 20”) · Taxă · Achitat · Rest (`--pink-ink` dacă > 0) · Statut (badge) · CTA („Notifică” la neachitat/parțial → `SmsConfirmDialog`, „Vezi fișa” la rest). Coloana Credit → în fișa copilului.
- Banner jos `var(--yellow-soft)`: „N restanțieri · Notifică toți”.
- **An școlar (1n)**: hartă 12 luni (componentă nouă `PaymentHeatmap.tsx`), 3 carduri sus. Date din `useStatus` pe fiecare lună a anului școlar.
- SMS: `Situatia.dc.html#2a/#2b/#2c`; istoric și șabloane: `Sms.dc.html#4a/#4b`.

## 13. Vizite (`features/visits/VisitsPage.module.css`)
- `.statsRow` 4 carduri → pastile inline (număr Baloo 22 + etichetă 13 px, `gap:24px`), fără fundal de card.
- Layout: acum calendar pe toată lățimea + tabel cu 5 butoane pe rând dedesubt → grid `1.6fr 1fr`: calendar | panoul zilei (oră, copil, părinte, grupă dorită, notă, 4 butoane „Cum a decurs vizita?”). Tabelul devine opțional (link „Vezi ca listă”).
- `.calendarCell`: `min-height:72px` corect; `border-radius:14px`; ziua selectată `background:var(--orange-soft); border:2px solid var(--orange)`.
- `.linkButtonPrimary` pe rând dispare (acțiunile trec în panou).

## 14. Drawer (`shared/ui/Drawer.module.css`)
- `.panel` lățime: 620 px copil, 560 px achitare (prin prop `width`).
- `.header`: `padding:24px 28px 16px`; `.body`/`.footer`: padding lateral 28 px. `.footer`: `display:flex; gap:10px; align-items:center; background:#fff` cu hint stânga și butoane dreapta.

## Verificare
Deschide `Dashboard.dc.html#1a` și aplicația la 1440 px, una lângă alta. Pe rândul KPI trebuie să coincidă: majusculele din label, suma gri-închis, cercul jos-dreapta, lipsa umbrei, legenda cu pătrățele și pastila Avansuri jos.


## Copii — elimină „Import CSV” din antet
Importul se face o singură dată, din Administrare → Backup și setări → „Importă copii din CSV”. În antetul paginii Copii rămâne doar „+ Adaugă copil”. Nicio altă pagină nu are butoane de import.
